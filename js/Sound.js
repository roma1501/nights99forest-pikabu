// Sound.js — звук игры на Web Audio: эффекты и музыка по путям assets/sounds/….
// Звуки берутся из библиотеки Sound Pack (в корне набора, в архив не едет):
// node tools/sounds.mjs find <слова> -> add "<путь в Sound Pack>" <имя> копирует
// файл в assets/sounds/ латинским именем. В коде путь — ЛИТЕРАЛОМ, иначе сборщик
// его не увидит (Sound.play с путём в кавычках — см. скилл game).
//
// Молчит, когда: игрок выключил звук (setMuted — хранится в Store), платформа
// выключила звук (Playables isAudioEnabled), игра на любой паузе (Pause.js —
// вкладка скрыта, реклама, пауза платформы или игрока). На паузе контекст
// приостанавливается: музыка встаёт и продолжается с того же места.
// Обычный браузер пускает звук после жеста игрока: AudioContext создаётся на первом
// pointerdown / keydown, до него файлы декодирует OfflineAudioContext (буфер
// годится любому контексту), а музыка ждёт жеста и стартует сама.
// Громкость — SOUND_VOLUME и MUSIC_VOLUME (Constants.js, редактор), читается при
// каждом звуке.

/** @satisfies {Record<string, any>} */
const Sound = {
    /** @type {AudioContext | null} */
    ctx: null,
    /** @type {GainNode | null} */
    master: null,
    /** @type {GainNode | null} */
    musicGain: null,
    /** @type {BaseAudioContext | null} */
    _decoder: null,
    buffers: new Map(),     // url -> Promise<AudioBuffer | null>
    masterK: 1, musicK: 1,  // множители громкости из настроек (UIPanels)
    muted: false,           // игрок
    platformMuted: false,   // платформа (Playables)
    _music: null,           // { url, opts, source, gain }
    _inited: false,

    init() {
        if (this._inited) return;
        this._inited = true;
        this.muted = Store.get(this._key('muted')) === '1';
        const unlock = () => {
            if (!this._ensure()) return;
            this._sync();
            if (this._music && !this._music.gain) this._startTrack(this._music, 0.6);
            for (const h of this._loops) this._startLoop(h);
        };
        for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, unlock, true);
        Pause.onChange(() => this._sync());
    },

    _key(name) {
        return (typeof GAME_ID !== 'undefined' ? GAME_ID : 'lory-game') + '.' + name;
    },

    // Живой контекст — только после жеста (зовёт unlock).
    _ensure() {
        if (this.ctx) return this.ctx;
        const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
        if (!AC) return null;
        try { this.ctx = new AC(); } catch (e) { return null; }
        this.master = this.ctx.createGain();
        // Keep simultaneous impacts and ambience from clipping the output mix.
        if (this.ctx.createDynamicsCompressor) {
            const limiter = this.ctx.createDynamicsCompressor();
            limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 12;
            limiter.attack.value = .003; limiter.release.value = .18;
            this.master.connect(limiter); limiter.connect(this.ctx.destination);
        } else this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.connect(this.master);
        return this.ctx;
    },

    get unlocked() { return !!this.ctx; },
    get silent() { return this.muted || this.platformMuted || Pause.active; },

    // Громкость и приостановка контекста по состоянию.
    _sync() {
        const ctx = this.ctx;
        if (!ctx) return;
        const t = ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setTargetAtTime(this.muted || this.platformMuted ? 0 : 1, t, 0.03);
        this.musicGain.gain.setTargetAtTime(this._volume('music'), t, 0.05);
        if (Pause.active) { if (ctx.state === 'running') ctx.suspend().catch(() => {}); }
        else if (ctx.state !== 'running') ctx.resume().catch(() => {});
    },

    _volume(kind) {
        const v = kind === 'music'
            ? (typeof MUSIC_VOLUME !== 'undefined' ? MUSIC_VOLUME : 0.5)
            : (typeof SOUND_VOLUME !== 'undefined' ? SOUND_VOLUME : 0.8);
        const k = kind === 'music' ? (this.musicK == null ? 1 : this.musicK) : (this.masterK == null ? 1 : this.masterK);
        return Math.max(0, Math.min(1, (Number(v) || 0) * k));
    },

    // Декодер до жеста: OfflineAudioContext не требует разрешения на звук.
    _decodeWith() {
        if (this.ctx) return this.ctx;
        if (!this._decoder) {
            const OAC = window.OfflineAudioContext || /** @type {any} */ (window).webkitOfflineAudioContext;
            try { this._decoder = OAC ? new OAC(1, 1, 44100) : null; } catch (e) { this._decoder = null; }
        }
        return this._decoder;
    },

    // url -> Promise<AudioBuffer | null>: грузится и декодируется раз на страницу.
    // Файла нет или формат не читается — null и предупреждение, игра не падает.
    load(url) {
        let p = this.buffers.get(url);
        if (!p) {
            const dec = this._decodeWith();
            p = !dec ? Promise.resolve(null) : fetch(url)
                .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
                .then(buf => new Promise((resolve, reject) => dec.decodeAudioData(buf, resolve, reject)))
                .catch(e => { console.warn('Sound: не загрузился ' + url + ' — ' + ((e && e.message) || e)); return null; });
            this.buffers.set(url, p);
        }
        return p;
    },

    preload(urls) {
        return Promise.all((urls || []).map(u => this.load(u)));
    },

    // Эффект. opts: { volume: 0..1 (× SOUND_VOLUME), rate: скорость (1 — как есть),
    // detune: разброс скорости ±доля (0.05 — живее повторы) }. На паузе, без звука и
    // до первого жеста не играет. Возвращает { stop() } или null.
    play(url, opts) {
        const o = opts || {};
        const ctx = this.ctx;
        if (!ctx || this.silent) return null;
        const handle = { source: null, gain: null, panner: null, ended: false, stopped: false,
            volume: o.volume == null ? 1 : o.volume, pan: o.pan || 0,
            set(volume, pan) {
                this.volume = volume; this.pan = pan || 0;
                if (this.gain) this.gain.gain.setTargetAtTime(Sound._volume('sfx') * volume, ctx.currentTime, .03);
                if (this.panner) this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, this.pan)), ctx.currentTime, .03);
            },
            stop() { this.stopped = true; if (this.source) try { this.source.stop(); } catch (e) { /* уже стоит */ } } };
        this.load(url).then(buf => {
            if (!buf || handle.stopped || this.silent) { handle.ended = true; return; }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const rate = (o.rate || 1) * (o.detune ? 1 + (Math.random() * 2 - 1) * o.detune : 1);
            src.playbackRate.value = Math.max(0.1, rate);
            const g = ctx.createGain();
            g.gain.value = this._volume('sfx') * handle.volume;
            src.connect(g);
            let out = g;
            if ((o.spatial || o.pan) && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, handle.pan)); g.connect(pn); out = pn; handle.panner = pn; }
            out.connect(this.master);
            handle.gain = g;
            src.onended = () => { handle.ended = true; src.disconnect(); g.disconnect(); if (handle.panner) handle.panner.disconnect(); };
            src.start();
            handle.source = src;
        });
        return handle;
    },

    // Готовый буфер (синтез): Sound.play('synth:имя')
    putBuffer(url, buf) { this.buffers.set(url, Promise.resolve(buf)); },
    makeBuffer(channelData, rate) {
        const dec = this._decodeWith();
        const b = (dec && dec.createBuffer) ? dec.createBuffer(1, channelData.length, rate) : null;
        if (b) b.getChannelData(0).set(channelData);
        return b;
    },

    // Зацикленный звук с плавной громкостью: h = Sound.loop(url, { volume, rate }); h.set(volume, rate); h.stop()
    _loops: [],
    loop(url, opts) {
        const o = opts || {};
        const h = { url, vol: o.volume == null ? 1 : o.volume, rate: o.rate || 1, pan: 0, source: null, gain: null, panner: null, stopped: false, started: false,
            set(v, r, pan) { if (v != null) this.vol = v; if (r != null) this.rate = r; if (pan != null) this.pan = pan; Sound._applyLoop(this); },
            stop() { this.stopped = true; try { if (this.source) this.source.stop(); } catch (e) { /* ok */ } const i = Sound._loops.indexOf(this); if (i >= 0) Sound._loops.splice(i, 1); } };
        this._loops.push(h);
        if (h.vol > 0) this.load(url);
        if (this.ctx && h.vol > 0) this._startLoop(h);
        return h;
    },
    _startLoop(h) {
        const ctx = this.ctx;
        if (!ctx || h.started || h.stopped || h.vol <= 0) return;
        h.started = true;
        this.load(h.url).then(buf => {
            if (!buf || h.stopped) return;
            const src = ctx.createBufferSource();
            src.buffer = buf; src.loop = true;
            src.loopStart = 0; src.loopEnd = buf.duration;
            const g = ctx.createGain(); g.gain.value = 0;
            src.connect(g);
            let out = g;
            if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); g.connect(pn); h.panner = pn; out = pn; }
            out.connect(this.master);
            src.start(0, Math.random() * buf.duration * 0.9);
            h.source = src; h.gain = g;
            this._applyLoop(h);
        });
    },
    _applyLoop(h) {
        if (!h.started && h.vol > 0 && this.ctx) this._startLoop(h);
        if (!h.gain || !this.ctx) return;
        const t = this.ctx.currentTime;
        h.gain.gain.setTargetAtTime(this._volume('sfx') * h.vol, t, 0.08);
        if (h.source) h.source.playbackRate.setTargetAtTime(Math.max(0.1, h.rate), t, 0.1);
        if (h.panner) h.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, h.pan)), t, 0.08);
    },

    // Музыка по кругу; другая дорожка сменяет прежнюю плавно, null — выключить.
    // До первого жеста игрока дорожка ждёт и стартует сама.
    // opts: { volume: 0..1 (× MUSIC_VOLUME), fade: секунды смены }.
    music(url, opts) {
        const o = opts || {};
        const old = this._music;
        if (old ? old.url === url : !url) return;
        this._music = url ? { url, opts: o, source: null, gain: null } : null;
        const fade = o.fade == null ? 0.6 : o.fade;
        if (old) this._stopTrack(old, fade);
        if (url) this.load(url);   // декодируется заранее, пока ждёт жеста
        if (this._music && this.ctx) this._startTrack(this._music, fade);
    },

    stopMusic() { this.music(null); },

    _startTrack(rec, fade) {
        const ctx = this.ctx;
        rec.gain = ctx.createGain();
        rec.gain.gain.value = 0;
        rec.gain.connect(this.musicGain);
        this.load(rec.url).then(buf => {
            if (!buf || this._music !== rec) return;
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.loop = true;
            src.connect(rec.gain);
            src.start();
            rec.source = src;
            rec.gain.gain.setTargetAtTime(rec.opts.volume == null ? 1 : rec.opts.volume, ctx.currentTime, Math.max(0.01, fade / 3));
        });
    },

    _stopTrack(rec, fade) {
        if (!rec.gain || !this.ctx) return;
        rec.gain.gain.setTargetAtTime(0, this.ctx.currentTime, Math.max(0.01, fade / 3));
        setTimeout(() => { if (rec.source) try { rec.source.stop(); } catch (e) { /* уже стоит */ } }, fade * 1000 + 100);
    },

    // Звук игрока (кнопка в меню) — запоминается.
    setMuted(on) {
        this.muted = !!on;
        Store.set(this._key('muted'), this.muted ? '1' : '0');
        this._sync();
    },

    toggleMuted() { this.setMuted(!this.muted); return this.muted; },

    // Платформа выключила звук (Playables: кнопка звука YouTube).
    setPlatformMuted(on) {
        this.platformMuted = !!on;
        // Playables may grant audio focus without an in-game gesture. Try now;
        // browsers with gesture restrictions still use init()'s unlock fallback.
        if (!this.platformMuted && !this.muted) this._ensure();
        this._sync();
        if (!this.platformMuted && this.ctx && this._music && !this._music.gain) this._startTrack(this._music, 0.6);
    },
};

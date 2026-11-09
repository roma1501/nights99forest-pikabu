// Platform.js — платформа игры: Яндекс Игры (YaGames), YouTube Playables (ytgame),
// Playgama Bridge (bridge), CrazyGames (CrazyGames.SDK) или локальный запуск. Игра зовёт только Platform — SDK знает этот файл.
// SDK подключает сборка: build.bat yandex вписывает в index.html скрипт /sdk.js,
// build.bat playables — SDK Playables первым скриптом, build.bat playgama — Bridge первым
// скриптом и playgama-bridge-config.json рядом с index.html. Без SDK (run.bat, web-сборка)
// работает локальный адаптер: сохранения — в Store, реклама — ничего (с ?mockads в
// адресе — заглушка-оверлей на секунду: проверить паузу, звук и выдачу награды).
// Playgama: весь Store идёт через Bridge Storage (ключи в памяти, запись пачкой одним вызовом),
// язык — platform.language, пауза и звук — события Bridge, game_ready — в ready(),
// interstitial — и в естественных паузах (ads.pause), события игры и performance_sample — analytics.
// CrazyGames: весь Store в модуле data, язык — systemInfo.locale, звук — settings.muteAudio, gameplayStart/Stop (окно игры —
// перерыв, фокус площадка считает сама), midgame только при экране смерти/финала (ads.result), на кнопках навигации рекламы нет.
//
//   await Platform.init()        SDK, язык платформы, события паузы (main.js)
//   Platform.firstFrame()        экран загрузки на экране (Playables firstFrameReady; main.js)
//   Platform.ready()             игра готова к вводу: Яндекс LoadingAPI.ready, Playables gameReady (main.js)
//   Platform.gameplay(on)        идёт ли игровой процесс (Яндекс GameplayAPI start/stop);
//                                на паузе (Pause.js) движок сам шлёт stop, после — start
//   Platform.ads.roundEnded()    раунд завершён (победа или поражение) — ОДИН раз на раунд
//   Platform.ads.next(go)        переход по кнопке «Далее/Заново/Меню»: после двух
//                                результатов сначала interstitial, потом go(); защита от двойного клика
//   await Platform.rewarded(id)  true — ТОЛЬКО если SDK подтвердил просмотр
//   Platform.submitScore(n)      рекорд: Яндекс — лидерборд 'Score' (не чаще раза в секунду), Playables — sendScore
//   await Platform.leaderboard() [{ rank, name, score, me }] или null (Яндекс)
//   await Platform.load()        сохранение игры (объект) или null
//   await Platform.save(obj)     записать сохранение (Яндекс — облако игрока + Store; Playables, Playgama — Store,
//                                а он целиком в облаке платформы)
//   Platform.ads.pause(go)       естественная пауза (Playgama, Playables: смерть, выход в меню) — interstitial, потом go()
//   Platform.ads.gate(go)        Playables: из меню в игру (продолжить, начать) — interstitial, потом go()
//   Platform.ads.tap(where)      Playables: кнопка или окно меню — запрос interstitial без ожидания (частоту решает YouTube)
//   Platform.ads.result(where)   CrazyGames: экран смерти/финала без предложения награды — midgame (частоту решает SDK)
//   Platform.adsAvailable()      false — реклама недоступна (AdBlock, Basic Launch): кнопки наград не показывать
//   Platform.reviveOffer()       можно ли на этой смерти предлагать возрождение за рекламу
//   Platform.track(name, data)   событие игры в аналитику платформы (Playgama analytics.send; иначе — ничего)
//   Platform.perfFrame(active)   кадр для performance_sample (Playgama, раз в ~30 с активной игры)
// На время рекламы игра и звук стоят (Pause 'ad'), после — прежнее состояние.

/** @satisfies {Record<string, any>} */
const Platform = {
    name: 'local',        // 'yandex' | 'playables' | 'playgama' | 'crazygames' | 'local'
    sdk: null,            // объект SDK Яндекса (ysdk), Playgama Bridge или CrazyGames.SDK
    lang: null,           // язык платформы (BCP-47) или null
    player: null,         // игрок Яндекса
    LEADERBOARD: 'Score', // технический id лидерборда Яндекса (в интерфейсе — «Рекорды»)
    _readySent: false,
    _firstFrameSent: false,
    _playing: false,
    _gameplaySent: false, // последнее, что ушло в GameplayAPI: stop без start не шлётся
    _adBusy: false,
    _loaded: null,        // Promise первого load() — Playables: saveData только после loadData
    _scoreAt: 0,
    _scoreTimer: 0,
    _scorePending: null,
    _adAt: -1e9,          // Playgama: время последнего interstitial (с), свой предел частоты поверх Bridge
    _rewardAt: -1e9,      // время последнего запроса rewarded (мс): кнопки наград не вызывают interstitial
    _tapBusy: false,      // Playables: запрос interstitial из меню ещё в пути
    _adsOff: false,       // CrazyGames: реклама недоступна (AdBlock, adsDisabled) — кнопки наград прячутся
    _reviveAt: 0,         // CrazyGames: первая смерть / последнее предложение возрождения за рекламу (мс)
    _initAt: 0,           // Playgama: время запуска SDK (с) — первый interstitial не раньше чем через 30 с
    _store: null,         // Playgama: состояние записи Store -> Bridge Storage
    _perf: null,          // Playgama: окно performance_sample

    async init() {
        try {
            if (typeof YaGames !== 'undefined') await this._initYandex();
            else if (typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) await this._initPlayables();
            else if (typeof bridge !== 'undefined' && bridge && typeof bridge.initialize === 'function') await this._initPlaygama();
            else if (typeof CrazyGames !== 'undefined' && CrazyGames && CrazyGames.SDK) await this._initCrazyGames();
            else if (Store.mem && !Store.onChange) this._storeLocal();   // сборка playgama без Bridge (скрипт SDK не загрузился)
        } catch (e) {
            // В Playables нельзя незаметно перейти на локальные сохранения или
            // потерять обязательные SDK-события. Загрузка покажет ошибку/повтор.
            if (typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) throw e;
            console.warn('Platform: SDK не поднялся, играем локально — ' + ((e && e.message) || e));
            this.name = 'local';
            this.sdk = null;
            if (Store.mem && !Store.onChange) this._storeLocal();
        }
        Pause.onChange(() => { this._syncGameplay(); if (this._perf) this._perf.last = 0; });
        console.log('Platform: ' + this.name + (this.lang ? ', язык платформы ' + this.lang : ''));
        return this;
    },

    async _initYandex() {
        let timer = 0;
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('YaGames.init timeout')), 8000); });
        try { this.sdk = await Promise.race([YaGames.init(), timeout]); } finally { clearTimeout(timer); }
        this.name = 'yandex';
        try { this.lang = this.sdk.environment.i18n.lang || null; } catch (e) { /* язык по умолчанию */ }
        if (typeof this.sdk.on === 'function') {
            this.sdk.on('game_api_pause', () => Pause.set('platform', true));
            this.sdk.on('game_api_resume', () => Pause.set('platform', false));
        }
        try { this.player = await this.sdk.getPlayer({ scopes: false }); } catch (e) { this.player = null; }
    },

    async _initPlayables() {
        this.name = 'playables';
        const sys = ytgame.system;
        // onPause: игра свернута — всё несохранённое уходит в облако сразу (SHOULD сохраняться при onPause)
        sys.onPause(() => { Pause.set('platform', true); this._storeFlush(true); });
        sys.onResume(() => Pause.set('platform', false));
        sys.onAudioEnabledChange((on) => Sound.setPlatformMuted(!on));
        Sound.setPlatformMuted(!sys.isAudioEnabled());
        try { this.lang = await sys.getLanguage(); } catch (e) { this.lang = null; }
        // Прогресс Playables — только облако SDK (MUST). Всё хранилище игры (Store: партия, кошелёк, скины, настройки)
        // загружается одним loadData ДО старта; ошибка или битые данные — экран загрузки с повтором, облако не затирается.
        await this._storeLoad();
        if (typeof Sound !== 'undefined' && Sound._key) Sound.muted = Store.get(Sound._key('muted')) === '1';
    },

    // Playgama Bridge v2: initialize -> язык -> Storage (до любых чтений игры) -> пауза/звук платформы.
    async _initPlaygama() {
        const B = bridge;
        let timer = 0;
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('bridge.initialize timeout')), 15000); });
        try { await Promise.race([B.initialize(), timeout]); } finally { clearTimeout(timer); }
        this.name = 'playgama';
        this.sdk = B;
        try { this.lang = B.platform.language || null; } catch (e) { this.lang = null; }
        await this._storeLoad();
        const P = B.platform, E = B.EVENT_NAME || {}, ad = B.advertisement;
        const snd = typeof Sound !== 'undefined' ? Sound : null;
        // выключенный игроком звук лежит в Store — до загрузки хранилища его ещё не было
        if (snd) snd.muted = Store.get(snd._key('muted')) === '1';
        P.on(E.PAUSE_STATE_CHANGED || 'pause_state_changed', (paused) => Pause.set('platform', !!paused));
        P.on(E.AUDIO_STATE_CHANGED || 'audio_state_changed', (on) => { if (snd) snd.setPlatformMuted(!on); });
        if (snd) snd.setPlatformMuted(P.isAudioEnabled === false);
        if (P.isPaused === true) Pause.set('platform', true);
        // реклама открыта (в том числе уже при старте) — игра и звук стоят до закрытия
        const adState = (state) => { if (state === 'opened') Pause.set('ad', true); else if (state === 'closed' || state === 'failed') Pause.set('ad', false); };
        if (ad && typeof ad.on === 'function') {
            ad.on(E.INTERSTITIAL_STATE_CHANGED || 'interstitial_state_changed', adState);
            ad.on(E.REWARDED_STATE_CHANGED || 'rewarded_state_changed', adState);
            if (ad.interstitialState === 'opened' || ad.rewardedState === 'opened') Pause.set('ad', true);
        }
        this._initAt = Date.now() / 1000;
        this._perfInit();
    },

    // CrazyGames SDK v3: init (заодно предзагружает данные) -> язык -> Store из модуля data -> звук площадки.
    // Вне площадки (свой домен) SDK в окружении disabled и бросает ошибки на любой вызов — играем локально.
    async _initCrazyGames() {
        const S = CrazyGames.SDK;
        await S.init();
        if (S.environment === 'disabled') throw new Error('CrazyGames SDK is disabled on this domain');
        this.name = 'crazygames';
        this.sdk = S;
        try { this.lang = (S.user && S.user.systemInfo && S.user.systemInfo.locale) || null; } catch (e) { this.lang = null; }
        try { S.game.loadingStart(); } catch (e) { /* необязательное событие */ }
        await this._storeLoad();
        const snd = typeof Sound !== 'undefined' ? Sound : null;
        if (snd && snd._key) snd.muted = Store.get(snd._key('muted')) === '1';
        // settings.muteAudio важнее настройки в игре: Sound.platformMuted перекрывает кнопку звука
        const mute = () => { if (snd && S.game.settings) snd.setPlatformMuted(!!S.game.settings.muteAudio); };
        mute();
        if (S.game.addSettingsChangeListener) S.game.addSettingsChangeListener(mute);
        // AdBlock не мешает играть: только нет кнопок наград (проверка не задерживает запуск)
        try { Promise.resolve(S.ad.hasAdblock()).then((on) => { if (on) this._adsOff = true; }, () => {}); } catch (e) { /* без проверки */ }
    },

    // --- Хранилище Playgama: Store <-> Bridge Storage --------------------------------
    // Слоты сохранения партии — отдельными ключами (большие и меняются часто), всё остальное (настройки, кошелёк,
    // достижения, записки…) — одним JSON-ключом GAME_ID.data. Загрузка и запись — один вызов get/set на все ключи.
    _storeKeys() {
        const id = typeof GAME_ID !== 'undefined' ? GAME_ID : 'lory-game';
        return { data: id + '.data', big: [id + '.slot.a', id + '.slot.b'] };
    },
    async _storeLoad() {
        const K = this._storeKeys(), keys = [K.data, ...K.big];
        if (!Store.mem) Store.mem = new Map();
        const early = new Map(Store.mem);   // записанное до загрузки — новее облака
        const st = this._store = { dirtyData: false, big: new Set(), timer: 0, busy: false, broken: false, retry: 0, gen: 0, inBig: new Set(), inData: false };
        let vals;
        try { vals = await this._storeRead(keys); }
        catch (e) {
            if (this.name === 'playables') { this._store = null; throw e; }   // Playables: только повтор, без записи
            // CrazyGames: модуль data выключен при публикации (нет галочки Progress Save) — обычное локальное сохранение
            if (this.name === 'crazygames') { console.warn('Platform: CrazyGames data недоступен — ' + ((e && e.message) || e)); this._store = null; this._storeLocal(); return; }
            // Ошибку чтения нельзя считать пустым сохранением: запись в облако выключена до перезапуска
            console.warn('Platform: Bridge Storage не прочитан, прогресс этой сессии не сохранится — ' + ((e && e.message) || e));
            st.broken = true; Store.onChange = () => {};
            return;
        }
        const str = (v) => (v == null ? null : typeof v === 'string' ? v : JSON.stringify(v));
        const list = Array.isArray(vals) ? vals : keys.map(k => vals && vals[k]);
        let data = {};
        try { const raw = str(list[0]); if (raw) data = JSON.parse(raw) || {}; } catch (e) { console.warn('Platform: повреждён ключ ' + K.data); data = {}; }
        for (const [k, v] of Object.entries(data)) if (typeof v === 'string' && !early.has(k)) Store.mem.set(k, v);
        for (let i = 0; i < K.big.length; i++) {
            const k = K.big[i];
            let v = str(list[i + 1]);
            // слот, сжатый при записи ('gz:' + base64 gzip); не распаковался — слота нет (Save.js возьмёт второй)
            if (v && v.startsWith('gz:')) { try { v = await this._gunzip(v.slice(3)); } catch (e) { v = null; } }
            if (v && !early.has(k)) Store.mem.set(k, v);
        }
        Store.onChange = (key) => this._storeDirty(key);
        for (const k of early.keys()) this._storeDirty(k);
    },
    _storeDirty(key) {
        const st = this._store;
        if (!st || st.broken) return;
        if (this._storeKeys().big.includes(key)) st.big.add(key); else st.dirtyData = true;
        // вкладку прячут или закрывают — пишем сразу; иначе пачкой раз в 2 с
        const hidden = this.name === 'playables' ? !!(Pause.has && Pause.has('platform')) : typeof document !== 'undefined' && document.visibilityState === 'hidden';
        if (hidden) this._storeFlush(true);
        else if (!st.timer) st.timer = setTimeout(() => { st.timer = 0; this._storeFlush(false); }, 2000);
    },
    // now — вкладку прячут/закрывают: пишем сразу и без сжатия, заодно всё, что ещё сжимает обычная запись
    // (она, проснувшись, видит новое поколение st.gen и не отправляет устаревшее).
    async _storeFlush(now) {
        const st = this._store;
        if (!st || st.broken) return false;
        if (st.busy && !now) { if (!st.timer) st.timer = setTimeout(() => { st.timer = 0; this._storeFlush(false); }, 500); return false; }
        const K = this._storeKeys();
        const big = new Set([...st.big, ...(now ? st.inBig : [])]);
        const withData = st.dirtyData || (now && st.inData);
        if (!withData && !big.size) return true;
        st.dirtyData = false; st.big.clear();
        const gen = ++st.gen;
        st.inBig = big; st.inData = withData; st.busy = true;
        const keys = [], values = [];
        try {
            // слоты партии — gzip (в разы меньше трафика облака); при закрытии вкладки — как есть
            const pack = (!now || this.name === 'playables') && typeof CompressionStream !== 'undefined';
            for (const k of big) {
                const v = Store.mem.has(k) ? Store.mem.get(k) : '';
                let out = v;
                if (pack && v) { try { out = 'gz:' + await this._gzip(v); } catch (e) { out = v; } }
                keys.push(k); values.push(out);
            }
            if (gen !== st.gen) return true;
            if (withData) {
                const data = {};
                for (const [k, v] of Store.mem) if (!K.big.includes(k)) data[k] = v;
                keys.unshift(K.data); values.unshift(JSON.stringify(data));
            }
            await this._storeWrite(keys, values);
            st.retry = 0;
            return true;
        } catch (e) {
            if (gen !== st.gen) return false;
            console.warn('Platform: облако платформы не записано — ' + ((e && e.message) || e));
            // повтор позже (5 с, 10 с … до минуты): снова помечаем, что не ушло
            if (withData) st.dirtyData = true;
            for (const k of big) st.big.add(k);
            st.retry = Math.min(60000, (st.retry || 2500) * 2);
            if (!st.timer) st.timer = setTimeout(() => { st.timer = 0; this._storeFlush(false); }, st.retry);
            return false;
        } finally {
            if (gen === st.gen) { st.busy = false; st.inBig = new Set(); st.inData = false; }
        }
    },
    // Облако платформы. Playgama — ключи Bridge Storage одним get/set. Playables — один документ saveData
    // { lory: 1, kv: { ключ: строка } } с теми же ключами (данные + слоты A/B в gzip); каждая запись — документ целиком.
    async _storeRead(keys) {
        if (this.name === 'crazygames') return keys.map(k => this.sdk.data.getItem(k));   // данные предзагружены в init
        if (this.name !== 'playables') return this.sdk.storage.get(keys, false);
        this._ytKv = null;
        const raw = await ytgame.game.loadData();
        const out = keys.map(() => null);
        this._ytKv = {};
        if (!raw) return out;
        const obj = JSON.parse(raw);   // повреждённый JSON — ошибка, а не «сохранения нет»
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Invalid Playables save data');
        if (obj.lory === 1 && obj.kv && typeof obj.kv === 'object') {
            this._ytKv = obj.kv;
            return keys.map(k => (typeof obj.kv[k] === 'string' ? obj.kv[k] : null));
        }
        // Старые версии писали в облако объект Platform.save: { v, t, seq, best, p: { z, d } } — p это слот партии
        // (Save.pack). Читаем без сбоев: объект — как сохранение Platform.load, слот — в слот A, рекорд — в meta.
        const id = typeof GAME_ID !== 'undefined' ? GAME_ID : 'lory-game', data = {}, rest = Object.assign({}, obj);
        delete rest.p;
        data[this._storeKey()] = JSON.stringify(rest);
        if (Number(obj.best) > 0) data[id + '.meta'] = JSON.stringify({ best: Math.floor(Number(obj.best)) });
        out[0] = JSON.stringify(data);
        if (obj.p && typeof obj.p.d === 'string') out[1] = obj.p.z === 'gzip' ? 'gz:' + obj.p.d : obj.p.d;
        return out;
    },
    async _storeWrite(keys, values) {
        if (this.name === 'crazygames') {
            try {
                keys.forEach((k, i) => { if (values[i]) this.sdk.data.setItem(k, values[i]); else this.sdk.data.removeItem(k); });
            } catch (e) {
                if (!e || e.code !== 'dataModuleDisabled') throw e;
                console.warn('Platform: CrazyGames data выключен (Progress Save) — локальное сохранение');
                this._store.broken = true; this._storeLocal();
            }
            return;
        }
        if (this.name !== 'playables') return this.sdk.storage.set(keys, values);
        const kv = Object.assign({}, this._ytKv || {});
        keys.forEach((k, i) => { kv[k] = values[i]; });
        const text = JSON.stringify({ lory: 1, kv });
        // MUST < 3 MiB: консервативно — и в UTF-16, и в UTF-8
        const bytes = Math.max(text.length * 2, new TextEncoder().encode(text).byteLength);
        if (bytes >= 3 * 1024 * 1024) throw new Error('Playables save must be smaller than 3 MiB');
        await ytgame.game.saveData(text);
        this._ytKv = kv;
    },
    // gzip <-> base64 (CompressionStream браузера): слоты партии в облаке платформы
    async _gzip(str) {
        const cs = new CompressionStream('gzip'), w = cs.writable.getWriter();
        w.write(new TextEncoder().encode(str)); w.close();
        const buf = new Uint8Array(await new Response(cs.readable).arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000)));
        return btoa(bin);
    },
    async _gunzip(b64) {
        const bin = atob(b64), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const ds = new DecompressionStream('gzip'), w = ds.writable.getWriter();
        w.write(buf); w.close();
        return await new Response(ds.readable).text();
    },
    // Сборка playgama без Bridge: обычный localStorage (то, что успели записать в память, переносится)
    _storeLocal() {
        const mem = Store.mem;
        Store.mem = null; Store.onChange = null;
        if (mem) for (const [k, v] of mem) Store.set(k, v);
    },

    // --- Жизненный цикл -------------------------------------------------------

    firstFrame() {
        if (!this._firstFrameSent && typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) {
            ytgame.game.firstFrameReady();
            this._firstFrameSent = true;
        }
    },

    ready() {
        if (this._readySent) return;
        try {
            if (this.name === 'yandex') this.sdk.features.LoadingAPI && this.sdk.features.LoadingAPI.ready();
            else if (this.name === 'crazygames') this.sdk.game.loadingStop();
            else if (this.name === 'playgama') {
                if (typeof this.sdk.setGameLoadingProgress === 'function') this.sdk.setGameLoadingProgress(100);
                this.sdk.platform.sendMessage('game_ready');
            } else if (this.name === 'playables') {
                this.firstFrame();
                ytgame.game.gameReady();
            }
            this._readySent = true;
            if (this.name === 'crazygames') this._syncGameplay();
        } catch (e) {
            if (this.name === 'playables') throw e;
            console.warn('Platform.ready:', e);
        }
    },

    // on — игрок в игровом процессе (раунд идёт). Меню, экран результата, пауза — false.
    gameplay(on) {
        this._playing = !!on;
        this._syncGameplay();
    },

    _syncGameplay() {
        let want = this._playing && !Pause.active;
        // CrazyGames: фокус и вкладку площадка считает сама (причина auto не считается); открытое окно — перерыв, мир стоит;
        // первый gameplayStart — только после loadingStop
        if (this.name === 'crazygames') want = this._playing && this._readySent && !Pause.has('manual') && !Pause.has('ad') && !Pause.has('platform') && !Pause.has('loading') && !(/** @type {any} */ (window).UI && /** @type {any} */ (window).UI.modal);
        if (this._gameplaySent === want || (this.name !== 'yandex' && this.name !== 'crazygames')) { this._gameplaySent = want; return; }
        this._gameplaySent = want;
        try {
            if (this.name === 'crazygames') { if (want) this.sdk.game.gameplayStart(); else this.sdk.game.gameplayStop(); return; }
            const api = this.sdk.features.GameplayAPI;
            if (api) { if (want) api.start(); else api.stop(); }
        } catch (e) { /* SDK без GameplayAPI */ }
    },

    // --- Реклама ----------------------------------------------------------------

    // Interstitial. true — запрос успешен (Playables НЕ подтверждает факт показа).
    // Яндекс возвращает shown. Ошибка/нет API — false, переход всё равно продолжается.
    // placement — id места из playgama-bridge-config.json (Playgama), другим платформам не нужен.
    // quiet (Playables, кнопки меню): без своей паузы 'ad' и без занятости — если YouTube покажет рекламу, он сам
    // вызовет onPause; пока запрос в пути, меню, музыка и кнопки наград работают как обычно.
    async interstitial(placement, quiet) {
        if (quiet) {
            if (this.name !== 'playables' || this._tapBusy || this._adBusy || !ytgame.ads || !ytgame.ads.requestInterstitialAd) return false;
            this._tapBusy = true;
            try { await ytgame.ads.requestInterstitialAd(); return true; } catch (e) { return false; } finally { this._tapBusy = false; }
        }
        if (this._adBusy) return false;
        if (this.name === 'crazygames') {
            if (this._adsOff) return false;
            this._adBusy = true;
            try { return await this._cgAd('midgame'); } finally { this._adBusy = false; }
        }
        if (this.name === 'playgama') {
            const ad = this.sdk.advertisement;
            // Bridge сам держит паузу между показами, но при раннем вызове может ждать — переход не должен висеть
            const gap = Number(ad && ad.minimumDelayBetweenInterstitial) || 60;
            const t = Date.now() / 1000;
            if (!ad || ad.isInterstitialSupported === false || t - this._adAt < gap || t - this._initAt < 30) return false;
        }
        this._adBusy = true;
        Pause.set('ad', true);
        try {
            if (this.name === 'playgama') {
                const shown = await this._bridgeAd(false, placement || 'game_over');
                if (shown) this._adAt = Date.now() / 1000;
                return shown;
            }
            if (this.name === 'yandex') {
                return await new Promise((resolve) => this.sdk.adv.showFullscreenAdv({ callbacks: {
                    onClose: (shown) => resolve(!!shown),
                    onError: () => resolve(false),
                    onOffline: () => resolve(false),
                } }));
            }
            if (this.name === 'playables') {
                if (!ytgame.ads || !ytgame.ads.requestInterstitialAd) return false;
                await ytgame.ads.requestInterstitialAd();
                return true;
            }
            return await this._mockAd(false);
        } catch (e) {
            return false;
        } finally {
            Pause.set('ad', false);
            this._adBusy = false;
        }
    },

    // Rewarded. id — стабильный id награды без данных игрока ('continue', 'coins-x2').
    // true — ТОЛЬКО по подтверждению SDK; закрытие и ошибка — false. Награду выдаёт
    // игра по true и один раз.
    async rewarded(id) {
        this._rewardAt = Date.now();
        if (this._adBusy) return false;
        if (this.name === 'crazygames') {
            if (this._adsOff) return false;
            this._adBusy = true;
            try { return (await this._cgAd('rewarded')) === true; } finally { this._adBusy = false; }
        }
        this._adBusy = true;
        Pause.set('ad', true);
        try {
            if (this.name === 'playgama') {
                const ad = this.sdk.advertisement;
                if (!ad || ad.isRewardedSupported === false) return false;
                // место показа — стабильная часть id: 'skin_fox' -> 'skin', 'daily_double' -> 'daily'
                return (await this._bridgeAd(true, String(id || 'reward').replace(/_.*$/, ''))) === true;
            }
            if (this.name === 'yandex') {
                return await new Promise((resolve) => {
                    let got = false;
                    this.sdk.adv.showRewardedVideo({ callbacks: {
                        onRewarded: () => { got = true; },
                        onClose: () => resolve(got),
                        onError: () => resolve(false),
                    } });
                });
            }
            if (this.name === 'playables') {
                if (!ytgame.ads || !ytgame.ads.requestRewardedAd) return false;
                return (await ytgame.ads.requestRewardedAd(String(id || 'reward'))) === true;
            }
            return await this._mockAd(true);
        } catch (e) {
            return false;
        } finally {
            Pause.set('ad', false);
            this._adBusy = false;
        }
    },

    // Реклама доступна? Кнопка награды без рекламы запрещена правилами CrazyGames (AdBlock, Basic Launch — её не показываем)
    adsAvailable() { return !(this.name === 'crazygames' && this._adsOff); },

    // Предлагать ли возрождение за рекламу на этой смерти. CrazyGames запрещает такое предложение при каждой смерти:
    // не на первой смерти сессии (там midgame) и не чаще CG_REVIVE_OFFER_GAP секунд. Вызывать один раз на смерть.
    reviveOffer() {
        if (this.name !== 'crazygames') return true;
        if (this._adsOff) return false;
        const now = Date.now(), gap = (typeof CG_REVIVE_OFFER_GAP === 'number' ? CG_REVIVE_OFFER_GAP : 300) * 1000;
        if (!this._reviveAt) { this._reviveAt = now; return false; }
        if (now - this._reviveAt < gap) return false;
        this._reviveAt = now;
        return true;
    },

    // Клики на время запроса рекламы блокируются (правило CrazyGames: до adFinished/adError интерфейс не реагирует)
    _adBlock(on) {
        if (typeof document === 'undefined' || !document.createElement || !document.body) return;
        if (on && !this._blockEl) {
            const d = this._blockEl = document.createElement('div');
            d.style.cssText = 'position:fixed;inset:0;z-index:99990;cursor:progress;background:transparent;touch-action:none';
            document.body.appendChild(d);
        } else if (!on && this._blockEl) { this._blockEl.remove(); this._blockEl = null; }
    },
    // CrazyGames: запрос ролика. Звук и игра стоят только пока ролик идёт (не при запросе). true — ролик досмотрен.
    // adsDisabled (Basic Launch, Kids) и adblock — рекламы в этой сессии нет; unfilled и adCooldown — просто не в этот раз.
    _cgAd(kind) {
        return new Promise((resolve) => {
            let done = false, timer = null;
            const finish = (v) => { if (done) return; done = true; clearTimeout(timer); this._adBlock(false); resolve(v); };
            this._adBlock(true);
            timer = setTimeout(() => finish(false), 8000);   // SDK молчит — интерфейс не висит
            try {
                this.sdk.ad.requestAd(kind, {
                    adStarted: () => { clearTimeout(timer); Pause.set('ad', true); },
                    adFinished: () => { Pause.set('ad', false); finish(true); },
                    adError: (err) => {
                        Pause.set('ad', false);
                        if (err && (err.code === 'adsDisabled' || err.code === 'adblock')) this._adsOff = true;
                        finish(false);
                    },
                });
            } catch (e) { finish(false); }
        });
    },

    // Playgama: показ через Bridge и ожидание его состояний. Нет отклика 3 с или не открылась за 8 с загрузки — false (переход не ждёт);
    // открылась — ждём закрытия. Rewarded: true только если было состояние 'rewarded' (не по 'closed').
    _bridgeAd(rewarded, placement) {
        const ad = this.sdk.advertisement, E = this.sdk.EVENT_NAME || {};
        const ev = rewarded ? (E.REWARDED_STATE_CHANGED || 'rewarded_state_changed') : (E.INTERSTITIAL_STATE_CHANGED || 'interstitial_state_changed');
        return new Promise((resolve) => {
            let done = false, opened = false, got = false, timer = null;
            const finish = (v) => {
                if (done) return;
                done = true; clearTimeout(timer);
                try { if (typeof ad.off === 'function') ad.off(ev, on); } catch (e) { /* старый Bridge без off */ }
                resolve(v);
            };
            const on = (state) => {
                if (done) return;
                if (state === 'loading') { clearTimeout(timer); timer = setTimeout(() => finish(false), 8000); }
                else if (state === 'opened') { opened = true; clearTimeout(timer); timer = setTimeout(() => finish(rewarded ? got : true), 180000); }
                else if (state === 'rewarded') got = true;
                else if (state === 'closed') finish(rewarded ? got : opened);
                else if (state === 'failed') finish(false);
            };
            ad.on(ev, on);
            // Bridge молча пропустил показ (ранний вызов) — не держим переход: 3 с на отклик, 8 с на загрузку
            timer = setTimeout(() => finish(false), 3000);
            try {
                const r = rewarded ? ad.showRewarded(placement) : ad.showInterstitial(placement);
                if (r && typeof r.catch === 'function') r.catch(() => finish(false));
            } catch (e) { finish(false); }
        });
    },

    // Локальная заглушка рекламы: только с ?mockads в адресе — оверлей на секунду,
    // rewarded засчитывается. Без флага — рекламы нет (false).
    _mockAd(reward) {
        if (!/[?&#]mockads\b/.test(location.search + location.hash)) return Promise.resolve(false);
        return new Promise((resolve) => {
            const el = document.createElement('div');
            el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
                'background:rgba(0,0,0,.85);color:#fff;font:bold 22px system-ui,sans-serif;text-align:center';
            el.textContent = (reward ? 'REWARDED' : 'INTERSTITIAL') + ' — local mock';
            document.body.appendChild(el);
            setTimeout(() => { el.remove(); resolve(true); }, 1000);
        });
    },

    // Счётчик interstitial по правилу игры: реклама — после каждых ДВУХ завершённых
    // раундов (любой исход), и только по кнопке перехода, не в момент результата.
    ads: {
        results: 0,
        busy: false,

        // Раунд завершён (победа или поражение) — звать ОДИН раз на раунд.
        roundEnded() { this.results++; },

        // Переход по кнопке: после двух результатов — сначала реклама, затем go().
        // Повторный клик, пока идёт переход, игнорируется. Реклама не пришла или
        // ошибка — переход без задержки, новый цикл из двух результатов.
        // Playgama и Playables — interstitial на каждом game over: там после каждого результата
        // (частоту держит Bridge / сам YouTube).
        async next(go) {
            if (this.busy) return;
            this.busy = true;
            try {
                // CrazyGames: на кнопках «Заново»/«Меню» рекламы нет (правило площадки) — midgame уже был на экране результата
                if (Platform.name === 'crazygames') this.results = 0;
                else if (this.results >= (Platform.name === 'playgama' || Platform.name === 'playables' ? 1 : 2)) {
                    this.results = 0;
                    await Platform.interstitial('game_over');
                }
                if (go) await go();
            } finally {
                this.busy = false;
            }
        },

        // Естественная пауза без конца раунда: смерть с возрождением, выход в меню. Только Playgama —
        // interstitial (если прошло minimumDelayBetweenInterstitial), затем go(); на других платформах — сразу go().
        async pause(go, placement) {
            if (this.busy) return;
            if (Platform.name !== 'playgama' && Platform.name !== 'playables') { if (go) await go(); return; }
            this.busy = true;
            try {
                await Platform.interstitial(placement || 'pause');
                if (go) await go();
            } finally {
                this.busy = false;
            }
        },

        // Playables (просьба издателя: больше мест вызова, частоту распределяет YouTube): переход из меню в игру —
        // сначала interstitial, потом игра, чтобы реклама не появилась посреди игрового процесса. Другие платформы — сразу go().
        async gate(go, placement) {
            if (Platform.name !== 'playables') { if (go) await go(); return; }
            return this.pause(go, placement || 'resume');
        },

        // CrazyGames: экран смерти или финала (логичная пауза, не кнопка навигации) без предложения награды — midgame.
        // Частоту держит SDK: слишком ранний запрос просто вернёт adCooldown.
        result(placement) {
            if (Platform.name !== 'crazygames' || this.busy || Platform._adBusy) return;
            Platform.interstitial(placement);
        },

        // Playables: нажатие в меню (настройки, магазин, награды, пауза, экран смерти…) — запрос без ожидания.
        // Не во время перехода, не поверх рекламы и не сразу после кнопки rewarded (там своя реклама).
        tap(placement) {
            if (Platform.name !== 'playables' || this.busy || Platform._adBusy) return;
            if (Date.now() - Platform._rewardAt < 3000) return;
            Platform.interstitial(placement || 'menu', true);
        },
    },

    // --- Аналитика Playgama ----------------------------------------------------------
    // Событие игры: имя — стабильное snake_case, меняющееся — в data (плоские строки/числа/логические).
    track(name, data) {
        // CrazyGames: «праздник» площадки — только на редких достижениях (босс, пройденная игра)
        if (this.name === 'crazygames') {
            if (name === 'boss_defeated' || (name === 'progression_completed' && data && data.step_id === 'run')) { try { this.sdk.game.happytime(); } catch (e) { /* не критично */ } }
            return;
        }
        if (this.name !== 'playgama') return;
        try {
            const an = this.sdk.analytics;
            if (an && typeof an.send === 'function') an.send(name, Object.assign({ game_version: typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '' }, data || {}));
        } catch (e) { /* аналитика не ломает игру */ }
    },

    // performance_sample: кадры активной видимой игры (не меню, не пауза, не скрытая вкладка) за ~30 с
    // окна — одно агрегированное событие. Разрыв из-за паузы или фона кадром не считается.
    _perfInit() {
        const P = this._perf = { last: 0, start: 0, active: 0, ft: [], err: 0, rej: 0, lost: 0 };
        try {
            window.addEventListener('error', () => { P.err++; });
            window.addEventListener('unhandledrejection', () => { P.rej++; });
            const cv = typeof document !== 'undefined' && document.getElementById ? document.getElementById('world3d') : null;
            if (cv) cv.addEventListener('webglcontextlost', () => { P.lost++; });
        } catch (e) { /* без счётчиков ошибок */ }
    },
    perfFrame(active) {
        const P = this._perf;
        if (!P) return;
        const now = performance.now();
        const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
        if (!active || !visible || Pause.active) { P.last = 0; return; }
        if (!P.start) P.start = now;
        if (P.last) { const ms = now - P.last; if (ms < 5000) { P.ft.push(ms); P.active += ms; } }
        P.last = now;
        if (now - P.start >= 30000) this._perfSend(now);
    },
    _perfSend(now) {
        const P = this._perf, n = P.ft.length;
        if (n >= 30) {
            const s = P.ft.slice().sort((a, b) => a - b);
            const q = (p) => s[Math.min(n - 1, Math.floor(p * (n - 1)))];
            const over = (ms) => s.filter(x => x > ms).length;
            const r1 = (x) => Math.round(x * 10) / 10;
            this.track('performance_sample', {
                target_fps: 60,
                window_ms: Math.round(now - P.start),
                active_ms: Math.round(P.active),
                frame_count: n,
                fps_avg: r1(1000 * n / P.active),
                fps_p10: r1(1000 / q(0.9)),
                frame_time_p50_ms: r1(q(0.5)),
                frame_time_p95_ms: r1(q(0.95)),
                frame_time_p99_ms: r1(q(0.99)),
                frame_time_max_ms: r1(s[n - 1]),
                frames_over_50ms: over(50),
                frames_over_100ms: over(100),
                frames_over_250ms: over(250),
                frames_over_500ms: over(500),
                frames_over_1000ms: over(1000),
                js_error_count: P.err,
                unhandled_rejection_count: P.rej,
                webgl_context_loss_count: P.lost,
            });
        }
        P.start = now; P.active = 0; P.ft = []; P.err = 0; P.rej = 0; P.lost = 0;
    },

    // --- Рекорды -------------------------------------------------------------------

    // Рекорд игрока. Яндекс: лидерборд 'Score', не чаще раза в секунду (лишнее — последним
    // значением через секунду). Playables: sendScore.
    submitScore(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return;
        const v = Math.max(0, Math.floor(number));
        if (!Number.isSafeInteger(v)) return;
        if (this.name === 'playables') {
            try { ytgame.engagement.sendScore({ value: v }).catch(() => {}); } catch (e) { /* SDK старый */ }
            return;
        }
        if (this.name !== 'yandex') return;
        this._scorePending = v;
        const wait = this._scoreAt + 1100 - Date.now();
        if (wait > 0) {
            if (!this._scoreTimer) this._scoreTimer = setTimeout(() => { this._scoreTimer = 0; this.submitScore(this._scorePending); }, wait);
            return;
        }
        this._scoreAt = Date.now();
        this._scorePending = null;
        const lb = this.sdk.leaderboards;
        const p = lb && lb.setScore ? lb.setScore(this.LEADERBOARD, v)
            : this.sdk.getLeaderboards().then((old) => old.setLeaderboardScore(this.LEADERBOARD, v));
        Promise.resolve(p).catch((e) => console.warn('Platform.submitScore:', (e && e.message) || e));
    },

    // Таблица рекордов (Яндекс): [{ rank, name, score, me }] или null — нет SDK,
    // нет лидерборда или ошибка. Лимит Яндекса — 20 запросов за 5 минут: кэшировать в игре.
    async leaderboard(opts) {
        if (this.name !== 'yandex') return null;
        const o = Object.assign({ quantityTop: 10, includeUser: true, quantityAround: 3 }, opts || {});
        try {
            const lb = this.sdk.leaderboards;
            const res = lb && lb.getEntries ? await lb.getEntries(this.LEADERBOARD, o)
                : await (await this.sdk.getLeaderboards()).getLeaderboardEntries(this.LEADERBOARD, o);
            let myId = '';
            try { myId = this.player ? this.player.getUniqueID() : ''; } catch (e) { /* аноним */ }
            return (res.entries || []).map((e) => ({
                rank: e.rank, score: e.score,
                name: (e.player && e.player.publicName) || '',
                me: !!(myId && e.player && e.player.uniqueID === myId),
            }));
        } catch (e) {
            return null;
        }
    },

    // --- Сохранения ------------------------------------------------------------------

    // Облачная копия на диске живёт под своим ключом: игровые слоты сохранений (Save.js: GAME_ID.slot.a/.b) этот ключ не трогает
    _storeKey() { return (typeof GAME_ID !== 'undefined' ? GAME_ID : 'lory-game') + '.cloud'; },

    // Сохранение игры: объект или null.
    load() {
        if (!this._loaded) this._loaded = this._load().catch((error) => {
            this._loaded = null; // ошибка сети/данных не означает пустое сохранение; возможен повтор
            throw error;
        });
        return this._loaded;
    },

    async _load() {
        if (this.name === 'playables') {
            // Облако уже загружено в Store при init (loadData до старта); не загружено — ошибка, а не «пусто»
            if (!this._store || !Store.onChange) throw new Error('Playables save is not loaded');
            return Store.getJSON(this._storeKey(), null);
        }
        const local = Store.getJSON(this._storeKey(), null);
        try {
            if (this.name === 'yandex' && this.player) {
                const data = await this.player.getData(['save']);
                if (data && data.save && typeof data.save === 'object') return data.save;
            }
        } catch (e) {
            console.warn('Platform.load:', (e && e.message) || e);
        }
        return local;
    },

    // Записать JSON. Playables: в облачный Store и сразу saveData всего документа (только после успешного loadData при init;
    // без localStorage). true — облако подтвердило запись.
    async save(obj) {
        try {
            const data = JSON.stringify(obj);
            if (typeof data !== 'string') return false;
            if (this.name === 'playables') {
                // Консервативная проверка обоих представлений: < 3 MiB (MUST).
                // JSON.stringify экранирует непарные суррогаты: строка well-formed UTF-16.
                const bytes = Math.max(data.length * 2, new TextEncoder().encode(data).byteLength);
                if (bytes >= 3 * 1024 * 1024) throw new Error('Playables save must be smaller than 3 MiB');
                if (!this._store || this._store.broken || !Store.onChange) return false;
                Store.set(this._storeKey(), data);
                return await this._storeFlush(true);
            } else {
                const stored = Store.set(this._storeKey(), data);
                if (this.name === 'yandex' && this.player) await this.player.setData({ save: obj }, true);
                else if (!stored) return false;
            }
            return true;
        } catch (e) {
            console.warn('Platform.save:', (e && e.message) || e);
            return false;
        }
    },
};

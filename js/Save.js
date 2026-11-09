// Save.js — система сохранений: версионируемые слоты с контрольной суммой, безопасная запись, автосохранение, миграция и облако.
//
// Как это устроено
//  • Два слота A/B по очереди (GAME_ID.slot.a / .b): новая запись идёт в более СТАРЫЙ слот и сразу проверяется чтением,
//    поэтому прерванная или неудачная запись никогда не уничтожает последнее хорошее сохранение. Запись слота — JSON-обёртка
//    { v, seq, t, info, sum, body }: body — строка с данными игры, sum — контрольная сумма body (битое/обрезанное отбрасывается).
//  • Загрузка берёт валидный слот с наибольшим seq; повреждён один — берётся второй; оба — игра честно говорит об этом и НЕ начинает
//    новую партию втихую.
//  • Автосохранение: каждые SAVE_INTERVAL с игры, при событиях (рассвет, закат, дети, сундуки, постройки, задания), при паузе, выходе в
//    меню, сворачивании вкладки и закрытии страницы (pagehide / visibilitychange / beforeunload).
//  • Облако Яндекса: сжатая копия через Platform.save, не чаще раза в CLOUD_INTERVAL; при старте берётся более свежее.
//    Playables и Playgama: весь Store (и слоты) сам живёт в облаке платформы (Platform.js) — отдельная копия не нужна.
//  • Данные собирают модули игры (Save.collect) и применяет Game.applySave; всё, что можно потерять отдельно (боты, события),
//    изолировано try/catch — сбой одного модуля не ломает сохранение целиком.
// Чистое ядро (hash / wrap / parse / commit / best / migrate) не знает про игру и проверяется тестами (tests/save.test.mjs).

const SAVE_VERSION = 3;
const SAVE_INTERVAL = 20;       // с игрового времени между автосохранениями
const SAVE_MIN_GAP = 1.5;       // с: чаще событийные сохранения не пишем
const CLOUD_INTERVAL = 60;      // с между копиями в облако

/** @type {Record<string, any>} */
const Save = {
    seq: 0, lastWrite: 0, lastCloud: 0, since: 0, playMs: 0, dirty: false, suspended: false,
    info: null,           // { day, lv, bots, t, play, ok } лучшего сохранения (для меню «Продолжить»)
    problem: null,        // 'corrupt' | 'newer' | 'write' — последняя проблема для сообщения игроку
    memory: null,         // копия последней записи в памяти, если хранилище браузера недоступно
    _warned: false, _cloudBusy: false,

    keys() { const id = typeof GAME_ID !== 'undefined' ? GAME_ID : 'game'; return { a: id + '.slot.a', b: id + '.slot.b', legacy: id + '.save' }; },

    // ------------------------------------------------------------------------------ чистое ядро
    // FNV-1a по кодовым единицам UTF-16 (быстро, без зависимостей)
    hash(s) {
        let h = 0x811c9dc5;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
        return h.toString(16).padStart(8, '0');
    },
    // Запись слота: обёртка с метаданными и контрольной суммой тела
    wrap(data, info, seq) {
        const body = JSON.stringify(data);
        return JSON.stringify({ v: SAVE_VERSION, seq, t: Date.now(), gv: typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '', info: info || {}, len: body.length, sum: this.hash(body), body });
    },
    // Разбор записи: { ok, reason, rec, data }; reason: 'empty' | 'json' | 'shape' | 'sum' | 'newer'
    parse(raw) {
        if (!raw) return { ok: false, reason: 'empty' };
        let rec;
        try { rec = JSON.parse(raw); } catch (e) { return { ok: false, reason: 'json' }; }
        if (!rec || typeof rec !== 'object' || typeof rec.body !== 'string' || !Number.isSafeInteger(rec.seq) || rec.seq < 0 || !Number.isInteger(rec.v) || rec.v < 1) return { ok: false, reason: 'shape' };
        if (rec.v > SAVE_VERSION) return { ok: false, reason: 'newer', rec };
        if (rec.len !== rec.body.length || rec.sum !== this.hash(rec.body)) return { ok: false, reason: 'sum', rec };
        let data;
        try { data = JSON.parse(rec.body); } catch (e) { return { ok: false, reason: 'json', rec }; }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'shape', rec };
        try { return { ok: true, rec, data: this.migrate(data, rec.v) }; }
        catch (e) { return { ok: false, reason: 'shape', rec }; }
    },
    // Приведение данных старых версий к текущей
    migrate(d, v) {
        if (d.v === 2 && !d.player.yaw && d.sky) {
            // версия 2: плоская структура без enemies/world/stamina
            return { v: SAVE_VERSION, sky: d.sky, inv: d.inv, camp: d.camp, zones: d.zones, items: d.items, stats: d.stats, quest: d.quest,
                player: { x: d.player.x, z: d.player.z, hp: d.player.hp, hunger: d.player.hunger, stamina: 100, outfit: d.player.outfit },
                enemies: { guards: d.guards || [], killed: [] }, bots: { n: d.bots || 0 }, ev: d.ev, world: {}, meta: { play: 0 } };
        }
        return d;
    },
    // Оба слота: [{ key, res }] (res — результат parse)
    slots() {
        const k = this.keys();
        return [k.a, k.b].map(key => ({ key, res: this.parse(Store.get(key)) }));
    },
    // Лучшая валидная запись (наибольший seq) или null; problem — что не так с остальными
    best() {
        const sl = this.slots();
        const ok = sl.filter(s => s.res.ok).sort((p, q) => q.res.rec.seq - p.res.rec.seq);
        if (ok.length) { this.problem = null; return ok[0]; }
        const bad = sl.find(s => !s.res.ok && s.res.reason !== 'empty');
        this.problem = bad ? (bad.res.reason === 'newer' ? 'newer' : 'corrupt') : null;
        if (this.memory) { const m = this.parse(this.memory); if (m.ok) return { key: 'memory', res: m }; }
        return null;
    },
    // Записать данные в более старый слот и проверить чтением. true — запись надёжна.
    commit(data, info) {
        const k = this.keys();
        const sl = this.slots();
        // пишем в слот, который НЕ является лучшим валидным
        const valid = sl.filter(s => s.res.ok).sort((p, q) => q.res.rec.seq - p.res.rec.seq);
        const target = valid.length ? (valid[0].key === k.a ? k.b : k.a) : k.a;
        const seq = Math.max(this.seq, ...valid.map(s => s.res.rec.seq)) + 1;
        const raw = this.wrap(data, info, seq);
        this.memory = raw;
        let stored = Store.set(target, raw);
        if (!stored) {
            // нет места: освобождаем унаследованные ключи и пробуем ещё раз
            Store.remove(k.legacy); stored = Store.set(target, raw);
        }
        if (!stored || Store.get(target) !== raw) { this.problem = 'write'; return false; }
        this.seq = seq;
        return true;
    },
    clearSlots() {
        const k = this.keys();
        Store.remove(k.a); Store.remove(k.b); Store.remove(k.legacy);
        this.memory = null; this.info = null; this.seq = 0;
    },

    // ------------------------------------------------------------------------------ сжатие для облака
    async pack(str) {
        if (typeof CompressionStream !== 'undefined') {
            try {
                const cs = new CompressionStream('gzip'), w = cs.writable.getWriter();
                w.write(new TextEncoder().encode(str)); w.close();
                const buf = new Uint8Array(await new Response(cs.readable).arrayBuffer());
                let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000)));
                return { z: 'gzip', d: btoa(bin) };
            } catch (e) { /* без сжатия */ }
        }
        return { z: '', d: str };
    },
    async unpack(p) {
        if (!p || typeof p.d !== 'string') return null;
        if (p.z === '') return p.d;
        if (p.z !== 'gzip') return null;
        const bin = atob(p.d), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const ds = new DecompressionStream('gzip'), w = ds.writable.getWriter();
        w.write(buf); w.close();
        return await new Response(ds.readable).text();
    },

    // A portable expedition code uses the same checked A/B record. Profile purchases and
    // daily rewards stay on the destination device, so importing an old run cannot rewind them.
    async exportCode() {
        if (this.canWrite()) this.flush('export', true);
        const best = this.best();
        if (!best) throw new Error('save.none');
        const raw = JSON.stringify(best.res.rec), p = await this.pack(raw);
        const bytes = new TextEncoder().encode(JSON.stringify({ game: GAME_ID, format: 1, p }));
        let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return 'NF99.' + btoa(bin);
    },
    async readCode(code) {
        const limit = typeof ASTRA_SAVE_CODE_LIMIT === 'undefined' ? 2000000 : ASTRA_SAVE_CODE_LIMIT;
        if (typeof code !== 'string' || code.length > limit || !code.trim().startsWith('NF99.')) throw new Error('save.codeBad');
        try {
            const bin = atob(code.trim().slice(5)), bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
            const obj = JSON.parse(new TextDecoder().decode(bytes));
            if (obj.game !== GAME_ID || obj.format !== 1 || !obj.p || typeof obj.p.d !== 'string') throw new Error();
            let raw;
            if (obj.p.z === '') raw = obj.p.d;
            else if (obj.p.z === 'gzip') {
                const compressed = Uint8Array.from(atob(obj.p.d), c => c.charCodeAt(0));
                const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
                const reader = stream.getReader(), decoder = new TextDecoder(); let size = 0; raw = '';
                for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new Error(); } raw += decoder.decode(value, { stream: true }); }
                raw += decoder.decode();
            } else throw new Error();
            if (raw.length > limit) throw new Error();
            const result = this.parse(raw);
            if (!result.ok) throw new Error(result.reason === 'newer' ? 'save.newer' : 'save.codeBad');
            const d = result.data;
            if (!d.sky || !Number.isFinite(d.sky.day) || !Number.isFinite(d.sky.p) || !d.camp || !Number.isInteger(d.camp.level) || d.camp.level < 1 || d.camp.level > 5 || !d.player || !Number.isFinite(d.player.x) || !Number.isFinite(d.player.z) || !Number.isFinite(d.player.hp) || !d.inv || !Array.isArray(d.inv.slots)) throw new Error();
            return { data: d, info: this.describe(d) };
        } catch (e) { throw new Error(e.message === 'save.newer' ? 'save.newer' : 'save.codeBad'); }
    },
    async importCode(code) {
        const result = await this.readCode(code);
        if (!this.commit(result.data, result.info)) throw new Error('save.writeFail');
        this.refreshInfo(); this.lastCloud = -CLOUD_INTERVAL; await this.cloudPush();
        return result.info;
    },

    // ------------------------------------------------------------------------------ сбор данных игры
    // respawn — состояние «возрождение в лагере без вещей» (на случай выхода на экране смерти)
    collect(respawn) {
        const d = { v: SAVE_VERSION };
        const part = (k, fn) => { try { const x = fn(); if (x !== undefined) d[k] = x; } catch (e) { console.warn('Save.collect:', k, e); } };
        part('sky', () => Sky.state());
        part('camp', () => Camp.state());
        part('zones', () => Zones.state());
        part('world', () => World.saveState());
        part('enemies', () => Enemies.state());
        part('combat', () => (typeof Combat !== 'undefined' && Combat.state ? Combat.state() : undefined));
        part('items', () => Items.save());
        part('arrows', () => (typeof Archery !== 'undefined' ? Archery.save() : undefined));
        part('quest', () => Game.quest.save());
        part('ev', () => (window.Events ? Events.save() : null));
        part('bots', () => (window.Bots ? Bots.save() : { n: Game.botMode || 0 }));
        part('stats', () => Player.stats);
        part('meta', () => ({ play: Math.round(this.playMs), bots: Game.botMode || 0, run: Game.runId || 0, hc: Game.hardcore ? 1 : 0, hcRev: Game.hcRevived ? 1 : 0, hearts: typeof Econ !== 'undefined' ? Econ.hearts : undefined }));
        part('lore', () => (typeof Lore !== 'undefined' ? Array.from(Lore.runFound) : []));
        part('map', () => (typeof MapView !== 'undefined' ? MapView.save() : undefined));
        if (respawn) {
            part('inv', () => { const i = { tier: Inv.tier, sel: 0, slots: new Array(Inv.save().slots.length).fill(null) }; i.slots[0] = { id: 'axe_old', n: 1, mag: 0 }; i.slots[1] = { id: 'flashlight', n: 1, mag: 0 }; return i; });
            part('player', () => ({ x: Math.round(Camp.x + 240), z: Math.round(Camp.z + 110), yaw: 0, hp: 100, hunger: 65, stamina: 100 }));
        } else {
            part('inv', () => Inv.save());
            part('player', () => ({
                x: Math.round(Player.x), z: Math.round(Player.z), yaw: +Player.faceYaw.toFixed(3), hp: Math.round(Player.hp), hunger: Math.round(Player.hunger * 10) / 10, stamina: Math.round(Player.stamina),
                buff: Player.buff ? { speed: Player.buff.speed, t: Math.round(Player.buff.t * 10) / 10 } : null, flash: !!Player.flashOn, lantern: Player.lanternOn !== false,
            }));
        }
        return d;
    },
    describe(d) {
        const lv = d.camp ? d.camp.level : 1, day = d.sky ? d.sky.day : 1, p = d.sky ? d.sky.p : 0;
        const T = typeof DATA !== 'undefined' ? DATA.time : null;
        const night = T ? (p >= T.nightStart - 0.02 && p <= T.nightEnd) : false;
        return { day, lv, night, bots: d.meta ? d.meta.bots : (d.bots ? d.bots.n : 0), play: d.meta ? d.meta.play : 0, kids: d.stats ? d.stats.kids : 0 };
    },

    // ------------------------------------------------------------------------------ запись
    // Можно ли сейчас писать (не затираем хорошее сохранение пустым миром)
    canWrite() {
        if (this.suspended || typeof Game === 'undefined') return false;
        if (Game.state !== 'play' && Game.state !== 'pause') return false;
        if (Player.dead || !Game.zonesOpen || !Camp.level) return false;
        return true;
    },
    // Записать сейчас. force — игнорировать минимальный промежуток (выход, пауза)
    flush(reason, force, respawn) {
        if (!respawn && !this.canWrite()) return false;
        const now = performance.now() / 1000;
        if (!force && now - this.lastWrite < SAVE_MIN_GAP) { this.dirty = true; return false; }
        let ok = false;
        try {
            const data = this.collect(respawn);
            const info = this.describe(data);
            info.reason = reason || '';
            ok = this.commit(data, info);
            if (ok) { this.lastWrite = now; this.dirty = false; this.since = 0; this.info = Object.assign({ t: Date.now(), ok: true }, info); if (Game) Game.hasSave = true; this.cloudPush(); }
            else this.warnWrite();
        } catch (e) { console.warn('Save.flush:', e); this.problem = 'write'; this.warnWrite(); }
        return ok;
    },
    request(reason) { if (this.canWrite()) this.flush(reason, false); },
    warnWrite() { if (!this._warned && window.UI && UI.toast) { this._warned = true; UI.toast(Lang.t('save.writeFail'), 'warn'); } },
    // Периодически: из Game.update при state === 'play'
    tick(dt) {
        this.playMs += dt * 1000;
        this.since += dt;
        if (this.since >= SAVE_INTERVAL) this.flush('timer', false);
        else if (this.dirty && this.since > SAVE_MIN_GAP) this.flush('dirty', false);
    },

    // ------------------------------------------------------------------------------ чтение
    // Метаданные для меню «Продолжить»: { day, lv, night, bots, play, t } или null
    refreshInfo() {
        const b = this.best();
        if (!b) { this.info = null; if (typeof Game !== 'undefined') Game.hasSave = false; return null; }
        const r = b.res;
        this.info = Object.assign({ t: r.rec.t, ok: true }, r.rec.info || {}, this.describe(r.data));
        if (typeof Game !== 'undefined') Game.hasSave = true;
        return this.info;
    },
    // Данные для загрузки или null (причина — Save.problem)
    load() {
        const b = this.best();
        if (!b) return null;
        this.playMs = (b.res.data.meta && b.res.data.meta.play) || 0;
        this.seq = Math.max(this.seq, b.res.rec.seq);
        return b.res.data;
    },
    // Загрузка не удалась на применении: берём предыдущий слот
    loadOther(failedSeq) {
        const sl = this.slots().filter(s => s.res.ok && s.res.rec.seq !== failedSeq).sort((p, q) => q.res.rec.seq - p.res.rec.seq);
        if (sl.length) this.playMs = (sl[0].res.data.meta && sl[0].res.data.meta.play) || 0;
        return sl.length ? sl[0].res.data : null;
    },
    lastSeq() { const b = this.best(); return b ? b.res.rec.seq : 0; },

    // ------------------------------------------------------------------------------ облако
    async cloudPush() {
        if (this._cloudBusy || typeof Platform === 'undefined' || !Platform.save) return;
        if (Platform.name !== 'yandex') return;
        const now = performance.now() / 1000;
        if (now - this.lastCloud < CLOUD_INTERVAL) return;
        const raw = this.memory; if (!raw) return;
        this._cloudBusy = true; this.lastCloud = now;
        try {
            const p = await this.pack(raw);
            if (p.z === '' && p.d.length > 180000) return;   // без сжатия не лезет в лимит облака
            const rec = this.parse(raw).rec;
            await Platform.save({ v: SAVE_VERSION, t: rec.t, seq: rec.seq, best: Game.best || 0, p });
        } catch (e) { console.warn('Save.cloudPush:', e); }
        finally { this._cloudBusy = false; }
    },
    // При старте: если облако свежее локального — забираем
    async cloudPull() {
        if (typeof Platform === 'undefined' || Platform.name !== 'yandex') return false;
        try {
            const c = await Platform.load();
            if (!c || !c.p) return false;
            const b = this.best();
            if (b && b.res.rec.t >= c.t) return false;
            const raw = await this.unpack(c.p);
            const res = this.parse(raw);
            if (!res.ok) return false;
            const k = this.keys();
            const target = b && b.key === k.a ? k.b : k.a;
            Store.set(target, raw);
            this.seq = Math.max(this.seq, res.rec.seq);
            this.refreshInfo();
            return true;
        } catch (e) { console.warn('Save.cloudPull:', e); return false; }
    },

    // ------------------------------------------------------------------------------ запуск
    // Унаследованный ключ GAME_ID.save: либо полное сохранение v2, либо мусор {best} от старого Platform.save — переносим/удаляем
    migrateLegacy() {
        const k = this.keys();
        const old = Store.getJSON(k.legacy, null);
        if (!old) return;
        if (old.v === 2 && old.sky && old.player && !this.best()) {
            try { this.commit(old, this.describe(this.migrate(old, 2))); } catch (e) { /* не вышло — удалим */ }
        }
        Store.remove(k.legacy);
    },
    init() {
        this.migrateLegacy();
        this.refreshInfo();
        const exit = (why) => () => { this.flush(why, true); };
        window.addEventListener('pagehide', exit('pagehide'));
        window.addEventListener('beforeunload', exit('unload'));
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush('hidden', true); });
        window.addEventListener('lory-release-input', () => this.flush('release', true));
        this.cloudPull().then((got) => { if (got && window.UIPanels && UIPanels.cur === 'title') UIPanels.open('title'); });
    },
};

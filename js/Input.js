// Input.js — ввод игры: клавиатура, мышь (pointer lock или ПКМ-драг), тач (джойстик + свайп-камера), геймпад.
// Кнопки действий читает Game: Input.down('jump'), Input.pressed('interact') (нажатие в этом кадре).
// Клавиши переназначаются (Input.setBind, окно «Управление», хранятся в Store GAME_ID.binds). Геймпад — Input.pollPad(dt).
// Вызывать Input.endFrame() в конце кадра. На lory-release-input всё отпускается.

/** @type {Record<string, any>} */
const Input = {
    keys: {},                // code -> bool
    _pressed: new Set(),     // нажато в этом кадре
    _released: new Set(),
    mouse: { dx: 0, dy: 0, buttons: [false, false, false], wheel: 0 },
    look: { dx: 0, dy: 0 },  // дельта взгляда за кадр (мышь + тач)
    move: { x: 0, y: 0 },    // тач-джойстик (-1..1), y>0 — вперёд
    virtual: {},             // тач-кнопки: name -> bool
    _virtPressed: new Set(),
    locked: false,
    canvas: null,
    enabled: true,           // Game выключает при меню
    sens: 0.0022,
    touchLook: null,
    isTouch: false,
    freeLook: true,          // ПК: вращать камеру мышью и без pointer lock (пока курсор над игрой)
    freeCursor: false,       // Ctrl: курсор освобождён (виден, камера не крутится) — для кнопок интерфейса
    _cx: -1, _overCanvas: false, _lockTry: 0, _ctrlUnlock: false, _hid: false,
    binds: {
        forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
        jump: ['Space'], sprint: ['ShiftLeft', 'ShiftRight'], interact: ['KeyE'], drop: ['KeyQ'], reload: ['KeyR'],
        map: ['KeyM'], build: ['KeyB'], quest: ['KeyJ'], shop: ['KeyK'], emote: ['KeyG'], pause: String(GAME_PLATFORM) === 'crazygames' ? ['Escape', 'KeyP'] : ['Escape'], inv: ['Tab'], crouch: ['KeyC'],
        swap: ['KeyX'], rewards: ['KeyL'], upgrade: ['KeyF'], notes: ['KeyN'],
    },
    // Действия, которые можно переназначить в окне «Управление» (pause и цифры хотбара — нет)
    REBINDABLE: ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'interact', 'upgrade', 'drop', 'inv', 'swap', 'map', 'quest', 'notes', 'shop', 'rewards', 'emote'],
    _defaults: null, _capture: null,
    // Геймпад: стандартная раскладка (A/B/X/Y = 0..3, LB/RB = 4/5, LT/RT = 6/7, Select/Start = 8/9, L3 = 10, крестовина = 12..15)
    pad: { on: false, lx: 0, ly: 0, rx: 0, ry: 0, prev: {}, last: 0, sprint: false },
    _padPressed: new Set(),
    PAD_MAP: { 0: 'jump', 7: 'attack', 6: 'aim', 2: 'interact', 3: 'inv', 1: 'drop', 8: 'map', 9: 'pause', 12: 'quest', 13: 'upgrade', 11: 'notes' },

    init(canvas) {
        this.canvas = canvas;
        window.addEventListener('keydown', (e) => {
            if (this._typing(e)) return;
            this.pad.last = 0;
            if (this._capture) { const f = this._capture; this._capture = null; e.preventDefault(); e.stopPropagation(); f(e.code); return; }
            if (!e.repeat) this._pressed.add(e.code);
            this.keys[e.code] = true;
            if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && !e.repeat && this.enabled && !this.isTouch) this.toggleCursor();
            if (!this.locked && this.enabled && !e.repeat && this.wantLock && this.wantLock() && performance.now() - this._lockTry > 2500 && /^(Key[WASD]|Arrow|Space)/.test(e.code)) { this._lockTry = performance.now(); this.lock(); }
            if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; this._released.add(e.code); });
        window.addEventListener('blur', () => this.releaseAll());
        window.addEventListener('lory-release-input', () => this.releaseAll());
        document.addEventListener('pointerlockchange', () => {
            const was = this.locked;
            this.locked = document.pointerLockElement === canvas;
            if (!this.locked) {
                this.mouse.buttons = [false, false, false];
                // выход по Ctrl — не пауза; выход по Esc (браузер) — пауза, как раньше
                if (was && this.onUnlock && !this._ctrlUnlock) this.onUnlock();
                this._ctrlUnlock = false;
            }
        });
        document.addEventListener('mousemove', (e) => {
            this._cx = e.clientX; this._overCanvas = e.target === canvas;
            if (!this.enabled) return;
            // Камера крутится сама от движения мыши: при захвате курсора, с зажатой ПКМ и просто над игрой (если захват недоступен)
            if (!(this.locked || this.mouse.buttons[2] || (this.freeLook && !this.freeCursor && !this.isTouch && this._overCanvas))) return;
            // Chromium иногда шлёт огромный movementX при захвате/потере курсора — отбрасываем такие выбросы
            const mx = e.movementX || 0, my = e.movementY || 0;
            if (Math.abs(mx) > 260 || Math.abs(my) > 260) return;
            this.look.dx += mx; this.look.dy += my;
        });
        canvas.addEventListener('mousedown', (e) => {
            if (e.target !== canvas) return;
            this.mouse.buttons[e.button] = true;
            this._lockTry = performance.now();
            if (e.button === 0) this._pressed.add('Mouse0');
            if (e.button === 2) this._pressed.add('Mouse2');
            if (this.enabled && !this.locked && e.button === 0 && this.wantLock && this.wantLock()) { this.freeCursor = false; this.lock(); }
        });
        window.addEventListener('mouseup', (e) => { this.mouse.buttons[e.button] = false; });
        canvas.addEventListener('wheel', (e) => { if (this.enabled) this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this._initTouch(canvas);
    },

    _typing(e) { const t = e.target; return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); },

    // Ctrl: освободить курсор (виден, камера стоит) / вернуть захват (курсор скрыт, камера крутится мышью)
    toggleCursor() {
        if (!(this.wantLock && this.wantLock())) return;
        if (this.freeCursor) { this.freeCursor = false; this.lock(); return; }
        this.freeCursor = true; this._ctrlUnlock = this.locked;
        this.releaseAll(); this.keys['ControlLeft'] = this.keys['ControlRight'] = false;
        this.unlock();
    },

    lock() {
        // захват не нужен (экранное управление на экране, окно, смерть) — курсор остаётся свободным
        if (this.wantLock && !this.wantLock()) return;
        this.freeCursor = false;
        try {
            // «сырое» движение мыши без ускорения ОС — вращение камеры одинаковое при любой скорости руки
            const p = this.canvas.requestPointerLock && this.canvas.requestPointerLock({ unadjustedMovement: true });
            if (p && p.catch) p.catch(() => { try { const q = this.canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (e2) { /* ок */ } });
        } catch (e) { /* нет pointer lock — ПКМ-драг */ }
    },
    unlock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ok */ } },

    releaseAll() {
        this.keys = {};
        this.mouse.buttons = [false, false, false];
        this.move.x = 0; this.move.y = 0;
        this.virtual = {};
        this.touchLook = null;
        this.look.dx = this.look.dy = 0; this.mouse.wheel = 0;
        this._pressed.clear(); this._released.clear(); this._virtPressed.clear(); this._padPressed.clear();
        this.pad.lx = this.pad.ly = this.pad.rx = this.pad.ry = 0; this.pad.sprint = false;
        if (this.stick) this.stick.id = null;
        if (this.onRelease) this.onRelease();
    },

    // Клавиши/кнопки действия
    down(action) {
        const k = this.binds[action];
        if (k) for (const c of k) if (this.keys[c]) return true;
        if (action === 'attack') return this.mouse.buttons[0] || !!this.virtual.attack;
        if (action === 'aim') return this.mouse.buttons[2] || !!this.virtual.aim;
        return !!this.virtual[action];
    },
    pressed(action) {
        const k = this.binds[action];
        if (k) for (const c of k) if (this._pressed.has(c)) return true;
        if (action === 'attack') return this._pressed.has('Mouse0') || this._virtPressed.has('attack');
        if (action === 'aim') return this._pressed.has('Mouse2') || this._virtPressed.has('aim');
        return this._virtPressed.has(action);
    },
    key(code) { return !!this.keys[code]; },
    keyPressed(code) { return this._pressed.has(code); },

    // Вектор движения: x — вправо, y — вперёд
    axis(out) {
        const o = out || { x: 0, y: 0 };
        let x = 0, y = 0;
        if (this.down('forward')) y += 1;
        if (this.down('back')) y -= 1;
        if (this.down('right')) x += 1;
        if (this.down('left')) x -= 1;
        x += this.move.x + this.pad.lx; y += this.move.y - this.pad.ly;
        const l = Math.hypot(x, y);
        if (l > 1) { x /= l; y /= l; }
        o.x = x; o.y = y;
        return o;
    },

    consumeLook() {
        if (!this.locked && this.freeLook && !this.freeCursor && !this.isTouch && this._overCanvas && this._cx >= 0) {
            const W = window.innerWidth || 1;
            if (this._cx <= 3) this.look.dx -= 9; else if (this._cx >= W - 4) this.look.dx += 9;
        }
        const r = { dx: this.look.dx, dy: this.look.dy };
        this.look.dx = 0; this.look.dy = 0;
        return r;
    },
    consumeWheel() { const w = this.mouse.wheel; this.mouse.wheel = 0; return w; },

    // Нажаты цифры 1..9,0 -> индекс слота 0..9 или -1
    slotPressed() {
        for (let i = 0; i < 10; i++) {
            if (this._pressed.has(i === 9 ? 'Digit0' : 'Digit' + (i + 1)) || this._pressed.has(i === 9 ? 'Numpad0' : 'Numpad' + (i + 1))) return i;
        }
        return -1;
    },

    _syncCursor() {
        const hide = !this.isTouch && !this.freeCursor && !!(this.enabled && this.wantLock && this.wantLock());
        if (hide !== this._hid && this.canvas) { this._hid = hide; this.canvas.style.cursor = hide ? 'none' : ''; }
    },

    endFrame() {
        this._syncCursor();
        this._pressed.clear(); this._released.clear(); this._virtPressed.clear(); this._padPressed.clear();
        this.mouse.wheel = 0;
    },

    // ---------- тач ----------------------------------------------------------------------
    _initTouch(canvas) {
        const stick = { id: null, ox: 0, oy: 0 };
        this.stick = stick;
        canvas.addEventListener('touchstart', (e) => {
            this.isTouch = true;
            if (!this.enabled) return;
            for (const t of Array.from(e.changedTouches)) {
                if (t.clientX > window.innerWidth * 0.45 && this.touchLook === null) this.touchLook = { id: t.identifier, x: t.clientX, y: t.clientY };
            }
            e.preventDefault();
        }, { passive: false });
        canvas.addEventListener('touchmove', (e) => {
            for (const t of Array.from(e.changedTouches)) {
                if (this.touchLook && t.identifier === this.touchLook.id) {
                    this.look.dx += (t.clientX - this.touchLook.x) * 1.35;
                    this.look.dy += (t.clientY - this.touchLook.y) * 1.35;
                    this.touchLook.x = t.clientX; this.touchLook.y = t.clientY;
                }
            }
            e.preventDefault();
        }, { passive: false });
        const end = (e) => {
            for (const t of Array.from(e.changedTouches)) if (this.touchLook && t.identifier === this.touchLook.id) this.touchLook = null;
        };
        canvas.addEventListener('touchend', end);
        canvas.addEventListener('touchcancel', end);
    },

    // Виртуальная кнопка (UI вызывает): нажатие/отпускание
    setVirtual(name, on) {
        if (on && !this.virtual[name]) this._virtPressed.add(name);
        this.virtual[name] = on;
    },

    // Название кнопки удара для подсказок: ЛКМ / RT на геймпаде / «кнопка удара» на телефоне
    attackLabel() { return this.isTouch ? Lang.t('btn.attackTouch') : this.padActive() ? 'RT' : Lang.t('help.mouseL'); },
    shiftDown() { return !!(this.keys.ShiftLeft || this.keys.ShiftRight); },

    // ---------- переназначение клавиш ------------------------------------------------------
    loadBinds() {
        if (!this._defaults) { this._defaults = {}; for (const a in this.binds) this._defaults[a] = this.binds[a].slice(); }
        const saved = Store.getJSON(GAME_ID + '.binds', null);
        if (!saved) return;
        for (const a of this.REBINDABLE) {
            const v = saved[a];
            if (Array.isArray(v) && v.length && v.length <= 2 && v.every(c => typeof c === 'string' && /^[A-Za-z0-9]{1,16}$/.test(c))) this.binds[a] = v.slice();
        }
    },
    _saveBinds() { const o = {}; for (const a of this.REBINDABLE) o[a] = this.binds[a]; Store.set(GAME_ID + '.binds', JSON.stringify(o)); },
    resetBinds() {
        if (!this._defaults) this.loadBinds();
        for (const a in this._defaults) this.binds[a] = this._defaults[a].slice();
        Store.remove(GAME_ID + '.binds');
    },
    // Назначить клавишу code в слот slot (0 — основная, 1 — запасная) действия action. Конфликт: другое действие получает прежнюю клавишу этого слота.
    setBind(action, slot, code) {
        const cur = this.binds[action];
        if (!cur || !this.REBINDABLE.includes(action) || code === 'Escape') return false;
        const prev = cur[slot];
        for (const a in this.binds) {
            if (a === action) continue;
            const i = this.binds[a].indexOf(code);
            if (i < 0) continue;
            if (prev) this.binds[a][i] = prev;
            else if (this.binds[a].length > 1) this.binds[a].splice(i, 1);
            else return false;
        }
        const dup = cur.indexOf(code);
        if (dup >= 0 && dup !== slot && cur.length > 1) cur.splice(dup, 1);
        cur[Math.min(slot, cur.length)] = code;
        this._saveBinds();
        return true;
    },
    // Ждать следующую клавишу (для окна переназначения); cb(code). cancel() — отмена
    capture(cb) { this._capture = cb; },
    cancelCapture() { this._capture = null; },
    // Читаемое имя клавиши
    label(code) {
        if (!code) return '—';
        const m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
        const d = /^Digit(\d)$/.exec(code); if (d) return d[1];
        const n = /^Numpad(\d)$/.exec(code); if (n) return 'Num' + n[1];
        const map = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift R', ControlLeft: 'Ctrl', ControlRight: 'Ctrl R', AltLeft: 'Alt', AltRight: 'Alt R', Escape: 'Esc', Tab: 'Tab', Enter: 'Enter', Backspace: 'Bksp',
            ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\' };
        return map[code] || code;
    },

    // ---------- геймпад ---------------------------------------------------------------------
    // Раз в кадр: стики → движение и взгляд, кнопки → виртуальные действия (по краям, чтобы не мешать тач-кнопкам)
    pollPad(dt) {
        if (!navigator.getGamepads) return;
        let gp = null, unsupported = false;
        try { for (const g of navigator.getGamepads()) if (g && g.connected) { if (g.mapping === 'standard') { gp = g; break; } unsupported = true; } } catch (e) { /* release a disconnected or unavailable controller below */ }
        const P = this.pad;
        if (unsupported && !gp && !P.unsupported && window.UI && UI.el && UI.el.toast) UI.toast(Lang.t('set.padUnsupported'), 'info');
        P.unsupported = unsupported && !gp;
        if (!gp) {
            if (P.on) { P.on = false; P.lx = P.ly = P.rx = P.ry = 0; for (const b in P.prev) if (P.prev[b]) { P.prev[b] = false; const nm = this.PAD_MAP[b]; if (nm) this.setVirtual(nm, false); } if (P.sprint) { P.sprint = false; this.setVirtual('sprint', false); } }
            return;
        }
        const dz = (v) => Math.abs(v) < 0.2 ? 0 : (v - Math.sign(v) * 0.2) / 0.8;
        const ax = gp.axes || [];
        P.lx = dz(ax[0] || 0); P.ly = dz(ax[1] || 0);
        const rx = dz(ax[2] || 0), ry = dz(ax[3] || 0);
        P.rx = rx; P.ry = ry;
        let act = P.lx || P.ly || rx || ry;
        const bt = gp.buttons || [];
        const on = (i) => !!(bt[i] && (bt[i].pressed || bt[i].value > 0.5));
        for (let i = 0; i < bt.length; i++) {
            const now = on(i);
            if (now !== !!P.prev[i]) {
                P.prev[i] = now; act = true;
                if (now) this._padPressed.add(i);
                const nm = this.PAD_MAP[i];
                if (nm) this.setVirtual(nm, now);
                if (i === 10 && now) { P.sprint = !P.sprint; this.setVirtual('sprint', P.sprint); }
            } else if (now) act = true;
        }
        if (P.sprint && !P.lx && !P.ly) { P.sprint = false; this.setVirtual('sprint', false); }
        if (act) { if (!P.on) { P.on = true; this.isTouch = false; if (window.UI && UI.el && UI.el.toast) UI.toast(Lang.t('set.padOn'), 'info'); } P.last = performance.now(); }
        // правый стик — взгляд (пикс/с подобраны под обычную чувствительность камеры)
        const k = 1250 * (dt || 0.016) / Math.max(0.3, (window.Cam && Cam.sens) || 1);
        if (rx || ry) { const m = Math.hypot(rx, ry); this.look.dx += rx * m * k; this.look.dy += ry * m * k * 0.8; }
    },
    padPressed(i) { return this._padPressed.has(i); },
    // Последний ввод был с геймпада (подсказки показывают кнопку X вместо E)
    padActive() { return this.pad.on && this.pad.last > 0 && performance.now() - this.pad.last < 6000; },
};

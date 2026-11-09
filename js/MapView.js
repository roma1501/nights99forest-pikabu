// MapView.js — миникарта в круге компаса и полная карта (клавиша M): зоны, места интереса, дети в клетках, сундуки, записки,
// колодцы и пруды, события (торговец, припасы, клад), напарники, враги-радар, цель задания и метки игрока (до 6, клик по карте).
// Миникарта рисуется на canvas внутри вращающегося циферблата компаса: север сверху, поворот по взгляду делает CSS (UI.update).
// Мир — по правилам игры: север = +z, восток = −x (камера с yaw 0 смотрит на +z, вправо у неё −x).

/** @type {Record<string, any>} */
const MapView = {
    pins: [], mini: null, mctx: null, _t: 0, R: 52 * M,
    view: { x: 0, z: 0, r: 0, follow: true },   // полная карта: центр и радиус обзора
    _full: null,

    // сайты: значок на полной карте
    ICONS: { 'den-wolf': '🐺', 'den-alpha': '🐺', 'cave-bear': '🐻', 'poi-cultist': '🧙', 'poi-cabin': '🏠', 'poi-campsite': '⛺', 'poi-sawmill': '🪵', 'poi-ruins': '🏛️',
        'poi-watchtower': '🗼', 'poi-graveyard': '🪦', 'poi-mine': '⛏️', 'poi-obelisk': '🗿', 'poi-well': '💧', 'poi-pond': '🎣', 'poi-carrots': '🥕' },

    init(app) {
        this.mini = /** @type {HTMLCanvasElement | null} */ (document.getElementById('miniMap'));
        this.mctx = this.mini ? this.mini.getContext('2d') : null;
        this._css();
    },
    reset() { this.pins = []; this.view.follow = true; },
    save() { return { pins: this.pins.map(p => [Math.round(p.x), Math.round(p.z)]) }; },
    load(s) { this.pins = (s && Array.isArray(s.pins) ? s.pins : []).slice(0, 6).map(p => ({ x: +p[0] || 0, z: +p[1] || 0 })); },

    _css() {
        const s = document.createElement('style');
        s.textContent = `
#ui{--mm:120px}
@media (max-width:600px){#ui{--mm:96px}}
#compass{width:var(--mm) !important;height:var(--mm) !important}
#compass canvas{position:absolute;left:0;top:0;width:100%;height:100%}
#compass .n{z-index:2}
#coinBox{top:calc(var(--mm) + 20px + env(safe-area-inset-top)) !important}
#evChip{top:calc(var(--mm) + 64px + env(safe-area-inset-top)) !important}
.mapP{width:min(940px,96vw);padding:12px 14px}
.mapP .mapTop{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 46px 8px 0}
.mapP .mapTop .btn{min-height:38px;padding:3px 12px;font-size:16px}
.mapWrap{display:flex;justify-content:center;touch-action:none}
.mapWrap canvas{border-radius:14px;border:4px solid #000;background:#0e1a14;cursor:grab;max-width:100%;touch-action:none}
.mapWrap canvas.drag{cursor:grabbing}
.mapLeg{display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:center;margin-top:8px;font-size:14px;opacity:.92;-webkit-text-stroke:0}
.mapLeg span{white-space:nowrap}
`;
        document.head.appendChild(s);
    },

    // ------------------------------------------------------------------------------ данные для обеих карт
    // Что рисовать: места, дети, сундуки… (позиции в мире)
    points() {
        const out = [];
        for (const s of Zones.sites) if (s.built && !/^kid-/.test(s.name)) out.push({ k: 'site', x: s.x, z: s.z, n: s.name });
        for (const k of Zones.kids) if (k.state === 'caged') out.push({ k: 'kid', x: k.x, z: k.z, c: k.def.color, id: k.def.id });
        for (const c of Zones.chests) if (!c.opened) out.push({ k: 'chest', x: c.x, z: c.z, gold: !!c.gold });
        for (const w of Zones.wells) out.push({ k: 'well', x: w.x, z: w.z });
        for (const p of Zones.ponds || []) out.push({ k: 'pond', x: p.x, z: p.z, r: p.r });
        if (window.Lore) for (const n of Lore.spots) out.push({ k: 'note', x: n.x, z: n.z });
        const E = window.Events;
        if (E) {
            if (E.trader) out.push({ k: 'trader', x: E.trader.x, z: E.trader.z });
            if (E.drop && !E.drop.opened) out.push({ k: 'drop', x: E.drop.x, z: E.drop.z });
            if (E.treasure && E.treasure.ch && !E.treasure.ch.opened) out.push({ k: 'treasure', x: E.treasure.x, z: E.treasure.z });
        }
        if (window.Bots) for (const b of Bots.list) out.push({ k: 'bot', x: b.x, z: b.z, down: b.dead });
        for (const p of this.pins) out.push({ k: 'pin', x: p.x, z: p.z });
        return out;
    },
    // Бодрствующие враги и босс (радар)
    threats(range) {
        const out = [];
        for (const e of Enemies.list) {
            if (!e.alive || e.type === 'bunny') continue;
            if (e.type === 'deer') { if (e === Enemies.deer && e.state !== 'appear') out.push({ x: e.x, z: e.z, deer: true }); continue; }
            if (!(e.boss || e.state === 'chase' || e.state === 'attack' || e.state === 'alert')) continue;
            if (range && Math.hypot(e.x - Player.x, e.z - Player.z) > range) continue;
            out.push({ x: e.x, z: e.z, boss: !!e.boss });
        }
        return out;
    },
    // Цель текущего задания (если метка включена)
    questTarget() {
        try {
            if (!window.Quests || Quests.enabled === false || Quests.track === false) return null;
            if (Quests._target) return Quests._target;
            const s = Quests.current();
            return s ? Quests.resolve(s.target) : null;
        } catch (e) { return null; }
    },

    // ------------------------------------------------------------------------------ миникарта
    update(dt, frozen) {
        if (frozen || !this.mctx || !UI.hudOn) return;
        this._t -= dt;
        if (this._t > 0) return;
        this._t = 0.125;
        this.drawMini();
    },
    drawMini() {
        const c = this.mini, g = this.mctx;
        if (!c || !g) return;
        const W = c.width, cx = W / 2, cy = W / 2, sc = (W / 2 - 3) / this.R, px = Player.x, pz = Player.z;
        const X = (wx) => cx - (wx - px) * sc, Y = (wz) => cy - (wz - pz) * sc;
        g.clearRect(0, 0, W, W);
        g.save();
        g.beginPath(); g.arc(cx, cy, W / 2, 0, 6.2832); g.clip();
        g.fillStyle = 'rgba(12,22,18,.92)'; g.fillRect(0, 0, W, W);
        // открытая (в тумане) область светлее, снаружи — неизвестность
        g.fillStyle = 'rgba(58,94,56,.62)'; g.beginPath(); g.arc(X(World.cx), Y(World.cz), World.fogRadius * sc, 0, 6.2832); g.fill();
        g.strokeStyle = 'rgba(190,230,190,.35)'; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]);
        // пруды
        g.fillStyle = 'rgba(70,140,210,.8)';
        for (const p of Zones.ponds || []) { g.beginPath(); g.arc(X(p.x), Y(p.z), p.r * sc, 0, 6.2832); g.fill(); }
        // круг света костра
        if (Camp.lit) { g.strokeStyle = 'rgba(255,170,70,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(X(Camp.x), Y(Camp.z), Camp.safeRadius() * sc, 0, 6.2832); g.stroke(); }
        const dot = (x, z, r, fill, stroke) => { const sx = X(x), sy = Y(z); if ((sx - cx) ** 2 + (sy - cy) ** 2 > (W / 2 + 6) ** 2) return; g.beginPath(); g.arc(sx, sy, r, 0, 6.2832); g.fillStyle = fill; g.fill(); if (stroke) { g.lineWidth = 1.5; g.strokeStyle = stroke; g.stroke(); } };
        const sq = (x, z, r, fill) => { const sx = X(x), sy = Y(z); if ((sx - cx) ** 2 + (sy - cy) ** 2 > (W / 2 + 6) ** 2) return; g.fillStyle = fill; g.fillRect(sx - r, sy - r, r * 2, r * 2); g.lineWidth = 1; g.strokeStyle = '#000'; g.strokeRect(sx - r, sy - r, r * 2, r * 2); };
        const dia = (x, z, r, fill) => { const sx = X(x), sy = Y(z); if ((sx - cx) ** 2 + (sy - cy) ** 2 > (W / 2 + 6) ** 2) return; g.beginPath(); g.moveTo(sx, sy - r); g.lineTo(sx + r, sy); g.lineTo(sx, sy + r); g.lineTo(sx - r, sy); g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#000'; g.stroke(); };
        dot(Camp.x, Camp.z, 6, '#ff9a2a', '#000');
        for (const p of this.points()) {
            switch (p.k) {
                case 'site': dia(p.x, p.z, 6, '#f2f2f2'); break;
                case 'kid': dot(p.x, p.z, 6, p.c, '#fff'); break;
                case 'chest': sq(p.x, p.z, 3.5, p.gold ? '#ffd23a' : '#c98a4a'); break;
                case 'well': dot(p.x, p.z, 3.5, '#5ac8ff', '#000'); break;
                case 'note': dia(p.x, p.z, 5, '#ffe066'); break;
                case 'trader': dot(p.x, p.z, 5.5, '#6dff8a', '#000'); break;
                case 'drop': dot(p.x, p.z, 5.5, '#8ec8ff', '#000'); break;
                case 'treasure': dia(p.x, p.z, 6, '#ffd23a'); break;
                case 'bot': dot(p.x, p.z, 4.5, p.down ? '#888' : '#4ee0ff', '#000'); break;
                case 'pin': dot(p.x, p.z, 5, '#c07bff', '#fff'); break;
            }
        }
        // враги: красные точки, босс — большая пульсирующая
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 180);
        for (const t of this.threats(this.R * 1.25)) {
            if (t.boss) dot(t.x, t.z, 7 + 3 * pulse, 'rgba(190,80,255,' + (0.5 + 0.4 * pulse) + ')', '#fff');
            else if (t.deer) dot(t.x, t.z, 5 + 2 * pulse, 'rgba(255,40,40,' + (0.55 + 0.4 * pulse) + ')', '#000');
            else dot(t.x, t.z, 3, '#ff4a3a');
        }
        // цель задания: кольцо или стрелка у края, если далеко
        const qt = this.questTarget();
        if (qt) {
            const dx = X(qt.x) - cx, dy = Y(qt.z) - cy, d = Math.hypot(dx, dy), lim = W / 2 - 9;
            g.strokeStyle = '#ffe61a'; g.fillStyle = 'rgba(255,230,26,.35)'; g.lineWidth = 2.2;
            if (d <= lim) { g.beginPath(); g.arc(cx + dx, cy + dy, 7 + 2 * pulse, 0, 6.2832); g.fill(); g.stroke(); }
            else { const a = Math.atan2(dy, dx), ex = cx + Math.cos(a) * lim, ey = cy + Math.sin(a) * lim; g.save(); g.translate(ex, ey); g.rotate(a); g.fillStyle = '#ffe61a'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, 6); g.lineTo(-5, -6); g.closePath(); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.2; g.stroke(); g.restore(); }
        }
        g.restore();
    },

    // ------------------------------------------------------------------------------ полная карта
    // Центр и радиус обзора по умолчанию: игрок, открытая область с запасом
    resetView() {
        this.view.x = Player.x; this.view.z = Player.z;
        this.view.r = Math.max(World.fogRadius * 1.12, 9000);
        this.view.follow = true;
    },
    // Нарисовать полную карту в canvas
    drawFull(canvas) {
        const g = canvas.getContext('2d');
        const W = canvas.width, V = this.view, sc = (W / 2) / V.r, cx = W / 2, cy = W / 2;
        const X = (wx) => cx - (wx - V.x) * sc, Y = (wz) => cy - (wz - V.z) * sc;
        g.clearRect(0, 0, W, W);
        // фон: неизвестность
        g.fillStyle = '#0a1410'; g.fillRect(0, 0, W, W);
        const circ = (x, z, r) => { g.beginPath(); g.arc(X(x), Y(z), r * sc, 0, 6.2832); };
        // зоны: открытые закрашены тоном зоны, закрытые — только контур со знаком вопроса
        const cxw = World.cx, czw = World.cz;
        for (let k = DATA.zones.length - 1; k >= 0; k--) {
            const Z = DATA.zones[k], open = k < Camp.level;
            const r1 = Math.min(Z.r1, 196) * M;
            circ(cxw, czw, r1);
            if (open) { const t = Z.tint; g.fillStyle = 'rgb(' + Math.round(40 * t[0] + 14) + ',' + Math.round(74 * t[1] + 10) + ',' + Math.round(44 * t[2] + 8) + ')'; g.fill(); }
            else { g.fillStyle = k === Camp.level ? 'rgba(26,36,32,.9)' : 'rgba(14,22,18,.95)'; g.fill(); }
            g.strokeStyle = open ? 'rgba(210,240,200,.45)' : 'rgba(150,170,160,.25)'; g.lineWidth = 2; g.stroke();
        }
        // граница тумана
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([10, 8]); g.lineWidth = 2; circ(cxw, czw, World.fogRadius); g.stroke(); g.setLineDash([]);
        // подписи зон
        g.font = 'bold ' + Math.round(W * 0.026) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let k = 0; k < DATA.zones.length; k++) {
            const Z = DATA.zones[k], rm = (Math.max(Z.r0, 6) + Math.min(Z.r1, 196)) / 2 * M, open = k < Camp.level;
            const lx = X(cxw), ly = Y(czw + rm);
            if (lx < 20 || lx > W - 20 || ly < 16 || ly > W - 16) continue;
            g.fillStyle = open ? 'rgba(235,255,225,.8)' : 'rgba(170,190,180,.5)'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 4;
            const txt = open ? Lang.t('zone.' + Z.id) : '? ' + Lang.t('map.unknown');
            g.strokeText(txt, lx, ly); g.fillText(txt, lx, ly);
        }
        // пруды
        g.fillStyle = 'rgba(70,140,210,.85)';
        for (const p of Zones.ponds || []) { circ(p.x, p.z, p.r); g.fill(); }
        // круг света костра
        if (Camp.lit) { g.strokeStyle = 'rgba(255,170,70,.8)'; g.lineWidth = 2.5; circ(Camp.x, Camp.z, Camp.safeRadius()); g.stroke(); }
        // значки
        const fs = Math.round(Math.max(16, Math.min(30, W * 0.035)));
        g.font = fs + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
        const icon = (x, z, ch, scale) => { const sx = X(x), sy = Y(z); if (sx < -20 || sx > W + 20 || sy < -20 || sy > W + 20) return; g.save(); g.translate(sx, sy); if (scale) g.scale(scale, scale); g.lineWidth = 1; Icons.drawGlyph(g, ch, 0, 0, fs * 1.25); g.restore(); };
        icon(Camp.x, Camp.z, '🔥', 1.25);
        for (const p of this.points()) {
            switch (p.k) {
                case 'site': icon(p.x, p.z, this.ICONS[p.n] || '📍'); break;
                case 'kid': { const sx = X(p.x), sy = Y(p.z); g.beginPath(); g.arc(sx, sy, fs * 0.7, 0, 6.2832); g.fillStyle = p.c; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); icon(p.x, p.z, { dino: '🦖', kraken: '🐙', squid: '🦑', koala: '🐨' }[p.id] || '🧒', 0.85); break; }
                case 'chest': if (p.gold) { g.beginPath(); g.arc(X(p.x), Y(p.z), fs * .52, 0, 6.2832); g.strokeStyle = '#ffd23a'; g.lineWidth = 3; g.stroke(); } icon(p.x, p.z, '📦', 0.85); break;
                case 'well': icon(p.x, p.z, '💧', 0.8); break;
                case 'note': icon(p.x, p.z, '📜', 0.95); break;
                case 'trader': icon(p.x, p.z, '🛒', 1.1); break;
                case 'drop': icon(p.x, p.z, '📦', 1.1); break;
                case 'treasure': icon(p.x, p.z, '🗺️', 1.1); break;
                case 'bot': icon(p.x, p.z, p.down ? '💤' : '🤖', 0.9); break;
                case 'pin': icon(p.x, p.z, '📍', 1.2); break;
            }
        }
        for (const t of this.threats(0)) if (t.boss) icon(t.x, t.z, '👑', 1.4); else if (!t.deer) { const sx = X(t.x), sy = Y(t.z); g.fillStyle = '#ff4a3a'; g.beginPath(); g.arc(sx, sy, 3.5, 0, 6.2832); g.fill(); } else icon(t.x, t.z, '❗', 1.2);
        // цель задания
        const qt = this.questTarget();
        if (qt) {
            const sx = X(qt.x), sy = Y(qt.z), pulse = 0.6 + 0.4 * Math.sin(performance.now() / 200);
            g.strokeStyle = '#ffe61a'; g.fillStyle = 'rgba(255,230,26,.28)'; g.lineWidth = 3;
            g.beginPath(); g.arc(sx, sy, fs * (0.8 + 0.25 * pulse), 0, 6.2832); g.fill(); g.stroke();
        }
        // игрок: стрелка по направлению взгляда (на север +z, вправо −x)
        {
            const sx = X(Player.x), sy = Y(Player.z), a = Cam.yaw;
            const fx = -Math.sin(a), fy = -Math.cos(a);   // направление на экране
            g.save(); g.translate(sx, sy);
            g.fillStyle = '#ffffff'; g.strokeStyle = '#000'; g.lineWidth = 2.5;
            g.beginPath(); g.moveTo(fx * 13, fy * 13); g.lineTo(-fy * 8 - fx * 8, fx * 8 - fy * 8); g.lineTo(fy * 8 - fx * 8, -fx * 8 - fy * 8); g.closePath(); g.fill(); g.stroke();
            g.restore();
        }
        // стороны света
        g.font = 'bold ' + Math.round(W * 0.03) + 'px sans-serif'; g.fillStyle = '#ff7a6a'; g.strokeStyle = '#000'; g.lineWidth = 4;
        for (const [t, x, y] of [['N', W / 2, 16], ['S', W / 2, W - 16], ['E', W - 14, W / 2], ['W', 14, W / 2]]) { g.strokeText(t, x, y); g.fillText(t, x, y); }
    },

    // Окно карты
    build(d) {
        const P = UIPanels;
        const p = P.panel(Lang.t('map.title'), true);
        p.classList.add('mapP');
        this.resetView();
        const top = P.el('div', 'mapTop');
        const side = Math.max(260, Math.min(window.innerHeight - 200, window.innerWidth * 0.94 - 30, 820));
        const wrap = P.el('div', 'mapWrap');
        const canvas = /** @type {HTMLCanvasElement} */ (P.el('canvas'));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = canvas.height = Math.round(side * dpr); canvas.style.width = canvas.style.height = side + 'px';
        const redraw = () => this.drawFull(canvas);
        const zoom = (k) => { this.view.r = U.clamp(this.view.r * k, 2500, 24000); redraw(); };
        const mk = (txt, title, fn) => { const b = P.btn(txt, 'gray sm', fn); b.title = title; return b; };
        top.appendChild(mk('＋', Lang.t('map.zoomIn'), () => zoom(0.75)));
        top.appendChild(mk('－', Lang.t('map.zoomOut'), () => zoom(1.33)));
        top.appendChild(mk('⌖ ' + Lang.t('map.center'), Lang.t('map.center'), () => { this.resetView(); redraw(); }));
        top.appendChild(mk('📍 ' + Lang.t('map.clearPins'), Lang.t('map.clearPins'), () => { this.pins = []; redraw(); if (window.Game) Game.autosave('pins'); }));
        top.appendChild(P.btn('🧒 ' + Lang.t('map.board'), 'blue sm', () => P.open('board')));
        p.appendChild(top);
        p.appendChild(P.el('div', 'hint rb1', Lang.t('map.hint')));
        wrap.appendChild(canvas); p.appendChild(wrap);
        const leg = P.el('div', 'mapLeg');
        leg.innerHTML = ['🔥 ' + Lang.t('map.l.camp'), '🧒 ' + Lang.t('map.l.kid'), '🟨 ' + Lang.t('map.l.chest'), '📜 ' + Lang.t('map.l.note'), '🛒 ' + Lang.t('map.l.event'), '🤖 ' + Lang.t('map.l.bot'), '📍 ' + Lang.t('map.l.pin'), '🟡 ' + Lang.t('map.l.quest')].map(t => '<span>' + t + '</span>').join('');
        p.appendChild(leg);
        // перетаскивание, колесо, клик по карте — метка
        let drag = null;
        const toWorld = (ev) => {
            const r = canvas.getBoundingClientRect(), k = canvas.width / r.width, x = (ev.clientX - r.left) * k, y = (ev.clientY - r.top) * k, sc = (canvas.width / 2) / this.view.r;
            return { wx: this.view.x - (x - canvas.width / 2) / sc, wz: this.view.z - (y - canvas.width / 2) / sc, x, y };
        };
        canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
        canvas.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const r = canvas.getBoundingClientRect(), k = canvas.width / r.width, sc = (canvas.width / 2) / this.view.r;
            const dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k;
            drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
            this.view.x += dx / sc; this.view.z += dy / sc; this.view.follow = false; redraw();
        });
        canvas.addEventListener('pointerup', (e) => {
            canvas.classList.remove('drag');
            const was = drag; drag = null;
            if (!was || was.moved > 8) return;
            const w = toWorld(e), sc = (canvas.width / 2) / this.view.r;
            const i = this.pins.findIndex(q => Math.hypot((q.x - w.wx) * sc, (q.z - w.wz) * sc) < 22);
            if (i >= 0) { this.pins.splice(i, 1); Sfx.ui('cancel'); }
            else if (this.pins.length >= 6) { UI.toast(Lang.t('map.pinMax'), 'warn'); return; }
            else { this.pins.push({ x: w.wx, z: w.wz }); Sfx.ui('select'); }
            redraw(); if (window.Game) Game.autosave('pins');
        });
        canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 0.87); }, { passive: false });
        redraw();
        // обновляем картинку, пока окно открыто (цель и события пульсируют)
        const iv = setInterval(() => { if (!canvas.isConnected) { clearInterval(iv); return; } redraw(); }, 450);
        return p;
    },
};
Object.assign(UIPanels, { build_map(d) { return MapView.build(d); } });

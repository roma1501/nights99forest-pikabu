// Events.js — случайные события, которые оживляют лес: странствующий торговец, сброс припасов на парашюте, кровавая луна,
// гроза с молниями, метеоритный дождь, клад с указателем, золотой кролик, туманная буря. Одно активное событие за раз
// (особая ночь — поверх). Особые ночи (с 3-й): кровавая луна, стая, мороз, тихая, гроза, туман. 99-я ночь — финал с боссом
// «Хозяин леса» (Enemies.spawnBoss). Награды — монеты и предметы. Состояние: таймер до следующего события, ночной модификатор, босс.

/** @type {Record<string, any>} */
const Events = {
    cur: null, nextT: 120, rain: 0, rainFx: null, bloodMoon: false, trader: null, drop: null, treasure: null, gold: null, meteors: [], bolts: [],
    _ui: 0,
    nightMod: null,       // id особой ночи (blood | swarm | cold | quiet | storm | fog) или null
    cold: false, coldK: 0, _coldEl: null,
    bossT: 0, bossDown: false, bossGrace: 0, endT: 0,
    lootQueue: [],

    reset() { this.stop(true); this.clearTransient(); this.lootQueue = []; this.nextT = 150; this.clearMod(); this.bossT = 0; this.bossDown = false; this.bossGrace = 0; this.endT = 0; },
    clearTransient() {
        for (const m of this.meteors) { if (m.trail) m.trail.dispose(); if (m.m.material) m.m.material.dispose(); m.m.dispose(); }
        for (const b of this.bolts) { if (b.m.material) b.m.material.dispose(); b.m.dispose(); }
        this.meteors = []; this.bolts = [];
    },
    save() {
        const b = Enemies.boss;
        const props = (o, keys) => { if (!o) return null; const r = {}; for (const k of keys) r[k] = o[k]; return r; };
        const current = this.cur ? { id: this.cur.id, t: this.cur.t, lightT: this.lightT, meteorT: this.meteorT,
            trader: props(this.trader, ['x', 'z', 'wx', 'wz', 'waveT']), drop: props(this.drop, ['x', 'z', 'h', 'landed', 'opened']),
            treasure: this.treasure && this.treasure.ch ? props(this.treasure.ch, ['x', 'z', 'yaw', 'gold', 'idx', 'opened']) : null,
            gold: props(this.gold, ['x', 'z', 'hp', 'alive']) } : null;
        return { n: this.nextT, nm: this.nightMod, bd: this.bossDown ? 1 : 0, bt: this.bossT, bg: this.bossGrace, et: this.endT, current, loot: this.lootQueue.map(o => ({ ...o })),
            bs: b && b.alive ? { hp: b.hp, maxHp: b.maxHp, x: b.x, z: b.z, ph: b.phase, ai: props(b, ['state', 'st', 'slamCd', 'dashCd', 'summonCd', 'atkCd', 'atkDur', 'hitDone', 'teleN', 'dashDir', 'enrage', 'stun', 'stunImm']) } : null };
    },
    load(s) {
        this.stop(true); this.clearTransient(); this.nextT = s && Number.isFinite(s.n) ? s.n : 150; this.clearMod();
        this.bossDown = !!(s && s.bd); this.bossT = (s && s.bt) || 0; this.bossGrace = (s && s.bg) || 0; this.endT = (s && s.et) || 0;
        this.lootQueue = s && Array.isArray(s.loot) ? s.loot.filter(o => DATA.items[o.id] && ['n', 'x', 'y', 'z', 't'].every(k => Number.isFinite(o[k])) && o.n > 0).slice(0, 200).map(o => ({ ...o })) : [];
        Enemies.bossDead = this.bossDown;
        if (s && s.nm && this.MODS[s.nm]) this.applyMod(s.nm, true);
        const c = s && s.current;
        if (c && this.defs[c.id]) {
            this._restoring = c;
            try {
                this.cur = { id: c.id, def: this.defs[c.id], t: U.clamp(c.t || 0, 0, this.defs[c.id].dur) };
                this[this.cur.def.start]();
                if (Number.isFinite(c.lightT)) this.lightT = c.lightT;
                if (Number.isFinite(c.meteorT)) this.meteorT = c.meteorT;
            } finally { this._restoring = null; }
        } else if (this.nightMod === 'storm' && s && !Object.prototype.hasOwnProperty.call(s, 'current')) this.start('storm');
        if (s && s.bs && !this.bossDown) {
            const b = Enemies.spawnBoss({ x: s.bs.x, z: s.bs.z, hp: s.bs.hp, phase: s.bs.ph, risen: true });
            if (s.bs.maxHp > 0) { b.maxHp = s.bs.maxHp; b.hp = Math.min(s.bs.hp, b.maxHp); }
            if (s.bs.ai) for (const k of ['state', 'st', 'slamCd', 'dashCd', 'summonCd', 'atkCd', 'atkDur', 'hitDone', 'teleN', 'dashDir', 'enrage', 'stun', 'stunImm']) if (s.bs.ai[k] !== undefined) b[k] = s.bs.ai[k];
            if (this.bossGrace > 0) b.enrage = true;
            Sky.setFogBoost(0.85, 'boss');
        }
        this.syncCoinBonus();
    },

    // ---------------------------------------------------------------------------------------- расписание
    defs: {
        trader:   { name: 'ev.trader', icon: '🛒', w: (c) => c.day ? 3 : 0, dur: 105, start: 'startTrader', tick: 'tickTrader', end: 'endTrader' },
        airdrop:  { name: 'ev.airdrop', icon: '📦', w: (c) => 2.2, dur: 110, start: 'startAirdrop', tick: 'tickAirdrop', end: 'endAirdrop' },
        storm:    { name: 'ev.storm', icon: '⛈️', w: (c) => 2, dur: 85, start: 'startStorm', tick: 'tickStorm', end: 'endStorm' },
        meteor:   { name: 'ev.meteor', icon: '☄️', w: (c) => c.night ? 3 : 0, dur: 70, start: 'startMeteor', tick: 'tickMeteor', end: 'endMeteor' },
        treasure: { name: 'ev.treasure', icon: '🗺️', w: (c) => c.day ? 2.5 : 0.5, dur: 200, start: 'startTreasure', tick: 'tickTreasure', end: 'endTreasure' },
        bunny:    { name: 'ev.bunny', icon: '🐰', w: (c) => c.day ? 2.5 : 0, dur: 90, start: 'startBunny', tick: 'tickBunny', end: 'endBunny' },
        fogstorm: { name: 'ev.fogstorm', icon: '🌫️', w: (c) => c.night || c.dawn ? 2 : 0, dur: 75, start: 'startFog', tick: 'tickFog', end: 'endFog' },
    },

    ctx() { const dl = Sky.daylight; return { day: dl > 0.6, night: dl < 0.3, dawn: Sky.p < 0.12 || Sky.p > 0.9, lvl: Camp.level }; },

    update(dt) {
        if (Game.state !== 'play') return;
        this.tickLoot(dt);
        this.tickWeather(dt);
        this.tickMeteors(dt); this.tickBolts(dt);
        this.tickFinal(dt); this.tickCold(dt);
        const e = this.cur;
        if (e) {
            e.t += dt;
            if (this[e.def.tick]) this[e.def.tick](dt, e);
            this._ui -= dt;
            if (this._ui <= 0) { this._ui = 0.5; UI.setEvent(e.def.icon + ' ' + Lang.t(e.def.name) + ' ' + Math.max(0, Math.ceil(e.def.dur - e.t)) + 'с'); }
            if (e.t >= e.def.dur) this.stop(false);
            return;
        }
        // особая ночь показывается значком, пока нет другого события
        this._ui -= dt;
        if (this._ui <= 0) { this._ui = 0.5; const m = this.nightMod && this.MODS[this.nightMod]; if (m) UI.setEvent(m.icon + ' ' + Lang.t(m.name)); }
        // не мешаем обучению: события после первых шагов или со 2-х суток
        if (!(Quests.enabled === false || Quests.i >= 4 || Sky.day >= 2) || Player.dead || Player.sleeping || this.nightMod === 'storm' || Enemies.boss) return;
        this.nextT -= dt;
        if (this.nextT > 0) return;
        this.nextT = 140 + Math.random() * 130;
        const c = this.ctx(), ids = Object.keys(this.defs);
        let sum = 0; const ws = ids.map(id => { const w = this.defs[id].w(c); sum += w; return w; });
        if (sum <= 0) return;
        let r = Math.random() * sum, pick = ids[0];
        for (let i = 0; i < ids.length; i++) { r -= ws[i]; if (r <= 0) { pick = ids[i]; break; } }
        this.start(pick);
    },

    start(id) {
        const def = this.defs[id]; if (!def || this.cur) return;
        this.cur = { id, def, t: 0 };
        this[def.start](this.cur);
        UI.setEvent(def.icon + ' ' + Lang.t(def.name));
        Quests.event('event', 1);
    },
    stop(silent) {
        const e = this.cur; if (!e) { UI.setEvent(''); return; }
        this.cur = null;
        if (this[e.def.end]) this[e.def.end](e, silent);
        UI.setEvent('');
    },

    banner(title, sub, color, sfx) { if (this._restoring) return; UI.banner(Lang.t(title), sub ? Lang.t(sub) : '', color); if (sfx) Sfx.ui(sfx); },

    // случайная точка в открытом тумане на расстоянии r0..r1 (px) от игрока
    pointNear(r0, r1, need) {
        const lim = World.fogRadius - 500;
        for (let i = 0; i < 24; i++) {
            const a = Math.random() * 6.283, r = r0 + Math.random() * (r1 - r0);
            const x = Player.x + Math.cos(a) * r, z = Player.z + Math.sin(a) * r;
            if (Math.hypot(x - World.cx, z - World.cz) < lim && World.fpFree(x, z, need || 60, {})) return { x, z };
        }
        return { x: Player.x + 600, z: Player.z };
    },

    // ---------------------------------------------------------------------------------------- торговец
    startTrader() {
        const saved = this._restoring && this._restoring.trader;
        const data = Zones.models.trader_wagon;
        const Rw = data ? World.fpOf('trader_wagon', data).r : 200;
        let x = 0, z = 0, spot = saved ? { x: saved.wx, z: saved.wz } : null;
        for (let t = 0; t < 10 && !spot; t++) {
            const a = Math.random() * 6.283, r = (13 + Math.random() * 5) * M;
            spot = World.fpFind(Camp.x + Math.cos(a) * r, Camp.z + Math.sin(a) * r, Rw, { maxR: 900 });
        }
        if (!spot) spot = { x: Camp.x + 14 * M, z: Camp.z };
        x = spot.x; z = spot.z;
        const yaw = Math.atan2(Camp.x - x, Camp.z - z);
        const wagon = data ? Rig.instance(data, Game.view.scene, { name: 'trader_wagon' }) : null;
        if (wagon) { World.seatFit(wagon.root, 'trader_wagon', data, x, z, yaw + Math.PI / 2, {}); wagon.setShadows(Game.view, true); }
        const fp = World.fpAdd(x, z, Rw, 'event', true);
        const look = { hair: 'Hair_short', hairColor: '#3a2a1a', shirt: '#c9b27a', jacket: '#7a4a2a', pants: '#4a3a2a', skin: '#e0ac82', acc: ['ranger_hat', 'backpack', 'scarf'], accA: '#7a4a2a', accB: '#c98a3a', accC: '#d8423a' };
        let nx = x + Math.cos(yaw + 0.9) * (Rw + 90), nz = z + Math.sin(yaw + 0.9) * (Rw + 90);
        const np = World.fpFind(nx, nz, 70, {}); if (np) { nx = np.x; nz = np.z; }
        if (saved) { nx = saved.x; nz = saved.z; }
        const npc = Player.instanceFor(look, 'trader');
        npc.root.position.set(nx, World.heightAt(nx, nz), nz); npc.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(0, Math.atan2(Camp.x - nx, Camp.z - nz), 0);
        npc.setShadows(Game.view, true); npc.play('idle');
        const col = wagon ? World.colliders.add(x, z, 170, { prop: 1 }) : null;
        this.trader = { wagon, npc, x: nx, z: nz, wx: x, wz: z, col, fp, waveT: saved ? saved.waveT : 3 };
        this.banner('ev.traderT', 'ev.traderS', '#ffd070', 'fanfare');
        Quests.tipOnce('trader', 'Торговец стоит недалеко от костра: подойди и нажми E — покупай и продавай за монеты. Он уйдёт через пару минут.', 'The trader camps near the fire: press E to buy and sell for coins. He leaves in a couple of minutes.');
    },
    tickTrader(dt) {
        const T = this.trader; if (!T) return;
        T.npc.update(dt);
        T.waveT -= dt;
        if (T.waveT <= 0 && Math.hypot(Player.x - T.x, Player.z - T.z) < 1600) { T.waveT = 7; T.npc.play('wave', { layer: 2, mask: null, fade: 0.2, loop: false, restart: true }); T.npc.layers[2].target = 1; }
        if (Math.hypot(Player.x - T.x, Player.z - T.z) < 1000) { const k = Math.atan2(Player.x - T.x, Player.z - T.z); T.npc.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(0, k, 0); }
    },
    endTrader() {
        const T = this.trader; if (!T) return;
        if (T.wagon) T.wagon.dispose(); T.npc.dispose(); if (T.col) World.colliders.remove(T.col); World.fpRemove(T.fp);
        this.trader = null; UI.toast(Lang.t('ev.traderGone'), 'info');
    },

    // ---------------------------------------------------------------------------------------- сброс припасов
    startAirdrop() {
        const saved = this._restoring && this._restoring.drop;
        const p = saved || this.pointNear(1800, 3600, 170);
        const data = Zones.models.airdrop;
        const rig = data ? Rig.instance(data, Game.view.scene, { name: 'airdrop' }) : null;
        const y0 = World.heightAt(p.x, p.z);
        if (rig) { rig.root.position.set(p.x, y0 + 5200, p.z); rig.setShadows(Game.view, true); }
        this.drop = { rig, x: p.x, z: p.z, y0, h: 5200, landed: false, opened: false, smoke: null, _e: null, open: false, fp: World.fpAdd(p.x, p.z, 170, 'event', false) };
        if (saved) {
            Object.assign(this.drop, { h: saved.h, landed: saved.landed, opened: saved.opened });
            if (rig) { rig.root.position.y = y0 + saved.h; const chute = rig.node('chute'); if (chute && saved.landed) chute.setEnabled(false); }
        }
        this.banner('ev.dropT', 'ev.dropS', '#9aff9a', 'sting');
        Sfx.far('gong', p.x, 0, p.z, 0.8, 16000);
        UI.setWaypoint({ x: p.x, y: y0 + 700, z: p.z });
    },
    tickAirdrop(dt) {
        const D = this.drop; if (!D) return;
        if (!D.landed) {
            D.h = Math.max(0, D.h - (D.h > 600 ? 520 : 190) * dt);
            if (D.rig) { D.rig.root.position.y = D.y0 + D.h; D.rig.root.rotation.y += dt * 0.3; }
            if (D.h <= 0) {
                D.landed = true;
                const chute = D.rig && D.rig.node('chute'); if (chute) Tween.to(1.2, (k) => { chute.scaling.setAll(1 - k); }, { done: () => chute.setEnabled(false) });
                FX.dust(D.x, D.y0, D.z, 14, 1.8); FX.ring(D.x, D.y0 + 10, D.z, 700, '#9aff9a'); Cam.shake(0.25 * Math.max(0, 1 - Math.hypot(D.x - Player.x, D.z - Player.z) / 5000)); Sfx.at('thud', D.x, 0, D.z, 1);
                D.smoke = FX.pf.create({ name: 'dropsmoke', position: [D.x, D.y0 + 60, D.z], rate: 12, capacity: 40, life: [3, 5], size: [60, 120], speed: [20, 40], direction: [[-0.2, 1, -0.2], [0.2, 1.4, 0.2]], texture: FX.tex.smoke, color: '#ff5a4a', blend: 'standard', alpha: 0.45, sizeGradient: [[0, 0.4], [1, 1.6]] });
                if (Math.random() < 0.5) { const g = Enemies._groupId++; for (let i = 0; i < 2; i++) Enemies.spawn('wolf', D.x + (Math.random() - 0.5) * 900, D.z + (Math.random() - 0.5) * 900, { group: g, homeX: D.x, homeZ: D.z, leash: 30 * M, night: true }); }
            }
        }
        if (D.landed && !D.opened) UI.setWaypoint({ x: D.x, y: D.y0 + 500, z: D.z });
    },
    openDrop() {
        const D = this.drop; if (!D || !D.landed || D.opened) return;
        D.opened = true; Player.playAction('interact', 1.1); Sfx.at('chest', D.x, 0, D.z, 1);
        const tab = DATA.loot.gold, rnd = Math.random;
        const loot = [];
        for (let i = 0; i < 5; i++) { let r = rnd() * tab.total, pick = tab.rows[0]; for (const row of tab.rows) { r -= row.w; if (r <= 0) { pick = row; break; } } loot.push([pick.id, pick.n ? pick.n[0] + Math.floor(rnd() * (pick.n[1] - pick.n[0] + 1)) : 1]); }
        loot.push(['medkit', 1]); if (rnd() < 0.5) loot.push([['rifle', 'shotgun', 'bow'][Math.floor(rnd() * 3)], 1]);
        loot.forEach(([id, n], i) => this.queueLoot(id, n, D.x + (Math.random() - 0.5) * 120, D.z + (Math.random() - 0.5) * 120, D.y0 + 120, 0.3 + i * 0.14));
        Econ.dropCoins(D.x, D.z, 70 + Math.floor(rnd() * 50), 'airdrop');
        FX.ring(D.x, D.y0 + 10, D.z, 600, '#ffe066');
        UI.setWaypoint(null);
        setTimeout(() => { if (this.drop === D) this.endAirdrop(); }, 14000);
    },
    endAirdrop() {
        const D = this.drop; if (!D) return;
        if (D.smoke) D.smoke.dispose(); if (D.rig) D.rig.dispose(); World.fpRemove(D.fp);
        this.drop = null; if (!Game.waypointKid) UI.setWaypoint(null);
    },
    // Выдача привязана ко времени игры и сохраняется: opened=true больше не может потерять ещё не появившийся лут.
    queueLoot(id, n, x, z, y, delay, velocity) {
        const v = velocity || {};
        const entry = { id, n, x, z, y, t: delay || 0, vx: v.vx || 0, vy: Number.isFinite(v.vy) ? v.vy : 520, vz: v.vz || 0, fromBot: !!v.fromBot, lv: Math.max(0, Math.min(DATA.upgrade.max, v.lv | 0)) };
        if (DATA.items[id]?.mag && Number.isFinite(v.mag)) entry.mag = Math.max(0,Math.min(DATA.items[id].mag,Math.floor(v.mag)));
        this.lootQueue.push(entry);
    },
    tickLoot(dt) {
        for (let i = this.lootQueue.length - 1; i >= 0; i--) {
            const o = this.lootQueue[i]; o.t -= dt;
            if (o.t > 0) continue;
            this.lootQueue.splice(i, 1);
            const options = { y: o.y, vx: o.vx || 0, vy: Number.isFinite(o.vy) ? o.vy : 520, vz: o.vz || 0, delay: o.fromBot ? .3 : 0, lv:o.lv || 0 };
            if (Number.isFinite(o.mag)) options.mag = o.mag;
            const it = Items.spawn(o.id, o.n, o.x, o.z, options);
            if (it && o.fromBot) it._fromBot = true;
            if (o.id === 'log') { FX.leaves(o.x, o.y, o.z, 6); FX.dust(o.x, o.y - 160, o.z, 3, 1.2); }
            else FX.sparkBurst(o.x, o.y - 40, o.z, 8, '#ffe066');
        }
    },

    // ---------------------------------------------------------------------------------------- гроза
    startStorm() {
        this.rainTarget = 1;
        this.lightT = 3;
        Sky.setFogBoost(0.35, 'storm');
        this.banner('ev.stormT', 'ev.stormS', '#9ab8ff', 'sting');
        if (!this.rainFx) this.rainFx = FX.pf.create({ name: 'rain', position: [0, 0, 0], follow: () => ({ x: Player.x, y: Player.y + 1400, z: Player.z }), box: [[-1700, 0, -1700], [1700, 200, 1700]], rate: 1100, capacity: 1100, life: [0.55, 0.75], size: [30, 46], speed: [2400, 2900], direction: [[-0.06, -1, -0.04], [0.06, -1, 0.04]], texture: FX.tex.rain, color: '#c8d8ff', alpha: 0.5, blend: 'standard' });
    },
    tickStorm(dt) {
        this.lightT -= dt;
        if (this.lightT <= 0) {
            this.lightT = 5 + Math.random() * 8;
            const near = Math.random() < 0.3;
            const p = this.pointNear(near ? 1500 : 4000, near ? 2800 : 7000);
            this.lightning(p.x, p.z, near);
        }
    },
    endStorm() { this.rainTarget = 0; Sky.setFogBoost(0, 'storm'); },
    lightning(x, z, strike) {
        UI.flash('#dfe8ff', strike ? 0.85 : 0.5, 0.22);
        Sky.flash(strike ? 1.3 : 0.7, '#dfe8ff', strike ? 0.5 : 0.35);
        const y = World.heightAt(x, z);
        if (strike) {
            const bolt = BABYLON.MeshBuilder.CreateCylinder('bolt', { height: 5200, diameterTop: 14, diameterBottom: 34, tessellation: 5 }, Game.view.scene);
            const m = new BABYLON.StandardMaterial('boltM', Game.view.scene); m.disableLighting = true; m.emissiveColor = new BABYLON.Color3(0.85, 0.92, 1); m.fogEnabled = false; m.metadata = { mist: false, toon: false };
            bolt.material = m; bolt.position.set(x, y + 2600, z); bolt.isPickable = false; bolt.renderingGroupId = 1;
            this.bolts.push({ m: bolt, t: 0.22 });
            FX.sparkBurst(x, y + 60, z, 26, '#e8f0ff'); FX.ring(x, y + 10, z, 500, '#e8f0ff');
            // дерево рядом загорается и падает — бревна
            let best = null, bd = 400 * 400;
            for (const t of World.trees) { if (!t.alive) continue; const d = U.dist2(t.x, t.z, x, z); if (d < bd) { bd = d; best = t; } }
            if (best) { World.removeTree(best); const f = { x: 1, z: 0 }; World.fellVisual(best, f.x, f.z, () => {}); for (let i = 0; i < 3; i++) Items.spawn('log', 1, best.x + (Math.random() - 0.5) * 200, best.z + (Math.random() - 0.5) * 200, { y: y + 150, vy: 420 }); }
            if (Math.hypot(Player.x - x, Player.z - z) < 500) Player.hurt(22, x, z, 'bolt');
        }
        setTimeout(() => Sfx.far('thunder', x, 0, z, 1, 22000), 350 + Math.hypot(Player.x - x, Player.z - z) / 12);
        Cam.shake(strike ? 0.35 : 0.12);
    },
    tickBolts(dt) { for (let i = this.bolts.length - 1; i >= 0; i--) { const b = this.bolts[i]; b.t -= dt; b.m.visibility = Math.max(0, b.t / 0.22); if (b.t <= 0) { if (b.m.material) b.m.material.dispose(); b.m.dispose(); this.bolts.splice(i, 1); } } },
    tickWeather(dt) {
        this.rain = U.damp(this.rain || 0, this.rainTarget || 0, 1.2, dt);
        if (this.rainFx && this.rain < 0.02 && !this.rainTarget) { this.rainFx.dispose(); this.rainFx = null; }
        if (this.rainFx) this.rainFx.setRate(1100 * this.rain);
    },

    // ---------------------------------------------------------------------------------------- метеориты
    startMeteor() {
        this.meteorT = 1;
        this.banner('ev.meteorT', 'ev.meteorS', '#ffb060', 'sting');
        Sfx.ui('gong');
    },
    tickMeteor(dt) {
        this.meteorT -= dt;
        if (this.meteorT <= 0) {
            this.meteorT = 2.4 + Math.random() * 3;
            const p = this.pointNear(1500, 4200);
            const y0 = World.heightAt(p.x, p.z);
            const m = BABYLON.MeshBuilder.CreateSphere('meteor', { diameter: 120, segments: 6 }, Game.view.scene);
            const mt = new BABYLON.StandardMaterial('meteorM', Game.view.scene); mt.disableLighting = true; mt.emissiveColor = new BABYLON.Color3(1, 0.55, 0.2); mt.fogEnabled = false; mt.metadata = { mist: false, toon: false };
            m.material = mt; m.isPickable = false; m.renderingGroupId = 1;
            const dir = { x: (Math.random() - 0.5) * 0.6, z: (Math.random() - 0.5) * 0.6 };
            const trail = FX.pf.create({ name: 'mtrail', position: [0, 0, 0], follow: () => m.position, rate: 160, capacity: 160, life: [0.5, 0.9], size: [70, 150], speed: [10, 40], texture: FX.tex.soft, color: '#ffb040', color2: '#ff3a10', blend: 'add', alpha: 0.9, sizeGradient: [[0, 1], [1, 0.1]] });
            this.meteors.push({ m, x: p.x, z: p.z, y0, h: 4800, dir, trail, t: 0 });
            Sfx.far('meteor', p.x, 0, p.z, 1, 15000);
        }
    },
    tickMeteors(dt) {
        for (let i = this.meteors.length - 1; i >= 0; i--) {
            const k = this.meteors[i];
            k.h -= 3300 * dt;
            k.m.position.set(k.x + k.dir.x * k.h, k.y0 + Math.max(0, k.h), k.z + k.dir.z * k.h);
            if (k.h <= 0) {
                FX.sparkBurst(k.x, k.y0 + 40, k.z, 40, '#ffb040'); FX.ring(k.x, k.y0 + 10, k.z, 800, '#ff8a2a'); FX.dust(k.x, k.y0, k.z, 14, 1.6);
                Cam.shake(0.45 * Math.max(0, 1 - Math.hypot(k.x - Player.x, k.z - Player.z) / 5500)); Sfx.at('thud', k.x, 0, k.z, 1);
                Items.spawn('gem', 1, k.x, k.z, { y: k.y0 + 160, vy: 520 });
                if (Math.random() < 0.3) Items.spawn('diamond', 1, k.x + 60, k.z, { y: k.y0 + 160, vy: 480 });
                Econ.dropCoins(k.x, k.z, 14 + Math.floor(Math.random() * 14), 'meteor');
                if (Math.hypot(Player.x - k.x, Player.z - k.z) < 260) Player.hurt(30, k.x, k.z, 'bolt');
                k.trail.stop(); if (k.m.material) k.m.material.dispose(); k.m.dispose(); this.meteors.splice(i, 1);
            }
        }
    },
    endMeteor() { },

    // ---------------------------------------------------------------------------------------- клад
    startTreasure() {
        const saved = this._restoring && this._restoring.treasure;
        const k = Math.floor(Math.random() * Math.min(Camp.level, DATA.zones.length));
        const p = saved || Zones.ringPoint(U.rng(Date.now() & 0xffff), k, 500);
        const ch = saved ? Zones.chests.find(c => c.idx === saved.idx) || Zones.addChest(p.x, p.z, saved.yaw, saved.gold, saved.idx) : Zones.addChest(p.x, p.z, Math.random() * 6.28, true, 9000 + Math.floor(Math.random() * 900));
        if (saved && ch) { ch.opened = !!saved.opened; if (ch.opened) Zones.setLid(ch, 1); }
        this.treasure = { ch, x: p.x, z: p.z };
        this.banner('ev.treasureT', 'ev.treasureS', '#ffe066', 'keys');
    },
    tickTreasure() {
        const T = this.treasure; if (!T) return;
        if (T.ch && T.ch.opened) { this.stop(false); return; }
        if (!Game.waypointKid) UI.setWaypoint({ x: T.x, y: World.heightAt(T.x, T.z) + 450, z: T.z });
    },
    endTreasure() { const T = this.treasure; this.treasure = null; if (!Game.waypointKid) UI.setWaypoint(null); },

    // ---------------------------------------------------------------------------------------- золотой кролик
    startBunny() {
        const saved = this._restoring && this._restoring.gold;
        const p = saved || this.pointNear(1800, 3200);
        const e = Enemies.spawn('bunny', p.x, p.z, { leash: 40 * M, speedK: 1.9, always: true });
        e.gold = true; e.hp = e.maxHp = 6;
        if (saved) { e.hp = saved.hp; e.alive = saved.alive; if (!e.alive) { e.state = 'dead'; e.deadT = 0; } }
        Enemies.ensureRig(e);
        if (e.rig) for (const mats of e.rig.materials.values()) for (const m of mats) Rig.recolor(m, { color: '#ffd24a', emissive: '#6a4a00' });
        this.gold = e;
        this.banner('ev.bunnyT', 'ev.bunnyS', '#ffe066', 'sting');
    },
    tickBunny() {
        const e = this.gold; if (!e) return;
        if (!e.alive) { Econ.dropCoins(e.x, e.z, 70, 'bunny'); Items.spawn('diamond', 1, e.x, e.z, { y: e.y + 120, vy: 480 }); FX.sparkBurst(e.x, e.y + 80, e.z, 40, '#ffe066'); UI.toast(Lang.t('ev.bunnyWin'), 'good'); Sfx.ui('fanfare'); this.gold = null; this.stop(false); return; }
        if (!Enemies.list.includes(e)) { this.gold = null; this.stop(false); }
        else if (e.rig && Math.random() < 0.08) FX.sparkBurst(e.x, e.y + 40, e.z, 2, '#ffe066');
    },
    endBunny() { const e = this.gold; this.gold = null; if (e && e.alive) { e.alive = false; e.deadT = 7; e.state = 'dead'; if (e.rig) e.rig.root.setEnabled(false); } },

    // ---------------------------------------------------------------------------------------- туманная буря и кровавая луна
    startFog() {
        Sky.setFogBoost(0.75, 'fogstorm');
        this.syncCoinBonus();
        const g = Enemies._groupId++;
        if (!this._restoring) for (let i = 0; i < 3; i++) { const p = this.pointNear(2600, 4200); Enemies.spawn('wolf', p.x, p.z, { group: g, homeX: p.x, homeZ: p.z, leash: 40 * M, night: true }); }
        this.banner('ev.fogT', 'ev.fogS', '#b8c8d8', 'sting');
        if (!this._restoring) { const p = this.pointNear(6 * M, 10 * M); Sfx.at('ghost', p.x, World.heightAt(p.x, p.z), p.z, .6); }
    },
    tickFog(dt) { if (Math.random() < dt * 0.06) { const p = this.pointNear(1500, 3500); Sfx.far('creature', p.x, 0, p.z, 0.8, 8000); } },
    endFog() { Sky.setFogBoost(0, 'fogstorm'); this.syncCoinBonus(); },
    syncCoinBonus() {
        const bonus = { blood: 2, swarm: 1.4, cold: 1.3, quiet: 1.6, storm: 1.3, fog: 1.5 };
        Game.coinK = Math.max(bonus[this.nightMod] || 1, this.cur && this.cur.id === 'fogstorm' ? 1.5 : 1);
    },
    // ---------------------------------------------------------------------------------------- особые ночи
    // name — ключ в Lang; icon — значок в чипе события
    MODS: {
        blood: { icon: '🩸', name: 'nm.blood' },
        swarm: { icon: '🐺', name: 'nm.swarm' },
        cold:  { icon: '❄️', name: 'nm.cold' },
        quiet: { icon: '🌙', name: 'nm.quiet' },
        storm: { icon: '⛈️', name: 'nm.storm' },
        fog:   { icon: '🌫️', name: 'nm.fog' },
    },
    // Начало ночи: с 3-х суток ночь бывает особой (примерно две из трёх); 99-я — финал с боссом
    onNight() {
        if (Sky.day === DATA.time.totalNights) { this.finalNight(); return; }
        this.clearMod();
        if (Sky.day < DATA.balance.nights.startSpecial || Math.random() > DATA.balance.nights.specialChance) return;
        const list = DATA.nightMods; let sum = 0; for (const m of list) sum += m.w;
        let r = Math.random() * sum, pick = list[0].id;
        for (const m of list) { r -= m.w; if (r <= 0) { pick = m.id; break; } }
        this.applyMod(pick, false);
        if (window.Ach) Ach.event('specialNight', 1);
    },
    // silent — при загрузке: без баннеров и без повторного запуска событий
    applyMod(id, silent) {
        const m = this.MODS[id]; if (!m) return;
        this.clearMod();
        this.nightMod = id;
        const T = (k) => Lang.t(k);
        switch (id) {
            case 'blood':
                this.bloodMoon = true; Game.coinK = 2; Enemies.nightBoost = 1.7;
                Sky.setFogBoost(0.3, 'night');
                if (!silent) { Enemies.raidT = Math.min(Enemies.raidT, 10); UI.flash('#700', 0.4, 1.2); }
                break;
            case 'swarm':
                Game.coinK = 1.4; Enemies.nightBoost = 1.5; Enemies.swarm = true;
                if (!silent) Enemies.raidT = Math.min(Enemies.raidT, 6);
                break;
            case 'cold':
                this.cold = true; Game.coinK = 1.3;
                break;
            case 'quiet':
                Game.coinK = 1.6; Enemies.nightBoost = 0.45;
                break;
            case 'storm':
                Game.coinK = 1.3;
                if (!silent && !this.cur) this.start('storm');
                break;
            case 'fog':
                Game.coinK = 1.5;
                Sky.setFogBoost(0.75, 'night');
                if (!silent && !this.cur) this.start('fogstorm');
                break;
        }
        this.syncCoinBonus();
        // баннер «Ночь N» ставит Game сразу после — показываем свой чуть позже
        if (!silent) { Sfx.ui('sting'); setTimeout(() => { if (Game.state === 'play' && this.nightMod === id) UI.banner(T('nm.' + id + 'T'), T('nm.' + id + 'S'), id === 'quiet' ? '#9ad0ff' : id === 'cold' ? '#a8dcff' : '#ff6a5a'); }, 3600); }
        UI.setEvent(m.icon + ' ' + T(m.name));
    },
    clearMod() {
        const was = this.nightMod;
        this.nightMod = null; this.bloodMoon = false; this.cold = false;
        this.syncCoinBonus(); Enemies.nightBoost = 1; Enemies.swarm = false;
        Sky.setFogBoost(0, 'night');
        if (was && !this.cur) UI.setEvent('');
    },
    onDawn() {
        if (this.nightMod) { this.clearMod(); if (this.cur && (this.cur.id === 'storm' || this.cur.id === 'fogstorm')) this.stop(false); }
    },
    // Мороз: вне круга костра быстрее голод и синяя виньетка
    tickCold(dt) {
        if (!this.cold && this.coldK < 0.01) { if (this._coldEl) this._coldEl.style.opacity = '0'; return; }
        if (!this._coldEl && UI.el && UI.el.hud) {
            const d = document.createElement('div'); d.id = 'fxCold';
            d.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .35s;background:radial-gradient(ellipse at 50% 50%,rgba(150,210,255,0) 38%,rgba(150,210,255,.5) 100%);mix-blend-mode:screen';
            UI.el.hud.appendChild(d); this._coldEl = d;
        }
        const out = this.cold && Game.state === 'play' && !Player.dead && !Player.sleeping && !Camp.isSafe(Player.x, Player.z, 0);
        this.coldK = U.damp(this.coldK, out ? 1 : 0, 2.2, dt);
        if (this._coldEl) this._coldEl.style.opacity = String(Math.round(this.coldK * 80) / 100);
        if (out && !Player.sleeping) Player.hunger = Math.max(0, Player.hunger - dt * 0.3);
    },

    // ---------------------------------------------------------------------------------------- финал: 99-я ночь
    finalNight() {
        this.clearMod();
        Sfx.ui('sting'); Sky.flash(0.5, '#b080ff', 1);
        setTimeout(() => { if (Game.state === 'play') UI.banner(Lang.t('boss.nightT'), Lang.t('boss.nightS'), '#ff6a5a'); }, 3600);
        Sky.setFogBoost(0.55, 'boss');
        if (!this.bossDown && !(Enemies.boss && Enemies.boss.alive)) this.bossT = 9;
    },
    tickFinal(dt) {
        if (this.bossT > 0) {
            this.bossT -= dt;
            if (this.bossT <= 0 && !this.bossDown && !(Enemies.boss && Enemies.boss.alive)) Enemies.spawnBoss();
        }
        // рассвет, а босс жив: он в ярости ещё ~100 секунд, потом уходит и финал засчитывается без победы над ним
        if (this.bossGrace > 0) {
            this.bossGrace -= dt;
            const b = Enemies.boss;
            if (!b || !b.alive) this.bossGrace = 0;
            else if (this.bossGrace <= 0) {
                b.alive = false; b.state = 'dead'; b.deadT = 7; Enemies.updateBossTell(b); Enemies.boss = null; FX.poof(b.x, b.y + 200, b.z, true); if (b.rig) b.rig.root.setEnabled(false);
                for (const m of Enemies.list) if (m.minion && m.alive) { m.alive = false; m.state = 'dead'; m.deadT = 7; if (m.rig) m.rig.root.setEnabled(false); }
                Sky.setFogBoost(0, 'boss'); Game.ending(true);
            }
        }
        if (this.endT > 0) { this.endT -= dt; if (this.endT <= 0) Game.ending(true); }
    },
    // Рассвет 100-го дня: true — игра ещё не закончена (босс жив)
    finalDawn() {
        const b = Enemies.boss;
        if (!b || !b.alive) return false;
        b.enrage = true; this.bossGrace = DATA.balance.boss.grace;
        UI.banner(Lang.t('boss.dawnT'), Lang.t('boss.dawnS'), '#ff6a5a'); Sfx.ui('sting');
        return true;
    },
    onBossDead() {
        this.bossDown = true; this.bossT = 0;
        // победа над боссом до рассвета: игра заканчивается с рассветом; на рассвете или в «ярости» — сразу
        if (this.bossGrace > 0 || Sky.day > DATA.time.totalNights) { this.bossGrace = 0; this.endT = 5; }
    },


    // ---------------------------------------------------------------------------------------- взаимодействия
    register() {
        const self = this;
        Interact.providers.push((consider) => {
            const T = self.trader;
            if (T) { if (!T._e) T._e = { get x() { return T.x; }, get z() { return T.z; }, r: 2.8 * M, h: 260, prio: 1, text: () => Lang.t('p.trade'), sub: () => Lang.t('p.tradeSub'), act: () => UI.open('trade') }; consider(T._e); }
            const D = self.drop;
            if (D && D.landed && !D.opened) { if (!D._e) D._e = { get x() { return D.x; }, get z() { return D.z; }, r: 2.8 * M, h: 120, prio: 1, text: () => Lang.t('p.airdrop'), act: () => self.openDrop() }; consider(D._e); }
        });
    },
};
Events.register();

// Camp.js — лагерь: костёр (топливо, уровни, свет, огонь), верстак, пресс-«скраппер», доска пропавших,
// котелок, спальники, палатки, поленница, факелы/ловушки (стройка), сон до утра.
// Раскладка — маркеры карты (camp-*), по умолчанию — вокруг spawn. Модели — Blender GLB.

/** @type {Record<string, any>} */
const Camp = {
    x: 0, z: 0, y: 0,
    level: 1, fuel: 100, lit: true, scrap: 0,
    fireModel: null, fireFx: null, light: null, lightBase: 2.6, flick: 0, pulse: 0,
    props: {}, structures: [], placing: null, ghost: null, ghostYaw: 0,
    pile: 3, sleepingIn: null, cook: { state: 'empty', t: 0, out: null },
    models: {}, view: null, scene: null,
    _fuelWarn: 0, _signTex: null, zz: null,
    spent: { logs: 0 },
    storage: [], chestPos: null,

    async init(app, view) {
        this.view = view; this.scene = view.scene;
        const sp = app.location.marker('spawn');
        this.x = sp.x; this.z = sp.y; this.y = World.heightAt(this.x, this.z);
        const names = ['campfire_1', 'campfire_2', 'campfire_3', 'campfire_4', 'campfire_5', 'log_pile', 'bench', 'scrapper', 'sign_scrap', 'board', 'sleeping_bag', 'tent_a',
            'pot', 'torch_stand', 'fence', 'wire', 'spikes', 'beartrap', 'chest', 'chest_gold', 'lamp_post', 'crate', 'barrel', 'barricade', 'beacon'];
        await Promise.all(names.map(async (n) => { try { this.models[n] = await Rig.load('assets/models/' + n + '.glb'); } catch (e) { console.warn('Camp: нет модели', n); } }));
        // свет костра
        const L = this.light = new BABYLON.PointLight('fireLight', new BABYLON.Vector3(this.x, this.y + 110, this.z), this.scene);
        L.diffuse = new BABYLON.Color3(1, 0.6, 0.26); L.specular = new BABYLON.Color3(1, 0.5, 0.2);
        L.intensity = 2.6; L.range = 2400; L.renderPriority = 6;
        this.build(app.location);
        this.setLevel(1, true);
        this.fireFx = FX.fire(this.x, this.y, this.z, 1);
        this._registerInteractions();
    },

    // ---------------------------------------------------------------------------------------- построение
    marker(loc, name, dx, dz) {
        const m = loc.marker(name);
        return m ? { x: m.x, z: m.y } : { x: this.x + dx * M, z: this.z + dz * M };
    },

    // Экземпляр модели, повёрнутый лицом к точке (tx, tz); yaw — фронт модели +Z
    put(name, x, z, faceX, faceZ, o) {
        const opts = o || {};
        const data = this.models[name];
        if (!data) return null;
        const f = World.fpOf(name, data), R = f.r * (opts.scale || 1);
        if (opts.free) { const p = World.fpFind(x, z, R, { maxR: opts.maxR || R * 6, inside: opts.inside }); if (!p) return null; x = p.x; z = p.z; }
        const rig = Rig.instance(data, this.scene, { name, materials: opts.materials, bake: true });
        const yaw = opts.yaw != null ? opts.yaw : Math.atan2(faceX - x, faceZ - z);
        const g = World.seatFit(rig.root, name, data, x, z, yaw, { scale: opts.scale, lift: opts.h, embed: opts.embed });
        if (opts.scale) rig.root.scaling.setAll(opts.scale);
        World.trackShadow(rig, x, z, opts.shadowR || 4600);
        rig.yaw = yaw; rig.x = x; rig.z = z; rig.y = g.y;
        if (!opts.nofp) rig.fp = World.fpAdd(x, z, R, opts.fpTag || 'camp', R > 260);
        return rig;
    },

    build(loc) {
        const cx = this.x, cz = this.z;
        const P = this.props;
        // палатки ставятся первыми: самые большие, остальное обходит их
        P.tents = [];
        const tentCols = ['#2f7fd8', '#e8c02a', '#e05a9a'];
        for (let i = 0; i < 3; i++) {
            const m = loc.marker('camp-tent-' + (i + 1));
            const a = (-20 + i * 40 + 200) * Math.PI / 180, r = 10.2 * M;
            const pos = m ? { x: m.x, z: m.y } : { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r };
            const rig = this.put('tent_a', pos.x, pos.z, cx, cz, { materials: { tent: tentCols[i] }, free: true, maxR: 500 });
            if (!rig) continue;
            P.tents.push(rig);
            World.colliders.add(rig.x, rig.z, 1.3 * M, { camp: 1 });
        }
        // поленница, верстак, пресс, вывеска, доска, котелок: на своих местах, а при наложении — рядом
        const pile = this.marker(loc, 'camp-pile', -3.7, 2.4);
        P.pile = this.put('log_pile', pile.x, pile.z, cx, cz, { free: true, maxR: 400 });
        const bench = this.marker(loc, 'camp-bench', 5.6, -3.0);
        P.bench = this.put('bench', bench.x, bench.z, cx, cz, { free: true, maxR: 400 });
        const scr = this.marker(loc, 'camp-scrapper', 5.8, 2.8);
        P.scrapper = this.put('scrapper', scr.x, scr.z, cx, cz, { free: true, maxR: 400 });
        const sign = this.marker(loc, 'camp-sign', 3.4, 5.1);
        P.sign = this.put('sign_scrap', sign.x, sign.z, cx, cz, { free: true, maxR: 300 });
        this._setupSign();
        const board = this.marker(loc, 'camp-board', -5.6, -3.4);
        P.board = this.put('board', board.x, board.z, cx, cz, { free: true, maxR: 400 });
        const pot = this.marker(loc, 'camp-pot', -2.2, 4.6);
        P.pot = this.put('pot', pot.x, pot.z, cx, cz, { free: true, maxR: 300 });
        P.potPos = { x: P.pot.x, z: P.pot.z };
        const chest = this.marker(loc, 'camp-storage', -3.7, -0.6);
        P.storage = this.put('chest', chest.x, chest.z, cx, cz, { free: true, maxR: 900 });
        if (P.storage) {
            this.chestPos = { x: P.storage.x, y: P.storage.y, z: P.storage.z };
            World.colliders.add(P.storage.x, P.storage.z, .65 * M, { camp: 1 });
        }
        // спальники
        P.sleeps = [];
        const bagCols = ['#c0392b', '#2f7fd8', '#e0a020', '#3aa860'];
        for (let i = 0; i < 4; i++) {
            const m = loc.marker('camp-sleep-' + (i + 1)) || (i === 0 ? loc.marker('camp-sleep') : null);
            const a = (150 + i * 24) * Math.PI / 180, r = 5.4 * M;
            const pos = m ? { x: m.x, z: m.y } : { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r };
            const rig = this.put('sleeping_bag', pos.x, pos.z, cx + (pos.x - cx) * 2, cz + (pos.z - cz) * 2, { materials: { bag: bagCols[i] }, free: !m, maxR: 420 });
            if (!rig) continue;
            P.sleeps.push({ rig, x: rig.x, z: rig.z });
        }
        // декор: бочки, ящики, фонарь
        const rnd = U.rng(5);
        /** @type {[string, number, number][]} */
        const deco = [['lamp_post', 3.4, -6.0], ['lamp_post', -6.2, 5.4], ['lamp_post', 8.2, 5.8], ['crate', 6.4, -0.4], ['barrel', 6.9, 1.4], ['crate', 7.6, -1.3], ['barrel', -6.6, 0.6], ['crate', -7.0, 1.9]];
        P.lamps = []; P.deco = [];
        for (const [n, dx, dz] of deco) {
            const rig = this.put(n, cx + dx * M, cz + dz * M, cx, cz, { yaw: rnd() * 6.28, free: true, maxR: 260 });
            if (!rig) continue;
            P.deco.push(rig);
            if (n === 'lamp_post') P.lamps.push(rig);
            World.colliders.add(rig.x, rig.z, n === 'lamp_post' ? 0.15 * M : 0.5 * M, { camp: 1 });
        }
        // коллайдеры мебели
        World.colliders.add(P.bench.x, P.bench.z, 0.9 * M, { camp: 1 });
        World.colliders.add(P.bench.x + Math.cos(P.bench.yaw + Math.PI / 2) * 0.7 * M, P.bench.z - Math.sin(P.bench.yaw + Math.PI / 2) * 0.7 * M, 0.7 * M, { camp: 1 });
        World.colliders.add(P.scrapper.x, P.scrapper.z, 1.05 * M, { camp: 1 });
        World.colliders.add(P.board.x, P.board.z, 0.8 * M, { camp: 1 });
        World.colliders.add(P.pot.x, P.pot.z, 0.5 * M, { camp: 1 });
        World.colliders.add(P.pile.x, P.pile.z, 0.7 * M, { camp: 1 });
        World.colliders.add(P.sign.x, P.sign.z, 0.2 * M, { camp: 1 });
        // костёр: блокирует центр
        this.fireCol = World.colliders.add(this.x, this.y ? this.z : this.z, 0.75 * M, { camp: 1 });
        // огонь под котелком
        P.potFx = FX.torch(P.potPos.x, World.heightAt(P.potPos.x, P.potPos.z) + 12, P.potPos.z);
        // фонари: живой огонёк рядом с горящими светильниками
        for (const l of P.lamps) {
            const p = l.root.position;
            const dx = Math.cos(l.yaw) * 0, dz = 0;
        }
    },

    _setupSign() {
        const sign = this.props.sign;
        if (!sign) return;
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
        this._signCv = cv;
        const tex = this._signTex = new BABYLON.DynamicTexture('signTex', cv, this.scene, true);
        const mats = sign.materials.get('display');
        if (mats && mats[0]) {
            const m = mats[0];
            m.diffuseTexture = tex; m.emissiveTexture = tex; m.disableLighting = true;
            m.emissiveColor = new BABYLON.Color3(1, 1, 1); m.diffuseColor = new BABYLON.Color3(0, 0, 0);
        }
        this.drawSign();
    },
    drawSign() {
        const cv = this._signCv; if (!cv) return;
        const g = cv.getContext('2d');
        g.fillStyle = '#15171c'; g.fillRect(0, 0, 256, 128);
        g.fillStyle = '#20232c'; g.fillRect(6, 6, 244, 116);
        // винт
        g.save(); g.translate(58, 64); g.fillStyle = '#c0c6d0'; g.strokeStyle = '#000'; g.lineWidth = 5;
        g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); } g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#7d8592'; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill(); g.stroke(); g.restore();
        g.font = '800 74px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 10; g.strokeStyle = '#000'; g.strokeText(String(this.scrap), 172, 68); g.fillStyle = '#fff'; g.fillText(String(this.scrap), 172, 68);
        this._signTex.update();
    },

    // Общий сундук. Боты завершают перенос груза ДО autosave; storeItems сам не сохраняет.
    storeItems(id, n, lv, mag) {
        const def = DATA.items[id];
        if (!def || !Number.isSafeInteger(n) || n <= 0) return n;
        lv = def.stack === 1 ? Math.max(0, Math.min(3, Math.floor(Number(lv) || 0))) : 0;
        mag = def.mag ? Math.max(0, Math.min(def.mag, Math.floor(mag == null ? def.mag : Number(mag) || 0))) : 0;
        let entry = this.storage.find(s => s.id === id && (s.lv || 0) === lv && (s.mag || 0) === mag);
        if (!entry) { entry = { id, n: 0, lv, mag }; this.storage.push(entry); }
        const added = Math.min(n, 1000000 - entry.n);
        entry.n += added;
        return n - added;
    },
    storageCount() { return this.storage.reduce((n, s) => n + s.n, 0); },
    // Бот проверяет своё расстояние и сохраняет только после добавления топлива в груз.
    takeStoredFuel() {
        const index = this.storage.findIndex(s => s.n > 0 && DATA.fuel[s.id] > 0);
        if (index < 0) return null;
        const entry = this.storage[index], item = { id: entry.id, n: 1, lv: entry.lv || 0, mag: entry.mag || 0 };
        if (--entry.n === 0) this.storage.splice(index, 1);
        return item;
    },
    storageReach() {
        const p = this.chestPos;
        return !!p && Math.hypot(Player.x - p.x, Player.z - p.z, Player.y - p.y) <= 2.4 * M;
    },
    openStorage() {
        if (!this.storageReach()) { UI.toast(Lang.t('camp.storageFar'), 'info'); return false; }
        Player.playAction('interact', 1.2);
        Sfx.at('chest', this.chestPos.x, this.chestPos.y, this.chestPos.z, .7);
        UI.open('campchest');
        return true;
    },
    takeStored(index, amount) {
        if (!this.storageReach()) return 0;
        const entry = this.storage[index], def = entry && DATA.items[entry.id];
        if (!def) return 0;
        const want = Math.min(entry.n, amount == null || amount === Infinity ? entry.n : Math.max(0, Math.floor(Number(amount) || 0)));
        let left = want;
        if (def.stack > 1) for (const slot of Inv.slots) {
            if (!slot || slot.id !== entry.id) continue;
            const n = Math.min(left, Math.max(0, def.stack - slot.n)); slot.n += n; left -= n;
        }
        for (let i = 0; i < Inv.slots.length && left > 0; i++) if (!Inv.slots[i]) {
            const n = Math.min(left, def.stack);
            Inv.slots[i] = { id: entry.id, n, mag: entry.mag || 0 };
            if (entry.lv) Inv.slots[i].lv = entry.lv;
            left -= n;
        }
        const moved = want - left;
        if (moved > 0) {
            entry.n -= moved;
            if (!entry.n) this.storage.splice(index, 1);
            Inv.emit(); Player.equipCurrent(); Sfx.ui('pickup');
            Game.autosave('camp-storage');
        }
        return moved;
    },
    depositSelected(amount) {
        if (!this.storageReach()) return 0;
        const slot = Inv.current(); if (!slot) return 0;
        const want = Math.min(slot.n, amount == null || amount === Infinity ? slot.n : Math.max(0, Math.floor(Number(amount) || 0)));
        if (want <= 0) return 0;
        const moved = want - this.storeItems(slot.id, want, slot.lv, slot.mag);
        if (moved > 0) {
            Inv.removeSlot(Inv.sel, moved); Player.equipCurrent(); Sfx.ui('drop');
            Game.autosave('camp-storage');
        }
        return moved;
    },

    // ---------------------------------------------------------------------------------------- уровни огня
    fireScale() { return [0.85, 1.0, 1.2, 1.45, 1.75][this.level - 1]; },
    setLevel(lv, instant) {
        this.level = lv;
        const d = DATA.fire[lv];
        this.cap = d.cap; this.burn = d.burn;
        if (this.fireModel) { this.fireModel.dispose(); this.fireModel = null; }
        this.fireModel = this.put('campfire_' + lv, this.x, this.z, this.x, this.z + 1, { yaw: 0 });
        if (this.fireModel) this.fireModel.setShadows(this.view, false);
        this.light.range = d.light * M * 1.35;
        this.lightBase = 2.2 + lv * 0.42;
        if (this.fireCol) this.fireCol.r = [0.6, 0.8, 1.0, 1.15, 1.4][lv - 1] * M;
        World.setFogRadius(d.fog * M, !!instant);
        if (this.fireFx && !instant) { this.fireFx.dispose(); this.fireFx = FX.fire(this.x, this.y, this.z, this.fireScale()); }
        else if (this.fireFx && instant) { this.fireFx.dispose(); this.fireFx = FX.fire(this.x, this.y, this.z, this.fireScale()); }
        this.fuel = Math.min(this.fuel, this.cap);
    },

    upgradeCost() { return DATA.fire[this.level + 1] ? DATA.fire[this.level + 1].cost : null; },
    canUpgrade() {
        const c = this.upgradeCost(); if (!c) return false;
        return Inv.count('log') >= (c.log || 0) && this.scrap >= (c.scrap || 0) && Inv.count('gem') >= (c.gem || 0);
    },
    upgrade() {
        const c = this.upgradeCost();
        if (!c || !this.canUpgrade()) { UI.toast(Lang.t('needMore'), 'warn'); return false; }
        if (c.log) Inv.take('log', c.log);
        if (c.gem) Inv.take('gem', c.gem);
        this.scrap -= (c.scrap || 0); this.drawSign();
        const oldFog = World.fogRadius;
        this.setLevel(this.level + 1);
        Game.openLevel(this.level, true, true);
        this.fuel = this.cap;
        this.lit = true;
        // праздничный эффект
        FX.ring(this.x, this.y + 20, this.z, 900, '#ffb04a'); FX.ring(this.x, this.y + 30, this.z, 1400, '#ffffff');
        FX.sparkBurst(this.x, this.y + 80, this.z, 60, '#ffd070');
        this.pulse = 1.6;
        Cam.shake(0.5); Cam.kick(0.08);
        UI.flash('#ffd9a0', 0.55, 0.9);
        UI.banner(Lang.t('fireUp', { n: this.level }), Lang.t('fireUpSub'), '#ffd070');
        Sfx.ui('fanfare'); Sfx.at('ignite', this.x, this.y, this.z, 1);
        UI.objectiveEvent('upgrade');
        Game.autosave && Game.autosave();
        return true;
    },

    // ---------------------------------------------------------------------------------------- топливо
    fuelFrac() { return this.fuel / this.cap; },
    fuelItems() { return ['log', 'coal', 'canister'].filter(id => Inv.count(id) > 0); },
    heldFuel() { const s = Player.heldId; return s && DATA.fuel[s] != null ? s : null; },

    feed(id) {
        if (!Inv.has(id, 1)) return false;
        const relight = !this.lit;
        // берём из руки, если это то же, иначе из инвентаря
        Inv.take(id, 1);
        if (!Inv.current()) Player.equipCurrent();
        Player.playAction('place', 1.2);
        Player.faceYaw = Math.atan2(this.x - Player.x, this.z - Player.z);
        Player.acting = 0.5;
        const add = DATA.fuel[id];
        // Commit fuel with inventory consumption before any save or delayed visual.
        this.fuel = Math.min(this.cap, this.fuel + add);
        this.lit = true; this.pulse = 1;
        if (id === 'log') { Player.stats.fed = (Player.stats.fed || 0) + 1; UI.objectiveEvent('feed'); }
        Game.autosave('feed');
        // предмет летит в костёр
        const it = Items.make(id);
        const from = Player.headPos();
        it.position.set(from.x, from.y - 30, from.z);
        const to = { x: this.x, y: this.y + 60, z: this.z };
        const sx = from.x, sy = from.y - 30, sz = from.z;
        Tween.to(0.42, (k) => {
            it.position.set(U.lerp(sx, to.x, k), U.lerp(sy, to.y, k) + Math.sin(k * Math.PI) * 150, U.lerp(sz, to.z, k));
            it.rotation.x = k * 9; it.rotation.z = k * 5;
        }, { ease: (k) => k, delay: 0.16, done: () => {
            if (it._rig) it._rig.dispose(); else { for (const m of it._meshes) m.dispose(); it.dispose(); }
            FX.sparkBurst(this.x, this.y + 70, this.z, 22, '#ffb050');
            this.burst = 1;
            Sfx.at('ignite', this.x, this.y, this.z, relight ? 1 : 0.6); if (relight) Sfx.at('match', this.x, this.y, this.z, 1);
            Cam.shake(0.08);
            UI.floatText({ x: this.x, y: this.y + 200, z: this.z }, '+' + add + ' 🔥', '#ffb84a', true);
        } });
        return true;
    },

    // ---------------------------------------------------------------------------------------- лом
    scrapAll() {
        let n = 0;
        for (let i = 0; i < Inv.slots.length; i++) {
            const s = Inv.slots[i];
            if (s && DATA.scrapValue(s.id) > 0) { n += DATA.scrapValue(s.id) * s.n; Inv.slots[i] = null; }
        }
        if (n <= 0) { UI.toast(Lang.t('noScrap'), 'warn'); return; }
        Inv.emit();
        if (!Inv.current()) Player.equipCurrent();
        Player.playAction('place', 1.2);
        const sc = this.props.scrapper;
        // шестерни крутятся, искры
        this.gearSpin = 2.2;
        Sfx.at('heavy', sc.x, sc.rig ? 0 : 0, sc.z, 1); Sfx.at('metal', sc.x, 0, sc.z, 1);
        FX.sparkBurst(sc.x, sc.y + 150, sc.z, 30, '#ffd070'); FX.dust(sc.x, sc.y + 40, sc.z, 6, 1.4);
        Cam.shake(0.2);
        this.scrap += n; this.drawSign(); UI.objectiveEvent('scrap');
        Game.autosave('scrap');
        AttackFX.later(.7, () => {
            UI.floatText({ x: sc.x, y: sc.y + 230, z: sc.z }, '+' + n + ' 🔩', '#ffe680', true);
            Sfx.ui('coin'); FX.pickup(sc.x, sc.y + 200, sc.z);
        });
    },
    spendScrap(n) { if (this.scrap < n) return false; this.scrap -= n; this.drawSign(); return true; },
    addScrap(n) { this.scrap += n; this.drawSign(); },

    // ---------------------------------------------------------------------------------------- готовка
    cookStart(kind) {
        const c = this.cook;
        if (c.state !== 'empty') return;
        if (kind === 'steak') {
            if (!Inv.take('steak_raw', 1)) return;
            c.out = 'steak_cooked'; c.t = 6; c.n = 1;
        } else if (kind === 'fish') {
            if (!Inv.take('fish_raw', 1)) return;
            c.out = 'fish_cooked'; c.t = 5; c.n = 1;
        } else {
            if (!Inv.has('steak_raw', 1) || !Inv.has('carrot', 2)) { UI.toast(Lang.t('stewNeed'), 'warn'); return; }
            Inv.take('steak_raw', 1); Inv.take('carrot', 2);
            c.out = 'stew'; c.t = 10; c.n = 1;
        }
        c.state = 'cooking'; c.max = c.t;
        if (!Inv.current()) Player.equipCurrent();
        Player.playAction('place', 1.2);
        Sfx.at('sizzle', this.props.potPos.x, 0, this.props.potPos.z, 1);
        FX.sparkBurst(this.props.potPos.x, this.y + 60, this.props.potPos.z, 10, '#ffd070');
    },
    cookTick(dt) {
        const c = this.cook;
        if (c.state === 'cooking') {
            c.t -= dt;
            if (Math.random() < dt * 3) FX.dust(this.props.potPos.x, this.y + 130, this.props.potPos.z, 1, 0.6);
            if (c.t <= 0) {
                c.state = 'ready';
                Sfx.at('gong', this.props.potPos.x, 0, this.props.potPos.z, 0.5); Sfx.ui('pop');
                FX.pickup(this.props.potPos.x, this.y + 160, this.props.potPos.z);
            }
        }
    },
    cookTake() {
        const c = this.cook;
        if (c.state !== 'ready') return;
        c.state = 'empty';
        const p = this.props.potPos;
        Items.spawn(c.out, c.n, p.x + 60, p.z + 100, { y: this.y + 200, vy: 300 });
        c.out = null;
        Quests.event('cook', 1);
    },

    // ---------------------------------------------------------------------------------------- сон
    canSleep() {
        if (Sky.p > 0.5 || Sky.p < 0.04) return true;
        return false;
    },
    sleep(i) {
        const bag = this.props.sleeps[i];
        if (!bag || Player.sleeping || Player.dead || !Player.control) return false;
        if (!this.canSleep()) { UI.toast(Lang.t('notTired'), 'info'); return false; }
        if (this.fuelFrac() < 0.28 || !this.lit) { UI.toast(Lang.t('fireLow'), 'warn'); return false; }
        if (window.Enemies && Enemies.dangerNear(this.x, this.z, this.light.range * 0.9)) { UI.toast(Lang.t('notSafe'), 'warn'); return false; }
        // Use the built prop, including fpFind relocation and seatFit slope. The
        // pillow is local -Z; the foot of this 1.9m bag is local +Z.
        const matrix = bag.rig.root.computeWorldMatrix(true).clone();
        const point = (x, y, z) => BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(x, y, z), matrix);
        const foot = point(0, 22, 68), start = new BABYLON.Vector3(Player.x, Player.y, Player.z);
        const routes = [[foot], [point(100, 0, 100), foot], [point(-100, 0, 100), foot]];
        const route = routes.find(points => points.every((p, j) => this.sleepPathClear(j ? points[j - 1] : start, p)));
        if (!route) { UI.toast(Lang.t('sleep.blocked'), 'warn'); return false; }
        for (const p of route.slice(0, -1)) p.y = World.heightAt(p.x, p.z);
        this.sleepingIn = bag; this.sleepT = 0; this.sleepStartDay = Sky.day;
        this._sleep = { bag, matrix, foot, start, route: route.slice(), back: [start, ...route.slice(0, -1)].reverse(), phase: 'approach', t: 0, age: 0, poseK: 0, morning: false, dawnToday: Sky.p < 0.04 };
        Player.sleeping = true; Player.control = false; Player.moving = Player.sprinting = false;
        Player.vx = Player.vy = Player.vz = Player.speed = Player.jumpBuf = 0;
        Player.knock = Player.fxPose = Player._combo = Player.pendingHit = Player.actionQueued = Player.busy = Player.emoteName = null;
        Player.acting = 0; Player.endFish(false); Player.layerReset();
        Input.releaseAll();
        Player.rig.play('walk', { fade: 0.15 });
        if (Player.heldRoot) Player.heldRoot.setEnabled(false);
        if (Player.flashOn) { this._sleep.flash = true; Player.setFlash(false); }
        Game.setSleepCam(true);
        return true;
    },
    sleepPathClear(a, b) {
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 20)), tmp = { x: 0, z: 0, hit: null };
        for (let j = 1; j <= n; j++) {
            const x = U.lerp(a.x, b.x, j / n), z = U.lerp(a.z, b.z, j / n);
            const p = World.colliders.resolve(x, z, DATA.player.radius, tmp);
            if (Math.hypot(p.x - x, p.z - z) > 1) return false;
        }
        return true;
    },
    // Feet stay on the mattress during the crossfade. Compensate the imported
    // sleep clip's root travel visually; logical/save position stays at the feet.
    sleepPose(k) {
        const s = this._sleep; if (!s) return;
        const inv = Player.node.computeWorldMatrix(true).clone().invert();
        const left = BABYLON.Vector3.TransformCoordinates(Player.rig.node('FootL').getAbsolutePosition(), inv);
        const right = BABYLON.Vector3.TransformCoordinates(Player.rig.node('FootR').getAbsolutePosition(), inv);
        const feet = left.add(right).scale(0.5);
        const anchor = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(0, U.lerp(32, 46, k), 68), s.matrix);
        const shift = BABYLON.Vector3.TransformNormal(feet, s.matrix);
        Player.x = s.foot.x; Player.y = s.foot.y; Player.z = s.foot.z; Player.faceYaw = s.bag.rig.yaw;
        Player.node.position.copyFrom(anchor.subtract(shift));
        Player.node.rotationQuaternion.copyFrom(s.bag.rig.root.rotationQuaternion);
    },
    sleepWalk(dt, points) {
        if (!points.length) return true;
        const p = points[0], dx = p.x - Player.x, dz = p.z - Player.z, distance = Math.hypot(dx, dz);
        const step = Math.min(distance, DATA.player.walk * dt);
        if (distance > 0.01) {
            const a = { x: Player.x, z: Player.z }, b = { x: Player.x + dx / distance * step, z: Player.z + dz / distance * step };
            if (!this.sleepPathClear(a, b)) { this.cancelSleep(); return false; }
            Player.x = b.x; Player.z = b.z; Player.y = U.lerp(Player.y, p.y, step / distance);
            Player.faceYaw = U.dampAngle(Player.faceYaw, Math.atan2(dx, dz), 12, dt);
        }
        Player.apply();
        if (distance <= step + 0.01) points.shift();
        return points.length === 0;
    },
    sleepTick(dt) {
        const s = this._sleep;
        if (!s) return;
        if (Player.dead || !Player.sleeping) { this.cancelSleep(); return; }
        s.t += dt; s.age += dt;
        if (s.age > 0.25 && !['rise', 'stand', 'leave'].includes(s.phase) && (Input.pressed('jump') || Input.pressed('interact') || Math.hypot(Input.axis().x, Input.axis().y) > 0.15)) { this.wake(true); return; }
        if (s.phase === 'approach') {
            if (!this.sleepWalk(dt, s.route)) return;
            s.phase = 'align'; s.t = 0;
            Player.rig.play('idle', { fade: 0.2 });
        }
        if (s.phase === 'align') {
            Player.faceYaw = U.dampAngle(Player.faceYaw, s.bag.rig.yaw, 14, dt); Player.apply();
            if (s.t < 0.4) return;
            s.phase = 'sit'; s.t = 0;
            Player.rig.play('sit', { fade: 0.38, restart: true });
        }
        if (s.phase === 'sit') {
            this.sleepPose(0);
            if (s.t < 0.4) return;
            s.phase = 'lie'; s.t = 0;
            Player.rig.play('sleep', { fade: 1.05, restart: true });
        }
        if (s.phase === 'lie' || s.phase === 'rise') {
            const k = U.clamp(s.t / (s.phase === 'lie' ? 1.05 : 0.55), 0, 1);
            s.poseK = s.phase === 'lie' ? k : (1 - k) * s.riseFrom;
            this.sleepPose(s.poseK);
            if (k < 1) return;
            s.t = 0;
            if (s.phase === 'rise') {
                s.phase = 'stand'; Player.rig.play('idle', { fade: 0.4 });
            } else {
                s.phase = 'sleep'; Sky.speed = DATA.time.sleepSpeed;
                UI.toast(Lang.t('sleep.wakeHint'), 'sleep');
                const head = Player.rig.node('Head').getAbsolutePosition();
                this.zz = FX.zzz(head.x, head.y + 55, head.z);
            }
        }
        if (s.phase === 'stand') {
            this.sleepPose(0);
            if (s.t < 0.42) return;
            s.phase = 'leave'; s.t = 0; Player.apply(); Player.rig.play('walk', { fade: 0.15 });
        }
        if (s.phase === 'leave') {
            if (this.sleepWalk(dt, s.back)) {
                const morning = s.morning; this.cancelSleep();
                if (morning) {
                    UI.banner(Lang.t('goodMorning'), Lang.t('dayN', { n: Sky.day }), '#ffe8a0');
                    Sfx.ui('win'); Sfx.at('dawn', Player.x, Player.y, Player.z, 1);
                    Game.onNewDay && Game.onNewDay();
                }
            }
            return;
        }
        if (s.phase !== 'sleep') return;
        this.sleepPose(1); this.sleepT += dt;
        // Костёр гаснет — олень приходит
        if (this.fuelFrac() < 0.12 && this.sleepT > 1.0 && window.Enemies) { this.wake(true); Enemies.deerSleeperAttack(); return; }
        // A sleep started after midnight wakes this morning, not one day later.
        if ((s.dawnToday || Sky.day > this.sleepStartDay) && Sky.p >= DATA.time.dayStart - 0.01 || this.sleepT > 12) this.wake(false);
    },
    wake(forced) {
        const s = this._sleep;
        if (!s || s.phase === 'rise' || s.phase === 'stand' || s.phase === 'leave') return;
        if (s.phase === 'approach' || s.phase === 'align') { this.cancelSleep(); return; }
        s.morning = !forced; s.riseFrom = s.poseK; s.phase = 'rise'; s.t = 0;
        Sky.speed = 1;
        if (this.zz) { this.zz.dispose(); this.zz = null; }
        Player.rig.play('sit', { fade: 0.55 });
    },
    cancelSleep() {
        const s = this._sleep;
        if (!s && !this.sleepingIn) return;
        this._sleep = null; this.sleepingIn = null; this.sleepT = 0;
        Sky.speed = 1;
        if (this.zz) { this.zz.dispose(); this.zz = null; }
        Player.sleeping = false; Player.control = !Player.dead;
        Player.vx = Player.vy = Player.vz = Player.jumpBuf = 0;
        Player.knock = null; Player.onGround = true;
        Player.y = World.heightAt(Player.x, Player.z); Player.apply();
        if (!Player.dead) { Player.rig.play('idle', { fade: 0.15 }); Player.applyStance(); }
        if (Player.heldRoot) Player.heldRoot.setEnabled(true);
        if (s && s.flash && !Player.dead) Player.setFlash(true);
        Game.setSleepCam(false);
        Input.releaseAll();
    },

    // ---------------------------------------------------------------------------------------- стройка
    ghostFor(id) {
        if (this.ghost && this.ghost.id === id) return this.ghost;
        this.clearGhost();
        const d = DATA.items[id];
        const data = this.models[d.place === 'torch' ? 'torch_stand' : d.place];
        if (!data) return null;
        const rig = Rig.instance(data, this.scene, { name: 'ghost_' + id });
        for (const m of rig.meshes) { m.visibility = 0.55; m.renderOverlay = true; m.overlayColor = new BABYLON.Color3(0.2, 1, 0.3); m.overlayAlpha = 0.35; m.receiveShadows = false; }
        this.ghost = { id, rig, ok: true, name: d.place === 'torch' ? 'torch_stand' : d.place, data };
        return this.ghost;
    },
    clearGhost() { if (this.ghost) { this.ghost.rig.dispose(); this.ghost = null; } },

    // Точка под прицелом на земле
    aimPoint(maxD) {
        const c = Cam.cam.position, f = Cam.fwd;
        for (let t = 300; t < 3200; t += 40) {
            const x = c.x + f.x * t, y = c.y + f.y * t, z = c.z + f.z * t;
            if (y <= World.heightAt(x, z) + 4) {
                const dx = x - Player.x, dz = z - Player.z, d = Math.hypot(dx, dz);
                if (d > maxD) return { x: Player.x + dx / d * maxD, z: Player.z + dz / d * maxD };
                return { x, z };
            }
        }
        return { x: Player.x + Math.sin(Player.faceYaw) * 300, z: Player.z + Math.cos(Player.faceYaw) * 300 };
    },

    updatePlacing(dt) {
        const def = Player.heldDef();
        if (!def || def.type !== 'build' || Player.dead || UI.blocking()) { this.placing = null; if (this.ghost) this.clearGhost(); return; }
        this.placing = Player.heldId;
        const g = this.ghostFor(Player.heldId);
        if (!g) return;
        const p = this.aimPoint(5.5 * M);
        if (Input.pressed('reload')) this.ghostYaw += Math.PI / 4;
        const yaw = this.ghostYaw + Cam.yaw + Math.PI;
        World.seatFit(g.rig.root, g.name, g.data, p.x, p.z, yaw, {});
        // валидность: не внутри других предметов, деревьев и построек, в пределах тумана
        let ok = true;
        const tr = World.colliders.resolve(p.x, p.z, 45, { x: 0, z: 0, hit: null });
        if (tr.hit) ok = false;
        if (ok && !World.fpFree(p.x, p.z, Math.min(World.fpOf(g.name, g.data).r * 0.8, 130), { tol: 0, steep: true })) ok = false;
        if (U.dist2(p.x, p.z, World.cx, World.cz) > (World.fogRadius - 200) * (World.fogRadius - 200)) ok = false;
        if (ok !== g.ok) { g.ok = ok; for (const m of g.rig.meshes) m.overlayColor = ok ? new BABYLON.Color3(0.2, 1, 0.3) : new BABYLON.Color3(1, 0.2, 0.2); }
        if (ok && Input.pressed('attack') && Player.attackCd <= 0) {
            this.place(Player.heldId, p.x, p.z, yaw);
        }
    },

    place(id, x, z, yaw) {
        const d = DATA.items[id];
        if (!Inv.take(id, 1)) return;
        if (!Inv.current()) Player.equipCurrent();
        Player.playAction('place', 1.4); Player.attackCd = 0.4;
        const s = this.spawnStructure(d.place, x, z, yaw);
        if (window.Game) Game.autosave('build');
        Quests.event('place', 1); Quests.event('place:' + d.place, 1);
        Sfx.at('drop', x, 0, z, 1); FX.dust(x, World.heightAt(x, z), z, 6, 1);
        Cam.shake(0.08);
        return s;
    },

    spawnStructure(type, x, z, yaw) {
        const name = type === 'torch' ? 'torch_stand' : type;
        const rig = this.put(name, x, z, x, z, { yaw });
        if (!rig) return null;
        const s = { type, x, z, yaw, rig, cd: 0, hp: 100, used: false, col: null };
        if (type === 'torch') {
            const L = new BABYLON.PointLight('torchL', new BABYLON.Vector3(x, World.heightAt(x, z) + 190, z), this.scene);
            L.diffuse = new BABYLON.Color3(1, 0.62, 0.28); L.specular = new BABYLON.Color3(0.6, 0.3, 0.1); L.range = 1400; L.intensity = 0; L.renderPriority = 4;
            s.light = L;
            s.fx = FX.torch(x, World.heightAt(x, z) + 190, z);
            s.col = World.colliders.add(x, z, 24, { struct: s });
        } else if (type === 'spikes') { s.col = World.colliders.add(x, z, 60, { struct: s }); s.col.on = false; }
        else if (type === 'barricade') { s.col = World.colliders.add(x, z, 85, { struct: s }); }
        else if (type === 'beacon') { s.col = World.colliders.add(x, z, 75, { struct: s }); this.beaconPos = { x, z }; }
        this.structures.push(s);
        this._structLights();
        return s;
    },

    // Износ построек: колья, проволока и баррикады теряют прочность (hp 0..100); сломанная — пропадает, остаётся хлам.
    // Удаление откладывается до Camp.update: износ вызывается из циклов по списку построек.
    wear(s, n) {
        if (s.broken || s.hp == null) return;
        s.hp = Math.max(0, s.hp - n);
        if (s.hp <= 0) { s.broken = true; (this._breakQ = this._breakQ || []).push(s); }
    },
    breakStructure(s) {
        if (!this.structures.includes(s)) return;
        const y = World.heightAt(s.x, s.z);
        FX.poof(s.x, y + 50, s.z, false); FX.dust(s.x, y, s.z, 8, 1.2); Sfx.at('logdrop', s.x, y, s.z, 1);
        UI.toast(Lang.t('struct.broke', { n: Lang.t('item.' + s.type) }), 'warn');
        const drop = s.type === 'barricade' ? 'log' : 'bolt';
        Items.spawn(drop, 1 + (s.type === 'barricade' ? 1 : 0), s.x + (Math.random() - 0.5) * 80, s.z + (Math.random() - 0.5) * 80, { y: y + 90, vy: 300 });
        this.removeStructure(s);
    },
    // Внешний вид по износу: ниже 60% — красновато-бурый налёт
    _wearLook(s) {
        const k = s.hp < 60 ? Math.ceil((60 - s.hp) / 12) : 0;
        if (s._lk === k) return;
        s._lk = k;
        for (const m of s.rig.meshes) { m.renderOverlay = k > 0; if (k > 0) { m.overlayColor = new BABYLON.Color3(0.5, 0.14, 0.05); m.overlayAlpha = Math.min(0.5, k * 0.1); } }
    },
    // Починка: прочность до 100, ресурсы — из DATA.repair
    canRepair(s) { const c = DATA.repair[s.type]; if (!c || s.hp >= 99) return false; return Object.entries(c).every(([k, n]) => (k === 'scrap' ? this.scrap : Inv.count(k)) >= n); },
    repair(s) {
        const c = DATA.repair[s.type];
        if (!c || s.hp >= 99) return false;
        for (const [k, n] of Object.entries(c)) if ((k === 'scrap' ? this.scrap : Inv.count(k)) < n) { UI.toast(Lang.t('needMore'), 'warn'); Sfx.ui('deny'); return false; }
        for (const [k, n] of Object.entries(c)) { if (k === 'scrap') this.spendScrap(n); else Inv.take(k, n); }
        s.hp = Math.min(100, s.hp + 60); s.broken = false;
        Player.playAction('interact', 1.3);
        Sfx.at('clang', s.x, 0, s.z, 1); FX.sparkBurst(s.x, World.heightAt(s.x, s.z) + 60, s.z, 14, '#ffd070');
        UI.floatText({ x: s.x, y: World.heightAt(s.x, s.z) + 140, z: s.z }, '+60 🔧', '#9aff9a');
        if (window.Quests) Quests.event('repair', 1);
        if (!Inv.current()) Player.equipCurrent();
        return true;
    },

    removeStructure(s) {
        const i = this.structures.indexOf(s); if (i < 0) return;
        this.structures.splice(i, 1);
        if (s.rig.fp) World.fpRemove(s.rig.fp);
        s.rig.dispose();
        if (s.light) s.light.dispose();
        if (s.fx) s.fx.dispose();
        if (s.col) World.colliders.remove(s.col);
        if (s.type === 'beacon' && !(Quests.escape)) this.beaconPos = null;
    },

    // Маяк: запуск финального отсчёта — помощь прилетит через DATA.escapeNights ночей, рейды учащаются
    beaconStart(s) {
        if (Quests.escape) { UI.toast(Lang.t('beacon.left', { n: Math.max(0, DATA.escapeNights - (Sky.day - Quests.escape.day)) }), 'info'); return; }
        Quests.escape = { day: Sky.day };
        Player.playAction('interact', 1);
        Sfx.ui('fanfare'); Sfx.at('alarm', s.x, 0, s.z, 1);
        FX.ring(s.x, World.heightAt(s.x, s.z) + 30, s.z, 1400, '#6affb0'); FX.sparkBurst(s.x, World.heightAt(s.x, s.z) + 420, s.z, 60, '#6affb0');
        UI.flash('#c8ffe0', 0.5, 1.0);
        UI.banner(Lang.t('beacon.startT'), Lang.t('beacon.startS', { n: DATA.escapeNights }), '#6affb0');
        Enemies.raidT = Math.min(Enemies.raidT, 8);
        Game.autosave && Game.autosave();
    },

    // Улучшение костра — отдельная клавиша (F): E с бревном в руке кормит огонь, а не открывает окно улучшения
    openUpgrade() {
        if (Math.hypot(Player.x - this.x, Player.z - this.z, Player.y - this.y) > 4.6 * M) { UI.toast(Lang.t('fire.far'), 'info'); return false; }
        Player.playAction('interact', 1.2); UI.open('fire');
        return true;
    },
    upgradeHint() {
        if (!DATA.fire[this.level + 1]) return '';
        const k = Input.isTouch ? '🔥' : Input.padActive() ? 'D↓' : Input.label((Input.binds.upgrade || ['KeyF'])[0]);
        return '[' + k + '] ' + Lang.t('p.fireUpHint', { n: this.level + 1 });
    },

    // Из-за лимита света включаем только 3 ближайших факела
    _structLights() {
        const torches = this.structures.filter(s => s.type === 'torch').sort((a, b) => U.dist2(a.x, a.z, Player.x, Player.z) - U.dist2(b.x, b.z, Player.x, Player.z));
        torches.forEach((s, i) => { s.lit = i < 3; });
    },

    // ---------------------------------------------------------------------------------------- взаимодействия
    _registerInteractions() {
        const P = this.props, self = this;
        const add = (o) => Interact.add(o);
        if (P.storage) add({ get x() { return self.chestPos.x; }, get z() { return self.chestPos.z; }, get y() { return self.chestPos.y; },
            r: 2.4 * M, h: 100, prio: .6, text: () => Lang.t('camp.storage'),
            sub: () => Lang.t('camp.storageCount', { n: self.storageCount() }), act: () => self.openStorage() });
        // костёр
        add({ get x() { return self.x; }, get z() { return self.z; }, y: this.y, r: 2.9 * M, h: 150, prio: 1, dot: -1,
            text: () => self.heldFuel() ? Lang.t('p.feed') : (self.fuelItems().length ? Lang.t('p.feed') : Lang.t('p.fire')),
            sub: () => { const h = self.upgradeHint(); return Lang.t('fireSub', { lv: self.level, pct: Math.round(self.fuelFrac() * 100) }) + (h ? '  ·  ' + h : ''); },
            warn: () => !self.lit,
            act: () => {
                const h = self.heldFuel();
                if (h) { self.feed(h); return; }
                const list = self.fuelItems();
                if (list.length) { self.feed(list[0]); return; }
                UI.open('fire');
            } });
        // апгрейд огня отдельной кнопкой: удержание Shift+E? — через панель по клику на метку
        add({ get x() { return P.bench.x; }, get z() { return P.bench.z; }, y: this.y, r: 2.7 * M, h: 130, text: () => Lang.t('p.bench'), sub: () => Lang.t('scrapHave', { n: self.scrap }), act: () => { Player.playAction('interact', 1.2); UI.open('craft'); } });
        add({ get x() { return P.scrapper.x; }, get z() { return P.scrapper.z; }, y: this.y, r: 3.0 * M, h: 180, text: () => Lang.t('p.scrapper'),
            sub: () => { const n = Inv.scrapCarried(); return n > 0 ? Lang.t('scrapCarry', { n }) : Lang.t('scrapNone'); }, act: () => self.scrapAll() });
        add({ get x() { return P.board.x; }, get z() { return P.board.z; }, y: this.y, r: 2.8 * M, h: 170, text: () => Lang.t('p.board'), act: () => UI.open('board') });
        add({ get x() { return P.potPos.x; }, get z() { return P.potPos.z; }, y: this.y, r: 2.3 * M, h: 150,
            text: () => {
                const c = self.cook;
                if (c.state === 'ready') return Lang.t('p.cookTake');
                if (c.state === 'cooking') return Lang.t('p.cooking', { s: Math.ceil(c.t) });
                if (Player.heldId === 'steak_raw') return Lang.t('p.cookSteak');
                if (Player.heldId === 'fish_raw') return Lang.t('p.cookFish');
                if (Player.heldId === 'carrot') return Lang.t('p.cookStew');
                return Lang.t('p.pot');
            },
            sub: () => (self.cook.state === 'empty' && !['steak_raw', 'carrot', 'fish_raw'].includes(Player.heldId)) ? Lang.t('potHint') : '',
            act: () => {
                const c = self.cook;
                if (c.state === 'ready') return self.cookTake();
                if (c.state === 'cooking') return;
                if (Player.heldId === 'steak_raw') return self.cookStart('steak');
                if (Player.heldId === 'fish_raw') return self.cookStart('fish');
                if (Player.heldId === 'carrot') return self.cookStart('stew');
                UI.toast(Lang.t('potHint'), 'info');
            } });
        P.sleeps.forEach((b, i) => add({ x: b.x, z: b.z, y: this.y, r: 1.9 * M, h: 90, text: () => Lang.t('p.sleep'), sub: () => self.canSleep() ? '' : Lang.t('notTired'), act: () => self.sleep(i) }));
        // поленница
        add({ get x() { return P.pile.x; }, get z() { return P.pile.z; }, y: this.y, r: 2.2 * M, h: 100, enabled: () => self.pile > 0 || true, text: () => Lang.t('p.pile'), sub: () => Lang.t('pileLeft', { n: self.pile }),
            act: () => {
                if (self.pile <= 0) { UI.toast(Lang.t('pileEmpty'), 'warn'); return; }
                if (Inv.canAdd('log', 1) <= 0) { UI.toast(Lang.t('bagFull'), 'warn'); return; }
                self.pile--; Inv.add('log', 1); UI.pickupFeed('log', 1); Sfx.ui('pickup'); Player.playAction('pickup', 1.4);
            } });
        // построенные предметы: забрать
        Interact.providers.push((consider) => {
            for (const s of self.structures) {
                if (s.type === 'beacon') {
                    if (!s._e) s._e = { x: s.x, z: s.z, r: 2.8 * M, h: 380, prio: 1, text: () => Lang.t(Quests.escape ? 'beacon.on' : 'beacon.start'),
                        sub: () => Quests.escape ? Lang.t('beacon.left', { n: Math.max(0, DATA.escapeNights - (Sky.day - Quests.escape.day)) }) : Lang.t('beacon.hint'),
                        act: () => self.beaconStart(s) };
                    consider(s._e); continue;
                }
                if (!s._e) s._e = { x: s.x, z: s.z, r: 1.5 * M, h: 120, text: () => Lang.t('p.pickStruct'), act: () => { self.removeStructure(s); Inv.add(s.type === 'torch' ? 'torch' : s.type, 1); Sfx.ui('pickup'); } };
                // починка: повреждённые колья, проволока и баррикады
                if (DATA.repair[s.type] && s.hp < 99 && !s.broken) {
                    if (!s._r) s._r = { x: s.x, z: s.z, r: 1.9 * M, h: 130, prio: 0.4, dot: -1,
                        text: () => Lang.t('p.repair', { n: Lang.t('item.' + s.type), hp: Math.round(s.hp) }),
                        sub: () => Object.entries(DATA.repair[s.type]).map(([k, n]) => (k === 'scrap' ? '🔩' : Lang.t('item.' + k) + ' ') + n).join('  '),
                        warn: () => !self.canRepair(s), act: () => self.repair(s) };
                    consider(s._r);
                }
                if (s.type === 'spikes' || s.type === 'wire') continue;
                consider(s._e);
            }
        });
    },

    // ---------------------------------------------------------------------------------------- кадр
    isSafe(x, z, pad) {
        if (!this.lit) return false;
        const r = DATA.fire[this.level].light * M * 0.85 * Math.sqrt(Math.max(0.15, this.fuelFrac())) + (pad || 0);
        return U.dist2(x, z, this.x, this.z) < r * r;
    },
    safeRadius() { return DATA.fire[this.level].light * M * 0.85 * Math.sqrt(Math.max(0.15, this.fuelFrac())); },

    update(dt) {
        const lid = this.props.storage && this.props.storage.node('lid');
        if (lid) {
            this._storageLid = U.damp(this._storageLid || 0, window.UIPanels && UIPanels.cur === 'campchest' ? -1.9 : 0, 8, dt);
            lid.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, this._storageLid);
        }
        // топливо: горит по игровому времени (быстрее во сне)
        const gt = dt * Sky.speed;
        if (this.lit) {
            this.fuel = Math.max(0, this.fuel - this.burn * gt * (Sky.speed > 10 ? 0.55 : 1));
            if (this.fuel <= 0) { this.lit = false; this.pulse = 0; UI.toast(Lang.t('fireOut'), 'warn'); Sfx.at('sizzle', this.x, 0, this.z, 1); FX.dust(this.x, this.y + 60, this.z, 10, 1.6); }
        }
        // предупреждения
        const fr = this.fuelFrac();
        if (this.lit && fr < 0.22) { this._fuelWarn -= dt; if (this._fuelWarn <= 0) { this._fuelWarn = 22; UI.toast(Lang.t('fireLowWarn'), 'warn'); } }
        // свет и пламя
        this.flick += dt;
        const noise = 0.86 + 0.09 * Math.sin(this.flick * 13.1) + 0.06 * Math.sin(this.flick * 23.7 + 1.3) + 0.04 * Math.sin(this.flick * 41.3);
        this.pulse = Math.max(0, this.pulse - dt * 1.6);
        const k = this.lit ? Math.min(1, 0.32 + fr * 0.95) : 0;
        this.light.intensity = this.lightBase * k * noise + this.pulse * 2.6;
        this.light.position.y = this.y + 110 + 30 * k;
        if (this.fireFx) this.fireFx.setLevel(this.lit ? 0.25 + 0.75 * Math.min(1, fr * 1.4) : 0.0);
        // шестерни скраппера
        if (this.gearSpin > 0) {
            this.gearSpin -= dt;
            const sc = this.props.scrapper;
            const g1 = sc.node('gear1'), g2 = sc.node('gear2');
            if (g1) g1.rotation.z += dt * 9; if (g2) g2.rotation.z -= dt * 12;
        }
        this.cookTick(dt);
        this.sleepTick(dt);
        this.updatePlacing(dt);
        // структуры: ближние факелы
        this._sT = (this._sT || 0) - dt;
        if (this._sT <= 0) { this._sT = 0.4; this._structLights(); }
        for (const s of this.structures) {
            if (s.type === 'torch' && s.light) s.light.intensity = U.damp(s.light.intensity, s.lit ? 1.5 * (0.88 + 0.12 * Math.sin(this.flick * 15 + s.x)) : 0, 6, dt);
            if (s.cd > 0) s.cd -= dt;
            if (s.hp < 100 && s.type !== 'torch' && s.type !== 'beacon') this._wearLook(s);
        }
        if (this._breakQ && this._breakQ.length) { const q = this._breakQ; this._breakQ = []; for (const s of q) this.breakStructure(s); }
        // фонарные столбы: мягкий свет на ночь (эмиссия материала и ореол)
        const night = Sky.night;
        for (const l of this.props.lamps || []) {
            const ms = l.materials.get('glow_lantern');
            if (ms) for (const m of ms) m.emissiveColor = new BABYLON.Color3(1, 0.78, 0.4).scale(0.5 + 0.5 * night);
        }
        // метка костра над огнём
        const d = Math.hypot(Player.x - this.x, Player.z - this.z);
        if (d < 18 * M && !UI.blocking()) UI.fireTag({ x: this.x, y: this.y + 260 + 40 * this.level, z: this.z, level: this.level, frac: this.lit ? fr : 0 });
        else UI.fireTag(null);
    },

    // День начался: пополнение поленницы
    newDay() { this.pile = Math.min(4, this.pile + 1); },

    state() { return { level: this.level, fuel: Math.round(this.fuel * 10) / 10, lit: this.lit, scrap: this.scrap, pile: this.pile, storage: this.storage.map(s => Object.assign({}, s)), cook: Object.assign({}, this.cook), structs: this.structures.map(s => ({ t: s.type, x: Math.round(s.x), z: Math.round(s.z), y: +s.yaw.toFixed(3), hp: Math.round(s.hp), u: s.used ? 1 : 0 })) }; },
    load(s) {
        this.cancelSleep();
        if (!s) return;
        this.storage = [];
        for (const entry of (Array.isArray(s.storage) ? s.storage : []).slice(0, 2048)) {
            if (entry && Number.isSafeInteger(entry.n) && entry.n > 0) this.storeItems(entry.id, entry.n, entry.lv, entry.mag);
        }
        this.setLevel(s.level || 1, true);
        this.fuel = s.fuel != null ? s.fuel : this.cap; this.lit = s.lit !== false && this.fuel > 0; this.scrap = s.scrap || 0; this.pile = s.pile != null ? s.pile : 3;
        this.drawSign();
        for (const st of this.structures.slice()) this.removeStructure(st);
        for (const t of s.structs || []) { const st = this.spawnStructure(t.t, t.x, t.z, t.y); if (st && t.hp != null) st.hp = t.hp; }
        this.cook = Object.assign({ state: 'empty', t: 0, out: null }, s.cook || {});
        if (this.cook.state === 'cooking' && !this.cook.out) this.cook = { state: 'empty', t: 0, out: null };
    },
    reset() {
        this.cancelSleep();
        for (const st of this.structures.slice()) this.removeStructure(st);
        this.scrap = 0; this.pile = 3; this.cook = { state: 'empty', t: 0, out: null };
        this.storage = []; this._storageLid = 0;
        this.setLevel(1, true); this.fuel = this.cap; this.lit = true; this.drawSign();
    },
};

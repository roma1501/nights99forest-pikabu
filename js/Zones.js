// Zones.js — места интереса и добыча. Всё строится ЛЕНИВО: кольцо зоны k открывается уровнем костра k+1
// (openLevel), снаружи тумана ничего не существует — ни клеток, ни сундуков, ни хлама.
// Точки — маркеры карты (kid-*, den-*, cave-bear, poi-*), случайная добыча — по сиду кольца.

/** @type {Record<string, any>} */
const Zones = {
    scene: null, view: null, models: {}, props: [], chests: [], kids: [], crops: [], piles: [], wells: [], openedChests: [],
    sites: [], ringDone: [], lootSpots: [], lootSpecial: [], _cols: [], _extra: [],
    berryDay: 0, loc: null,

    async init(app, view) {
        this.view = view; this.scene = view.scene;
        const names = ['cage', 'cave', 'totem', 'altar', 'cultist_tent', 'wreck_car', 'bones', 'signpost', 'grave', 'crate', 'barrel', 'boulder', 'cabin',
            'well', 'sawmill', 'ruins', 'watchtower', 'mine', 'ore_vein', 'obelisk', 'carrot_plant', 'carrot_plant_b', 'carrot_plant_c', 'crypt', 'trader_wagon', 'airdrop', 'reeds', 'reeds_b', 'reeds_c'];
        await Promise.all(names.map(async (n) => { try { this.models[n] = await Rig.load('assets/models/' + n + '.glb'); } catch (e) { /* модель ещё не сделана — место без неё */ } }));
        for (const k of ['kid_dino', 'kid_kraken', 'kid_squid', 'kid_koala']) {
            try { this.models[k] = await Rig.load('assets/models/' + k + '.glb'); if (Player.data) Rig.borrowAnims(this.models[k], Player.data); } catch (e) { /* нет */ }
        }
        this._registerInteractions();
    },

    prop(name, x, z, yaw, o) {
        const data = this.models[name] || Camp.models[name];
        if (!data) return null;
        const opts = o || {};
        const f = World.fpOf(name, data), sc = opts.scale || 1, R = f.r * sc;
        // free: предмет сам ищет ближайшее свободное место (не на деревьях, камнях, других предметах и крутом склоне)
        if (opts.free) {
            const fo = { maxR: opts.maxR || Math.max(R * 7, 500), water: opts.water, inside: opts.inside };
            // важные предметы (сундуки): не нашлось ровного места — ищем и на склоне, в крайнем случае остаются где были
            const p = World.fpFind(x, z, R, fo) || (opts.force ? World.fpFind(x, z, R, Object.assign({ steep: true }, fo)) || { x, z } : null);
            if (!p) return null;
            x = p.x; z = p.z;
        }
        const rig = Rig.instance(data, this.scene, { name, materials: opts.materials, bake: true });
        World.seatFit(rig.root, name, data, x, z, yaw || 0, { scale: sc, lift: opts.h, embed: opts.embed });
        if (opts.scale) rig.root.scaling.setAll(opts.scale);
        rig.shadowRec = World.trackShadow(rig, x, z, 4600);
        rig.x = x; rig.z = z;
        World.fpAdd(x, z, R, 'zone', R > 260);
        this.props.push(rig);
        // камыши — чистый декор: прореживаются вместе с кустами и травой по качеству графики
        if (/^reeds/.test(name)) { rig.decorKey = World.hash01(x, z, 17); rig.root.setEnabled(rig.decorKey < World.keep); }
        if (opts.col) for (const [dx, dz, r] of opts.col) {
            const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
            this._cols.push(World.colliders.add(x + dx * M * c + dz * M * s, z - dx * M * s + dz * M * c, r * M * (opts.scale || 1), { prop: 1 }));
        }
        return rig;
    },

    // ---------------------------------------------------------------------------------------- подготовка и открытие зон
    // Из маркеров карты — список мест; ничего не строится
    prepare(loc) {
        this.loc = loc;
        this.sites = [];
        const cx = World.cx, cz = World.cz;
        const count = {};
        for (const m of loc.markers()) {
            if (!/^(kid-|den-|cave-|poi-)/.test(m.name)) continue;
            const n = count[m.name] = (count[m.name] || 0) + 1;
            const d = Math.hypot(m.x - cx, m.y - cz) / M;
            this.sites.push({ name: m.name, x: m.x, z: m.y, d, ring: World.zoneIndexAt(m.x, m.y), n, id: m.name + '#' + n, built: false });
        }
        this.sites.sort((a, b) => a.d - b.d);
    },

    siteById(id) { return this.sites.find(s => s.id === id || s.name === id) || null; },
    sitesByName(name) { return this.sites.filter(s => s.name === name); },

    // Открыть все кольца до уровня костра level (1..5). fresh — новая игра: разложить добычу на землю
    openLevel(level, fresh) {
        for (let k = 0; k < Math.min(level, DATA.zones.length); k++) this.openRing(k, fresh);
    },
    openRing(k, fresh) {
        if (this.ringDone[k]) return false;
        this.ringDone[k] = true;
        const rnd = U.rng(707 + k * 131);
        for (const s of this.sites) if (s.ring === k && !s.built) { s.built = true; this.buildSite(s, rnd); }
        this.fillRing(k, rnd, fresh);
        // добыча кольца: новая игра — сразу на землю; загрузка — предметы придут из сохранения
        if (fresh) this.spawnLoot(k);
        return true;
    },

    // Качество графики сменилось: декор зон (камыши) показывается в той же доле, что деревья и кусты
    applyDecor() { for (const rig of this.props) if (rig.decorKey != null) rig.root.setEnabled(rig.decorKey < World.keep); },

    // Убрать всё построенное (новая игра после сброса): модели, коллайдеры, сундуки, дети, хлам
    clearAll() {
        for (const rig of this.props) { if (rig.shadowRec) World.untrackShadow(rig.shadowRec); try { rig.dispose(); } catch (e) { /* уже убрано */ } }
        for (const k of this.kids) { if (k.rig) { if (k.shadowRec) World.untrackShadow(k.shadowRec); try { k.rig.dispose(); } catch (e) { /* ok */ } } }
        for (const c of this._cols) World.colliders.remove(c);
        for (const m of this._extra) { try { m.dispose(); } catch (e) { /* ok */ } }
        this.props = []; this.kids = []; this.chests = []; this.crops = []; this.piles = []; this.wells = []; this._cols = []; this._extra = [];
        this.openedChests = []; this.lootSpots = []; this.lootSpecial = []; this.ringDone = [];
        World.fpClear('zone');
        for (const s of this.sites) s.built = false;
    },

    // ---------------------------------------------------------------------------------------- места
    // Стабильный id объекта места: не зависит от позиции (она подбирается по свободному месту), поэтому годится для сохранений
    _uid(kind) { this._uidN[kind] = (this._uidN[kind] || 0) + 1; return this._siteKey + ':' + kind + this._uidN[kind]; },
    buildSite(s, rnd) {
        const face = (x, z) => Math.atan2(World.cx - x, World.cz - z);
        const x = s.x, z = s.z, n = s.name;
        this._siteKey = n + '@' + Math.round(x) + ',' + Math.round(z); this._uidN = {};
        if (/^kid-/.test(n)) {
            const k = DATA.kids.find(q => q.marker === n);
            if (k) this.buildKid(k, x, z, face(x, z));
        } else if (n === 'den-wolf') this.den(x, z, rnd, 'wolf');
        else if (n === 'den-alpha') this.den(x, z, rnd, 'alpha');
        else if (n === 'cave-bear') {
            this.prop('cave', x, z, face(x, z) + Math.PI, { scale: 1.4, col: [[-3.4, 0, 1.6], [3.4, 0, 1.6], [0, 3.6, 3.2], [-2, 3, 2.4], [2, 3, 2.4]] });
            this.prop('bones', x + 400, z - 350, rnd() * 6.28, { free: true }); this.prop('bones', x - 500, z - 200, rnd() * 6.28, { free: true });
        } else if (n === 'poi-cultist') this.cultistCamp(x, z, rnd);
        else if (n === 'poi-cabin') {
            const yaw = face(x, z) + (rnd() - 0.5) * 0.4;
            this.prop('cabin', x, z, yaw, { r: 260, col: [[-2.2, -1.9, 1.3], [0, -1.9, 1.3], [2.2, -1.9, 1.3], [-2.2, 1.9, 1.3], [2.2, 1.9, 1.3], [-2.9, 0, 1.0], [2.9, 0, 1.0]] });
            this.addChest(x + 260, z + 130, 0, true, 200 + s.ring * 10 + s.n);
            this.scrapCluster(x - 200, z - 350, rnd, 4);
            this.lootSpecial.push({ id: 'bandage', x: x - 150, z: z + 100 });
        } else if (n === 'poi-campsite') this.campsite(x, z, rnd, s);
        else if (n === 'poi-carrots') this.farm(x, z, rnd);
        else if (n === 'poi-pond') this.pond(x, z, rnd);
        else if (n === 'poi-well') { const r = this.prop('well', x, z, rnd() * 6.28, { r: 120, col: [[0, 0, 0.9]] }); if (r) this.wells.push({ x, z, rig: r, last: -1 }); else this.wells.push({ x, z, rig: null, last: -1 }); }
        else if (n === 'poi-sawmill') this.sawmill(x, z, rnd, s);
        else if (n === 'poi-ruins') this.ruins(x, z, rnd, s);
        else if (n === 'poi-watchtower') {
            this.prop('watchtower', x, z, face(x, z), { r: 220, col: [[-1.3, -1.3, 0.6], [1.3, -1.3, 0.6], [-1.3, 1.3, 0.6], [1.3, 1.3, 0.6]] });
            this.addChest(x + 320, z - 120, 0, true, 300 + s.n); this.scrapCluster(x, z + 500, rnd, 4);
        } else if (n === 'poi-graveyard') this.graveyard(x, z, rnd, s);
        else if (n === 'poi-mine') this.mine(x, z, rnd, s);
        else if (n === 'poi-obelisk') this.obelisk(x, z, rnd);
        // записка рядом с местом (если ещё не найдена в этой партии)
        if (typeof Lore !== 'undefined') { try { Lore.onSite(s, x, z); } catch (e) { console.warn('Lore.onSite:', e); } }
    },

    // Случайная точка кольца k вне мест интереса
    ringPoint(rnd, k, pad) {
        const Z = DATA.zones[k], r0 = (k === 0 ? 16 : Z.r0 + 2) * M, r1 = Math.min(Z.r1 - 2, 196) * M;
        for (let t = 0; t < 40; t++) {
            const a = rnd() * 6.283, r = Math.sqrt(rnd() * (r1 * r1 - r0 * r0) + r0 * r0);
            const x = World.cx + Math.cos(a) * r, z = World.cz + Math.sin(a) * r;
            if (!World.nearClear(x, z, pad == null ? 350 : pad)) return { x, z };
        }
        return U.ringPoint(rnd, World.cx, World.cz, r0, r1);
    },

    // Добыча кольца: ржавые машины, могилы, указатели, хлам, сундуки
    fillRing(k, rnd, fresh) {
        const cnt = [{ car: 1, sign: 1, grave: 0, scrap: 8, chest: 4 }, { car: 1, sign: 1, grave: 0, scrap: 8, chest: 5 }, { car: 1, sign: 1, grave: 2, scrap: 9, chest: 6 },
            { car: 1, sign: 1, grave: 2, scrap: 10, chest: 7 }, { car: 2, sign: 2, grave: 3, scrap: 14, chest: 12 }][k];
        for (let i = 0; i < cnt.car; i++) { const p = this.ringPoint(rnd, k); this.prop('wreck_car', p.x, p.z, rnd() * 6.28, { col: [[-1, 0, 0.9], [1, 0, 0.9]], free: true }); this.scrapCluster(p.x, p.z, rnd, 5); }
        for (let i = 0; i < cnt.grave; i++) { const p = this.ringPoint(rnd, k); this.prop('grave', p.x, p.z, rnd() * 6.28, { free: true }); this.prop('grave', p.x + 300, p.z + 80, rnd() * 6.28, { free: true }); }
        for (let i = 0; i < cnt.sign; i++) { const p = this.ringPoint(rnd, k); this.prop('signpost', p.x, p.z, rnd() * 6.28, { col: [[0, 0, 0.2]], free: true }); }
        for (let i = 0; i < cnt.scrap; i++) { const p = this.ringPoint(rnd, k); this.scrapCluster(p.x, p.z, rnd, 2 + Math.floor(rnd() * 3)); }
        for (let i = 0; i < cnt.chest; i++) {
            const p = this.ringPoint(rnd, k);
            const gold = k >= 2 && rnd() < 0.3 + 0.12 * (k - 2);
            this.addChest(p.x, p.z, rnd() * 6.28, gold, k * 1000 + i);
        }
    },

    scrapCluster(x, z, rnd, n) { this.lootSpots.push([x, z, n, Math.floor(rnd() * 1e9)]); },
    // Разложить хлам кольца по лесу (новая игра; при загрузке предметы берутся из сохранения)
    spawnLoot(k) {
        const ids = ['bolt', 'bolt', 'sheet', 'fan', 'radio', 'tire', 'bolt', 'sheet', 'engine'];
        const spots = this.lootSpots.filter(s => !s.done && World.zoneIndexAt(s[0], s[1]) === k);
        for (const sp of spots) {
            sp.done = true;
            const [x, z, n, seed] = sp;
            const rnd = U.rng(seed);
            for (let i = 0; i < n; i++) {
                const a = rnd() * 6.28, r = 80 + rnd() * 240;
                const it = Items.spawn(ids[Math.floor(rnd() * ids.length)], 1, x + Math.cos(a) * r, z + Math.sin(a) * r, { pop: false });
                it.ground = true; it.noPickup = 0; it.root.position.y = World.heightAt(it.x, it.z) + 14; it.spin = rnd() * 6;
            }
        }
        const sp2 = this.lootSpecial.filter(s => !s.done && World.zoneIndexAt(s.x, s.z) === k);
        for (const s of sp2) { s.done = true; const it = Items.spawn(s.id, 1, s.x, s.z, { pop: false }); it.ground = true; it.noPickup = 0; }
    },

    den(x, z, rnd, kind) {
        for (let i = 0; i < 5; i++) { const a = rnd() * 6.28, r = 300 + rnd() * 500; this.prop('bones', x + Math.cos(a) * r, z + Math.sin(a) * r, rnd() * 6.28, { free: true }); }
        for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + rnd() * 0.4; const r = 1000 + rnd() * 250; this.prop('boulder', x + Math.cos(a) * r, z + Math.sin(a) * r, rnd() * 6.28, { scale: 0.9 + rnd() * 0.6, col: [[0, 0, 1.6]], free: true }); }
        if (kind === 'alpha') { for (let i = 0; i < 4; i++) { const a = rnd() * 6.28; this.prop('grave', x + Math.cos(a) * 700, z + Math.sin(a) * 700, rnd() * 6.28, { free: true }); } }
    },

    cultistCamp(x, z, rnd) {
        this.prop('altar', x, z, 0, { col: [[0, 0, 1.0]] });
        this.prop('totem', x + 450, z - 250, 0.4, { col: [[0, 0, 0.5]] });
        this.prop('totem', x - 450, z - 250, -0.4, { col: [[0, 0, 0.5]] });
        for (let i = 0; i < 3; i++) { const a = (i - 1) * 0.9 + Math.PI / 2; this.prop('cultist_tent', x + Math.cos(a) * 1100, z + Math.sin(a) * 1100, a + Math.PI, { col: [[0, 0, 1.8]] }); }
        for (let i = 0; i < 6; i++) { const a = rnd() * 6.28; this.prop('crate', x + Math.cos(a) * 800, z + Math.sin(a) * 800, rnd() * 6.28, { col: [[0, 0, 0.5]], free: true }); }
    },

    // Заброшенный лагерь: палатки, ящики, сундук, хлам
    campsite(x, z, rnd, s) {
        const face = Math.atan2(World.cx - x, World.cz - z);
        for (let i = 0; i < 2; i++) { const a = face + (i ? 1 : -1) * 0.9; const tx = x + Math.sin(a) * 420, tz = z + Math.cos(a) * 420; const t = Camp.put('tent_a', tx, tz, x, z, { materials: { tent: i ? '#7d8a4a' : '#a86a3a' }, fpTag: 'zone', free: true, maxR: 500 }); if (t) { this.props.push(t); this._cols.push(World.colliders.add(t.x, t.z, 1.3 * M, { prop: 1 })); } }
        this.prop('log_pile', x + Math.sin(face + Math.PI) * 330, z + Math.cos(face + Math.PI) * 330, 0.5, { free: true });
        for (let i = 0; i < 3; i++) { const a = rnd() * 6.28; this.prop('crate', x + Math.cos(a) * 240, z + Math.sin(a) * 240, rnd() * 6.28, { col: [[0, 0, 0.5]], free: true }); }
        this.prop('barrel', x - 180, z + 120, 1.0, { col: [[0, 0, 0.5]], free: true });
        this.addChest(x + 40, z + 260, rnd() * 6.28, false, 400 + s.n);
        this.scrapCluster(x, z, rnd, 3);
        this.lootSpecial.push({ id: 'carrot', x: x - 100, z: z - 120 });
    },

    // Огород у лагеря: грядки морковки, растёт заново каждый день
    farm(x, z, rnd) {
        const yaw = Math.atan2(World.cx - x, World.cz - z), c = Math.cos(yaw), s = Math.sin(yaw);
        for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) {
            const lx = (i - 2.5) * 120, lz = (row - 1) * 150;
            const px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
            const rig = this.prop(['carrot_plant', 'carrot_plant_b', 'carrot_plant_c'][(row+i)%3], px, pz, rnd() * 6.28, { r: 40 });
            this.crops.push({ x: px, z: pz, rig, ready: true, cool: 0, uid: this._uid('c') });
        }
        // загородка из кольев
        const fence = Camp.models.fence;
        if (fence) for (const lz of [-235, 235]) for (const lx of [-250, 0, 250]) { const f = Camp.put('fence', x + lx * c + lz * s, z - lx * s + lz * c, 0, 0, { yaw: yaw, fpTag: 'zone' }); if (f) this.props.push(f); }
    },

    pond(x, z, rnd) {
        // уровень воды — на 22 px ниже бровки; дно выкопано в World._flattenSpots
        const y = World.heightAt(x + 700, z) - 10;
        const disc = BABYLON.MeshBuilder.CreateDisc('pond', { radius: 640, tessellation: 48 }, this.scene);
        disc.rotation.x = Math.PI / 2; disc.position.set(x, World.pondLevel != null ? World.pondLevel : y, z);
        const mat = new BABYLON.StandardMaterial('pondMat', this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.16, 0.42, 0.52); mat.specularColor = new BABYLON.Color3(0.7, 0.8, 0.9); mat.specularPower = 90;
        mat.emissiveColor = new BABYLON.Color3(0.03, 0.09, 0.12); mat.alpha = 0.78; mat.backFaceCulling = false; mat.metadata = { toon: false, mist: false };
        mat.maxSimultaneousLights = 8;
        disc.material = mat; disc.isPickable = false; disc.receiveShadows = false; disc.renderingGroupId = 0; disc.alwaysSelectAsActiveMesh = true;
        this._extra.push(disc); this.pondDisc = disc;
        this._cols.push(World.colliders.add(x, z, 560, { water: 1 }));
        for (let i = 0; i < 14; i++) { const a = rnd() * 6.283, r = 620 + rnd() * 140; this.prop(['reeds', 'reeds_b', 'reeds_c'][i%3], x + Math.cos(a) * r, z + Math.sin(a) * r, rnd() * 6.28, { free: true, water: true, maxR: 160 }); }
        this.ponds = this.ponds || []; this.ponds.push({ x, z, r: 640 });
    },

    sawmill(x, z, rnd, s) {
        const face = Math.atan2(World.cx - x, World.cz - z);
        this.prop('sawmill', x, z, face, { r: 240, col: [[-1.4, -0.4, 1.2], [1.4, -0.4, 1.2], [0, 1.4, 1.0]] });
        for (let i = 0; i < 3; i++) {
            const a = face + 1.2 + i * 0.5, px = x + Math.sin(a) * 620, pz = z + Math.cos(a) * 620;
            const rig = this.prop('log_pile', px, pz, rnd() * 6.28, { col: [[0, 0, 0.7]], free: true });
            if (rig) this.piles.push({ x: rig.x, z: rig.z, rig, stock: 6, day: 0, uid: this._uid('p') });
        }
        this.addChest(x - 300, z + 380, rnd() * 6.28, true, 500 + s.n);
        this.scrapCluster(x + 300, z - 400, rnd, 4);
    },

    ruins(x, z, rnd, s) {
        this.prop('ruins', x, z, rnd() * 6.28, { r: 420, col: [[-3.0, -1.0, 1.4], [3.0, -1.0, 1.4], [0, -3.0, 1.4], [-2, 2.6, 1.2], [2, 2.6, 1.2]] });
        this.addChest(x + 100, z + 140, 0.4, true, 600 + s.n); this.addChest(x - 420, z - 260, 2.2, false, 650 + s.n);
        for (let i = 0; i < 4; i++) { const a = rnd() * 6.28; this.prop('crate', x + Math.cos(a) * 640, z + Math.sin(a) * 640, rnd() * 6.28, { col: [[0, 0, 0.5]], free: true }); }
        this.scrapCluster(x + 400, z + 300, rnd, 5);
    },

    graveyard(x, z, rnd, s) {
        for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) this.prop('grave', x + (i - 2) * 300 + (rnd() - 0.5) * 50, z + (row - 1) * 340 + (rnd() - 0.5) * 50, (rnd() - 0.5) * 0.3);
        this.prop('crypt', x, z - 860, Math.atan2(World.cx - x, World.cz - z) + Math.PI, { r: 240, col: [[-1.4, 0, 1.2], [1.4, 0, 1.2], [0, -1.2, 1.4]] });
        this.addChest(x + 80, z - 530, 0, true, 700 + s.n);
        for (let i = 0; i < 4; i++) { const a = rnd() * 6.28; this.prop('bones', x + Math.cos(a) * 850, z + Math.sin(a) * 850, rnd() * 6.28, { free: true }); }
        this.scrapCluster(x + 500, z + 400, rnd, 3);
    },

    mine(x, z, rnd, s) {
        const face = Math.atan2(World.cx - x, World.cz - z);
        this.prop('mine', x, z, face, { r: 260, col: [[-1.8, 0, 1.4], [1.8, 0, 1.4], [0, 1.6, 1.6]] });
        for (let i = 0; i < 3; i++) { const a = rnd() * 6.28; this.prop('crate', x + Math.cos(a) * 560, z + Math.sin(a) * 560, rnd() * 6.28, { col: [[0, 0, 0.5]], free: true }); }
        this.addChest(x + 240, z - 330, 0.6, true, 800 + s.n);
        this.scrapCluster(x - 300, z - 380, rnd, 5);
        // рудные жилы (кирка): камни с жилами, дают самоцветы и лом
        this.ores = this.ores || [];
        for (let i = 0; i < 5; i++) {
            const a = rnd() * 6.283, r = 700 + rnd() * 450, ox = x + Math.cos(a) * r, oz = z + Math.sin(a) * r;
            const rig = this.prop('ore_vein', ox, oz, rnd() * 6.28, { scale: 0.55, col: [[0, 0, 0.9]], free: true });
            if (rig) this.ores.push({ x: rig.x, z: rig.z, rig, hp: 4, maxHp: 4, day: 0, uid: this._uid('o') });
        }
    },

    obelisk(x, z, rnd) {
        this.prop('obelisk', x, z, 0, { r: 160, col: [[0, 0, 1.0]] });
        for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + 0.4; this.prop('totem', x + Math.cos(a) * 620, z + Math.sin(a) * 620, a, { col: [[0, 0, 0.5]] }); }
        this.obeliskPos = { x, z };
    },

    // ---------------------------------------------------------------------------------------- дети
    buildKid(k, x, z, yaw) {
        const cage = this.prop('cage', x, z, yaw, { col: [[-1.5, -1.5, 0.3], [1.5, -1.5, 0.3], [-1.5, 1.5, 0.3], [1.5, 1.5, 0.3], [0, 1.5, 0.6], [-1.5, 0, 0.6], [1.5, 0, 0.6], [-1.0, -1.5, 0.3], [1.0, -1.5, 0.3]] });
        const keyCol = { key_red: '#ff4a4a', key_blue: '#4a8cff', key_green: '#4aff7a', key_yellow: '#ffd84a' }[k.key];
        if (cage) { const lock = cage.materials.get('keycolor'); if (lock) for (const m of lock) Rig.recolor(m, keyCol); }
        const data = this.models['kid_' + k.id];
        let rig = null, kidShadow = null;
        if (data) {
            rig = Rig.instance(data, this.scene, { name: 'kid_' + k.id, scale: 0.78, merge: true });
            kidShadow = World.trackShadow(rig, x, z, 5200);
            rig.root.position.set(x, World.heightAt(x, z) + 20, z);
            rig.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(0, yaw, 0);
            rig.play('sit_cry');
        }
        const kid = { def: k, cage, rig, x, z, yaw, cx0: x, cz0: z, yaw0: yaw, shadowRec: kidShadow, state: 'caged', rescued: false, t: 0, seat: 0, vx: 0, vz: 0, walk: 0 };
        this.kids.push(kid);
        return kid;
    },

    kidByIndex(i) { return this.kids.find(k => k.def.id === DATA.kids[i].id); },

    tryUnlock(kid) {
        const k = kid.def;
        if (Inv.count(k.key) < 1) { UI.toast(Lang.t('needKey', { key: Lang.t('item.' + k.key) }), 'warn'); Sfx.ui('deny'); Player.playAction('interact', 1.2); return; }
        Inv.take(k.key, 1);
        if (!Inv.current()) Player.equipCurrent();
        Player.playAction('interact', 1);
        Sfx.at('unlock', kid.x, 0, kid.z, 1); Sfx.at('gate', kid.x, 0, kid.z, 1);
        // дверь распахивается
        const door = kid.cage && kid.cage.node('door');
        if (door) Tween.to(0.9, (t) => { door.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, -1.9 * U.easeOutBack(t)); }, { delay: 0.35 });
        // Commit rescue with key consumption; saving during the door animation
        // must not leave a locked child after consuming the only key.
        this.rescue(kid);
    },

    rescue(kid) {
        kid.state = 'follow'; kid.rescued = true;
        if (kid.rig) { kid.rig.play('cheer'); }
        FX.sparkBurst(kid.x, World.heightAt(kid.x, kid.z) + 160, kid.z, 40, '#ffe066'); FX.ring(kid.x, World.heightAt(kid.x, kid.z) + 20, kid.z, 800, '#ffe066');
        Sfx.ui('rescue'); Sfx.ui('fanfare');
        UI.flash('#fff4c0', 0.5, 1.0);
        UI.banner(Lang.t('kidSaved', { n: Lang.t('kid.' + kid.def.id) }), Lang.t('kidSavedSub'), kid.def.color);
        Cam.shake(0.2);
        Player.stats.kids = (Player.stats.kids || 0) + 1;
        UI.objectiveEvent('kid');
        if (typeof Quests !== 'undefined') Quests.event('kid', 1);
        if (Game.track) Game.track('kid_rescued', { count: this.rescuedCount(), day: Sky.day });
        if (typeof Econ !== 'undefined') Econ.dropCoins(kid.x, kid.z, 60, 'kid');
        if (Game.autosave) Game.autosave();
        setTimeout(() => { if (kid.rig && kid.state === 'follow') kid.rig.play('run'); }, 1600);
    },

    rescuedCount() { return this.kids.filter(k => k.rescued).length; },

    updateKids(dt) {
        for (const kid of this.kids) {
            if (!kid.rig) continue;
            kid.t += dt;
            if (kid.state === 'caged') { kid.rig.update(dt); continue; }
            const rig = kid.rig;
            let tx, tz, speed = 0;
            if (kid.state === 'follow') {
                tx = Player.x - Math.sin(Player.faceYaw) * 200 + Math.sin(kid.def.id.length) * 100; tz = Player.z - Math.cos(Player.faceYaw) * 200;
                const d = Math.hypot(tx - kid.x, tz - kid.z);
                speed = d > 800 ? 7.2 * M : d > 260 ? 4.6 * M : 0;
                if (Camp.isSafe(kid.x, kid.z, -300) && Math.hypot(kid.x - Camp.x, kid.z - Camp.z) < Camp.safeRadius() * 0.7) { kid.state = 'camp'; this.assignSeat(kid); if (Game.onKidHome) Game.onKidHome(kid); }
            } else {
                // лагерь: идёт к своему месту
                const a = kid.seatAngle, r = 3.4 * M;
                tx = Camp.x + Math.cos(a) * r; tz = Camp.z + Math.sin(a) * r;
                const d = Math.hypot(tx - kid.x, tz - kid.z);
                speed = d > 500 ? 5 * M : d > 60 ? 2.4 * M : 0;
            }
            const dx = tx - kid.x, dz = tz - kid.z, d = Math.hypot(dx, dz) || 1;
            if (speed > 0) {
                kid.vx = U.damp(kid.vx, dx / d * speed, 6, dt); kid.vz = U.damp(kid.vz, dz / d * speed, 6, dt);
                kid.yaw = U.dampAngle(kid.yaw, Math.atan2(dx, dz), 9, dt);
            } else {
                kid.vx = U.damp(kid.vx, 0, 8, dt); kid.vz = U.damp(kid.vz, 0, 8, dt);
                if (kid.state === 'camp') kid.yaw = U.dampAngle(kid.yaw, Math.atan2(Camp.x - kid.x, Camp.z - kid.z), 4, dt);
                else kid.yaw = U.dampAngle(kid.yaw, Math.atan2(Player.x - kid.x, Player.z - kid.z), 4, dt);
            }
            let nx = kid.x + kid.vx * dt, nz = kid.z + kid.vz * dt;
            const r = World.colliders.resolve(nx, nz, 22, { x: 0, z: 0, hit: null });
            kid.x = r.x; kid.z = r.z;
            const sp = Math.hypot(kid.vx, kid.vz);
            const anim = sp > 3.2 * M ? 'run' : sp > 30 ? 'walk' : (kid.state === 'camp' && Math.sin(kid.t * 0.7 + kid.seatAngle) > 0.86 ? 'cheer' : 'idle');
            if (rig.current(0) !== anim) rig.play(anim, { fade: 0.2 });
            if (rig.layers[0].cur && anim !== 'cheer') rig.layers[0].cur.speed = anim === 'run' ? U.clamp(sp / (5.6 * M), 0.7, 1.4) : anim === 'walk' ? 0.9 : 1;
            const y = World.heightAt(kid.x, kid.z);
            if (kid.shadowRec) { kid.shadowRec.x = kid.x; kid.shadowRec.z = kid.z; }
            rig.root.position.set(kid.x, y, kid.z);
            rig.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(0, kid.yaw, 0);
            rig.update(dt);
        }
    },

    assignSeat(kid) {
        const i = DATA.kids.findIndex(k => k.id === kid.def.id);
        kid.seatAngle = (i * 90 + 20 + 45) * Math.PI / 180;
    },

    // ---------------------------------------------------------------------------------------- сундуки
    addChest(x, z, yaw, gold, idx) {
        const rig = this.prop(gold ? 'chest_gold' : 'chest', x, z, yaw, { col: [[0, 0, 0.5]], free: true, inside: true, maxR: 420, force: true }) || Camp.put(gold ? 'chest_gold' : 'chest', x, z, x, z, { yaw, fpTag: 'zone', free: true, inside: true });
        if (!rig) return null;
        x = rig.x; z = rig.z;
        const ch = { rig, x, z, gold, idx, opened: this.openedChests.includes(idx), yaw };
        if (ch.opened) this.setLid(ch, 1);
        this.chests.push(ch);
        return ch;
    },
    setLid(ch, k) { const lid = ch.rig.node('lid'); if (lid) lid.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, -1.9 * k); },
    openChest(ch) {
        if (ch.opened) return;
        ch.opened = true; this.openedChests.push(ch.idx);
        Player.playAction('interact', 1.1);
        Sfx.at('chest', ch.x, 0, ch.z, 1);
        Tween.to(0.55, (t) => this.setLid(ch, U.easeOutBack(t)), { delay: 0.25 });
        const rnd = U.rng(ch.idx * 977 + 13);
        const loot = this.rollLoot(ch, rnd);
        loot.forEach(([id, cnt], i) => {
            const stacked = DATA.items[id].stack > 1 && cnt > 3;
            for (let k = 0; k < (stacked ? 1 : cnt); k++) Events.queueLoot(id, stacked ? cnt : 1,
                ch.x + (rnd() - .5) * 80, ch.z + (rnd() - .5) * 80, World.heightAt(ch.x, ch.z) + 80, .42 + i * .13);
        });
        // монеты из сундука
        if (typeof Econ !== 'undefined') Econ.dropCoins(ch.x, ch.z, ch.gold ? 28 + Math.floor(rnd() * 30) : 8 + Math.floor(rnd() * 14), 'chest');
        FX.ring(ch.x, World.heightAt(ch.x, ch.z) + 10, ch.z, 380, ch.gold ? '#ffe066' : '#ffffff');
        Player.stats.chests = (Player.stats.chests || 0) + 1;
        if (typeof Quests !== 'undefined') Quests.event('chest', 1);
        if (window.Game) Game.autosave('chest');
    },
    // Содержимое сундука: по таблицам из DATA.loot (обычный / золотой), редкие находки — шансом
    rollLoot(ch, rnd) {
        const tab = ch.gold ? DATA.loot.gold : DATA.loot.normal;
        const loot = [];
        const n = ch.gold ? 4 : 3;
        for (let i = 0; i < n; i++) {
            let r = rnd() * tab.total, pick = tab.rows[0];
            for (const row of tab.rows) { r -= row.w; if (r <= 0) { pick = row; break; } }
            const c = pick.n ? pick.n[0] + Math.floor(rnd() * (pick.n[1] - pick.n[0] + 1)) : 1;
            loot.push([pick.id, c]);
        }
        for (const rare of tab.rare) if (rnd() < rare.p) loot.push([rare.ids[Math.floor(rnd() * rare.ids.length)], 1]);
        return loot;
    },

    // ---------------------------------------------------------------------------------------- ягоды, грибы, грядки
    pickResource(r, bot) {
        if (!bot) Player.playAction('pickup', 1.4);
        const n = r.kind === 'berry' ? 2 + Math.floor(Math.random() * 3) : 1;
        const id = r.kind === 'berry' ? 'berry' : (Math.random() < 0.22 ? 'mushroom_food' : 'carrot');
        if (bot) { Bots.carry(bot, id, n); FX.pickup(r.x, World.heightAt(r.x, r.z) + 60, r.z); }
        else {
            const left = Inv.add(id, n);
            if (n - left > 0) { UI.pickupFeed(id, n - left); Sfx.ui('pickup'); FX.pickup(r.x, World.heightAt(r.x, r.z) + 60, r.z); }
            else { UI.toast(Lang.t('bagFull'), 'warn'); return; }
            if (typeof Quests !== 'undefined') Quests.event('forage', n - left);
        }
        r.ready = false; r.cool = Sky.day; World.pickedRes.set(World.resKey(r), Sky.day);
        if (r.kind === 'berry') {
            World.hideInstance(r);
            r.plain = World.addInstance(World.natureVariant('bush_a', r.x, r.z), r.x, r.z, r.s, r.ry);
        } else World.hideInstance(r);
    },
    regrow() {
        for (const r of World.resources) {
            if (r.ready || Sky.day <= r.cool) continue;
            r.ready = true; World.pickedRes.delete(World.resKey(r));
            if (r.kind === 'berry') { if (r.plain) World.hideInstance(r.plain); r.plain = null; World._matrix && World.setInstance(r, World._matrix(r)); }
            else World.setInstance(r, World._matrix(r));
        }
        for (const c of this.crops) if (!c.ready && Sky.day > c.cool) { c.ready = true; if (c.rig) c.rig.root.setEnabled(true); }
        for (const p of this.piles) if (p.stock < 6 && Sky.day > p.day) p.stock = 6;
        for (const o of this.ores || []) if (o.hp <= 0 && Sky.day > o.day + 1) { o.hp = o.maxHp; if (o.rig) o.rig.root.setEnabled(true); }
    },
    // Куст/гриб уже собран (загрузка сохранения): спрятать и ждать регрова
    markPicked(r, cool) {
        r.ready = false; r.cool = cool;
        World.hideInstance(r);
        if (r.kind === 'berry') r.plain = World.addInstance(World.natureVariant('bush_a', r.x, r.z), r.x, r.z, r.s, r.ry);
    },
    pickCrop(c, bot) {
        if (!bot) Player.playAction('pickup', 1.4);
        const n = 1 + Math.floor(Math.random() * 2);
        if (bot) { Bots.carry(bot, 'carrot', n); FX.pickup(c.x, World.heightAt(c.x, c.z) + 60, c.z); }
        else {
            const left = Inv.add('carrot', n);
            if (n - left > 0) { UI.pickupFeed('carrot', n - left); Sfx.ui('pickup'); FX.pickup(c.x, World.heightAt(c.x, c.z) + 60, c.z); }
            else { UI.toast(Lang.t('bagFull'), 'warn'); return; }
            if (typeof Quests !== 'undefined') Quests.event('harvest', n - left);
        }
        c.ready = false; c.cool = Sky.day; if (c.rig) c.rig.root.setEnabled(false);
    },
    takeLogs(p) {
        Player.playAction('pickup', 1.2);
        const left = Inv.add('log', 1);
        if (left === 0) { UI.pickupFeed('log', 1); Sfx.ui('pickup'); p.stock--; p.day = Sky.day; } else UI.toast(Lang.t('bagFull'), 'warn');
    },
    drink(w) {
        if (w.last === Sky.day) { UI.toast(Lang.t('wellDry'), 'info'); return; }
        w.last = Sky.day;
        Player.playAction('drink', 1.0);
        Player.hp = Math.min(100, Player.hp + 35); Player.stamina = 100;
        FX.heal(w.x, World.heightAt(w.x, w.z), w.z); Sfx.ui('heal');
        UI.toast(Lang.t('wellDrink'), 'good');
        if (typeof Quests !== 'undefined') Quests.event('drink', 1);
    },
    // Удар кирки/топора по рудной жиле
    hitOre(o, dmg) {
        if (o.hp <= 0) return false;
        o.hp -= 1; FX.chips(o.x, World.heightAt(o.x, o.z) + 80, o.z, { x: 0, z: 1 }); Sfx.at('chop', o.x, 0, o.z, 1); Cam.shake(0.12);
        if (typeof AttackFX !== 'undefined') AttackFX.impact({ x: o.x, y: World.heightAt(o.x, o.z) + 90, z: o.z }, 'rock', { x: 0, z: 1 });
        if (o.hp <= 0) {
            o.day = Sky.day; if (o.rig) o.rig.root.setEnabled(false);
            /** @type {[string, number][]} */
            const drops = [['gem', 1 + Math.floor(Math.random() * 2)], ['bolt', 2], ['diamond', Math.random() < 0.25 ? 1 : 0]];
            for (const [id, n] of drops) for (let i = 0; i < n; i++) Items.spawn(id, 1, o.x + (Math.random() - 0.5) * 120, o.z + (Math.random() - 0.5) * 120, { y: World.heightAt(o.x, o.z) + 80, vy: 420 });
            if (typeof Econ !== 'undefined') Econ.dropCoins(o.x, o.z, 12, 'ore');
            if (typeof Quests !== 'undefined') Quests.event('mine', 1);
        }
        return true;
    },

    _registerInteractions() {
        const self = this;
        Interact.providers.push((consider) => {
            for (const kid of self.kids) {
                if (kid.state !== 'caged') continue;
                if (!kid._e) kid._e = { x: kid.x, z: kid.z, r: 3.4 * M, h: 190, prio: 1,
                    text: () => Lang.t('p.cage'), sub: () => Inv.count(kid.def.key) > 0 ? Lang.t('p.useKey') : Lang.t('needKeyShort', { key: Lang.t('item.' + kid.def.key) }),
                    warn: () => Inv.count(kid.def.key) < 1, act: () => self.tryUnlock(kid) };
                consider(kid._e);
            }
            for (const ch of self.chests) {
                if (ch.opened) continue;
                if (!ch._e) ch._e = { x: ch.x, z: ch.z, r: 2.4 * M, h: 100, text: () => Lang.t(ch.gold ? 'p.chestGold' : 'p.chest'), act: () => self.openChest(ch) };
                consider(ch._e);
            }
            for (const r of World.resources) {
                if (!r.ready) continue;
                if (!r._e) r._e = { x: r.x, z: r.z, r: 2.2 * M, h: 110, text: () => Lang.t(r.kind === 'berry' ? 'p.berry' : 'p.mushroom'), act: () => self.pickResource(r) };
                consider(r._e);
            }
            for (const c of self.crops) {
                if (!c.ready) continue;
                if (!c._e) c._e = { x: c.x, z: c.z, r: 1.6 * M, h: 70, text: () => Lang.t('p.carrot'), act: () => self.pickCrop(c) };
                consider(c._e);
            }
            for (const p of self.piles) {
                if (p.stock <= 0) continue;
                if (!p._e) p._e = { x: p.x, z: p.z, r: 2.4 * M, h: 90, text: () => Lang.t('p.logpile'), sub: () => Lang.t('p.logpileSub', { n: p.stock }), act: () => self.takeLogs(p) };
                consider(p._e);
            }
            for (const w of self.wells) {
                if (!w._e) w._e = { x: w.x, z: w.z, r: 2.6 * M, h: 110, text: () => Lang.t('p.well'), sub: () => w.last === Sky.day ? Lang.t('wellDry') : Lang.t('p.wellSub'), act: () => self.drink(w) };
                consider(w._e);
            }
        });
    },

    update(dt) {
        this.updateKids(dt);
        if (Sky.day !== this.berryDay) { this.berryDay = Sky.day; this.regrow(); }
        if (this.pondDisc) { const m = this.pondDisc.material; m.specularPower = 80 + Math.sin(performance.now() / 900) * 10; this.pondDisc.position.y += Math.sin(performance.now() / 1300) * 0.02; }
    },

    // Водоём ли здесь (для рыбалки и замедления)
    pondAt(x, z) { for (const p of this.ponds || []) if (Math.hypot(x - p.x, z - p.z) < p.r) return p; return null; },

    state() {
        return {
            chests: this.openedChests.slice(), kids: this.kids.map(k => ({ id: k.def.id, s: k.state, r: k.rescued })), wells: this.wells.map(w => w.last),
            crops: this.crops.filter(c => !c.ready).map(c => [c.uid, c.cool]),
            piles: this.piles.filter(p => p.stock < 6).map(p => [p.uid, p.stock, p.day]),
            ores: (this.ores || []).filter(o => o.hp < o.maxHp).map(o => [o.uid, o.hp, o.day]),
        };
    },
    load(s) {
        if (!s) return;
        this.openedChests = (s.chests || []).slice();
        for (const ch of this.chests) if (this.openedChests.includes(ch.idx)) { ch.opened = true; this.setLid(ch, 1); }
        (s.wells || []).forEach((v, i) => { if (this.wells[i]) this.wells[i].last = v; });
        for (const [uid, cool] of s.crops || []) { const c = this.crops.find(q => q.uid === uid); if (c) { c.ready = false; c.cool = cool; if (c.rig) c.rig.root.setEnabled(false); } }
        for (const [uid, stock, day] of s.piles || []) { const p = this.piles.find(q => q.uid === uid); if (p) { p.stock = stock; p.day = day; } }
        for (const [uid, hp, day] of s.ores || []) { const o = (this.ores || []).find(q => q.uid === uid); if (o) { o.hp = hp; o.day = day; if (hp <= 0 && o.rig) o.rig.root.setEnabled(false); } }
        for (const ks of s.kids || []) {
            const kid = this.kids.find(k => k.def.id === ks.id);
            if (!kid || !ks.r) continue;
            kid.rescued = true; kid.state = 'camp'; this.assignSeat(kid);
            kid.x = Camp.x + Math.cos(kid.seatAngle) * 3.4 * M; kid.z = Camp.z + Math.sin(kid.seatAngle) * 3.4 * M;
            const door = kid.cage && kid.cage.node('door'); if (door) door.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, -1.9);
            if (kid.rig) kid.rig.play('idle');
        }
    },
};

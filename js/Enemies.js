// Enemies.js — враги и животные: волки, альфа-волки, медведи, кролики, культисты и Олень (ночной сталкер).
// Записи существуют всегда, а модель (Rig) создаётся вблизи игрока и снимается вдали. Урон по врагам —
// Enemies.damage; ИИ — простые конечные автоматы. Единицы — px.

const ENEMY_RIG = {
    wolf:    { url: 'wolf',    hgt: 0.95 * M, hide: ['collar'] },
    alpha:   { url: 'wolf',    hgt: 1.2 * M,  hide: ['collar'], scale: 1.28, mats: { fur: '#3e4048', fur_d: '#25262c', fur_l: '#7c7f88' } },
    bear:    { url: 'bear',    hgt: 1.7 * M,  hide: ['collar'] },
    boar:    { url: 'boar',    hgt: 1.25 * M, hide: ['collar'] },
    ghost:   { url: 'ghost',   hgt: 2.2 * M, hide: [] },
    bunny:   { url: 'bunny',   hgt: 0.5 * M,  hide: [] },
    cultist: { url: 'cultist', hgt: 1.9 * M,  hide: [], borrow: true },
    deer:    { url: 'deer',    hgt: 3.2 * M,  hide: [] },
    // Хозяин леса — отдельный рогатый босс; светлые грани читаются в лунном свете.
    warden:  { url: 'warden',    hgt: 4.2 * M,  hide: ['collar', 'collar_tag'], scale: 1.55, mats: { fur: '#5e496d', fur_d: '#352b47', fur_l: '#a078ab', glow_eye: '#ff4a3a', claw: '#d8c8ff', tooth: '#f2e8ff' } },
};

/** @type {Record<string, any>} */
const Enemies = {
    list: [],
    data: {},
    deer: null, boss: null, bossDead: false, swarm: false,
    view: null, scene: null,
    ACT: 64 * M, DROP: 84 * M,
    VIS: 64 * M,            // дальше зверь живёт (ИИ), но не рисуется и не анимируется; задаёт качество графики
    fear: 0,
    _groupId: 1,
    raidT: 0,
    hpBars: [],

    async init(view) {
        this.view = view; this.scene = view.scene;
        const urls = new Set(Object.values(ENEMY_RIG).map(r => r.url));
        await Promise.all(Array.from(urls).map(async (u) => { try { this.data[u] = await Rig.load('assets/models/' + u + '.glb'); } catch (e) { console.warn('Enemies: нет модели', u); } }));
        if (this.data.cultist && Player.data) Rig.borrowAnims(this.data.cultist, Player.data);
    },

    // ------------------------------------------------------------------------------ создание
    spawn(type, x, z, o) {
        const opts = o || {};
        const def = DATA.enemies[type];
        const cfg = ENEMY_RIG[type];
        const sc = cfg.scale || 1;
        const e = {
            type, def, cfg, x, z, y: World.heightAt(x, z), yaw: opts.yaw != null ? opts.yaw : Math.random() * 6.28,
            vx: 0, vz: 0, hp: def.hp * (opts.hpK || 1), maxHp: def.hp * (opts.hpK || 1), alive: true, state: 'idle', st: Math.random() * 2,
            rad: def.radius * sc, hgt: cfg.hgt, home: { x: opts.homeX != null ? opts.homeX : x, z: opts.homeZ != null ? opts.homeZ : z, r: opts.leash || 14 * M },
            group: opts.group || 0, guard: opts.guard || null, rig: null, atkCd: Math.random(), acting: 0, hitT: -1, flash: 0, stun: 0, slow: 0,
            night: !!opts.night, ranged: !!opts.ranged, raid: !!opts.raid, dmgK: opts.dmgK || 1, wander: null, lastHurt: -99, id: Math.random(),
            speedK: opts.speedK || 1, firstAlert: true, scale: sc, always: !!opts.always,
        };
        if (this._ringTag != null) e.sid = this._ringTag * 10000 + this._sidN++;
        this.list.push(e);
        return e;
    },

    ensureRig(e) {
        if (e.rig || !this.data[e.cfg.url]) return;
        const data = this.data[e.cfg.url];
        const hide = e.cfg.hide.slice();
        if (e.guard && e.type !== 'cultist') { const i = hide.indexOf('collar'); if (i >= 0) hide.splice(i, 1); }
        let mats = e.cfg.mats ? Object.assign({}, e.cfg.mats) : null;
        if (e.guard && e.guard.collar) { mats = mats || {}; mats.collar = e.guard.collar; }
        if (e.type === 'cultist') { mats = mats || {}; mats.robe = e.leader ? '#6a1f2d' : '#3a1f3d'; }
        e.rig = Rig.instance(data, this.scene, { name: e.type, hide, materials: mats, merge: true });
        if (e.scale !== 1) e.rig.root.scaling.setAll(e.scale);
        e.rig.setShadows(this.view, true);
        e.rig.root.position.set(e.x, e.y, e.z);
        e.rig.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(0, e.yaw, 0);
        if (e.type === 'cultist') this.giveWeapon(e);
        e.rig.play(e.alive ? this.idleAnim(e) : 'death', { fade: 0 });
        e.baseAnim = null;
    },
    dropRig(e) {
        if (e._slamTell) { e._slamTell.mesh.dispose(); e._slamTell.mat.dispose(); e._slamTell = null; }
        if (!e.rig) return;
        if (e.weapon) { if (e.weapon._rig) e.weapon._rig.dispose(); e.weapon = null; }
        e.rig.dispose(); e.rig = null;
    },
    giveWeapon(e) {
        const id = e.ranged ? 'revolver' : 'spear';
        const w = Items.make(id);
        const bone = e.rig.node('GripR');
        if (bone) { w.parent = bone; w.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(0, 0, 0); }
        e.weapon = w;
    },

    idleAnim(e) { return e.type === 'cultist' ? 'idle' : 'idle'; },

    // ------------------------------------------------------------------------------ заполнение мира
    // Звери появляются только в открытых кольцах (ring k = зона k; кольцо открывает уровень костра k+1).
    ringDone: [],
    killed: new Set(),   // sid убитых зверей мест и колец — после загрузки они не появляются
    _ringTag: null, _sidN: 0,
    RING: [
        { bunny: 14, packs: 1, bears: 0, boars: 0, ghosts: 0 },
        { bunny: 10, packs: 2, bears: 0, boars: 2, ghosts: 0 },
        { bunny: 6, packs: 3, bears: 1, boars: 3, ghosts: 0 },
        { bunny: 4, packs: 2, bears: 2, boars: 2, ghosts: 2 },
        { bunny: 4, packs: 3, bears: 2, boars: 3, ghosts: 3 },
    ],
    // Открыть кольца до уровня костра
    populate(loc, level) {
        for (let k = 0; k < Math.min(level || 1, DATA.zones.length); k++) this.populateRing(k, loc);
    },
    populateRing(k, loc) {
        if (this.ringDone[k]) return;
        this.ringDone[k] = true;
        this._ringTag = k; this._sidN = 0;
        loc = loc || Zones.loc;
        const rnd = U.rng(3131 + k * 17);
        const R = this.RING[k];
        const can = (t) => DATA.enemies[t] && ENEMY_RIG[t];
        for (let i = 0; i < R.bunny; i++) { const p = Zones.ringPoint(rnd, k, 400); this.spawn('bunny', p.x, p.z, { leash: 12 * M }); }
        for (let i = 0; i < R.packs; i++) {
            const p = Zones.ringPoint(rnd, k, 700);
            const g = this._groupId++, n = 2 + (i % 2);
            for (let q = 0; q < n; q++) this.spawn('wolf', p.x + (rnd() - 0.5) * 300, p.z + (rnd() - 0.5) * 300, { group: g, homeX: p.x, homeZ: p.z, leash: 20 * M });
        }
        for (let i = 0; i < R.bears; i++) { const p = Zones.ringPoint(rnd, k, 800); this.spawn('bear', p.x, p.z, { leash: 18 * M }); }
        // логова и места интереса этого кольца
        const den = (name, fn) => { for (const m of loc.markers(name)) if (World.zoneIndexAt(m.x, m.y) === k) fn({ x: m.x, z: m.y }); };
        den('den-wolf', (p) => { const g = this._groupId++; for (let q = 0; q < 5; q++) this.spawn('wolf', p.x + (rnd() - 0.5) * 500, p.z + (rnd() - 0.5) * 500, { group: g, homeX: p.x, homeZ: p.z, leash: 22 * M, guard: q === 0 ? { key: 'key_red', collar: '#d12a2a' } : null }); });
        den('den-alpha', (p) => { const g = this._groupId++; for (let q = 0; q < 4; q++) this.spawn('alpha', p.x + (rnd() - 0.5) * 500, p.z + (rnd() - 0.5) * 500, { group: g, homeX: p.x, homeZ: p.z, leash: 24 * M, guard: q === 0 ? { key: 'key_blue', collar: '#2f6bd8' } : null }); });
        den('cave-bear', (p) => { for (let q = 0; q < 2; q++) this.spawn('bear', p.x + (q ? 380 : -380), p.z + 300, { homeX: p.x, homeZ: p.z, leash: 26 * M, guard: q === 0 ? { key: 'key_green', collar: '#2fb84a' } : null, hpK: 1.1 }); });
        den('poi-cultist', (p) => {
            const g = this._groupId++;
            for (let q = 0; q < 5; q++) { const a = q / 5 * 6.28; const c = this.spawn('cultist', p.x + Math.cos(a) * 500, p.z + Math.sin(a) * 500, { group: g, homeX: p.x, homeZ: p.z, leash: 24 * M, ranged: q % 2 === 1, guard: q === 0 ? { key: 'key_yellow' } : null }); if (q === 0) c.leader = true; }
        });
        // Новые виды используют отдельный диапазон sid: старые сохранения стражей остаются совместимыми.
        this._sidN = 5000;
        if (can('boar')) for (let i = 0; i < R.boars; i++) { const p = Zones.ringPoint(rnd, k, 500); this.spawn('boar', p.x, p.z, { leash: 16 * M }); }
        if (can('ghost')) for (let i = 0; i < R.ghosts; i++) { const p = Zones.ringPoint(rnd, k, 500); this.spawn('ghost', p.x, p.z, { leash: 20 * M }); }
        den('poi-graveyard', (p) => { if (can('ghost')) for (let q = 0; q < 3; q++) this.spawn('ghost', p.x + (rnd() - 0.5) * 900, p.z + (rnd() - 0.5) * 900, { homeX: p.x, homeZ: p.z, leash: 14 * M }); });
        this._ringTag = null;
        if (this.killed.size) this.list = this.list.filter(e => !(e.sid != null && this.killed.has(e.sid)));
    },

    // ------------------------------------------------------------------------------ кадр
    update(dt) {
        this.ghostFear = 0;
        const px = Player.x, pz = Player.z;
        for (let i = this.list.length - 1; i >= 0; i--) {
            const e = this.list[i];
            const d2 = U.dist2(e.x, e.z, px, pz);
            const near = d2 < this.ACT * this.ACT || e.always;
            if (near && !e.rig && (e.alive || e.deadT < 5)) this.ensureRig(e);
            else if (!near && e.rig && d2 > this.DROP * this.DROP && !e.always) this.dropRig(e);
            // белая вспышка попадания гаснет и у тела: добивающий удар иначе оставлял труп белым
            if (e.flash > 0) { e.flash -= dt; if (e.flash <= 0 && e.rig) for (const m of e.rig.meshes) m.renderOverlay = false; }
            if (!e.alive) { this.updateDead(e, dt, i); continue; }
            if (!near && !e.always) continue;
            this.tick(e, dt, Math.sqrt(d2));
            if (e.rig) {
                // за дальностью прорисовки (туман, ночь) модель выключена: ни отрисовки, ни расчёта костей
                const vis = d2 < this.VIS * this.VIS || e.always || e.boss || e.type === 'deer';
                if (e.rig.root.isEnabled() !== vis) e.rig.root.setEnabled(vis);
                if (vis) this.applyRig(e, dt);
            }
        }
        this.updateDeer(dt);
        this.updateFear(dt);
        this.updateBars(dt);
        // рейды и ночной спавн по таймеру
        if (Sky.isNight() && Player.control && !(this.boss && this.boss.alive)) {
            this.raidT -= dt;
            if (this.raidT <= 0) { this.raidT = (DATA.balance.nights.waveMin + Math.random() * DATA.balance.nights.waveJitter) * (this.swarm ? 0.55 : 1); this.nightSpawn(); }
        }
    },

    applyRig(e, dt) {
        const r = e.rig;
        e.y = World.heightAt(e.x, e.z);
        if (e.boss) this.updateBossTell(e);
        r.root.position.set(e.x, e.y + (e.lift || 0), e.z);
        // реакция на удар: корпус откидывается назад, тело сплющивается и пружинит (AttackFX.react)
        if (e.tilt > 0.01 || e.sq > 0.01) {
            e.tilt = U.damp(e.tilt || 0, 0, 7, dt); e.sq = U.damp(e.sq || 0, 0, 9, dt);
            const k = e.sq, sc = e.scale || 1;
            r.root.scaling.set(sc * (1 + 0.12 * k), sc * (1 - 0.15 * k), sc * (1 + 0.12 * k));
            r.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(-e.tilt, e.yaw, 0);
            e._sqOn = true;
        } else {
            if (e._sqOn) { e._sqOn = false; e.tilt = 0; e.sq = 0; r.root.scaling.setAll(e.scale || 1); }
            r.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(0, e.yaw, 0);
        }
        r.update(dt);
    },

    // Геометрия предупреждения совпадает с радиусом урона и повторяет рельеф.
    // FX.ring — повёрнутая к камере частица; она не показывает безопасную границу на земле.
    bossTellPaths(e) {
        const radius = DATA.balance.boss.slamRadius * M;
        return [radius - 16, radius + 16].map(r => Array.from({ length: 97 }, (_, i) => {
            const a = i / 96 * Math.PI * 2, x = e.x + Math.cos(a) * r, z = e.z + Math.sin(a) * r;
            return new BABYLON.Vector3(x, World.heightAt(x, z) + 14, z);
        }));
    },
    updateBossTell(e) {
        const on = e.alive && e.state === 'slam' && e.st < DATA.balance.boss.slamTell;
        if (!on) { if (e._slamTell) e._slamTell.mesh.setEnabled(false); return; }
        if (!this.scene) return;
        if (!e._slamTell) {
            const mat = new BABYLON.StandardMaterial('warden_slam_warning', this.scene);
            mat.disableLighting = true; mat.fogEnabled = false; mat.metadata = { toon: false, mist: false };
            mat.emissiveColor = BABYLON.Color3.FromHexString('#ff493c'); mat.alpha = 0.85;
            const mesh = BABYLON.MeshBuilder.CreateRibbon('warden_slam_radius', {
                pathArray: this.bossTellPaths(e), sideOrientation: BABYLON.Mesh.DOUBLESIDE, updatable: true
            }, this.scene);
            mesh.material = mat; mesh.isPickable = false; mesh.receiveShadows = false;
            e._slamTell = { mesh, mat, x: e.x, z: e.z };
        }
        const tell = e._slamTell;
        if (Math.hypot(tell.x - e.x, tell.z - e.z) > 4) {
            BABYLON.MeshBuilder.CreateRibbon('warden_slam_radius', { pathArray: this.bossTellPaths(e), instance: tell.mesh }, this.scene);
            tell.x = e.x; tell.z = e.z;
        }
        tell.mat.alpha = 0.72 + 0.22 * Math.sin(e.st * 18) ** 2;
        tell.mesh.setEnabled(true);
    },

    base(e, name, speed) {
        if (!e.rig) return;
        if (e.baseAnim !== name) { e.baseAnim = name; e.rig.play(name, { fade: 0.2 }); }
        if (e.rig.layers[0].cur) e.rig.layers[0].cur.speed = speed || 1;
    },
    act(e, name, speed, hold) {
        if (!e.rig) return e.def.rate / (speed || 1);
        const dur = e.rig.duration(name) / (speed || 1);
        e.rig.play(name, { layer: 2, loop: false, fade: 0.06, speed: speed || 1, restart: true, hold: !!hold, mask: null });
        e.rig.layers[2].target = 1;
        return dur;
    },

    // Шаг к точке: сглаженная скорость, столкновения, разделение
    move(e, tx, tz, speed, dt, o) {
        const opt = o || {};
        const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz) || 1;
        if (!opt.noTurn) e.yaw = U.dampAngle(e.yaw, Math.atan2(dx, dz), opt.turnK || 9, dt);
        let sp = speed * (1 - e.slow) * (e.speedK || 1);
        if (d < 30 && !opt.through) sp = 0;
        const dirx = dx / d, dirz = dz / d;
        e.vx = U.damp(e.vx, dirx * sp, 7, dt); e.vz = U.damp(e.vz, dirz * sp, 7, dt);
        let nx = e.x + e.vx * dt, nz = e.z + e.vz * dt;
        // отталкивание от других
        for (const o2 of this.list) {
            if (o2 === e || !o2.alive) continue;
            const ax = nx - o2.x, az = nz - o2.z, r = (e.rad + o2.rad) * 0.9;
            if (Math.abs(ax) < r && Math.abs(az) < r) { const dd = Math.hypot(ax, az) || 1; if (dd < r) { nx += ax / dd * (r - dd) * 0.5; nz += az / dd * (r - dd) * 0.5; } }
        }
        const rr = World.colliders.resolve(nx, nz, Math.min(e.rad * 0.55, 45), { x: 0, z: 0, hit: null });
        e.x = rr.x; e.z = rr.z;
        const p = { x: e.x, z: e.z };
        if (World.clampToFog(p, 120) && !e.always) { e.x = p.x; e.z = p.z; }
        return d;
    },
    stop(e, dt) { e.vx = U.damp(e.vx, 0, 9, dt); e.vz = U.damp(e.vz, 0, 9, dt); e.x += e.vx * dt; e.z += e.vz * dt; },
    face(e, tx, tz, dt, k) { e.yaw = U.dampAngle(e.yaw, Math.atan2(tx - e.x, tz - e.z), k || 10, dt); },

    dmgOf(e) { return e.def.dmg * DATA.scale(Sky.day) * e.dmgK * (e.guard ? 1.15 : 1); },

    // Игрок под защитой костра?
    playerSafe() { return Camp.isSafe(Player.x, Player.z, 120); },

    // Цель врага: игрок или ближайший живой бот (игрок чуть предпочтительнее); выбор держится 0.7 с
    targetOf(e) {
        const bots = window.Bots ? Bots.list : null;
        if (!bots || !bots.length) return Player;
        const now = performance.now() / 1000;
        if (e._tgt && now < e._tgtUntil && !e._tgt.dead) return e._tgt;
        let best = Player.dead ? null : Player, bd = best ? U.dist2(e.x, e.z, Player.x, Player.z) * 0.72 : 1e12;
        for (const b of bots) { if (b.dead) continue; const d2 = U.dist2(e.x, e.z, b.x, b.z); if (d2 < bd) { bd = d2; best = b; } }
        e._tgt = best || Player; e._tgtUntil = now + 0.7;
        return e._tgt;
    },

    tick(e, dt, dP) {
        if (e.type === 'deer') return;
        if (e.atkCd > 0) e.atkCd -= dt;
        if (e.slow > 0) e.slow = Math.max(0, e.slow - dt * 0.4);
        if (e.stunImm > 0) e.stunImm -= dt;
        e.st += dt;
        if (e.stun > 0) { e.stun -= dt; this.stop(e, dt); this.base(e, 'idle'); return; }
        if (e.trapped > 0) { e.trapped -= dt; this.stop(e, dt); this.base(e, 'idle'); return; }
        // ловушки/колючка
        this.structEffects(e, dt);
        if (!e.alive) return;
        switch (e.type) {
            case 'wolf': case 'alpha': return this.tickWolf(e, dt, dP);
            case 'bear': return this.tickBear(e, dt, dP);
            case 'boar': return this.tickBoar(e, dt, dP);
            case 'ghost': return this.tickGhost(e, dt, dP);
            case 'bunny': return this.tickBunny(e, dt, dP);
            case 'cultist': return this.tickCultist(e, dt, dP);
            case 'warden': return this.tickWarden(e, dt, dP);
            case 'deer': return;
        }
    },

    structEffects(e, dt) {
        for (const s of Camp.structures) {
            if (s.type === 'torch') continue;
            const d = Math.hypot(e.x - s.x, e.z - s.z);
            if (s.type === 'wire' && d < 130) { e.slow = Math.max(e.slow, e.boss ? 0.25 : 0.55); if (!e._wireT || e._wireT <= 0) { e._wireT = 0.5; this.damage(e, 5 * DATA.scale(Sky.day), s.x, s.z, { noStun: true, quiet: true }); Camp.wear(s, 1.4); } }
            if (s.type === 'spikes' && d < 90 && s.cd <= 0) { s.cd = 1.2; this.damage(e, 34, s.x, s.z, { knock: 200 }); Sfx.at('hit', e.x, e.y, e.z, 1); Camp.wear(s, 8); }
            // баррикаду грызут звери, упёршиеся в неё в погоне
            if (s.type === 'barricade' && d < e.rad + 150 && (e.state === 'chase' || e.state === 'attack' || e.boss)) Camp.wear(s, dt * (e.boss ? 60 : e.type === 'bear' ? 14 : e.type === 'alpha' ? 7 : 5));
            if (s.type === 'beartrap' && !s.used && d < 60) { s.used = true; e.trapped = e.boss ? 1.5 : 4.5; this.damage(e, 60, s.x, s.z, {}); Sfx.at('trap', e.x, e.y, e.z, 1); FX.hitSpark(e.x, e.y + 20, e.z, '#ffffff'); Cam.shake(0.15); setTimeout(() => Camp.removeStructure(s), 400); }
        }
        if (e._wireT > 0) e._wireT -= dt;
    },

    // ------------------------------------------------------------------------------ волки
    wanderTo(e, dt, speed, animWalk) {
        if (!e.wander || e.st > e.wanderT || U.dist2(e.x, e.z, e.wander.x, e.wander.z) < 80 * 80) {
            const a = Math.random() * 6.28, r = Math.random() * e.home.r * 0.7;
            e.wander = { x: e.home.x + Math.cos(a) * r, z: e.home.z + Math.sin(a) * r };
            e.wanderT = e.st + 3 + Math.random() * 5;
            e.pause = Math.random() < 0.4 ? 1 + Math.random() * 3 : 0; e.pauseEnd = e.st + e.pause;
        }
        if (e.st < e.pauseEnd) { this.stop(e, dt); this.base(e, 'idle'); return; }
        this.move(e, e.wander.x, e.wander.z, speed, dt);
        this.base(e, animWalk || 'walk', 1);
    },

    tickWolf(e, dt, dP) {
        const P = this.targetOf(e);
        if (P !== Player) dP = Math.hypot(e.x - P.x, e.z - P.z);
        const safe = Camp.isSafe(P.x, P.z, 120);
        const homeD = Math.hypot(e.x - e.home.x, e.z - e.home.z);
        const canHunt = !P.dead && dP < (e.def.aggro * (e.night ? 2.2 : 1)) && (!e.guard && !e.home.leashOnly || homeD < e.home.r * 1.6 || e.night);
        switch (e.state) {
            case 'idle':
                this.wanderTo(e, dt, 1.5 * M);
                if (canHunt && !P.sleeping) { e.state = 'alert'; e.st = 0; this.alertGroup(e); }
                break;
            case 'alert':
                this.stop(e, dt); this.face(e, P.x, P.z, dt);
                if (e.st < 0.05 && e.firstAlert) { e.firstAlert = false; const d = this.act(e, 'howl', 1.4); e.acting = d; Sfx.far('howl', e.x, e.y, e.z, 0.9); }
                if (e.st > (e.acting > 0 ? 1.2 : 0.6)) { e.state = 'chase'; e.st = 0; }
                e.acting -= dt;
                break;
            case 'chase': {
                if (P.dead) { e.state = 'idle'; break; }
                if (dP > e.def.aggro * (e.night ? 2.8 : 1.6) || (!e.night && homeD > e.home.r * 2.4 && e.guard)) { e.state = 'idle'; e.st = 0; break; }
                if (safe && Camp.isSafe(P.x, P.z)) {
                    // держится у границы света, кружит и рычит
                    const R = Camp.safeRadius() + 3.2 * M;
                    const ang = Math.atan2(e.z - Camp.z, e.x - Camp.x) + dt * 0.55 * (e.id > 0.5 ? 1 : -1);
                    const tx = Camp.x + Math.cos(ang) * R, tz = Camp.z + Math.sin(ang) * R;
                    this.move(e, tx, tz, e.def.speed * 0.6, dt, { noTurn: true }); this.face(e, P.x, P.z, dt, 6);
                    this.base(e, 'walk', 1.3);
                    if (Math.random() < dt * 0.15) Sfx.at('growl', e.x, e.y, e.z, 0.9);
                    break;
                }
                const d = this.move(e, P.x, P.z, e.def.speed, dt, { through: true });
                this.base(e, 'run', 1);
                if (d < e.def.reach + P.speed * 0.2 && e.atkCd <= 0) { e.state = 'attack'; e.st = 0; e.hitDone = false; const dur = this.act(e, 'attack', 1.05); e.atkDur = dur; e.atkCd = e.def.rate; Sfx.at('growl', e.x, e.y, e.z, 1); }
                break;
            }
            case 'attack': {
                this.face(e, P.x, P.z, dt, 12);
                this.stop(e, dt * 0.5);
                if (!e.hitDone && e.st >= e.atkDur * 0.46) {
                    e.hitDone = true;
                    if (Math.hypot(e.x - P.x, e.z - P.z) < e.def.reach * 1.35 + 40) {
                        // лёгкий бросок вперёд
                        P.hurt(this.dmgOf(e), e.x, e.z, 'bite'); Sfx.at('bark', e.x, e.y, e.z, 1);
                    }
                }
                if (e.st >= (e.atkDur || 0.8)) { e.state = 'chase'; e.st = 0; e.kite = Math.random() < 0.5; }
                break;
            }
            case 'flee':
                this.move(e, e.home.x, e.home.z, e.def.speed * 0.9, dt);
                this.base(e, 'run', 1);
                if (e.st > 4) { e.state = 'idle'; e.st = 0; }
                break;
        }
    },

    alertGroup(e) {
        if (!e.group) return;
        for (const o of this.list) if (o !== e && o.alive && o.group === e.group && o.state === 'idle' && U.dist2(o.x, o.z, e.x, e.z) < 26 * M * 26 * M) { o.state = 'alert'; o.st = -Math.random() * 0.4; }
    },

    // ------------------------------------------------------------------------------ медведи
    tickBear(e, dt, dP) {
        const P = this.targetOf(e);
        if (P !== Player) dP = Math.hypot(e.x - P.x, e.z - P.z);
        const safe = Camp.isSafe(P.x, P.z, 120);
        const homeD = Math.hypot(e.x - e.home.x, e.z - e.home.z);
        switch (e.state) {
            case 'idle':
                this.wanderTo(e, dt, 1.2 * M);
                if (!P.dead && dP < e.def.aggro && !safe && (homeD < e.home.r * 1.5)) { e.state = 'alert'; e.st = 0; const d = this.act(e, 'roar', 1); e.acting = d; Sfx.at('roar', e.x, e.y, e.z, 1); if (P === Player) Cam.shake(0.15); }
                break;
            case 'alert':
                this.stop(e, dt); this.face(e, P.x, P.z, dt);
                if (e.st > 1.3) { e.state = 'chase'; e.st = 0; }
                break;
            case 'chase': {
                if (P.dead || dP > e.def.aggro * 2 || homeD > e.home.r * 2.2 || (safe && Camp.isSafe(P.x, P.z))) { e.state = 'idle'; e.st = 0; break; }
                const d = this.move(e, P.x, P.z, e.def.speed, dt, { through: true });
                this.base(e, 'run', 0.9);
                if (d < e.def.reach && e.atkCd <= 0) { e.state = 'attack'; e.st = 0; e.hitDone = false; e.atkDur = this.act(e, 'swipe', 1); e.atkCd = e.def.rate; Sfx.at('roar', e.x, e.y, e.z, 0.7); }
                break;
            }
            case 'attack':
                this.face(e, P.x, P.z, dt, 8); this.stop(e, dt);
                if (!e.hitDone && e.st >= e.atkDur * 0.5) { e.hitDone = true; if (Math.hypot(e.x - P.x, e.z - P.z) < e.def.reach * 1.25 + 60) { P.hurt(this.dmgOf(e), e.x, e.z, 'maul'); if (P === Player) Cam.shake(0.3); Sfx.at('hit', e.x, e.y, e.z, 1); } }
                if (e.st >= e.atkDur) { e.state = 'chase'; e.st = 0; }
                break;
        }
    },

    // ------------------------------------------------------------------------------ кабан: неподвижный телеграф → прямой таран → восстановление
    tickBoar(e, dt, dP) {
        const P = this.targetOf(e), B = DATA.balance.boar;
        dP = Math.hypot(e.x - P.x, e.z - P.z);
        const safe = Camp.isSafe(P.x, P.z, 120);
        if ((P.dead || P.sleeping || safe) && !['charge', 'recover'].includes(e.state)) { e.state = 'idle'; e.st = 0; }
        switch (e.state) {
            case 'idle':
                this.wanderTo(e, dt, e.def.speed * 0.3);
                if (!P.dead && !P.sleeping && !safe && dP < e.def.aggro) { e.state = 'chase'; e.st = 0; }
                break;
            case 'alert': case 'chase':
                if (dP > e.def.aggro * 2 || Math.hypot(e.x - e.home.x, e.z - e.home.z) > e.home.r * 2) { e.state = 'idle'; e.st = 0; break; }
                if (e.atkCd <= 0 && dP < B.maxCharge * M) {
                    e.state = 'windup'; e.st = 0; e.chargeDir = Math.atan2(P.x - e.x, P.z - e.z); e.yaw = e.chargeDir;
                    e.vx = e.vz = 0; this.act(e, 'attack', 0.7);
                    FX.ring(e.x, e.y + 10, e.z, e.rad * 3, '#ffb050'); Sfx.at('boar', e.x, e.y, e.z, 0.9);
                } else { this.move(e, P.x, P.z, e.def.speed, dt); this.base(e, 'run'); }
                break;
            case 'windup':
                this.stop(e, dt); this.base(e, 'idle');
                // Направление зафиксировано с начала предупреждения, игрок может уйти в сторону.
                if (e.st >= B.tell) { e.state = 'charge'; e.st = 0; e.hitDone = false; this.base(e, 'charge'); }
                break;
            case 'charge': {
                const dx = Math.sin(e.chargeDir), dz = Math.cos(e.chargeDir);
                const distance = B.chargeSpeed * M * dt, n = Math.max(1, Math.ceil(distance / DATA.balance.movement.sweepStep));
                let blocked = false;
                for (let i = 0; i < n; i++) {
                    const nx = e.x + dx * distance / n, nz = e.z + dz * distance / n;
                    const r = World.colliders.resolve(nx, nz, e.rad, { x: 0, z: 0, hit: null });
                    const p = { x: r.x, z: r.z };
                    blocked = !!r.hit || World.clampToFog(p, e.rad);
                    e.x = p.x; e.z = p.z;
                    if (!e.hitDone) for (const target of this.bossTargets()) {
                        if (!Camp.isSafe(target.x, target.z) && Math.hypot(target.x - e.x, target.z - e.z) < e.rad + DATA.player.radius) {
                            target.hurt(this.dmgOf(e), e.x - dx * M, e.z - dz * M, 'boar'); e.hitDone = true; break;
                        }
                    }
                    if (blocked) break;
                }
                this.base(e, 'charge');
                if (blocked || e.st >= B.chargeTime) {
                    e.state = 'recover'; e.st = 0; e.vx = e.vz = 0; e.atkCd = e.def.rate;
                    if (blocked) { e.stun = B.wallStun; this.act(e, 'hit'); Sfx.at('thud', e.x, e.y, e.z, 1); FX.dust(e.x, e.y, e.z, 8, 1); }
                }
                break;
            }
            case 'recover':
                this.stop(e, dt); this.base(e, 'idle');
                if (e.st >= B.recovery) { e.state = 'chase'; e.st = 0; }
                break;
        }
    },

    // Свет существует в логике: костёр, поставленные факелы, переносной фонарь и луч.
    ghostLight(e) {
        const G = DATA.balance.ghost;
        if (Camp.isSafe(e.x, e.z, 0)) return { x: Camp.x, z: Camp.z };
        for (const s of Camp.structures) if (s.type === 'torch' && !s.broken && Math.hypot(s.x - e.x, s.z - e.z) < G.torchRadius * M) return s;
        if (!Player.dead && ((Player.heldId === 'lantern' && Player.lanternOn !== false && Math.hypot(Player.x - e.x, Player.z - e.z) < G.lightRadius * M) || this.beamHits(e))) return Player;
        return null;
    },
    tickGhost(e, dt, dP) {
        const P = this.targetOf(e), G = DATA.balance.ghost, light = this.ghostLight(e);
        dP = Math.hypot(e.x - P.x, e.z - P.z);
        e.lift = G.hover + Math.sin(e.st * 2) * G.hover * 0.3;
        if (e.rig) for (const mesh of e.rig.meshes) mesh.visibility = Sky.isNight() ? 0.8 : 0.2;
        if (light) {
            e.state = 'flee';
            const dx = e.x - light.x, dz = e.z - light.z, d = Math.hypot(dx, dz) || 1;
            this.move(e, e.x + dx / d * M * 5, e.z + dz / d * M * 5, e.def.speed, dt);
            this.base(e, 'float');
            e.lightT = (e.lightT || 0) + dt;
            if (e.lightT >= 1) { e.lightT -= 1; this.damage(e, G.lightDamage, light.x, light.z, { quiet: true, element: 'light' }); }
            return;
        }
        e.lightT = 0;
        if (!Sky.isNight() || P.dead || P.sleeping || dP > e.def.aggro * 1.6) { e.state = 'idle'; this.wanderTo(e, dt, e.def.speed * 0.25, 'float'); return; }
        if (P === Player) this.ghostFear = Math.max(this.ghostFear || 0, Math.max(0, 1 - dP / (G.fearRadius * M)) * 0.7);
        if (e.state === 'attack') {
            this.stop(e, dt); this.face(e, P.x, P.z, dt);
            if (!e.hitDone && e.st >= 0.65) { e.hitDone = true; if (dP < e.def.reach * 1.2 && !this.ghostLight(e)) { P.hurt(this.dmgOf(e), e.x, e.z, 'ghost'); Sfx.at('ghost', e.x, e.y, e.z, 0.7); } }
            if (e.st > 1.1) { e.state = 'chase'; e.st = 0; }
        } else {
            e.state = 'chase'; this.move(e, P.x, P.z, e.def.speed, dt); this.base(e, 'float');
            if (dP < e.def.reach && e.atkCd <= 0) { e.state = 'attack'; e.st = 0; e.hitDone = false; e.atkCd = e.def.rate; this.act(e, 'attack'); Sfx.at('ghostTell', e.x, e.y, e.z, 0.5); }
        }
    },

    // ------------------------------------------------------------------------------ кролики
    tickBunny(e, dt, dP) {
        const P = this.targetOf(e);
        if (P !== Player) dP = Math.hypot(e.x - P.x, e.z - P.z);
        if (dP < 9 * M && !P.dead) {
            const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1;
            e.state = 'flee'; e.st = 0;
            this.move(e, e.x + dx / d * 400, e.z + dz / d * 400, e.def.speed, dt, { turnK: 14, through: true });
            this.base(e, 'flee', 1.2);
            if (!e.squeaked) { e.squeaked = true; Sfx.at('squeak', e.x, e.y, e.z, 0.8); }
            return;
        }
        e.squeaked = false;
        if (e.state === 'flee' && dP < 16 * M) { this.stop(e, dt); this.base(e, 'idle'); if (e.st > 0.5) e.state = 'idle'; return; }
        // травоядный: прыжок — пауза
        if (!e.hopT || e.st > e.hopT) {
            e.hopT = e.st + 1 + Math.random() * 4;
            if (Math.random() < 0.5) { const a = Math.random() * 6.28; e.wander = { x: e.x + Math.cos(a) * 320, z: e.y * 0 + e.z + Math.sin(a) * 320 }; e.hopping = 0.8 + Math.random() * 0.9; }
            else e.hopping = 0;
        }
        if (e.hopping > 0) { e.hopping -= dt; if (e.wander) this.move(e, e.wander.x, e.wander.z, 1.8 * M, dt, { through: true }); this.base(e, 'hop', 1); }
        else { this.stop(e, dt); this.base(e, 'idle', 1); }
    },

    // ------------------------------------------------------------------------------ культисты
    tickCultist(e, dt, dP) {
        const P = this.targetOf(e);
        if (P !== Player) dP = Math.hypot(e.x - P.x, e.z - P.z);
        const homeD = Math.hypot(e.x - e.home.x, e.z - e.home.z);
        switch (e.state) {
            case 'idle':
                this.wanderTo(e, dt, 1.1 * M);
                if (!P.dead && (e.raid || (dP < e.def.aggro && homeD < e.home.r * 1.4)) && !P.sleeping) { e.state = 'chase'; e.st = 0; }
                break;
            case 'chase': {
                if (P.dead) { e.state = 'idle'; break; }
                if (!e.raid && (dP > e.def.aggro * 1.8 || homeD > e.home.r * 2.4)) { e.state = 'idle'; e.st = 0; break; }
                if (e.ranged && dP < 20 * M && dP > 7 * M) {
                    this.stop(e, dt); this.face(e, P.x, P.z, dt, 10); this.base(e, 'idle');
                    if (e.atkCd <= 0) { e.atkCd = 2.4 + Math.random(); this.act(e, 'fire', 1.2); const from = { x: e.x + Math.sin(e.yaw) * 50, y: e.y + 130, z: e.z + Math.cos(e.yaw) * 50 }; const tx = P.x - from.x, ty = P.y + 100 - from.y, tz = P.z - from.z, l = Math.hypot(tx, ty, tz); setTimeout(() => { if (e.alive) { Combat.fireBolt(from, { x: tx / l, y: ty / l + 0.02, z: tz / l }, this.dmgOf(e) * 0.8, 2600); Sfx.at('rifle', e.x, e.y, e.z, 0.5); } }, 240); }
                    break;
                }
                const d = this.move(e, P.x, P.z, e.def.speed, dt, { through: true });
                this.base(e, d > 12 * M ? 'run' : 'walk', d > 12 * M ? 0.8 : 1);
                if (d < e.def.reach && e.atkCd <= 0) { e.state = 'attack'; e.st = 0; e.hitDone = false; e.atkDur = this.act(e, 'stab', 1.1); e.atkCd = e.def.rate; }
                break;
            }
            case 'attack':
                this.face(e, P.x, P.z, dt, 10); this.stop(e, dt);
                if (!e.hitDone && e.st >= e.atkDur * 0.42) { e.hitDone = true; if (Math.hypot(e.x - P.x, e.z - P.z) < e.def.reach * 1.3 + 40) P.hurt(this.dmgOf(e), e.x, e.z, 'stab'); }
                if (e.st >= e.atkDur) { e.state = 'chase'; e.st = 0; }
                break;
        }
    },


    // ============================================================================== БОСС — ХОЗЯИН ЛЕСА
    // Появляется в начале 99-й ночи (Events.onNight). Три фазы по здоровью (66% и 33%): ближний бой, топот с ударной волной,
    // рывок, призыв волков. Неуязвим при появлении и смене фазы; оглушение сокращено, отбрасывание почти нет.
    spawnBoss(o) {
        const opt = o || {};
        if (this.boss && this.boss.alive) return this.boss;
        if (this.deer) this.deerDismiss(true);
        const bots = window.Bots ? Bots.list.length : 0;
        const a = Math.random() * 6.28, r = Math.min(World.fogRadius - 8 * M, Camp.safeRadius() + 38 * M);
        const x = opt.x != null ? opt.x : Camp.x + Math.cos(a) * r, z = opt.z != null ? opt.z : Camp.z + Math.sin(a) * r;
        const e = this.spawn('warden', x, z, { always: true, hpK: 1 + DATA.balance.boss.perBotHp * bots, leash: 400 * M });
        e.boss = true; e.phase = opt.phase || 1; e.state = opt.risen ? 'hunt' : 'rise'; e.st = 0;
        e.slamCd = 7; e.dashCd = 12; e.summonCd = 24; e.atkCd = 1.5; e.stunImm = 0; e.teleN = 0;
        if (opt.hp != null) e.hp = U.clamp(opt.hp, 1, e.maxHp);
        this.ensureRig(e);
        this.boss = e; this.bossDead = false;
        if (e.state === 'rise') {
            UI.banner(Lang.t('boss.riseT'), Lang.t('boss.riseS'), '#c080ff'); Sfx.ui('sting'); Sfx.far('roar', x, 0, z, 1, 16000);
            Sky.setFogBoost(0.85, 'boss'); Sky.flash(0.7, '#b080ff', 0.8);
        }
        return e;
    },
    // Игрок возродился: босс отступает от лагеря и теряет несколько секунд
    bossRetreat() {
        const e = this.boss; if (!e || !e.alive || e.state === 'rise') return;
        const a = Math.random() * 6.28, r = Math.min(World.fogRadius - 8 * M, 38 * M);
        e.x = Camp.x + Math.cos(a) * r; e.z = Camp.z + Math.sin(a) * r; e.vx = e.vz = 0;
        e.state = 'recover'; e.st = -2.5; e.atkCd = 3; e.slamCd = Math.max(e.slamCd, 5); e._tgt = null;
    },
    bossDmg(e, k) { return e.def.dmg * k * (e.phase === 3 ? 1.25 : e.phase === 2 ? 1.1 : 1) * (e.enrage ? 1.3 : 1) * (e.dmgK || 1); },
    // Цели босса: игрок и живые боты
    bossTargets() { const t = []; if (!Player.dead) t.push(Player); if (window.Bots) for (const b of Bots.list) if (!b.dead) t.push(b); return t; },

    tickWarden(e, dt, dP) {
        e.slamCd -= dt; e.dashCd -= dt; e.summonCd -= dt;
        const P = this.targetOf(e);
        if (P !== Player) dP = Math.hypot(e.x - P.x, e.z - P.z);
        const f = e.hp / e.maxHp, ph = f <= DATA.balance.boss.phase3 ? 3 : f <= DATA.balance.boss.phase2 ? 2 : 1;
        if (ph > e.phase && e.state !== 'rise') this.bossPhase(e, ph);
        const spK = (e.phase === 3 ? 1.32 : e.phase === 2 ? 1.15 : 1) * (e.enrage ? 1.25 : 1);
        const gy = World.heightAt(e.x, e.z);
        switch (e.state) {
            case 'rise': {
                const T = DATA.balance.boss.rise;
                e.lift = -e.hgt * Math.max(0, 1 - e.st / T);
                this.stop(e, dt); this.base(e, 'idle');
                e._dustT = (e._dustT || 0) - dt;
                if (e._dustT <= 0) { e._dustT = 0.22; FX.dust(e.x + (Math.random() - 0.5) * 300, gy, e.z + (Math.random() - 0.5) * 300, 8, 2.2); }
                Cam.shake(0.18 * Math.max(0, 1 - dP / 6000));
                if (e.st >= T) { e.lift = 0; e.state = 'hunt'; e.st = 0; this.act(e, 'roar', 0.9); Sfx.at('bossRoar', e.x, e.y, e.z, 1); Cam.shake(0.7); FX.ring(e.x, gy + 10, e.z, 1800, '#c080ff'); }
                break;
            }
            case 'phase': {
                this.stop(e, dt); this.face(e, P.x, P.z, dt, 5);
                if (e.st >= DATA.balance.boss.phasePause) { e.state = 'hunt'; e.st = 0; e.summonCd = Math.min(e.summonCd, 2.2); }
                break;
            }
            case 'hunt': {
                if (P.dead) { this.stop(e, dt); this.base(e, 'idle'); break; }
                if (e.slamCd <= 0 && dP < 12 * M) { e.state = 'slam'; e.st = 0; e.hitDone = false; e.teleN = 0; e.slamCd = (e.phase === 3 ? 7 : 11) + Math.random() * 3; this.act(e, e.rig && e.rig.has('slam') ? 'slam' : 'roar', 1.15); Sfx.at('bossRoar', e.x, e.y, e.z, 1); break; }
                if (e.phase >= 2 && e.dashCd <= 0 && dP > 8 * M && dP < 26 * M) {
                    e.state = 'dashWind'; e.st = 0; e.dashCd = (e.phase === 3 ? 9 : 14) + Math.random() * 4; e.dashDir = Math.atan2(P.x - e.x, P.z - e.z);
                    this.act(e, 'roar', 1.3); Sfx.at('bossRoar', e.x, e.y, e.z, 0.9); break;
                }
                if (e.phase >= 2 && e.summonCd <= 0) { this.bossSummon(e); break; }
                const d = this.move(e, P.x, P.z, e.def.speed * spK, dt, { through: true });
                this.base(e, dP > 10 * M ? 'run' : 'walk', dP > 10 * M ? 0.85 : 1.1);
                if (d < e.def.reach && e.atkCd <= 0) {
                    e.state = 'swipe'; e.st = 0; e.hitDone = false; e.atkDur = this.act(e, 'swipe', 0.85);
                    e.atkCd = e.def.rate / (e.phase === 3 ? 1.4 : 1); Sfx.at('bossRoar', e.x, e.y, e.z, 0.8);
                }
                break;
            }
            case 'swipe': {
                this.face(e, P.x, P.z, dt, 8); this.stop(e, dt);
                if (!e.hitDone && e.st >= e.atkDur * 0.5) {
                    e.hitDone = true;
                    for (const t of this.bossTargets()) if (Math.hypot(e.x - t.x, e.z - t.z) < e.def.reach * 1.35 + e.rad * 0.4) { t.hurt(this.bossDmg(e, 1), e.x, e.z, 'warden'); if (t === Player) Cam.shake(0.45); }
                    Sfx.at('hit', e.x, e.y, e.z, 1);
                }
                if (e.st >= e.atkDur) { e.state = 'hunt'; e.st = 0; }
                break;
            }
            case 'slam': {
                // красное кольцо на земле предупреждает: через ~1.1 с — ударная волна по площади
                const R = DATA.balance.boss.slamRadius * M;
                this.face(e, P.x, P.z, dt, 4); this.stop(e, dt);
                if (!e.hitDone && e.st >= DATA.balance.boss.slamTell) {
                    e.hitDone = true;
                    FX.dust(e.x, gy, e.z, 22, 2.4); FX.ring(e.x, gy + 12, e.z, R * 2.4, '#ffb060'); FX.explosion(e.x, gy + 40, e.z, 700, 'frag');
                    Sky.flash(0.6, '#ffb868', 0.4); Cam.shake(0.9 * Math.max(0.35, 1 - dP / 9000)); Sfx.at('boom', e.x, e.y, e.z, 1);
                    for (const t of this.bossTargets()) {
                        const d = Math.hypot(t.x - e.x, t.z - e.z);
                        if (d < R && !(t.y > gy + 260)) t.hurt(this.bossDmg(e, DATA.balance.boss.slamK) * (1 - 0.45 * d / R), e.x, e.z, 'warden');
                    }
                }
                if (e.st >= 1.9) { e.state = 'hunt'; e.st = 0; }
                break;
            }
            case 'dashWind': {
                e.dashDir = U.dampAngle(e.dashDir, Math.atan2(P.x - e.x, P.z - e.z), 6, dt);
                e.yaw = e.dashDir; this.stop(e, dt); this.base(e, 'idle');
                if (e.st >= 0.85) { e.state = 'dash'; e.st = 0; e.hitDone = false; Sfx.at('bossRoar', e.x, e.y, e.z, 1); }
                break;
            }
            case 'dash': {
                const tx = e.x + Math.sin(e.dashDir) * 1000, tz = e.z + Math.cos(e.dashDir) * 1000;
                this.move(e, tx, tz, 17 * M, dt, { noTurn: true, through: true }); this.base(e, e.rig && e.rig.has('charge') ? 'charge' : 'run', 1.3);
                if (!e.hitDone) for (const t of this.bossTargets()) if (Math.hypot(e.x - t.x, e.z - t.z) < e.rad + 130) { e.hitDone = true; t.hurt(this.bossDmg(e, DATA.balance.boss.dashK), e.x - Math.sin(e.dashDir) * 100, e.z - Math.cos(e.dashDir) * 100, 'warden'); Cam.shake(0.7); Sfx.at('hit', e.x, e.y, e.z, 1); FX.hitSpark(t.x, t.y + 90, t.z, '#ff8a6a'); break; }
                if (Math.random() < dt * 14) FX.dust(e.x, gy, e.z, 3, 1.2);
                if (e.st >= 1.15) { e.state = 'recover'; e.st = 0; }
                break;
            }
            case 'recover': {
                this.stop(e, dt); this.base(e, 'idle');
                if (e.st >= 0.9) { e.state = 'hunt'; e.st = 0; }
                break;
            }
            case 'summon': {
                this.stop(e, dt); this.face(e, P.x, P.z, dt, 5);
                if (!e.hitDone && e.st >= 0.7) {
                    e.hitDone = true;
                    const alive = this.list.filter(m => m.alive && m.minion).length;
                    const g = this._groupId++, n = Math.max(0, Math.min(e.phase === 3 ? 4 : 3, DATA.balance.boss.minionLimit - alive));
                    for (let i = 0; i < n; i++) {
                        const a = Math.random() * 6.28, x = e.x + Math.cos(a) * (e.rad + 500), z = e.z + Math.sin(a) * (e.rad + 500);
                        const m = this.spawn(e.phase === 3 && i < 2 ? 'alpha' : 'wolf', x, z, { group: g, night: true, homeX: x, homeZ: z, leash: 300 * M, dmgK: DATA.balance.boss.minionDamage });
                        m.minion = true; m.state = 'chase'; m.st = 0; m.firstAlert = false;
                        FX.poof(x, World.heightAt(x, z) + 60, z, false); FX.ring(x, World.heightAt(x, z) + 10, z, 500, '#c080ff');
                    }
                    Sky.flash(0.5, '#b080ff', 0.5);
                }
                if (e.st >= 1.6) { e.state = 'hunt'; e.st = 0; }
                break;
            }
        }
    },
    bossSummon(e) {
        e.state = 'summon'; e.st = 0; e.hitDone = false; e.summonCd = (e.phase === 3 ? 17 : 24) + Math.random() * 5;
        this.act(e, e.rig && e.rig.has('summon') ? 'summon' : 'roar', 1.1); Sfx.at('bossRoar', e.x, e.y, e.z, 1); Sfx.far('howl', e.x, e.y, e.z, 1, 12000);
    },
    bossPhase(e, ph) {
        e.phase = ph; e.state = 'phase'; e.st = 0; e.enrage = !!e.enrage;
        this.act(e, 'roar', 0.75); Sfx.at('bossRoar', e.x, e.y, e.z, 1); Sfx.far('roar', e.x, e.y, e.z, 1, 14000);
        const gy = World.heightAt(e.x, e.z);
        FX.ring(e.x, gy + 12, e.z, 2200, '#c080ff'); FX.dust(e.x, gy, e.z, 18, 2.4); Sky.flash(0.9, '#b080ff', 0.7); Cam.shake(0.9);
        UI.banner(Lang.t(ph === 2 ? 'boss.p2T' : 'boss.p3T'), Lang.t(ph === 2 ? 'boss.p2S' : 'boss.p3S'), '#ff6a5a');
        // отталкиваем всех рядом
        for (const t of this.bossTargets()) { const d = Math.hypot(t.x - e.x, t.z - e.z); if (d < 9 * M) t.hurt(this.bossDmg(e, 0.5), e.x, e.z, 'warden'); }
        Game.autosave('boss');
    },
    onBossDead(e) {
        this.boss = null; this.bossDead = true;
        for (const m of this.list) if (m.alive && m.minion) { m.alive = false; m.deadT = 6.5; m.state = 'dead'; FX.poof(m.x, m.y + 60, m.z, false); }
        const gy = World.heightAt(e.x, e.z);
        FX.explosion(e.x, gy + 200, e.z, 1100, 'frag'); FX.ring(e.x, gy + 12, e.z, 3000, '#d8b0ff'); FX.sparkBurst(e.x, gy + 200, e.z, 60, '#e0c0ff');
        Sky.flash(1.4, '#e0c8ff', 1.2); Cam.shake(1); if (window.UiFX) UiFX.confetti(80, { colors: ['#e0c8ff', '#ffd24a', '#ffffff', '#b080ff'] });
        UI.banner(Lang.t('boss.deadT'), Lang.t('boss.deadS'), '#ffe066'); Sfx.ui('fanfare');
        Sky.setFogBoost(0, 'boss');
        if (window.Ach) Ach.event('boss', 1);
        if (Game.track) Game.track('boss_defeated', { day: Sky.day, mode: Game.hardcore ? 'hardcore' : 'normal' });
        if (window.Events) Events.onBossDead();
        Game.autosave('boss');
    },

    // ------------------------------------------------------------------------------ урон и смерть
    inFront(x, z, fx, fz, reach, minDot) {
        let best = null, bd = 1e9;
        for (const e of this.list) {
            if (!e.alive || !e.rig) continue;
            const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz) - e.rad;
            if (d > reach) continue;
            const dot = (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1);
            if (dot < minDot && d > 60) continue;
            const s = d - dot * 80;
            if (s < bd) { bd = s; best = e; }
        }
        return best;
    },

    dangerNear(x, z, r) {
        for (const e of this.list) {
            if (!e.alive || e.type === 'bunny') continue;
            if (e.state === 'idle' && e.type !== 'deer' && !e.raid) continue;
            if (U.dist2(e.x, e.z, x, z) < r * r) return true;
        }
        return false;
    },

    damage(e, dmg, sx, sz, o) {
        if (!e.alive) return;
        let opt = o || {};
        if (e.type === 'deer') return this.damageDeer(e, dmg, sx, sz, opt);
        if (e.type === 'ghost') {
            const G = DATA.balance.ghost;
            dmg *= opt.element === 'flash' ? G.flashK : opt.element === 'fire' ? G.fireK : opt.element === 'light' ? 1 : G.physicalK;
        }
        if (e.boss) {
            // босс: неуязвим при появлении и смене фазы, почти не отбрасывается, оглушение коротко и с перезарядкой
            if (e.state === 'rise' || e.state === 'phase') return;
            if (opt.stun && !(e.stunImm > 0)) { e.stun = Math.max(e.stun || 0, Math.min(opt.stun, 0.6)); e.stunImm = 4.5; }
            opt = Object.assign({}, opt, { knock: (opt.knock || 0) * 0.08, stun: 0, noStun: true });
        }
        dmg = Math.round(dmg);
        e.hp -= dmg;
        e.lastHurt = performance.now() / 1000;
        if (!opt.quiet) {
            e.flash = 0.11;
            if (e.rig) for (const m of e.rig.meshes) { m.renderOverlay = true; m.overlayColor = new BABYLON.Color3(1, 1, 1); m.overlayAlpha = 0.65; }
            const p = opt.pt || { x: e.x, y: e.y + e.hgt * 0.6, z: e.z };
            FX.hitSpark(p.x, p.y, p.z, '#fff2b0');
            UI.floatText({ x: e.x, y: e.y + e.hgt + 30, z: e.z }, opt.crit ? dmg + '!' : String(dmg), opt.crit ? '#ff8a2a' : '#ffe066', !!opt.crit);
            if (window.AttackFX) {
                AttackFX.react(e, opt);
                if (opt.fx || opt.crit) AttackFX.hit(p, { style: opt.fx && opt.fx.style, big: !!(opt.fx && opt.fx.big), fin: !!(opt.fx && opt.fx.fin), dx: opt.fx ? opt.fx.dx : 0, dz: opt.fx ? opt.fx.dz : 0, crit: !!opt.crit, kill: e.hp <= 0 });
            }
            Sfx.at('hit', e.x, e.y, e.z, 1);
            if (window.Player) { Cam.shake(0.14); }
            // отдача
            const dx = e.x - sx, dz = e.z - sz, d = Math.hypot(dx, dz) || 1, k = opt.knock || 0;
            e.vx += dx / d * k * 1.4; e.vz += dz / d * k * 1.4;
            if (opt.stun) { e.stun = Math.max(e.stun || 0, opt.stun); }
            if (e.rig && e.type !== 'bunny' && !opt.noStun && e.acting <= 0) e.rig.play('hit', { layer: 2, loop: false, fade: 0.04, restart: true, mask: null });
            if (e.rig && e.rig.layers[2].cur && e.rig.layers[2].cur.clip.name === 'hit') e.rig.layers[2].target = 1;
        }
        // агрессия: стая и зверь бросаются на обидчика
        if (e.state === 'idle' && e.type !== 'bunny') { e.state = 'chase'; e.st = 0; this.alertGroup(e); }
        if (e.type === 'wolf' && e.hp < e.maxHp * 0.22 && !e.guard && Math.random() < 0.5) { e.state = 'flee'; e.st = 0; }
        if (e.hp <= 0) this.kill(e);
    },

    kill(e) {
        e.alive = false; e.deadT = 0; e.state = 'dead';
        if (e._slamTell) e._slamTell.mesh.setEnabled(false);
        if (e.boss) this.onBossDead(e);
        if (e.sid != null) this.killed.add(e.sid);
        Player.stats.kills++;
        if (e.rig) {
            e.rig.stop(1, 0.05);
            e.rig.play('death', { layer: 2, loop: false, hold: true, fade: 0.06, mask: null, restart: true });
            e.rig.layers[2].target = 1; e.rig.layers[2].weight = 1;
        }
        FX.poof(e.x, e.y + e.hgt * 0.4, e.z, e.type === 'bear' || e.type === 'alpha');
        Sfx.at(e.type === 'bear' ? 'roar' : (e.type === 'bunny' ? 'squeak' : 'enemyhurt'), e.x, e.y, e.z, 1);
        // добыча
        for (const [id, chance, n] of e.def.drop) {
            if (Math.random() > chance) continue;
            const cnt = Math.max(1, Math.round(n * (0.6 + Math.random() * 0.8)));
            for (let i = 0; i < cnt; i++) Items.spawn(id, 1, e.x + (Math.random() - 0.5) * 100, e.z + (Math.random() - 0.5) * 100, { y: e.y + 100, vy: 380 });
        }
        if (e.guard && e.guard.key) {
            Items.spawn(e.guard.key, 1, e.x, e.z, { y: e.y + 140, vy: 520, delay: 0.8 });
            UI.toast(Lang.t('keyDropped'), 'good'); Sfx.ui('keys');
            FX.sparkBurst(e.x, e.y + 100, e.z, 24, '#ffe066'); FX.ring(e.x, e.y + 20, e.z, 500, '#ffe066');
        }
        if (e.type === 'cultist' && Math.random() < 0.5) Items.spawn('gem', 1, e.x + 40, e.z, { y: e.y + 90 });
        // монеты и задания
        const coins = Econ.killReward(e.type) * (e.night ? 1.5 : 1) * (e.guard ? 3 : 1);
        if (coins > 0) Econ.dropCoins(e.x, e.z, coins, 'kill');
        if (window.Quests) { Quests.event('kill', 1); Quests.event('kill_' + e.type, 1); }
    },

    updateDead(e, dt, idx) {
        e.deadT += dt;
        if (e.rig) { e.y = World.heightAt(e.x, e.z); e.rig.root.position.set(e.x, e.y - Math.max(0, e.deadT - 4) * 40, e.z); e.rig.update(dt); e.rig.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(0, e.yaw, 0); }
        if (e.deadT > 7.5) { this.dropRig(e); this.list.splice(idx, 1); }
    },

    // ------------------------------------------------------------------------------ ночные события
    nightSpawn() {
        if (Player.dead || Player.sleeping) return;
        if (Sky.day === DATA.time.totalNights || (this.boss && this.boss.alive)) return;
        const day = Sky.day;
        const rnd = Math.random;
        // ночные волки
        const nb = this.nightBoost || 1, sw = !!this.swarm;
        const nW = Math.min(sw ? 13 : 9, Math.ceil((1 + Math.floor(day / 7)) * nb * (sw ? 1.7 : 1)));
        if (this.list.filter(e => e.alive && e.night).length < (3 + Math.floor(day / 12)) * nb) {
            const g = this._groupId++;
            const a0 = rnd() * 6.28;
            for (let i = 0; i < nW; i++) {
                const a = a0 + (rnd() - 0.5) * 0.6, r = Camp.safeRadius() + (14 + rnd() * 10) * M;
                const x = Camp.x + Math.cos(a) * r, z = Camp.z + Math.sin(a) * r;
                const e = this.spawn(day > 25 && i === 0 && !sw ? 'alpha' : 'wolf', x, z, { night: true, group: g, homeX: x, homeZ: z, leash: 40 * M, dmgK: (1 + day * DATA.balance.nights.nightDamagePerDay) * (sw ? 0.75 : 1), hpK: sw ? 0.6 : 1, speedK: sw ? 1.18 : 1 });
                e.state = 'alert'; e.st = -0.4 * i; e.firstAlert = i === 0;
            }
            Sfx.far('howl', Camp.x + Math.cos(a0) * 5000, 0, Camp.z + Math.sin(a0) * 5000, 1, 12000);
        }
        // рейд культистов
        if (day >= DATA.balance.nights.startRaid && Math.random() < DATA.balance.nights.raidChance && !this.list.some(e => e.raid && e.alive)) this.raid();
    },
    raid() {
        const a0 = Math.random() * 6.28, r = Math.min(World.fogRadius - 300, 60 * M);
        const n = Math.min(7, 3 + Math.floor(Sky.day / 12));
        UI.banner(Lang.t('raid'), Lang.t('raidSub'), '#c05aff'); Sfx.ui('warn'); Sfx.at('alarm', Camp.x, 0, Camp.z, 1);
        const g = this._groupId++;
        for (let i = 0; i < n; i++) {
            const a = a0 + (Math.random() - 0.5) * 0.5, x = Camp.x + Math.cos(a) * r, z = Camp.z + Math.sin(a) * r;
            this.spawn('cultist', x, z, { raid: true, ranged: i % 3 === 1, group: g, dmgK: 1 + Sky.day * DATA.balance.nights.raidDamagePerDay, homeX: x, homeZ: z, leash: 200 * M, speedK: 1.15 });
        }
    },
    onDawn() {
        // ночные звери и рейд рассеиваются
        for (const e of this.list) if (e.alive && (e.night || e.raid)) { e.alive = false; e.deadT = 6.8; e.state = 'dead'; FX.poof(e.x, e.y + 80, e.z, false); if (e.rig) e.rig.root.setEnabled(false); }
        if (this.deer) this.deerDismiss(true);
    },

    // ============================================================================== ОЛЕНЬ
    onNight() {
        // Олень появляется с началом ночи
        if (Sky.day >= DATA.time.totalNights) return;
        this.deerSpawn();
    },

    deerSpawn() {
        if (this.deer && this.deer.alive) return;
        const a = Math.random() * 6.28;
        const r = Math.max(Camp.safeRadius() + 22 * M, 46 * M);
        const rr = Math.min(r, World.fogRadius - 5 * M);
        const x = Camp.x + Math.cos(a) * rr, z = Camp.z + Math.sin(a) * rr;
        const e = this.spawn('deer', x, z, { always: true });
        e.state = 'appear'; e.st = 0; e.alpha = 0; e.tension = 0;
        e.budget = 160 + Sky.day * 9; e.stunAcc = 0; e.screamT = 6 + Math.random() * 6;
        e.nextRush = 9 + Math.random() * 10;
        this.ensureRig(e);
        if (e.rig) for (const m of e.rig.meshes) m.visibility = 0;
        this.deer = e;
        Sfx.ui('sting'); Sfx.far('screech', x, 0, z, 0.7, 14000);
        UI.banner(Lang.t('deerComes'), Lang.t('deerComesSub'), '#ff5a4a');
        Sky.fogFear = 0.6;
    },

    deerDismiss(quiet) {
        const e = this.deer; if (!e) return;
        this.deer = null;
        e.alive = false; e.state = 'dead'; e.deadT = 7;
        FX.poof(e.x, e.y + 150, e.z, true);
        if (e.rig) e.rig.root.setEnabled(false);
        Sky.fogFear = 0;
        Sfx.want.chase = false;
    },

    beamHits(e) {
        if (Player.flashBeam < 0.6 || Player.heldId !== 'flashlight') return false;
        const c = Cam.cam.position, f = Cam.fwd;
        const tx = e.x - c.x, ty = e.y + 180 - c.y, tz = e.z - c.z, l = Math.hypot(tx, ty, tz);
        if (l > 34 * M) return false;
        return (tx * f.x + ty * f.y + tz * f.z) / l > 0.955;
    },

    updateDeer(dt) {
        const e = this.deer;
        if (!e || !e.alive) { this.fearTarget = 0; return; }
        const P = Player;
        const dP = Math.hypot(e.x - P.x, e.z - P.z);
        e.dP = dP;
        e.st += dt;
        if (e.atkCd > 0) e.atkCd -= dt;
        const safe = Camp.isSafe(P.x, P.z, 100);
        const R = Camp.safeRadius();
        // появление: проявляется из тумана
        if (e.alpha < 1) { e.alpha = Math.min(1, e.alpha + dt * 0.4); if (e.rig) for (const m of e.rig.meshes) m.visibility = e.alpha; }
        // оглушение фонарём
        if (e.state !== 'stun' && e.state !== 'flee' && e.state !== 'appear' && this.beamHits(e)) e.stunAcc += dt; else e.stunAcc = Math.max(0, e.stunAcc - dt * 0.8);
        if (e.stunAcc > 1.4 && e.state !== 'stun') this.deerStun(e);
        this.dscale = DATA.scale(Sky.day);
        switch (e.state) {
            case 'appear': {
                // стоит на опушке и смотрит, потом начинает красться
                this.face(e, P.x, P.z, dt, 3); this.stop(e, dt); this.base(e, 'idle');
                if (e.st > 7 && e.alpha >= 1) { e.state = 'stalk'; e.st = 0; }
                break;
            }
            case 'stalk': {
                this.face(e, P.x, P.z, dt, 4);
                const edge = R + 4.5 * M;
                if (!safe && (dP < 30 * M || !Camp.lit)) { e.state = 'charge'; e.st = 0; break; }
                if (safe || dP < edge + 900) {
                    // вокруг границы света
                    if (dP > edge + 40 || !safe) this.move(e, safe ? Camp.x + (e.x - Camp.x) / Math.max(1, Math.hypot(e.x - Camp.x, e.z - Camp.z)) * edge : P.x, safe ? Camp.z + (e.z - Camp.z) / Math.max(1, Math.hypot(e.x - Camp.x, e.z - Camp.z)) * edge : P.z, 1.9 * M, dt, { noTurn: true, through: true });
                    else {
                        const ang = Math.atan2(e.z - Camp.z, e.x - Camp.x) + dt * 0.28;
                        this.move(e, Camp.x + Math.cos(ang) * edge, Camp.z + Math.sin(ang) * edge, 1.6 * M, dt, { noTurn: true, through: true });
                    }
                    this.base(e, 'stalk', 0.9);
                } else {
                    this.move(e, P.x, P.z, 1.8 * M, dt, { through: true }); this.base(e, 'stalk', 0.95);
                }
                // крик
                e.screamT -= dt;
                if (e.screamT <= 0 && dP < 60 * M) {
                    e.screamT = 12 + Math.random() * 12;
                    this.act(e, 'scream', 1); Sfx.at('screech', e.x, e.y, e.z, 1); Sfx.far('screech', e.x, e.y, e.z, 1, 14000);
                    Cam.shake(0.5 * Math.max(0.3, 1 - dP / (60 * M))); UI.flash('#300', 0.25, 0.8);
                }
                // рывки-испытания к границе
                e.nextRush -= dt;
                if (e.nextRush <= 0 && safe) { e.nextRush = 16 + Math.random() * 14; e.state = 'rush'; e.st = 0; }
                break;
            }
            case 'rush': {
                // рывок к границе света и обратно
                const edge = R + 1.2 * M;
                const ang = Math.atan2(P.z - Camp.z, P.x - Camp.x);
                const tx = Camp.x + Math.cos(ang) * edge, tz = Camp.z + Math.sin(ang) * edge;
                this.face(e, P.x, P.z, dt, 8);
                const d = this.move(e, tx, tz, 8.2 * M, dt, { noTurn: true, through: true }); this.base(e, 'run', 1);
                if (d < 90 || e.st > 3) { this.act(e, 'scream', 1.2); Sfx.at('screech', e.x, e.y, e.z, 1); Cam.shake(0.45); UI.flash('#400', 0.3, 0.6); e.state = 'stalk'; e.st = 0; e.screamT = 6; }
                break;
            }
            case 'charge': {
                this.face(e, P.x, P.z, dt, 9);
                if (safe && Camp.isSafe(P.x, P.z)) { e.state = 'stalk'; e.st = 0; break; }
                const d = this.move(e, P.x, P.z, e.def.speed, dt, { noTurn: true, through: true }); this.base(e, 'run', 1);
                if (d < e.def.reach && e.atkCd <= 0) { e.state = 'attack'; e.st = 0; e.hitDone = false; e.atkDur = this.act(e, 'attack', 1.0); e.atkCd = e.def.rate; Sfx.at('screech', e.x, e.y, e.z, 1); }
                break;
            }
            case 'attack': {
                this.face(e, P.x, P.z, dt, 12); this.stop(e, dt);
                if (!e.hitDone && e.st >= e.atkDur * 0.56) {
                    e.hitDone = true;
                    if (Math.hypot(e.x - P.x, e.z - P.z) < e.def.reach * 1.5 + 60) {
                        const h = P.hunger < 20 ? 1.3 : 1;
                        P.hurt(e.def.dmg * this.dscale * h, e.x, e.z, 'deer'); Cam.shake(0.7); UI.flash('#600', 0.5, 0.8);
                    }
                }
                if (e.st >= e.atkDur) { e.state = safe ? 'stalk' : 'charge'; e.st = 0; }
                break;
            }
            case 'stun': {
                this.stop(e, dt);
                e.stunT -= dt;
                if (e.stunT <= 0 || e.budget <= 0) {
                    if (e.budget <= 0) { e.state = 'flee'; e.st = 0; e.fleeDir = Math.atan2(e.z - Camp.z, e.x - Camp.x); this.act(e, 'scream', 1); Sfx.at('screech', e.x, e.y, e.z, 1); UI.banner(Lang.t('deerFled'), '', '#9aff9a'); e.enrage = false; }
                    else { e.state = 'charge'; e.st = 0; e.atkCd = 0.4; }
                }
                break;
            }
            case 'flee': {
                const tx = e.x + Math.cos(e.fleeDir) * 900, tz = e.z + Math.sin(e.fleeDir) * 900;
                this.move(e, tx, tz, 9.5 * M, dt, { through: true }); this.base(e, 'run', 1.2);
                e.alpha = Math.max(0, 1 - e.st / 3); if (e.rig) for (const m of e.rig.meshes) m.visibility = e.alpha;
                if (e.st > 3) this.deerDismiss();
                break;
            }
        }
        // дыхание/музыка/страх
        this.fearTarget = U.clamp((1 - dP / (48 * M)) * (e.state === 'appear' ? 0.5 : 1) * e.alpha, 0, 1);
        if (e.state === 'charge' || e.state === 'attack') this.fearTarget = Math.max(this.fearTarget, 0.9);
    },

    deerStun(e) {
        e.state = 'stun'; e.st = 0; e.stunT = 5.0; e.stunAcc = 0;
        e.stunned = true;
        const d = this.act(e, 'stun', 1, true);
        e.baseAnim = null;
        e.rig && e.rig.play('stun', { layer: 2, loop: true, fade: 0.1, mask: null });
        if (e.rig) e.rig.layers[2].target = 1;
        Sfx.at('screech', e.x, e.y, e.z, 1); UI.banner(Lang.t('deerStunned'), Lang.t('deerStunnedSub'), '#ffe066');
        FX.ring(e.x, e.y + 20, e.z, 700, '#fff2b0'); Cam.shake(0.3); UI.flash('#fff', 0.35, 0.5);
    },

    damageDeer(e, dmg, sx, sz, opt) {
        const stunned = e.state === 'stun';
        const eff = stunned ? dmg : dmg * 0.22;
        e.budget -= eff;
        e.flash = 0.11;
        if (e.rig) for (const m of e.rig.meshes) { m.renderOverlay = true; m.overlayColor = new BABYLON.Color3(1, 0.4, 0.4); m.overlayAlpha = 0.5; }
        const p = opt.pt || { x: e.x, y: e.y + 180, z: e.z };
        FX.hitSpark(p.x, p.y, p.z, '#ff6a5a');
        UI.floatText({ x: e.x, y: e.y + 340, z: e.z }, String(Math.round(eff)), stunned ? '#ffe066' : '#c8c8c8');
        Sfx.at('hit', e.x, e.y, e.z, 1);
        if (e.rig && stunned) e.rig.play('hit', { layer: 1, loop: false, fade: 0.03, restart: true, mask: e.rig.maskOf(['Chest']) });
        if (e.rig && stunned) e.rig.layers[1].target = 1;
        if (!stunned) { e.hitReact = 0.2; if (e.state === 'stalk' || e.state === 'appear') { e.state = 'charge'; e.st = 0; } }
        if (e.budget <= 0 && !stunned && e.state !== 'flee') { e.state = 'flee'; e.st = 0; e.fleeDir = Math.atan2(e.z - Camp.z, e.x - Camp.x); Sfx.at('screech', e.x, e.y, e.z, 1); UI.banner(Lang.t('deerFled'), '', '#9aff9a'); }
    },

    // Олень ломится к спящему игроку
    deerSleeperAttack() {
        const P = Player;
        if (!this.deer) this.deerSpawn();
        const e = this.deer; if (!e) return;
        e.always = true;
        const a = Math.random() * 6.28;
        e.x = P.x + Math.cos(a) * 320; e.z = P.z + Math.sin(a) * 320;
        e.alpha = 1; if (e.rig) for (const m of e.rig.meshes) m.visibility = 1;
        e.state = 'attack'; e.st = 0; e.hitDone = false; e.atkCd = 1.6;
        e.yaw = Math.atan2(P.x - e.x, P.z - e.z);
        e.atkDur = this.act(e, 'attack', 1.0);
        Sfx.ui('sting'); Sfx.at('screech', e.x, e.y, e.z, 1);
        UI.flash('#600', 0.7, 1.2); Cam.shake(0.8);
        UI.banner(Lang.t('deerSleep'), Lang.t('fireLowSub'), '#ff5a4a');
        const tb = Camp.fuel; Camp.fuel = Math.max(Camp.fuel, 6);
    },

    // ------------------------------------------------------------------------------ страх (экранные эффекты)
    fearTarget: 0,
    updateFear(dt) {
        this.fear = U.damp(this.fear, Math.max(this.fearTarget, this.ghostFear || 0), 2.2, dt);
        Sky.fogFear = Math.max(this.deer ? 0.25 : 0, this.fear * 0.9);
        Sfx.want.chase = !!(this.deer && this.deer.alive && this.deer.state !== 'flee' && this.fear > 0.55);
    },

    // ------------------------------------------------------------------------------ полоски здоровья
    updateBars(dt) {
        // UI сам рисует по списку; здесь — только выбор кандидатов
        const now = performance.now() / 1000;
        this.barList = this.list.filter(e => e.alive && e.rig && e.type !== 'deer' && !e.boss && now - e.lastHurt < 5 && e.hp < e.maxHp);
    },

    clear() {
        for (const e of this.list) { e.alive = false; this.dropRig(e); }
        this.list.length = 0; this.deer = null; this.boss = null; this.bossDead = false; this.fear = 0; this.fearTarget = 0; this.ringDone = []; Sky.clearFog();
    },

    state() {
        const fields = ['type', 'x', 'z', 'yaw', 'hp', 'maxHp', 'state', 'st', 'sid', 'group', 'guard', 'night', 'raid', 'ranged', 'dmgK', 'speedK', 'always', 'home', 'atkCd', 'stun', 'trapped', 'slow', 'minion', 'leader', 'atkDur', 'hitDone', 'chargeDir', 'alpha', 'budget', 'stunAcc', 'stunT', 'screamT', 'nextRush', 'fleeDir', 'firstAlert'];
        return { killed: [...this.killed], killedGuards: this.list.filter(e => e.guard && !e.alive).map(e => e.guard.key),
            raidT: this.raidT, actors: this.list.filter(e => e.alive && !e.boss && !e.gold).map(e => {
                const row = {}; for (const key of fields) if (e[key] !== undefined) row[key] = e[key]; return row;
            }) };
    },
    // Босс восстанавливается Events.bs раньше этого метода. Золотой кролик принадлежит Events.cur.
    loadState(s) {
        if (!s || !Array.isArray(s.actors)) return;
        for (const e of this.list) if (!e.boss && !e.gold) { e.alive = false; this.dropRig(e); }
        this.list = this.list.filter(e => e.boss || e.gold); this.deer = null;
        this.raidT = Number.isFinite(s.raidT) ? Math.max(0, s.raidT) : 0;
        this.killed = new Set(Array.isArray(s.killed) ? s.killed.filter(Number.isFinite) : []);
        const fields = ['yaw', 'state', 'st', 'sid', 'group', 'guard', 'night', 'raid', 'ranged', 'dmgK', 'speedK', 'always', 'atkCd', 'stun', 'trapped', 'slow', 'minion', 'leader', 'atkDur', 'hitDone', 'chargeDir', 'alpha', 'budget', 'stunAcc', 'stunT', 'screamT', 'nextRush', 'fleeDir', 'firstAlert'];
        for (const row of s.actors.slice(0, 600)) {
            if (!DATA.enemies[row.type] || !ENEMY_RIG[row.type] || row.type === 'warden' || !Number.isFinite(row.x) || !Number.isFinite(row.z) || !(row.hp > 0)) continue;
            if (row.sid != null && this.killed.has(row.sid)) continue;
            if (row.minion && !(this.boss && this.boss.alive)) continue;
            const e = this.spawn(row.type, row.x, row.z, {});
            e.maxHp = Number.isFinite(row.maxHp) && row.maxHp > 0 ? row.maxHp : e.maxHp;
            e.hp = Math.min(e.maxHp, row.hp);
            for (const key of fields) if (row[key] !== undefined && (typeof row[key] !== 'number' || Number.isFinite(row[key]))) e[key] = row[key];
            if (row.home && Number.isFinite(row.home.x) && Number.isFinite(row.home.z) && Number.isFinite(row.home.r)) e.home = { ...row.home };
            if (e.type === 'deer') this.deer = e;
            this._groupId = Math.max(this._groupId, (e.group || 0) + 1);
        }
    },
};

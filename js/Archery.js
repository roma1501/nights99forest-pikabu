// Archery.js — лук: модель в левой руке (плечи-трубки гнутся при натяжении, тетива, стрела на тетиве), стойка лучника
// (корпус боком к цели, левая рука держит лук на линии взгляда, правая тянет тетиву к щеке — двухзвенный IK поверх
// анимации, плавно смешивается с ней), цикл «натянуть → (держать) → выстрел → достать стрелу из-за плеча».
// Стрелы — снаряды с гравитацией: попадание во врага (стрела застревает в кости тела и исчезает вместе с ним, подобрать
// нельзя), в дерево, камень, постройку или землю (стрела торчит там, куда попала; свои стрелы подбираются, проходя рядом,
// стрелы ботов через несколько секунд исчезают). Срубили дерево со стрелами — они падают на землю предметом.
// Игрок и бот-охотник используют один код. Позу ставит onBeforeRender сцены — после всех rig.update кадра.

/** @satisfies {Record<string, any>} */
const Archery = {
    scene: /** @type {any} */ (null), view: /** @type {any} */ (null),
    bows: /** @type {any[]} */ ([]), flying: /** @type {any[]} */ ([]), stuck: /** @type {any[]} */ ([]),
    _tpl: /** @type {any} */ (null), _mats: /** @type {any} */ (null), _warned: false,
    LEN: 72,              // длина стрелы, px (0.72 м)
    SPEED: 5600,          // px/с
    GRAV: 760,            // px/с²
    DRAW: 0.42,           // натяжение, с
    REL: 0.12,            // отпускание тетивы, с
    NOCK: 0.4,            // достать и наложить новую стрелу, с
    MAX_STUCK: 60,        // торчащих стрел в мире (старые исчезают)
    MAX_IN_ENEMY: 6,
    TWIST: 1.05,          // поворот корпуса боком к цели, рад

    init(view) {
        if (this.scene === view.scene) return;
        this.scene = view.scene; this.view = view; this._tpl = null; this._mats = null;
        this.bows = []; this.flying = []; this.stuck = [];
        view.scene.onBeforeRenderObservable.add(() => this.frame());
    },

    // ------------------------------------------------------------------------------ модели
    _template() {
        if (this._tpl && !this._tpl.isDisposed()) return this._tpl;
        const B = BABYLON.MeshBuilder, scene = this.scene, L = this.LEN;
        const paint = (m, hex) => {
            const c = BABYLON.Color3.FromHexString(hex), n = m.getTotalVertices(), a = new Float32Array(n * 4);
            for (let i = 0; i < n; i++) { a[i * 4] = c.r; a[i * 4 + 1] = c.g; a[i * 4 + 2] = c.b; a[i * 4 + 3] = 1; }
            m.setVerticesData(BABYLON.VertexBuffer.ColorKind, a);
            return m;
        };
        // начало координат — острие, стрела вдоль +Z назад к хвосту (−Z)
        const shaft = B.CreateCylinder('arShaft', { height: L - 8, diameter: 1.9, tessellation: 5 }, scene);
        shaft.rotation.x = Math.PI / 2; shaft.position.z = -(8 + (L - 8) / 2);
        const head = B.CreateCylinder('arHead', { height: 10, diameterTop: 0, diameterBottom: 4.8, tessellation: 4 }, scene);
        head.rotation.x = Math.PI / 2; head.position.z = -5;
        const parts = [paint(shaft, '#b5864e'), paint(head, '#d3dae2')];
        for (let i = 0; i < 3; i++) {
            const a = i * Math.PI * 2 / 3, fin = B.CreateBox('arFin', { width: 0.6, height: 4.8, depth: 13 }, scene);
            fin.position.set(Math.cos(a) * 2.7, Math.sin(a) * 2.7, -(L - 11)); fin.rotation.z = a - Math.PI / 2;
            parts.push(paint(fin, i === 0 ? '#f2efe6' : '#d8402f'));
        }
        const nock = B.CreateBox('arNock', { width: 2.6, height: 2.6, depth: 3 }, scene);
        nock.position.z = -(L - 1.5); parts.push(paint(nock, '#3a2a1a'));
        const tpl = BABYLON.Mesh.MergeMeshes(parts, true, true);
        const mat = new BABYLON.StandardMaterial('arrowMat', scene);
        mat.diffuseColor = new BABYLON.Color3(1, 1, 1); mat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
        tpl.name = 'arrowTpl'; tpl.material = mat; tpl.isPickable = false; tpl.position.y = -1e5;
        this._tpl = tpl;
        return tpl;
    },
    _arrow(name) { const m = this._template().createInstance(name || 'arrow'); m.isPickable = false; m.rotationQuaternion = new BABYLON.Quaternion(); return m; },

    _bowMats() {
        if (this._mats && !this._mats.wood.isDisposed?.()) return this._mats;
        const mk = (n, hex, sp) => { const m = new BABYLON.StandardMaterial(n, this.scene); m.diffuseColor = BABYLON.Color3.FromHexString(hex); m.specularColor = new BABYLON.Color3(sp, sp, sp); return m; };
        this._mats = { wood: mk('bowWood', '#8a5a2a', 0.12), leather: mk('bowLeather', '#3b2a20', 0.05), rope: mk('bowRope', '#c9a46a', 0.05) };
        return this._mats;
    },

    // Плечи лука одной трубкой: верхний кончик → рукоять → нижний кончик; bend 0..1 — натяжение
    _limbPath(bend) {
        const prof = [[6, 0.6], [17, -0.4], [28, -2.6], [38, -5.6], [46, -8.6], [51, -10], [54.5, -8.4]];
        const k = 1 + 0.8 * bend, pts = [];
        const at = (y, z) => new BABYLON.Vector3(0, y * (1 - 0.06 * bend * (y / 55) * (y / 55)), z * k);
        for (let i = prof.length - 1; i >= 0; i--) pts.push(at(prof[i][0], prof[i][1]));
        for (let i = 0; i < prof.length; i++) pts.push(at(-prof[i][0], prof[i][1]));
        return pts;
    },
    _limbs(bend, inst) {
        const path = this._limbPath(bend);
        const radiusFunction = (i) => { const y = Math.abs(path[Math.min(i, path.length - 1)].y); return 1.35 + 1.7 * Math.max(0, 1 - y / 56); };
        return BABYLON.MeshBuilder.CreateTube('bowLimbs', { path, radiusFunction, tessellation: 6, cap: BABYLON.Mesh.CAP_ALL, updatable: true, instance: inst || undefined }, this.scene);
    },

    // Лук в руке: корень в мире (каждый кадр ставится в кулак левой руки), owner — Player или бот
    makeBow(owner) {
        const scene = this.scene, mats = this._bowMats();
        const root = new BABYLON.TransformNode('bowRoot', scene);
        root.rotationQuaternion = new BABYLON.Quaternion();
        const limbs = this._limbs(0, null); limbs.material = mats.wood; limbs.parent = root;
        const grip = BABYLON.MeshBuilder.CreateBox('bowGrip', { width: 4.6, height: 15, depth: 6 }, scene); grip.material = mats.leather; grip.parent = root;
        const meshes = [limbs, grip];
        for (const y of [-9, 9]) { const r = BABYLON.MeshBuilder.CreateCylinder('bowWrap', { height: 2.4, diameter: 6.2, tessellation: 8 }, scene); r.material = mats.rope; r.parent = root; r.position.y = y; meshes.push(r); }
        const path = this._limbPath(0);
        const str = BABYLON.MeshBuilder.CreateLines('bowString', { points: [path[0], new BABYLON.Vector3(0, 0, path[0].z), path[path.length - 1]], updatable: true }, scene);
        str.color = new BABYLON.Color3(0.95, 0.94, 0.86); str.parent = root; str.isPickable = false;
        const arrow = this._arrow('nockArrow'); arrow.parent = root;
        for (const m of meshes) { m.isPickable = false; m.receiveShadows = false; if (this.view) this.view.addShadowCaster(m, false); }
        /** @type {any} */ (root)._meshes = meshes.concat([str, arrow]);
        const b = { owner, root, limbs, str, arrow, bend: 0, st: 'idle', t: 0, d: 0, a: 0, idleAim: 0, nocked: true, has: true, queue: 0, lastT: -1, N: null };
        /** @type {any} */ (root)._bow = b;
        this.bows.push(b);
        return root;
    },
    bowOf(owner) { const r = owner && (owner === Player ? owner.heldRoot : owner.held); return r && !r.isDisposed() ? r._bow || null : null; },

    // ------------------------------------------------------------------------------ цикл выстрела (общий)
    // ctl: { want — нажатие/очередь, hold — кнопка зажата, has — есть стрелы, cancel — бег/действие, fire() → выстрел }
    step(b, dt, ctl) {
        b.t += dt;
        b.has = !!ctl.has;
        if (ctl.cancel && (b.st === 'draw' || b.st === 'hold')) { b.st = 'idle'; b.t = 0; b.d = 0; }
        switch (b.st) {
            case 'idle':
                b.nocked = b.has;
                b.d = Math.max(0, b.d - dt * 6);
                if (ctl.want && !ctl.cancel) {
                    if (!b.has) { if (ctl.empty) ctl.empty(); }
                    else { b.st = 'draw'; b.t = 0; b.queue = 0; if (ctl.draw) ctl.draw(); }
                }
                break;
            case 'draw':
                b.d = Math.min(1, b.t / this.DRAW);
                if (b.d >= 1) { if (ctl.hold) { b.st = 'hold'; b.t = 0; } else this._release(b, ctl); }
                break;
            case 'hold':
                b.d = 1;
                if (!ctl.hold) this._release(b, ctl);
                break;
            case 'release':
                if (b.t >= this.REL) { b.st = 'nock'; b.t = 0; }
                break;
            case 'nock':
                b.nocked = b.has && b.t / this.NOCK > 0.72;
                if (b.t >= this.NOCK) { b.st = 'idle'; b.t = 0; b.nocked = b.has; }
                break;
        }
        if (b.st !== 'idle') b.idleAim = 1.1; else b.idleAim = Math.max(0, b.idleAim - dt);
        const target = b.st !== 'idle' || b.idleAim > 0 ? 1 : 0;
        b.a = U.damp(b.a, target, target > b.a ? 14 : 4, dt);
        if (b.a < 0.002) b.a = 0;
    },
    _release(b, ctl) {
        b.st = 'release'; b.t = 0; b.d = 0; b.nocked = false;
        if (ctl.fire) ctl.fire();
    },

    // Игрок с луком в руке (Player.actions): тап — натянуть и выстрелить, удержание — держать натянутым до отпускания
    playerInput(P, def, dt) {
        const b = this.bowOf(P); if (!b) return;
        const blocked = (window.UI && UI.blocking()) || Camp.placing;
        const down = Input.down('attack') && !blocked;
        if (Input.pressed('attack') && !blocked) b.queue = 0.3; else if (b.queue > 0) b.queue -= dt;
        this.step(b, dt, {
            want: down || b.queue > 0, hold: down, has: Inv.has(def.ammo, 1), cancel: P.sprinting || !!(P.busy && P.busy.lock),
            empty: () => { if (Input.pressed('attack')) { if (window.UI) UI.toast(Lang.t('noAmmo'), 'warn'); if (window.Sfx) Sfx.ui('empty'); } b.queue = 0; },
            draw: () => { if (window.Sfx) Sfx.at('bowdraw', P.x, P.y, P.z, 0.6); },
            fire: () => this.firePlayer(P, def, b),
        });
    },
    // Пока лук натянут или только что стрелял — корпус за камерой, шаг медленнее, при удержании — прицел камеры
    turning(P) { const b = this.bowOf(P); return !!b && (b.st !== 'idle' || b.a > 0.5); },
    slow(P) { const b = this.bowOf(P); return !!b && (b.st === 'draw' || b.st === 'hold'); },
    aimZoom(P) { const b = this.bowOf(P); return !!b && b.st === 'hold'; },

    firePlayer(P, def, b) {
        if (!Inv.take(def.ammo, 1)) return;
        const from = this._tipWorld(b);
        const range = (def.range || 55) * M;
        // точка под прицелом: луч камеры от игрока вперёд (то, что за спиной, не учитываем)
        const c = Cam.cam.position, f = Cam.fwd;
        const t0 = Math.max(0, (P.x - c.x) * f.x + (P.y + 1.45 * M - c.y) * f.y + (P.z - c.z) * f.z);
        const p0 = { x: c.x + f.x * t0, y: c.y + f.y * t0, z: c.z + f.z * t0 };
        const hit = this._trace(p0, f, range, 'player');
        const tp = hit ? hit.p : { x: p0.x + f.x * range, y: p0.y + f.y * range, z: p0.z + f.z * range };
        const dir = this._ballistic(from, tp, this.SPEED, this.GRAV);
        const crit = Math.random() < 0.08;
        this.launch({ from, dir, owner: 'player', dmg: def.dmg * P.lvDmgK() * (crit ? 1.5 : 1), crit });
        P.faceYaw = Cam.yaw;
        if (window.Sfx) Sfx.at('bowshot', P.x, P.y, P.z, 0.9);
        Cam.shake(0.1); Cam.kick(0.012);
        if (window.AttackFX) AttackFX.shot(P, from, dir, 'bow', 0.6);
        if (window.UI) UI.objectiveEvent('shoot');
    },

    // Бот-охотник: натягивает (видно натяжение), через DRAW стрела летит в цель
    botShoot(bot, e, def, onKill) {
        const b = this.bowOf(bot); if (!b) return false;
        if (b.st !== 'idle') return false;
        bot.aimAt = e;
        this.step(b, 0, { want: true, hold: true, has: true });
        const fire = () => {
            if (b.st !== 'draw' && b.st !== 'hold') return;
            this._release(b, {});
            const from = this._tipWorld(b);
            const ty = e.y + (e.hgt || 100) * 0.5;
            const to = { x: e.x + (Math.random() - 0.5) * 30, y: ty, z: e.z + (Math.random() - 0.5) * 30 };
            const dir = this._ballistic(from, to, this.SPEED, this.GRAV);
            const was = e.alive;
            this.launch({ from, dir, owner: 'bot', dmg: def.dmg * (1 + Sky.day * 0.015), crit: false, onHit: (en) => { if (was && en === e && !e.alive && onKill) onKill(); } });
            if (window.Sfx) Sfx.at('bowshot', bot.x, bot.y, bot.z, 0.6);
        };
        bot.bowPend = { left: this.DRAW, fn: fire };
        return true;
    },
    // Кадр бота: тянет таймеры натяжения/наложения стрелы
    botTick(bot, dt) {
        const b = this.bowOf(bot); if (!b) return;
        if (bot.bowPend) { bot.bowPend.left -= dt; if (bot.bowPend.left <= 0) { const f = bot.bowPend.fn; bot.bowPend = null; f(); } }
        this.step(b, dt, { want: false, hold: b.st === 'draw' || b.st === 'hold', has: true, cancel: !!bot.dead });
        if (b.a <= 0) bot.aimAt = null;
    },

    // ------------------------------------------------------------------------------ полёт и попадания
    launch(o) {
        const a = this._arrow('arrowFly');
        const s = this.SPEED;
        const f = { inst: a, x: o.from.x, y: o.from.y, z: o.from.z, vx: o.dir.x * s, vy: o.dir.y * s, vz: o.dir.z * s, owner: o.owner, dmg: o.dmg, crit: !!o.crit, life: 0, sx: o.from.x, sz: o.from.z, onHit: o.onHit || null };
        this._orient(a, f.vx, f.vy, f.vz);
        a.position.set(f.x, f.y, f.z);
        this.flying.push(f);
        return f;
    },
    _orient(m, dx, dy, dz) {
        const l = Math.hypot(dx, dy, dz) || 1, to = new BABYLON.Vector3(dx / l, dy / l, dz / l);
        BABYLON.Quaternion.FromUnitVectorsToRef(BABYLON.Vector3.Forward(), to, m.rotationQuaternion);
    },
    _ballistic(from, to, v, g) {
        const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y, dh = Math.hypot(dx, dz);
        if (dh < 1) { const l = Math.hypot(dx, dy, dz) || 1; return { x: dx / l, y: dy / l, z: dz / l }; }
        const v2 = v * v, disc = v2 * v2 - g * (g * dh * dh + 2 * dy * v2);
        const ang = disc >= 0 ? Math.atan((v2 - Math.sqrt(disc)) / (g * dh)) : Math.atan2(dy, dh);
        return { x: dx / dh * Math.cos(ang), y: Math.sin(ang), z: dz / dh * Math.cos(ang) };
    },
    // Высота препятствия над землёй (деревья, камни, постройки)
    _top(c) { return typeof Combat !== 'undefined' && Combat.topOf ? Combat.topOf(c) : 300; },
    // Первое препятствие на отрезке p0 → p0 + dir·len: враг, дерево/камень/постройка, земля
    _trace(p0, dir, len, owner) {
        const n = Math.max(1, Math.ceil(len / 14));
        let px = p0.x, py = p0.y, pz = p0.z;
        for (let i = 1; i <= n; i++) {
            const t = len * i / n, x = p0.x + dir.x * t, y = p0.y + dir.y * t, z = p0.z + dir.z * t;
            if (owner !== 'enemy') for (const e of Enemies.list) {
                if (!e.alive || !e.rig) continue;
                const r = (e.rad || 40) * 0.92 + 6;
                if (Math.abs(x - e.x) > r || Math.abs(z - e.z) > r || y < e.y - 4 || y > e.y + (e.hgt || 100) + 6) continue;
                if ((x - e.x) * (x - e.x) + (z - e.z) * (z - e.z) < r * r) return { kind: 'enemy', e, p: { x, y, z } };
            }
            const gy = World.heightAt(x, z);
            if (y <= gy + 1) {
                // уточнение точки входа в землю
                let a = 0, b = 1;
                for (let k = 0; k < 5; k++) { const m = (a + b) / 2, mx = px + (x - px) * m, my = py + (y - py) * m, mz = pz + (z - pz) * m; if (my <= World.heightAt(mx, mz) + 1) b = m; else a = m; }
                return { kind: 'ground', p: { x: px + (x - px) * b, y: py + (y - py) * b, z: pz + (z - pz) * b } };
            }
            /** @type {any} */ let hit = null;
            World.colliders.query(x, z, 2, (c) => {
                if (hit) return;
                const o = c.owner || {};
                if (!(o.tree || o.rock || o.stump || o.prop)) return;
                if (y > World.heightAt(c.x, c.z) + this._top(c)) return;
                hit = c;
            });
            if (hit) {
                const o = hit.owner;
                // точка на поверхности ствола/камня: отступаем по отрезку до окружности
                let a = 0, b = 1;
                for (let k = 0; k < 5; k++) { const m = (a + b) / 2, mx = px + (x - px) * m, mz = pz + (z - pz) * m; if ((mx - hit.x) ** 2 + (mz - hit.z) ** 2 <= hit.r * hit.r) b = m; else a = m; }
                return { kind: o.tree ? 'tree' : o.rock ? 'rock' : 'prop', c: hit, tree: o.tree || null, p: { x: px + (x - px) * b, y: py + (y - py) * b, z: pz + (z - pz) * b } };
            }
            px = x; py = y; pz = z;
        }
        return null;
    },

    update(dt) {
        if (!this.scene) return;
        for (let i = this.flying.length - 1; i >= 0; i--) {
            const f = this.flying[i];
            f.life += dt;
            const steps = Math.max(1, Math.ceil(Math.hypot(f.vx, f.vy, f.vz) * dt / 60));
            const h = dt / steps;
            let done = false;
            for (let s = 0; s < steps && !done; s++) {
                const vx = f.vx, vy = f.vy - this.GRAV * h * 0.5, vz = f.vz;
                const len = Math.hypot(vx, vy, vz) * h;
                const dir = { x: vx * h / len, y: vy * h / len, z: vz * h / len };
                const hit = this._trace(f, dir, len, f.owner);
                f.vy -= this.GRAV * h;
                if (hit) { this._hit(f, hit, dir); done = true; }
                else { f.x += vx * h; f.y += vy * h; f.z += vz * h; }
            }
            if (done) { this.flying.splice(i, 1); continue; }
            if (f.life > 4 || f.y < -5000) { f.inst.dispose(); this.flying.splice(i, 1); continue; }
            f.inst.position.set(f.x, f.y, f.z);
            this._orient(f.inst, f.vx, f.vy, f.vz);
        }
        this._tickStuck(dt);
    },

    _hit(f, hit, dir) {
        const p = hit.p, a = f.inst;
        if (hit.kind === 'enemy') {
            const e = hit.e, hl = Math.hypot(dir.x, dir.z) || 1;
            Enemies.damage(e, f.dmg, f.sx, f.sz, { knock: 240, pt: p, crit: f.crit, fx: window.AttackFX ? AttackFX.fxOpt('bow', null, { x: dir.x / hl, z: dir.z / hl }) : null });
            if (f.onHit) { try { f.onHit(e); } catch (err) { /* бот: реакция на убийство */ } }
            if (window.Sfx) Sfx.at('arrowhit', p.x, p.y, p.z, 0.8);
            this._stickEnemy(a, e, p, dir);
            return;
        }
        // мир: стрела входит на треть длины в дерево/постройку, на четверть — в землю, чуть-чуть — в камень
        const embed = hit.kind === 'rock' ? 6 : hit.kind === 'ground' ? 18 : 22;
        a.position.set(p.x + dir.x * embed, p.y + dir.y * embed, p.z + dir.z * embed);
        this._orient(a, dir.x, dir.y, dir.z);
        if (window.Sfx) Sfx.at(hit.kind === 'ground' ? 'drop' : hit.kind === 'rock' ? 'clang' : 'arrowwood', p.x, p.y, p.z, hit.kind === 'rock' ? 0.35 : 0.7);
        if (window.AttackFX) AttackFX.impact(p, hit.kind === 'tree' || hit.kind === 'prop' ? 'wood' : hit.kind === 'rock' ? 'rock' : 'ground', { x: -dir.x, z: -dir.z });
        this._addStuck({ inst: a, x: a.position.x, y: a.position.y, z: a.position.z, dx: dir.x, dy: dir.y, dz: dir.z, pick: f.owner === 'player', tree: hit.tree, life: f.owner === 'player' ? -1 : 8 });
    },
    _addStuck(s) {
        this.stuck.push(s);
        // лимит: старые торчащие стрелы исчезают первыми (в теле врага не считаем — у них свой лимит)
        let world = this.stuck.filter(q => !q.enemy);
        while (world.length > this.MAX_STUCK) { const old = world.shift(); this._removeStuck(old); }
    },
    _removeStuck(s) {
        const i = this.stuck.indexOf(s);
        if (i >= 0) this.stuck.splice(i, 1);
        if (s.inst && !s.inst.isDisposed()) s.inst.dispose();
    },
    // В тело врага: стрела крепится к ближайшей части скелета и двигается вместе с ней
    _stickEnemy(a, e, p, dir) {
        const rig = e.rig;
        // ближайшая кость с геометрией (у склеенного персонажа части — кости одного меша)
        let best = null, bd = 1e18;
        rig.nodes.forEach((n, i) => {
            if (!rig.data.nodes[i].prims.length || !n.isEnabled()) return;
            const c = n.getAbsolutePosition(), d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2 + (c.z - p.z) ** 2;
            if (d < bd) { bd = d; best = n; }
        });
        const node = best || rig.root;
        node.computeWorldMatrix(true);
        const inv = node.getWorldMatrix().clone().invert();
        const pos = new BABYLON.Vector3(p.x + dir.x * 14, p.y + dir.y * 14, p.z + dir.z * 14);
        const lp = BABYLON.Vector3.TransformCoordinates(pos, inv);
        const q = new BABYLON.Quaternion(); BABYLON.Quaternion.FromUnitVectorsToRef(BABYLON.Vector3.Forward(), new BABYLON.Vector3(dir.x, dir.y, dir.z), q);
        const ws = new BABYLON.Vector3(), wq = new BABYLON.Quaternion(), wt = new BABYLON.Vector3();
        node.getWorldMatrix().decompose(ws, wq, wt);
        a.parent = node;
        a.position.copyFrom(lp);
        a.rotationQuaternion = BABYLON.Quaternion.Inverse(wq).multiply(q);
        a.scaling.set(1 / (ws.x || 1), 1 / (ws.y || 1), 1 / (ws.z || 1));
        const mine = this.stuck.filter(s => s.enemy === e);
        if (mine.length >= this.MAX_IN_ENEMY) this._removeStuck(mine[0]);
        this.stuck.push({ inst: a, enemy: e, pick: false, life: -1 });
    },

    _tickStuck(dt) {
        const px = Player.x, py = Player.y, pz = Player.z, R = 1.3 * M;
        for (let i = this.stuck.length - 1; i >= 0; i--) {
            const s = this.stuck[i];
            if (!s.inst || s.inst.isDisposed()) { this.stuck.splice(i, 1); continue; }
            if (s.enemy) {
                // тело исчезло (растворилось/выгрузилось) — стрела вместе с ним; через 12 с после смерти — тоже
                if (!s.enemy.rig || (!s.enemy.alive && (s.dead = (s.dead || 0) + dt) > 12)) { this._removeStuck(s); }
                continue;
            }
            if (s.life > 0) {
                s.life -= dt;
                if (s.life < 1) s.inst.scaling.setAll(Math.max(0.01, s.life));
                if (s.life <= 0) { this._removeStuck(s); continue; }
            }
            // дерево срубили — стрела падает на землю предметом
            if (s.tree && !s.tree.alive) {
                if (s.pick && window.Items) Items.spawn('arrow', 1, s.x, s.z, { y: s.y, vy: 120, delay: 0.3 });
                this._removeStuck(s); continue;
            }
            if (!s.pick || Player.dead || !Player.control) continue;
            const dx = s.x - px, dz = s.z - pz;
            if (dx * dx + dz * dz > R * R || s.y < py - 0.6 * M || s.y > py + 2.4 * M) continue;
            if (Inv.canAdd('arrow', 1) < 1) continue;
            Inv.add('arrow', 1);
            if (window.UI) UI.pickupFeed('arrow', 1);
            if (window.FX) FX.pickup(s.x, s.y, s.z);
            if (window.Sfx) Sfx.ui('pickup');
            this._removeStuck(s);
        }
    },

    // ------------------------------------------------------------------------------ поза лучника (перед кадром)
    frame() {
        let cam = 0;
        for (let i = this.bows.length - 1; i >= 0; i--) {
            const b = this.bows[i];
            if (b.root.isDisposed()) { this.bows.splice(i, 1); continue; }
            try { this._pose(b); } catch (e) { if (!this._warned) { this._warned = true; console.warn('Archery.pose', e); } }
            if (b.owner === Player && b.root.isEnabled()) cam = b.camK || 0;
        }
        // камера игрока плавно уходит за правое плечо, пока лук в стойке (и возвращается, когда лук убран)
        if (typeof Cam !== 'undefined') { const want = 0.6 * M * cam; Cam.extraShoulder = (Cam.extraShoulder || 0) + (want - (Cam.extraShoulder || 0)) * 0.18; if (Math.abs(Cam.extraShoulder) < 0.05) Cam.extraShoulder = 0; }
    },
    _nodes(b, rig) {
        if (b.N && b.N.rig === rig) return b.N;
        const n = (x) => rig.node(x);
        // счётчик rig.update: после каждого обновления анимации (даже с dt = 0) поза лучника ставится заново
        if (!rig._arWrap) { const upd = rig.update.bind(rig); rig.update = (dt) => { rig._arTick = (rig._arTick || 0) + 1; return upd(dt); }; rig._arWrap = true; }
        const N = { rig, hips: n('Hips'), torso: n('UpperTorso'), neck: n('Neck'), head: n('Head'), armL: n('ArmL'), foreL: n('ForeL'), gripL: n('GripL'), armR: n('ArmR'), foreR: n('ForeR'), gripR: n('GripR'), top: /** @type {any[]} */ ([]) };
        for (let p = N.hips ? N.hips.parent : null; p; p = p.parent) N.top.unshift(p);
        b.N = N;
        return N;
    },
    _sync(n) { n.computeWorldMatrix(true); for (const c of n.getChildren()) if (c instanceof BABYLON.TransformNode) this._sync(c); },
    _wq(n) { const s = new BABYLON.Vector3(), q = new BABYLON.Quaternion(), t = new BABYLON.Vector3(); n.getWorldMatrix().decompose(s, q, t); return q; },
    _setWorld(n, qw) { n.rotationQuaternion = BABYLON.Quaternion.Inverse(this._wq(n.parent)).multiply(qw); },
    _turnWorld(n, dq) { this._setWorld(n, dq.multiply(this._wq(n))); },
    _pos(n) { return n.getAbsolutePosition().clone(); },
    // Двухзвенный IK: up (плечо) → lo (локоть) → end (кулак) к точке T, локоть в сторону pole; w — вес поверх анимации
    _ik(up, lo, end, T, pole, w) {
        if (!up || !lo || !end || w <= 0.001) return;
        const V = BABYLON.Vector3;
        const q0u = up.rotationQuaternion.clone(), q0l = lo.rotationQuaternion.clone();
        const S = this._pos(up), E = this._pos(lo), G = this._pos(end);
        const la = V.Distance(S, E), lb = V.Distance(E, G);
        const dir = T.subtract(S); let d = dir.length();
        if (d < 1e-3 || la < 1e-3 || lb < 1e-3) return;
        dir.scaleInPlace(1 / d);
        d = U.clamp(d, Math.abs(la - lb) + 0.5, la + lb - 0.15);
        const cosA = U.clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
        let pl = pole.subtract(dir.scale(V.Dot(pole, dir)));
        if (pl.lengthSquared() < 1e-6) { const es = E.subtract(S); pl = es.subtract(dir.scale(V.Dot(es, dir))); }
        if (pl.lengthSquared() < 1e-6) pl = V.Up();
        pl.normalize();
        const E2 = S.add(dir.scale(la * cosA)).add(pl.scale(la * sinA));
        const dq = new BABYLON.Quaternion();
        BABYLON.Quaternion.FromUnitVectorsToRef(E.subtract(S).normalize(), E2.subtract(S).normalize(), dq);
        this._turnWorld(up, dq); this._sync(up);
        const E3 = this._pos(lo), G3 = this._pos(end), T2 = S.add(dir.scale(d));
        BABYLON.Quaternion.FromUnitVectorsToRef(G3.subtract(E3).normalize(), T2.subtract(E3).normalize(), dq);
        this._turnWorld(lo, dq);
        if (w < 0.999) {
            BABYLON.Quaternion.SlerpToRef(q0u, up.rotationQuaternion, w, up.rotationQuaternion);
            BABYLON.Quaternion.SlerpToRef(q0l, lo.rotationQuaternion, w, lo.rotationQuaternion);
        }
        this._sync(up);
    },
    // Направление выстрела: игрок — взгляд камеры, бот — на цель, иначе — вперёд
    _aimDir(b, o, f) {
        const V = BABYLON.Vector3;
        if (o === Player) return Cam.fwd.clone().normalize();
        const e = o.aimAt;
        if (e && e.alive) { const d = new V(e.x - o.x, e.y + (e.hgt || 100) * 0.5 - (o.y + 140), e.z - o.z); if (d.lengthSquared() > 1) return d.normalize(); }
        return f.clone();
    },
    _tipWorld(b) {
        b.root.computeWorldMatrix(true);
        const nz = b.nz != null ? b.nz : -9;
        const p = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(1.4, 0.4, nz + this.LEN), b.root.getWorldMatrix());
        return { x: p.x, y: p.y, z: p.z };
    },

    _pose(b) {
        const o = b.owner, rig = o && o.rig;
        // во сне лук не торчит из спальника
        if (!rig || !rig.root || rig.root.isDisposed() || !rig.root.isEnabled() || o.sleeping) { b.root.setEnabled(false); return; }
        b.root.setEnabled(true);
        const V = BABYLON.Vector3, Q = BABYLON.Quaternion;
        const N = this._nodes(b, rig);
        if (!N.gripL || !N.armL) return;
        for (const n of N.top) n.computeWorldMatrix(true);
        if (N.hips) this._sync(N.hips);
        const fresh = rig._arTick !== b.lastT; b.lastT = rig._arTick;
        const yaw = o === Player ? Player.faceYaw : (o.yaw || 0);
        const f = new V(Math.sin(yaw), 0, Math.cos(yaw)), up = V.Up();
        const D = this._aimDir(b, o, f);
        let Dh = new V(D.x, 0, D.z); if (Dh.lengthSquared() < 1e-4) Dh = f.clone(); Dh.normalize();
        const lD = V.Cross(up, Dh).normalize();           // «влево» от линии прицела
        const a = o.dead ? 0 : b.a, sa = a * a * (3 - 2 * a);
        let fwdA = D;
        if (fresh && sa > 0.001) {
            // корпус боком к цели (левое плечо вперёд), голова смотрит на цель
            const tw = -this.TWIST * sa;
            if (N.hips) { this._turnWorld(N.hips, Q.RotationAxis(up, tw * 0.25)); this._sync(N.hips); }
            if (N.torso) { this._turnWorld(N.torso, Q.RotationAxis(up, tw * 0.75)); this._sync(N.torso); }
            if (N.neck) { this._turnWorld(N.neck, Q.RotationAxis(up, -tw * 0.85)); this._sync(N.neck); }
            // точка у щеки (куда приходит тетива) и левая рука почти прямо по линии взгляда
            const head = N.head ? this._pos(N.head) : new V(o.x, o.y + 150, o.z);
            const A = head.add(up.scale(1)).subtract(lD.scale(11)).add(Dh.scale(8));
            // линия лука чуть правее линии взгляда (к прицелу): камера из-за правого плеча видит лук, а не затылок
            const Dl = D.subtract(lD.scale(0.2)).normalize();
            const SL = this._pos(N.armL), reach = (V.Distance(SL, this._pos(N.foreL)) + V.Distance(this._pos(N.foreL), this._pos(N.gripL))) * 0.96;
            const w = A.subtract(SL), bq = V.Dot(Dl, w), disc = bq * bq - (w.lengthSquared() - reach * reach);
            const Lb = U.clamp(disc > 0 ? -bq + Math.sqrt(disc) : 60, 40, 84);
            const Gl = A.add(Dl.scale(Lb));
            this._ik(N.armL, N.foreL, N.gripL, Gl, up.scale(-0.55).add(lD.scale(0.85)), sa);
            const rest = Gl.subtract(Dl.scale(9));
            let Gr;
            const k = U.clamp(b.t / (b.st === 'nock' ? this.NOCK : this.REL), 0, 1);
            if (b.st === 'draw' || b.st === 'hold') { const e = b.d * b.d * (3 - 2 * b.d); Gr = V.Lerp(rest, A, e); }
            else if (b.st === 'release') Gr = A.subtract(D.scale(7 * k)).subtract(lD.scale(4 * k)).add(up.scale(2 * k));
            else if (b.st === 'nock') {
                // рука за стрелой за правое плечо и обратно к тетиве
                const SR = this._pos(N.armR), Qv = SR.add(up.scale(24)).subtract(Dh.scale(10)).subtract(lD.scale(4));
                Gr = k < 0.45 ? V.Lerp(A, Qv, U.smooth(k / 0.45)) : V.Lerp(Qv, rest, U.smooth((k - 0.45) / 0.55));
            } else Gr = rest;
            this._ik(N.armR, N.foreR, N.gripR, Gr, Dh.scale(-1).subtract(lD.scale(0.6)).add(up.scale(0.35)), sa);
            fwdA = Gl.subtract(A).normalize();
        }
        // лук в кулаке левой руки: в покое — вертикально у бедра с наклоном вперёд, в стойке — по линии выстрела
        N.gripL.computeWorldMatrix(true);
        const g = N.gripL.getAbsolutePosition();
        const upR = up.scale(0.92).add(f.scale(0.38)).normalize();
        const fwdR = f.subtract(upR.scale(V.Dot(f, upR))).normalize();
        let q = this._basis(fwdR, upR);
        if (sa > 0.001) {
            let upA = up.subtract(fwdA.scale(V.Dot(up, fwdA)));
            if (upA.lengthSquared() < 1e-4) upA = f.clone();
            upA.normalize();
            // лук наклонён верхним плечом вправо, как у лучника-правши: верхнее плечо видно рядом с прицелом
            const side = V.Cross(upA, fwdA).normalize(), c = 0.3;
            upA = upA.scale(Math.cos(c)).subtract(side.scale(Math.sin(c))).normalize();
            q = Q.Slerp(q, this._basis(fwdA, upA), sa);
        }
        b.root.position.copyFrom(g);
        b.root.rotationQuaternion.copyFrom(q);
        b.root.computeWorldMatrix(true);
        // тетива: в натяжении — к кулаку правой руки (только вдоль оси лука), иначе — прямая
        let nz = -9;
        if ((b.st === 'draw' || b.st === 'hold') && sa > 0.3 && N.gripR) {
            N.gripR.computeWorldMatrix(true);
            const inv = b.root.getWorldMatrix().clone().invert();
            const hl = V.TransformCoordinates(N.gripR.getAbsolutePosition(), inv);
            nz = U.clamp(hl.z, -9 - 58 * b.d, -9);
        }
        b.nz = nz;
        const bend = U.clamp((-nz - 9) / 58, 0, 1);
        if (Math.abs(bend - b.bend) > 0.015) { b.bend = bend; this._limbs(bend, b.limbs); }
        const path = this._limbPath(b.bend);
        BABYLON.MeshBuilder.CreateLines('bowString', { points: [path[0], new V(0, 0, nz), path[path.length - 1]], instance: b.str });
        // в покое лук без стрелы; стрела на тетиве — в стойке (натяжение, удержание, после наложения)
        const showArrow = !!b.nocked && sa > 0.3;
        b.arrow.setEnabled(showArrow);
        if (showArrow) b.arrow.position.set(1.4, 0.4, nz + this.LEN);
        b.camK = o === Player ? sa : 0;
    },
    _basis(fwd, up) {
        const V = BABYLON.Vector3;
        const x = V.Cross(up, fwd).normalize(), y = V.Cross(fwd, x).normalize();
        return BABYLON.Quaternion.RotationQuaternionFromAxis(x, y, fwd.clone().normalize());
    },

    // ------------------------------------------------------------------------------ партия: очистка и сохранение
    clear() {
        for (const f of this.flying) if (f.inst && !f.inst.isDisposed()) f.inst.dispose();
        for (const s of this.stuck) if (s.inst && !s.inst.isDisposed()) s.inst.dispose();
        this.flying = []; this.stuck = [];
    },
    // Сохраняются только свои стрелы в мире (их можно подобрать): [x, y, z, dx, dy, dz]
    save() {
        const r = (v) => Math.round(v), q = (v) => Math.round(v * 1000) / 1000;
        return this.stuck.filter(s => s.pick && !s.enemy).slice(-this.MAX_STUCK).map(s => [r(s.x), r(s.y), r(s.z), q(s.dx), q(s.dy), q(s.dz)]);
    },
    load(list) {
        this.clear();
        if (!this.scene || !Array.isArray(list)) return;
        for (const a of list.slice(-this.MAX_STUCK)) {
            if (!Array.isArray(a) || a.length < 6 || !a.every(Number.isFinite)) continue;
            const inst = this._arrow('arrowStuck');
            inst.position.set(a[0], a[1], a[2]);
            this._orient(inst, a[3], a[4], a[5]);
            this.stuck.push({ inst, x: a[0], y: a[1], z: a[2], dx: a[3], dy: a[4], dz: a[5], pick: true, tree: null, life: -1 });
        }
    },
};

// Combat.js — выстрелы (hitscan), стрелы/болты (снаряды), ловушки-урон. Урон врагам — Enemies.damage,
// игроку — Player.hurt.

/** @type {Record<string, any>} */
const Combat = {
    bolts: [],
    grenades: [],
    scene: null,
    tracerMat: null,

    init(view) {
        this.scene = view.scene;
        const m = this.tracerMat = new BABYLON.StandardMaterial('tracer', this.scene);
        m.disableLighting = true; m.emissiveColor = new BABYLON.Color3(1, 0.85, 0.4); m.diffuseColor = new BABYLON.Color3(0, 0, 0);
        m.alpha = 0.9; m.fogEnabled = false;
        const b = this.boltMat = new BABYLON.StandardMaterial('boltMat', this.scene);
        b.diffuseColor = new BABYLON.Color3(0.3, 0.2, 0.12); b.emissiveColor = new BABYLON.Color3(0.5, 0.15, 0.7);
    },

    // Ближайшая цель вдоль луча: враги (владелец 'player') или игрок (владелец 'enemy')
    // fx — { id, crit }: чем стреляли (эффекты попадания, трассер, стрела) и критический ли выстрел
    hitscan(from, dir, range, dmg, owner, fx) {
        let best = null, bt = range;
        const test = (cx, cy, cz, rad, hgt, obj) => {
            // ближайшая точка вертикального отрезка (cx, cy..cy+hgt, cz) к лучу
            const ox = from.x - cx, oz = from.z - cz;
            let bestD = 1e9, bestT = -1;
            for (let i = 0; i <= 4; i++) {
                const py = cy + hgt * i / 4;
                const px = cx - from.x, pz = cz - from.z, pyy = py - from.y;
                const t = px * dir.x + pyy * dir.y + pz * dir.z;
                if (t < 0 || t > bt) continue;
                const qx = from.x + dir.x * t - cx, qy = from.y + dir.y * t - py, qz = from.z + dir.z * t - cz;
                const d = Math.hypot(qx, qy, qz);
                if (d < bestD) { bestD = d; bestT = t; }
            }
            if (bestT >= 0 && bestD < rad && bestT < bt) { bt = bestT; best = obj; }
        };
        if (owner === 'player') {
            for (const e of Enemies.list) { if (!e.alive || !e.rig) continue; test(e.x, e.y, e.z, e.rad + 20, e.hgt, e); }
        } else test(Player.x, Player.y, Player.z, 45, 170, Player);
        // деревья и камни закрывают выстрел (грубо, шагом по лучу)
        const step = 80;
        let blocked = range, surf = 'ground';
        for (let t = 60; t < bt; t += step) {
            const x = from.x + dir.x * t, y = from.y + dir.y * t, z = from.z + dir.z * t;
            if (y < World.heightAt(x, z) + 6) { blocked = t; break; }
            let hit = false, kind = 'ground';
            World.colliders.query(x, z, 10, (c) => { if (c.owner && (c.owner.tree || c.owner.rock) && y < World.heightAt(c.x, c.z) + 400) { hit = true; kind = c.owner.tree ? 'wood' : 'rock'; } });
            if (hit) { blocked = t; surf = kind; break; }
        }
        const endT = best && bt <= blocked ? bt : Math.min(blocked, range);
        const bow = fx && fx.id === 'bow';
        if (bow && window.AttackFX) AttackFX.arrow(from, dir, endT, !(best && bt <= blocked)); else this.tracer(from, dir, endT);
        if (best && bt <= blocked) {
            const px = from.x + dir.x * bt, py = from.y + dir.y * bt, pz = from.z + dir.z * bt;
            if (best === Player) Player.hurt(dmg, from.x, from.z, 'shot');
            else {
                const hl = Math.hypot(dir.x, dir.z) || 1, f = { x: dir.x / hl, z: dir.z / hl };
                Enemies.damage(best, dmg, from.x, from.z, { knock: 240, pt: { x: px, y: py, z: pz }, crit: !!(fx && fx.crit), fx: fx && window.AttackFX ? AttackFX.fxOpt(fx.id, null, f) : null });
            }
        } else {
            const px = from.x + dir.x * endT, py = from.y + dir.y * endT, pz = from.z + dir.z * endT;
            if (window.AttackFX && endT > 150) AttackFX.impact({ x: px, y: py, z: pz }, surf, { x: -dir.x, z: -dir.z }); else FX.dust(px, py, pz, 2, 0.5);
        }
        return best;
    },

    tracer(from, dir, len) {
        const scene = this.scene;
        const p0 = new BABYLON.Vector3(from.x + dir.x * 60, from.y + dir.y * 60, from.z + dir.z * 60);
        const p1 = new BABYLON.Vector3(from.x + dir.x * len, from.y + dir.y * len, from.z + dir.z * len);
        if (len < 100) return;
        const line = BABYLON.MeshBuilder.CreateTube('tracer', { path: [p0, p1], radius: 1.6, tessellation: 4 }, scene);
        line.material = this.tracerMat; line.isPickable = false;
        let t = 0;
        Tween.to(0.12, (k) => { line.visibility = 1 - k; }, { done: () => line.dispose() });
    },

    // Болт арбалета/стрела культиста
    fireBolt(from, dir, dmg, speed) {
        const m = BABYLON.MeshBuilder.CreateCylinder('bolt', { height: 60, diameter: 4, tessellation: 5 }, this.scene);
        m.material = this.boltMat; m.isPickable = false;
        m.position.set(from.x, from.y, from.z);
        m.rotationQuaternion = BABYLON.Quaternion.Identity();
        const up = new BABYLON.Vector3(0, 1, 0), d = new BABYLON.Vector3(dir.x, dir.y, dir.z);
        const ax = BABYLON.Vector3.Cross(up, d);
        const ang = Math.acos(BABYLON.Vector3.Dot(up, d));
        if (ax.lengthSquared() > 1e-6) m.rotationQuaternion = BABYLON.Quaternion.RotationAxis(ax.normalize(), ang);
        this.bolts.push({ m, x: from.x, y: from.y, z: from.z, dx: dir.x, dy: dir.y, dz: dir.z, dmg, v: speed || 2200, t: 0 });
    },

    // ------------------------------------------------------------------------------ гранаты
    // from -> to: баллистическая дуга с подобранной скоростью (ближе цель — медленнее бросок)
    throwGrenade(id, from, to, T, owner) {
        const root = Items.make(id);
        root.scaling.setAll(1.35);
        const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1, h = to.y - from.y, G = 1900;
        const v = U.clamp(d * 2.6 + 700, 900, 1950);
        const disc = v * v * v * v - G * (G * d * d + 2 * h * v * v);
        let vh, vy;
        if (disc >= 0) { const ang = Math.atan((v * v - Math.sqrt(disc)) / (G * d)); vh = v * Math.cos(ang); vy = v * Math.sin(ang); }
        else { vh = v * 0.77; vy = v * 0.64; }
        const g = { id, T, root, owner, x: from.x, y: from.y, z: from.z, vx: dx / d * vh, vz: dz / d * vh, vy, fuse: T.fuse, t: 0, hiss: 0 };
        root.position.set(g.x, g.y, g.z);
        this.grenades.push(g);
        Sfx.at('fuse', g.x, g.y, g.z, 0.6);
    },
    // Высота препятствия над землёй: граната летит над низкими предметами и отскакивает от деревьев и камней
    topOf(c) {
        const o = c.owner || {};
        if (o.tree) return 520 * (o.tree.s || 1);
        if (o.rock) return 240;
        if (o.stump) return 50;
        return 150;
    },
    updateGrenades(dt) {
        for (let i = this.grenades.length - 1; i >= 0; i--) {
            const g = this.grenades[i];
            g.t += dt; g.fuse -= dt; g.vy -= 1900 * dt;
            let nx = g.x + g.vx * dt, ny = g.y + g.vy * dt, nz = g.z + g.vz * dt;
            // деревья, камни, постройки: отскок
            const r = World.colliders.resolve(nx, nz, 22, this._gt || (this._gt = { x: 0, z: 0, hit: null }));
            if (r.hit && ny - World.heightAt(r.hit.x, r.hit.z) < this.topOf(r.hit)) {
                const ax = g.x - r.hit.x, az = g.z - r.hit.z, l = Math.hypot(ax, az) || 1, nxv = ax / l, nzv = az / l, dot = g.vx * nxv + g.vz * nzv;
                if (dot < 0) { g.vx = (g.vx - 1.5 * dot * nxv) * 0.5; g.vz = (g.vz - 1.5 * dot * nzv) * 0.5; Sfx.at('drop', g.x, g.y, g.z, 0.5); }
                nx = r.x; nz = r.z;
            }
            const gy = World.heightAt(nx, nz) + 12;
            const onGround = ny <= gy;
            if (onGround) {
                ny = gy;
                if (g.vy < -300) { g.vy = -g.vy * 0.35; g.vx *= 0.6; g.vz *= 0.6; Sfx.at('drop', nx, ny, nz, 0.5); }
                else { g.vy = 0; const k = Math.pow(0.03, dt); g.vx *= k; g.vz *= k; }
            }
            // прямое попадание осколочной во врага — взрыв сразу
            if (g.T.kind === 'frag' && g.t > 0.12) for (const e of Enemies.list) {
                if (e.alive && e.type !== 'deer' && e.type !== 'bunny' && U.dist2(nx, nz, e.x, e.z) < (e.rad + 28) * (e.rad + 28) && ny < e.y + e.hgt + 30) { g.fuse = 0; break; }
            }
            g.x = nx; g.y = ny; g.z = nz;
            g.root.position.set(nx, ny, nz);
            if (!onGround) { g.root.rotation.x += dt * 10; g.root.rotation.z += dt * 4; }
            // искры запала и мигание перед взрывом
            g.hiss -= dt;
            if (g.hiss <= 0) { g.hiss = 0.09; FX.sparkBurst(nx, ny + 40, nz, 2, '#ffb040'); }
            const k = g.fuse < 0.9 ? 1 + Math.abs(Math.sin(g.t * (g.fuse < 0.45 ? 34 : 18))) * 0.22 : 1;
            g.root.scaling.setAll(1.35 * k);
            if (g.fuse <= 0) { this.grenades.splice(i, 1); this.explode(g); }
        }
    },
    explode(g) {
        const T = g.T, x = g.x, z = g.z, gy = World.heightAt(x, z), y = Math.max(g.y, gy + 40), R = T.radius * M, scene = this.scene;
        if (g.root._rig) g.root._rig.dispose(); else { for (const m of g.root._meshes || []) m.dispose(); g.root.dispose(); }
        const flash = T.kind === 'flash';
        // эффекты: огненный купол, ударная волна, частицы, реакция мира
        this.fireDome(x, y, z, R, flash);
        this.shockwave(x, gy, z, R, flash);
        FX.explosion(x, y, z, R, T.kind);
        FX.ring(x, gy + 10, z, R * 1.1, flash ? '#ffffff' : '#ffb040');
        if (!flash) this.scorch(x, z, R * 0.34);
        Sfx.at(flash ? 'bang' : 'boom', x, y, z, 1);
        const dP = Math.hypot(Player.x - x, Player.z - z);
        if (dP < 5200) { const q = 1 - dP / 5200; Cam.shake(Math.min(1, (flash ? 0.5 : 1.0) * q + 0.1 * q)); Cam.kick(0.04 + 0.08 * q); }
        if (dP < 9000) Sky.flash((flash ? 1.2 : 0.95) * (1 - dP / 9000), flash ? '#ffffff' : '#ffb868', flash ? 0.35 : 0.55);
        if (dP < R * 2.4 && !(flash && dP < 6 * M)) UI.flash(flash ? '#ffffff' : '#ffe2a0', (flash ? 0.5 : 0.38) * (1 - dP / (R * 2.4)), flash ? 0.6 : 0.4);
        this.reactWorld(x, z, R, flash);
        // урон по площади: у центра сильнее
        for (const e of Enemies.list) {
            if (!e.alive || e.type === 'deer') continue;
            const d = Math.hypot(e.x - x, e.z - z) - e.rad * 0.5;
            if (d > R) continue;
            const f = 1 - 0.6 * Math.max(0, d) / R;
            Enemies.damage(e, T.dmg * f, x, z, { knock: (flash ? 200 : 950) * f, stun: flash ? T.stun : 0.9 * f, element: flash ? 'flash' : 'fire' });
        }
        if (!Player.dead && dP < R) {
            if (flash) { if (dP < 6 * M) UI.flash('#ffffff', 0.95, 0.9); }
            else Player.hurt(T.dmg * 0.45 * (1 - 0.7 * dP / R), x, z, 'blast');
        }
        if (window.Bots) for (const b of Bots.list) {
            if (b.dead) continue;
            const d = Math.hypot(b.x - x, b.z - z);
            if (d < R && !flash) b.hurt(T.dmg * 0.35 * (1 - 0.7 * d / R), x, z, 'blast');
        }
        // осколочная ломает мелкие деревья рядом
        if (!flash) World.colliders.query(x, z, R * 0.5, (c) => {
            const t = c.owner && c.owner.tree;
            if (t && t.alive && t.s < 1.0 && Math.hypot(t.x - x, t.z - z) < R * 0.45) { t.hp -= 2; const l = Math.hypot(t.x - x, t.z - z) || 1; World.shakeTree(t, (t.x - x) / l, (t.z - z) / l); }
        });
    },
    // Огненный купол: яркое ядро и оболочка быстро раздуваются и гаснут (аддитивное свечение)
    fireDome(x, y, z, R, flash) {
        const scene = this.scene;
        const mk = (name, col, a0) => {
            const m = new BABYLON.StandardMaterial(name + 'M', scene);
            m.disableLighting = true; m.fogEnabled = false; m.metadata = { toon: false, mist: false };
            m.emissiveColor = col; m.diffuseColor = new BABYLON.Color3(0, 0, 0); m.alpha = a0; m.alphaMode = BABYLON.Engine.ALPHA_ADD; m.disableDepthWrite = true;
            const s = BABYLON.MeshBuilder.CreateSphere(name, { diameter: 100, segments: 14 }, scene);
            s.material = m; s.isPickable = false; s.position.set(x, y, z); s.renderingGroupId = 1;
            return { s, m };
        };
        const core = mk('boomCore', flash ? new BABYLON.Color3(1, 1, 1) : new BABYLON.Color3(1, 0.95, 0.7), 1);
        const shell = mk('boomShell', flash ? new BABYLON.Color3(0.7, 0.85, 1) : new BABYLON.Color3(1, 0.5, 0.12), 0.8);
        const big = R / 50;
        Tween.to(flash ? 0.22 : 0.32, (t) => { core.s.scaling.setAll(0.3 + t * big * 0.55); core.m.alpha = (1 - t) * (1 - t); }, { done: () => { core.s.dispose(); core.m.dispose(); } });
        Tween.to(flash ? 0.34 : 0.62, (t) => {
            shell.s.scaling.set(0.4 + t * big * 0.9, 0.35 + t * big * 0.75, 0.4 + t * big * 0.9);
            shell.m.alpha = 0.8 * (1 - t) * (1 - t);
            if (!flash) shell.m.emissiveColor.set(1, 0.5 - 0.35 * t, 0.12 - 0.1 * t);
        }, { done: () => { shell.s.dispose(); shell.m.dispose(); } });
    },
    // Ударная волна: светящееся кольцо быстро расходится по земле
    shockwave(x, gy, z, R, flash) {
        const scene = this.scene;
        if (!this._ringTex) { this._ringTex = new BABYLON.Texture(FX.tex.ring, scene); this._ringTex.hasAlpha = true; }
        const m = new BABYLON.StandardMaterial('shockM', scene);
        m.disableLighting = true; m.fogEnabled = false; m.metadata = { toon: false, mist: false };
        m.diffuseTexture = this._ringTex; m.opacityTexture = this._ringTex; m.emissiveColor = flash ? new BABYLON.Color3(0.85, 0.95, 1) : new BABYLON.Color3(1, 0.72, 0.38);
        m.diffuseColor = new BABYLON.Color3(0, 0, 0); m.alpha = 0.9; m.alphaMode = BABYLON.Engine.ALPHA_ADD; m.disableDepthWrite = true; m.zOffset = -4; m.backFaceCulling = false;
        const d = BABYLON.MeshBuilder.CreateDisc('shock', { radius: 100, tessellation: 48 }, scene);
        d.material = m; d.isPickable = false; d.rotation.x = Math.PI / 2; d.position.set(x, gy + 10, z); d.renderingGroupId = 1;
        const big = R * 1.25 / 100;
        Tween.to(flash ? 0.45 : 0.6, (t) => { const e = 1 - (1 - t) * (1 - t); d.scaling.setAll(0.15 + e * big); m.alpha = 0.9 * (1 - t); }, { ease: (t) => t, done: () => { d.dispose(); m.dispose(); } });
    },
    // Мир реагирует: предметы подпрыгивают, деревья трясутся и роняют листву
    reactWorld(x, z, R, flash) {
        for (const it of Items.list) {
            const dx = it.x - x, dz = it.z - z, d = Math.hypot(dx, dz);
            if (d > R * 0.8 || !it.ground || it.id === 'coin') continue;
            const l = d || 1, k = 1 - d / (R * 0.8);
            it.ground = false; it.vx = dx / l * (260 + 380 * k); it.vz = dz / l * (260 + 380 * k); it.vy = 420 + 520 * k; it.noPickup = Math.max(it.noPickup, 0.6);
        }
        let n = 0;
        World.colliders.query(x, z, R * 1.5, (c) => {
            const t = c.owner && c.owner.tree;
            if (!t || !t.alive) return;
            const dx = t.x - x, dz = t.z - z, l = Math.hypot(dx, dz) || 1;
            World.shakeTree(t, dx / l, dz / l);
            if (!flash && n < 5 && l < R * 1.1) { n++; FX.leaves(t.x, World.heightAt(t.x, t.z) + 260 * t.s, t.z, 10); }
        });
    },
    // Обожжённая земля: тёмное пятно, по краю тлеет, исчезает через 14 с
    scorch(x, z, r) {
        const gy = World.heightAt(x, z);
        const d = BABYLON.MeshBuilder.CreateDisc('scorch', { radius: r, tessellation: 28 }, this.scene);
        const m = new BABYLON.StandardMaterial('scorchM', this.scene);
        const st = this._scorchTex && this._scorchTex.url === FX.tex.scorch ? this._scorchTex : (this._scorchTex = new BABYLON.Texture(FX.tex.scorch, this.scene));
        st.hasAlpha = true;
        m.diffuseColor = new BABYLON.Color3(0.03, 0.03, 0.03); m.emissiveColor = new BABYLON.Color3(0, 0, 0); m.opacityTexture = st; m.specularColor = new BABYLON.Color3(0, 0, 0); m.alpha = 0.85; m.zOffset = -3; m.backFaceCulling = false; m.metadata = { toon: false };
        d.material = m; d.isPickable = false; d.rotation.x = Math.PI / 2; d.position.set(x, gy + 5, z);
        // тлеющее кольцо
        const g = BABYLON.MeshBuilder.CreateDisc('scorchGlow', { radius: r * 0.9, tessellation: 28 }, this.scene);
        const gm = new BABYLON.StandardMaterial('scorchGlowM', this.scene);
        gm.disableLighting = true; gm.diffuseColor = new BABYLON.Color3(0, 0, 0); gm.emissiveColor = new BABYLON.Color3(1, 0.4, 0.08); gm.alpha = 0.55; gm.alphaMode = BABYLON.Engine.ALPHA_ADD; gm.zOffset = -4; gm.disableDepthWrite = true; gm.backFaceCulling = false; gm.metadata = { toon: false, mist: false };
        g.material = gm; g.isPickable = false; g.rotation.x = Math.PI / 2; g.position.set(x, gy + 7, z);
        Tween.to(2.4, (t) => { gm.alpha = 0.55 * (1 - t) * (0.8 + 0.2 * Math.sin(t * 40)); }, { ease: (t) => t, done: () => { g.dispose(); gm.dispose(); } });
        Tween.to(14, (t) => { m.alpha = 0.85 * (1 - Math.max(0, (t - 0.6) / 0.4)); }, { ease: (t) => t, done: () => { d.dispose(); m.dispose(); } });
    },

    update(dt) {
        this.updateGrenades(dt);
        for (let i = this.bolts.length - 1; i >= 0; i--) {
            const b = this.bolts[i];
            b.t += dt;
            b.dy -= 0.25 * dt;
            b.x += b.dx * b.v * dt; b.y += b.dy * b.v * dt; b.z += b.dz * b.v * dt;
            b.m.position.set(b.x, b.y, b.z);
            let end = b.t > 3.5 || b.y < World.heightAt(b.x, b.z);
            if (!end && !Player.dead && Math.abs(b.y - (Player.y + 90)) < 100 && U.dist2(b.x, b.z, Player.x, Player.z) < 55 * 55) {
                Player.hurt(b.dmg, b.x - b.dx * 100, b.z - b.dz * 100, 'bolt'); end = true;
            }
            if (!end && window.Bots && Bots.boltHit(b)) end = true;
            if (!end) World.colliders.query(b.x, b.z, 5, (c) => { if (c.owner && (c.owner.tree || c.owner.rock) && b.y < World.heightAt(c.x, c.z) + 450) end = true; });
            if (end) { FX.hitSpark(b.x, b.y, b.z, '#c07aff'); b.m.dispose(); this.bolts.splice(i, 1); }
        }
    },
    clear() {
        for (const b of this.bolts) b.m.dispose(); this.bolts.length = 0;
        for (const g of this.grenades) { if (g.root._rig) g.root._rig.dispose(); else { for (const m of g.root._meshes || []) m.dispose(); g.root.dispose(); } }
        this.grenades.length = 0;
    },
    state() {
        return {
            grenades: this.grenades.map(g => ({ id: g.id, owner: typeof g.owner === 'string' ? g.owner : 'player', x: g.x, y: g.y, z: g.z, vx: g.vx, vy: g.vy, vz: g.vz, fuse: g.fuse, t: g.t })),
            bolts: this.bolts.map(b => ({ x: b.x, y: b.y, z: b.z, dx: b.dx, dy: b.dy, dz: b.dz, dmg: b.dmg, v: b.v, t: b.t })),
        };
    },
    loadState(s) {
        this.clear(); if (!s) return;
        const finite = (row, keys) => row && keys.every(k => Number.isFinite(row[k]));
        for (const row of (Array.isArray(s.grenades) ? s.grenades : []).slice(0, 100)) {
            const def = DATA.items[row.id];
            if (!def || !def.throw || !finite(row, ['x', 'y', 'z', 'vx', 'vy', 'vz', 'fuse', 't'])) continue;
            const root = Items.make(row.id); root.position.set(row.x, row.y, row.z); root.scaling.setAll(1.35);
            this.grenades.push({ ...row, root, T: def.throw, hiss: 0 });
        }
        for (const row of (Array.isArray(s.bolts) ? s.bolts : []).slice(0, 100)) {
            if (!finite(row, ['x', 'y', 'z', 'dx', 'dy', 'dz', 'dmg', 'v', 't']) || row.t >= 3.5) continue;
            this.fireBolt(row, { x: row.dx, y: row.dy, z: row.dz }, row.dmg, row.v);
            const b = this.bolts[this.bolts.length - 1]; b.t = row.t;
        }
    },
};

// AttackFX.js — эффекты и «сок» атак игрока и ботов: светящийся след взмаха (дуга для рубящих, боковая для режущих, стрела для колющих),
// комбо из трёх ударов (третий — финишер), рывок вперёд, наклоны и скрутка корпуса (Rig.offset), разные искры/пыль/щепа по виду оружия
// и поверхности, критические удары, hit-stop (микро-пауза на сильном попадании), толчок поля зрения, гильзы и дымок выстрела,
// летящая стрела, вспышка света от выстрела, реакция врага на удар (сплющивание и откидывание корпуса).
// Модуль только рисует и подкручивает ощущения: урон считают Player/Bots/Combat/Enemies, ошибки здесь не должны ломать бой.

/** @type {Record<string, any>} */
const AttackFX = {
    stopT: 0, fov: 0, _timers: [], _mats: {}, _trailPool: [],

    // стиль по предмету: k — вид удара; c/c2 — цвета; big — тяжёлое оружие
    STYLE: {
        axe_old: { k: 'blade', c: '#f0e2b8', c2: '#ffffff' }, axe_good: { k: 'blade', c: '#d8f0ff', c2: '#ffffff' }, axe_strong: { k: 'blade', c: '#ffd890', c2: '#fff4d0', big: 1 },
        chainsaw: { k: 'saw', c: '#ffe4a0', c2: '#ffffff' }, spear: { k: 'pierce', c: '#cfeaff', c2: '#ffffff' }, katana: { k: 'blade', c: '#b8e8ff', c2: '#ffffff' },
        hammer: { k: 'blunt', c: '#ffb060', c2: '#ffe8b0', big: 1 }, pickaxe: { k: 'blade', c: '#d8dce8', c2: '#ffffff' },
        revolver: { k: 'bullet', c: '#ffe08a', c2: '#ffffff' }, rifle: { k: 'bullet', c: '#ffd070', c2: '#ffffff' }, shotgun: { k: 'bullet', c: '#ffb860', c2: '#ffffff' }, bow: { k: 'arrow', c: '#e8d8b0', c2: '#ffffff' },
    },
    style(id) { return this.STYLE[id] || { k: 'blade', c: '#fff2b0', c2: '#ffffff' }; },
    // параметры для Enemies.damage
    fxOpt(id, cb, f) { const S = this.style(id); return { style: S, id, big: !!((cb && cb.fin) || S.big), fin: !!(cb && cb.fin), dx: f ? f.x : 0, dz: f ? f.z : 0 }; },

    // ------------------------------------------------------------------------------ время и поле зрения
    // Hit-stop: на долю секунды замедляем мир на сильном ударе
    hitStop(sec) { this.stopT = Math.max(this.stopT, Math.min(0.12, sec)); },
    scale(dt) { if (this.stopT > 0) { this.stopT -= dt; return dt * 0.05; } return dt; },
    punch(deg) { this.fov = Math.max(this.fov, deg); },
    later(sec, fn) { this._timers.push({ left: sec, fn }); },
    tick(dt) {
        for (let i = this._timers.length - 1; i >= 0; i--) {
            const t = this._timers[i]; t.left -= dt;
            if (t.left <= 0) { this._timers.splice(i, 1); try { t.fn(); } catch (e) { /* эффект не должен ломать кадр */ } }
        }
        this.fov = U.damp(this.fov, 0, 8, dt);
        for (const r of this._trailPool) {
            if (!r.active) continue;
            r.t += dt;
            const k = Math.min(1, r.t / r.duration);
            r.material.alpha = r.peak * (k < .18 ? k / .18 : (1 - k) / .82);
            if (k >= 1) { r.active = false; r.mesh.setEnabled(false); }
        }
    },
    clear() {
        this._timers.length = 0; this.stopT = 0; this.fov = 0;
        for (const r of this._trailPool) { r.mesh.dispose(); r.material.dispose(); }
        this._trailPool.length = 0;
    },
    off() { return typeof DBG !== 'undefined' && DBG.nofx; },

    // ------------------------------------------------------------------------------ комбо
    // Ближнее оружие: удары чередуются, если нанесены подряд (до 1.0 с между ними); третий — финишер (+30% урона, шире и сильнее)
    // h — Player или бот (хранит _combo); anim — исходная анимация предмета
    combo(h, def, anim) {
        const out = { anim, n: 0, fin: false, flip: false };
        if (def.type !== 'weapon' || def.ranged || def.throw) return out;
        const now = performance.now() / 1000, c = h._combo;
        if (!c || now - c.t > 1.0) h._combo = { n: 0, t: now }; else { c.n = (c.n + 1) % 3; c.t = now; }
        const n = h._combo.n;
        out.n = n; out.fin = n === 2;
        if (anim === 'stab') { out.anim = n === 1 ? 'swing' : 'stab'; }
        else if (anim === 'swing') { out.anim = n === 2 ? 'chop' : 'swing'; out.flip = n === 1; }
        // хаммер: все удары сверху, финишер — с ударной волной
        return out;
    },

    // ------------------------------------------------------------------------------ начало замаха: след, поза, рывок
    // h — владелец (Player | бот); def — предмет; cb — результат combo; dur/hitAt — длительность и доля момента удара
    swingStart(h, def, cb, dur, hitAt) {
        if (this.off()) return;
        const isPlayer = h === Player;
        const S = this.style(isPlayer ? h.heldId : h.weaponId);
        const kind = cb.anim === 'stab' ? 'stab' : cb.anim === 'chop' ? 'chop' : 'swing';
        h.fxPose = { kind, t: 0, dur, dir: cb.flip ? -1 : 1, fin: cb.fin };
        // рывок вперёд: обычный удар — полметра, финишер — больше
        const yaw = isPlayer ? Cam.yaw : h.yaw, f = { x: Math.sin(yaw), z: Math.cos(yaw) };
        const L = (cb.fin ? 1500 : def.type === 'weapon' ? 900 : 380) * (kind === 'stab' ? 1.15 : 1);
        if (isPlayer) h.knock = { x: f.x * L, z: f.z * L }; else { h.kx = (h.kx || 0) + f.x * L * 0.55; h.kz = (h.kz || 0) + f.z * L * 0.55; }
        if (isPlayer) this.punch(cb.fin ? 3 : 1.2);
        // светящийся след в момент замаха
        const reach = (def.reach || 2.4) * M;
        const big = !!(cb.fin || S.big);
        this.later(Math.max(0, dur * hitAt - 0.1), () => {
            const hy = isPlayer ? h.faceYaw : h.yaw;
            this._trail({ x: h.x, y: h.y, z: h.z, yaw: isPlayer ? Cam.yaw : hy }, { kind, reach, c: S.c, big, flip: cb.flip, fin: cb.fin });
            if (cb.fin && isPlayer && window.Sfx) Sfx.at('whoosh', h.x, h.y, h.z, 0.7, 0.8);
        });
    },

    // Ленточный след: две дуги → лента с затуханием по длине; живёт около 0.25 с
    _trail(h, o) {
        const scene = Combat.scene;
        if (!scene) return;
        const limit = typeof ATTACK_TRAIL_LIMIT !== 'undefined' ? ATTACK_TRAIL_LIMIT : 12;
        let slot = this._trailPool.find(r => !r.active && r.mesh.getScene() === scene && !r.mesh.isDisposed());
        if (!slot && this._trailPool.length >= limit) return;
        const R = (o.reach || 240) * 0.95, W = o.big ? 0.4 : 0.26, N = 14;
        const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), lx = Math.cos(h.yaw), lz = -Math.sin(h.yaw);
        const cy = h.y + 125;
        const inner = [], outer = [];
        for (let i = 0; i <= N; i++) {
            const t = i / N;
            let ux, uy, uz, r0 = R * (1 - W), r1 = R;
            if (o.kind === 'chop') {
                const a = U.lerp(2.0, -0.5, t);
                ux = fx * Math.cos(a); uy = Math.sin(a); uz = fz * Math.cos(a);
            } else if (o.kind === 'swing') {
                const a = U.lerp(-1.25, 1.25, t) * (o.flip ? -1 : 1);
                ux = fx * Math.cos(a) + lx * Math.sin(a); uy = 0.2 - 0.38 * t; uz = fz * Math.cos(a) + lz * Math.sin(a);
            } else {   // stab: узкая лента-стрела вперёд
                const d = U.lerp(0.25, 1.2, t), w = (1 - t) * 14 + 2;
                const px = h.x + fx * R * d, pz = h.z + fz * R * d;
                inner.push(new BABYLON.Vector3(px - lx * w, cy - 6, pz - lz * w));
                outer.push(new BABYLON.Vector3(px + lx * w, cy - 6, pz + lz * w));
                continue;
            }
            inner.push(new BABYLON.Vector3(h.x + ux * r0, cy + uy * r0, h.z + uz * r0));
            outer.push(new BABYLON.Vector3(h.x + ux * r1, cy + uy * r1, h.z + uz * r1));
        }
        const mesh = BABYLON.MeshBuilder.CreateRibbon('atkTrail', { pathArray: [inner, outer], updatable: true, instance: slot?.mesh }, scene);
        const col = new Float32Array((N + 1) * 2 * 4);
        for (let i = 0; i <= N; i++) { const a = Math.pow(i / N, 1.5); for (let p = 0; p < 2; p++) { const q = (p * (N + 1) + i) * 4; col[q] = 1; col[q + 1] = 1; col[q + 2] = 1; col[q + 3] = a * (p === 1 ? 0.55 : 1); } }
        mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, col);
        mesh.hasVertexAlpha = true;
        const m = slot?.material || new BABYLON.StandardMaterial('atkTrailM', scene);
        m.disableLighting = true; m.emissiveColor = BABYLON.Color3.FromHexString(o.c || '#ffffff'); m.diffuseColor = new BABYLON.Color3(0, 0, 0);
        m.backFaceCulling = false; m.alphaMode = BABYLON.Engine.ALPHA_ADD; m.disableDepthWrite = true; m.fogEnabled = false; m.metadata = { toon: false, mist: false };
        mesh.material = m; mesh.isPickable = false; mesh.renderingGroupId = 1; mesh.alwaysSelectAsActiveMesh = true;
        if (!slot) { slot = { mesh, material: m }; this._trailPool.push(slot); }
        Object.assign(slot, { active: true, t: 0, duration: o.big ? .34 : .26, peak: o.big ? 1 : .8 });
        m.alpha = 0; mesh.setEnabled(true);
    },

    // ------------------------------------------------------------------------------ поза корпуса поверх анимации
    // Вызывать каждый кадр до rig.update: h.fxPose = { kind, t, dur, dir }
    pose(rig, h, dt) {
        const f = h.fxPose;
        if (!f || !rig) return;
        f.t += dt;
        const p = f.t / Math.max(0.05, f.dur);
        if (p >= 1) { h.fxPose = null; return; }
        const sm = U.smooth, lerp = U.lerp;
        const seg = (p, a, b, v0, v1) => lerp(v0, v1, sm(U.clamp((p - a) / (b - a), 0, 1)));
        const amp = f.fin ? 1.35 : 1;
        switch (f.kind) {
            case 'chop': {
                const s = (p < 0.36 ? seg(p, 0, 0.36, 0, -0.2) : p < 0.6 ? seg(p, 0.36, 0.6, -0.2, 0.36) : seg(p, 0.6, 1, 0.36, 0)) * amp;
                rig.offset('UpperTorso', s, 0, 0); rig.offset('Hips', s * 0.35, 0, 0); rig.offset('Head', -s * 0.4, 0, 0);
                break;
            }
            case 'swing': {
                const d = f.dir || 1;
                const t = (p < 0.35 ? seg(p, 0, 0.35, 0, 0.5) : p < 0.6 ? seg(p, 0.35, 0.6, 0.5, -0.6) : seg(p, 0.6, 1, -0.6, 0)) * d * amp;
                rig.offset('UpperTorso', 0.06, t, 0); rig.offset('Hips', 0, t * 0.3, 0);
                break;
            }
            case 'stab': {
                const s = (p < 0.3 ? seg(p, 0, 0.3, 0, -0.1) : p < 0.52 ? seg(p, 0.3, 0.52, -0.1, 0.24) : seg(p, 0.52, 1, 0.24, 0)) * amp;
                rig.offset('UpperTorso', s, 0, 0); rig.offset('Hips', s * 0.5, 0, 0);
                break;
            }
            case 'shoot': {
                const k = Math.exp(-p * 7) * (f.pow || 1);
                rig.offset('UpperTorso', -0.16 * k, 0, 0); rig.offset('Hips', -0.05 * k, 0, 0); rig.offset('Head', 0.06 * k, 0, 0);
                break;
            }
            case 'throw': {
                const s = p < 0.5 ? seg(p, 0, 0.5, 0, -0.22) : p < 0.72 ? seg(p, 0.5, 0.72, -0.22, 0.28) : seg(p, 0.72, 1, 0.28, 0);
                rig.offset('UpperTorso', s, 0, 0); rig.offset('Hips', s * 0.3, 0, 0);
                break;
            }
        }
    },

    // ------------------------------------------------------------------------------ попадание по врагу
    // h — точка {x,y,z}; o = { style, big, fin, dx, dz, crit, kill }
    hit(h, o) {
        if (this.off()) return;
        const S = o.style || this.style(null), dx = o.dx || 0, dz = o.dz || 0, big = !!o.big, gy = World.heightAt(h.x, h.z);
        const dirMin = [dx * 0.35 - 0.35, 0.05, dz * 0.35 - 0.35], dirMax = [dx * 1.3 + 0.35, 0.95, dz * 1.3 + 0.35];
        switch (S.k) {
            case 'blade':
                FX.burst({ name: 'atkSlash', position: [h.x, h.y, h.z], burst: big ? 20 : 12, capacity: 24, life: [0.15, 0.4], size: [9, 24], speed: [380, 900], direction: [dirMin, dirMax], texture: FX.tex.spark, color: S.c, color2: S.c2, sizeGradient: [[0, 1], [1, 0]], gravity: [0, -500, 0] });
                break;
            case 'blunt':
                FX.ring(h.x, gy + 12, h.z, big ? 620 : 420, S.c);
                FX.dust(h.x, gy, h.z, big ? 14 : 8, 1.1);
                FX.burst({ name: 'atkDebris', position: [h.x, gy + 20, h.z], burst: 10, capacity: 14, life: [0.5, 0.9], size: [8, 16], speed: [300, 700], direction: [[-0.8, 0.8, -0.8], [0.8, 2, 0.8]], texture: FX.tex.chip, color: '#6a5238', color2: '#a08a60', blend: 'standard', gravity: [0, -1700, 0], spin: [-10, 10] });
                break;
            case 'pierce':
                FX.burst({ name: 'atkPierce', position: [h.x, h.y, h.z], burst: 9, capacity: 12, life: [0.12, 0.3], size: [8, 20], speed: [500, 1000], direction: [[dx * 0.8 - 0.12, 0.1, dz * 0.8 - 0.12], [dx * 1.4 + 0.12, 0.5, dz * 1.4 + 0.12]], texture: FX.tex.spark, color: S.c, color2: S.c2, sizeGradient: [[0, 1], [1, 0]] });
                FX.ring(h.x, h.y, h.z, 220, S.c);
                break;
            case 'saw':
                FX.burst({ name: 'atkSaw', position: [h.x, h.y, h.z], burst: 16, capacity: 20, life: [0.4, 0.8], size: [5, 11], speed: [250, 650], direction: [dirMin, dirMax], texture: FX.tex.chip, color: '#f2dca0', color2: '#d0b070', blend: 'standard', gravity: [0, -1200, 0], spin: [-12, 12] });
                break;
            case 'bullet': case 'arrow':
                FX.burst({ name: 'atkShot', position: [h.x, h.y, h.z], burst: S.k === 'bullet' ? 9 : 5, capacity: 12, life: [0.12, 0.32], size: [7, 16], speed: [350, 800], direction: [[-0.8, -0.2, -0.8], [0.8, 0.9, 0.8]], texture: FX.tex.spark, color: S.c, color2: S.c2, sizeGradient: [[0, 1], [1, 0]], gravity: [0, -400, 0] });
                break;
        }
        FX.burst({ name: 'atkFlash', position: [h.x, h.y, h.z], burst: 1, capacity: 2, life: [0.08, 0.14], size: [big ? 150 : 100, big ? 200 : 130], speed: [0, 0], texture: FX.tex.soft, color: S.c2 || '#ffffff', sizeGradient: [[0, 0.5], [1, 1.4]] });
        if (big || o.crit) {
            FX.burst({ name: 'atkStars', position: [h.x, h.y, h.z], burst: o.crit ? 14 : 8, capacity: 16, life: [0.4, 0.8], size: [14, 30], speed: [250, 650], direction: [[-1, 0.2, -1], [1, 1.4, 1]], texture: FX.tex.star, color: o.crit ? '#ffd23a' : S.c, color2: '#ffffff', gravity: [0, -380, 0], sizeGradient: [[0, 1], [1, 0]], spin: [-9, 9] });
            FX.ring(h.x, h.y, h.z, o.crit ? 420 : 300, o.crit ? '#ffd23a' : S.c);
        }
        if (big || o.crit || o.kill) {
            this.hitStop(o.kill ? 0.075 : o.fin ? 0.07 : 0.05);
            this.punch(o.fin ? 2.4 : 1.4);
            if (window.Cam) { Cam.shake(o.fin ? 0.28 : 0.18); }
        }
    },

    // Реакция врага на удар: сплющивание и откидывание корпуса (Enemies.applyRig доигрывает)
    react(e, opt) {
        if (!e.rig || e.boss) return;
        const big = !!(opt && opt.fx && opt.fx.big);
        e.sq = Math.min(1, (e.sq || 0) + (big ? 1 : 0.6));
        e.tilt = Math.min(0.36, (e.tilt || 0) + (big ? 0.3 : 0.16));
    },

    // Удар по поверхности: дерево, камень, земля (мимо врага)
    impact(h, surface, dir, S) {
        if (this.off()) return;
        const dx = dir ? dir.x : 0, dz = dir ? dir.z : 0, gy = World.heightAt(h.x, h.z);
        if (surface === 'wood') {
            FX.chips(h.x, h.y, h.z, { x: dx, z: dz });
            FX.burst({ name: 'atkBark', position: [h.x, h.y, h.z], burst: 6, capacity: 8, life: [0.5, 0.9], size: [6, 12], speed: [120, 320], direction: [[-1, 0.1, -1], [1, 1, 1]], texture: FX.tex.chip, color: '#7a4e2a', color2: '#4a2e18', blend: 'standard', gravity: [0, -1300, 0], spin: [-10, 10] });
        } else if (surface === 'rock') {
            FX.burst({ name: 'atkRock', position: [h.x, h.y, h.z], burst: 10, capacity: 14, life: [0.18, 0.45], size: [6, 16], speed: [300, 800], direction: [[-1, 0.1, -1], [1, 1.2, 1]], texture: FX.tex.spark, color: '#fff4d8', color2: '#c8c8d0', sizeGradient: [[0, 1], [1, 0]], gravity: [0, -700, 0] });
            FX.burst({ name: 'atkRockChips', position: [h.x, h.y, h.z], burst: 6, capacity: 8, life: [0.4, 0.8], size: [6, 12], speed: [180, 420], direction: [[-1, 0.2, -1], [1, 1.2, 1]], texture: FX.tex.chip, color: '#8a8a92', color2: '#5a5a62', blend: 'standard', gravity: [0, -1500, 0], spin: [-10, 10] });
            FX.dust(h.x, h.y, h.z, 3, 0.5);
        } else {
            FX.dust(h.x, Math.max(h.y, gy), h.z, 3, 0.6);
            FX.burst({ name: 'atkDirt', position: [h.x, Math.max(h.y, gy) + 6, h.z], burst: 4, capacity: 6, life: [0.35, 0.7], size: [5, 10], speed: [140, 340], direction: [[-0.7, 0.5, -0.7], [0.7, 1.4, 0.7]], texture: FX.tex.chip, color: '#6a4a30', color2: '#4a3220', blend: 'standard', gravity: [0, -1400, 0], spin: [-8, 8] });
        }
    },

    // Рубка дерева: кора, вспышка; бензопила — фонтан опилок
    chop(h, f, def, id) {
        if (this.off()) return;
        const S = this.style(id), dx = f ? f.x : 0, dz = f ? f.z : 0;
        this.impact(h, 'wood', { x: dx, z: dz }, S);
        if (S.k === 'saw') this.hit(h, { style: S, dx: -dx, dz: -dz, big: false });
        else FX.ring(h.x, h.y, h.z, 160 + (def && def.tree ? def.tree * 30 : 0), '#d9b070');
        this.punch(0.5);
    },

    // ------------------------------------------------------------------------------ выстрел
    // h — стрелок, from/dir — дуло и направление, id — предмет; pow — сила отдачи
    shot(h, from, dir, id, pow) {
        if (this.off()) return;
        const S = this.style(id), isPlayer = h === Player;
        h.fxPose = { kind: 'shoot', t: 0, dur: 0.4, pow: pow || 1 };
        if (S.k === 'arrow') return;
        const yaw = isPlayer ? Cam.yaw : h.yaw, lx = Math.cos(yaw), lz = -Math.sin(yaw);
        // гильза вылетает вправо-вверх
        FX.burst({ name: 'atkCasing', position: [from.x - dir.x * 30, from.y - 6, from.z - dir.z * 30], burst: id === 'shotgun' ? 2 : 1, capacity: 3, life: [0.6, 0.9], size: [5, 8], speed: [180, 320], direction: [[lx * 0.5, 0.7, lz * 0.5], [lx * 1.1, 1.3, lz * 1.1]], texture: FX.tex.chip, color: '#e0b450', color2: '#b08a30', blend: 'standard', gravity: [0, -1700, 0], spin: [-16, 16] });
        // дымок из дула
        FX.burst({ name: 'atkSmoke', position: [from.x + dir.x * 30, from.y + dir.y * 30, from.z + dir.z * 30], burst: id === 'shotgun' ? 6 : 3, capacity: 8, life: [0.7, 1.4], size: [16, 30], speed: [20, 70], direction: [[dir.x * 0.4 - 0.2, 0.1, dir.z * 0.4 - 0.2], [dir.x * 0.9 + 0.2, 0.5, dir.z * 0.9 + 0.2]], texture: FX.tex.smoke, color: '#cfcfcf', alpha: 0.4, blend: 'standard', sizeGradient: [[0, 0.5], [1, 2.4]] });
        if (isPlayer) {
            this.punch(id === 'shotgun' ? 2.2 : id === 'rifle' ? 1.8 : 1.2);
            Sky.flash(id === 'shotgun' ? 0.3 : 0.2, '#ffcf80', 0.1);
        }
    },
    // Стрела: летит по лучу и втыкается (stick) или исчезает при попадании во врага
    arrow(from, dir, len, stick) {
        if (this.off() || !Combat.scene || len < 150) return;
        const scene = Combat.scene;
        if (!this._arrowMat) { const m = new BABYLON.StandardMaterial('arrowFxM', scene); m.diffuseColor = new BABYLON.Color3(0.45, 0.3, 0.16); m.emissiveColor = new BABYLON.Color3(0.25, 0.2, 0.12); this._arrowMat = m; }
        const mesh = BABYLON.MeshBuilder.CreateCylinder('arrowFx', { height: 90, diameterTop: 0, diameterBottom: 5, tessellation: 5 }, scene);
        mesh.material = this._arrowMat; mesh.isPickable = false;
        const up = new BABYLON.Vector3(0, 1, 0), d = new BABYLON.Vector3(dir.x, dir.y, dir.z), ax = BABYLON.Vector3.Cross(up, d);
        mesh.rotationQuaternion = ax.lengthSquared() > 1e-6 ? BABYLON.Quaternion.RotationAxis(ax.normalize(), Math.acos(U.clamp(BABYLON.Vector3.Dot(up, d), -1, 1))) : BABYLON.Quaternion.Identity();
        const T = Math.max(0.05, len / 5200);
        Tween.to(T, (k) => { mesh.position.set(from.x + dir.x * len * k, from.y + dir.y * len * k, from.z + dir.z * len * k); }, { ease: (k) => k, done: () => {
            if (stick) Tween.to(1.2, (k) => { mesh.visibility = 1 - k * k; }, { ease: (k) => k, delay: 0.6, done: () => { try { mesh.dispose(); } catch (e) { /* ок */ } } });
            else { try { mesh.dispose(); } catch (e) { /* ок */ } }
        } });
        setTimeout(() => { try { mesh.dispose(); } catch (e) { /* ок */ } }, 4000);
    },
};

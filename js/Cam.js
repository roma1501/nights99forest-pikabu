// Cam.js — камера от третьего лица: плечо, сглаживание, столкновение с землёй, тряска, «удар» FOV,
// орбитальное кино-меню. Заменяет CameraController движка (Game.init отключает его).

/** @type {Record<string, any>} */
const Cam = {
    view: null, cam: null,
    yaw: 0, pitch: 0.42,             // pitch > 0 — камера смотрит вниз
    dist: 4.6 * M, distTarget: 4.6 * M, distMin: 1.6 * M, distMax: 9.5 * M,
    shoulder: 0,                     // обычная камера — строго за спиной; плечо только при прицеливании
    aimShoulder: 0.55 * M,
    focus: new BABYLON.Vector3(0, 0, 0),
    mode: 'follow',                  // follow | orbit | fixed
    fov: 66 * Math.PI / 180, fovBase: 66 * Math.PI / 180, fovKick: 0,
    shakeA: 0, shakeT: 0, shakeDecay: 6, trauma: 0,
    orbit: { cx: 0, cz: 0, r: 900, h: 360, a: 0, speed: 0.06 },
    aim: 0,
    extraShoulder: 0,
    roll: 0, rollTarget: 0,
    pos: new BABYLON.Vector3(), look: new BABYLON.Vector3(),
    fwd: new BABYLON.Vector3(0, 0, 1), rightV: new BABYLON.Vector3(-1, 0, 0),
    sens: 1,
    lockYaw: null,                   // принудительный взгляд (сценки): { yaw, pitch }
    smoothFocus: true,               // сглаживается только высота (ступени/прыжки); в плоскости камера жёстко за игроком

    init(view) {
        this.view = view; this.cam = view.camera;
        this.cam.minZ = 30; this.cam.maxZ = 14000;
        this.cam.fov = this.fov;
    },

    // Вращение от мыши/тача
    turn(dx, dy) {
        this.yaw -= dx * Input.sens * this.sens;
        this.pitch = U.clamp(this.pitch + dy * Input.sens * this.sens, -0.6, 1.25);
    },

    zoom(steps) { this.distTarget = U.clamp(this.distTarget + steps * 55, this.distMin, this.distMax); },

    // Тряска: trauma 0..1 (квадратично -> амплитуда)
    shake(t) { this.trauma = Math.min(1, this.trauma + t); },
    kick(fov) { this.fovKick = Math.max(this.fovKick, fov); },

    forward() { return this.fwd; },

    update(dt, target) {
        const cam = this.cam, terr = World.terrain;
        if (this.mode === 'orbit') return this._orbit(dt);
        if (!target) return;
        this.dist = U.damp(this.dist, this.distTarget - this.aim * 1.6 * M, 8, dt);
        const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        const f = this.fwd.set(Math.sin(this.yaw) * cp, -sp, Math.cos(this.yaw) * cp);
        const right = this.rightV.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
        // фокус: голова (+ плечо при прицеливании). В плоскости — без запаздывания, как в обычных играх от 3-го лица
        const sh = this.shoulder + this.aim * this.aimShoulder + (this.extraShoulder || 0);   // extraShoulder — стойка с луком (Archery)
        const fx = target.x + right.x * sh, fz = target.z + right.z * sh, fy = target.y + (target.head || 1.45 * M);
        this.focus.x = fx; this.focus.z = fz;
        this.focus.y = this.smoothFocus ? this.focus.y + (fy - this.focus.y) * (1 - Math.exp(-14 * dt)) : fy;
        // столкновение с землёй: укорачиваем луч
        let d = this.dist;
        for (let s = 1; s <= 12; s++) {
            const t = d * s / 12;
            const x = this.focus.x - f.x * t, y = this.focus.y - f.y * t, z = this.focus.z - f.z * t;
            const g = terr.heightAt(x, z) + 34;
            if (y < g) { d = Math.max(this.distMin * 0.6, t - d / 12); break; }
        }
        // препятствия на луче (деревья, предметы лагеря): камера подтягивается ближе, а не смотрит сквозь них
        let dc = d;
        const tmp = this._tmp || (this._tmp = { x: 0, z: 0, hit: null });
        for (let t = 80; t <= d; t += 28) {
            const x = this.focus.x - f.x * t, z = this.focus.z - f.z * t, y = this.focus.y - f.y * t;
            if (y - terr.heightAt(x, z) > 330) continue;                // выше 3.3 м — над предметами
            if (World.colliders.resolve(x, z, 20, tmp).hit) { dc = Math.max(this.distMin * 0.5, t - 45); break; }
        }
        if (this._cd == null) this._cd = dc;
        this._cd = dc < this._cd ? U.damp(this._cd, dc, 22, dt) : U.damp(this._cd, dc, 3.5, dt);
        d = Math.min(d, this._cd);
        const p = this.pos.set(this.focus.x - f.x * d, this.focus.y - f.y * d, this.focus.z - f.z * d);
        // не под землёй даже вблизи
        const g0 = terr.heightAt(p.x, p.z) + 36;
        if (p.y < g0) p.y = g0;
        // тряска
        this.trauma = Math.max(0, this.trauma - dt * 1.7);
        this.shakeT += dt * 38;
        const sk = this.trauma * this.trauma;
        if (sk > 0.0004) {
            p.x += (Math.sin(this.shakeT * 1.3) + Math.sin(this.shakeT * 2.7)) * 0.5 * sk * 26;
            p.y += Math.sin(this.shakeT * 1.9 + 1) * sk * 22;
            p.z += (Math.cos(this.shakeT * 1.1) + Math.sin(this.shakeT * 3.1)) * 0.5 * sk * 26;
        }
        cam.position.copyFrom(p);
        this.look.set(this.focus.x + f.x * 300, this.focus.y + f.y * 300, this.focus.z + f.z * 300);
        cam.setTarget(this.look);
        // FOV
        this.fovKick = U.damp(this.fovKick, 0, 6, dt);
        cam.fov = this.fovBase * (1 - this.aim * 0.14) + this.fovKick;
        this.roll = U.damp(this.roll, this.rollTarget, 6, dt);
        // Крен — только через upVector, каждый кадр с нуля. cam.rotation.z НЕ трогаем: при его смене
        // TargetCamera доворачивает upVector на всю матрицу камеры, и горизонт уезжает навсегда.
        this._setRoll(this.roll + Math.sin(this.shakeT * 0.7) * sk * 0.02);
    },

    // Вектор «вверх» камеры: мировой Y, повёрнутый вокруг оси взгляда на угол r (рад). Горизонт ровный при r = 0.
    _setRoll(r) {
        const up = this.cam.upVector, f = this.fwd;
        if (Math.abs(r) < 1e-5) { up.set(0, 1, 0); return; }
        const c = Math.cos(r), s = Math.sin(r);
        // right = f × up_world, нормированный (горизонтальный)
        let rx = f.z, rz = -f.x; const l = Math.hypot(rx, rz) || 1; rx /= l; rz /= l;
        up.set(rx * s, c, rz * s);
    },

    _orbit(dt) {
        const o = this.orbit, cam = this.cam, terr = World.terrain;
        o.a += o.speed * dt;
        const x = o.cx + Math.cos(o.a) * o.r, z = o.cz + Math.sin(o.a) * o.r;
        cam.position.set(x, terr.heightAt(x, z) + o.h, z);
        this.look.set(o.cx, terr.heightAt(o.cx, o.cz) + (o.ty || 150), o.cz);
        cam.rotation.z = 0;
        cam.setTarget(this.look);
        this._setRoll(0);
        cam.fov = this.fovBase * 0.85;
    },

    // Проекция мировой точки в CSS px (для меток, чисел урона)
    project(x, y, z) { return this.view.projectToScreen(x, z, y); },
};

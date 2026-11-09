// Sky.js — время суток: солнце/луна (одна направленная лампа), небо-купол с градиентом и звёздами,
// диски солнца и луны, облака, туман, полусферический свет. Считает день, фазу, «светлоту».
// Фаза p ∈ [0,1): 0 — начало рассвета; DATA.time задаёт границы. Sky.update(dt) — раз в кадр.
// Плагин цветной тени (World3D) читает scene.metadata.lorySun/loryShadow — здесь их и обновляем.

/** @type {Record<string, any>} */
const Sky = {
    view: null, scene: null,
    p: 0, day: 1, speed: 1, daylight: 1, night: 0,
    frozen: false,
    fogBoost: 0,       // событийный туман (гроза, туманная буря, финал)
    fogFear: 0,        // туман от страха (олень рядом) — Enemies.updateFear
    fogSources: {},    // независимые владельцы: прекращение одного эффекта не гасит остальные
    tintK: 0,
    _dome: null, _tex: null, _texAcc: 9, _sunMesh: null, _moonMesh: null, _clouds: [],
    listeners: { dusk: [], night: [], dawn: [], day: [] },
    _last: { night: false, dusk: false },
    K: null,

    // Ключевые кадры по фазе: p, небо-верх, горизонт, туман, солнце (цвет, сила), небо-свет (цвет, сила), земля-свет, густота тумана
    KEYS: [
        { p: 0.00, top: '#26355e', hor: '#c9866a', fog: '#8e7a86', sun: '#ffa060', si: 0.30, hemi: '#7f8cc0', hi: 0.33, gnd: '#3a3048', fd: 0.00030 },
        { p: 0.06, top: '#5d86c2', hor: '#f4b58a', fog: '#b4a49a', sun: '#ffc48a', si: 0.62, hemi: '#a9bce0', hi: 0.42, gnd: '#5f5a4a', fd: 0.00026 },
        { p: 0.16, top: '#4b96dc', hor: '#bcdcf0', fog: '#a5c6d2', sun: '#fff0d6', si: 0.98, hemi: '#cfe6ff', hi: 0.55, gnd: '#58743f', fd: 0.00022 },
        { p: 0.42, top: '#4a94da', hor: '#c2e0f2', fog: '#a9cbd6', sun: '#fff3dc', si: 1.00, hemi: '#d3e8ff', hi: 0.55, gnd: '#5a7a44', fd: 0.00021 },
        { p: 0.53, top: '#4470b8', hor: '#f5b070', fog: '#c8a086', sun: '#ffc07a', si: 0.80, hemi: '#c6c0d8', hi: 0.46, gnd: '#6a5a44', fd: 0.00024 },
        { p: 0.59, top: '#3a3f7c', hor: '#ee7a4e', fog: '#8a6a7c', sun: '#ff8a52', si: 0.48, hemi: '#8f8ec4', hi: 0.38, gnd: '#4a3a4e', fd: 0.00029 },
        // Лунный заполняющий свет сохраняет форму тёмных существ и оружия; небо остаётся ночным.
        { p: 0.66, top: '#0b1430', hor: '#26355c', fog: '#141e38', sun: '#aabbe8', si: 0.48, hemi: '#abb9dd', hi: 0.62, gnd: '#4d5870', fd: 0.00040 },
        { p: 0.80, top: '#070d22', hor: '#182848', fog: '#0f1830', sun: '#a4b4de', si: 0.42, hemi: '#9caed4', hi: 0.58, gnd: '#424d66', fd: 0.00044 },
        { p: 0.92, top: '#0d1638', hor: '#2b3a66', fog: '#1a2440', sun: '#a9b9e0', si: 0.45, hemi: '#a3b3d5', hi: 0.58, gnd: '#4a526b', fd: 0.00038 },
        { p: 1.00, top: '#26355e', hor: '#c9866a', fog: '#8e7a86', sun: '#ffa060', si: 0.30, hemi: '#7f8cc0', hi: 0.33, gnd: '#3a3048', fd: 0.00030 },
    ],

    init(view) {
        this.view = view; this.scene = view.scene;
        const T = DATA.time;
        this.p = T.startPhase; this.day = 1;
        this.K = this.KEYS.map(k => ({ p: k.p, top: U.c3(k.top), hor: U.c3(k.hor), fog: U.c3(k.fog), sun: U.c3(k.sun), si: k.si, hemi: U.c3(k.hemi), hi: k.hi, gnd: U.c3(k.gnd), fd: k.fd }));
        const scene = view.scene;
        // купол неба
        const dome = BABYLON.MeshBuilder.CreateSphere('skyDome', { diameter: 22000, segments: 16, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
        dome.infiniteDistance = true;
        dome.isPickable = false;
        dome.applyFog = false;
        dome.renderingGroupId = 0;
        dome.alwaysSelectAsActiveMesh = true;
        const tex = new BABYLON.DynamicTexture('skyTex', { width: 8, height: 512 }, scene, false);
        tex.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE; tex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
        const sm = new BABYLON.StandardMaterial('skyMat', scene);
        sm.disableLighting = true;
        sm.emissiveTexture = tex;
        sm.diffuseColor = new BABYLON.Color3(0, 0, 0);
        sm.specularColor = new BABYLON.Color3(0, 0, 0);
        sm.backFaceCulling = false;
        sm.disableDepthWrite = true;
        sm.fogEnabled = false;
        sm.metadata = { toon: false };
        dome.material = sm;
        dome.layerMask = 0x0FFFFFFF;
        this._dome = dome; this._tex = tex;
        // звёзды — отдельный купол со статичной текстурой; прозрачность = темнота
        {
            const st = new BABYLON.DynamicTexture('starTex', { width: 2048, height: 1024 }, scene, true);
            const g = st.getContext();
            g.clearRect(0, 0, 2048, 1024);
            const rnd = U.rng(77);
            for (let i = 0; i < 900; i++) {
                const y = Math.pow(rnd(), 0.7) * 500, x = rnd() * 2048;   // верхняя половина
                const b = 0.35 + rnd() * 0.65, sz = rnd() < 0.1 ? 3 : (rnd() < 0.4 ? 2 : 1);
                g.fillStyle = 'rgba(' + (235 + Math.floor(rnd() * 20)) + ',' + (235 + Math.floor(rnd() * 20)) + ',255,' + b.toFixed(2) + ')';
                g.fillRect(x, y, sz, sz);
            }
            st.update(); st.hasAlpha = true;
            const sd = BABYLON.MeshBuilder.CreateSphere('starDome', { diameter: 21000, segments: 16, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
            sd.infiniteDistance = true; sd.isPickable = false; sd.applyFog = false; sd.renderingGroupId = 0; sd.alwaysSelectAsActiveMesh = true;
            const sm2 = new BABYLON.StandardMaterial('starMat', scene);
            sm2.disableLighting = true; sm2.emissiveTexture = st; sm2.opacityTexture = st;
            sm2.diffuseColor = new BABYLON.Color3(0, 0, 0); sm2.specularColor = new BABYLON.Color3(0, 0, 0);
            sm2.backFaceCulling = false; sm2.disableDepthWrite = true; sm2.fogEnabled = false; sm2.metadata = { toon: false };
            sm2.alphaMode = BABYLON.Constants.ALPHA_ADD;
            sd.material = sm2;
            this._starDome = sd;
        }
        this._sunMesh = this._disc('sunDisc', 1800, '#fff2c8', '#ffb050');
        this._moonMesh = this._disc('moonDisc', 1050, '#f1f4ff', '#8aa4e8', true);
        this._makeClouds(scene);
        // свет: солнце и небо уже созданы View3D
        this.sunLight = view.sun; this.hemi = view.hemi;
        this.apply(0, true);
    },

    _disc(name, size, core, halo, moon) {
        const scene = this.scene;
        const dt = new BABYLON.DynamicTexture(name + 'Tex', 256, scene, true);
        const g = dt.getContext();
        g.clearRect(0, 0, 256, 256);
        const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(moon ? 0.16 : 0.10, core);
        grad.addColorStop(moon ? 0.20 : 0.16, halo + 'aa');
        grad.addColorStop(0.42, halo + '33');
        grad.addColorStop(1, halo + '00');
        g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
        if (moon) { /** @type {any} */ (g).globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(120,140,190,0.35)'; for (const [x, y, r] of [[118, 112, 9], [140, 134, 6], [108, 138, 5]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }
        dt.update();
        dt.hasAlpha = true;
        const m = BABYLON.MeshBuilder.CreatePlane(name, { size }, scene);
        m.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        m.isPickable = false;
        m.applyFog = false;
        m.renderingGroupId = 0;
        m.alwaysSelectAsActiveMesh = true;
        const mat = new BABYLON.StandardMaterial(name + 'Mat', scene);
        mat.disableLighting = true; mat.emissiveTexture = dt; mat.opacityTexture = dt;
        mat.diffuseColor = new BABYLON.Color3(0, 0, 0); mat.specularColor = new BABYLON.Color3(0, 0, 0);
        mat.disableDepthWrite = true; mat.fogEnabled = false; mat.backFaceCulling = false;
        mat.alphaMode = BABYLON.Constants.ALPHA_ADD;
        mat.metadata = { toon: false };
        m.material = mat;
        return m;
    },

    _makeClouds(scene) {
        const dt = new BABYLON.DynamicTexture('cloudTex', 256, scene, true);
        const g = dt.getContext();
        g.clearRect(0, 0, 256, 256);
        const rnd = U.rng(5);
        for (let i = 0; i < 46; i++) {
            const x = 40 + rnd() * 176, y = 70 + rnd() * 116, r = 16 + rnd() * 34;
            const gr = g.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        dt.update(); dt.hasAlpha = true;
        this._cloudMats = [];
        const rr = U.rng(12);
        for (let i = 0; i < 9; i++) {
            const m = BABYLON.MeshBuilder.CreatePlane('cloud' + i, { width: 5500 + rr() * 3500, height: 2600 + rr() * 1800 }, scene);
            m.rotation.x = Math.PI / 2;
            const mat = new BABYLON.StandardMaterial('cloudMat' + i, scene);
            mat.disableLighting = true; mat.emissiveTexture = dt; mat.opacityTexture = dt;
            mat.diffuseColor = new BABYLON.Color3(0, 0, 0); mat.specularColor = new BABYLON.Color3(0, 0, 0);
            mat.backFaceCulling = false; mat.disableDepthWrite = true; mat.fogEnabled = false;
            mat.metadata = { toon: false };
            m.material = mat; m.isPickable = false; m.applyFog = false; m.alwaysSelectAsActiveMesh = true;
            m.position.set((rr() - 0.5) * 21000, 3600 + rr() * 1200, (rr() - 0.5) * 21000);
            m.renderingGroupId = 0;
            this._clouds.push({ m, v: 30 + rr() * 60, mat });
            this._cloudMats.push(mat);
        }
    },

    // ------------------------------------------------------------------ сутки
    on(ev, fn) { this.listeners[ev].push(fn); },
    _emit(ev, a) { for (const f of this.listeners[ev]) f(a); },

    // Функция светлоты: 0 ночь … 1 день
    lightAt(p) {
        const T = DATA.time;
        if (p >= T.dayStart && p <= T.duskStart) return 1;
        if (p > T.duskStart && p < T.nightStart) return 1 - U.smooth((p - T.duskStart) / (T.nightStart - T.duskStart));
        if (p >= T.nightStart && p <= T.nightEnd) return 0;
        if (p > T.nightEnd) return U.smooth((p - T.nightEnd) / (1 + T.dayStart - T.nightEnd)) * 0.5;
        return 0.5 + U.smooth(p / T.dayStart) * 0.5;
    },

    isNight() { return this.p >= DATA.time.nightStart - 0.02 && this.p <= DATA.time.nightEnd; },
    isDark() { return this.daylight < 0.35; },
    timeOfDayLabel() { const p = this.p, T = DATA.time; return p < T.dayStart ? 'dawn' : p < T.duskStart ? 'day' : p < T.nightStart ? 'dusk' : p < T.nightEnd ? 'night' : 'dawn'; },

    // Перемотать на утро следующего дня
    skipToMorning() { this.p = 1.0; },

    update(dt) {
        if (!this.frozen) {
            const T = DATA.time;
            const before = this.p;
            this.p += dt * this.speed / T.cycle;
            if (this.p >= 1) { this.p -= 1; this.day++; this._emit('day', this.day); }
            this._events(before, this.p);
        }
        this.apply(dt, false);
    },

    _events(a, b) {
        const T = DATA.time;
        const cross = (x) => (a <= b ? a < x && b >= x : (a < x || b >= x));
        if (cross(T.duskStart)) this._emit('dusk', this.day);
        if (cross(T.nightStart)) this._emit('night', this.day);
        if (cross(T.nightEnd)) this._emit('dawn', this.day);
    },

    _key(p) {
        const K = this.K;
        let i = 0;
        while (i < K.length - 2 && p > K[i + 1].p) i++;
        const a = K[i], b = K[i + 1];
        const t = U.smooth(U.clamp((p - a.p) / Math.max(1e-6, b.p - a.p), 0, 1));
        return { top: U.lerpColor(a.top, b.top, t), hor: U.lerpColor(a.hor, b.hor, t), fog: U.lerpColor(a.fog, b.fog, t), sun: U.lerpColor(a.sun, b.sun, t),
            si: U.lerp(a.si, b.si, t), hemi: U.lerpColor(a.hemi, b.hemi, t), hi: U.lerp(a.hi, b.hi, t), gnd: U.lerpColor(a.gnd, b.gnd, t), fd: U.lerp(a.fd, b.fd, t) };
    },

    apply(dt, force) {
        const view = this.view, scene = this.scene;
        if (!view || !scene) return;
        const p = this.p;
        const k = this._key(p);
        const dl = this.daylight = this.lightAt(p);
        this.night = 1 - dl;
        // дуги светил
        const sunA = U.clamp((p - 0.02) / 0.62, 0, 1) * Math.PI;      // 0.02..0.64
        const moonA = U.clamp(((p < 0.5 ? p + 1 : p) - 0.60) / 0.46, 0, 1) * Math.PI;
        const toSun = new BABYLON.Vector3(Math.cos(sunA), Math.max(0.03, Math.sin(sunA)) * 0.92 + 0.02, 0.38).normalize();
        const toMoon = new BABYLON.Vector3(-Math.cos(moonA), Math.max(0.28, Math.sin(moonA)) * 0.9, -0.32).normalize();
        const t = U.smooth(U.clamp((dl - 0.15) / 0.5, 0, 1));
        const toL = new BABYLON.Vector3(U.lerp(toMoon.x, toSun.x, t), U.lerp(toMoon.y, toSun.y, t), U.lerp(toMoon.z, toSun.z, t)).normalize();
        const sun = this.sunLight;
        sun.direction = toL.negate();
        sun.diffuse = k.sun;
        sun.intensity = k.si;
        this.hemi.diffuse = k.hemi;
        this.hemi.groundColor = k.gnd;
        this.hemi.intensity = k.hi;
        // вспышка света (взрыв, молния): общий свет и тень на миг подсвечиваются, потом гаснут
        if (this.flashK > 0.003) {
            this.flashK *= Math.exp(-(dt || 0) * this.flashRate);
            const f = this.flashK;
            this.hemi.intensity = k.hi + f * 1.5;
            this.hemi.diffuse = U.lerpColor(k.hemi, this.flashCol, Math.min(1, f));
            this.hemi.groundColor = U.lerpColor(k.gnd, this.flashCol, Math.min(0.7, f * 0.6));
            sun.intensity = k.si + f * 0.5;
        } else this.flashK = 0;
        // туман и фон
        scene.fogColor = k.fog;
        const fb = Math.max(this.fogBoost, this.fogFear);   // событийный туман и туман страха не перебивают друг друга
        // Ночная сценовая дымка уже дополняется высотным Mist: прежний двойной множитель
        // превращал босса на 10–20 м в чёрный силуэт даже при достаточном лунном свете.
        const fogGain = 1 + fb * U.lerp(1.6, 0.7, this.night);
        scene.fogDensity = k.fd * U.lerp(0.7, 0.42, this.night) * fogGain;
        // высотная дымка (Mist.js): гуще ночью и в сумерках, рассветный туман; свечение в сторону светила
        const twi = Math.max(Math.exp(-Math.pow((p - 0.05) / 0.11, 2)), 0.8 * Math.exp(-Math.pow((p - 0.585) / 0.06, 2)));   // утренний и вечерний туман
        Mist.set((0.00016 + 0.00020 * this.night + 0.00056 * twi) * fogGain, k.fog, toL, U.lerp(0.3, 1.0, dl) * (0.55 + 0.9 * twi));
        Mist.tick(dt || 0);
        scene.clearColor = new BABYLON.Color4(k.hor.r, k.hor.g, k.hor.b, 1);
        // плагин цветной тени
        const md = scene.metadata || (scene.metadata = {});
        md.lorySun = { dir: toL.clone(), color: sun.diffuse.scale(sun.intensity) };
        md.loryShadow = { color: U.lerpColor(U.c3('#0a1a30'), U.c3('#1c3a2c'), dl), strength: 0.30 + 0.30 * dl };
        // купол и диски
        const cam = view.camera;
        this.toSun = toSun; this.toMoon = toMoon;
        this._sunMesh.position.copyFrom(cam.position).addInPlace(toSun.scale(10300));
        this._moonMesh.position.copyFrom(cam.position).addInPlace(toMoon.scale(9900));
        this._sunMesh.setEnabled(toSun.y > 0.05 && dl > 0.02);
        this._sunMesh.material.alpha = U.clamp(dl * 1.6, 0, 1);
        this._moonMesh.setEnabled(toMoon.y > 0.1);
        this._moonMesh.material.alpha = U.clamp(1 - dl * 1.5, 0, 1);
        this._texAcc += dt;
        if (force || this._texAcc > 0.1) { this._texAcc = 0; this._paintDome(k, dl, dt); }
        // облака
        for (const c of this._clouds) {
            c.m.position.x += c.v * dt * this.speed * 0.4;
            if (c.m.position.x > 11000) c.m.position.x = -11000;
            const cc = U.lerpColor(U.lerpColor(U.c3('#38425e'), U.c3('#ffffff'), dl), k.hor, 0.25 * (1 - dl) + 0.12);
            c.mat.emissiveColor = cc;
            c.mat.alpha = 0.9;
            c.m.position.y = 3600 + (c.m.position.z % 1200 + 1200) % 1200;
        }
        // камера-центр для облаков
        for (const c of this._clouds) { /* облака — в мировых координатах, но дальнего плана; fog off */ }
    },

    _paintDome(k, dl, dt) {
        const g = this._tex.getContext();
        const h = 512, w = 8;
        const grad = g.createLinearGradient(0, 0, 0, h);
        const css = (c, a) => 'rgb(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ')';
        const top = k.top, hor = k.hor;
        const mid = U.lerpColor(top, hor, 0.62);
        grad.addColorStop(0.0, css(top));
        grad.addColorStop(0.30, css(U.lerpColor(top, hor, 0.34)));
        grad.addColorStop(0.44, css(mid));
        grad.addColorStop(0.5, css(hor));
        grad.addColorStop(0.56, css(U.lerpColor(hor, k.fog, 0.7)));
        grad.addColorStop(1.0, css(k.fog));
        g.fillStyle = grad; g.fillRect(0, 0, w, h);
        this._tex.update(false);
        if (this._starDome) { const sa = U.clamp(1 - dl * 1.8, 0, 1); this._starDome.material.alpha = sa; this._starDome.setEnabled(sa > 0.01); }
    },

    // Прожектор луча света игрока и т.п. не здесь; ниже — вспомогательные
    // Туман события: 0..1, плавно
    setFogBoost(v, source) {
        const id = source || 'event';
        if (v > 0) this.fogSources[id] = U.clamp(v, 0, 1); else delete this.fogSources[id];
        this.fogBoost = Math.max(0, ...Object.values(this.fogSources));
    },
    clearFog() { this.fogSources = {}; this.fogBoost = 0; this.fogFear = 0; },

    // Вспышка освещения мира: сила pow (0..1.5), цвет, длительность затухания в секундах. Сильные вспышки перекрывают слабые.
    flashK: 0, flashRate: 8, flashCol: null,
    flash(pow, color, dur) {
        if (!this.hemi) return;
        const pw = U.clamp(pow == null ? 0.8 : pow, 0, 1.6);
        if (pw < this.flashK) return;
        this.flashK = pw; this.flashCol = U.c3(color || '#ffffff'); this.flashRate = 4 / Math.max(0.06, dur || 0.4);
    },

    // Сохранение/загрузка времени
    state() { return { p: this.p, day: this.day }; },
    load(s) { if (s) { this.p = s.p; this.day = s.day; } },
};

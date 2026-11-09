// FX.js — эффекты: процедурные текстуры частиц, рецепты (щепки, листья, пыль, искры, дым, огонь),
// живой огонь (костёр, факел), ночные светлячки, послеобработка (bloom, виньетка, ACES, зерно, хроматика).
// Частицы — через app.fx (ParticleFX движка: лимиты, пауза). Координаты — мировые px.

/** @type {Record<string, any>} */
const FX = {
    app: null, scene: null, pf: null, tex: {}, pipe: null,
    chroma: 0, chromaT: 0,
    ambient: [],

    init(app, view) {
        this.app = app; this.pf = app.fx; this.scene = view.scene; this.view = view;
        this._makeTextures();
        if (typeof Art !== 'undefined') Art.when(() => this.useArt());
        this.setupPipeline(view);
    },

    // ------------------------------------------------------------------------------ текстуры
    _canvas(size, draw) {
        const c = document.createElement('canvas'); c.width = c.height = size;
        const g = c.getContext('2d'); draw(g, size);
        return c.toDataURL('image/png');
    },
    _makeTextures() {
        const T = this.tex;
        T.soft = this._canvas(64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
        T.flame = this._canvas(128, (g, s) => {
            const r = g.createRadialGradient(s / 2, s * 0.62, 0, s / 2, s * 0.62, s * 0.44); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = r; g.beginPath(); g.ellipse(s / 2, s * 0.62, s * 0.3, s * 0.42, 0, 0, 7); g.fill();
            g.globalCompositeOperation = 'destination-in'; const m = g.createLinearGradient(0, 0, 0, s); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.25, 'rgba(0,0,0,0.85)'); m.addColorStop(0.6, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = m; g.fillRect(0, 0, s, s);
        });
        T.smoke = this._canvas(128, (g, s) => {
            const rnd = U.rng(3);
            for (let i = 0; i < 26; i++) { const x = s / 2 + (rnd() - 0.5) * s * 0.45, y = s / 2 + (rnd() - 0.5) * s * 0.45, r = s * (0.13 + rnd() * 0.2); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
            g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.7, 'rgba(0,0,0,0.6)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, s, s);
        });
        T.spark = this._canvas(64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(s / 2 - 1, 2, 2, s - 4); g.fillRect(2, s / 2 - 1, s - 4, 2); });
        T.star = this._canvas(64, (g, s) => { g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? s * 0.12 : s * 0.46; g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); } g.closePath(); g.fill(); });
        T.leaf = this._canvas(64, (g, s) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(s * 0.5, s * 0.08); g.quadraticCurveTo(s * 0.92, s * 0.42, s * 0.5, s * 0.92); g.quadraticCurveTo(s * 0.08, s * 0.42, s * 0.5, s * 0.08); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(s * 0.5, s * 0.15); g.lineTo(s * 0.5, s * 0.85); g.stroke(); });
        T.chip = this._canvas(32, (g, s) => { g.fillStyle = '#fff'; g.fillRect(s * 0.18, s * 0.32, s * 0.64, s * 0.36); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(s * 0.18, s * 0.5, s * 0.64, s * 0.18); });
        T.ring = this._canvas(128, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, s * 0.32, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.7, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
        T.rain = this._canvas(32, (g, s) => { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(14, 0, 3, s); });
        T.square = this._canvas(16, (g, s) => { g.fillStyle = '#fff'; g.fillRect(2, 2, s - 4, s - 4); });
        // декаль следа взрыва: тёмное неровное пятно с мягким краем (нарисованный assets/fx/scorch.webp заменяет её)
        T.scorch = this._canvas(128, (g, s) => {
            const rnd = U.rng(11);
            for (let i = 0; i < 18; i++) { const a = rnd() * 6.283, d = rnd() * s * 0.2, r = s * (0.16 + rnd() * 0.16); const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
            g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.75, 'rgba(0,0,0,0.8)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, s, s);
        });
        T.zzz = this._canvas(64, (g, s) => { g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = '#0006'; g.strokeText('Z', s / 2, s / 2); g.fillText('Z', s / 2, s / 2); });
    },

    // Нарисованные текстуры (assets/fx/<имя>.webp, список — в Art.has) заменяют процедурные; белые/серые с альфой — цвет задаёт код
    ART: ['soft', 'flame', 'smoke', 'spark', 'star', 'leaf', 'chip', 'ring', 'rain', 'square', 'zzz', 'scorch'],
    useArt() { for (const n of this.ART) if (Art.has('fx/' + n + '.webp')) this.tex[n] = 'assets/fx/' + n + '.webp'; },

    // ------------------------------------------------------------------------------ рецепты
    burst(o) { if (DBG.nofx) return null; const h = this.pf.create(o); return h; },

    dust(x, y, z, n, k) {
        k = k || 1;
        this.burst({ name: 'dust', position: [x, y + 6, z], burst: Math.round((n || 4) * 1.5), capacity: 24, life: [0.35, 0.8 * k], size: [16 * k, 34 * k], speed: [30, 90], direction: [[-1, 0.2, -1], [1, 0.8, 1]], texture: this.tex.smoke, color: '#b6a68a', color2: '#8f8c7a', alpha: 0.5, blend: 'standard', gravity: [0, 20, 0], sizeGradient: [[0, 0.4], [1, 1.5]], spin: [-1.5, 1.5] });
    },

    chips(x, y, z, f) {
        this.burst({ name: 'chips', position: [x, y, z], burst: 14, capacity: 24, life: [0.5, 1.0], size: [6, 12], speed: [180, 420], direction: [[-f.x - 0.6, 0.2, -f.z - 0.6], [-f.x + 0.6, 1.2, -f.z + 0.6]], texture: this.tex.chip, color: '#d9b070', color2: '#8a5a30', blend: 'standard', gravity: [0, -1400, 0], spin: [-12, 12] });
        this.burst({ name: 'chipsdust', position: [x, y, z], burst: 4, capacity: 8, life: [0.3, 0.6], size: [18, 30], speed: [20, 60], texture: this.tex.smoke, color: '#d9c39a', alpha: 0.35, blend: 'standard', sizeGradient: [[0, 0.5], [1, 1.6]] });
    },

    leaves(x, y, z, n) {
        this.burst({ name: 'leaves', position: [x, y, z], box: [[-120, -60, -120], [120, 60, 120]], burst: n || 8, capacity: 40, life: [1.4, 2.6], size: [9, 15], speed: [30, 120], direction: [[-1, -0.2, -1], [1, 0.5, 1]], texture: this.tex.leaf, color: '#4fae3a', color2: '#2f7a2c', blend: 'standard', gravity: [0, -160, 0], spin: [-4, 4] });
    },

    hitSpark(x, y, z, color) {
        this.burst({ name: 'hit', position: [x, y, z], burst: 10, capacity: 16, life: [0.15, 0.4], size: [8, 20], speed: [200, 480], texture: this.tex.spark, color: color || '#fff2b0', color2: '#ffffff', sizeGradient: [[0, 1], [1, 0]] });
        this.burst({ name: 'hitflash', position: [x, y, z], burst: 1, capacity: 2, life: [0.12, 0.18], size: [60, 90], speed: [0, 0], texture: this.tex.soft, color: color || '#fff2b0', sizeGradient: [[0, 0.5], [1, 1.4]] });
    },

    pickup(x, y, z) {
        this.burst({ name: 'pickup', position: [x, y, z], burst: 8, capacity: 12, life: [0.3, 0.6], size: [10, 18], speed: [40, 130], direction: [[-1, 0.4, -1], [1, 1.4, 1]], texture: this.tex.star, color: '#ffe680', color2: '#ffffff', gravity: [0, 80, 0], sizeGradient: [[0, 1], [1, 0]], spin: [-6, 6] });
    },
    heal(x, y, z) {
        this.burst({ name: 'heal', position: [x, y + 20, z], box: [[-40, 0, -40], [40, 20, 40]], burst: 14, capacity: 20, life: [0.7, 1.2], size: [12, 22], speed: [40, 90], direction: [[-0.2, 1, -0.2], [0.2, 1.4, 0.2]], texture: this.tex.star, color: '#5dff8a', color2: '#c8ffd8', sizeGradient: [[0, 0.3], [0.3, 1], [1, 0]], spin: [-3, 3] });
    },
    eat(x, y, z) {
        this.burst({ name: 'eat', position: [x, y, z], burst: 8, capacity: 10, life: [0.4, 0.8], size: [6, 12], speed: [50, 140], direction: [[-1, 0, -1], [1, 1, 1]], texture: this.tex.chip, color: '#ffcf70', blend: 'standard', gravity: [0, -900, 0], spin: [-8, 8] });
    },
    muzzle(x, y, z, d) {
        this.burst({ name: 'muzzle', position: [x + d.x * 20, y + d.y * 20, z + d.z * 20], burst: 1, capacity: 2, life: [0.06, 0.1], size: [80, 120], speed: [0, 0], texture: this.tex.soft, color: '#ffd070', sizeGradient: [[0, 0.6], [1, 1.5]] });
        this.burst({ name: 'muzzlesp', position: [x, y, z], burst: 8, capacity: 10, life: [0.1, 0.25], size: [6, 12], speed: [300, 700], direction: [[d.x - 0.25, d.y - 0.2, d.z - 0.25], [d.x + 0.25, d.y + 0.2, d.z + 0.25]], texture: this.tex.spark, color: '#ffe8a0', sizeGradient: [[0, 1], [1, 0]] });
        this.burst({ name: 'muzsmoke', position: [x, y, z], burst: 3, capacity: 4, life: [0.5, 1.0], size: [14, 26], speed: [10, 40], texture: this.tex.smoke, color: '#bbbbbb', alpha: 0.4, blend: 'standard', sizeGradient: [[0, 0.5], [1, 2]] });
    },
    poof(x, y, z, big) {
        const k = big ? 1.6 : 1;
        this.burst({ name: 'poof', position: [x, y, z], burst: Math.round(14 * k), capacity: 24, life: [0.5, 1.1], size: [30 * k, 70 * k], speed: [40, 150 * k], direction: [[-1, 0.1, -1], [1, 1, 1]], texture: this.tex.smoke, color: '#d9d9d9', color2: '#9a9a9a', alpha: 0.7, blend: 'standard', gravity: [0, 40, 0], sizeGradient: [[0, 0.4], [1, 1.5]], spin: [-2, 2] });
        this.burst({ name: 'poofstars', position: [x, y + 30, z], burst: 8, capacity: 12, life: [0.5, 0.9], size: [12, 22], speed: [120, 260], direction: [[-1, 0.3, -1], [1, 1.4, 1]], texture: this.tex.star, color: '#fff3a0', gravity: [0, -500, 0], sizeGradient: [[0, 1], [1, 0]], spin: [-8, 8] });
    },
    ring(x, y, z, size, color) {
        this.burst({ name: 'ring', position: [x, y, z], burst: 1, capacity: 2, life: [0.5, 0.6], size: [size * 0.3, size * 0.3], speed: [0, 0], texture: this.tex.ring, color: color || '#ffffff', sizeGradient: [[0, 0.2], [1, 1]], alpha: 0.8 });
    },
    sparkBurst(x, y, z, n, color) {
        this.burst({ name: 'sparks', position: [x, y, z], burst: n || 12, capacity: 30, life: [0.6, 1.4], size: [3, 7], speed: [80, 320], direction: [[-1, 0.5, -1], [1, 2, 1]], texture: this.tex.spark, color: color || '#ffb050', color2: '#ff7a20', gravity: [0, -300, 0], sizeGradient: [[0, 1], [1, 0]] });
    },
    // Взрыв: вспышка, огненный шар, языки пламени, дым столбом, пыль по земле, обломки, искры и тлеющие угольки.
    // R — радиус действия (px); kind 'flash' — светошумовая (белая вспышка и звёзды, без огня).
    explosion(x, y, z, R, kind) {
        const k = U.clamp(R / 520, 0.6, 1.8), gy = World.heightAt(x, z);
        if (kind === 'flash') {
            this.burst({ name: 'bangFlash', position: [x, y, z], burst: 3, capacity: 4, life: [0.25, 0.45], size: [R * 1.3, R * 1.8], speed: [0, 0], texture: this.tex.soft, color: '#ffffff', sizeGradient: [[0, 0.5], [1, 1.5]] });
            this.burst({ name: 'bangStars', position: [x, y, z], burst: 36, capacity: 44, life: [0.5, 1.2], size: [16, 34], speed: [300, 950], direction: [[-1, -0.2, -1], [1, 1.3, 1]], texture: this.tex.star, color: '#ffffff', color2: '#bfe6ff', gravity: [0, -240, 0], sizeGradient: [[0, 1], [1, 0]], spin: [-10, 10] });
            this.burst({ name: 'bangSmoke', position: [x, y, z], burst: 10, capacity: 14, life: [1.0, 1.8], size: [120, 220], speed: [60, 200], direction: [[-1, 0, -1], [1, 0.8, 1]], texture: this.tex.smoke, color: '#e8eef8', color2: '#b8c4d8', alpha: 0.5, blend: 'standard', sizeGradient: [[0, 0.5], [1, 2.2]], spin: [-1, 1] });
            return;
        }
        // 1) белая вспышка
        this.burst({ name: 'bFlash', position: [x, y + 40, z], burst: 3, capacity: 4, life: [0.12, 0.22], size: [R * 0.95, R * 1.3], speed: [0, 0], texture: this.tex.soft, color: '#fff2b8', sizeGradient: [[0, 0.5], [1, 1.5]] });
        // 2) круглый огненный шар и языки пламени вверх
        this.burst({ name: 'bFire', position: [x, y, z], burst: 30, capacity: 36, life: [0.4, 0.85], size: [130 * k, 270 * k], speed: [120 * k, 560 * k], direction: [[-1, -0.1, -1], [1, 1.1, 1]], texture: this.tex.soft, color: '#ffd45a', color2: '#ff7a1a', blend: 'add', gravity: [0, 240, 0], sizeGradient: [[0, 0.4], [0.35, 1], [1, 0.3]], colorGradient: [[0, '#fff8c0', 1], [0.3, '#ffb030', 0.95], [0.7, '#e0431a', 0.55], [1, '#401008', 0]], spin: [-2, 2] });
        this.burst({ name: 'bTongues', position: [x, y - 20, z], burst: 18, capacity: 24, life: [0.5, 1.0], size: [110 * k, 230 * k], speed: [160 * k, 480 * k], direction: [[-0.55, 0.9, -0.55], [0.55, 2.0, 0.55]], texture: this.tex.flame, color: '#ffc850', color2: '#ff5a14', blend: 'add', gravity: [0, 300, 0], sizeGradient: [[0, 0.5], [0.4, 1], [1, 0.2]], alpha: 0.9 });
        // 3) тяжёлый дым: растёт и поднимается столбом
        this.burst({ name: 'bSmoke', position: [x, y, z], burst: 24, capacity: 30, life: [1.8, 3.8], size: [150 * k, 320 * k], speed: [50, 260 * k], direction: [[-0.5, 0.6, -0.5], [0.5, 1.7, 0.5]], texture: this.tex.smoke, color: '#2a2a2c', color2: '#6c6c70', alpha: 0.68, blend: 'standard', gravity: [0, 90, 0], sizeGradient: [[0, 0.35], [1, 2.5]], spin: [-0.8, 0.8] });
        // 4) пыльная волна по земле
        this.burst({ name: 'bDust', position: [x, gy + 12, z], burst: 24, capacity: 30, life: [0.5, 1.2], size: [70 * k, 150 * k], speed: [460 * k, 980 * k], direction: [[-1, 0.02, -1], [1, 0.14, 1]], texture: this.tex.smoke, color: '#b6a68a', color2: '#8f8c7a', alpha: 0.55, blend: 'standard', sizeGradient: [[0, 0.4], [1, 2.1]], spin: [-1.5, 1.5] });
        // 5) обломки земли и щепа — вверх и в стороны, падают тяжело
        this.burst({ name: 'bDebris', position: [x, gy + 30, z], burst: 26, capacity: 32, life: [0.9, 1.7], size: [10, 26], speed: [520, 1150], direction: [[-0.7, 0.8, -0.7], [0.7, 2.2, 0.7]], texture: this.tex.chip, color: '#3a2a1c', color2: '#7a5a30', blend: 'standard', gravity: [0, -1900, 0], spin: [-14, 14] });
        // 6) искры-росчерки и тлеющие угольки
        this.burst({ name: 'bSparks', position: [x, y, z], burst: 48, capacity: 56, life: [0.5, 1.3], size: [4, 10], speed: [520, 1600], direction: [[-1, 0.2, -1], [1, 2.3, 1]], texture: this.tex.spark, color: '#ffd070', color2: '#ff7a20', gravity: [0, -900, 0], sizeGradient: [[0, 1], [1, 0]] });
        this.burst({ name: 'bEmbers', position: [x, y, z], burst: 16, capacity: 20, life: [1.6, 3.4], size: [3, 7], speed: [60, 260], direction: [[-0.8, 0.6, -0.8], [0.8, 2.0, 0.8]], texture: this.tex.spark, color: '#ffc060', color2: '#ff6a18', blend: 'add', gravity: [0, 70, 0], sizeGradient: [[0, 1], [0.7, 0.8], [1, 0]] });
    },

    zzz(x, y, z) {
        return this.pf.create({ name: 'zzz', position: [x, y, z], rate: 0.7, capacity: 6, life: [2.4, 3], size: [26, 34], speed: [22, 30], direction: [[-0.2, 1, 0.2], [0.2, 1, 0.4]], texture: this.tex.zzz, color: '#ffffff', blend: 'standard', sizeGradient: [[0, 0.3], [0.4, 1], [1, 0.6]], colorGradient: [[0, '#ffffff', 0], [0.2, '#ffffff', 1], [1, '#bcd6ff', 0]] });
    },

    // ------------------------------------------------------------------------------ живой огонь
    // Возвращает контроллер: { setLevel(0..1), setPos, dispose } — слои пламени, углей, дыма
    fire(x, y, z, scale, opts) {
        const o = opts || {};
        const s = scale || 1;
        const layers = [];
        const mk = (spec) => { const h = this.pf.create(spec); if (h) layers.push({ h, base: spec.rate || 0 }); return h; };
        const box = [[-28 * s, 0, -28 * s], [28 * s, 8, 28 * s]];
        mk({ name: 'fireCore', position: [x, y + 12, z], box, rate: 55 * s, capacity: 90, life: [0.35, 0.7], size: [46 * s, 84 * s], speed: [30 * s, 90 * s], direction: [[-0.12, 1, -0.12], [0.12, 1.4, 0.12]], texture: this.tex.flame, color: '#ffd45a', color2: '#ff8a1a', blend: 'add', gravity: [0, 90, 0], sizeGradient: [[0, 0.5], [0.3, 1], [1, 0.1]], colorGradient: [[0, '#fff2a0', 0.9], [0.35, '#ff9a20', 0.85], [0.75, '#e0431a', 0.5], [1, '#5a1608', 0]] });
        mk({ name: 'fireOuter', position: [x, y + 6, z], box: [[-46 * s, 0, -46 * s], [46 * s, 6, 46 * s]], rate: 26 * s, capacity: 50, life: [0.5, 0.95], size: [40 * s, 70 * s], speed: [20 * s, 60 * s], direction: [[-0.25, 0.8, -0.25], [0.25, 1.2, 0.25]], texture: this.tex.flame, color: '#ff8a20', color2: '#ff4a10', blend: 'add', gravity: [0, 70, 0], sizeGradient: [[0, 0.4], [0.4, 1], [1, 0]], alpha: 0.7 });
        mk({ name: 'fireGlow', position: [x, y + 40 * s, z], rate: 5, capacity: 8, life: [0.5, 0.9], size: [190 * s, 260 * s], speed: [0, 4], texture: this.tex.soft, color: '#ff8a30', color2: '#ffb050', blend: 'add', alpha: 0.28, sizeGradient: [[0, 0.8], [1, 1.1]] });
        mk({ name: 'embers', position: [x, y + 40, z], box: [[-40 * s, 0, -40 * s], [40 * s, 40, 40 * s]], rate: 14 * s, capacity: 40, life: [1.4, 3.0], size: [3, 6], speed: [40, 140], direction: [[-0.6, 1, -0.6], [0.6, 2, 0.6]], texture: this.tex.spark, color: '#ffc060', color2: '#ff7020', blend: 'add', gravity: [0, 60, 0], sizeGradient: [[0, 1], [0.7, 0.8], [1, 0]] });
        if (!o.noSmoke) mk({ name: 'fireSmoke', position: [x, y + 130 * s, z], box: [[-30 * s, 0, -30 * s], [30 * s, 20, 30 * s]], rate: 7 * s, capacity: 24, life: [2.2, 4], size: [50 * s, 110 * s], speed: [30, 70], direction: [[-0.3, 1, -0.3], [0.5, 1.6, 0.5]], texture: this.tex.smoke, color: '#4a4a4c', color2: '#2f2f31', alpha: 0.32, blend: 'standard', gravity: [0, 25, 0], sizeGradient: [[0, 0.5], [1, 2.6]], spin: [-0.6, 0.6] });
        const ctl = {
            layers, level: 1,
            setLevel(k) { this.level = k; for (const L of layers) { L.h.setRate(L.base * k); } },
            setPos(px, py, pz) { for (const L of layers) L.h.setPosition([px, py + (L.h.system.emitter ? 0 : 0), pz]); },
            dispose() { for (const L of layers) L.h.dispose(); layers.length = 0; },
        };
        return ctl;
    },

    // Небольшой факел
    torch(x, y, z) {
        const layers = [];
        const mk = (spec) => { const h = this.pf.create(spec); if (h) layers.push(h); return h; };
        mk({ name: 'torchFlame', position: [x, y, z], box: [[-6, 0, -6], [6, 4, 6]], rate: 30, capacity: 30, life: [0.25, 0.5], size: [22, 42], speed: [10, 40], direction: [[-0.1, 1, -0.1], [0.1, 1.3, 0.1]], texture: this.tex.flame, color: '#ffc850', color2: '#ff7a1a', blend: 'add', gravity: [0, 60, 0], sizeGradient: [[0, 0.6], [0.4, 1], [1, 0]], alpha: 0.9 });
        mk({ name: 'torchSpark', position: [x, y + 20, z], rate: 4, capacity: 8, life: [0.8, 1.6], size: [2, 4], speed: [20, 80], direction: [[-0.5, 1, -0.5], [0.5, 1.6, 0.5]], texture: this.tex.spark, color: '#ffc060', blend: 'add', gravity: [0, 30, 0] });
        return { layers, dispose() { for (const h of layers) h.dispose(); } };
    },

    // Светлячки/пыль вокруг точки (следуют за игроком, ночью ярче)
    ambientMotes(followFn) {
        const h1 = this.pf.create({ name: 'fireflies', position: [0, 0, 0], follow: followFn, box: [[-1400, 30, -1400], [1400, 300, 1400]], rate: 14, capacity: 64, life: [3, 6], size: [7, 12], speed: [8, 30], direction: [[-1, -0.3, -1], [1, 0.5, 1]], texture: this.tex.soft, color: '#d6ff7a', color2: '#7aff9a', blend: 'add', alpha: 0.9, colorGradient: [[0, '#d6ff7a', 0], [0.2, '#d6ff7a', 0.95], [0.5, '#c4ff60', 0.25], [0.7, '#d6ff7a', 0.95], [1, '#7aff9a', 0]] });
        const h2 = this.pf.create({ name: 'motes', position: [0, 0, 0], follow: followFn, box: [[-1000, 20, -1000], [1000, 500, 1000]], rate: 16, capacity: 60, life: [4, 8], size: [2, 4], speed: [4, 16], direction: [[-1, -0.1, -1], [1, 0.2, 1]], texture: this.tex.soft, color: '#ffffff', blend: 'add', alpha: 0.35 });
        this.ambient = [h1, h2].filter(Boolean);
        return this.ambient;
    },
    setAmbient(nightK, dayK) {
        if (!this.ambient.length) return;
        if (this.ambient[0]) this.ambient[0].setRate(16 * nightK);
        if (this.ambient[1]) this.ambient[1].setRate(14 * dayK);
    },

    // ------------------------------------------------------------------------------ послеобработка
    setupPipeline(view) {
        const scene = view.scene;
        try {
            const pipe = new BABYLON.DefaultRenderingPipeline('main', true, scene, [view.camera]);
            pipe.samples = IS_MOBILE ? 1 : 4;
            pipe.fxaaEnabled = IS_MOBILE;
            pipe.bloomEnabled = true; pipe.bloomThreshold = 0.78; pipe.bloomWeight = 0.42; pipe.bloomKernel = 56; pipe.bloomScale = 0.5;
            pipe.sharpenEnabled = !IS_MOBILE; pipe.sharpen.edgeAmount = 0.18; pipe.sharpen.colorAmount = 0.9;
            pipe.imageProcessingEnabled = true;
            const ip = pipe.imageProcessing;
            ip.toneMappingEnabled = true; ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
            ip.exposure = 1.18; ip.contrast = 1.12;
            ip.vignetteEnabled = true; ip.vignetteWeight = 2.4; ip.vignetteStretch = 0.4; ip.vignetteColor = new BABYLON.Color4(0, 0, 0, 0); ip.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
            ip.colorCurvesEnabled = true;
            const cc = new BABYLON.ColorCurves(); cc.globalSaturation = 14; cc.shadowsHue = 220; cc.shadowsDensity = 22; cc.shadowsSaturation = 14; cc.highlightsHue = 40; cc.highlightsDensity = 8; cc.highlightsSaturation = 10;
            ip.colorCurves = cc;
            pipe.chromaticAberrationEnabled = true; pipe.chromaticAberration.aberrationAmount = 0; pipe.chromaticAberration.radialIntensity = 1.2;
            pipe.grainEnabled = true; pipe.grain.intensity = 3.5; pipe.grain.animated = true;
            this.pipe = pipe;
        } catch (e) { console.warn('FX: конвейер недоступен', e); }
    },
    // Цветокоррекция та же, что в конвейере (тонмаппинг ACES, экспозиция, контраст, виньетка, кривые)
    _grade(ip) {
        ip.toneMappingEnabled = true; ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        ip.exposure = 1.18; ip.contrast = 1.12;
        ip.vignetteEnabled = true; ip.vignetteWeight = 2.4; ip.vignetteStretch = 0.4; ip.vignetteColor = new BABYLON.Color4(0, 0, 0, 0); ip.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
        ip.colorCurvesEnabled = true;
        const cc = new BABYLON.ColorCurves(); cc.globalSaturation = 14; cc.shadowsHue = 220; cc.shadowsDensity = 22; cc.shadowsSaturation = 14; cc.highlightsHue = 40; cc.highlightsDensity = 8; cc.highlightsSaturation = 10;
        ip.colorCurves = cc;
    },
    // Низкое качество: без конвейера (HDR-текстура кадра, аберрация, зерно, FXAA — отдельные проходы по экрану).
    // Та же цветокоррекция считается прямо в материалах — кадр рисуется сразу на экран.
    setPostFx(on) {
        const view = this.view;
        if (!view) return;
        if (on && !this.pipe) { this.setupPipeline(view); return; }
        if (!on && this.pipe) {
            try { this.pipe.dispose(); } catch (e) { /* уже снят */ }
            this.pipe = null;
            const ip = view.scene.imageProcessingConfiguration;
            this._grade(ip);
            ip.applyByPostProcess = false;
            ip.isEnabled = true;
        }
    },

    // Экранные эффекты по состоянию: страх (олень рядом), ночь, урон
    screen(dt, o) {
        const p = this.pipe;
        if (!p) return;   // без конвейера (низкое качество) экранных эффектов нет: сеттеры цветокоррекции пересобирали бы материалы
        this.chroma = U.damp(this.chroma, o.chroma || 0, 6, dt);
        p.chromaticAberration.aberrationAmount = this.chroma * 90;
        const ip = p.imageProcessing;
        ip.vignetteWeight = U.damp(ip.vignetteWeight, 2.2 + (o.vignette || 0) * 5, 5, dt);
        p.grain.intensity = 2 + (o.grain || 0) * 12;
        // exposure/contrast НЕ трогаем покадрово: сеттеры помечают все материалы грязными (~55 мс на кадр).
        p.bloomWeight = U.damp(p.bloomWeight, o.bloom != null ? o.bloom : 0.4, 3, dt);
    },
};

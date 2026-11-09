// Synth.js — процедурные звуки (в Sound Pack нет воя, рычания, криков, сердцебиения): генерируются при
// старте в AudioBuffer и кладутся в Sound как 'synth:<имя>' (играть — Sound.play('synth:howl')).
// Моно, 22050 Гц. Каждый звук — функция от времени + простые фильтры (RBJ biquad, однополюсные).

const TAU = Math.PI * 2;

/** @type {Record<string, any>} */
const Synth = {
    rate: 22050,
    names: [],

    // Биквадратный фильтр (RBJ): type 'bp' | 'lp' | 'hp'
    biquad(type, f, q, rate) {
        const w0 = TAU * f / rate, cs = Math.cos(w0), sn = Math.sin(w0), al = sn / (2 * q);
        let b0, b1, b2, a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
        if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; }
        else if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
        else { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
        return (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
    },
    lp1(k) { let y = 0; return (x) => (y += (x - y) * k); },
    saw(ph) { return 2 * (ph - Math.floor(ph + 0.5)); },
    env(t, a, d, dur) { return Math.min(1, t / Math.max(1e-4, a)) * Math.exp(-Math.max(0, t - a) * d) * Math.min(1, Math.max(0, (dur - t) / 0.04)); },

    // Собрать звук: fn(t, i, n, ctx) -> сэмпл; loop — сшить края
    build(name, dur, fn, o) {
        const opts = o || {};
        const r = this.rate, n = Math.floor(dur * r), out = new Float32Array(n);
        const state = {};
        let peak = 0;
        for (let i = 0; i < n; i++) { const v = fn(i / r, i, n, state); out[i] = v; const a = Math.abs(v); if (a > peak) peak = a; }
        const g = (opts.gain != null ? opts.gain : 0.9) / Math.max(1e-6, peak);
        for (let i = 0; i < n; i++) out[i] *= g;
        if (opts.loop) {   // кроссфейд последних 12% с началом
            const L = Math.floor(n * 0.12);
            for (let i = 0; i < L; i++) { const k = i / L; out[n - L + i] = out[n - L + i] * (1 - k) + out[i] * k; }
        }
        const buf = Sound.makeBuffer(out, r);
        if (buf) { Sound.putBuffer('synth:' + name, buf); this.names.push(name); }
        return out;
    },

    init() {
        const rnd = U.rng(4242);
        const noise = () => rnd() * 2 - 1;
        const B = (name, dur, fn, o) => { try { this.build(name, dur, fn, o); } catch (e) { console.warn('Synth ' + name, e); } };

        // Голос «ууф»: пилообразный источник + две форманты
        const voice = (f0fn, formants, breath) => {
            let ph = 0; const bps = formants.map(([f, q]) => this.biquad('bp', f, q, this.rate));
            return (t, dt) => {
                const f0 = f0fn(t); ph += f0 * dt;
                const s = this.saw(ph) + 0.35 * this.saw(ph * 2.01);
                let o = 0; bps.forEach((b, i) => { o += b(s + noise() * (breath || 0)) * (i === 0 ? 1 : 0.7); });
                return o;
            };
        };
        const dt1 = 1 / this.rate;
        for (const [nm, base] of /** @type {[string, number][]} */ ([['hurt1', 210], ['hurt2', 175], ['hurt3', 245]])) {
            const v = voice((t) => base * (1 - 0.32 * t / 0.3), [[520, 3.2], [1000, 4]], 0.04);
            B(nm, 0.32, (t) => v(t, dt1) * this.env(t, 0.006, 11, 0.32) * 1.3);
        }
        { const v = voice((t) => 230 * Math.exp(-t * 0.9) + 60, [[700, 3], [1200, 4]], 0.05);
          B('death', 1.0, (t) => (v(t, dt1) * this.env(t, 0.01, 3.6, 1.0)) + Math.sin(TAU * 52 * t) * Math.exp(-t * 7) * 0.5); }

        // Вой волка
        { let ph = 0; const bre = this.biquad('bp', 1400, 1.2, this.rate);
          B('howl', 2.9, (t) => {
              const rise = U.smooth(t / 1.15), fall = U.smooth((t - 1.7) / 1.2);
              const f = 300 + 300 * rise - 230 * fall + Math.sin(TAU * 5.4 * t) * 14 * U.smooth((t - 0.5) / 0.6);
              ph += f / this.rate;
              const a = U.smooth(t / 0.45) * (1 - U.smooth((t - 2.15) / 0.75));
              return (Math.sin(TAU * ph) + 0.5 * Math.sin(TAU * ph * 2) + 0.22 * Math.sin(TAU * ph * 3) + bre(noise()) * 0.18) * a;
          }); }
        // Рычание
        { let ph = 0; const lp = this.lp1(0.12); const bp = this.biquad('bp', 330, 1.6, this.rate);
          B('growl', 1.2, (t) => {
              const f = 68 + Math.sin(TAU * 3 * t) * 6 + noise() * 3; ph += f / this.rate;
              const am = 0.55 + 0.45 * Math.sin(TAU * 31 * t);
              const s = this.saw(ph) * am + bp(noise()) * 0.5;
              return Math.tanh(lp(s) * 5) * U.smooth(t / 0.1) * (1 - U.smooth((t - 0.85) / 0.35));
          }); }
        // Лай
        { let ph = 0; const bp = this.biquad('bp', 700, 1.4, this.rate);
          B('bark', 0.3, (t) => { const f = 480 - 210 * t / 0.3; ph += f / this.rate; return (this.saw(ph) * 0.7 + bp(noise())) * this.env(t, 0.004, 13, 0.3); }); }
        // Рёв медведя
        { let ph = 0; const bp = this.biquad('bp', 240, 1.1, this.rate); const lp = this.lp1(0.22);
          B('roar', 1.7, (t) => {
              const f = 92 - 34 * U.smooth(t / 1.4) + Math.sin(TAU * 8 * t) * 5; ph += f / this.rate;
              const am = 0.6 + 0.4 * Math.sin(TAU * 17 * t);
              return Math.tanh(lp(this.saw(ph) * am + bp(noise()) * 0.8) * 6) * U.smooth(t / 0.12) * (1 - U.smooth((t - 1.2) / 0.5));
          }); }
        // Крик оленя: два расстроенных «визга» с вибрато, форманта плывёт, распределённое эхо
        { let p1 = 0, p2 = 0; const bpA = this.biquad('bp', 1500, 5, this.rate), bpB = this.biquad('bp', 2800, 4, this.rate);
          const dl = new Float32Array(Math.floor(this.rate * 0.13)); let di = 0;
          B('screech', 1.9, (t) => {
              const sw = U.smooth(t / 0.5), f = 780 + 900 * sw - 380 * U.smooth((t - 1.1) / 0.7) + Math.sin(TAU * 9.5 * t) * 40;
              p1 += f / this.rate; p2 += f * 1.5 * 1.011 / this.rate;
              const trem = 0.7 + 0.3 * Math.sin(TAU * 26 * t);
              let s = (this.saw(p1) + 0.75 * this.saw(p2)) * trem;
              s = bpA(s) * 1.4 + bpB(s) * 0.9 + noise() * 0.14;
              s = Math.tanh(s * 2.6);
              const a = U.smooth(t / 0.08) * (1 - U.smooth((t - 1.2) / 0.7));
              const echo = dl[di]; dl[di] = s * a + echo * 0.38; di = (di + 1) % dl.length;
              return s * a + echo * 0.45;
          }); }
        // Дыхание
        { const bp = this.biquad('bp', 1100, 0.8, this.rate);
          B('breath', 2.4, (t) => bp(noise()) * (0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(TAU * t / 2.4 * 1 - 1.4), 2)), { gain: 0.5, loop: true }); }
        // Сердцебиение
        B('heartbeat', 0.9, (t) => { const b = (tt) => tt < 0 ? 0 : Math.sin(TAU * (58 - 20 * Math.min(1, tt * 6)) * tt) * Math.exp(-tt * 20); return b(t) + 0.75 * b(t - 0.26) + Math.sin(TAU * 120 * t) * Math.exp(-t * 60) * 0.25; });
        // Сова
        B('hoot', 1.5, (t) => { let s = 0; for (const t0 of [0, 0.5, 1.0]) { const tt = t - t0; if (tt >= 0 && tt < 0.4) s += Math.sin(TAU * (420 - 60 * tt) * tt + Math.sin(TAU * 6 * tt) * 0.3) * Math.sin(Math.PI * tt / 0.4) * (t0 === 1.0 ? 1 : 0.7); } return s; });
        // Кролик
        B('squeak', 0.18, (t) => Math.sin(TAU * (2100 - 800 * t / 0.18) * t) * this.env(t, 0.01, 12, 0.18));
        // Сверчки (петля)
        { const cb = this.biquad('bp', 4300, 12, this.rate), cb2 = this.biquad('bp', 3400, 9, this.rate);
          B('crickets', 3.2, (t) => { let e = 0; for (let g = 0; g < 4; g++) { const t0 = g * 0.8 + 0.1 + 0.09 * Math.sin(g * 7.3 + 1); for (let k = 0; k < 4; k++) { const tt = t - t0 - k * 0.06; if (tt >= 0 && tt < 0.042) { const w = Math.sin(Math.PI * tt / 0.042); e += w * w * (1 - 0.12 * k); } } } return cb(noise()) * e * 2.4 + cb2(noise()) * e * 0.8; }, { gain: 0.26, loop: true }); }
        // Ветер (петля)
        { const lpA = this.lp1(0.02), bpA = this.biquad('bp', 380, 0.6, this.rate);
          B('wind', 7, (t) => (lpA(noise()) * 2.5 + bpA(noise()) * 0.35) * (0.55 + 0.45 * Math.sin(TAU * t / 7 * 2 + 0.6) * Math.sin(TAU * t / 7 * 3)), { gain: 0.7, loop: true }); }
        // Потрескивание костра (петля)
        // шумовые щелчки (без тональной составляющей) через широкий полосовой фильтр + мягкий гул углей
        { const rumble = this.lp1(0.012), band = this.biquad('bp', 1500, 0.4, this.rate), hp = this.biquad('hp', 420, 0.7, this.rate); let pops = [];
          B('crackle', 3.4, (t, i) => {
              if (rnd() < 15 / this.rate) pops.push({ t0: t, k: 220 + rnd() * 650, a: 0.2 + rnd() * rnd() * 1.1 });
              pops = pops.filter(p => t - p.t0 < 0.07);
              let c = 0; for (const p of pops) c += noise() * Math.exp(-(t - p.t0) * p.k) * p.a;
              return rumble(noise()) * 1.7 + band(hp(c)) * 1.4;
          }, { gain: 0.7, loop: true }); }
        // Удар шагов оленя
        B('thud', 0.35, (t) => Math.sin(TAU * (70 - 30 * t / 0.35) * t) * Math.exp(-t * 11) * 1.2 + noise() * Math.exp(-t * 60) * 0.3);
        // Утро: колокольчик; Ночь: гонг
        B('dawn', 2.0, (t) => { let s = 0; [[0, 523], [0.18, 659], [0.36, 784], [0.6, 1047]].forEach(([t0, f]) => { const tt = t - t0; if (tt >= 0) s += (Math.sin(TAU * f * tt) + 0.3 * Math.sin(TAU * f * 2.01 * tt)) * Math.exp(-tt * 2.6); }); return s; });
        B('gong', 3.4, (t) => (Math.sin(TAU * 98 * t) + 0.7 * Math.sin(TAU * 147 * t) + 0.4 * Math.sin(TAU * 220.5 * t) + 0.25 * Math.sin(TAU * 311 * t)) * Math.exp(-t * 1.3) * U.smooth(t / 0.01));
        // Шипение жарки
        { const hp = this.biquad('hp', 2600, 0.7, this.rate); B('sizzle', 1.6, (t) => hp(noise()) * (0.6 + 0.4 * Math.sin(TAU * 7 * t)) * Math.sin(Math.PI * t / 1.6), { gain: 0.5 }); }
        // Падение дерева: скрип + тяжёлый удар
        { const bp = this.biquad('bp', 500, 2, this.rate);
          B('treefall', 2.2, (t) => { const crack = bp(noise()) * (t < 0.7 ? Math.min(1, t * 6) * (0.5 + 0.5 * Math.sin(TAU * 34 * t)) : 0) * 0.7; const land = t > 1.05 ? (Math.sin(TAU * (62 - 18 * Math.min(1, (t - 1.05) * 2)) * (t - 1.05)) * Math.exp(-(t - 1.05) * 6) + noise() * Math.exp(-(t - 1.05) * 16) * 0.5) * 1.3 : 0; return crack + land; }); }
        // Лязг капкана / хлопок
        { const lpT = this.biquad('lp', 170, 0.7, this.rate), bpT = this.biquad('bp', 900, 0.8, this.rate);
          B('thunder', 3.8, (t) => bpT(noise()) * Math.exp(-t * 26) * 1.2 + lpT(noise()) * 7 * Math.min(1, t * 8) * Math.exp(-t * 1.25) * (0.6 + 0.4 * Math.sin(TAU * 7 * t)), { gain: 0.9 }); }
        { const bpM = this.biquad('bp', 500, 1.2, this.rate); let phM = 0;
          B('meteor', 2.4, (t) => { phM += (1800 - 1300 * t / 2.4) / this.rate; return (bpM(noise()) * 0.8 + Math.sin(TAU * phM) * 0.15) * Math.min(1, t * 3) * (t > 2.0 ? Math.max(0, 1 - (t - 2.0) / 0.4) : 1); }, { gain: 0.8 }); }
        { const lpB = this.biquad('lp', 240, 0.7, this.rate), bpB = this.biquad('bp', 1400, 0.7, this.rate);
          B('boom', 2.6, (t) => bpB(noise()) * Math.exp(-t * 18) * 1.3 + lpB(noise()) * 6 * Math.min(1, t * 40) * Math.exp(-t * 2.4) + Math.sin(TAU * (80 - 40 * Math.min(1, t * 1.3)) * t) * Math.exp(-t * 3.2) * 1.2, { gain: 0.95 }); }
        { const hpF = this.biquad('hp', 3000, 0.7, this.rate); B('fuse', 1.0, (t) => hpF(noise()) * 0.6 * (0.7 + 0.3 * Math.sin(TAU * 40 * t)), { gain: 0.35 }); }
        B('bang', 1.2, (t) => noise() * Math.exp(-t * 30) * 1.4 + Math.sin(TAU * 3200 * t) * Math.exp(-t * 8) * 0.4 + Math.sin(TAU * 1800 * t) * Math.exp(-t * 5) * 0.2, { gain: 0.8 });
        B('snapcall', 0.3, (t) => (noise() * Math.exp(-t * 60) + Math.sin(TAU * 1400 * t) * Math.exp(-t * 40) * 0.5));
        // Колокол-набат (рейд)
        B('alarm', 1.8, (t) => (Math.sin(TAU * 440 * t) + 0.5 * Math.sin(TAU * 880.6 * t) + 0.3 * Math.sin(TAU * 1330 * t)) * Math.exp(-t * 2.2) * (0.6 + 0.4 * Math.sin(TAU * 7 * t)));
        // Шаги по поверхностям (по два варианта): камень — сухой цок, снег — хруст, вода — плеск, земля — глухой шлёпок
        for (const v of [1, 2]) {
            { const bp = this.biquad('bp', 1900 + v * 260, 1.6, this.rate), lo = this.biquad('lp', 260, 0.8, this.rate);
              B('stepstone' + v, 0.16, (t) => (bp(noise()) * Math.exp(-t * 62) * 1.1 + Math.sin(TAU * (1250 + v * 140) * t) * Math.exp(-t * 120) * 0.35 + lo(noise()) * Math.exp(-t * 38) * 0.5) * this.env(t, 0.001, 0, 0.16), { gain: 0.8 }); }
            { const hp = this.biquad('hp', 2400, 0.7, this.rate), lo = this.biquad('lp', 380, 0.7, this.rate); let pops = [];
              B('stepsnow' + v, 0.26, (t) => { if (rnd() < 160 / this.rate && t < 0.14) pops.push({ t0: t, f: 2800 + rnd() * 2600, a: 0.4 + rnd() * 0.6 }); let s = hp(noise()) * Math.exp(-t * 16) * 0.5 + lo(noise()) * Math.exp(-t * 26) * 0.9; for (const p of pops) s += Math.sin(TAU * p.f * (t - p.t0)) * Math.exp(-(t - p.t0) * 240) * p.a * 0.35; return s * this.env(t, 0.002, 0, 0.26); }, { gain: 0.75 }); }
            { const lp = this.biquad('lp', 1500, 0.9, this.rate), bp = this.biquad('bp', 900 + v * 180, 2.2, this.rate); let ph = 0;
              B('stepwater' + v, 0.4, (t) => { ph += (480 + 900 * Math.min(1, t * 5) * Math.exp(-t * 4)) / this.rate; return (lp(noise()) * Math.exp(-t * 11) * 0.9 + bp(noise()) * Math.exp(-t * 7) * 0.5 + Math.sin(TAU * ph) * Math.exp(-t * 16) * 0.18) * this.env(t, 0.003, 0, 0.4); }, { gain: 0.8 }); }
            { const lo = this.biquad('lp', 520 + v * 80, 0.8, this.rate);
              B('stepdirt' + v, 0.17, (t) => (lo(noise()) * Math.exp(-t * 34) * 1.2 + Math.sin(TAU * (95 - 30 * t / 0.17) * t) * Math.exp(-t * 28) * 0.7) * this.env(t, 0.002, 0, 0.17), { gain: 0.8 }); }
        }
        console.log('Synth: ' + this.names.length + ' звуков');
    },
};

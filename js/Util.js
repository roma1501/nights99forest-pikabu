// Util.js — мелкие помощники игры: генератор случайных чисел с сидом, математика, сглаживание,
// пространственная сетка для столкновений, твины. Единицы мира — px (1 м = 100 px, M).

const M = 100;   // px в метре
const DBG = (() => { const q = new URLSearchParams(location.search); const o = {}; q.forEach((v, k) => { o[k] = v || true; }); return o; })();   // ?nochunks ?noshadow ?nofx — отладка

/** @satisfies {Record<string, any>} */
const U = {
    // Mulberry32: детерминированный ГСЧ (лес, лут и карта не меняются между запусками)
    rng(seed) {
        let a = (seed >>> 0) || 1;
        const f = () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        f.range = (lo, hi) => lo + (hi - lo) * f();
        f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
        f.pick = (arr) => arr[Math.floor(f() * arr.length)];
        f.chance = (p) => f() < p;
        return f;
    },
    clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    // экспоненциальное сглаживание, не зависящее от fps: доля k за секунду
    damp(cur, target, k, dt) { return cur + (target - cur) * (1 - Math.exp(-k * dt)); },
    dampAngle(cur, target, k, dt) { return cur + U.angleDiff(cur, target) * (1 - Math.exp(-k * dt)); },
    smooth(t) { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); },
    step(edge0, edge1, x) { return U.smooth((x - edge0) / (edge1 - edge0)); },
    angleDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; },
    dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; },
    dist(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); },
    // курс (рад) в сторону (dx, dz): 0 — вдоль +Z; rotation.y = yaw
    yawTo(dx, dz) { return Math.atan2(dx, dz); },
    easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
    easeInCubic(t) { return t * t * t; },
    easeOutElastic(t) { if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1; },
    fmtTime(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); },
    c3(hex) { return BABYLON.Color3.FromHexString(hex); },
    lerpColor(a, b, t) { return new BABYLON.Color3(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t); },
    // Случайная точка в кольце (xz), для спавнов
    ringPoint(rand, cx, cz, r0, r1) { const a = rand() * Math.PI * 2, r = Math.sqrt(U.lerp(r0 * r0, r1 * r1, rand())); return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r }; },
};

// Твины: плавно менять числа и вызывать fn(значение). Живут в Game.update -> Tween.update(dt)
/** @satisfies {Record<string, any>} */
const Tween = {
    list: [],
    // Tween.to(0.4, t => el.style.opacity = t, { ease, delay, done })
    to(dur, fn, o) {
        const opts = o || {};
        const tw = { t: -(opts.delay || 0), dur: Math.max(0.0001, dur), fn, ease: opts.ease || U.smooth, done: opts.done, dead: false };
        this.list.push(tw);
        return tw;
    },
    update(dt) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const tw = this.list[i];
            tw.t += dt;
            if (tw.t < 0) continue;
            const k = Math.min(1, tw.t / tw.dur);
            if (!tw.dead) tw.fn(tw.ease(k), k);
            if (k >= 1 || tw.dead) { this.list.splice(i, 1); if (!tw.dead && tw.done) tw.done(); }
        }
    },
    clear() { this.list.length = 0; },
};

// Простая пространственная сетка кругов-столкновений (деревья, камни, стены)
class Colliders {
    constructor(cell) {
        this.cell = cell || 600;
        this.map = new Map();
        this.all = [];
    }
    _key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
    add(x, z, r, owner) {
        const c = { x, z, r, owner: owner || null, on: true };
        this.all.push(c);
        const ix0 = Math.floor((x - r) / this.cell), ix1 = Math.floor((x + r) / this.cell);
        const iz0 = Math.floor((z - r) / this.cell), iz1 = Math.floor((z + r) / this.cell);
        for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
            const k = this._key(ix, iz);
            let a = this.map.get(k);
            if (!a) { a = []; this.map.set(k, a); }
            a.push(c);
        }
        return c;
    }
    remove(c) { c.on = false; }
    // Вытолкнуть круг (x, z, r) из препятствий; возвращает { x, z, hit }
    resolve(x, z, r, out) {
        const res = out || { x, z, hit: null };
        res.x = x; res.z = z; res.hit = null;
        const ix0 = Math.floor((x - r) / this.cell), ix1 = Math.floor((x + r) / this.cell);
        const iz0 = Math.floor((z - r) / this.cell), iz1 = Math.floor((z + r) / this.cell);
        for (let pass = 0; pass < 2; pass++) {
            for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
                const a = this.map.get(this._key(ix, iz));
                if (!a) continue;
                for (const c of a) {
                    if (!c.on) continue;
                    const dx = res.x - c.x, dz = res.z - c.z, rr = r + c.r;
                    const d2 = dx * dx + dz * dz;
                    if (d2 < rr * rr) {
                        const d = Math.sqrt(d2) || 0.0001;
                        const push = rr - d;
                        res.x += dx / d * push; res.z += dz / d * push;
                        res.hit = c;
                    }
                }
            }
        }
        return res;
    }
    // Ближайшие круги в радиусе (для ударов по деревьям и т.п.)
    query(x, z, r, fn) {
        const ix0 = Math.floor((x - r) / this.cell), ix1 = Math.floor((x + r) / this.cell);
        const iz0 = Math.floor((z - r) / this.cell), iz1 = Math.floor((z + r) / this.cell);
        const seen = new Set();
        for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
            const a = this.map.get(this._key(ix, iz));
            if (!a) continue;
            for (const c of a) {
                if (!c.on || seen.has(c)) continue;
                seen.add(c);
                if (U.dist2(x, z, c.x, c.z) <= (r + c.r) * (r + c.r)) fn(c);
            }
        }
    }
}

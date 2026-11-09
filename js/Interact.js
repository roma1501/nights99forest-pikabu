// Interact.js — подсказка «E»: выбирает лучшую цель рядом (по расстоянию и взгляду), показывает её в UI,
// по E вызывает act(). Источники: статичные (костёр, верстак…), предметы на земле, динамические провайдеры.
// Запись: { x, y, z, r, text() | str, sub, act(), enabled(), prio, warn, key, lock }

/** @type {Record<string, any>} */
const Interact = {
    list: [],
    providers: [],
    best: null,
    cool: 0,

    add(o) { this.list.push(o); return o; },
    remove(o) { const i = this.list.indexOf(o); if (i >= 0) this.list.splice(i, 1); },
    clear() { this.list.length = 0; },

    update(dt) {
        if (this.cool > 0) this.cool -= dt;
        const enabled = Player.control && !Player.dead && !Player.sleeping && !UI.blocking() && !(Camp && Camp.placing);
        if (!enabled) { this.best = null; UI.setPrompt(null); return; }
        const px = Player.x, pz = Player.z;
        const fx = Math.sin(Player.faceYaw), fz = Math.cos(Player.faceYaw);
        let best = null, bs = 1e9;
        const consider = (o) => {
            if (o.enabled && !o.enabled()) return;
            const dx = o.x - px, dz = o.z - pz, d = Math.hypot(dx, dz);
            const r = (o.r || 200);
            if (d > r) return;
            if (o.y != null && Math.abs(o.y - Player.y) > 320) return;
            const dot = d > 30 ? (dx * fx + dz * fz) / d : 1;
            if (dot < (o.dot != null ? o.dot : -0.15) && d > 90) return;
            const score = d - dot * 70 - (o.prio || 0) * 120;
            if (score < bs) { bs = score; best = o; }
        };
        for (const o of this.list) consider(o);
        // предметы на земле
        const it = Items.nearest(px, pz, fx, fz, 1.9 * M);
        if (it) consider(this.itemEntry(it));
        for (const p of this.providers) p(consider);
        this.best = best;
        if (!best) { UI.setPrompt(null); return; }
        const text = typeof best.text === 'function' ? best.text() : best.text;
        const sub = typeof best.sub === 'function' ? best.sub() : best.sub;
        UI.setPrompt({ pos: { x: best.x, y: (best.y != null ? best.y : Player.y) + (best.h != null ? best.h : 120), z: best.z }, text, sub, warn: best.warn && best.warn(), key: best.key });
        if (Input.pressed('interact') && this.cool <= 0) {
            this.cool = 0.18;
            best.act();
        }
    },

    itemEntry(it) {
        if (!it._entry) {
            it._entry = { x: 0, y: 0, z: 0, r: 190, h: 70, prio: 0.5, dot: -0.6,
                text: () => Lang.t('pIn.pickup', { item: UI.name(it.id) }) + (it.n > 1 ? ' ×' + it.n : ''),
                sub: () => Inv.canAdd(it.id, it.n) <= 0 ? Lang.t('bagFull') : '',
                warn: () => Inv.canAdd(it.id, it.n) <= 0,
                act: () => { Player.playAction('pickup', 1.4); Items.collect(it); } };
        }
        const e = it._entry;
        e.x = it.x; e.y = it.y; e.z = it.z;
        return e;
    },
};

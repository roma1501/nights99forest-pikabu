// Items.js — инвентарь (слоты хотбара, ёмкость по мешку), предметы в мире (падают, подпрыгивают,
// светятся, подбираются по E), модели предметов (assets/models/item_*.glb).

/** @type {Record<string, any>} */
const Inv = {
    slots: [],           // { id, n, mag } | null
    sel: 0,
    tier: 0,             // рюкзак: индекс в DATA.packs (покупается в магазине)
    onChange: [],
    reset() {
        this.tier = window.Econ ? Econ.packTier() : 0;
        this.slots = new Array(DATA.packs[this.tier].slots).fill(null);
        this.sel = 0; this.prevSel = 0;
        this.emit();
    },
    get cap() { return this.slots.length; },
    // Слоты быстрого доступа: первые hotbar, остальные — в рюкзаке (окно инвентаря)
    get hot() { return Math.min(DATA.player.hotbar, this.slots.length); },
    emit() { for (const f of this.onChange) f(); },
    def(id) { return DATA.items[id]; },
    // Положить в инвентарь; возвращает не поместившееся количество
    add(id, n, lv, mag) {
        const d = DATA.items[id];
        if (!d) return n;
        n = n || 1;
        // 1) допилить стопки
        for (const s of this.slots) if (s && s.id === id && s.n < d.stack && n > 0) { const k = Math.min(n, d.stack - s.n); s.n += k; n -= k; }
        // 2) пустые слоты
        for (let i = 0; i < this.slots.length && n > 0; i++) if (!this.slots[i]) {
            const k = Math.min(n, d.stack);
            this.slots[i] = { id, n: k, mag: d.mag || 0 };
            if (d.mag && Number.isFinite(mag)) this.slots[i].mag = Math.max(0, Math.min(d.mag, Math.floor(mag)));
            if (lv > 0 && d.stack === 1) this.slots[i].lv = lv;
            n -= k;
        }
        this.emit();
        return n;
    },
    canAdd(id, n) {
        const d = DATA.items[id]; if (!d) return 0;
        let room = 0;
        for (const s of this.slots) { if (!s) room += d.stack; else if (s.id === id) room += d.stack - s.n; }
        return Math.min(n || 1, room);
    },
    count(id) { let c = 0; for (const s of this.slots) if (s && s.id === id) c += s.n; return c; },
    has(id, n) { return this.count(id) >= (n || 1); },
    take(id, n) {
        n = n || 1;
        if (this.count(id) < n) return false;
        for (let i = this.slots.length - 1; i >= 0 && n > 0; i--) {
            const s = this.slots[i];
            if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) this.slots[i] = null; }
        }
        this.emit();
        return true;
    },
    // Убрать всё из слота (выбросить/использовать); возвращает запись
    removeSlot(i, n) {
        const s = this.slots[i];
        if (!s) return null;
        const k = Math.min(n == null ? s.n : n, s.n);
        s.n -= k;
        const out = { id: s.id, n: k, mag: s.mag, lv: s.lv | 0 };
        if (s.n <= 0) this.slots[i] = null;
        this.emit();
        return out;
    },
    current() { return this.slots[this.sel] || null; },
    select(i) { const h = this.hot; i = ((i % h) + h) % h; if (i !== this.sel) { this.prevSel = this.sel; this.sel = i; this.emit(); if (this.onSelect) this.onSelect(i); } },
    // Быстрая смена: к предыдущему выбранному слоту
    quickSwap() { if (this.prevSel != null && this.prevSel !== this.sel && this.prevSel < this.hot) this.select(this.prevSel); },
    // Грузоподъёмность мешка
    upgrade(t) {
        if (t <= this.tier) return;
        this.tier = t;
        const n = DATA.packs[t].slots;
        while (this.slots.length < n) this.slots.push(null);
        this.emit();
    },
    // Поменять два слота местами; одинаковые стопки сливаются
    swap(i, j) {
        if (i === j || i < 0 || j < 0 || i >= this.slots.length || j >= this.slots.length) return;
        const a = this.slots[i], b = this.slots[j];
        if (a && b && a.id === b.id && DATA.items[a.id].stack > 1) {
            const k = Math.min(DATA.items[a.id].stack - b.n, a.n);
            if (k > 0) { b.n += k; a.n -= k; if (a.n <= 0) this.slots[i] = null; }
            else { this.slots[i] = b; this.slots[j] = a; }
        } else { this.slots[i] = b; this.slots[j] = a; }
        this.emit();
        if ((i === this.sel || j === this.sel) && window.Player && Player.rig) Player.equipCurrent();
    },
    // Собрать рюкзак: слить стопки и отсортировать слоты после быстрого доступа
    sortBag() {
        const h = this.hot, rest = this.slots.slice(h).filter(Boolean);
        const order = { tool: 0, weapon: 1, heal: 2, food: 3, build: 4, ammo: 5, res: 6, key: 7, misc: 8 };
        const merged = [];
        for (const s of rest) {
            const d = DATA.items[s.id];
            let left = s.n;
            for (const m of merged) if (m.id === s.id && m.n < d.stack && left > 0) { const k = Math.min(left, d.stack - m.n); m.n += k; left -= k; }
            if (left > 0) merged.push(s.lv ? { id: s.id, n: left, mag: s.mag, lv: s.lv } : { id: s.id, n: left, mag: s.mag });
        }
        merged.sort((p, q) => ((order[DATA.items[p.id].type] ?? 9) - (order[DATA.items[q.id].type] ?? 9)) || (p.id < q.id ? -1 : 1));
        for (let i = h; i < this.slots.length; i++) this.slots[i] = merged[i - h] || null;
        this.emit();
    },
    scrapCarried() { let s = 0; for (const sl of this.slots) if (sl) s += DATA.scrapValue(sl.id) * sl.n; return s; },
    save() { return { tier: this.tier, sel: this.sel, slots: this.slots.map(s => s ? (s.lv ? { id: s.id, n: s.n, mag: s.mag, lv: s.lv } : { id: s.id, n: s.n, mag: s.mag }) : null) }; },
    // Улучшение оружия и инструментов: уровень 0..3 (lv в слоте), цена — у верстака (DATA.upgrade)
    upgradable(id) { const d = DATA.items[id]; return !!(d && d.stack === 1 && (d.type === 'weapon' || d.type === 'tool') && (d.dmg || d.tree) && !d.throw); },
    lvOf(i) { const s = this.slots[i]; return s ? (s.lv | 0) : 0; },
    prevSel: 0,
    load(d) {
        this.tier = Math.min(DATA.packs.length - 1, Math.max(d.tier || 0, window.Econ ? Econ.packTier() : 0));
        this.slots = new Array(DATA.packs[this.tier].slots).fill(null);
        (d.slots || []).forEach((s, i) => { if (i < this.slots.length) this.slots[i] = s; });
        this.sel = Math.min(d.sel || 0, this.slots.length - 1);
        this.emit();
    },
};

/** @type {Record<string, any>} */
const Items = {
    scene: null, view: null,
    models: {},          // model name -> data
    list: [],            // предметы на земле
    fallbackMat: null,
    loading: null,
    mergeT: 0,
    renderTemplates: new Map(), // CPU geometry/material cache; no dormant meshes in the scene
    renderPools: new Map(),     // id + spatial cell -> dense thin-instance slots

    // Предзагрузка моделей всех предметов
    async init(view) {
        if (this.scene && this.scene !== view.scene) { this.clear(); this.renderTemplates.clear(); }
        this.view = view; this.scene = view.scene;
        const names = new Set();
        for (const id in DATA.items) names.add(DATA.items[id].model);
        await Promise.all(Array.from(names).map(async (n) => {
            try { this.models[n] = await Rig.load('assets/models/' + ('item_' + n) + '.glb'); }
            catch (e) { this.models[n] = null; }
        }));
        const m = this.fallbackMat = new BABYLON.StandardMaterial('itemFallback', this.scene);
        m.diffuseColor = new BABYLON.Color3(0.8, 0.6, 0.3);
        m.maxSimultaneousLights = 8;
    },

    // Экземпляр модели предмета (TransformNode-корень с мешами). Нет файла — небольшой куб.
    make(id, opts) {
        const d = DATA.items[id];
        const o = opts || {};
        const scene = this.scene;
        const data = d && this.models[d.model];
        let root, meshes = [];
        if (data) {
            const rig = Rig.instance(data, scene, { name: 'item_' + id, materials: d.color ? { keycolor: d.color } : null });
            root = rig.root; meshes = rig.meshes;
            root._rig = rig;
        } else {
            root = new BABYLON.TransformNode('item_' + id, scene);
            const b = BABYLON.MeshBuilder.CreateBox('b', { size: 26 }, scene);
            b.material = this.fallbackMat; b.parent = root; meshes.push(b);
        }
        for (const m of meshes) { m.isPickable = false; m.receiveShadows = false; }
        root._meshes = meshes;
        return root;
    },

    // Only static models are baked. Held items, animated models and missing assets keep make().
    renderTemplate(id) {
        const d = DATA.items[id], data = d && this.models[d.model];
        if (!this.scene || !data?.nodes || !data.prims?.length || data.anims?.size || data.model.materials.some(m => m.alphaMode === 'blend')) return null;
        const key = id + '|' + (d.color || '') + '|' + (d.worldScale || 1);
        if (this.renderTemplates.has(key)) return this.renderTemplates.get(key);
        const geom = Rig.bakeGeom(data), scale = d.worldScale || 1;
        // Measure the original primitive spheres, not the enlarged cell bounds. This keeps
        // exactly the same quality cutoff as an ordinary item, including node transforms.
        const probe = Rig.instance(data, this.scene, { name: 'item_measure_' + id });
        probe.root.scaling.setAll(scale);
        const radii = probe.meshes.map(m => { m.computeWorldMatrix(true); return m.getBoundingInfo().boundingSphere.radiusWorld; });
        probe.dispose();
        let extent = 0;
        const parts = geom.map((g, i) => {
            for (let j = 0; j < g.pos.length; j += 3) extent = Math.max(extent, Math.hypot(g.pos[j], g.pos[j + 1], g.pos[j + 2]) * scale);
            const color = data.model.materials[g.mat].name === 'keycolor' ? d.color : null;
            const material = Rig.material(data, g.mat, this.scene, color, color ? 'ground:' + key : '');
            return { geom: g, material, radius: radii[i] };
        });
        const template = { key, id, parts, extent, scale };
        this.renderTemplates.set(key, template);
        return template;
    },

    _poolFor(template, position, scaling) {
        const size = Math.max(100, typeof ITEM_RENDER_CHUNK === 'number' ? ITEM_RENDER_CHUNK : 1600);
        const ix = Math.floor(position.x / size), iy = Math.floor(position.y / size), iz = Math.floor(position.z / size);
        const factor = Math.max(Math.abs(scaling.x), Math.abs(scaling.y), Math.abs(scaling.z)) / template.scale;
        const key = template.key + '|' + scaling.x + ',' + scaling.y + ',' + scaling.z + '|' + size + '|' + ix + ',' + iy + ',' + iz;
        let pool = this.renderPools.get(key);
        if (pool) return pool;
        const capacity = Math.max(1, typeof ITEM_RENDER_CAPACITY === 'number' ? ITEM_RENDER_CAPACITY : 16);
        pool = { key, template, factor, size, ix, iy, iz, capacity, items: [], meshes: [], buffer: new Float32Array(capacity * 16), dirty: false };
        for (let i = 0; i < template.parts.length; i++) {
            const part = template.parts[i], g = part.geom;
            const mesh = new BABYLON.Mesh('ground_' + key + '_' + i, this.scene), vd = new BABYLON.VertexData();
            vd.positions = g.pos; vd.normals = g.nrm; vd.uvs = g.uv; vd.colors = g.col; vd.indices = g.idx;
            // Every pool owns its Geometry and GPU matrix buffers. Sharing clone Geometry
            // corrupts thin-instance attributes when two cells have different capacities.
            vd.applyToMesh(mesh, false);
            mesh.material = part.material; mesh.isPickable = false; mesh.receiveShadows = false;
            mesh.metadata = { groundItem: template.id, itemPart: i, itemShadowRadius: part.radius * factor };
            mesh.thinInstanceSetBuffer('matrix', pool.buffer, 16, false);
            mesh.thinInstanceCount = 0;
            const e = template.extent * factor;
            const bounds = new BABYLON.BoundingInfo(new BABYLON.Vector3(ix * size - e, iy * size - e, iz * size - e),
                new BABYLON.Vector3((ix + 1) * size + e, (iy + 1) * size + e, (iz + 1) * size + e));
            bounds.isLocked = true; mesh.setBoundingInfo(bounds); mesh.doNotSyncBoundingInfo = true;
            mesh.freezeWorldMatrix();
            pool.meshes.push(mesh);
        }
        this.renderPools.set(key, pool);
        this._poolShadows(pool);
        return pool;
    },

    _poolShadows(pool) {
        if (!this.view) return;
        const min = this.view.shadowMinRadius || 0;
        pool.meshes.forEach((m, i) => {
            if (min <= 0 || pool.template.parts[i].radius * pool.factor >= min) this.view.addShadowCaster(m, false);
            else this.view.removeShadowCaster(m);
        });
    },

    _releaseVisual(it) {
        const pool = it._pool;
        if (!pool) return;
        const slot = it._slot, last = pool.items.pop();
        if (last !== it) {
            pool.items[slot] = last; last._slot = slot;
            pool.buffer.copyWithin(slot * 16, pool.items.length * 16, (pool.items.length + 1) * 16);
        }
        it._pool = null; it._slot = -1;
        if (!pool.items.length) {
            for (const m of pool.meshes) { if (this.view) this.view.removeShadowCaster(m); m.dispose(false, false); }
            this.renderPools.delete(pool.key);
        } else {
            for (const m of pool.meshes) m.thinInstanceCount = pool.items.length;
            pool.dirty = true;
        }
    },

    _syncVisual(it) {
        if (!it._template) return;
        const pool = this._poolFor(it._template, it.root.position, it.root.scaling);
        if (it._pool !== pool) {
            this._releaseVisual(it);
            if (pool.items.length === pool.capacity) {
                pool.capacity *= 2;
                const buffer = new Float32Array(pool.capacity * 16); buffer.set(pool.buffer); pool.buffer = buffer;
                for (const m of pool.meshes) m.thinInstanceSetBuffer('matrix', buffer, 16, false);
            }
            it._pool = pool; it._slot = pool.items.length; pool.items.push(it);
            for (const m of pool.meshes) m.thinInstanceCount = pool.items.length;
        }
        it.root.computeWorldMatrix(true).copyToArray(pool.buffer, it._slot * 16);
        pool.dirty = true;
    },

    flushVisuals() {
        for (const pool of this.renderPools.values()) if (pool.dirty) {
            for (const m of pool.meshes) m.thinInstanceBufferUpdated('matrix');
            pool.dirty = false;
        }
    },
    syncVisuals() { for (const it of this.list) this._syncVisual(it); this.flushVisuals(); },
    // Shared pool meshes must not be duplicated on every item root (ownership and QA).
    visualMeshes(id) {
        const meshes = [];
        for (const pool of this.renderPools.values()) if (!id || pool.template.id === id) meshes.push(...pool.meshes);
        for (const it of this.list) if (!id || it.id === id) meshes.push(...it.root._meshes);
        return meshes;
    },

    // Предмет в мир: x,z; opts: { y, vx, vy, vz, pop, delay, lv, mag, noMagnet }
    spawn(id, n, x, z, o) {
        const opts = o || {};
        const template = this.renderTemplate(id);
        const root = template ? new BABYLON.TransformNode('item_' + id, this.scene) : this.make(id);
        if (template) root._meshes = [];
        root.rotationQuaternion = null; // Ground bob/spin uses Euler yaw; held make() keeps its rig quaternion.
        const y0 = opts.y != null ? opts.y : World.heightAt(x, z) + 40;
        const it = { id, n: n || 1, root, x, y: y0, z, vx: opts.vx || 0, vy: opts.vy || 0, vz: opts.vz || 0, t: 0, ground: false, spin: Math.random() * 6, life: 0, magnet: 0, noPickup: opts.delay == null ? 0.4 : Math.max(0, opts.delay), id2: Math.random(), noMagnet: !!opts.noMagnet };
        root.position.set(x, y0, z);
        if (opts.lv) it.lv = opts.lv;
        if (DATA.items[id] && DATA.items[id].mag && Number.isFinite(opts.mag)) it.mag = Math.max(0, Math.min(DATA.items[id].mag, Math.floor(opts.mag)));
        const scale = (DATA.items[id] && DATA.items[id].worldScale) || 1;
        root.scaling.setAll(scale);
        if (template) { it._template = template; this._syncVisual(it); this.flushVisuals(); }
        this.list.push(it);
        this.applyShadowQuality(it);
        if (opts.pop !== false && !opts.vx && !opts.vz && !opts.vy) { it.vy = 380 + Math.random() * 160; const a = Math.random() * 6.28, s = 90 + Math.random() * 120; it.vx = Math.cos(a) * s; it.vz = Math.sin(a) * s; }
        return it;
    },

    // Ground items use the same detail threshold as rigs, including fallback meshes.
    applyShadowQuality(it) {
        if (!this.view) return;
        if (it._pool) return this._poolShadows(it._pool);
        for (const m of it.root._meshes) {
            if (Rig.castsShadow(m, this.view)) this.view.addShadowCaster(m, false);
            else this.view.removeShadowCaster(m);
        }
    },
    refreshShadows() {
        for (const pool of this.renderPools.values()) this._poolShadows(pool);
        for (const it of this.list) if (!it._pool) this.applyShadowQuality(it);
    },

    remove(it) {
        const i = this.list.indexOf(it);
        if (i < 0) return false;
        this.list.splice(i, 1);
        this._releaseVisual(it); this.flushVisuals();
        if (this.view) for (const m of it.root._meshes) this.view.removeShadowCaster(m);
        if (it.root._rig) it.root._rig.dispose(); else { for (const m of it.root._meshes) m.dispose(); it.root.dispose(); }
        return true;
    },

    // Один локальный проход по spatial grid. Не сливаем летящие/притягиваемые,
    // задержанные предметы, оружие, разные свойства и стопки через стену.
    mergeNearby() {
        const r = typeof ITEM_MERGE_RADIUS === 'number' ? ITEM_MERGE_RADIUS : 150;
        if (r <= 0 || this.list.length < 2) return 0;
        const maxY = typeof ITEM_MERGE_HEIGHT === 'number' ? ITEM_MERGE_HEIGHT : 50;
        const cells = new Map(), retired = [];
        const compatible = (a, b) => a.id === b.id && (a.lv | 0) === (b.lv | 0) && a.mag === b.mag && !!a.noMagnet === !!b.noMagnet && !!a._fromBot === !!b._fromBot;
        const clear = (a, b) => {
            const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
            if (d2 > r * r || Math.abs(a.y - b.y) > maxY) return false;
            let blocked = false;
            if (World.colliders && d2 > 0) World.colliders.query((a.x + b.x) / 2, (a.z + b.z) / 2, Math.sqrt(d2) / 2, c => {
                const t = U.clamp(((c.x - a.x) * dx + (c.z - a.z) * dz) / d2, 0, 1);
                if (U.dist2(c.x, c.z, a.x + dx * t, a.z + dz * t) < c.r * c.r) blocked = true;
            });
            return !blocked;
        };
        for (const it of this.list) {
            const cap = DATA.items[it.id]?.stack || 1;
            if (cap <= 1 || it.n >= cap || !it.ground || it.noPickup > 0 || it.magnet > 0 || it.vx || it.vy || it.vz || (window.Bots && it._lk > Bots.t)) continue;
            const ix = Math.floor(it.x / r), iz = Math.floor(it.z / r);
            for (let x = ix - 1; x <= ix + 1 && it.n > 0; x++) for (let z = iz - 1; z <= iz + 1 && it.n > 0; z++) {
                const nearby = cells.get(x + ',' + z);
                if (!nearby) continue;
                for (const target of nearby) {
                    if (target.n >= cap || !compatible(target, it) || !clear(target, it)) continue;
                    const n = Math.min(it.n, cap - target.n);
                    target.n += n; it.n -= n;
                    if (it.n <= 0) { retired.push(it); break; }
                }
            }
            if (it.n > 0) { const key = ix + ',' + iz; let cell = cells.get(key); if (!cell) { cell = []; cells.set(key, cell); } cell.push(it); }
        }
        for (const it of retired) this.remove(it);
        return retired.length;
    },

    update(dt, px, pz) {
        this.mergeT -= dt;
        if (this.mergeT <= 0) { this.mergeT = typeof ITEM_MERGE_INTERVAL === 'number' ? ITEM_MERGE_INTERVAL : 1; this.mergeNearby(); }
        for (const it of this.list) {
            it.t += dt; it.life += dt;
            if (it.noPickup > 0) it.noPickup -= dt;
            const gy = World.heightAt(it.x, it.z);
            if (!it.ground) {
                it.vy -= 1900 * dt;
                it.x += it.vx * dt; it.z += it.vz * dt; it.y += it.vy * dt;
                if (it.y <= gy + 14) {
                    it.y = gy + 14;
                    if (it.vy < -240) { it.vy = -it.vy * 0.38; it.vx *= 0.6; it.vz *= 0.6; if (window.Sfx) Sfx.at('drop', it.x, it.y, it.z, 0.5); }
                    else { it.vy = 0; it.vx = 0; it.vz = 0; it.ground = true; }
                }
            }
            // лёгкое парение на земле, вращение
            const bob = it.ground ? Math.sin(it.t * 2.4 + it.id2 * 9) * 5 + 12 : 0;
            it.root.position.set(it.x, it.ground ? gy + 14 + bob : it.y, it.z);
            it.spin += dt * (it.ground ? 1.1 : 6);
            it.root.rotation.y = it.spin;
            this._syncVisual(it);
            // притяжение к игроку (магнит) — если есть место и рядом
            const d2 = U.dist2(it.x, it.z, px, pz);
            const wallet = it.id === 'coin', mr = (wallet ? 2.8 : 1.25) * M;
            if (it.ground && it.noPickup <= 0 && d2 < mr * mr && (wallet || Inv.canAdd(it.id, it.n) > 0) && !it.noMagnet) it.magnet = Math.min(1, it.magnet + dt * (wallet ? 4.5 : 3));
            else it.magnet = Math.max(0, it.magnet - dt * 2);
            if (wallet) it.spin += dt * 4;
            if (it.magnet > 0 && it.ground) {
                const d = Math.sqrt(d2) || 1, sp = (wallet ? 780 : 520) * it.magnet;
                it.x += (px - it.x) / d * sp * dt; it.z += (pz - it.z) / d * sp * dt;
                if (d < 55) { if (this.collect(it)) return this.update(0, px, pz); }
            }
        }
        this.flushVisuals();
    },

    // Подобрать предмет в инвентарь (возвращает true, если хоть что-то взято)
    collect(it) {
        // Interact/Bots могут ещё держать ссылку на слитую/уже взятую стопку.
        if (!it || this.list.indexOf(it) < 0 || it.n <= 0) return false;
        if (it.id === 'coin') {
            Econ.addCoins(it.n, 'pickup');
            if (window.FX) FX.pickup(it.x, it.y, it.z);
            if (window.Sfx) Sfx.ui('coin');
            this.remove(it);
            return true;
        }
        const before = it.n;
        const left = Inv.add(it.id, it.n, it.lv | 0, it.mag);
        const taken = before - left;
        if (taken <= 0) { if (window.UI) UI.toast(Lang.t('bagFull'), 'warn'); return false; }
        if (window.UI) UI.pickupFeed(it.id, taken);
        if (window.FX) FX.pickup(it.x, it.y, it.z);
        if (window.Sfx) Sfx.ui('pickup');
        if (left > 0) it.n = left; else this.remove(it);
        return true;
    },

    nearest(px, pz, fx, fz, reach) {
        let best = null, bs = 1e9;
        for (const it of this.list) {
            if (!it.ground || it.noPickup > 0) continue;
            const dx = it.x - px, dz = it.z - pz, d = Math.hypot(dx, dz);
            if (d > reach) continue;
            const dot = (dx * fx + dz * fz) / (d || 1);
            const s = d - dot * 60;
            if (s < bs) { bs = s; best = it; }
        }
        return best;
    },

    clear() { for (const it of this.list.slice()) this.remove(it); this.mergeT = 0; },
    save() { return this.list.map(it => { const out = { id: it.id, n: it.n, x: Math.round(it.x), z: Math.round(it.z) }; if (it.lv) out.lv = it.lv; if (Number.isFinite(it.mag)) out.mag = it.mag; if (it.noPickup > 0) out.noPickup = it.noPickup; if (it.noMagnet) out.noMagnet = true; if (it._fromBot) out.fromBot = true; return out; }); },
    load(list) { this.clear(); for (const s of list || []) { if (!DATA.items[s.id]) continue; const it = this.spawn(s.id, s.n, s.x, s.z, { pop: false, lv: s.lv | 0, mag: s.mag, delay: s.noPickup || 0, noMagnet: s.noMagnet }); it.ground = true; it.y = World.heightAt(it.x, it.z) + 14; it.root.position.set(it.x, it.y, it.z); it._fromBot = !!s.fromBot; this._syncVisual(it); } this.flushVisuals(); },
};

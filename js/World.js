// World.js — лес: генерация деревьев/камней/кустов/травы по сиду, чанки (деревья и камни склеены в ОДИН меш на чанк —
// 3 вызова отрисовки; трава/цветы/грибы — thin instances), подрезка вида и теней, столкновения, рубка деревьев,
// выравнивание земли под лагерь и места интереса, лагерная поляна, стена тумана по уровню костра.
// Карта — Maps.js (маркеры: spawn — центр лагеря и т.д.); объекты-модели карты ставит движок.

/** @type {Record<string, any>} */
const World = {
    app: null, loc: null, view: null, scene: null, terrain: null,
    W: 30000, H: 30000, cx: 15000, cz: 15000,
    CH: 3000,                       // размер чанка, px
    chunks: [], cols: 0, rows: 0,
    colliders: new Colliders(500),
    trees: [], resources: [], rocks: [],
    felled: new Set(), pickedRes: new Map(),   // срубленные деревья ('x_z') и собранные ягоды/грибы ('x_z' -> день) — в сохранение
    variants: {},                   // имя -> { data, src (baked Mesh), geom }
    mats: {},                       // общие материалы склеенных чанков
    fogRadius: 5800,
    _visT: 0,
    quality: 1, viewScale: 1, shadowScale: 1,
    // на каком радиусе что рисуется, px
    viewR: { tree: 9500, deco: 7000, grass: 3800, flower: 3400, mush: 3000 },
    MERGED: new Set(['tree_a', 'tree_b', 'tree_c', 'tree_pine_a', 'tree_pine_b', 'tree_birch', 'tree_birch_b', 'tree_birch_c', 'tree_dead', 'tree_dead_b', 'tree_dead_c', 'rock_a', 'rock_b', 'rock_c', 'boulder', 'bush_a', 'bush_a_b', 'bush_a_c', 'fallen_log', 'fallen_log_b', 'fallen_log_c']),

    // -------------------------------------------------------------------------------- инициализация
    async init(app) {
        this.app = app;
        const loc = this.loc = app.location;
        this.view = loc.view; this.scene = loc.view.scene; this.terrain = loc.terrain;
        this.W = loc.width; this.H = loc.height;
        const sp = loc.marker('spawn');
        this.cx = sp ? sp.x : this.W / 2; this.cz = sp ? sp.y : this.H / 2;
        // густота мира — общая; сколько оставить деревьев и декора, решает качество графики (keepFor)
        this.quality = 1;
        this.keep = this.keepFor(Number(Store.get(GAME_ID + '.quality')) || (IS_MOBILE ? 2 : 3));
        this.colliders = new Colliders(500);
        this.trees = []; this.resources = []; this.rocks = [];
        const names = ['tree_a', 'tree_b', 'tree_c', 'tree_pine_a', 'tree_pine_b', 'tree_birch', 'tree_birch_b', 'tree_birch_c', 'tree_dead', 'tree_dead_b', 'tree_dead_c', 'stump', 'stump_b', 'stump_c', 'fallen_log', 'fallen_log_b', 'fallen_log_c',
            'bush_a', 'bush_a_b', 'bush_a_c', 'bush_berry', 'bush_berry_b', 'bush_berry_c', 'rock_a', 'rock_b', 'rock_c', 'boulder', 'grass', 'grass_b', 'grass_c', 'flowers_y', 'flowers_w', 'flowers_p', 'mushroom', 'mushroom_b', 'mushroom_c'];
        await Promise.all(names.map(async (n) => {
            try {
                const data = await Rig.load('assets/models/' + n + '.glb');
                const v = { data };
                if (this.MERGED.has(n)) v.geom = Rig.bakeGeom(data);
                v.src = Rig.bakeMesh(data, this.scene, { name: 'v_' + n });
                v.src.setEnabled(false); v.src.isPickable = false;
                this._materialSetup(v.src);
                this.variants[n] = v;
            } catch (e) { console.warn('World: нет модели', n, e && e.message); }
        }));
        const T0 = performance.now(), tk = (n) => { (window.__tl = window.__tl || []).push('world ' + n + ' ' + Math.round(performance.now() - T0)); };
        tk('models');
        this._sharedMaterials();
        this._flattenSpots(); tk('flatten');
        this._tintTerrain(); tk('tint');
        this._campPatch(); tk('patch');
        this._initChunks();
        this.openTo(DATA.fire[1].fog * M + 300, true);   // строго внутри стартового тумана; остальное — по мере открытия зон
        tk('generate');
        this._fogWall();
        this.update(0, this.cx, this.cz, true);
    },

    _materialSetup(mesh) {
        const mats = mesh.material ? (mesh.material.subMaterials || [mesh.material]) : [];
        for (const m of mats) {
            if (!m) continue;
            m.maxSimultaneousLights = 8;
            m.metadata = Object.assign({ toonGroup: 'prop' }, m.metadata);
            m.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);
            if (/grass|blade|stem/i.test(m.name)) { m.backFaceCulling = false; m.twoSidedLighting = true; }
        }
    },

    // Общие материалы склеенных чанков: листва и кора (текстуры первого дерева), «плоский» (цвета вершин)
    _sharedMaterials() {
        const scene = this.scene, ta = this.variants.tree_a;
        const mk = (name, desc, model) => {
            const m = new BABYLON.StandardMaterial(name, scene);
            if (desc && desc.texture) m.diffuseTexture = Model3D._texture(model, desc.texture, scene);
            m.diffuseColor = new BABYLON.Color3(1, 1, 1);
            m.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);
            m.maxSimultaneousLights = 8;
            m.metadata = { toonGroup: 'prop' };
            return m;
        };
        let leafDesc = null, barkDesc = null;
        if (ta) for (const d of ta.data.model.materials) { if (d.texture && /leaf|leaves/i.test(d.name)) leafDesc = d; else if (d.texture && /bark/i.test(d.name)) barkDesc = d; }
        this.mats.leaf = mk('mergedLeaf', leafDesc, ta && ta.data.model);
        this.mats.bark = mk('mergedBark', barkDesc, ta && ta.data.model);
        this.mats.flat = mk('mergedFlat', null);
        this.cats = ['leaf', 'bark', 'flat'];
    },
    _cat(desc) { if (!desc.texture) return 'flat'; return /bark/i.test(desc.name) ? 'bark' : 'leaf'; },

    heightAt(x, z) { return this.terrain.heightAt(x, z); },

    // Поза на земле: высота, наклон вдоль осей (для камней, машин, палаток)
    groundPose(x, z, yaw, r) {
        const t = this.terrain, s = Math.sin(yaw), c = Math.cos(yaw);
        const hf = t.heightAt(x + s * r, z + c * r), hb = t.heightAt(x - s * r, z - c * r);
        const hl = t.heightAt(x + c * r, z - s * r), hr = t.heightAt(x - c * r, z + s * r);
        const h0 = t.heightAt(x, z);
        const lo = Math.min(hf, hb, hl, hr, h0);
        return { y: Math.min(h0, (hf + hb + hl + hr) / 4) - Math.max(0, (Math.max(hf, hb, hl, hr) - lo)) * 0.18, pitch: Math.atan2(hb - hf, r * 2) * 0.9, roll: Math.atan2(hr - hl, r * 2) * 0.9, lo };
    },
    // Применить позу земли к TransformNode: курс yaw + наклон
    seat(node, x, z, yaw, r, lift) {
        const g = this.groundPose(x, z, yaw, r || 100);
        node.position.set(x, g.y + (lift || 0), z);
        node.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(yaw, g.pitch, g.roll);
        return g;
    },

    // -------------------------------------------------------------------------------- посадка на землю и места под реквизит
    _fpCache: {},
    fps: [],
    // Габариты модели в её системе координат (корень в нуле) и радиус круга-«следа» на земле
    fpOf(name, data) {
        let f = this._fpCache[name];
        if (f) return f;
        f = { minX: -40, maxX: 40, minZ: -40, maxZ: 40, minY: 0, maxY: 100, r: 50 };
        if (data) {
            try {
                const rig = Rig.instance(data, this.scene, { name: 'fp' });
                rig.root.position.set(0, 0, 0); rig.root.rotationQuaternion = BABYLON.Quaternion.Identity(); rig.root.scaling.setAll(1);
                rig.root.computeWorldMatrix(true);
                let a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9], any = false;
                for (const m of rig.meshes) {
                    if (!m.getTotalVertices()) continue;
                    m.computeWorldMatrix(true);
                    const bb = m.getBoundingInfo().boundingBox, lo = bb.minimumWorld, hi = bb.maximumWorld;
                    a = [Math.min(a[0], lo.x), Math.min(a[1], lo.y), Math.min(a[2], lo.z)];
                    b = [Math.max(b[0], hi.x), Math.max(b[1], hi.y), Math.max(b[2], hi.z)];
                    any = true;
                }
                rig.dispose();
                if (any) f = { minX: a[0], maxX: b[0], minZ: a[2], maxZ: b[2], minY: a[1], maxY: b[1], r: 0 };
            } catch (e) { /* габариты по умолчанию */ }
        }
        // круг вокруг начала модели, целиком накрывающий её габарит (у моделей со смещённым центром — дальний угол)
        f.r = Math.max(20, Math.hypot(Math.max(Math.abs(f.minX), Math.abs(f.maxX)), Math.max(Math.abs(f.minZ), Math.abs(f.maxZ))));
        this._fpCache[name] = f;
        return f;
    },
    // Посадка модели по её реальной площади: плоскость по сетке 3×3 точек под основанием. Наклон повторяет склон,
    // основание не уходит в землю глубже embed и не висит над ней (пока склон ровный под моделью)
    seatFit(node, name, data, x, z, yaw, o) {
        const opt = o || {}, sc = opt.scale || 1, f = this.fpOf(name, data), t = this.terrain;
        const hx = Math.max(12, (f.maxX - f.minX) / 2 * sc * 0.9), hz = Math.max(12, (f.maxZ - f.minZ) / 2 * sc * 0.9);
        const cxl = (f.minX + f.maxX) / 2 * sc, czl = (f.minZ + f.maxZ) / 2 * sc;
        const s = Math.sin(yaw), c = Math.cos(yaw);
        const pts = []; let sum = 0, sx = 0, sz = 0;
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
            const lx = cxl + i * hx, lz = czl + j * hz, h = t.heightAt(x + lx * c + lz * s, z - lx * s + lz * c);
            pts.push([lx, lz, h]); sum += h; sx += h * i; sz += h * j;
        }
        const mean = sum / 9, bx = sx / (6 * hx), bz = sz / (6 * hz), a0 = mean - bx * cxl - bz * czl;
        let hi = -1e9, lo = 1e9;
        for (const p of pts) { const r = p[2] - (a0 + bx * p[0] + bz * p[1]); if (r > hi) hi = r; if (r < lo) lo = r; }
        const cl = (v) => Math.max(-0.26, Math.min(0.26, v));
        const embed = opt.embed != null ? opt.embed : 2;
        const y = a0 + hi - embed + (opt.lift || 0), pitch = cl(-Math.atan(bz)), roll = cl(-Math.atan(bx));
        node.position.set(x, y, z);
        node.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(yaw, pitch, roll);
        return { y, pitch, roll, spread: hi - lo };
    },
    // Следы реквизита: круги на земле. Мешают деревьям (через _clears) и новым предметам
    fpAdd(x, z, r, tag, big) {
        const f = { x, z, r, tag: tag || 'zone', big: !!big };
        this.fps.push(f);
        if (this._clears) this._clears.push({ x, z, r: r * 0.9, fp: f });
        return f;
    },
    fpRemove(f) {
        if (!f) return;
        const i = this.fps.indexOf(f); if (i >= 0) this.fps.splice(i, 1);
        if (this._clears) this._clears = this._clears.filter(c => c.fp !== f);
    },
    fpClear(tag) {
        this.fps = this.fps.filter(f => f.tag !== tag);
        if (this._clears) this._clears = this._clears.filter(c => !(c.fp && c.fp.tag === tag));
    },
    // Свободно ли место под круг r: нет других следов, деревьев, камней, построек; не вода; склон не круче допустимого
    fpFree(x, z, r, o) {
        const opt = o || {}, tol = opt.tol != null ? opt.tol : 6;
        if (x < 300 || z < 300 || x > this.W - 300 || z > this.H - 300) return false;
        for (const f of this.fps) { if (f.big && opt.inside) continue; const rr = r + f.r - tol; if (U.dist2(x, z, f.x, f.z) < rr * rr) return false; }
        let hit = false;
        this.colliders.query(x, z, r, (c) => { if (!hit && !(c.owner && c.owner.water) && U.dist2(x, z, c.x, c.z) < (r + c.r * 0.9 - tol) * (r + c.r * 0.9 - tol)) hit = true; });
        if (hit) return false;
        if (!opt.water && window.Zones && Zones.pondAt && Zones.pondAt(x, z)) return false;
        if (!opt.steep) {
            const t = this.terrain, h0 = t.heightAt(x, z);
            let hi = h0, lo = h0;
            for (let k = 0; k < 4; k++) { const a = k * 1.5708 + 0.7, h = t.heightAt(x + Math.cos(a) * r * 0.85, z + Math.sin(a) * r * 0.85); if (h > hi) hi = h; if (h < lo) lo = h; }
            if (hi - lo > Math.max(30, r * 0.18)) return false;
        }
        return true;
    },
    // Ближайшее свободное место к (x, z): сначала сама точка, затем кольца наружу
    fpFind(x, z, r, o) {
        if (this.fpFree(x, z, r, o)) return { x, z, moved: 0 };
        const maxR = (o && o.maxR) || r * 7, ph = Math.abs(x * 13.7 + z * 7.1) % 6.283;
        for (let d = r * 0.6; d <= maxR; d += r * 0.5) {
            const n = Math.max(8, Math.round(6.283 * d / (r * 0.9)));
            for (let k = 0; k < n; k++) {
                const a = ph + k / n * 6.283, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
                if (this.fpFree(px, pz, r, o)) return { x: px, z: pz, moved: d };
            }
        }
        return null;
    },

    // -------------------------------------------------------------------------------- земля
    // Ровные площадки под лагерь, клетки, логова, избушки: сетка высот сглаживается к высоте центра
    _flattenSpots() {
        const t = this.terrain;
        const spot = (x, z, r, blend, h0) => {
            const cs = t.cell, R = r + blend;
            if (h0 == null) { let s = 0, n = 0; for (let a = 0; a < 8; a++) { s += t.heightAt(x + Math.cos(a * 0.785) * r * 0.6, z + Math.sin(a * 0.785) * r * 0.6); n++; } h0 = (s + t.heightAt(x, z) * 2) / (n + 2); }
            const i0 = Math.max(0, Math.floor((x - R) / cs)), i1 = Math.min(t.nx - 1, Math.ceil((x + R) / cs));
            const j0 = Math.max(0, Math.floor((z - R) / cs)), j1 = Math.min(t.ny - 1, Math.ceil((z + R) / cs));
            for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
                const d = Math.hypot(i * cs - x, j * cs - z);
                if (d >= R) continue;
                const k = d <= r ? 1 : 1 - U.smooth((d - r) / blend);
                const idx = j * t.nx + i;
                t.hgrid[idx] = t.hgrid[idx] + (h0 - t.hgrid[idx]) * k;
            }
        };
        spot(this.cx, this.cz, 1900, 1400);
        // площадки под места интереса: [радиус ровной части, ширина склона], px
        const flat = { 'poi-cabin': [620, 520], 'kid-dino': [420, 420], 'kid-kraken': [420, 420], 'kid-squid': [420, 420], 'kid-koala': [420, 420],
            'den-wolf': [950, 650], 'den-alpha': [950, 650], 'cave-bear': [900, 600], 'poi-cultist': [1300, 800], 'poi-campsite': [520, 420],
            'poi-well': [330, 320], 'poi-sawmill': [760, 520], 'poi-ruins': [850, 600], 'poi-watchtower': [480, 400], 'poi-graveyard': [1250, 600],
            'poi-mine': [780, 560], 'poi-obelisk': [700, 520], 'poi-carrots': [380, 300] };
        for (const m of this.loc.markers()) { const f = flat[m.name]; if (f) spot(m.x, m.y, f[0], f[1]); }
        // пруд: ровная площадка и выкопанное дно; уровень воды ниже бровки
        for (const m of this.loc.markers('poi-pond')) {
            spot(m.x, m.y, 820, 560);
            const h0 = t.heightAt(m.x + 900, m.y), cs = t.cell, R = 700;
            const i0 = Math.max(0, Math.floor((m.x - R) / cs)), i1 = Math.min(t.nx - 1, Math.ceil((m.x + R) / cs));
            const j0 = Math.max(0, Math.floor((m.y - R) / cs)), j1 = Math.min(t.ny - 1, Math.ceil((m.y + R) / cs));
            for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
                const d = Math.hypot(i * cs - m.x, j * cs - m.y); if (d >= R) continue;
                t.hgrid[j * t.nx + i] -= 80 * (1 - U.smooth(d / R));
            }
            this.pondLevel = h0 - 26;
        }
        // пересобрать меш земли по новой сетке
        let lo = Infinity, hi = -Infinity;
        for (let k = 0; k < t.hgrid.length; k++) { const h = t.hgrid[k]; if (h < lo) lo = h; if (h > hi) hi = h; }
        t.hMin = lo; t.hMax = hi;
        const mesh = t.mesh;
        if (mesh) {
            const pos = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind).slice();
            for (let k = 0; k < t.nx * t.ny; k++) pos[k * 3 + 1] = t.hgrid[k];
            const idx = mesh.getIndices(), nrm = new Float32Array(pos.length);
            BABYLON.VertexData.ComputeNormals(pos, idx, nrm);
            mesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, pos, false);
            mesh.setVerticesData(BABYLON.VertexBuffer.NormalKind, nrm, false);
            mesh.refreshBoundingInfo();
        }
        this.loc.placeObjects();
    },

    _tintTerrain() {
        const t = this.terrain, mesh = t.mesh;
        if (!mesh) return;
        const n = t.nx * t.ny;
        const col = new Float32Array(n * 4);
        const noise = new SimplexNoise('tint99');
        const n2 = new SimplexNoise('tint98');
        for (let j = 0; j < t.ny; j++) for (let i = 0; i < t.nx; i++) {
            const x = i * t.cell, z = j * t.cell, k = (j * t.nx + i) * 4;
            const a = noise.noise2D(x / 2600, z / 2600), b = n2.noise2D(x / 900 + 5, z / 900 - 3);
            const v = 0.93 + a * 0.10 + b * 0.05;
            const warm = Math.max(0, a - 0.2) * 0.22;
            // оттенок зоны: кольца вокруг лагеря, границы мягкие (6 м)
            const dm = Math.hypot(x - this.cx, z - this.cz) / M, Z = DATA.zones;
            let zi = Z.length - 1; for (let q = 0; q < Z.length; q++) if (dm < Z[q].r1) { zi = q; break; }
            const tA = Z[zi].tint, tB = Z[Math.min(Z.length - 1, zi + 1)].tint, kb = U.smooth(U.clamp((dm - (Z[zi].r1 - 6)) / 12, 0, 1));
            const tr = tA[0] + (tB[0] - tA[0]) * kb, tg = tA[1] + (tB[1] - tA[1]) * kb, tb = tA[2] + (tB[2] - tA[2]) * kb;
            col[k] = v * (1 + warm) * tr; col[k + 1] = v * (1 + warm * 0.4) * tg; col[k + 2] = v * (1 - warm * 0.4) * tb; col[k + 3] = 1;
            if (zi >= 3) { col[k] = v; col[k + 1] = v; col[k + 2] = v; }
        }
        mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, col, false);
        mesh.useVertexColors = true;
        mesh.hasVertexAlpha = false;
        for (const m of [t.material, t.outerMaterial]) { m.maxSimultaneousLights = 8; }
        t.material.specularColor = new BABYLON.Color3(0, 0, 0);
        this._groundSurfaces();
    },

    // Rendered terrain and footstep sounds share this surface classification.
    surfaceAt(x, z) {
        if (Math.hypot(x - this.cx, z - this.cz) < 14 * M) return 'dirt';
        const zi = this.zoneIndexAt(x, z);
        return zi >= 4 ? 'snow' : zi === 3 ? 'stone' : zi === 2 ? 'dirt' : 'grass';
    },
    _groundSurfaces() {
        const t = this.terrain, mesh = t.mesh, base = t.material, scene = this.scene;
        const materials = [base];
        const make = (name, url, color) => {
            const mat = base.clone('ground-' + name);
            const tex = new BABYLON.Texture(url, scene);
            tex.uScale = base.diffuseTexture.uScale; tex.vScale = base.diffuseTexture.vScale;
            tex.wrapU = tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
            mat.diffuseTexture = tex; mat.diffuseColor = BABYLON.Color3.FromHexString(color);
            mat.metadata = { toonGroup: 'ground' }; materials.push(mat);
        };
        make('dirt', 'assets/ground_texture_d.webp', '#ffffff');
        make('stone', 'assets/ground_texture_s.webp', '#69717c');
        make('snow', 'assets/ground_texture_s.webp', '#f1f6ff');
        const pos = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind), idx = mesh.getIndices(), groups = [[], [], [], []];
        const keys = ['grass', 'dirt', 'stone', 'snow'];
        for (let i = 0; i < idx.length; i += 3) {
            const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
            const s = this.surfaceAt((pos[a] + pos[b] + pos[c]) / 3, (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3);
            groups[keys.indexOf(s)].push(idx[i], idx[i + 1], idx[i + 2]);
        }
        const multi = new BABYLON.MultiMaterial('terrain-surfaces', scene); multi.subMaterials = materials;
        mesh.material = multi; mesh.setIndices(groups.flat()); mesh.releaseSubMeshes();
        let start = 0;
        for (let i = 0; i < groups.length; i++) { if (groups[i].length) new BABYLON.SubMesh(i, 0, pos.length / 3, start, groups[i].length, mesh); start += groups[i].length; }
        this.groundMaterials = materials;
    },

    // Вытоптанная поляна лагеря: накладка на землю по ТОЙ ЖЕ сетке и диагонали, что и террейн (клетка TERRAIN_CELL), без подъёма над ним:
    // герой и предметы стоят ровно на поверхности, а глубинный сдвиг материала (zOffset) исключает мерцание. Круглую форму и мягкий край даёт альфа текстуры.
    _campPatch() {
        const scene = this.scene, R = 1500, t = this.terrain, cs = t.cell, nx = t.nx;
        const i0 = Math.max(0, Math.floor((this.cx - R) / cs)), i1 = Math.min(nx - 1, Math.ceil((this.cx + R) / cs));
        const j0 = Math.max(0, Math.floor((this.cz - R) / cs)), j1 = Math.min(t.ny - 1, Math.ceil((this.cz + R) / cs));
        const w = i1 - i0 + 1, h = j1 - j0 + 1;
        const pos = new Float32Array(w * h * 3), uv = new Float32Array(w * h * 2);
        let k = 0, q = 0;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const x = i * cs, z = j * cs;
            pos[k++] = x; pos[k++] = t.hgrid[j * nx + i] + 0.4; pos[k++] = z;
            uv[q++] = 0.5 + (x - this.cx) / (2 * R); uv[q++] = 0.5 + (z - this.cz) / (2 * R);
        }
        const idx = Terrain3D.gridIndices(w, h, !!t._swap);
        const nrm = new Float32Array(pos.length);
        BABYLON.VertexData.ComputeNormals(pos, idx, nrm);
        const mesh = new BABYLON.Mesh('campPatch', scene);
        const vd = new BABYLON.VertexData(); vd.positions = pos; vd.indices = idx; vd.normals = nrm; vd.uvs = uv; vd.applyToMesh(mesh);
        const mat = new BABYLON.StandardMaterial('campPatchMat', scene);
        mat.specularColor = new BABYLON.Color3(0, 0, 0);
        mat.maxSimultaneousLights = 8;
        mat.metadata = { toonGroup: 'ground' };
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
        const g = cv.getContext('2d');
        const img = new Image();
        const tex = new BABYLON.DynamicTexture('campPatchTex', cv, scene, true);
        const paint = () => {
            g.clearRect(0, 0, 512, 512);
            if (img.width) { const p = g.createPattern(img, 'repeat'); g.fillStyle = p; g.fillRect(0, 0, 512, 512); }
            else { g.fillStyle = '#6d4d30'; g.fillRect(0, 0, 512, 512); }
            g.globalCompositeOperation = 'destination-in';
            const gr = g.createRadialGradient(256, 256, 40, 256, 256, 256);
            gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.62, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.86, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
            g.globalCompositeOperation = 'source-over';
            tex.update(true);
        };
        img.onload = paint; img.src = 'assets/ground_texture_d.webp';
        paint();
        tex.hasAlpha = true;
        mat.diffuseTexture = tex; mat.useAlphaFromDiffuseTexture = true;
        mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        mat.zOffset = -4; mat.zOffsetUnits = -4;
        mesh.material = mat; mesh.isPickable = false; mesh.receiveShadows = true;
        mesh.freezeWorldMatrix();
        this.campMesh = mesh;
    },

    // -------------------------------------------------------------------------------- генерация леса
    // Мир строится ПО ЧАНКАМ и только внутри тумана: чанк детерминирован (сид от i, j), поэтому его можно
    // собрать в любой момент. Снаружи радиуса костра ни деревьев, ни камней, ни мелочи нет вообще;
    // апгрейд костра расширяет радиус (openTo) — новые чанки собираются порциями по кадрам.
    zoneIndexAt(x, z) {
        const d = Math.hypot(x - this.cx, z - this.cz) / M, Z = DATA.zones;
        for (let k = 0; k < Z.length; k++) if (d < Z[k].r1) return k;
        return Z.length - 1;
    },
    zoneAt(x, z) { return DATA.zones[this.zoneIndexAt(x, z)]; },

    _initChunks() {
        const W = this.W, H = this.H, CH = this.CH;
        this.cols = Math.ceil(W / CH); this.rows = Math.ceil(H / CH);
        this.chunks = [];
        for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
            this.chunks.push({ i, j, cx: (i + 0.5) * CH, cz: (j + 0.5) * CH, items: [], inst: {}, meshes: {}, main: null, on: false, shadow: false, count: 0, filled: false, queued: false });
        }
        // точки интереса: вокруг них деревья не растут
        const radii = { 'poi-cultist': 1500, 'den-wolf': 1100, 'den-alpha': 1100, 'cave-bear': 1000, 'poi-graveyard': 1150, 'poi-ruins': 1000, 'poi-sawmill': 900, 'poi-mine': 900, 'poi-pond': 1000,
            'poi-cabin': 800, 'poi-watchtower': 600, 'poi-well': 450, 'poi-obelisk': 800, 'poi-campsite': 650, 'poi-carrots': 500 };
        this._clears = [{ x: this.cx, z: this.cz, r: 1900 }];
        for (const m of this.loc.markers()) {
            if (/^(poi|kid|den|cave)/.test(m.name)) this._clears.push({ x: m.x, z: m.y, r: radii[m.name] || 650 });
        }
        this._queue = [];
        this._openR = 0;
    },

    _chunkAt(x, z) {
        return this.chunks[Math.min(this.rows - 1, Math.max(0, Math.floor(z / this.CH))) * this.cols + Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.CH)))];
    },

    // Открыть мир до радиуса r (px): поставить в очередь ещё не собранные чанки внутри тумана
    openTo(r, sync) {
        this._openR = Math.max(this._openR, r);
        for (const ch of this.chunks) {
            if (ch.filled || ch.queued) continue;
            if (Math.hypot(ch.cx - this.cx, ch.cz - this.cz) - this.CH * 0.72 > r) continue;
            ch.queued = true; this._queue.push(ch);
        }
        this._queue.sort((a, b) => Math.hypot(a.cx - this.cx, a.cz - this.cz) - Math.hypot(b.cx - this.cx, b.cz - this.cz));
        if (sync) this.pumpQueue(1e9);
    },
    pumpQueue(n) {
        let done = 0;
        while (this._queue.length && done < n) { const ch = this._queue.shift(); ch.queued = false; this._fillChunk(ch); done++; }
        return done;
    },

    // ---- плотность мира по качеству графики: доля деревьев, кустов, камней, брёвен, цветов и травы (ягоды и грибы — все)
    keepFor(q) {
        const k = (n, d) => (typeof n === 'number' ? n : d);
        return q <= 1 ? k(typeof QUALITY_KEEP_LOW !== 'undefined' ? QUALITY_KEEP_LOW : null, 0.2)
            : q === 2 ? k(typeof QUALITY_KEEP_MID !== 'undefined' ? QUALITY_KEEP_MID : null, 0.5)
            : k(typeof QUALITY_KEEP_HIGH !== 'undefined' ? QUALITY_KEEP_HIGH : null, 0.7);
    },
    // Детерминированное «случайное» 0..1 по позиции: одни и те же деревья остаются при каждом запуске
    hash01(x, z, salt) {
        let h = (Math.imul(Math.round(x) | 0, 0x27d4eb2d) ^ Math.imul(Math.round(z) | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1)) >>> 0;
        h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
        return h / 4294967296;
    },
    // Смена качества: уже собранные чанки пересобираются с новой густотой; срубленное и собранное остаётся
    setDensity(keep) {
        if (Math.abs(keep - this.keep) < 1e-3) return false;
        this.keep = keep;
        const filled = this.chunks.filter(c => c.filled);
        if (!filled.length) return true;
        const set = new Set(filled);
        // задачи ботов держат ссылки на старые деревья и кусты — сбрасываем
        if (typeof Bots !== 'undefined' && Bots.list) for (const b of Bots.list) if (b.task && b.task.obj && (set.has(b.task.obj.chunk))) { if (b.task.obj._lock === b) b.task.obj._lock = null; b.task = null; b.pend = null; b.chan = 0; b.nextTaskT = 0; }
        for (const ch of filled) this._disposeChunk(ch);
        this.trees = this.trees.filter(t => !set.has(t.chunk));
        this.resources = this.resources.filter(r => !set.has(r.chunk));
        this._shaking = [];
        for (const ch of filled) this._fillChunk(ch);
        return true;
    },

    // Неподвижные постройки и декор (без анимаций): мировые матрицы считаются один раз, а не каждый кадр.
    // Подвижные части (крышки, дверь клетки, молот, шестерни, парашют) не замораживаются.
    freezeRig(rig) {
        if (!rig || rig.data.anims.size || (typeof DBG !== 'undefined' && DBG.nofreeze)) return;
        const dyn = new Set();
        for (const n of Rig.DYNAMIC_PARTS) { const node = rig.node(n); if (node) dyn.add(node); }
        const live = (x) => { for (let p = x; p && p !== rig.root; p = p.parent) if (dyn.has(p)) return true; return false; };
        rig.root.computeWorldMatrix(true); rig.root.freezeWorldMatrix();
        for (const n of rig.nodes) if (!live(n)) { n.computeWorldMatrix(true); n.freezeWorldMatrix(); }
        for (const m of rig.meshes) if (!live(m)) { m.computeWorldMatrix(true); m.freezeWorldMatrix(); }
    },

    // Position hash adds visual variety without consuming RNG or changing saved tree/resource locations.
    natureVariant(name, x, z) {
        if (!['tree_birch', 'tree_dead', 'stump', 'fallen_log', 'grass', 'mushroom', 'bush_a', 'bush_berry'].includes(name)) return name;
        const k = ((Math.imul(Math.round(x), 73856093) ^ Math.imul(Math.round(z), 19349663)) >>> 0) % 3;
        const v = name + (k === 1 ? '_b' : k === 2 ? '_c' : '');
        return this.variants[v] ? v : name;
    },

    _fillChunk(ch) {
        if (ch.filled || DBG.nochunks) return;
        ch.filled = true;
        const CH = this.CH, x0 = ch.i * CH, z0 = ch.j * CH, S = this.quality;
        const rnd = U.rng((((ch.i + 1) * 73856093) ^ ((ch.j + 1) * 19349663) ^ 9911) >>> 0);
        this._noise = this._noise || new SimplexNoise('forest99');
        const noise = this._noise;
        const clears = this._clears;
        const blocked = (x, z, pad) => { for (const c of clears) if (U.dist2(x, z, c.x, c.z) < (c.r + (pad || 0)) * (c.r + (pad || 0))) return true; return false; };
        const pickVariant = (w) => { let r = rnd(), s = 0; for (const n in w) { s += w[n]; if (r <= s) return n; } return 'tree_a'; };
        // ---- деревья: сетка 8×8 с дрожанием (минимум ~150 px между стволами), густота — по зоне и шуму
        const n = 8, cell = CH / n;
        for (let gz = 0; gz < n; gz++) for (let gx = 0; gx < n; gx++) {
            const x = x0 + (gx + 0.5 + (rnd() - 0.5) * 0.6) * cell, z = z0 + (gz + 0.5 + (rnd() - 0.5) * 0.6) * cell;
            const th = this.zoneAt(x, z);
            const dens = th.trees * (0.55 + 0.45 * (noise.noise2D(x / 3200, z / 3200) * 0.5 + 0.5));
            const pass = rnd(), v = this.natureVariant(pickVariant(th.w), x, z), s = rnd.range(0.88, 1.3), ry = rnd() * Math.PI * 2;
            if (pass > dens * S || blocked(x, z, 100) || x < 300 || z < 300 || x > this.W - 300 || z > this.H - 300) continue;
            if (this.hash01(x, z, 7) >= this.keep) continue;
            const trunk = /pine/.test(v) ? 32 : /^tree_birch/.test(v) ? 26 : 40;
            const hp = Math.max(3, Math.round((/pine_b/.test(v) ? 6 : 5) * s));
            const tree = { x, z, v, s, ry, hp, maxHp: hp, alive: true, chunk: ch, rad: trunk * s, shake: 0, kind: 'tree' };
            const g = this.groundPose(x, z, ry, trunk * s * 1.2);
            tree.y = g.y - 6;
            ch.items.push(tree);
            this.trees.push(tree);
            tree.col = this.colliders.add(x, z, trunk * s, { tree });
        }
        // ---- декор и мелочь: число на чанк = база × множитель зоны
        const scatter = (name, base, key, o) => {
            o = o || {};
            const cnt = Math.floor(base * S + rnd());
            for (let k = 0; k < cnt; k++) {
                const x = x0 + rnd() * CH, z = z0 + rnd() * CH;
                const th = this.zoneAt(x, z);
                if (key && rnd() > Math.min(1, (th[key] || 0) / Math.max(0.01, o.kmax || 1.6))) continue;
                if (blocked(x, z, o.pad || 0) || x < 200 || z < 200 || x > this.W - 200 || z > this.H - 200) continue;
                const s = rnd.range(o.s0 || 0.8, o.s1 || 1.25), ry = rnd() * Math.PI * 2;
                if (!o.res && this.hash01(x, z, 13) >= this.keep) continue;
                const variant = this.natureVariant(name, x, z);
                const rec = { x, z, v: variant, s, ry, chunk: ch, alive: true };
                if (this.MERGED.has(variant)) {
                    const g = this.groundPose(x, z, rec.ry, (o.col || 40) * s);
                    rec.y = g.y - (o.sink != null ? o.sink : 5) * s; rec.pitch = o.tilt ? g.pitch : 0; rec.roll = o.tilt ? g.roll : 0;
                    ch.items.push(rec);
                } else {
                    const list = ch.inst[variant] || (ch.inst[variant] = []);
                    rec.idx = list.length; list.push(rec);
                    rec.y = this.heightAt(x, z) - 3;
                }
                if (o.col) { rec.rad = o.col * s; rec.col = this.colliders.add(x, z, rec.rad, { rock: rec }); }
                if (o.res) this.resources.push(Object.assign(rec, { kind: o.res, cool: 0, ready: true }));
            }
        };
        // базы — штук на чанк 30×30 м; множитель зоны нормируется на kmax
        scatter('rock_a', 9, 'rocks', { col: 55, s0: 0.8, s1: 1.8, tilt: true, sink: 14, kmax: 2.4 });
        scatter('rock_b', 6, 'rocks', { col: 90, s0: 0.8, s1: 1.7, tilt: true, sink: 18, kmax: 2.4 });
        scatter('rock_c', 8, 'rocks', { col: 30, s0: 0.7, s1: 1.4, tilt: true, sink: 8, kmax: 2.4 });
        scatter('boulder', 1.6, 'boulders', { col: 210, s0: 0.9, s1: 1.5, pad: 300, tilt: true, sink: 40, kmax: 2.4 });
        scatter('bush_a', 22, 'bushes', { s0: 0.8, s1: 1.5, sink: 10, kmax: 1.6 });
        scatter('bush_berry', 4.6, 'berry', { s0: 0.9, s1: 1.3, res: 'berry', col: 30, kmax: 1.6 });
        scatter('fallen_log', 2.6, 'logs', { col: 60, s0: 0.9, s1: 1.2, tilt: true, sink: 12, kmax: 1.6 });
        scatter('mushroom', 6.5, 'mush', { s0: 0.8, s1: 1.5, res: 'mushroom', kmax: 1.8 });
        scatter('flowers_y', 12, 'flowers', { s0: 0.9, s1: 1.4, kmax: 1.8 });
        scatter('flowers_w', 12, 'flowers', { s0: 0.9, s1: 1.4, kmax: 1.8 });
        scatter('flowers_p', 10, 'flowers', { s0: 0.9, s1: 1.4, kmax: 1.8 });
        scatter('grass', 560, 'grass', { s0: 0.8, s1: 1.7, pad: -300, kmax: 1.0 });
        // ---- материализация
        this._buildChunkMesh(ch);
        for (const name in ch.inst) {
            const v = this.variants[name];
            if (!v) continue;
            const list = ch.inst[name];
            if (!list.length) continue;
            const mesh = v.src.clone('c' + ch.i + '_' + ch.j + '_' + name);
            // Thin-instance matrices are per chunk. Separate geometry/VAO storage
            // prevents another clone's shorter matrix buffer from being reused.
            mesh.makeGeometryUnique();
            mesh.setEnabled(false); mesh.isPickable = false; mesh.material = v.src.material;
            const buf = new Float32Array(list.length * 16);
            list.forEach((t, i) => this._matrix(t).copyToArray(buf, i * 16));
            mesh.thinInstanceSetBuffer('matrix', buf, 16, false);
            mesh.thinInstanceRefreshBoundingInfo(true);
            mesh.receiveShadows = false;
            ch.meshes[name] = mesh;
            ch.count += list.length;
        }
        if (this.felled.size || this.pickedRes.size) this.applyPersistent(ch);
    },

    // ---- сохранение мира: чанки детерминированы, поэтому достаточно списка изменений
    resKey(r) { return Math.round(r.x) + '_' + Math.round(r.z); },
    saveState() {
        const f = [], r = [];
        for (const k of this.felled) { const p = k.split('_'); f.push(+p[0], +p[1]); }
        for (const [k, cool] of this.pickedRes) { const p = k.split('_'); r.push(+p[0], +p[1], cool); }
        return { felled: f, picked: r };
    },
    loadState(s) {
        this.felled = new Set(); this.pickedRes = new Map();
        if (!s) return;
        const f = s.felled || [], r = s.picked || [];
        for (let i = 0; i + 1 < f.length; i += 2) this.felled.add(f[i] + '_' + f[i + 1]);
        for (let i = 0; i + 2 < r.length; i += 3) this.pickedRes.set(r[i] + '_' + r[i + 1], r[i + 2]);
        this.applyPersistent();
    },
    // Применить изменения к уже построенным деревьям и ягодам (весь мир или один чанк)
    applyPersistent(ch) {
        if (this.felled.size) for (const t of this.trees) { if (t.alive && (!ch || t.chunk === ch) && this.felled.has(Math.round(t.x) + '_' + Math.round(t.z))) this.removeTree(t, true); }
        if (this.pickedRes.size) for (const r of this.resources) { if (r.ready && (!ch || r.chunk === ch)) { const c = this.pickedRes.get(this.resKey(r)); if (c != null) Zones.markPicked(r, c); } }
    },

    // Новый забег: все чанки удаляются (деревья снова целы), мир закрывается до стартового радиуса
    resetChunks() {
        for (const ch of this.chunks) this._disposeChunk(ch);
        this.trees = []; this.resources = []; this.rocks = []; this._queue = []; this._openR = 0;
        this.felled = new Set(); this.pickedRes = new Map();
        this._shaking = []; this._fell = [];
        for (const ch of this.chunks) ch.queued = false;
    },
    _disposeChunk(ch) {
        const list = this.view.shadow.getShadowMap().renderList;
        if (ch.main) { const i = list.indexOf(ch.main); if (i >= 0) list.splice(i, 1); ch.main.dispose(); ch.main = null; }
        for (const name in ch.meshes) ch.meshes[name].dispose();
        for (const it of ch.items) { if (it._shakeMesh) { this.view.removeShadowCaster(it._shakeMesh); it._shakeMesh.dispose(); } if (it.col) this.colliders.remove(it.col); }
        for (const name in ch.inst) for (const r of ch.inst[name]) if (r.col) this.colliders.remove(r.col);
        ch.meshes = {}; ch.inst = {}; ch.items = []; ch.count = 0; ch.filled = false; ch.on = false; ch.posArr = null;
    },

    // Склеить деревья и декор чанка в один меш: подмеши leaf / bark / flat
    _buildChunkMesh(ch) {
        if (!ch.items.length) return;
        const cats = this.cats, B = {};
        for (const c of cats) B[c] = { pos: [], nrm: [], uv: [], col: [], idx: [], n: 0 };
        const m3 = new Float32Array(9);
        for (const it of ch.items) {
            const v = this.variants[it.v];
            if (!v || !v.geom) continue;
            const yq = BABYLON.Quaternion.RotationYawPitchRoll(it.ry, it.pitch || 0, it.roll || 0);
            const x = yq.x, y = yq.y, z = yq.z, w = yq.w;
            // матрица поворота из кватерниона (строка-вектор: v' = v · M)
            m3[0] = 1 - 2 * (y * y + z * z); m3[1] = 2 * (x * y + z * w); m3[2] = 2 * (x * z - y * w);
            m3[3] = 2 * (x * y - z * w); m3[4] = 1 - 2 * (x * x + z * z); m3[5] = 2 * (y * z + x * w);
            m3[6] = 2 * (x * z + y * w); m3[7] = 2 * (y * z - x * w); m3[8] = 1 - 2 * (x * x + y * y);
            const s = it.s, ty = it.y != null ? it.y : this.heightAt(it.x, it.z);
            it.ranges = [];
            for (const g of v.geom) {
                const desc = v.data.model.materials[g.mat];
                const cat = this._cat(desc), b = B[cat];
                const tint = desc.color || [1, 1, 1];
                const tr = Math.pow(Math.max(0, tint[0]), 1 / 2.2), tg = Math.pow(Math.max(0, tint[1]), 1 / 2.2), tb = Math.pow(Math.max(0, tint[2]), 1 / 2.2);
                const vc = g.pos.length / 3;
                for (let k = 0; k < vc; k++) {
                    const px = g.pos[3 * k] * s, py = g.pos[3 * k + 1] * s, pz = g.pos[3 * k + 2] * s;
                    b.pos.push(m3[0] * px + m3[3] * py + m3[6] * pz + it.x, m3[1] * px + m3[4] * py + m3[7] * pz + ty, m3[2] * px + m3[5] * py + m3[8] * pz + it.z);
                    const nx = g.nrm[3 * k], ny = g.nrm[3 * k + 1], nz = g.nrm[3 * k + 2];
                    b.nrm.push(m3[0] * nx + m3[3] * ny + m3[6] * nz, m3[1] * nx + m3[4] * ny + m3[7] * nz, m3[2] * nx + m3[5] * ny + m3[8] * nz);
                    b.uv.push(g.uv[2 * k], g.uv[2 * k + 1]);
                    b.col.push(g.col[4 * k] * tr, g.col[4 * k + 1] * tg, g.col[4 * k + 2] * tb, 1);
                }
                for (let t = 0; t < g.idx.length; t++) b.idx.push(g.idx[t] + b.n);
                it.ranges.push([cat, b.n, vc]);
                b.n += vc;
            }
        }
        // общий вершинный буфер: категории подряд; индексы — по категориям
        const pos = [], nrm = [], uv = [], col = [], idx = [], subs = [];
        let vo = 0;
        const off = {};
        for (const c of cats) {
            const b = B[c];
            off[c] = vo;
            const start = idx.length;
            for (let i = 0; i < b.pos.length; i++) pos.push(b.pos[i]);
            for (let i = 0; i < b.nrm.length; i++) nrm.push(b.nrm[i]);
            for (let i = 0; i < b.uv.length; i++) uv.push(b.uv[i]);
            for (let i = 0; i < b.col.length; i++) col.push(b.col[i]);
            for (let i = 0; i < b.idx.length; i++) idx.push(b.idx[i] + vo);
            subs.push({ c, start, count: idx.length - start });
            vo += b.n;
        }
        for (const it of ch.items) if (it.ranges) it.ranges = it.ranges.map(([c, s, n]) => [off[c] + s, n]);
        const mesh = new BABYLON.Mesh('chunk' + ch.i + '_' + ch.j, this.scene);
        const vd = new BABYLON.VertexData();
        ch.posArr = new Float32Array(pos);
        vd.positions = ch.posArr; vd.normals = new Float32Array(nrm); vd.uvs = new Float32Array(uv); vd.colors = new Float32Array(col); vd.indices = idx;
        vd.applyToMesh(mesh, true);
        const multi = new BABYLON.MultiMaterial('mm' + ch.i + '_' + ch.j, this.scene);
        multi.subMaterials = cats.map(c => this.mats[c]);
        mesh.material = multi;
        mesh.subMeshes = [];
        subs.forEach((s, i) => new BABYLON.SubMesh(i, 0, vo, s.start, s.count, mesh));
        mesh.isPickable = false; mesh.receiveShadows = true;
        mesh.alwaysSelectAsActiveMesh = false;
        mesh.setEnabled(false);
        ch.main = mesh; ch.vo = vo;
        ch.count += ch.items.length;
    },

    // Спрятать/вернуть геометрию элемента склеенного чанка
    _setItemVisible(it, on) {
        const ch = it.chunk;
        if (!ch.main || !it.ranges) return;
        const p = ch.posArr;
        if (!on) {
            if (!it._saved) { it._saved = it.ranges.map(([s, n]) => p.slice(s * 3, (s + n) * 3)); }
            for (const [s, n] of it.ranges) for (let k = s * 3; k < (s + n) * 3; k += 3) { p[k] = it.x; p[k + 1] = -100000; p[k + 2] = it.z; }
        } else if (it._saved) {
            it.ranges.forEach(([s, n], i) => p.set(it._saved[i], s * 3));
            it._saved = null;
        }
        ch.main.updateVerticesData(BABYLON.VertexBuffer.PositionKind, p, false, false);
    },

    _matrix(t) {
        const y = t.y != null ? t.y : this.heightAt(t.x, t.z);
        const q = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, t.ry);
        return BABYLON.Matrix.Compose(new BABYLON.Vector3(t.s, t.sy != null ? t.sy : t.s, t.s), q, new BABYLON.Vector3(t.x, y, t.z));
    },

    // Экземпляры-мелочь (ягоды, грибы, пни)
    setInstance(rec, matrix) {
        const mesh = rec.chunk && rec.chunk.meshes[rec.v];
        if (!mesh) return;
        mesh.thinInstanceSetMatrixAt(rec.idx, matrix, true);
    },
    hideInstance(rec) { this.setInstance(rec, BABYLON.Matrix.Scaling(0.0001, 0.0001, 0.0001)); },
    addInstance(name, x, z, s, ry) {
        const ch = this.chunks[Math.min(this.rows - 1, Math.floor(z / this.CH)) * this.cols + Math.min(this.cols - 1, Math.floor(x / this.CH))];
        const v = this.variants[name];
        if (!v || !ch) return null;
        let mesh = ch.meshes[name];
        const rec = { x, z, v: name, s, ry, chunk: ch, alive: true, idx: 0, y: this.groundPose(x, z, ry, 40).y - 4 };
        const mtx = this._matrix(rec);
        if (!mesh) {
            // ВАЖНО: буфер thin instances не должен быть пустым — при нулевой длине thinInstanceAdd не может вырасти (бесконечный цикл).
            mesh = v.src.clone('cx' + ch.i + '_' + ch.j + '_' + name); mesh.makeGeometryUnique(); mesh.material = v.src.material; mesh.isPickable = false;
            const buf = new Float32Array(16); mtx.copyToArray(buf, 0);
            mesh.thinInstanceSetBuffer('matrix', buf, 16, false);
            mesh.receiveShadows = false;
            mesh.setEnabled(ch.on);
            ch.meshes[name] = mesh;
            ch.inst[name] = [];
            rec.idx = 0;
        } else {
            rec.idx = mesh.thinInstanceAdd(mtx, true);
        }
        ch.inst[name].push(rec);
        mesh.thinInstanceRefreshBoundingInfo(true);
        return rec;
    },

    // Тени статичных наборов (лагерь, места интереса): в карту теней — только пока игрок рядом
    tracked: [],
    untrackShadow(rec) {
        const i = this.tracked.indexOf(rec); if (i < 0) return;
        this.tracked.splice(i, 1);
        const list = this.view.shadow.getShadowMap().renderList;
        for (const m of rec.rig.meshes) { const k = list.indexOf(m); if (k >= 0) list.splice(k, 1); }
    },
    // Рядом с местом интереса (там деревья и хлам не ставятся)
    nearClear(x, z, pad) {
        for (const c of this._clears) if (U.dist2(x, z, c.x, c.z) < (c.r + (pad || 0)) * (c.r + (pad || 0))) return true;
        return false;
    },
    trackShadow(rig, x, z, r) {
        this.freezeRig(rig);
        const rec = { rig, x, z, r: r || 4800, on: false };
        this.tracked.push(rec);
        if (rig.root.onDisposeObservable) rig.root.onDisposeObservable.add(() => this.untrackShadow(rec));
        return rec;
    },
    _updateTracked(px, pz) {
        const list = this.view.shadow.getShadowMap().renderList;
        const members = new Set(list), removed = new Set(), added = new Set();
        for (const rec of this.tracked) {
            const pos = rec.rig.data.anims.size ? rec.rig.root.position : rec;
            const near = rec.rig._shadowOn !== false && !DBG.noshadow && U.dist2(px, pz, pos.x, pos.z) < rec.r * rec.r * this.shadowScale * this.shadowScale;
            rec.on = near;
            for (const m of rec.rig.meshes) {
                const casts = near && Rig.castsShadow(m, this.view);
                if (casts && !members.has(m)) { members.add(m); added.add(m); }
                else if (!casts && members.has(m)) { members.delete(m); removed.add(m); added.delete(m); }
            }
        }
        // Keep the renderList object and retained caster order; compact once instead of shifting on every removal.
        if (removed.size) {
            let write = 0;
            for (let read = 0; read < list.length; read++) if (!removed.has(list[read])) list[write++] = list[read];
            list.length = write;
        }
        for (const m of added) list.push(m);
    },

    // -------------------------------------------------------------------------------- дальность
    _rOf(name) {
        const R = this.viewR;
        return /^grass(?:_|$)/.test(name) ? R.grass : /flower/.test(name) ? R.flower : /stump/.test(name) ? R.deco : R.mush;
    },

    update(dt, px, pz, force) {
        this._visT -= dt;
        if (this._visT > 0 && !force) return;
        this._visT = 0.2;
        this._updateTracked(px, pz);
        const shadowList = this.view.shadow.getShadowMap().renderList;
        const k = this.viewScale != null ? this.viewScale : 1;
        const half = this.CH * 0.75;
        for (const ch of this.chunks) {
            const dx = ch.cx - px, dz = ch.cz - pz, d = Math.sqrt(dx * dx + dz * dz);
            let any = false;
            if (ch.main) {
                const on = d - half < this.viewR.tree * k;
                if (ch.main.isEnabled() !== on) ch.main.setEnabled(on);
                any = any || on;
                const casts = on && !DBG.noshadow && d - half < 4300 * this.shadowScale;
                const i = shadowList.indexOf(ch.main);
                if (casts && i < 0) shadowList.push(ch.main); else if (!casts && i >= 0) shadowList.splice(i, 1);
            }
            for (const name in ch.meshes) {
                const mesh = ch.meshes[name];
                const radius = this._rOf(name);
                const on = radius > 0 && d - half < radius * k;
                if (mesh.isEnabled() !== on) mesh.setEnabled(on);
                any = any || on;
            }
            ch.on = any;
        }
    },

    // -------------------------------------------------------------------------------- деревья
    treeInFront(x, z, fx, fz, reach) {
        let best = null, bd = 1e9;
        this.colliders.query(x, z, reach + 60, (c) => {
            const t = c.owner && c.owner.tree;
            if (!t || !t.alive) return;
            const dx = t.x - x, dz = t.z - z, d = Math.hypot(dx, dz) - t.rad;
            if (d > reach) return;
            const dot = (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1);
            if (dot < 0.35 && d > 30) return;
            const score = d + (1 - dot) * 120;
            if (score < bd) { bd = score; best = t; }
        });
        return best;
    },

    // Тряска дерева при ударе: на время дерево заменяется отдельной копией, которая качается
    shakeTree(t, dirx, dirz) {
        t.shake = 1; t.shakeDir = { x: dirx, z: dirz };
        if (!t._shakeMesh) {
            const v = this.variants[t.v];
            if (!v) return;
            const m = v.src.clone('shk'); m.material = v.src.material; m.setEnabled(true); m.isPickable = false;
            m.scaling.setAll(t.s);
            m.position.set(t.x, t.y != null ? t.y : this.heightAt(t.x, t.z), t.z);
            m.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, t.ry);
            this.view.addShadowCaster(m, false);
            t._shakeMesh = m;
            this._setItemVisible(t, false);
        }
        if (!this._shaking.includes(t)) this._shaking.push(t);
    },
    _shaking: [],

    updateShake(dt) {
        for (let i = this._shaking.length - 1; i >= 0; i--) {
            const t = this._shaking[i], m = t._shakeMesh;
            t.shake = Math.max(0, t.shake - dt * 2.4);
            if (m) {
                const a = Math.sin(t.shake * 30) * t.shake * 0.06, d = t.shakeDir || { x: 0, z: 0 };
                m.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, t.ry).multiply(BABYLON.Quaternion.RotationYawPitchRoll(0, d.z * a, -d.x * a));
            }
            if (t.shake <= 0) {
                this._shaking.splice(i, 1);
                if (m) { this.view.removeShadowCaster(m); m.dispose(); t._shakeMesh = null; if (t.alive) this._setItemVisible(t, true); }
            }
        }
    },

    // Свалить дерево: убрать геометрию из чанка, оставить пень
    removeTree(t, quiet) {
        t.alive = false;
        if (!quiet) this.felled.add(Math.round(t.x) + '_' + Math.round(t.z));
        this.colliders.remove(t.col);
        if (t._shakeMesh) { this.view.removeShadowCaster(t._shakeMesh); t._shakeMesh.dispose(); t._shakeMesh = null; }
        this._setItemVisible(t, false);
        t._saved = null;
        const st = this.addInstance(this.natureVariant('stump', t.x, t.z), t.x, t.z, t.s * 0.9, t.ry);
        if (st) st.col = this.colliders.add(t.x, t.z, 34 * t.s, { stump: st });
        return t;
    },

    fellVisual(t, dirx, dirz, done) {
        const v = this.variants[t.v];
        if (!v) { if (done) done(); return; }
        const root = new BABYLON.TransformNode('felled', this.scene);
        const mesh = v.src.clone('felledMesh');
        mesh.material = v.src.material; mesh.setEnabled(true); mesh.parent = root; mesh.isPickable = false;
        mesh.scaling.setAll(t.s); mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, t.ry);
        const y0 = t.y != null ? t.y : this.heightAt(t.x, t.z);
        root.position.set(t.x, y0, t.z);
        const axis = new BABYLON.Vector3(dirz, 0, -dirx).normalize();
        this.view.addShadowCaster(mesh, false);
        let a = 0, vel = 0, phase = 0, bounced = 0, time = 0;
        root.rotationQuaternion = BABYLON.Quaternion.Identity();
        const step = (dt) => {
            time += dt;
            if (phase === 0) { vel += (0.7 + a * 5.5) * dt * 2.2; a += vel * dt; if (a >= 1.5) { a = 1.5; phase = 1; vel = -vel * 0.14; bounced++; if (this.onTreeLand) this.onTreeLand(t, root); } }
            else if (phase === 1) { vel -= 9 * dt; a += vel * dt; if (a <= 1.5) { a = 1.5; vel = -vel * 0.35; bounced++; if (bounced > 3 || Math.abs(vel) < 0.2) phase = 2; } }
            else { phase = 3; }
            root.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, a);
            root.position.y = y0 + (phase === 1 ? Math.max(0, Math.sin(a * 2) * 4) : 0);
            if (phase === 3 || time > 4) {
                World._fell.splice(World._fell.indexOf(step), 1);
                Tween.to(0.9, (k) => { root.scaling.setAll(1 - k); }, { done: () => { this.view.removeShadowCaster(mesh); mesh.dispose(); root.dispose(); } });
                if (done) done();
            }
        };
        this._fell.push(step);
    },
    _fell: [],

    // -------------------------------------------------------------------------------- коллайдеры карты
    _addMapColliders() {
        const list = this.loc.objects;
        const T = World.PROP_COLLIDERS;
        for (const rec of list) {
            const d = rec.def;
            if (d.kind === 'marker' || !d.model) continue;
            const key = /([^/]+)\.[a-z]+$/i.exec(d.model);
            const spec = key && T[key[1]];
            if (!spec) continue;
            const yaw = -((d.rot && d.rot[1]) || 0) * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
            const sc = (d.scale && d.scale[0]) || 1;
            for (const [ox, oz, r] of spec) {
                const x = d.x + (ox * c + oz * s) * M * sc, z = d.y + (-ox * s + oz * c) * M * sc;
                this.colliders.add(x, z, r * M * sc, { prop: rec });
            }
        }
    },

    // -------------------------------------------------------------------------------- стена тумана
    // Цилиндр вокруг лагеря с шейдером: 3D value-noise (без шва по окружности), клубящийся верхний край,
    // подсветка в сторону солнца, тёмное основание. Цвет — цвет тумана неба (стык с Scene fog без границы).
    _fogWall() {
        const scene = this.scene;
        const H = 3400;
        const VS = `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 worldViewProjection;
varying vec3 vWp;
void main() {
    vec4 wp = world * vec4(position, 1.0);
    vWp = wp.xyz;
    gl_Position = worldViewProjection * vec4(position, 1.0);
}`;
        const FS = `
precision highp float;
varying vec3 vWp;
uniform vec3 fogColor;
uniform vec3 camPos;
uniform vec3 sunDir;
uniform vec4 P;      // x: время, y: низ стены (Y), z: высота стены, w: сила свечения
float hash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.02 + vec3(11.3, 5.7, 3.1); a *= 0.5; } return s; }
void main() {
    float t = P.x;
    float h = clamp((vWp.y - P.y) / P.z, 0.0, 1.0);
    vec3 q = vec3(vWp.x, vWp.y * 1.7, vWp.z) * 0.00085;
    float n = fbm(q + vec3(t * 0.010, -t * 0.006, t * 0.008));
    float n2 = fbm(q * 2.3 + vec3(-t * 0.021, t * 0.004, 5.2));
    float dens = 0.62 * n + 0.38 * n2;
    // клубящийся верхний край: высота кромки гуляет по шуму
    float top = 0.50 + 0.42 * dens;
    float a = 1.0 - smoothstep(top - 0.20, top + 0.10, h);
    a = clamp(a * (0.86 + 0.28 * dens), 0.0, 1.0);
    vec3 v = normalize(vWp - camPos);
    float sg = pow(max(dot(v, sunDir), 0.0), 3.0) * P.w;
    vec3 col = fogColor * (0.80 + 0.36 * dens) * (0.88 + 0.16 * h) + sg * vec3(0.50, 0.38, 0.22) * (0.4 + 0.6 * h);
    gl_FragColor = vec4(col, a);
}`;
        const mat = new BABYLON.ShaderMaterial('fogWallMat', scene, { vertexSource: VS, fragmentSource: FS },
            { attributes: ['position'], uniforms: ['world', 'worldViewProjection', 'fogColor', 'camPos', 'sunDir', 'P'], needAlphaBlending: true });
        mat.backFaceCulling = false; mat.disableDepthWrite = true; mat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
        mat.metadata = { toon: false };
        mat.setColor3('fogColor', new BABYLON.Color3(0.6, 0.7, 0.75));
        mat.setVector3('camPos', new BABYLON.Vector3(0, 0, 0));
        mat.setVector3('sunDir', new BABYLON.Vector3(0, 1, 0));
        mat.setVector4('P', new BABYLON.Vector4(0, 0, H, 0.5));
        const wall = BABYLON.MeshBuilder.CreateCylinder('fogWall', { height: H, diameter: 2, tessellation: 72, cap: BABYLON.Mesh.NO_CAP, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
        wall.material = mat; wall.isPickable = false; wall.alwaysSelectAsActiveMesh = true;
        wall.renderingGroupId = 1;
        this.fogWall = wall; this.fogMat = mat; this._fogH = H; this._fogT = 0;
        wall.position.set(this.cx, 0, this.cz);
        this.setFogRadius(this.fogRadius, true);
    },

    setFogRadius(r, instant) {
        this._fogTarget = r;
        if (instant) { this.fogRadius = r; this._applyFog(); }
    },
    _applyFog() {
        if (!this.fogWall) return;
        const r = this.fogRadius;
        this.fogWall.scaling.set(r, 1, r);
        this.fogWall.position.y = this.heightAt(this.cx, this.cz) - 300 + this._fogH * 0.5;
    },
    tickFog(dt, sky) {
        if (this._fogTarget != null && Math.abs(this._fogTarget - this.fogRadius) > 1) { this.fogRadius = U.damp(this.fogRadius, this._fogTarget, 1.6, dt); }
        this._applyFog();
        const m = this.fogMat;
        if (!m || !sky) return;
        this._fogT = (this._fogT + dt) % 4000;
        const k = sky._key(sky.p);
        const cam = this.scene.activeCamera;
        m.setColor3('fogColor', k.fog);
        if (cam) m.setVector3('camPos', cam.position);
        if (sky.toSun) m.setVector3('sunDir', sky.daylight > 0.3 ? sky.toSun : (sky.toMoon || sky.toSun));
        m.setVector4('P', new BABYLON.Vector4(this._fogT, this.fogWall.position.y - this._fogH * 0.5, this._fogH, 0.25 + 0.75 * sky.daylight));
    },
    // Держать внутри тумана; true — упёрлись в стену
    clampToFog(pos, margin) {
        const dx = pos.x - this.cx, dz = pos.z - this.cz, d = Math.hypot(dx, dz), lim = this.fogRadius - (margin || 150);
        if (d > lim) { const k = lim / d; pos.x = this.cx + dx * k; pos.z = this.cz + dz * k; return true; }
        return false;
    },
    fogProximity(x, z) { const d = Math.hypot(x - this.cx, z - this.cz); return U.clamp((d - (this.fogRadius - 1700)) / 1500, 0, 1); },

    frame(dt) {
        if (this._queue && this._queue.length) { this.pumpQueue(2); this._visT = 0; }
        this.updateShake(dt);
        for (const f of this._fell.slice()) f(dt);
    },
};

// Простые круглые коллайдеры моделей карты: [x, z, радиус] в метрах от начала модели (модель смотрит +Z)
World.PROP_COLLIDERS = {
    cabin: [[-2.2, -1.9, 1.3], [0, -1.9, 1.3], [2.2, -1.9, 1.3], [-2.2, 1.9, 1.3], [2.2, 1.9, 1.3], [-2.9, 0, 1.0], [2.9, 0, 1.0]],
};

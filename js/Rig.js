// Rig.js — модели с жёсткой иерархией и анимацией (Blender GLB: кости — узлы, меши висят на костях;
// так устроены и настоящие Roblox-персонажи: Motor6D между частями). Движок читает только статичные
// glTF (ModelGLTF.js) — здесь свой разбор: иерархия узлов -> BABYLON.TransformNode, меши по
// примитивам, анимации (translation / rotation / scale по узлам), слои и кроссфейд.
//
// Использование:
//   const data = await Rig.load('assets/models/player.glb');
//   const rig = Rig.instance(data, scene, { materials: { hair: '#ff5599' }, scale: 1 });
//   rig.play('walk');                                   // слой 0, кроссфейд 0.2 с
//   rig.play('chop', { layer: 1, mask: ['UpperTorso'], loop: false, fade: 0.08, speed: 1.2 });
//   rig.update(dt);                                     // раз в кадр
//   rig.attach('GripR', axeMesh);                       // предмет в руку
//
// ЕДИНИЦЫ: метры glTF × 100 = px мира. Модель смотрит в +Z (экспорт Blender: перед = −Y).
// Слой: base (0) — движение, выше — перекрывают его по маске (узел + все потомки). Вес слоя плавно
// растёт при play и падает после конца одноразового клипа (или stop). Процедурные смещения
// (rig.offset) складываются с анимацией и живут один кадр — задавай их каждый кадр.

/** @type {Record<string, any>} */
const Rig = {
    UNIT: 100,
    _cache: new Map(),

    load(url) {
        let p = this._cache.get(url);
        if (!p) {
            p = this._fetch(url);
            this._cache.set(url, p);
            p.catch(() => this._cache.delete(url));
        }
        return p;
    },

    async _fetch(url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
        return this.parse(await r.arrayBuffer(), { url, base: Model3D.baseOf(url) });
    },

    // ArrayBuffer GLB -> данные (общие для всех экземпляров)
    async parse(buffer, ctx) {
        const base = (ctx && ctx.base) || '';
        const { json, bin } = ModelGLTF._readGlb(buffer);
        const buffers = await Promise.all((json.buffers || []).map((b, i) => ModelGLTF._buffer(b, i, bin, base)));
        const gltf = { json, buffers };
        const U = this.UNIT;
        const nodesJson = json.nodes || [];
        const data = {
            url: ctx && ctx.url, nodes: [], roots: [], prims: [], materials: [], anims: new Map(), byName: new Map(),
            model: { materials: [], _textures: new Map() },
            _mats: new Map(),
        };
        const matIndex = new Map();
        const matOf = (i) => {
            const k = i == null ? -1 : i;
            if (!matIndex.has(k)) {
                matIndex.set(k, data.model.materials.length);
                data.model.materials.push(ModelGLTF._material(gltf, k, base));
            }
            return matIndex.get(k);
        };
        // узлы
        nodesJson.forEach((n, i) => {
            const t = n.translation || [0, 0, 0], r = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
            let T = [t[0] * U, t[1] * U, t[2] * U], R = r.slice(), S = s.slice();
            if (n.matrix) {
                const sc = new BABYLON.Vector3(), q = new BABYLON.Quaternion(), tr = new BABYLON.Vector3();
                BABYLON.Matrix.FromArray(n.matrix).decompose(sc, q, tr);
                T = [tr.x * U, tr.y * U, tr.z * U]; R = [q.x, q.y, q.z, q.w]; S = [sc.x, sc.y, sc.z];
            }
            data.nodes.push({ name: n.name || 'node' + i, parent: -1, children: (n.children || []).slice(), T, R, S, prims: [], mesh: n.mesh });
        });
        data.nodes.forEach((n, i) => n.children.forEach(c => { if (data.nodes[c]) data.nodes[c].parent = i; }));
        const scene = json.scenes && json.scenes[json.scene || 0];
        data.roots = (scene && scene.nodes) || data.nodes.map((n, i) => i).filter(i => data.nodes[i].parent < 0);
        // имя -> узел: кость важнее меша с тем же именем (меши висят на костях и называются так же)
        data.nodes.forEach((n, i) => {
            const prev = data.byName.get(n.name);
            if (prev == null || (data.nodes[prev].mesh != null && n.mesh == null)) data.byName.set(n.name, i);
        });
        // меши узлов -> примитивы
        data.nodes.forEach((n, i) => {
            if (n.mesh == null || !json.meshes || !json.meshes[n.mesh]) return;
            for (const p of json.meshes[n.mesh].primitives || []) {
                const prim = this._prim(gltf, p, matOf, U);
                if (prim) { n.prims.push(data.prims.length); data.prims.push(prim); }
            }
        });
        // анимации
        for (const a of json.animations || []) {
            const tracks = [];
            let duration = 0;
            for (const ch of a.channels || []) {
                const tg = ch.target || {};
                if (tg.node == null || !data.nodes[tg.node]) continue;
                const path = { translation: 't', rotation: 'r', scale: 's' }[tg.path];
                if (!path) continue;
                const smp = a.samplers[ch.sampler];
                const times = ModelGLTF._read(gltf, smp.input), values = ModelGLTF._read(gltf, smp.output);
                if (path === 't') for (let k = 0; k < values.length; k++) values[k] *= U;
                if (times.length) duration = Math.max(duration, times[times.length - 1]);
                tracks.push({ node: tg.node, path, times, values, step: smp.interpolation === 'STEP' });
            }
            const byNode = new Map();
            for (const tr of tracks) {
                if (!byNode.has(tr.node)) byNode.set(tr.node, {});
                byNode.get(tr.node)[tr.path] = tr;
            }
            data.anims.set(a.name, { name: a.name, duration, tracks, byNode });
        }
        await Model3D._fetchTextures(data.model);
        return data;
    },

    // Примитив -> массивы в ЛОКАЛЬНЫХ координатах узла (метры × 100)
    _prim(gltf, p, matOf, U) {
        const mode = p.mode == null ? 4 : p.mode;
        if (mode !== 4) return null;
        const at = p.attributes || {};
        if (at.POSITION == null) return null;
        const pos = ModelGLTF._read(gltf, at.POSITION);
        for (let i = 0; i < pos.length; i++) pos[i] *= U;
        const count = pos.length / 3;
        let idx = p.indices != null ? ModelGLTF._read(gltf, p.indices, true) : null;
        if (!idx) { idx = new Uint32Array(count); for (let i = 0; i < count; i++) idx[i] = i; }
        // обход задом наперёд (шапка Model3D.js)
        const out = new Uint32Array(idx.length);
        for (let t = 0; t + 2 < idx.length; t += 3) { out[t] = idx[t]; out[t + 1] = idx[t + 2]; out[t + 2] = idx[t + 1]; }
        const nrm = at.NORMAL != null ? ModelGLTF._read(gltf, at.NORMAL) : null;
        const uv = at.TEXCOORD_0 != null ? ModelGLTF._read(gltf, at.TEXCOORD_0) : null;
        if (uv) for (let i = 1; i < uv.length; i += 2) uv[i] = 1 - uv[i];
        let col = null;
        if (at.COLOR_0 != null) {
            const src = ModelGLTF._read(gltf, at.COLOR_0), k = gltf.json.accessors[at.COLOR_0].type === 'VEC3' ? 3 : 4;
            col = new Float32Array(count * 4);
            for (let i = 0; i < count; i++) {
                for (let j = 0; j < 3; j++) col[4 * i + j] = Math.pow(Math.max(0, src[k * i + j]), 1 / 2.2);
                col[4 * i + 3] = k === 4 ? src[k * i + 3] : 1;
            }
        }
        return { pos, nrm, uv, col, idx: out, mat: matOf(p.material) };
    },

    // Взять анимации у другой модели с теми же именами костей (культист и дети берут клипы игрока)
    borrowAnims(data, src, names) {
        for (const [name, clip] of src.anims) {
            if (data.anims.has(name) || (names && !names.includes(name))) continue;
            const tracks = [], byNode = new Map();
            for (const tr of clip.tracks) {
                const ni = data.byName.get(src.nodes[tr.node].name);
                if (ni == null) continue;
                const t2 = Object.assign({}, tr, { node: ni });
                tracks.push(t2);
                if (!byNode.has(ni)) byNode.set(ni, {});
                byNode.get(ni)[tr.path] = t2;
            }
            data.anims.set(name, { name, duration: clip.duration, tracks, byNode });
        }
    },

    // ---- материалы -------------------------------------------------------------------------
    // Материал по индексу данных для сцены: StandardMaterial из glTF (кэш на сцену). Имя glow* —
    // свечение без освещения. override: { color: '#rrggbb' | [r,g,b] (гамма), alpha, emissive }.
    material(data, i, scene, override, tag) {
        const key = scene.uid + '|' + i + '|' + (tag || '');
        let m = data._mats.get(key);
        if (m && scene.materials.indexOf(m) >= 0) return m;
        const desc = data.model.materials[i];
        m = Model3D._material(data.model, desc, (data.url || 'rig') + (tag ? '#' + tag : ''), scene);
        m.name = desc.name;
        if (/^glow/i.test(desc.name)) {
            const c = m.diffuseColor.clone();
            m.emissiveColor = c;
            m.diffuseColor = new BABYLON.Color3(0, 0, 0);
            m.specularColor = new BABYLON.Color3(0, 0, 0);
            m.disableLighting = true;
        } else {
            m.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
            m.specularPower = 24;
        }
        m.maxSimultaneousLights = 8;
        if (override) Rig.recolor(m, override);
        m.metadata = Object.assign({ toonGroup: 'actor' }, m.metadata);
        data._mats.set(key, m);
        return m;
    },

    recolor(m, o) {
        if (typeof o === 'string' || Array.isArray(o)) o = { color: o };
        if (o.color) {
            const c = typeof o.color === 'string' ? BABYLON.Color3.FromHexString(o.color) : new BABYLON.Color3(o.color[0], o.color[1], o.color[2]);
            if (m.disableLighting) m.emissiveColor = c; else m.diffuseColor = c;
        }
        if (o.alpha != null) m.alpha = o.alpha;
        if (o.emissive) m.emissiveColor = BABYLON.Color3.FromHexString(o.emissive);
    },

    // ---- экземпляр --------------------------------------------------------------------------
    // opts: { name, materials: { имя_материала: override }, hide: [узлы], scale, shadows: view }
    instance(data, scene, opts) {
        return new RigInstance(data, scene, opts || {});
    },

    // Склейка персонажа в один меш со скелетом (кости = узлы) возможна, если матрицы костей
    // поместятся в текстуру: WebGL2 или float-текстуры с выборкой в вершинном шейдере. ?nomerge — выключить.
    // Подвижные части неподвижных построек: их двигает код (крышка сундука, дверь клетки, молот, шестерни, парашют)
    DYNAMIC_PARTS: ['lid', 'door', 'hammer', 'gear1', 'gear2', 'chute'],

    // Однотонный материал постройки можно увести в цвет вершин: без текстуры, прозрачности, свечения и не цвет ключа
    // (его перекрашивают после создания). Общий материал — белый с теми же бликами, что у Rig.material.
    isPlain(m) {
        return !!m && !m.diffuseTexture && !m.disableLighting && !(m.alpha < 1) && m.name !== 'keycolor'
            && (!m.emissiveColor || (m.emissiveColor.r + m.emissiveColor.g + m.emissiveColor.b) < 1e-3);
    },
    // двусторонние (так экспортирует Blender) и односторонние — два общих материала
    plainMaterial(scene, twoSided) {
        const key = '_plain' + (twoSided ? '2_' : '1_') + scene.uid;
        let m = this[key];
        if (m && scene.materials.indexOf(m) >= 0) return m;
        m = this[key] = new BABYLON.StandardMaterial(twoSided ? 'rigPlain2' : 'rigPlain', scene);
        m.backFaceCulling = !twoSided;
        m.diffuseColor = new BABYLON.Color3(1, 1, 1);
        m.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
        m.specularPower = 24;
        m.maxSimultaneousLights = 8;
        m.metadata = { toonGroup: 'actor' };
        return m;
    },

    canSkin(scene) {
        if (typeof DBG !== 'undefined' && DBG.nomerge) return false;
        const e = scene.getEngine(), c = e.getCaps();
        return e.webGLVersion >= 2 || (!!c.textureFloat && c.maxVertexTextureImageUnits > 0);
    },

    // Small details do not need a separate shadow draw at reduced quality.
    castsShadow(mesh, view) {
        if (!mesh.isEnabled()) return false;
        const min = view.shadowMinRadius || 0;
        if (min <= 0) return true;
        mesh.computeWorldMatrix();
        return mesh.getBoundingInfo().boundingSphere.radiusWorld >= min;
    },

    // Геометрия примитивов в позе покоя (мировые матрицы узлов): [{ pos, nrm, uv, col, idx, mat }] — для склейки чанков
    bakeGeom(data) {
        const world = new Array(data.nodes.length);
        const local = (n) => BABYLON.Matrix.Compose(new BABYLON.Vector3(n.S[0], n.S[1], n.S[2]),
            new BABYLON.Quaternion(n.R[0], n.R[1], n.R[2], n.R[3]), new BABYLON.Vector3(n.T[0], n.T[1], n.T[2]));
        const visit = (i, parent) => { const n = data.nodes[i]; world[i] = local(n).multiply(parent); n.children.forEach(c => visit(c, world[i])); };
        data.roots.forEach(r => visit(r, BABYLON.Matrix.Identity()));
        const out = [], v = new BABYLON.Vector3();
        data.nodes.forEach((n, i) => {
            const W = world[i], NM = W.clone().invert().transpose(), mirror = W.determinant() < 0;
            for (const pi of n.prims) {
                const p = data.prims[pi], vc = p.pos.length / 3;
                const pos = new Float32Array(vc * 3), nrm = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), col = new Float32Array(vc * 4);
                for (let k = 0; k < vc; k++) {
                    BABYLON.Vector3.TransformCoordinatesFromFloatsToRef(p.pos[3 * k], p.pos[3 * k + 1], p.pos[3 * k + 2], W, v);
                    pos[3 * k] = v.x; pos[3 * k + 1] = v.y; pos[3 * k + 2] = v.z;
                    if (p.nrm) { BABYLON.Vector3.TransformNormalFromFloatsToRef(p.nrm[3 * k], p.nrm[3 * k + 1], p.nrm[3 * k + 2], NM, v); v.normalize(); nrm[3 * k] = v.x; nrm[3 * k + 1] = v.y; nrm[3 * k + 2] = v.z; } else nrm[3 * k + 1] = 1;
                    if (p.uv) { uv[2 * k] = p.uv[2 * k]; uv[2 * k + 1] = p.uv[2 * k + 1]; }
                    if (p.col) { col[4 * k] = p.col[4 * k]; col[4 * k + 1] = p.col[4 * k + 1]; col[4 * k + 2] = p.col[4 * k + 2]; col[4 * k + 3] = p.col[4 * k + 3]; } else { col[4 * k] = col[4 * k + 1] = col[4 * k + 2] = col[4 * k + 3] = 1; }
                }
                const idx = new Uint32Array(p.idx.length);
                for (let t = 0; t + 2 < idx.length; t += 3) { idx[t] = p.idx[t]; idx[t + 1] = p.idx[mirror ? t + 2 : t + 1]; idx[t + 2] = p.idx[mirror ? t + 1 : t + 2]; }
                out.push({ pos, nrm, uv, col, idx, mat: p.mat });
            }
        });
        return out;
    },

    // Склеить меши иерархии в позе покоя в ОДИН Mesh (статичные модели: деревья, камни; thin instances).
    // Материал-группы — подмеши. opts: { name, flat: bool }
    bakeMesh(data, scene, opts) {
        const o = opts || {};
        const world = new Array(data.nodes.length);
        const local = (n) => BABYLON.Matrix.Compose(new BABYLON.Vector3(n.S[0], n.S[1], n.S[2]),
            new BABYLON.Quaternion(n.R[0], n.R[1], n.R[2], n.R[3]), new BABYLON.Vector3(n.T[0], n.T[1], n.T[2]));
        const visit = (i, parent) => {
            const n = data.nodes[i];
            world[i] = local(n).multiply(parent);
            n.children.forEach(c => visit(c, world[i]));
        };
        data.roots.forEach(r => visit(r, BABYLON.Matrix.Identity()));
        const groups = new Map();   // mat -> { pos, nrm, uv, col, idx }
        data.nodes.forEach((n, i) => {
            if (o.skip && o.skip(n)) return;
            const W = world[i], NM = W.clone().invert().transpose();
            const mirror = W.determinant() < 0;
            for (const pi of n.prims) {
                const p = data.prims[pi];
                let g = groups.get(p.mat);
                if (!g) { g = { pos: [], nrm: [], uv: [], col: [], idx: [], n: 0 }; groups.set(p.mat, g); }
                const vc = p.pos.length / 3, v = new BABYLON.Vector3();
                for (let k = 0; k < vc; k++) {
                    BABYLON.Vector3.TransformCoordinatesFromFloatsToRef(p.pos[3 * k], p.pos[3 * k + 1], p.pos[3 * k + 2], W, v);
                    g.pos.push(v.x, v.y, v.z);
                    if (p.nrm) { BABYLON.Vector3.TransformNormalFromFloatsToRef(p.nrm[3 * k], p.nrm[3 * k + 1], p.nrm[3 * k + 2], NM, v); v.normalize(); g.nrm.push(v.x, v.y, v.z); } else g.nrm.push(0, 1, 0);
                    if (p.uv) g.uv.push(p.uv[2 * k], p.uv[2 * k + 1]); else g.uv.push(0, 0);
                    if (p.col) g.col.push(p.col[4 * k], p.col[4 * k + 1], p.col[4 * k + 2], p.col[4 * k + 3]); else g.col.push(1, 1, 1, 1);
                }
                for (let t = 0; t + 2 < p.idx.length; t += 3) {
                    g.idx.push(g.n + p.idx[t], g.n + p.idx[mirror ? t + 2 : t + 1], g.n + p.idx[mirror ? t + 1 : t + 2]);
                }
                g.n += vc;
            }
        });
        const pos = [], nrm = [], uv = [], col = [], idx = [], subs = [];
        let vo = 0;
        for (const [mat, g] of groups) {
            const start = idx.length;
            pos.push(...g.pos); nrm.push(...g.nrm); uv.push(...g.uv); col.push(...g.col);
            for (const k of g.idx) idx.push(k + vo);
            subs.push({ mat, start, count: idx.length - start });
            vo += g.n;
        }
        const mesh = new BABYLON.Mesh(o.name || 'baked', scene);
        const vd = new BABYLON.VertexData();
        vd.positions = pos; vd.normals = nrm; vd.uvs = uv; vd.colors = col; vd.indices = idx;
        vd.applyToMesh(mesh);
        const mats = subs.map(s => this.material(data, s.mat, scene, null, o.tag));
        if (subs.length > 1) {
            const multi = new BABYLON.MultiMaterial((o.name || 'baked') + '-mm', scene);
            multi.subMaterials = mats;
            mesh.material = multi;
            mesh.subMeshes = [];
            subs.forEach((s, i) => new BABYLON.SubMesh(i, 0, vo, s.start, s.count, mesh));
        } else if (subs.length) mesh.material = mats[0];
        return mesh;
    },
};

// Слой анимации ------------------------------------------------------------------------------
class RigLayer {
    constructor() {
        this.cur = null;       // { clip, t, speed, loop, hold }
        this.prev = null;      // уходящий клип при кроссфейде
        this.prevT = 0;
        this.blend = 1;        // 0..1: доля cur в смеси cur/prev
        this.blendRate = 6;
        this.weight = 0;       // вес слоя над нижними
        this.target = 0;       // куда тянется вес
        this.rate = 8;         // скорость изменения веса, 1/с
        this.mask = null;      // Set индексов узлов | null (все)
        this.onEnd = null;
        this.finished = false;
        this.lastT = 0;
        this.passed = null;
    }
}

class RigInstance {
    /** @type {any} */
    static _tmp = null;
    constructor(data, scene, opts) {
        this.data = data;
        this.scene = scene;
        this.name = opts.name || 'rig';
        this.root = new BABYLON.TransformNode(this.name, scene);
        this.root.rotationQuaternion = BABYLON.Quaternion.Identity();
        if (opts.scale) this.root.scaling.setAll(opts.scale);
        this.nodes = [];
        this.meshes = [];
        this.materials = new Map();     // имя материала -> [StandardMaterial]
        this._own = [];                 // материалы этого экземпляра (dispose)
        this.layers = [new RigLayer(), new RigLayer(), new RigLayer()];
        this.layers[0].weight = 1; this.layers[0].target = 1;
        this._offsets = new Map();      // узел -> { q: Quaternion|null, p: Vector3|null }
        this.time = 0;
        this.speed = 1;
        const D = data;
        const ov = opts.materials || null;
        const tag = ov ? this.name + Math.random().toString(36).slice(2, 7) : '';
        D.nodes.forEach((n, i) => {
            const tn = new BABYLON.TransformNode(n.name, scene);
            tn.position.set(n.T[0], n.T[1], n.T[2]);
            tn.rotationQuaternion = new BABYLON.Quaternion(n.R[0], n.R[1], n.R[2], n.R[3]);
            tn.scaling.set(n.S[0], n.S[1], n.S[2]);
            this.nodes.push(tn);
        });
        D.nodes.forEach((n, i) => { this.nodes[i].parent = n.parent >= 0 ? this.nodes[n.parent] : this.root; });
        // merge: персонаж — один меш со скелетом (части по материалам), узлы остаются костями:
        // анимация, offset, предметы в руках и IK работают как прежде, а вызовов отрисовки в разы меньше
        if (opts.merge && Rig.canSkin(scene)) this._buildMerged(D, scene, ov, tag, opts.hide || [], !!opts.flat);
        // bake: неподвижная постройка — все части одного материала в одном меше; подвижные части (крышка, дверь…) отдельно
        else if (opts.bake && !D.anims.size) this._buildBaked(D, scene, ov, tag);
        else D.nodes.forEach((n, i) => n.prims.forEach((pi, k) => this._primMesh(D, scene, i, pi, k, ov, tag)));
        (opts.hide || []).forEach(n => this.setVisible(n, false));
        if (opts.shadows) this.setShadows(opts.shadows, true);
        // Кэш: какие узлы вообще анимированы (любым клипом) — их сбрасываем в покой каждый кадр
        this._animated = new Set();
        for (const c of D.anims.values()) for (const k of c.byNode.keys()) this._animated.add(k);
        this._animated = Array.from(this._animated);
        this._q = new BABYLON.Quaternion(); this._q2 = new BABYLON.Quaternion();
        this._pose = { t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1] };
        this._lp = { t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1] };
    }

    // Материал части (с перекраской экземпляра) и учёт в this.materials для recolor
    _matFor(D, p, scene, ov, tag) {
        const mname = D.model.materials[p.mat].name;
        const override = ov && (ov[mname] || null);
        let mat;
        if (override) {
            mat = Rig.material(D, p.mat, scene, override, tag + mname);
            if (!this._own.includes(mat)) this._own.push(mat);
        } else mat = Rig.material(D, p.mat, scene, null, '');
        if (!this.materials.has(mname)) this.materials.set(mname, []);
        if (!this.materials.get(mname).includes(mat)) this.materials.get(mname).push(mat);
        return mat;
    }

    // Отдельный меш части на своём узле (обычный путь)
    _primMesh(D, scene, i, pi, k, ov, tag) {
        const n = D.nodes[i], p = D.prims[pi];
        const mesh = new BABYLON.Mesh(n.name + '_' + k, scene);
        const vd = new BABYLON.VertexData();
        vd.positions = p.pos; vd.indices = p.idx;
        vd.normals = p.nrm || undefined;
        if (!p.nrm) { vd.normals = new Float32Array(p.pos.length); BABYLON.VertexData.ComputeNormals(p.pos, p.idx, vd.normals); }
        if (p.uv) vd.uvs = p.uv;
        if (p.col) vd.colors = p.col;
        vd.applyToMesh(mesh, false);
        mesh.material = this._matFor(D, p, scene, ov, tag);
        mesh.parent = this.nodes[i];
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        mesh.metadata = { rigNode: n.name };
        this.meshes.push(mesh);
        return mesh;
    }

    // Запечённая постройка: части склеены в один меш на «якоре» — корне (неподвижное) или подвижном узле (крышка, дверь…).
    // Однотонные материалы (без текстуры, прозрачности и свечения) уходят в цвет вершин и рисуются одним общим материалом:
    // вместо вызова отрисовки на каждую деталь — один-два на постройку. Особые материалы — своими подмешами.
    _buildBaked(D, scene, ov, tag) {
        const V = BABYLON.Vector3, Q = BABYLON.Quaternion;
        const local = (n) => BABYLON.Matrix.Compose(new V(n.S[0], n.S[1], n.S[2]), new Q(n.R[0], n.R[1], n.R[2], n.R[3]), new V(n.T[0], n.T[1], n.T[2]));
        const world = new Array(D.nodes.length);
        const visit = (i, parent) => { world[i] = parent ? local(D.nodes[i]).multiply(parent) : local(D.nodes[i]); D.nodes[i].children.forEach(c => visit(c, world[i])); };
        D.nodes.forEach((n, i) => { if (n.parent < 0) visit(i, null); });
        // якорь узла: ближайший подвижный предок (или он сам), иначе корень (-1)
        const dynIdx = new Set(Rig.DYNAMIC_PARTS.map(n => D.byName.get(n)).filter(i => i != null));
        const anchorOf = (i) => { for (let k = i; k >= 0; k = D.nodes[k].parent) if (dynIdx.has(k)) return k; return -1; };
        const anchors = new Map();   // якорь -> Map(материал -> буферы)
        const v = new V();
        D.nodes.forEach((n, i) => {
            if (!n.prims.length || !world[i]) return;
            const a = anchorOf(i);
            const rel = a < 0 ? world[i] : world[i].multiply(world[a].clone().invert());
            const NM = rel.clone().invert().transpose(), mirror = rel.determinant() < 0;
            let groups = anchors.get(a);
            if (!groups) { groups = new Map(); anchors.set(a, groups); }
            for (const pi of n.prims) {
                const p = D.prims[pi], mat = this._matFor(D, p, scene, ov, tag);
                const flat = Rig.isPlain(mat);
                const key = flat ? Rig.plainMaterial(scene, mat.backFaceCulling === false) : mat, tint = flat ? mat.diffuseColor : null;
                let g = groups.get(key);
                if (!g) { g = { pos: [], nrm: [], uv: [], col: [], idx: [], n: 0 }; groups.set(key, g); }
                let nrm = p.nrm;
                if (!nrm) { nrm = new Float32Array(p.pos.length); BABYLON.VertexData.ComputeNormals(p.pos, p.idx, nrm); }
                const vc = p.pos.length / 3;
                for (let k = 0; k < vc; k++) {
                    V.TransformCoordinatesFromFloatsToRef(p.pos[3 * k], p.pos[3 * k + 1], p.pos[3 * k + 2], rel, v);
                    g.pos.push(v.x, v.y, v.z);
                    V.TransformNormalFromFloatsToRef(nrm[3 * k], nrm[3 * k + 1], nrm[3 * k + 2], NM, v); v.normalize();
                    g.nrm.push(v.x, v.y, v.z);
                    if (p.uv) g.uv.push(p.uv[2 * k], p.uv[2 * k + 1]); else g.uv.push(0, 0);
                    const r = p.col ? p.col[4 * k] : 1, gg = p.col ? p.col[4 * k + 1] : 1, b = p.col ? p.col[4 * k + 2] : 1, al = p.col ? p.col[4 * k + 3] : 1;
                    if (tint) g.col.push(r * tint.r, gg * tint.g, b * tint.b, al); else g.col.push(r, gg, b, al);
                }
                for (let t = 0; t + 2 < p.idx.length; t += 3) g.idx.push(g.n + p.idx[t], g.n + p.idx[mirror ? t + 2 : t + 1], g.n + p.idx[mirror ? t + 1 : t + 2]);
                g.n += vc;
            }
        });
        for (const [a, groups] of anchors) {
            const pos = [], nrmA = [], uv = [], col = [], idx = [], subs = [], mats = [];
            let vo = 0;
            for (const [mat, g] of groups) {
                for (const x of g.pos) pos.push(x);
                for (const x of g.nrm) nrmA.push(x);
                for (const x of g.uv) uv.push(x);
                for (const x of g.col) col.push(x);
                const start = idx.length;
                for (const t of g.idx) idx.push(t + vo);
                subs.push({ start, count: idx.length - start }); mats.push(mat);
                vo += g.n;
            }
            if (!vo) continue;
            const name = this.name + (a < 0 ? '_baked' : '_' + D.nodes[a].name);
            const mesh = new BABYLON.Mesh(name, scene);
            const vd = new BABYLON.VertexData();
            vd.positions = pos; vd.normals = nrmA; vd.uvs = uv; vd.colors = col; vd.indices = idx;
            vd.applyToMesh(mesh, false);
            mesh.parent = a < 0 ? this.root : this.nodes[a];
            if (mats.length > 1) {
                const multi = new BABYLON.MultiMaterial(name + '_bm', scene);
                multi.subMaterials = mats;
                mesh.material = multi;
                (this._multis || (this._multis = [])).push(multi);
                mesh.subMeshes = [];
                subs.forEach((sm, i) => new BABYLON.SubMesh(i, 0, vo, sm.start, sm.count, mesh));
            } else mesh.material = mats[0];
            mesh.isPickable = false;
            mesh.receiveShadows = true;
            mesh.metadata = { rigNode: a < 0 ? null : D.nodes[a].name, rigBaked: true };
            if (a < 0) this.meshes.unshift(mesh); else this.meshes.push(mesh);
        }
    }

    // Склеенный меш: вершины в позе покоя в системе корня, у каждой — одна кость (узел, на котором висела часть).
    // Материалы и цвета те же, что у раздельных мешей; спрятанные при создании узлы (hide) в склейку не попадают.
    _buildMerged(D, scene, ov, tag, hide, flat) {
        const V = BABYLON.Vector3, Q = BABYLON.Quaternion;
        const local = (n) => BABYLON.Matrix.Compose(new V(n.S[0], n.S[1], n.S[2]), new Q(n.R[0], n.R[1], n.R[2], n.R[3]), new V(n.T[0], n.T[1], n.T[2]));
        const order = [], seen = new Set();
        const visit = (i) => { if (seen.has(i)) return; seen.add(i); order.push(i); D.nodes[i].children.forEach(visit); };
        D.nodes.forEach((n, i) => { if (n.parent < 0) visit(i); });
        D.nodes.forEach((n, i) => visit(i));
        const hidden = new Set();
        for (const name of hide) { if (D.byName.get(name) != null) for (const k of this.maskOf([name])) hidden.add(k); }
        const sk = this.skeleton = new BABYLON.Skeleton(this.name + '-skel', this.name + '-skel-' + Math.random().toString(36).slice(2, 8), scene);
        const bones = new Array(D.nodes.length), world = new Array(D.nodes.length);
        for (const i of order) {
            const n = D.nodes[i], L = local(n);
            const pb = n.parent >= 0 ? bones[n.parent] : null;
            bones[i] = new BABYLON.Bone(n.name, sk, pb, L);
            bones[i].linkTransformNode(this.nodes[i]);
            world[i] = n.parent >= 0 ? L.multiply(world[n.parent]) : L;
        }
        const groups = new Map();   // материал -> буферы
        const v = new V();
        for (const i of order) {
            if (hidden.has(i)) continue;
            const n = D.nodes[i];
            if (!n.prims.length) continue;
            const W = world[i], NM = W.clone().invert().transpose(), mirror = W.determinant() < 0, bi = bones[i].getIndex();
            for (const pi of n.prims) {
                const p = D.prims[pi], own = this._matFor(D, p, scene, ov, tag);
                // flat: однотонные цвета — в вершины, один общий материал (цвета героя и ботов задаются при создании)
                const toVerts = flat && Rig.isPlain(own), mat = toVerts ? Rig.plainMaterial(scene, own.backFaceCulling === false) : own, tint = toVerts ? own.diffuseColor : null;
                let g = groups.get(mat);
                if (!g) { g = { pos: [], nrm: [], uv: [], col: [], idx: [], mi: [], n: 0 }; groups.set(mat, g); }
                let nrm = p.nrm;
                if (!nrm) { nrm = new Float32Array(p.pos.length); BABYLON.VertexData.ComputeNormals(p.pos, p.idx, nrm); }
                const vc = p.pos.length / 3;
                for (let k = 0; k < vc; k++) {
                    V.TransformCoordinatesFromFloatsToRef(p.pos[3 * k], p.pos[3 * k + 1], p.pos[3 * k + 2], W, v);
                    g.pos.push(v.x, v.y, v.z);
                    V.TransformNormalFromFloatsToRef(nrm[3 * k], nrm[3 * k + 1], nrm[3 * k + 2], NM, v); v.normalize();
                    g.nrm.push(v.x, v.y, v.z);
                    if (p.uv) g.uv.push(p.uv[2 * k], p.uv[2 * k + 1]); else g.uv.push(0, 0);
                    const r = p.col ? p.col[4 * k] : 1, gg = p.col ? p.col[4 * k + 1] : 1, b = p.col ? p.col[4 * k + 2] : 1, al = p.col ? p.col[4 * k + 3] : 1;
                    if (tint) g.col.push(r * tint.r, gg * tint.g, b * tint.b, al); else g.col.push(r, gg, b, al);
                    g.mi.push(bi);
                }
                for (let t = 0; t + 2 < p.idx.length; t += 3) g.idx.push(g.n + p.idx[t], g.n + p.idx[mirror ? t + 2 : t + 1], g.n + p.idx[mirror ? t + 1 : t + 2]);
                g.n += vc;
            }
        }
        if (!groups.size) return;
        let total = 0;
        for (const g of groups.values()) total += g.n;
        const pos = new Float32Array(total * 3), nrmA = new Float32Array(total * 3), uv = new Float32Array(total * 2), col = new Float32Array(total * 4);
        const mi = new Float32Array(total * 4), mw = new Float32Array(total * 4), idx = [], subs = [], mats = [];
        let vo = 0;
        for (const [mat, g] of groups) {
            pos.set(g.pos, vo * 3); nrmA.set(g.nrm, vo * 3); uv.set(g.uv, vo * 2); col.set(g.col, vo * 4);
            for (let k = 0; k < g.n; k++) { mi[(vo + k) * 4] = g.mi[k]; mw[(vo + k) * 4] = 1; }
            const start = idx.length;
            for (const t of g.idx) idx.push(t + vo);
            subs.push({ start, count: idx.length - start }); mats.push(mat);
            vo += g.n;
        }
        const mesh = new BABYLON.Mesh(this.name + '_body', scene);
        const vd = new BABYLON.VertexData();
        vd.positions = pos; vd.normals = nrmA; vd.uvs = uv; vd.colors = col; vd.indices = idx;
        vd.matricesIndices = mi; vd.matricesWeights = mw;
        vd.applyToMesh(mesh, false);
        mesh.parent = this.root;
        mesh.skeleton = sk;
        mesh.numBoneInfluencers = 1;
        if (mats.length > 1) {
            const multi = new BABYLON.MultiMaterial(this.name + '_mm', scene);
            multi.subMaterials = mats;
            mesh.material = multi;
            this._multi = multi;
            mesh.subMeshes = [];
            subs.forEach((sm, i) => new BABYLON.SubMesh(i, 0, vo, sm.start, sm.count, mesh));
        } else mesh.material = mats[0];
        // границы позы покоя с запасом: руки и ноги в анимации выходят за неё, а персонаж не должен пропадать у края кадра
        const bb = mesh.getBoundingInfo(), mn = bb.minimum, mx = bb.maximum, pad = mx.subtract(mn).scale(0.35);
        mesh.setBoundingInfo(new BABYLON.BoundingInfo(mn.subtract(pad), mx.add(pad)));
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        mesh.metadata = { rigNode: null, rigMerged: true };
        this.meshes.push(mesh);
    }

    node(name) { const i = this.data.byName.get(name); return i == null ? null : this.nodes[i]; }
    has(name) { return this.data.anims.has(name); }
    duration(name) { const c = this.data.anims.get(name); return c ? c.duration : 0; }

    // Маска: имена узлов (с потомками) -> Set индексов
    maskOf(names) {
        if (!names) return null;
        const set = new Set();
        const add = (i) => { set.add(i); this.data.nodes[i].children.forEach(add); };
        for (const n of names) { const i = this.data.byName.get(n); if (i != null) add(i); }
        return set;
    }

    // Запуск клипа. opts: { layer, fade, speed, loop, mask: [имена] | Set, restart, hold, onEnd, at (0..1 старт), weight }
    play(name, opts) {
        const o = opts || {};
        const L = this.layers[o.layer || 0];
        const clip = this.data.anims.get(name);
        if (!clip) { if (!Rig._warned) Rig._warned = new Set(); if (!Rig._warned.has(name)) { Rig._warned.add(name); console.warn('Rig: нет анимации «' + name + '» в ' + this.data.url); } return L; }
        const loop = o.loop !== false;
        if (L.cur && L.cur.clip === clip && !o.restart && L.cur.loop === loop) {
            if (o.speed != null) L.cur.speed = o.speed;
            L.target = o.weight != null ? o.weight : 1;
            return L;
        }
        const fade = o.fade == null ? 0.18 : o.fade;
        if (L.cur && fade > 0 && (o.layer || 0) === 0 || (L.cur && fade > 0 && L.weight > 0.05)) { L.prev = L.cur; L.blend = 0; L.blendRate = 1 / Math.max(0.01, fade); }
        else { L.prev = null; L.blend = 1; }
        L.cur = { clip, t: (o.at || 0) * clip.duration, speed: o.speed == null ? 1 : o.speed, loop, hold: !!o.hold };
        L.mask = o.mask instanceof Set ? o.mask : this.maskOf(o.mask);
        L.onEnd = o.onEnd || null;
        L.finished = false;
        L.target = o.weight != null ? o.weight : 1;
        L.rate = 1 / Math.max(0.01, fade);
        L.lastT = L.cur.t; L.passed = null;
        if ((o.layer || 0) > 0 && L.weight < 0.02 && fade > 0) L.weight = 0.001;
        if ((o.layer || 0) === 0) L.weight = 1;
        return L;
    }

    // Снять слой (>0): вес плавно к нулю
    stop(layer, fade) {
        const L = this.layers[layer || 0];
        L.target = 0; L.rate = 1 / Math.max(0.01, fade == null ? 0.15 : fade);
        L.onEnd = null;
    }

    isPlaying(layer, name) {
        const L = this.layers[layer || 0];
        return !!(L.cur && (!name || L.cur.clip.name === name) && !L.finished && L.target > 0);
    }

    current(layer) { const L = this.layers[layer || 0]; return L.cur ? L.cur.clip.name : null; }

    // 0..1 — где клип сейчас
    phase(layer) { const L = this.layers[layer || 0]; return L.cur && L.cur.clip.duration ? L.cur.t / L.cur.clip.duration : 0; }

    // Пересёк ли слой отметку f (0..1) в этом кадре (для событий: удар, шаг)
    crossed(layer, f) {
        const L = this.layers[layer || 0];
        return !!(L.passed && L.passed.has(f));
    }

    // Процедурный поворот узла поверх анимации (радианы, в системе родителя) — на один кадр
    offset(name, rx, ry, rz, px, py, pz) {
        const i = this.data.byName.get(name);
        if (i == null) return;
        let o = this._offsets.get(i);
        if (!o) { o = { q: new BABYLON.Quaternion(), p: new BABYLON.Vector3(), rot: false, pos: false }; this._offsets.set(i, o); }
        if (rx || ry || rz) {
            const q = BABYLON.Quaternion.RotationYawPitchRoll(ry || 0, rx || 0, rz || 0);
            if (o.rot) o.q.multiplyInPlace(q); else { o.q.copyFrom(q); o.rot = true; }
        }
        if (px || py || pz) {
            if (o.pos) { o.p.x += px || 0; o.p.y += py || 0; o.p.z += pz || 0; } else { o.p.set(px || 0, py || 0, pz || 0); o.pos = true; }
        }
    }

    setVisible(name, on) {
        const n = this.node(name);
        if (n) n.setEnabled(!!on);
        if (this._shadowView) this.setShadows(this._shadowView, this._shadowOn);
    }

    attach(boneName, child, offset) {
        const n = this.node(boneName);
        if (!n || !child) return null;
        child.parent = n;
        if (offset) {
            if (offset.pos) child.position.set(offset.pos[0], offset.pos[1], offset.pos[2]);
            if (offset.rot) {
                const D = Math.PI / 180;
                child.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(offset.rot[1] * D, offset.rot[0] * D, offset.rot[2] * D);
            }
            if (offset.scale) child.scaling.setAll(offset.scale);
        }
        return child;
    }

    setShadows(view, on) {
        this._shadowView = view; this._shadowOn = on;
        const rigs = view._shadowRigs || (view._shadowRigs = new Set());
        if (on) rigs.add(this); else rigs.delete(this);
        for (const m of this.meshes) { if (on && Rig.castsShadow(m, view)) view.addShadowCaster(m, false); else view.removeShadowCaster(m); }
    }

    recolor(materialName, override) {
        for (const m of this.materials.get(materialName) || []) Rig.recolor(m, override);
    }

    setEnabled(on) { this.root.setEnabled(!!on); }

    // Кадр
    update(dt) {
        dt = Math.min(0.1, Math.max(0, dt)) * this.speed;
        this.time += dt;
        // 1) продвинуть слои
        for (const L of this.layers) {
            if (L.cur) {
                const c = L.cur, d = c.clip.duration;
                const prevT = c.t;
                c.t += dt * c.speed;
                L.passed = null;
                if (d > 0) {
                    if (c.loop) {
                        if (c.t >= d) c.t -= Math.floor(c.t / d) * d;
                    } else if (c.t >= d) {
                        c.t = d;
                        if (!L.finished) {
                            L.finished = true;
                            if (!c.hold) L.target = 0;
                            if (L.onEnd) { const f = L.onEnd; L.onEnd = null; f(); }
                        }
                    }
                }
                L.lastT = c.t;
                L.prevT = prevT;
            }
            if (L.prev) {
                L.prev.t += dt * L.prev.speed;
                const d = L.prev.clip.duration;
                if (d > 0 && L.prev.t >= d) { if (L.prev.loop) L.prev.t -= Math.floor(L.prev.t / d) * d; else L.prev.t = d; }
            }
            if (L.blend < 1) { L.blend = Math.min(1, L.blend + dt * L.blendRate / Math.max(0.0001, this.speed)); if (L.blend >= 1) L.prev = null; }
            if (L.weight !== L.target) {
                const step = dt * L.rate / Math.max(0.0001, this.speed);
                L.weight = L.weight < L.target ? Math.min(L.target, L.weight + step) : Math.max(L.target, L.weight - step);
            }
        }
        // 2) собрать позу по узлам
        const D = this.data, pose = this._pose, lp = this._lp;
        const active = this.layers.filter((L, i) => L.cur && L.weight > 0.001);
        for (const ni of this._animated) {
            const n = D.nodes[ni];
            pose.t[0] = n.T[0]; pose.t[1] = n.T[1]; pose.t[2] = n.T[2];
            pose.r[0] = n.R[0]; pose.r[1] = n.R[1]; pose.r[2] = n.R[2]; pose.r[3] = n.R[3];
            pose.s[0] = n.S[0]; pose.s[1] = n.S[1]; pose.s[2] = n.S[2];
            for (const L of active) {
                if (L.mask && !L.mask.has(ni)) continue;
                this._sampleLayer(L, ni, lp);
                const w = L.weight;
                if (w >= 0.999) {
                    pose.t[0] = lp.t[0]; pose.t[1] = lp.t[1]; pose.t[2] = lp.t[2];
                    pose.r[0] = lp.r[0]; pose.r[1] = lp.r[1]; pose.r[2] = lp.r[2]; pose.r[3] = lp.r[3];
                    pose.s[0] = lp.s[0]; pose.s[1] = lp.s[1]; pose.s[2] = lp.s[2];
                } else {
                    for (let k = 0; k < 3; k++) { pose.t[k] += (lp.t[k] - pose.t[k]) * w; pose.s[k] += (lp.s[k] - pose.s[k]) * w; }
                    RigInstance.nlerp(pose.r, lp.r, w, pose.r);
                }
            }
            const tn = this.nodes[ni];
            tn.position.set(pose.t[0], pose.t[1], pose.t[2]);
            tn.rotationQuaternion.set(pose.r[0], pose.r[1], pose.r[2], pose.r[3]);
            tn.scaling.set(pose.s[0], pose.s[1], pose.s[2]);
        }
        // 3) процедурные смещения
        if (this._offsets.size) {
            for (const [ni, o] of this._offsets) {
                const tn = this.nodes[ni];
                if (o.rot) { o.q.multiplyToRef(tn.rotationQuaternion, this._q); tn.rotationQuaternion.copyFrom(this._q); o.rot = false; }
                if (o.pos) { tn.position.addInPlace(o.p); o.pos = false; }
            }
        }
    }

    // Поза слоя для узла: смесь cur/prev
    _sampleLayer(L, ni, out) {
        RigInstance.sample(L.cur, ni, this.data, out);
        if (L.prev && L.blend < 1) {
            const t = RigInstance._tmp || (RigInstance._tmp = { t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1] });
            RigInstance.sample(L.prev, ni, this.data, t);
            const b = L.blend, ub = b * b * (3 - 2 * b);
            for (let k = 0; k < 3; k++) { out.t[k] = t.t[k] + (out.t[k] - t.t[k]) * ub; out.s[k] = t.s[k] + (out.s[k] - t.s[k]) * ub; }
            RigInstance.nlerp(t.r, out.r, ub, out.r);
        }
    }

    static sample(pl, ni, data, out) {
        const n = data.nodes[ni], tr = pl.clip.byNode.get(ni), t = pl.t;
        if (!tr) {
            out.t[0] = n.T[0]; out.t[1] = n.T[1]; out.t[2] = n.T[2];
            out.r[0] = n.R[0]; out.r[1] = n.R[1]; out.r[2] = n.R[2]; out.r[3] = n.R[3];
            out.s[0] = n.S[0]; out.s[1] = n.S[1]; out.s[2] = n.S[2];
            return;
        }
        RigInstance.track(tr.t, t, 3, n.T, out.t);
        RigInstance.track(tr.s, t, 3, n.S, out.s);
        if (tr.r) {
            const times = tr.r.times, vals = tr.r.values, len = times.length;
            let i = RigInstance.find(times, t);
            const i2 = Math.min(len - 1, i + 1);
            const a = times[i], b = times[i2], k = b > a ? Math.min(1, Math.max(0, (t - a) / (b - a))) : 0;
            const o1 = i * 4, o2 = i2 * 4;
            let dot = vals[o1] * vals[o2] + vals[o1 + 1] * vals[o2 + 1] + vals[o1 + 2] * vals[o2 + 2] + vals[o1 + 3] * vals[o2 + 3];
            const sgn = dot < 0 ? -1 : 1;
            let x = vals[o1] + (sgn * vals[o2] - vals[o1]) * k, y = vals[o1 + 1] + (sgn * vals[o2 + 1] - vals[o1 + 1]) * k;
            let z = vals[o1 + 2] + (sgn * vals[o2 + 2] - vals[o1 + 2]) * k, w = vals[o1 + 3] + (sgn * vals[o2 + 3] - vals[o1 + 3]) * k;
            const l = Math.hypot(x, y, z, w) || 1;
            out.r[0] = x / l; out.r[1] = y / l; out.r[2] = z / l; out.r[3] = w / l;
        } else { out.r[0] = n.R[0]; out.r[1] = n.R[1]; out.r[2] = n.R[2]; out.r[3] = n.R[3]; }
    }

    static find(times, t) {
        let lo = 0, hi = times.length - 1;
        if (t <= times[0]) return 0;
        if (t >= times[hi]) return hi;
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
        return lo;
    }

    static track(tr, t, n, rest, out) {
        if (!tr) { for (let k = 0; k < n; k++) out[k] = rest[k]; return; }
        const times = tr.times, vals = tr.values, len = times.length;
        const i = RigInstance.find(times, t), i2 = Math.min(len - 1, i + 1);
        const a = times[i], b = times[i2], k = (tr.step || b <= a) ? 0 : Math.min(1, Math.max(0, (t - a) / (b - a)));
        for (let j = 0; j < n; j++) out[j] = vals[i * n + j] + (vals[i2 * n + j] - vals[i * n + j]) * k;
    }

    static nlerp(a, b, w, out) {
        const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
        const s = dot < 0 ? -1 : 1;
        const x = a[0] + (s * b[0] - a[0]) * w, y = a[1] + (s * b[1] - a[1]) * w, z = a[2] + (s * b[2] - a[2]) * w, ww = a[3] + (s * b[3] - a[3]) * w;
        const l = Math.hypot(x, y, z, ww) || 1;
        out[0] = x / l; out[1] = y / l; out[2] = z / l; out[3] = ww / l;
    }

    dispose() {
        if (this._shadowView) this.setShadows(this._shadowView, false);
        for (const m of this.meshes) m.dispose(false, false);
        if (this._multi) { this._multi.dispose(); this._multi = null; }
        if (this._multis) { for (const m of this._multis) m.dispose(); this._multis = null; }
        if (this.skeleton) { this.skeleton.dispose(); this.skeleton = null; }
        for (const n of this.nodes) n.dispose(false, false);
        this.root.dispose(false, false);
        this.meshes = []; this.nodes = [];
    }
}

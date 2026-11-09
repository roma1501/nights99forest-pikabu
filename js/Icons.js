// Icons.js — иконки интерфейса: файл assets/icons/<папка>/<id>.webp; пока файла нет — временная иконка,
// нарисованная кодом (по цветам скина, рюкзака и т.д.). Положишь настоящий WebP с тем же именем — он заменит временную
// без правок кода. Полный список файлов и требования к рисункам — в docs/IMAGE-GEN-PROMPT.md (tools/make-image-prompt.mjs).
// Папки: skins, themes, packs, rarity, ui. Иконки предметов (assets/icons/<модель>.webp) рисует UI.icon.

// Art — индекс нарисованных картинок (assets/art-index.json: иконки и FX-текстуры). Нет файла в индексе — игра не просит его у сервера
// (без 404), а рисует временную иконку / процедурную текстуру. Индекс собирает dev-server на лету, а сборка кладёт в архив.
/** @type {Record<string, any>} */
const Art = {
    set: null, waiters: [],
    has(p) { return !!(this.set && this.set.has(p)); },
    when(fn) { if (this.set) fn(); else this.waiters.push(fn); },
    load() {
        const done = (list) => { this.set = new Set(Array.isArray(list) ? list : []); for (const f of this.waiters.splice(0)) { try { f(); } catch (e) { /* ок */ } } };
        try { fetch('assets/art-index.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])).then(done, () => done([])); } catch (e) { done([]); }
    },
};
Art.load();

/** @type {Record<string, any>} */
const Icons = {
    cache: {},
    // Общие рисованные значки HUD, наград и карты; предметные рисунки переиспользуются.
    glyphs: {
        '🎁': 'ui/gift', '📜': 'ui/journal', '📋': 'ui/journal', '🏆': 'ui/trophy', '👑': 'ui/crown',
        '💀': 'ui/skull', '☠️': 'ui/skull', '🐺': 'ui/wolf', '🐻': 'ui/bear', '🧙': 'ui/cultist',
        '🦖': 'ui/kid_dino', '🐙': 'ui/kid_kraken', '🦑': 'ui/kid_squid', '🐨': 'ui/kid_koala',
        '🧍': 'ui/player', '🤖': 'ui/bot',
        '🔥': 'ui/fire', '📦': 'ui/chest', '🟨': 'ui/chest', '🟫': 'ui/chest', '🛒': 'ui/trader',
        '🩸': 'ui/blood', '❄️': 'ui/cold', '🌙': 'ui/moon', '🌒': 'ui/moon', '🌓': 'ui/moon', '🌔': 'ui/moon',
        '⛈️': 'ui/storm', '⚡': 'ui/storm', '🌫️': 'ui/fog', '☄️': 'ui/meteor', '🗺️': 'ui/treasure', '🐰': 'ui/bunny',
        '🪙': 'ui/coin', '🪓': 'axe_old', '🪵': 'log', '🎣': 'fishing_rod', '🍖': 'steak_cooked',
        '🥕': 'carrot', '⛏️': 'pickaxe', '🧭': 'compass', '💣': 'grenade', '⛑️': 'medkit', '⚒️': 'hammer', '🔧': 'hammer', '🎒': 'packs/pack4',
    },
    glyph(ch) {
        const p = this.glyphs[ch];
        return p && Art.has('icons/' + p + '.webp') ? '<img class="glyphArt" src="assets/icons/' + p + '.webp" alt="" draggable="false">' : ch;
    },
    // Только ведущий значок; локализованная подпись остаётся обычным текстом.
    label(el, text) {
        const value = String(text || '');
        el.textContent = value;
        const ch = Object.keys(this.glyphs).find(k => value.startsWith(k));
        if (ch && Art.has('icons/' + this.glyphs[ch] + '.webp')) {
            el.innerHTML = this.glyph(ch);
            el.appendChild(document.createTextNode(value.slice(ch.length)));
            el.setAttribute('aria-label', value);
        }
    },
    // Линейные значки кнопок и плашек: один рисунок — одна толщина линии, цвет — как у текста (currentColor).
    // Цветные эмодзи и рисованные иконки в кнопках выглядели разнобойно; на кнопке — только такой значок.
    LINE: {
        '💾': '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
        '🎁': '<path d="M4 11h16v9H4zM3 7.5h18V11H3zM12 7.5V20"/><path d="M12 7.5C10.5 4 7 4 7.2 6.2 7.4 7.6 10 7.5 12 7.5zM12 7.5c1.5-3.5 5-3.5 4.8-1.3-.2 1.4-2.8 1.3-4.8 1.3z"/>',
        '📜': '<path d="M6 3h9l4 4v14H6z"/><path d="M14.5 3.5V8H19M9 12h7M9 16h5"/>',
        '📖': '<path d="M3 5.5C6 4.5 9 4.7 12 6.5c3-1.8 6-2 9-1v13c-3-1-6-.8-9 1-3-1.8-6-2-9-1z"/><path d="M12 6.5v13"/>',
        '⚙': '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/>',
        '🎬': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.2l5 2.8-5 2.8z"/>',
        '🏕': '<path d="M2.5 20h19M12 4.5 4 20M12 4.5 20 20M12 11l-2.8 9M12 11l2.8 9"/>',
        '🪙': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.4"/>',
        '🗺': '<path d="M3 6.5 9 4.5l6 2 6-2v13l-6 2-6-2-6 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
        '🧒': '<circle cx="12" cy="7.5" r="3.3"/><path d="M5.5 20.5c0-4 2.9-6.8 6.5-6.8s6.5 2.8 6.5 6.8"/>',
        '🛒': '<path d="M8.5 4 3.5 7l2 4 2.5-1v10h8V10l2.5 1 2-4-5-3c-.8 1.8-2.2 2.7-3.5 2.7S9.3 5.8 8.5 4z"/>',
        '🌙': '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
        '☀': '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
        '🔥': '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.1 0-3.4 2.4-5.4 3.6-8.4.9 1.8 1.9 2.6 2.9 3C12.3 6.8 13.6 4.5 15.6 3c-.2 3.3 3 5.8 3 11.5 0 3.7-2.7 6.5-6.6 6.5z"/><path d="M12 21c-1.7 0-2.8-1.2-2.8-2.8 0-1.8 1.6-2.6 2.2-4.2 1.4 1.1 3.4 2.2 3.4 4.2 0 1.6-1.1 2.8-2.8 2.8z"/>',
        '❤': '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z"/>',
        '💀': '<path d="M12 3.5c-4.4 0-7.5 3-7.5 7 0 2.4 1.1 4 2.8 5v3h9.4v-3c1.7-1 2.8-2.6 2.8-5 0-4-3.1-7-7.5-7z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10.5 18.5v2M13.5 18.5v2"/>',
        '🛡': '<path d="M12 3 5 5.8v5.4c0 4.6 3 7.9 7 9.8 4-1.9 7-5.2 7-9.8V5.8z"/>',
    },
    // Подпись кнопки или плашки: ведущий эмодзи -> линейный значок (<i class="li">) + текст; незнакомый эмодзи убирается
    btnLabel(el, text) {
        const value = String(text || '');
        const m = /^(\p{Extended_Pictographic})️?\s*/u.exec(value);
        if (!m) { el.textContent = value; return; }
        const rest = value.slice(m[0].length), path = this.LINE[m[1]];
        el.textContent = '';
        if (path) {
            const kind = { '🪙': ' coin', '❤': ' heart', '🔥': ' fire', '💀': ' skull' }[m[1]] || '';
            el.insertAdjacentHTML('afterbegin', '<svg class="li' + kind + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>');
        }
        el.appendChild(document.createTextNode(rest));
        el.setAttribute('aria-label', rest);
    },
    markerImages: {},
    drawGlyph(g, ch, x, y, size) {
        const p = this.glyphs[ch];
        if (p && Art.has('icons/' + p + '.webp')) {
            let im = this.markerImages[p];
            if (!im) { im = this.markerImages[p] = new Image(); im.src = 'assets/icons/' + p + '.webp'; }
            if (im.complete && im.naturalWidth) { g.drawImage(im, x - size / 2, y - size / 2, size, size); return; }
        }
        g.fillText(ch, x, y);
    },

    // HTML-строка <img>: нет файла — подставляется временная иконка
    html(kind, id, cls) {
        const have = Art.has('icons/' + kind + '/' + id + '.webp');
        return '<img class="art ' + (cls || '') + '" src="' + (have ? 'assets/icons/' + kind + '/' + id + '.webp' : this.temp(kind, id)) + '" alt="" draggable="false">';
    },
    // Элемент <img>
    img(kind, id, cls) {
        const im = document.createElement('img');
        im.className = 'art ' + (cls || ''); im.alt = ''; im.draggable = false;
        im.onerror = () => { im.onerror = null; im.src = Icons.temp(kind, id); };
        im.src = Art.has('icons/' + kind + '/' + id + '.webp') ? 'assets/icons/' + kind + '/' + id + '.webp' : this.temp(kind, id);
        return im;
    },

    // Временная иконка (data URL 128×128)
    temp(kind, id) {
        const key = kind + '/' + id;
        if (this.cache[key]) return this.cache[key];
        let url = '';
        try {
            const c = document.createElement('canvas'); c.width = c.height = 128;
            const g = c.getContext('2d');
            if (g) {
                const fn = this.draw[kind];
                if (fn) fn.call(this, g, id);
                url = c.toDataURL('image/png');
            }
        } catch (e) { /* без холста — пустая картинка */ }
        this.cache[key] = url;
        return url;
    },

    rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },
    box(g, x, y, w, h, fill, r) { g.fillStyle = fill; this.rr(g, x, y, w, h, r == null ? 4 : r); g.fill(); g.lineWidth = 3; g.strokeStyle = '#000'; g.stroke(); },
    tri(g, pts, fill) { g.fillStyle = fill; g.beginPath(); g.moveTo(pts[0], pts[1]); g.lineTo(pts[2], pts[3]); g.lineTo(pts[4], pts[5]); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = '#000'; g.lineJoin = 'round'; g.stroke(); },
    shade(hex, k) {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || '#888888'); const n = parseInt(m ? m[1] : '888888', 16);
        const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
        return 'rgb(' + f(n >> 16 & 255) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')';
    },
    tile(g, color, frame) {
        const gr = g.createLinearGradient(0, 0, 0, 128);
        gr.addColorStop(0, this.shade(color, 0.55)); gr.addColorStop(1, this.shade(color, 0.22));
        g.fillStyle = gr; this.rr(g, 3, 3, 122, 122, 16); g.fill();
        g.lineWidth = 6; g.strokeStyle = frame || '#000'; g.stroke();
        g.lineWidth = 2; g.strokeStyle = '#000'; this.rr(g, 0.5, 0.5, 127, 127, 18); g.stroke();
    },

    draw: {
        // ---- скины: бюст героя в цветах скина + аксессуары
        skins(g, id) {
            const S = SKINS.byId[id] || SKINS.default;
            const th = SKINS.themes.find(t => t.id === S.theme);
            const R = SKINS.rarity[S.rarity] || SKINS.rarity.common;
            const o = Player.outfit || {};
            const c = S.colors || { hair: o.hairColor || '#4a3020', shirt: o.shirt || '#3a6ab0', jacket: o.jacket || '#2f8a4a', pants: o.pants || '#3a3a48', skin: o.skin || '#e0ac82', accA: '#ffffff', accB: '#cccccc', accC: '#888888' };
            const skin = c.skin || o.skin || '#e0ac82';
            this.tile(g, th ? th.color : '#4ade6a', R.color);
            const acc = S.acc || [], has = (re) => acc.some(a => re.test(a));
            // за спиной: плащ, крылья, хвост, рюкзак
            if (has(/^wings_bat/)) { this.tri(g, [30, 80, 6, 34, 46, 62], c.accA); this.tri(g, [98, 80, 122, 34, 82, 62], c.accA); }
            if (has(/^wings_angel|wings_fairy/)) { this.tri(g, [32, 84, 4, 40, 50, 66], c.accA); this.tri(g, [96, 84, 124, 40, 78, 66], c.accA); }
            if (has(/^cape/)) this.box(g, 22, 76, 84, 52, c.accA, 6);
            if (has(/^jetpack/)) { this.box(g, 22, 82, 14, 40, c.accC, 4); this.box(g, 92, 82, 14, 40, c.accC, 4); }
            if (has(/^backpack|quiver/)) this.box(g, 82, 84, 28, 36, c.accC, 6);
            // тело
            this.box(g, 28, 84, 72, 44, c.jacket, 8);
            this.box(g, 52, 84, 24, 44, c.shirt, 2);
            if (has(/^belt/)) this.box(g, 28, 112, 72, 8, c.accB, 2);
            if (has(/^scarf|vampire_collar/)) this.box(g, 38, 78, 52, 12, c.accA, 5);
            // шея и голова
            this.box(g, 54, 72, 20, 14, skin, 3);
            this.box(g, 38, 28, 52, 50, skin, 8);
            // причёска
            const hs = S.hairStyle === undefined ? o.hair : S.hairStyle;
            if (hs && !has(/helmet|helm$|pumpkin_head|hood|ghost_sheet/)) {
                this.box(g, 36, 22, 56, 18, c.hair, 6);
                if (/pony/.test(hs)) this.box(g, 86, 34, 14, 34, c.hair, 6);
                else if (/bacon/.test(hs)) { this.box(g, 34, 28, 10, 26, c.hair, 4); this.box(g, 84, 28, 10, 26, c.hair, 4); }
            }
            // лицо
            if (!has(/pumpkin_head|skull_mask|ninja_mask|ghost_sheet|astro_helmet|robot_visor/)) {
                g.fillStyle = '#111'; g.fillRect(49, 50, 8, 10); g.fillRect(71, 50, 8, 10);
                g.fillRect(56, 66, 16, 3);
            }
            // надетое на голову
            if (has(/^ranger_hat/)) { this.box(g, 26, 26, 76, 8, c.accA, 3); this.box(g, 40, 10, 48, 20, c.accA, 5); this.box(g, 40, 24, 48, 6, c.accB, 2); }
            if (has(/^beanie/)) { this.box(g, 36, 12, 56, 26, c.accA, 10); this.box(g, 36, 30, 56, 7, c.accB, 2); this.box(g, 58, 4, 12, 10, c.accB, 5); }
            if (has(/^cap$/)) { this.box(g, 36, 16, 56, 20, c.accA, 8); this.box(g, 70, 30, 40, 7, c.accB, 3); }
            if (has(/^wizard_hat|witch_hat/)) { this.box(g, 22, 28, 84, 8, c.accA, 3); this.tri(g, [38, 28, 90, 28, 64, -2], c.accA); this.box(g, 40, 22, 48, 6, c.accB, 2); }
            if (has(/^santa_hat/)) { this.box(g, 34, 14, 60, 22, c.accA, 8); this.box(g, 32, 28, 64, 9, c.accB, 4); this.box(g, 86, 10, 14, 14, c.accB, 7); }
            if (has(/^crown|leaf_crown|star_crown|elf_circlet/)) { this.box(g, 36, 16, 56, 12, c.accA, 2); this.tri(g, [38, 16, 46, 2, 54, 16], c.accA); this.tri(g, [56, 16, 64, 0, 72, 16], c.accA); this.tri(g, [74, 16, 82, 2, 90, 16], c.accA); }
            if (has(/^halo/)) { g.strokeStyle = '#000'; g.lineWidth = 11; g.beginPath(); g.ellipse(64, 14, 28, 8, 0, 0, 7); g.stroke(); g.strokeStyle = c.accA; g.lineWidth = 6; g.beginPath(); g.ellipse(64, 14, 28, 8, 0, 0, 7); g.stroke(); }
            if (has(/knight_helm|^retro_helmet/)) { this.box(g, 32, 20, 64, 44, c.accA, 12); this.box(g, 44, 42, 40, 8, '#111', 2); }
            if (has(/^astro_helmet/)) { this.box(g, 26, 16, 76, 62, '#cfe8ff', 26); this.box(g, 38, 30, 52, 34, skin, 14); g.fillStyle = '#111'; g.fillRect(50, 44, 7, 9); g.fillRect(71, 44, 7, 9); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(46, 34, 14, 6); }
            if (has(/^pumpkin_head/)) { this.box(g, 30, 18, 68, 60, '#ff7a1a', 22); g.fillStyle = '#2b1c14'; g.fillRect(46, 40, 10, 12); g.fillRect(72, 40, 10, 12); g.fillRect(50, 62, 28, 6); this.box(g, 58, 8, 12, 12, '#3a8a3a', 3); }
            if (has(/^skull_mask/)) { this.box(g, 38, 30, 52, 44, '#e8e0c8', 10); g.fillStyle = '#15161a'; g.fillRect(46, 46, 12, 12); g.fillRect(70, 46, 12, 12); g.fillRect(52, 64, 24, 5); }
            if (has(/^ninja_mask/)) { this.box(g, 36, 26, 56, 18, c.accB, 6); this.box(g, 36, 56, 56, 22, c.accB, 6); g.fillStyle = c.accA; g.fillRect(40, 48, 48, 4); }
            if (has(/^hood$/)) { this.box(g, 28, 14, 72, 64, c.accA, 22); this.box(g, 42, 34, 44, 38, skin, 8); g.fillStyle = '#111'; g.fillRect(50, 48, 7, 9); g.fillRect(71, 48, 7, 9); }
            if (has(/^ghost_sheet/)) { this.box(g, 26, 14, 76, 100, '#f4f4f8', 30); g.fillStyle = '#15161a'; g.fillRect(46, 48, 12, 16); g.fillRect(70, 48, 12, 16); }
            if (has(/^headphones/)) { this.box(g, 34, 10, 60, 8, c.accC, 4); this.box(g, 28, 44, 14, 24, c.accA, 5); this.box(g, 86, 44, 14, 24, c.accB, 5); }
            if (has(/^goggles|neon_visor/)) this.box(g, 36, 44, 56, 18, c.accA, 6);
            if (has(/^robot_visor/)) { this.box(g, 34, 30, 60, 46, c.accB, 8); this.box(g, 40, 44, 48, 14, c.accA, 4); }
            if (has(/^mohawk/)) { this.box(g, 56, 4, 16, 26, c.accA, 3); this.tri(g, [52, 10, 64, -6, 76, 10], c.accA); }
            if (has(/^antennae/)) { this.box(g, 44, 4, 5, 26, c.accC, 2); this.box(g, 80, 4, 5, 26, c.accC, 2); this.box(g, 39, 0, 14, 12, c.accA, 6); this.box(g, 75, 0, 14, 12, c.accA, 6); }
            if (has(/^antlers/)) { this.box(g, 36, 2, 7, 28, c.accA, 2); this.box(g, 85, 2, 7, 28, c.accA, 2); this.box(g, 26, 6, 14, 6, c.accA, 2); this.box(g, 88, 6, 14, 6, c.accA, 2); }
            if (has(/horns$/)) { this.tri(g, [38, 28, 48, 0, 54, 26], c.accA); this.tri(g, [90, 28, 80, 0, 74, 26], c.accA); }
            if (has(/_ears$|^bunny_ears/)) { const tall = has(/bunny/); this.tri(g, [38, 28, 46, tall ? -10 : 4, 58, 26], c.accA); this.tri(g, [90, 28, 82, tall ? -10 : 4, 70, 26], c.accA); }
            if (has(/^mushroom_cap/)) { this.box(g, 20, 6, 88, 30, c.accA, 16); g.fillStyle = c.accB; for (const [x, y] of [[36, 16], [60, 12], [84, 18]]) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); } }
            if (has(/^sword_back/)) { this.box(g, 92, 50, 8, 72, c.accA, 2); this.box(g, 86, 86, 20, 6, c.accC, 2); }
            if (has(/^tail_/)) this.box(g, 92, 100, 28, 12, c.accA, 6);
        },

        themes(g, id) {
            const t = SKINS.themes.find(q => q.id === id) || SKINS.themes[0];
            this.tile(g, t.color, t.color);
            g.font = '72px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(t.icon, 64, 70);
        },

        // ---- рюкзаки: силуэт, цвет и число карманов растут с уровнем
        packs(g, id) {
            const i = Math.max(0, DATA.packs.findIndex(p => p.id === id)), P = DATA.packs[i] || DATA.packs[0];
            const R = SKINS.rarity[P.rarity] || SKINS.rarity.common;
            this.tile(g, P.color, R.color);
            const col = P.color, dark = this.shade(col, 0.68), light = this.shade(col, 1.25);
            // лямки
            this.box(g, 34, 62, 10, 52, '#2a2a30', 4); this.box(g, 84, 62, 10, 52, '#2a2a30', 4);
            // боковые карманы
            const side = Math.min(2, Math.floor(i / 2));
            if (side >= 1) { this.box(g, 14, 76, 18, 36, dark, 6); this.box(g, 96, 76, 18, 36, dark, 6); }
            if (side >= 2) { this.box(g, 10, 52, 14, 18, dark, 5); this.box(g, 104, 52, 14, 18, dark, 5); }
            // корпус, клапан, передний карман
            this.box(g, 26, 38, 76, 76, col, 16);
            this.box(g, 26, 28, 76, 34, light, 16);
            this.box(g, 38, 76, 52, 30, dark, 8);
            this.box(g, 58, 56, 12, 16, '#f2d16a', 3);
            // ручка и рулон
            this.box(g, 52, 16, 24, 12, '#2a2a30', 6);
            if (i >= 3) this.box(g, 22, 110, 84, 12, '#d8d8e0', 6);
            if (i >= 5) { g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '22px sans-serif'; g.textAlign = 'center'; g.fillText('✦', 106, 34); g.fillText('✦', 22, 50); }
            // число слотов
            g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.lineWidth = 6; g.strokeStyle = '#000'; g.strokeText('' + P.slots, 64, 94); g.fillStyle = '#fff'; g.fillText('' + P.slots, 64, 94);
        },

        rarity(g, id) {
            const R = SKINS.rarity[id] || SKINS.rarity.common;
            g.fillStyle = R.color; g.strokeStyle = '#000'; g.lineWidth = 6;
            g.beginPath(); g.moveTo(64, 10); g.lineTo(112, 48); g.lineTo(92, 112); g.lineTo(36, 112); g.lineTo(16, 48); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(64, 10); g.lineTo(112, 48); g.lineTo(64, 60); g.lineTo(16, 48); g.closePath(); g.fill();
        },

        ui(g, id) {
            g.textAlign = 'center'; g.textBaseline = 'middle';
            if (id === 'coin') {
                const gr = g.createRadialGradient(50, 46, 6, 64, 64, 54); gr.addColorStop(0, '#fff2a8'); gr.addColorStop(0.55, '#ffc21a'); gr.addColorStop(1, '#c98a00');
                g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.fill(); g.lineWidth = 7; g.strokeStyle = '#000'; g.stroke();
                g.lineWidth = 4; g.strokeStyle = '#a86a00'; g.beginPath(); g.arc(64, 64, 38, 0, 7); g.stroke();
                g.font = 'bold 54px sans-serif'; g.fillStyle = '#7a4a00'; g.fillText('$', 64, 68);
            } else if (id === 'ad') {
                this.box(g, 10, 24, 108, 80, '#2f7fd8', 16); this.tri(g, [50, 42, 50, 86, 88, 64], '#fff');
            } else if (id === 'heart') {
                g.fillStyle = '#ff3b4f'; g.strokeStyle = '#000'; g.lineWidth = 7; g.lineJoin = 'round';
                g.beginPath(); g.moveTo(64, 112); g.bezierCurveTo(-10, 60, 20, 6, 64, 38); g.bezierCurveTo(108, 6, 138, 60, 64, 112); g.closePath(); g.fill(); g.stroke();
            } else { g.font = '70px sans-serif'; g.fillText('❓', 64, 70); }
        },
    },
};

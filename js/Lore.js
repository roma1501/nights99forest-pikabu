// Lore.js — записки в лесу: 16 находок рассказывают историю леса, ордена и Хозяина. Записка лежит у своего места интереса
// (появляется вместе с ним при открытии кольца), читается по E, приносит немного монет и остаётся в журнале навсегда.
// Журнал — общий для всех партий (Store, GAME_ID.lore); найденное в текущей партии — runFound (идёт в сохранение).

/** @type {Record<string, any>} */
const Lore = {
    spots: [],            // { id, x, z, mesh, mark, t }
    runFound: new Set(),  // найдено в этой партии
    seen: {},             // найдено когда-либо (журнал)
    _tex: null, _mat: null, _t: 0,

    NOTES: [
        { id: 'n01', site: 'poi-cabin', name: ['Дневник лесника', "The Ranger's Diary"],
          ru: 'Меня зовут Эрик, я лесник на посту Старой Сосны. В лес пришёл туман, а вместе с ним — странный свет в чаще. Дети из деревни пропали на закате. Беру фонарь и топор: завтра иду искать.',
          en: 'My name is Eric. I am the ranger at the Old Pine post. Fog rolled into the forest, and with it a strange light deep in the trees. The village children vanished at dusk. Tomorrow I will take my lantern and axe and go looking for them.' },
        { id: 'n02', site: 'poi-campsite', name: ['Записка туристов', 'Hikers\' Note'],
          ru: 'Оставили палатки у тропы. Ночью слышали рычание и детский плач. Утром остались только следы. Уходим к лагерю у костра — там безопаснее. Если найдёшь это письмо: не ходи по лесу ночью.',
          en: 'We left our tents by the trail. At night we heard growling and a child crying. By morning there were only tracks. We are heading to the camp by the fire — it is safer there. If you find this letter: do not walk through the forest at night.' },
        { id: 'n03', site: 'poi-sawmill', name: ['Бригадир лесопилки', 'Sawmill Foreman'],
          ru: 'Станок встал, когда в лесу зазвонил колокол. Рабочие пошли на звук и не вернулись. Дрова оставил у ограды — берите. Огонь держит зверей на расстоянии.',
          en: 'The saw stopped when a bell rang in the woods. The workers followed the sound and never came back. I left firewood by the fence — take it. Fire keeps the beasts at a distance.' },
        { id: 'n04', site: 'poi-ruins', name: ['Камень с надписью', 'Inscribed Stone'],
          ru: 'Здесь стоял храм Хозяина леса. Он хранил чащу, пока люди приносили ему свет. Когда свет угас, Хозяин озлобился. Лишь девяносто девять ночей огня вернут ему покой.',
          en: 'A temple of the Forest Warden stood here. He guarded the thicket while people brought him light. When the light went out, the Warden grew bitter. Only ninety-nine nights of fire can give him peace.' },
        { id: 'n05', site: 'poi-watchtower', name: ['Журнал вышки', 'Watchtower Log'],
          ru: 'День 41. Костры в чаще гаснут один за другим. Видел фигуры в красных мантиях у обелиска — они зажигают чёрный огонь. Если костёр в лагере погаснет, зверям станет проще войти.',
          en: 'Day 41. Campfires deep in the woods go out one after another. I saw figures in red robes at the obelisk lighting a black fire. If the campfire dies, the beasts will be able to enter the camp.' },
        { id: 'n06', site: 'poi-graveyard', name: ['Надпись на плите', 'Slab Inscription'],
          ru: 'Здесь лежат те, кто решил пережить ночь без огня. Не повторяй. Призраки не любят света, но призраки — лишь эхо. Настоящая угроза ждёт впереди.',
          en: 'Here lie those who tried to outlast the night without a fire. Do not make the same mistake. Ghosts hate the light, but ghosts are only echoes. The real threat waits ahead.' },
        { id: 'n07', site: 'poi-mine', name: ['Записка шахтёра', "Miner's Note"],
          ru: 'В глубине жилы светятся изумрудным. Кирка берёт их неохотно, будто камень живой. Дальше спускаться нельзя: внизу что-то ворочается. Самоцветы того не стоят.',
          en: 'Deep in the vein the stones glow emerald. The pick bites reluctantly, as if the rock were alive. Do not go deeper: something stirs below. The gems are not worth it.' },
        { id: 'n08', site: 'poi-obelisk', name: ['Тайна обелиска', 'Secret of the Obelisk'],
          ru: 'Четыре тотема окружают камень: красный, синий, зелёный, жёлтый. Ключи от клеток открывают путь к детям. Но сам обелиск откликается только на костёр пятого уровня.',
          en: 'Four totems surround the stone: red, blue, green, yellow. The keys to the cages open the way to the children. But the obelisk itself answers only to a level-five fire.' },
        { id: 'n09', site: 'den-wolf', name: ['Следы стаи', 'Pack Tracks'],
          ru: 'Логово принадлежит вожаку с красным ошейником. Ошейник не его — кто-то надел его нарочно. Ключ от клетки у вожака. Бери осторожно: волки прикрывают друг друга.',
          en: 'This den belongs to a leader with a red collar. The collar is not his own — someone put it on him on purpose. He carries the cage key. Be careful: the wolves cover each other.' },
        { id: 'n10', site: 'den-alpha', name: ['Синий ошейник', 'Blue Collar'],
          ru: 'Альфа крупнее обычных волков. Глаза горят красным, как у существ из чащи. Его не родили злым — его сделали таким. Ключ у него, синий. Береги спину: стая нападает со всех сторон.',
          en: 'The alpha is bigger than any wolf. His eyes burn red like the creatures of the thicket. He was not born cruel — he was made so. He carries the blue key. Watch your back: the pack attacks from all sides.' },
        { id: 'n11', site: 'cave-bear', name: ['Пещера медведей', 'Bear Cave'],
          ru: 'Медведица охраняет зелёный ключ. Она не трогает тех, кто не переступает границу. Но дети пропадали рядом, значит, кто-то провёл их через её землю.',
          en: 'The mother bear guards the green key. She leaves you alone if you stay outside her territory. But children vanished nearby, so someone led them across her land.' },
        { id: 'n12', site: 'poi-cultist', name: ['Орден Чёрного Огня', 'Order of the Black Fire'],
          ru: 'Мы служим тому, что спит под обелиском. Дети — плата за девяносто девять ночей без костра. Когда придёт последняя ночь, Хозяин проснётся и заберёт лес. Огонь — наш враг.',
          en: 'We serve what sleeps under the obelisk. The children are the price for ninety-nine nights without a campfire. When the last night comes, the Warden will wake and take the forest. Fire is our enemy.' },
        { id: 'n13', site: 'poi-well', name: ['У колодца', 'By the Well'],
          ru: 'Вода здесь особенная: после глотка силы возвращаются. Но колодец отдаёт не больше раза в день. Говорят, это слёзы лесного духа.',
          en: 'The water here is special: one sip and your strength returns. But you can drink from the well only once a day. They say it holds the tears of the forest spirit.' },
        { id: 'n14', site: 'poi-pond', name: ['Рыбак', 'The Angler'],
          ru: 'В пруду клюёт и днём и ночью. Однажды вытащил рыбину с блестящими глазами. Отпустил — она улыбнулась. С тех пор рыбачу молча.',
          en: 'The fish bite here day and night. Once I pulled out a fish with shining eyes. I let it go — it smiled. Since then, I have fished in silence.' },
        { id: 'n15', site: 'poi-carrots', name: ['Огородник', 'The Gardener'],
          ru: 'Морковь растёт каждый день, будто ночь ей не нужна. Подкармливаю землю золой из костра. Эти грядки — всё, что осталось от моей деревни.',
          en: 'The carrots grow every single day, as if they do not need the night. I feed the soil with campfire ash. These beds are all that is left of my village.' },
        { id: 'n16', site: 'kid-dino', name: ['Детский рисунок', "A Child's Drawing"],
          ru: 'Нарисованы четверо ребят у костра: динозаврик, кракен, кальмар и коала. Подпись кривыми буквами: «Мы ждём героя с огнём. Он обязательно придёт».',
          en: 'Four kids are drawn around a campfire: a dinosaur, a kraken, a squid and a koala. The crooked caption reads: "We are waiting for a hero with fire. He will surely come."' },
    ],

    viewed: {},   // что уже открывали в журнале (для красной точки «новая записка»)
    init() {
        try { this.seen = Store.getJSON(GAME_ID + '.lore', {}) || {}; } catch (e) { this.seen = {}; }
        try { this.viewed = Store.getJSON(GAME_ID + '.loreV', {}) || {}; } catch (e) { this.viewed = {}; }
        this.register();
    },
    countAll() { return this.NOTES.filter(n => this.seen[n.id]).length; },
    unread() { return this.NOTES.filter(n => this.seen[n.id] && !this.viewed[n.id]).length; },
    markViewed(id) { if (!this.seen[id] || this.viewed[id]) return; this.viewed[id] = 1; Store.set(GAME_ID + '.loreV', JSON.stringify(this.viewed)); },
    noteById(id) { return this.NOTES.find(n => n.id === id); },

    // ---- общая процедурная текстура листка
    _paper(scene) {
        if (this._mat) return this._mat;
        const tex = new BABYLON.DynamicTexture('noteTex', { width: 128, height: 160 }, scene, false);
        const g = tex.getContext();
        g.fillStyle = '#f3e7c4'; g.fillRect(0, 0, 128, 160);
        g.strokeStyle = '#a58a54'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 154);
        g.fillStyle = '#6b5530';
        for (let i = 0; i < 9; i++) g.fillRect(16, 26 + i * 14, i === 8 ? 52 : 96, 4);
        g.fillStyle = '#b02a2a'; g.beginPath(); g.arc(98, 134, 11, 0, 7); g.fill();
        tex.update();
        const m = new BABYLON.StandardMaterial('noteMat', scene);
        m.diffuseTexture = tex; m.emissiveTexture = tex; m.emissiveColor = new BABYLON.Color3(0.55, 0.5, 0.35); m.specularColor = new BABYLON.Color3(0, 0, 0);
        m.backFaceCulling = false; m.metadata = { toon: false };
        this._mat = m;
        return m;
    },

    // ---- вызывается из Zones.buildSite: положить записку у места, если она ещё не найдена в этой партии
    onSite(s, x, z) {
        const note = this.NOTES.find(n => n.site === s.name);
        if (!note || this.runFound.has(note.id) || this.spots.some(p => p.id === note.id)) return;
        const f = World.fpFind(x + 170, z + 120, 50, { maxR: LORE_SEARCH_RADIUS });
        if (!f) {
            if (!this._pending) this._pending = [];
            if (!this._pending.some(p => p.s.name === s.name)) this._pending.push({ s, x, z });
            return;
        }
        const px = f.x, pz = f.z;
        const scene = Zones.scene || (Camp && Camp.scene);
        if (!scene) return;
        // Raise the paper above the highest footprint corner on gentle terrain.
        const y = Math.max(World.heightAt(px, pz), ...[-35, 35].flatMap(dx => [-35, 35].map(dz => World.heightAt(px + dx, pz + dz))));
        const mesh = BABYLON.MeshBuilder.CreateGround('note_' + note.id, { width: 40, height: 52 }, scene);
        mesh.material = this._paper(scene); mesh.isPickable = false; mesh.receiveShadows = false;
        mesh.position.set(px, y + 7, pz); mesh.rotation.y = (px * 0.013 + pz * 0.007) % 6.28;
        // метка над запиской: золотой ромб, покачивается
        const mark = BABYLON.MeshBuilder.CreatePolyhedron('noteMark_' + note.id, { type: 1, size: 14 }, scene);
        const mm = new BABYLON.StandardMaterial('noteMarkMat_' + note.id, scene);
        mm.diffuseColor = new BABYLON.Color3(0, 0, 0); mm.emissiveColor = new BABYLON.Color3(1, 0.82, 0.25); mm.disableLighting = true; mm.metadata = { toon: false, mist: false };
        mark.material = mm; mark.isPickable = false; mark.position.set(px, y + 95, pz);
        World.fpAdd(px, pz, 45, 'zone');
        this.spots.push({ id: note.id, x: px, z: pz, y, mesh, mark, mm, t: Math.random() * 6 });
    },
    clear() {
        for (const p of this.spots) { try { p.mesh.dispose(); p.mark.dispose(); p.mm.dispose(); } catch (e) { /* уже убрано */ } }
        this.spots = [];
        this._pending = []; this._retry = 0;
    },
    // Новая партия: сбросить найденное в партии и убрать записки с карты
    reset() { this.clear(); this.runFound = new Set(); },
    setFound(list) {
        this.runFound = new Set((Array.isArray(list) ? list : []).filter(id => this.noteById(id)));
        let changed = false;
        for (const id of this.runFound) if (!this.seen[id]) { this.seen[id] = Date.now(); changed = true; }
        if (changed) Store.set(GAME_ID + '.lore', JSON.stringify(this.seen));
    },

    update(dt) {
        this._retry = (this._retry || 0) - dt;
        if (this._retry <= 0 && this._pending && this._pending.length) {
            this._retry = LORE_RETRY_INTERVAL;
            const pending = this._pending; this._pending = [];
            for (const p of pending) this.onSite(p.s, p.x, p.z);
        }
        if (!this.spots.length) return;
        this._t += dt;
        for (const p of this.spots) {
            const d2 = U.dist2(p.x, p.z, Player.x, Player.z);
            const near = d2 < 6000 * 6000;
            p.mark.setEnabled(near); p.mesh.setEnabled(d2 < 9000 * 9000);
            if (d2 < 1300 * 1300 && window.Quests) Quests.tipOnce('lore', 'Нашёл записку! Подойди и нажми E — записки рассказывают тайну леса. Журнал открывается клавишей N или кнопкой 📜.', 'You found a note! Walk up and press E to read it. Open your journal with N or the 📜 button.');
            if (!near) continue;
            p.t += dt;
            p.mark.position.y = p.y + 95 + Math.sin(p.t * 2.2) * 8;
            p.mark.rotation.y += dt * 1.6;
        }
    },

    // ---- чтение
    // by — имя напарника, если записку нашёл он: окно не открывается, приходит карточка «записка найдена» и красная точка на кнопке 📜
    read(id, by) {
        const n = this.noteById(id); if (!n) return;
        const first = !this.seen[id];
        this.seen[id] = Date.now(); this.runFound.add(id);
        Store.set(GAME_ID + '.lore', JSON.stringify(this.seen));
        const i = this.spots.findIndex(p => p.id === id);
        if (i >= 0) { const p = this.spots[i]; this.spots.splice(i, 1); try { FX.pickup(p.x, p.y + 60, p.z); p.mesh.dispose(); p.mark.dispose(); p.mm.dispose(); } catch (e) { /* ок */ } }
        if (first) { Econ.dropCoins(Player.x, Player.z, 15, 'lore'); }
        if (window.Quests) Quests.event('lore', 1);   // Quests.event пересылает событие в Ach
        if (window.Game) Game.autosave('lore');
        if (by) {
            if (window.UiFX) UiFX.noteCard(n, by); else UI.toast(Lang.t('lore.botFound', { n: by }), 'good');
            if (window.Sfx) Sfx.ui('page');
        } else { this.markViewed(id); UIPanels.open('journal', { id }); }
    },

    register() {
        const self = this;
        Interact.providers.push((consider) => {
            for (const p of self.spots) {
                if (!p._e) p._e = { x: p.x, z: p.z, r: 2.4 * M, h: 110, prio: 1, text: () => Lang.t('p.note'), sub: () => Lang.t('p.noteSub'), act: () => self.read(p.id) };
                consider(p._e);
            }
        });
    },
};

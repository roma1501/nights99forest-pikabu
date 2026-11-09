// Ach.js — причины возвращаться: достижения, ежедневная награда (серия из 7 дней), ежедневные задания и счётчики прогресса.
// Всё хранится отдельно от партии (Store, ключ GAME_ID.ach): достижения и серия переживают новые забеги и «сброс по смерти».
// События приходят из игры через Ach.event(имя, n) — его зовёт Quests.event, поэтому все счётчики совпадают с заданиями.

/** @type {Record<string, any>} */
const Ach = {
    data: { c: {}, modes: { normal: {}, hardcore: {} }, done: {}, daily: null, dr: { last: '', streak: 0, took: 0, dbl: '' } },
    _t: 0, _inited: false,

    // ------------------------------------------------------------------------------ каталог достижений
    // c — счётчик событий (сумма), max — берётся максимум; fn — произвольная проверка -> [текущее, цель]
    DEFS: [
        { id: 'night1', icon: '🌙', c: 'day', n: 1, coins: 30, name: ['Первая ночь', 'First Night'], desc: ['Переживи первую ночь', 'Survive your first night'] },
        { id: 'night10', icon: '🌒', c: 'day', n: 10, coins: 80, name: ['Десять ночей', 'Ten Nights'], desc: ['Переживи 10 ночей суммарно', 'Survive 10 nights in total'] },
        { id: 'night30', icon: '🌓', c: 'day', n: 30, coins: 200, name: ['Месяц в лесу', 'A Month in the Woods'], desc: ['Переживи 30 ночей суммарно', 'Survive 30 nights in total'] },
        { id: 'night60', icon: '🌔', c: 'day', n: 60, coins: 400, name: ['Стойкий', 'Unyielding'], desc: ['Переживи 60 ночей суммарно', 'Survive 60 nights in total'] },
        { id: 'win', icon: '🏆', c: 'win', n: 1, coins: 600, name: ['Выжил!', 'Survivor!'], desc: ['Заверши игру: дождись рассвета 99-й ночи', 'Finish the game: survive until dawn after night 99'] },
        { id: 'boss', icon: '👑', c: 'boss', n: 1, coins: 800, name: ['Хозяин леса', 'Forest Warden'], desc: ['Победи Хозяина леса в последнюю ночь', 'Defeat the Forest Warden on the last night'] },
        { id: 'hcwin', icon: '💀', c: 'hcwin', n: 1, coins: 1500, name: ['Без права на ошибку', 'No Room for Error'], desc: ['Заверши игру в режиме хардкор', 'Finish the game in hardcore mode'] },
        { id: 'wolf25', icon: '🐺', c: 'kill_wolf', n: 25, coins: 60, name: ['Волчий страх', 'Wolves Beware'], desc: ['Победи 25 волков', 'Defeat 25 wolves'] },
        { id: 'wolf100', icon: '🐺', c: 'kill_wolf', n: 100, coins: 250, name: ['Гроза стаи', 'Pack Terror'], desc: ['Победи 100 волков', 'Defeat 100 wolves'] },
        { id: 'bear5', icon: '🐻', c: 'kill_bear', n: 5, coins: 150, name: ['Медвежатник', 'Bear Hunter'], desc: ['Победи 5 медведей', 'Defeat 5 bears'] },
        { id: 'cult20', icon: '🧙', c: 'kill_cultist', n: 20, coins: 150, name: ['Враг ордена', 'Enemy of the Order'], desc: ['Победи 20 культистов', 'Defeat 20 cultists'] },
        { id: 'tree50', icon: '🪓', c: 'tree', n: 50, coins: 60, name: ['Дровосек', 'Lumberjack'], desc: ['Свали 50 деревьев', 'Fell 50 trees'] },
        { id: 'tree300', icon: '🌲', c: 'tree', n: 300, coins: 200, name: ['Лесоповал', 'Timber!'], desc: ['Свали 300 деревьев', 'Fell 300 trees'] },
        { id: 'fish20', icon: '🎣', c: 'fish', n: 20, coins: 80, name: ['Рыбак', 'Angler'], desc: ['Поймай 20 рыб', 'Catch 20 fish'] },
        { id: 'cook20', icon: '🍖', c: 'cook', n: 20, coins: 80, name: ['Повар лагеря', 'Camp Cook'], desc: ['Приготовь 20 блюд в котле', 'Cook 20 meals in the pot'] },
        { id: 'farm30', icon: '🥕', c: 'harvest', n: 30, coins: 80, name: ['Огородник', 'Gardener'], desc: ['Собери урожай 30 раз', 'Harvest crops 30 times'] },
        { id: 'chest25', icon: '📦', c: 'chest', n: 25, coins: 120, name: ['Кладоискатель', 'Treasure Hunter'], desc: ['Открой 25 сундуков', 'Open 25 chests'] },
        { id: 'mine30', icon: '⛏️', c: 'mine', n: 30, coins: 100, name: ['Шахтёр', 'Miner'], desc: ['Добудь 30 рудных жил', 'Mine 30 ore veins'] },
        { id: 'kids4', icon: '🧒', c: 'kidHome', n: 4, coins: 300, name: ['Спаситель', 'Savior'], desc: ['Приведи домой всех детей', 'Bring every child home'] },
        { id: 'zone5', icon: '🧭', c: 'zone', max: true, n: 5, coins: 250, name: ['Весь лес', 'The Whole Forest'], desc: ['Открой все пять зон леса', 'Unlock all five forest zones'] },
        { id: 'grenade15', icon: '💣', c: 'grenade', n: 15, coins: 100, name: ['Подрывник', 'Demolitionist'], desc: ['Брось 15 гранат', 'Throw 15 grenades'] },
        { id: 'trade10', icon: '🛒', c: 'trade', n: 10, coins: 80, name: ['Торговая жилка', 'Merchant'], desc: ['Соверши 10 сделок с торговцем', 'Make 10 deals with the trader'] },
        { id: 'event20', icon: '⚡', c: 'event', n: 20, coins: 100, name: ['Любитель приключений', 'Thrill Seeker'], desc: ['Пережди 20 случайных событий', 'Experience 20 random events'] },
        { id: 'medic', icon: '⛑️', c: 'botRevive', n: 5, coins: 100, name: ['Полевой медик', 'Field Medic'], desc: ['Подними 5 раз упавших напарников', 'Revive fallen companions 5 times'] },
        { id: 'upgrade3', icon: '⚒️', c: 'gearUp', n: 3, coins: 120, name: ['Кузнец', 'Blacksmith'], desc: ['Улучши снаряжение 3 раза', 'Upgrade your gear 3 times'] },
        { id: 'repair10', icon: '🔧', c: 'repair', n: 10, coins: 60, name: ['Мастер на все руки', 'Handyman'], desc: ['Почини постройки 10 раз', 'Repair structures 10 times'] },
        { id: 'lore', icon: '📜', fn: () => [Lore.countAll(), Lore.NOTES.length], coins: 300, name: ['Хранитель памяти', 'Keeper of Memory'], desc: ['Найди все записки в лесу', 'Find every note in the forest'] },
        { id: 'skins10', icon: '🎭', fn: () => [Object.keys(Econ.owned).filter(k => SKINS.byId[k]).length, 10], coins: 150, name: ['Модник', 'Fashionista'], desc: ['Собери 10 скинов', 'Collect 10 skins'] },
        { id: 'pack4', icon: '🎒', fn: () => [Econ.packTier(), 4], coins: 150, name: ['Налегке не ходим', 'Pack Rat'], desc: ['Купи рюкзак четвёртого уровня', 'Own a level-4 backpack'] },
        { id: 'rich', icon: '🪙', fn: () => [Econ.earned, 5000], coins: 200, name: ['Богач', 'Moneybags'], desc: ['Заработай 5000 монет за всё время', 'Earn 5000 coins in total'] },
    ],

    // ------------------------------------------------------------------------------ ежедневные задания
    POOL: [
        { id: 'kill8', ev: ['kill'], n: 8, coins: 50, name: ['Охотник', 'Hunter'], desc: ['Победи 8 зверей', 'Defeat 8 beasts'] },
        { id: 'wolf5', ev: ['kill_wolf'], n: 5, coins: 45, name: ['Волчья охота', 'Wolf Hunt'], desc: ['Победи 5 волков', 'Defeat 5 wolves'] },
        { id: 'tree15', ev: ['tree'], n: 15, coins: 40, name: ['Дрова на ночь', 'Firewood'], desc: ['Свали 15 деревьев', 'Fell 15 trees'] },
        { id: 'cook3', ev: ['cook'], n: 3, coins: 40, name: ['Горячий обед', 'Hot Meal'], desc: ['Приготовь 3 блюда', 'Cook 3 meals'] },
        { id: 'fish3', ev: ['fish'], n: 3, coins: 45, name: ['Рыбный день', 'Fishing Day'], desc: ['Поймай 3 рыбы', 'Catch 3 fish'] },
        { id: 'gather8', ev: ['harvest', 'forage'], n: 8, coins: 40, name: ['Сборщик', 'Gatherer'], desc: ['Собери 8 ягод, грибов или овощей', 'Gather 8 berries, mushrooms or veggies'] },
        { id: 'craft2', ev: ['craft'], n: 2, coins: 40, name: ['Мастерская', 'Workshop'], desc: ['Скрафти 2 предмета', 'Craft 2 items'] },
        { id: 'chest2', ev: ['chest'], n: 2, coins: 55, name: ['Находка', 'Lucky Find'], desc: ['Открой 2 сундука', 'Open 2 chests'] },
        { id: 'coins150', ev: ['coins'], n: 150, coins: 50, name: ['Копилка', 'Piggy Bank'], desc: ['Заработай 150 монет', 'Earn 150 coins'] },
        { id: 'night1d', ev: ['day'], n: 1, coins: 60, name: ['Ночная смена', 'Night Shift'], desc: ['Пережди ночь', 'Survive a night'] },
        { id: 'trade2', ev: ['trade'], n: 2, coins: 40, name: ['Сделка', 'Deal'], desc: ['Соверши 2 сделки с торговцем', 'Make 2 trades'] },
        { id: 'grenade3', ev: ['grenade'], n: 3, coins: 50, name: ['Фейерверк', 'Fireworks'], desc: ['Брось 3 гранаты', 'Throw 3 grenades'] },
        { id: 'mine3', ev: ['mine'], n: 3, coins: 55, name: ['Рудокоп', 'Prospector'], desc: ['Добудь 3 рудные жилы', 'Mine 3 ore veins'] },
        { id: 'event2', ev: ['event'], n: 2, coins: 45, name: ['Не заскучаешь', 'Never Boring'], desc: ['Пережди 2 случайных события', 'See 2 random events'] },
    ],
    DAILY: [60, 80, 120, 160, 220, 300, 500],   // монеты по дням серии; седьмой день — ещё и сердце

    // ------------------------------------------------------------------------------ хранение
    key() { return (typeof GAME_ID !== 'undefined' ? GAME_ID : 'game') + '.ach'; },
    load() {
        const s = Store.getJSON(this.key(), null);
        if (s) this.data = Object.assign({ c: {}, done: {}, daily: null, dr: { last: '', streak: 0, took: 0, dbl: '' } }, s);
        this.data.dr = Object.assign({ last: '', streak: 0, took: 0 }, this.data.dr);
        this.data.modes = Object.assign({ normal: {}, hardcore: {} }, this.data.modes || {});
        this.rollDaily();
    },
    save() { Store.set(this.key(), JSON.stringify(this.data)); },
    init() {
        if (this._inited) return; this._inited = true;
        this.DEFS.find(a => a.id === 'night10').skin = 'ranger';
        this.DEFS.find(a => a.id === 'lore').skin = 'druid';
        this.DEFS.find(a => a.id === 'hcwin').skin = 'forestking';
        for (const id of ['lore', 'boss', 'hcwin']) this.DEFS.find(a => a.id === id).hidden = true;
        this.load(); this.syncCosmetics();
    },
    syncCosmetics() {
        let changed = false;
        for (const a of this.DEFS) if (a.skin && this.data.done[a.id] && SKINS.byId[a.skin] && !Econ.owned[a.skin]) { Econ.owned[a.skin] = true; changed = true; }
        if (changed) Econ.save();
    },

    // ------------------------------------------------------------------------------ события
    event(name, n) {
        n = n == null ? 1 : n;
        const d = this.data;
        const mode = typeof Game !== 'undefined' && Game.hardcore ? 'hardcore' : 'normal';
        if (!d.modes) d.modes = { normal: {}, hardcore: {} };
        const counters = d.modes[mode] || (d.modes[mode] = {});
        counters[name] = name === 'zone' ? Math.max(counters[name] || 0, n) : (counters[name] || 0) + n;
        if (name === 'zone') d.c[name] = Math.max(d.c[name] || 0, n);
        else d.c[name] = (d.c[name] || 0) + n;
        // ежедневные задания
        const dl = this.rollDaily();
        for (const q of dl.list) { const P = this.POOL.find(x => x.id === q.id); if (P && P.ev.includes(name)) q.p = Math.min(P.n, (q.p || 0) + n); }
        this._dirty = true;
    },

    // Проверка достижений: раз в 1.5 с и по событиям; сохранение — не чаще раза в несколько секунд
    update(dt) {
        this._t -= dt;
        if (this._t > 0) return;
        this._t = 1.5;
        this.check();
        if (this._dirty) { this._dirty = false; this.save(); }
    },
    progress(def) {
        if (def.fn) { try { return def.fn(); } catch (e) { return [0, 1]; } }
        return [this.data.c[def.c] || 0, def.n];
    },
    check() {
        for (const a of this.DEFS) {
            if (this.data.done[a.id]) continue;
            const [cur, goal] = this.progress(a);
            if (cur >= goal) this.unlock(a);
        }
    },
    unlock(a) {
        if (this.data.done[a.id]) return;
        this.data.done[a.id] = Date.now();
        this.save();
        this.syncCosmetics();
        const L = Lang.code === 'en' ? 1 : 0;
        try {
            Econ.addCoins(a.coins, 'ach');
            if (window.UI) { UI.banner('🏆 ' + a.name[L], a.desc[L] + ' · +' + a.coins + ' 🪙', '#ffd24a'); }
            if (window.Sfx) Sfx.ui('fanfare');
            if (window.UiFX) UiFX.confetti(46);
        } catch (e) { /* не должно ломать игру */ }
    },
    doneCount() { return this.DEFS.filter(a => this.data.done[a.id]).length; },

    // ------------------------------------------------------------------------------ ежедневная награда
    today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    // Состояние серии: { can, day (1..7 — какой день серии сегодня), streak }
    dailyState() {
        const r = this.data.dr, t = this.today();
        if (r.last >= t) return { can: false, day: ((Math.max(1, r.streak) - 1) % 7) + 1, streak: r.streak, clockBack: r.last > t };
        const cont = r.last === this.yesterday();
        const streak = cont ? r.streak : 0;
        return { can: true, day: (streak % 7) + 1, streak };
    },
    claimDaily() {
        const st = this.dailyState();
        if (!st.can) return null;
        const r = this.data.dr;
        r.last = this.today(); r.streak = st.streak + 1;
        const day = st.day, coins = this.DAILY[day - 1];
        Econ.addCoins(coins, 'daily');
        r.took = coins; r.dbl = '';
        let heart = false;
        if (day === 7) heart = Econ.gainHeart('daily');
        this.save();
        return { day, coins, heart };
    },
    // Удвоить сегодняшнюю награду за просмотр рекламы (один раз за день; награда — только по подтверждению SDK)
    async doubleDaily() {
        const r = this.data.dr;
        if (r.last !== this.today() || r.dbl === r.last || !(r.took > 0) || this._dbl) return false;
        const date = r.last, amount = r.took;
        this._dbl = true;
        try {
            const ok = await Platform.rewarded('daily_double');
            if (!ok) { if (window.UI) UI.toast(Lang.t('ad.fail'), 'warn'); return false; }
            if (this.data.dr !== r || r.last !== date || this.today() !== date || r.dbl === date) return false;
            r.dbl = date; Econ.addCoins(amount, 'daily'); this.save();
            return true;
        } finally { this._dbl = false; }
    },

    // ------------------------------------------------------------------------------ ежедневные задания
    // Три задания на сегодня: набор зависит от даты (одинаков на всех устройствах)
    rollDaily() {
        const t = this.today();
        let dl = this.data.daily;
        if (dl && dl.date >= t) return dl;
        let h = 0; for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t.charCodeAt(i)) >>> 0;
        const rnd = U.rng(h || 7), pool = this.POOL.slice(), list = [];
        while (list.length < 3 && pool.length) { const q = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; list.push({ id: q.id, p: 0, claimed: 0 }); }
        dl = this.data.daily = { date: t, list, bonus: 0 };
        this.save();
        return dl;
    },
    claimChallenge(id) {
        const dl = this.rollDaily(), q = dl.list.find(x => x.id === id), P = this.POOL.find(x => x.id === id);
        if (this.today() < dl.date || !q || !P || q.claimed || q.p < P.n) return 0;
        q.claimed = 1;
        Econ.addCoins(P.coins, 'daily');
        let got = P.coins;
        if (dl.list.every(x => x.claimed) && !dl.bonus) { dl.bonus = 1; Econ.addCoins(150, 'daily'); got += 150; }
        this.save();
        return got;
    },
    // Есть ли что забрать (значок на кнопке «Награды»)
    hasClaimable() {
        if (this.dailyState().can) return true;
        const dl = this.rollDaily();
        if (dl.date > this.today()) return false;
        return dl.list.some(q => { const P = this.POOL.find(x => x.id === q.id); return P && !q.claimed && q.p >= P.n; });
    },
};

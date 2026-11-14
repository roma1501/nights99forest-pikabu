// Skins.js — каталог косметики: 5 тематических категорий по 8 мест (в Космосе и Фэнтези по одному месту пустому — скин снят,
// см. retired). Чётные места открываются за монеты, нечётные — за рекламу (от 1 до 5 просмотров, чем реже скин, тем больше). Скин = набор цветов + аксессуары на костях
// героя (узлы Acc_* в player.glb; нет узла в модели — скин просто без этой детали).
// colors: hair / shirt / jacket / pants / skin (тон кожи) и accA / accB / accC — цвета материалов аксессуаров.

/** @type {Record<string, any>} */
const SKINS = {
    themes: [
        { id: 'wood', icon: '🌲', color: '#4ade6a', name: ['Лесной житель', 'Woodland'] },
        { id: 'space', icon: '🚀', color: '#5aa8ff', name: ['Космос', 'Space'] },
        { id: 'fantasy', icon: '🗡️', color: '#c08aff', name: ['Фэнтези', 'Fantasy'] },
        { id: 'neon', icon: '⚡', color: '#ff4fd8', name: ['Неон', 'Neon'] },
        { id: 'spooky', icon: '🎃', color: '#ff9a2e', name: ['Хэллоуин', 'Spooky'] },
    ],
    // цена за монеты / просмотры рекламы по редкости
    rarity: {
        common: { coins: 120, ads: [1, 2], color: '#9aa4b2', name: ['Обычный', 'Common'] },
        rare: { coins: 350, ads: [2, 3], color: '#4aa3ff', name: ['Редкий', 'Rare'] },
        epic: { coins: 800, ads: [4, 4], color: '#b46bff', name: ['Эпический', 'Epic'] },
        legend: { coins: 1800, ads: [5, 5], color: '#ffb020', name: ['Легендарный', 'Legendary'] },
    },
    items: [],
    // Снятые скины: id -> монеты, которые возвращаются купившим (Econ.load). Сняты по замечанию сертификации Playables
    // 2026-11-10 — сходство с чужими персонажами; в каталог не возвращать.
    retired: { pilot: 350, elf: 350 },
};

(function () {
    // [id, тема, [ru, en], редкость, hair, shirt, jacket, pants, skin, [аксессуары], [accA, accB, accC], причёска]
    /** @type {any[][]} */
    const D = [
        // ---- Лесной житель
        ['ranger', 'wood', ['Рейнджер', 'Ranger'], 'common', '#6b4423', '#c9b27a', '#3f6b3a', '#5a4a32', null, ['ranger_hat', 'backpack'], ['#3f6b3a', '#c9a24a', '#8a6a3a'], 'Hair_short'],
        ['lumberjack', 'wood', ['Лесоруб', 'Lumberjack'], 'common', '#2b1c14', '#d8423a', '#7a3a24', '#3a4a6a', null, ['beanie', 'belt'], ['#d8423a', '#f1e6c8', '#8a8a92'], 'Hair_bacon'],
        ['scout', 'wood', ['Следопыт', 'Scout'], 'rare', '#d0902a', '#e8dcc0', '#5a7a3a', '#6a5a3a', '#e0ac82', ['cap', 'quiver', 'scarf'], ['#5a7a3a', '#c98a3a', '#d8423a'], 'Hair_pony'],
        ['druid', 'wood', ['Друид', 'Druid'], 'rare', '#3a2a1a', '#8ac06a', '#4a8a52', '#6a4a2a', '#c68b60', ['antlers', 'cape'], ['#7a5a3a', '#4a8a52', '#b6ff8a'], 'Hair_short'],
        ['fox', 'wood', ['Лисёнок', 'Fox Kid'], 'epic', '#ff8a2a', '#fff2e0', '#ff8a2a', '#3a2a24', '#f7dcc0', ['fox_ears', 'tail_fox'], ['#ff8a2a', '#fff2e0', '#2b1c14'], 'Hair_bacon'],
        ['hermit', 'wood', ['Грибник', 'Mushroom Hermit'], 'epic', '#d8d8dc', '#e8d8b0', '#7a5a3a', '#4a3a2a', '#f2c9a0', ['mushroom_cap', 'backpack'], ['#d8423a', '#f5efe0', '#7a5a3a'], 'Hair_short'],
        ['bearcub', 'wood', ['Мишка', 'Bear Cub'], 'legend', '#5a3a22', '#e8b878', '#8a5a32', '#5a3a22', '#c68b60', ['bear_ears', 'scarf', 'belt'], ['#8a5a32', '#e8b878', '#d8423a'], 'Hair_short'],
        ['forestking', 'wood', ['Король леса', 'Forest King'], 'legend', '#f2d16a', '#3a7a4a', '#2a5a3a', '#3a2a1a', '#e0ac82', ['leaf_crown', 'antlers', 'cape'], ['#ffd24a', '#3a7a4a', '#b6ff8a'], 'Hair_pony'],
        // ---- Космос
        ['astronaut', 'space', ['Астронавт', 'Astronaut'], 'common', '#2b1c14', '#f1f1f4', '#f1f1f4', '#d8d8e0', null, ['astro_helmet', 'jetpack'], ['#cfe8ff', '#ff7a2a', '#8a8a92'], null],
        ['alien', 'space', ['Инопланетянин', 'Alien'], 'common', '#7fff9a', '#4a2a7a', '#3a1f5a', '#2a1a4a', '#a6d8a0', ['antennae'], ['#7fff9a', '#ff4fd8', '#ffe066'], null],
        ['', 'space'],   // снятый скин: пустое место сохраняет очерёдность монеты/реклама у соседей
        ['robot', 'space', ['Робот', 'Robot'], 'rare', '#8a8a92', '#7d8592', '#5a6270', '#3a4150', '#b8c0cc', ['robot_visor', 'antennae'], ['#ff3b3b', '#cfd6e0', '#3bffb0'], null],
        ['moonbunny', 'space', ['Лунный кролик', 'Moon Bunny'], 'epic', '#f1f1f4', '#e0d8ff', '#b8a8ff', '#6a5aa8', '#f7dcc0', ['bunny_ears', 'scarf'], ['#f1f1f4', '#ffb8e8', '#b8a8ff'], 'Hair_pony'],
        ['cosmonaut', 'space', ['Космонавт', 'Cosmonaut'], 'epic', '#2b1c14', '#d8423a', '#e8e8ea', '#d8d8e0', null, ['retro_helmet', 'jetpack'], ['#d8423a', '#e8e8ea', '#ffe066'], null],
        ['nebula', 'space', ['Повелитель туманностей', 'Nebula Lord'], 'legend', '#ff4fd8', '#2a1a5a', '#6a2aa8', '#1a1240', '#c8a8ff', ['star_crown', 'wings_fairy'], ['#ff4fd8', '#5aa8ff', '#ffe066'], 'Hair_pony'],
        ['starcaptain', 'space', ['Звёздный капитан', 'Star Captain'], 'legend', '#d8d8dc', '#1a2a5a', '#ffffff', '#1a2a5a', null, ['astro_helmet', 'cape', 'jetpack'], ['#ffd24a', '#5aa8ff', '#ff4fd8'], null],
        // ---- Фэнтези
        ['knight', 'fantasy', ['Рыцарь', 'Knight'], 'common', '#3a2a1a', '#8a8a92', '#b8c0cc', '#5a6270', null, ['knight_helm', 'sword_back'], ['#b8c0cc', '#d8423a', '#8a5a2a'], null],
        ['wizard', 'fantasy', ['Волшебник', 'Wizard'], 'common', '#e8e8ea', '#3a4aa8', '#2a2a7a', '#23253a', null, ['wizard_hat', 'cape'], ['#3a4aa8', '#ffd24a', '#b46bff'], 'Hair_short'],
        ['', 'fantasy'],   // снятый скин
        ['paladin', 'fantasy', ['Паладин', 'Paladin'], 'rare', '#d0902a', '#e8e8ea', '#ffd24a', '#8a8a92', null, ['knight_helm', 'cape'], ['#ffd24a', '#e8e8ea', '#d8423a'], null],
        ['dragon', 'fantasy', ['Драконий воин', 'Dragon Warrior'], 'epic', '#d8423a', '#7a1a1a', '#b02a2a', '#3a1a1a', '#c68b60', ['dragon_horns', 'wings_bat'], ['#d8423a', '#ffb020', '#2b1c14'], 'Hair_short'],
        ['archmage', 'fantasy', ['Архимаг', 'Archmage'], 'epic', '#c8c8ff', '#5a2aa8', '#7a3ad0', '#2a1a5a', null, ['wizard_hat', 'cape', 'scarf'], ['#7a3ad0', '#ffd24a', '#6affff'], 'Hair_short'],
        ['angel', 'fantasy', ['Ангел', 'Angel'], 'legend', '#ffe8a0', '#ffffff', '#f4efe0', '#e8e0c8', '#f7dcc0', ['halo', 'wings_angel'], ['#ffd24a', '#ffffff', '#fff6c8'], 'Hair_pony'],
        ['king', 'fantasy', ['Король', 'The King'], 'legend', '#3a2a1a', '#8a1a2a', '#d8a01a', '#2a1a1a', '#e0ac82', ['crown', 'cape'], ['#ffd24a', '#b02a2a', '#ffffff'], 'Hair_short'],
        // ---- Неон
        ['punk', 'neon', ['Панк', 'Punk'], 'common', '#ff4fd8', '#23253a', '#15161a', '#3a1a5a', null, ['mohawk', 'belt'], ['#ff4fd8', '#6affff', '#ffe066'], null],
        ['dj', 'neon', ['Диджей', 'DJ'], 'common', '#2b1c14', '#6affff', '#7a3ad0', '#23253a', null, ['headphones'], ['#ff4fd8', '#6affff', '#ffffff'], 'Hair_bacon'],
        ['hacker', 'neon', ['Хакер', 'Hacker'], 'rare', '#15161a', '#15161a', '#22ff88', '#15161a', null, ['hood', 'neon_visor'], ['#22ff88', '#15161a', '#6affff'], null],
        ['cybergirl', 'neon', ['Киберпанк', 'Cyber Girl'], 'rare', '#6affff', '#ff4fd8', '#23253a', '#3a1a5a', '#f7dcc0', ['cat_ears', 'neon_visor'], ['#6affff', '#ff4fd8', '#ffe066'], 'Hair_pony'],
        ['ninja', 'neon', ['Неон-ниндзя', 'Neon Ninja'], 'epic', '#15161a', '#15161a', '#23253a', '#15161a', null, ['ninja_mask', 'scarf', 'sword_back'], ['#ff3b6a', '#15161a', '#6affff'], null],
        ['synthwave', 'neon', ['Синтвейв', 'Synthwave'], 'epic', '#ff4fd8', '#ffb020', '#7a3ad0', '#2a1a5a', null, ['goggles', 'headphones'], ['#ffb020', '#ff4fd8', '#6affff'], 'Hair_pony'],
        ['glitch', 'neon', ['Глитч', 'Glitch'], 'legend', '#6affff', '#ff4fd8', '#6affff', '#15161a', null, ['robot_visor', 'wings_bat'], ['#6affff', '#ff4fd8', '#ffe066'], null],
        ['overdrive', 'neon', ['Овердрайв', 'Overdrive'], 'legend', '#ffe066', '#15161a', '#ff3b6a', '#15161a', null, ['neon_visor', 'cape', 'jetpack'], ['#ff3b6a', '#ffe066', '#6affff'], null],
        // ---- Хэллоуин
        ['pumpkin', 'spooky', ['Тыквоголовый', 'Pumpkin Head'], 'common', '#2b1c14', '#2a2a3a', '#ff7a1a', '#23253a', null, ['pumpkin_head'], ['#ff7a1a', '#2b1c14', '#ffe066'], null],
        ['ghost', 'spooky', ['Привидение', 'Ghost'], 'common', '#ffffff', '#f4f4f8', '#f4f4f8', '#f4f4f8', '#f4f4f8', ['ghost_sheet'], ['#f4f4f8', '#15161a', '#ffe066'], null],
        ['witch', 'spooky', ['Ведьма', 'Witch'], 'rare', '#3a1a5a', '#5a2a7a', '#3a1f5a', '#23253a', '#a6d8a0', ['witch_hat', 'cape'], ['#3a1f5a', '#ffb020', '#7fff9a'], 'Hair_pony'],
        ['vampire', 'spooky', ['Вампир', 'Vampire'], 'rare', '#15161a', '#e8e8ea', '#8a1a2a', '#15161a', '#e8e0e0', ['vampire_collar', 'cape'], ['#8a1a2a', '#15161a', '#d8423a'], 'Hair_short'],
        ['skeleton', 'spooky', ['Скелет', 'Skeleton'], 'epic', '#e8e0c8', '#15161a', '#15161a', '#15161a', '#e8e0c8', ['skull_mask', 'scarf'], ['#e8e0c8', '#15161a', '#ff7a1a'], null],
        ['santa', 'spooky', ['Санта', 'Santa'], 'epic', '#ffffff', '#d8423a', '#d8423a', '#d8423a', '#f2c9a0', ['santa_hat', 'belt', 'backpack'], ['#d8423a', '#ffffff', '#ffd24a'], 'Hair_short'],
        ['demon', 'spooky', ['Демон', 'Demon'], 'legend', '#15161a', '#5a1a1a', '#8a1a1a', '#23153a', '#c83a3a', ['devil_horns', 'wings_bat', 'tail_devil'], ['#ffb020', '#2b1c14', '#ff3b3b'], null],
        ['reaper', 'spooky', ['Жнец', 'Reaper'], 'legend', '#15161a', '#15161a', '#23253a', '#15161a', '#e8e0c8', ['hood', 'skull_mask', 'cape'], ['#2a1a3a', '#6affff', '#e8e0c8'], null],
    ];
    const cnt = {};
    for (const r of D) {
        const [id, theme, name, rarity, hair, shirt, jacket, pants, skin, acc, ac, hairStyle] = r;
        const k = cnt[theme] = (cnt[theme] || 0);
        cnt[theme]++;
        if (!id) continue;
        const R = SKINS.rarity[rarity];
        // чётные номера в теме — за монеты, нечётные — за рекламу (ровно 50 на 50)
        const byCoins = k % 2 === 0;
        SKINS.items.push({
            id, theme, name, rarity, acc, hairStyle,
            colors: { hair, shirt, jacket, pants, skin, accA: ac[0], accB: ac[1], accC: ac[2] },
            unlock: byCoins ? { coins: R.coins } : { ads: rarity === 'rare' ? 2 + (SKINS.themes.findIndex(t => t.id === theme) % 2) : R.ads[0] },
        });
    }
    // стандартный наряд
    SKINS.default = { id: 'default', theme: 'wood', name: ['Классика', 'Classic'], rarity: 'common', acc: [], unlock: { free: true } };
    SKINS.byId = {};
    for (const s of SKINS.items) SKINS.byId[s.id] = s;
    SKINS.byId.default = SKINS.default;
})();

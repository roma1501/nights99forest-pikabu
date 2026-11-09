// Data.js — таблицы игры: предметы, рецепты, уровни костра, враги, дети, тайминги.
// Названия и описания — ключами в Lang.js ('item.<id>', 'itemd.<id>').

/** @type {Record<string, any>} */
const DATA = {
    // Единый конфиг сложности: опыт выживания защищает от обычных врагов,
    // костёр и спасённые дети дают дополнительную защиту, в том числе от босса.
    balance: {
        damage: { perDay: 0.01, cap: 1.8, experiencePerDay: 0.008, experienceCap: 0.46, fireArmor: 0.025, kidArmor: 0.025, armorCap: 0.62 },
        nights: { waveMin: 40, waveJitter: 30, raidChance: 0.28, specialChance: 0.62, startSpecial: 3, startRaid: 6, nightDamagePerDay: 0.002, raidDamagePerDay: 0.002 },
        boss: { perBotHp: 0.3, rise: 3.6, phasePause: 1.7, phase2: 0.66, phase3: 0.33, grace: 100, slamRadius: 8.5, slamTell: 1.1, slamK: 1.35, dashK: 1.3, minionLimit: 6, minionDamage: 0.55 },
        boar: { tell: 0.95, chargeTime: 1.2, chargeSpeed: 12, recovery: 1.8, wallStun: 2.4, minCharge: 3, maxCharge: 16 },
        ghost: { lightRadius: 9, torchRadius: 7, lightDamage: 16, physicalK: 0.35, fireK: 1.8, flashK: 10, fearRadius: 18, hover: 32 },
        movement: { sweepStep: 18, maxDt: 0.1 },
        forecast: { aimAccuracy: 0.65, firingUptime: 0.55, shotgunPelletAccuracy: 0.42, bossGrenades: 4, grenadeEfficiency: 0.75, botDps: 16 },
    },
    // ------------------------------------------------------------------ время (секунды реального времени)
    time: {
        cycle: 360,          // полные сутки
        dawn: 0.00,          // 0..1 внутри суток: рассвет начинается
        dayStart: 0.07,      // светлый день
        duskStart: 0.52,     // закат
        nightStart: 0.62,    // ночь (враги)
        nightEnd: 0.92,      // рассвет
        startPhase: 0.16,    // с чего начинается игра (утро первого дня)
        sleepSpeed: 60,      // ускорение времени во сне
        totalNights: 99,
    },

    // ------------------------------------------------------------------ игрок
    player: {
        hp: 100, hunger: 100, stamina: 100,
        walk: 3.9 * M, run: 5.6 * M, sprint: 8.0 * M,
        jump: 8.2 * M, gravity: 26 * M,
        radius: 0.34 * M,
        hungerDrain: 0.115,      // ед/с (≈14 мин от 100 до 0)
        starveDmg: 1.6,          // урон/с при нулевом голоде
        regenHp: 0.7,            // ед/с, если сыт (>60)
        staminaDrain: 17, staminaRegen: 12,
        reach: 2.6 * M,
        hotbar: 6,               // слотов быстрого доступа (цифры 1–6); остальные слоты рюкзака — в окне инвентаря
    },

    // ------------------------------------------------------------------ рюкзаки (покупаются в магазине: за монеты или за просмотры рекламы)
    // slots — вместимость; unlock: { coins } или { ads }; купленный рюкзак остаётся навсегда и действует в каждом забеге
    packs: [
        { id: 'pack0', slots: 6,  name: ['Старый мешок', 'Old Sack'], color: '#a8703a', rarity: 'common', unlock: { free: true } },
        { id: 'pack1', slots: 8,  name: ['Холщовая сумка', 'Canvas Bag'], color: '#c9b27a', rarity: 'common', unlock: { coins: 150 } },
        { id: 'pack2', slots: 10, name: ['Походный рюкзак', 'Hiking Pack'], color: '#4a8a52', rarity: 'common', unlock: { ads: 2 } },
        { id: 'pack3', slots: 13, name: ['Рюкзак следопыта', 'Scout Pack'], color: '#3a7ad0', rarity: 'rare', unlock: { coins: 500 } },
        { id: 'pack4', slots: 16, name: ['Экспедиционный рюкзак', 'Expedition Pack'], color: '#b46bff', rarity: 'epic', unlock: { ads: 4 } },
        { id: 'pack5', slots: 20, name: ['Тактический ранец', 'Tactical Rucksack'], color: '#2a2e3a', rarity: 'epic', unlock: { coins: 1500 } },
        { id: 'pack6', slots: 25, name: ['Легендарный рюкзак', 'Legendary Pack'], color: '#ffb020', rarity: 'legend', unlock: { ads: 5 } },
    ],

    // ------------------------------------------------------------------ уровни костра
    fire: [
        null,
        { cap: 100, burn: 0.36, light: 16, fog: 58, cost: {} },
        { cap: 140, burn: 0.44, light: 20, fog: 84, cost: { log: 8, scrap: 4 } },
        { cap: 190, burn: 0.56, light: 25, fog: 112, cost: { log: 16, scrap: 12 } },
        { cap: 250, burn: 0.70, light: 30, fog: 140, cost: { log: 28, scrap: 26, gem: 3 } },
        { cap: 330, burn: 0.88, light: 36, fog: 200, cost: { log: 45, scrap: 45, gem: 6 } },
    ],
    fuel: { log: 12, coal: 30, canister: 45 },

    // ------------------------------------------------------------------ предметы
    // type: tool | weapon | food | heal | res | ammo | key | misc
    items: {
        axe_old:    { type: 'tool', model: 'axe_old', stack: 1, tree: 1.0, dmg: 12, reach: 2.4, rate: 0.85, grip: 'axe' },
        axe_good:   { type: 'tool', model: 'axe_good', stack: 1, tree: 1.7, dmg: 20, reach: 2.5, rate: 0.75, grip: 'axe' },
        axe_strong: { type: 'tool', model: 'axe_strong', stack: 1, tree: 2.7, dmg: 32, reach: 2.6, rate: 0.7, grip: 'axe' },
        chainsaw:   { type: 'tool', model: 'chainsaw', stack: 1, tree: 5.5, dmg: 46, reach: 2.4, rate: 0.5, grip: 'saw' },
        flashlight: { type: 'tool', model: 'flashlight', stack: 1, grip: 'light' },
        spear:      { type: 'weapon', model: 'spear', stack: 1, dmg: 30, reach: 3.1, rate: 0.9, grip: 'spear', anim: 'stab' },
        katana:     { type: 'weapon', model: 'katana', stack: 1, dmg: 38, reach: 2.6, rate: 0.6, grip: 'sword', anim: 'swing' },
        revolver:   { type: 'weapon', model: 'revolver', stack: 1, dmg: 46, range: 40, rate: 0.55, ammo: 'ammo_rev', grip: 'gun', ranged: true, mag: 6 },
        rifle:      { type: 'weapon', model: 'rifle', stack: 1, dmg: 85, range: 70, rate: 1.0, ammo: 'ammo_rifle', grip: 'rifle', ranged: true, mag: 5 },
        compass:    { type: 'tool', model: 'compass', stack: 1, grip: 'compass' },
        carrot:     { type: 'food', model: 'carrot', stack: 10, hunger: 9, hp: 0 },
        berry:      { type: 'food', model: 'berry', stack: 10, hunger: 5, hp: 1 },
        steak_raw:  { type: 'food', model: 'steak', stack: 10, hunger: 8, hp: -6, raw: true, cook: 'steak_cooked' },
        steak_cooked: { type: 'food', model: 'steak_cooked', stack: 10, hunger: 26, hp: 4 },
        stew:       { type: 'food', model: 'stew', stack: 5, hunger: 48, hp: 10 },
        bandage:    { type: 'heal', model: 'bandage', stack: 5, hp: 28 },
        medkit:     { type: 'heal', model: 'medkit', stack: 3, hp: 100 },
        log:        { type: 'res', model: 'log', stack: 10, fuel: 12, grip: 'carry' },
        coal:       { type: 'res', model: 'coal', stack: 10, fuel: 30, grip: 'carry' },
        canister:   { type: 'res', model: 'canister', stack: 5, fuel: 45, grip: 'carry' },
        bolt:       { type: 'res', model: 'bolt', stack: 20, scrap: 1 },
        sheet:      { type: 'res', model: 'sheet', stack: 20, scrap: 2 },
        fan:        { type: 'res', model: 'fan', stack: 20, scrap: 3 },
        radio:      { type: 'res', model: 'radio', stack: 20, scrap: 4 },
        tire:       { type: 'res', model: 'tire', stack: 20, scrap: 3 },
        engine:     { type: 'res', model: 'engine', stack: 20, scrap: 8 },
        gem:        { type: 'res', model: 'gem', stack: 20 },
        diamond:    { type: 'res', model: 'diamond', stack: 999 },
        pelt:       { type: 'res', model: 'pelt', stack: 20 },
        bunny_foot: { type: 'res', model: 'bunny_foot', stack: 20 },
        seed:       { type: 'res', model: 'seed', stack: 20 },
        ammo_rev:   { type: 'ammo', model: 'ammo', stack: 60 },
        ammo_rifle: { type: 'ammo', model: 'ammo', stack: 60 },
        key_red:    { type: 'key', model: 'key', stack: 1, color: '#ff4a4a' },
        key_blue:   { type: 'key', model: 'key', stack: 1, color: '#4a8cff' },
        key_green:  { type: 'key', model: 'key', stack: 1, color: '#4aff7a' },
        key_yellow: { type: 'key', model: 'key', stack: 1, color: '#ffd84a' },
        // еда и лекарства
        fish_raw:   { type: 'food', model: 'fish', stack: 10, hunger: 6, hp: -4, raw: true, cook: 'fish_cooked' },
        fish_cooked: { type: 'food', model: 'fish_cooked', stack: 10, hunger: 30, hp: 5 },
        mushroom_food: { type: 'food', model: 'mushroom_item', stack: 10, hunger: 8, hp: 1 },
        pie:        { type: 'food', model: 'pie', stack: 5, hunger: 55, hp: 12 },
        cola:       { type: 'food', model: 'cola', stack: 5, hunger: 4, hp: 0, stamina: 100, buff: { speed: 1.25, t: 45 } },
        herb:       { type: 'heal', model: 'herb', stack: 10, hp: 16 },
        // инструменты и оружие
        pickaxe:    { type: 'tool', model: 'pickaxe', stack: 1, tree: 0.6, mine: 1, dmg: 14, reach: 2.3, rate: 0.85, grip: 'axe' },
        fishing_rod: { type: 'tool', model: 'fishing_rod', stack: 1, fish: true, grip: 'hold' },
        lantern:    { type: 'tool', model: 'lantern', stack: 1, grip: 'hold', lantern: true },
        hammer:     { type: 'weapon', model: 'hammer', stack: 1, dmg: 52, reach: 2.4, rate: 1.15, grip: 'axe', anim: 'chop', stun: 1.3 },
        bow:        { type: 'weapon', model: 'bow', stack: 1, dmg: 36, range: 55, rate: 0.85, ammo: 'arrow', grip: 'bow', ranged: true, mag: 0, silent: true },
        shotgun:    { type: 'weapon', model: 'shotgun', stack: 1, dmg: 24, pellets: 6, spread: 0.11, range: 24, rate: 1.0, ammo: 'shell', grip: 'rifle', ranged: true, mag: 2 },
        // самодельные гранаты: бросок в точку прицела, взрыв по таймеру (или при прямом попадании во врага)
        grenade:    { type: 'weapon', model: 'grenade', stack: 5, grip: 'hold', throw: { kind: 'frag', fuse: 2.4, radius: 5.2, dmg: 120, range: 22 } },
        grenade_flash: { type: 'weapon', model: 'grenade_flash', stack: 5, grip: 'hold', throw: { kind: 'flash', fuse: 1.7, radius: 8, dmg: 8, stun: 3.6, range: 22 } },
        arrow:      { type: 'ammo', model: 'arrow', stack: 40 },
        shell:      { type: 'ammo', model: 'shell', stack: 40 },
        barricade:  { type: 'build', model: 'barricade', stack: 10, place: 'barricade' },
        coin:       { type: 'wallet', model: 'coin', stack: 999 },
        beacon_kit: { type: 'build', model: 'beacon_kit', stack: 1, place: 'beacon' },
        torch:      { type: 'build', model: 'torch', stack: 10, place: 'torch' },
        wire:       { type: 'build', model: 'wire', stack: 10, place: 'wire' },
        spikes:     { type: 'build', model: 'spikes', stack: 10, place: 'spikes' },
        beartrap:   { type: 'build', model: 'beartrap', stack: 10, place: 'beartrap' },
    },
    // Порядок в списке и цена в «ломе» у верстака: [id, {cost}, count]
    recipes: [
        { id: 'axe_good',   cost: { scrap: 10 }, need: 0 },
        { id: 'axe_strong', cost: { scrap: 28, gem: 2 }, need: 0 },
        { id: 'chainsaw',   cost: { scrap: 70, gem: 4 }, need: 3 },
        { id: 'spear',      cost: { log: 4, scrap: 4 }, need: 0 },
        { id: 'katana',     cost: { scrap: 34, gem: 3 }, need: 0 },
        { id: 'revolver',   cost: { scrap: 40 }, need: 0 },
        { id: 'rifle',      cost: { scrap: 85, gem: 2 }, need: 0 },
        { id: 'ammo_rev',   cost: { scrap: 6 }, count: 12, need: 0 },
        { id: 'ammo_rifle', cost: { scrap: 8 }, count: 10, need: 0 },
        { id: 'bandage',    cost: { scrap: 3 }, count: 1, need: 0 },
        { id: 'medkit',     cost: { scrap: 14 }, count: 1, need: 0 },
        { id: 'torch',      cost: { log: 2, scrap: 1 }, count: 1, need: 0 },
        { id: 'wire',       cost: { scrap: 4 }, count: 1, need: 0 },
        { id: 'spikes',     cost: { log: 3, scrap: 4 }, count: 1, need: 0 },
        { id: 'beartrap',   cost: { scrap: 8 }, count: 1, need: 0 },
        { id: 'compass',    cost: { scrap: 6 }, count: 1, need: 0 },
        { id: 'fishing_rod', cost: { log: 2, scrap: 3 }, need: 0 },
        { id: 'bow',        cost: { log: 3, scrap: 6 }, need: 0 },
        { id: 'arrow',      cost: { log: 1, scrap: 1 }, count: 8, need: 0 },
        { id: 'barricade',  cost: { log: 5, scrap: 4 }, count: 1, need: 1 },
        { id: 'pickaxe',    cost: { log: 2, scrap: 18 }, need: 1 },
        { id: 'lantern',    cost: { scrap: 12, gem: 1 }, need: 1 },
        { id: 'pie',        cost: { carrot: 2, berry: 3, log: 1 }, need: 1 },
        { id: 'cola',       cost: { scrap: 4, berry: 3 }, need: 1 },
        { id: 'hammer',     cost: { log: 4, scrap: 30 }, need: 2 },
        { id: 'shotgun',    cost: { scrap: 70, gem: 1 }, need: 3 },
        { id: 'shell',      cost: { scrap: 5 }, count: 8, need: 3 },
        { id: 'grenade',    cost: { scrap: 10, ammo_rev: 6 }, count: 2, need: 1 },
        { id: 'grenade_flash', cost: { scrap: 6, gem: 1 }, count: 2, need: 1 },
        { id: 'beacon_kit', cost: { scrap: 60, gem: 6, engine: 2, radio: 2 }, need: 5 },
    ],

    // ------------------------------------------------------------------ враги
    enemies: {
        boar:   { hp: 150, dmg: 24, speed: 4.1 * M, radius: 0.65 * M, aggro: 23 * M, reach: 2.0 * M, rate: 2.2, drop: [['steak_raw', 1, 2], ['pelt', 0.6, 1]], xp: 2 },
        ghost:  { hp: 100, dmg: 18, speed: 3.6 * M, radius: 0.55 * M, aggro: 25 * M, reach: 2.5 * M, rate: 2.4, drop: [['gem', 1, 1], ['diamond', 0.25, 1]], xp: 3 },
        wolf:   { hp: 75,  dmg: 18, speed: 6.6 * M, radius: 0.55 * M, aggro: 26 * M, reach: 1.8 * M, rate: 1.3, drop: [['steak_raw', 1, 1], ['pelt', 0.55, 1]], xp: 1 },
        alpha:  { hp: 130, dmg: 26, speed: 7.0 * M, radius: 0.75 * M, aggro: 30 * M, reach: 2.2 * M, rate: 1.4, drop: [['steak_raw', 1, 2], ['pelt', 1, 1]], xp: 2 },
        bear:   { hp: 320, dmg: 26, speed: 5.0 * M, radius: 1.0 * M, aggro: 20 * M, reach: 2.6 * M, rate: 2.2, drop: [['steak_raw', 1, 3], ['pelt', 1, 2]], xp: 4 },
        bunny:  { hp: 8,   dmg: 0,  speed: 6.0 * M, radius: 0.25 * M, aggro: 0, reach: 0, rate: 1, drop: [['steak_raw', 0.8, 1], ['bunny_foot', 0.5, 1]], xp: 0 },
        cultist:{ hp: 70,  dmg: 18, speed: 4.2 * M, radius: 0.36 * M, aggro: 30 * M, reach: 2.3 * M, rate: 1.6, drop: [['gem', 0.7, 1], ['ammo_rev', 0.35, 4], ['diamond', 0.4, 1]], xp: 2 },
        deer:   { hp: 9999, dmg: 25, speed: 8.4 * M, radius: 0.6 * M, aggro: 60 * M, reach: 2.4 * M, rate: 1.7, drop: [], xp: 0 },
        // Финальный босс 99-й ночи — Хозяин леса (спавнится Enemies.spawnBoss, фазы — Enemies.tickWarden)
        warden: { hp: 4800, dmg: 38, speed: 5.4 * M, radius: 0.75 * M, aggro: 200 * M, reach: 3.4 * M, rate: 2.0, boss: true, drop: [['diamond', 1, 6], ['gem', 1, 8], ['medkit', 1, 2]], xp: 50 },
    },
    // Улучшение оружия у верстака: уровень 1..3, цена за переход на уровень (+18% урона, +15% скорости рубки за уровень)
    upgrade: { max: 3, cost: [{ scrap: 12 }, { scrap: 24, gem: 1 }, { scrap: 40, gem: 2, diamond: 1 }] },
    // Починка построек у костра: цена одного ремонта (+60 прочности из 100). Колья изнашиваются от срабатываний, проволока — от тика, баррикады грызут звери
    repair: { barricade: { log: 1, scrap: 1 }, spikes: { scrap: 2 }, wire: { scrap: 1 } },
    // Особые ночи (с 3-й): шанс выпадения, остальные эффекты — Events.onNight
    nightMods: [
        { id: 'blood', w: 22 }, { id: 'swarm', w: 16 }, { id: 'cold', w: 14 }, { id: 'quiet', w: 12 }, { id: 'storm', w: 14 }, { id: 'fog', w: 12 },
    ],
    // Хардкор: одно сердце на весь забег; монеты ×coinK, награда за финал ×endingK
    hardcore: { coinK: 1.5, endingK: 2 },

    // ------------------------------------------------------------------ зоны (кольца вокруг лагеря)
    // Кольцо k открывается уровнем костра k+1: внутри тумана мир загружен, снаружи — не строится вовсе.
    // r0..r1 — метры от лагеря; w — веса видов деревьев; остальное — множители плотности по сравнению с базой.
    zones: [
        { id: 'glade', r0: 0, r1: 58, tint: [1.04, 1.07, 0.95], trees: 0.55, rocks: 0.6, boulders: 0.3, bushes: 1.4, berry: 1.3, mush: 0.7, logs: 0.5, flowers: 1.8, grass: 1.0,
            w: { tree_a: 0.22, tree_b: 0.14, tree_c: 0.10, tree_pine_a: 0.14, tree_pine_b: 0.08, tree_birch: 0.28, tree_dead: 0.02 } },
        { id: 'birch', r0: 58, r1: 84, tint: [1.08, 1.05, 0.88], trees: 0.8, rocks: 0.8, boulders: 0.4, bushes: 1.2, berry: 1.0, mush: 1.8, logs: 1.3, flowers: 1.3, grass: 1.0,
            w: { tree_birch: 0.50, tree_a: 0.15, tree_b: 0.10, tree_c: 0.05, tree_pine_a: 0.10, tree_pine_b: 0.05, tree_dead: 0.05 } },
        { id: 'hollow', r0: 84, r1: 112, tint: [0.92, 1.0, 0.92], trees: 0.95, rocks: 1.3, boulders: 0.8, bushes: 0.9, berry: 0.7, mush: 1.0, logs: 1.0, flowers: 0.6, grass: 0.9,
            w: { tree_pine_a: 0.30, tree_pine_b: 0.30, tree_a: 0.10, tree_b: 0.10, tree_c: 0.05, tree_birch: 0.05, tree_dead: 0.10 } },
        { id: 'ridge', r0: 112, r1: 140, tint: [0.98, 0.94, 0.9], trees: 0.55, rocks: 2.2, boulders: 2.4, bushes: 0.5, berry: 0.3, mush: 0.4, logs: 1.4, flowers: 0.3, grass: 0.5,
            w: { tree_dead: 0.30, tree_pine_a: 0.25, tree_pine_b: 0.10, tree_a: 0.10, tree_b: 0.10, tree_c: 0.05, tree_birch: 0.10 } },
        { id: 'thicket', r0: 140, r1: 230, tint: [0.82, 0.9, 0.92], trees: 1.2, rocks: 1.0, boulders: 1.2, bushes: 0.7, berry: 0.4, mush: 1.4, logs: 1.5, flowers: 0.2, grass: 0.7,
            w: { tree_pine_a: 0.34, tree_pine_b: 0.30, tree_dead: 0.18, tree_a: 0.06, tree_b: 0.06, tree_c: 0.03, tree_birch: 0.03 } },
    ],
    // Монеты с врагов: [мин, макс]
    coinKill: { bunny: [0, 1], wolf: [2, 5], alpha: [10, 18], bear: [14, 24], cultist: [8, 16], boar: [4, 8], ghost: [6, 12], deer: [0, 0], warden: [400, 600] },
    escapeNights: 5,
    // Сердца: смертей до полного сброса забега; +1 сердце за каждые regenDays пережитых дней
    lives: { max: 4, regenDays: 8 },

    // ------------------------------------------------------------------ дети (порядок спасения)
    kids: [
        { id: 'dino',   key: 'key_red',    fire: 3, color: '#4ec96a', marker: 'kid-dino' },
        { id: 'kraken', key: 'key_blue',   fire: 4, color: '#a86bff', marker: 'kid-kraken' },
        { id: 'squid',  key: 'key_green',  fire: 5, color: '#ff8fc8', marker: 'kid-squid' },
        { id: 'koala',  key: 'key_yellow', fire: 5, color: '#9aa4b2', marker: 'kid-koala' },
    ],

    // сложность по дню: множитель урона и численности
    scale(day) { const b = this.balance.damage; return Math.min(b.cap, 1 + Math.max(0, day) * b.perDay); },
    armor(day, fireLevel, kids, kind) {
        const b = this.balance.damage;
        const experience = kind === 'warden' ? 0 : Math.min(b.experienceCap, Math.max(0, day - 1) * b.experiencePerDay);
        return Math.min(b.armorCap, experience + Math.max(0, Math.min(5, fireLevel) - 1) * b.fireArmor + Math.max(0, Math.min(4, kids)) * b.kidArmor);
    },
    incomingDamage(amount, day, fireLevel, kids, kind) {
        const protectedKinds = ['bite', 'maul', 'stab', 'shot', 'bolt', 'deer', 'boar', 'ghost', 'warden'];
        return Math.max(1, Math.round(amount * (protectedKinds.includes(kind) ? 1 - this.armor(day, fireLevel, kids, kind) : 1)));
    },
};

// Сколько «лома» даёт предмет; общая цена в scrap для вкладов в костёр/верстак
DATA.scrapValue = (id) => (DATA.items[id] && DATA.items[id].scrap) || 0;

// Таблицы добычи: строки { id, w — вес, n — [мин, макс] штук }, rare — шанс добавить редкую вещь
DATA.loot = {
    normal: {
        rows: [
            { id: 'bolt', w: 10, n: [1, 2] }, { id: 'sheet', w: 8, n: [1, 2] }, { id: 'fan', w: 6 }, { id: 'radio', w: 3 }, { id: 'tire', w: 4 },
            { id: 'carrot', w: 8, n: [2, 3] }, { id: 'berry', w: 6, n: [3, 4] }, { id: 'mushroom_food', w: 4, n: [2, 3] }, { id: 'bandage', w: 5 }, { id: 'herb', w: 5, n: [1, 2] },
            { id: 'arrow', w: 3, n: [5, 8] }, { id: 'diamond', w: 2 },
        ],
        rare: [{ p: 0.06, ids: ['axe_good'] }, { p: 0.05, ids: ['bow', 'hammer', 'fishing_rod'] }, { p: 0.05, ids: ['cola', 'pie'] }],
    },
    gold: {
        rows: [
            { id: 'diamond', w: 10, n: [1, 2] }, { id: 'gem', w: 8 }, { id: 'engine', w: 8 }, { id: 'medkit', w: 7 }, { id: 'radio', w: 5, n: [1, 2] },
            { id: 'ammo_rev', w: 4, n: [6, 11] }, { id: 'ammo_rifle', w: 4, n: [5, 9] }, { id: 'shell', w: 3, n: [4, 7] }, { id: 'pie', w: 4 }, { id: 'cola', w: 3 }, { id: 'herb', w: 4, n: [2, 3] },
        ],
        rare: [{ p: 0.09, ids: ['rifle', 'katana', 'shotgun', 'bow']}, { p: 0.08, ids: ['pickaxe', 'lantern'] }, { p: 0.05, ids: ['hammer'] }],
    },
};
for (const k of ['normal', 'gold']) DATA.loot[k].total = DATA.loot[k].rows.reduce((a, r) => a + r.w, 0);

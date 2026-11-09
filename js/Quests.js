// Quests.js — цепочка заданий на всю игру + туториал. 6 глав: от первой рубки до спасения с острова.
// Каждый шаг: название, описание, подсказка (карточка при старте шага), цель-указатель в мире (луч света + стрелка на экране),
// цель (условие) и награда (монеты, предметы). Подсказки-«один раз» (tipOnce) не привязаны к шагам: туман, ночь, голод…
// Тексты: [ru, en]. События приходят из игры: Quests.event('chop'), ('craft:torch'), ('kill_wolf')…

/** @type {Record<string, any>} */
const Quests = {
    steps: [], chapters: [], i: 0, ev: {}, base: {}, seen: {}, doneAt: 0,
    track: true, _t: 0, _tipT: 0, _rt: 0, _p: null, _target: null, stepT: 0, _tipShown: false, _stepShown: -1, _walk: 0, _lx: null, _lz: null, beacon: null, tipEl: null, escape: null, startDay: 1,

    // ============================================================================ данные
    // goal: ev — счётчик событий с начала шага (n штук); stat — накопительный счёт игрока; has — предметов в сумке;
    //       level — уровень костра; day — номер суток; near — рядом с местом (метры); kids / kidsHome — дети; fn — своя проверка
    // target: camp | bench | scrapper | pot | board | sleep | tree | berry | scrap | chest | pond | well | site:<id> | kid:<id> | guard:<ключ> | enemy:<тип> | obelisk | beacon
    DEF: [
        { id: 'c1', name: ['1. Первая ночь', '1. First Night'], zone: 0, steps: [
            { id: 'camp', t: ['Подойди к костру', 'Walk to the campfire'], d: ['Это твоя база. Огонь защищает от зверей.', 'This is your base. Fire keeps beasts away.'],
              tip: ['WASD — ходить, мышь — камера, Shift — бег, Space — прыжок, Ctrl — освободить курсор. Жёлтый луч и стрелка показывают, куда идти.', 'WASD move, mouse look, Shift run, Space jump, Ctrl frees the cursor. The yellow beam and arrow show where to go.'],
              goal: { near: 'camp', r: 260 }, target: 'camp', reward: { coins: 5 } },
            { id: 'chop', t: ['Срубить 3 дерева', 'Chop 3 trees'], d: ['Подойди к дереву и держи ЛКМ: топор рубит.', 'Stand at a tree and hold LMB to chop.'],
              tip: ['Выбран топор (слот 1). Наведи камеру на дерево и бей. Упавшее дерево даёт брёвна — они лежат на земле.', 'The axe is in slot 1. Aim at a tree and swing. A felled tree drops logs on the ground.'],
              goal: { ev: 'chop', n: 3 }, target: 'tree', reward: { coins: 8 } },
            { id: 'logs', t: ['Подобрать 5 брёвен', 'Collect 5 logs'], d: ['Брёвна подбираются сами, когда подойдёшь близко.', 'Logs are picked up automatically when you walk close.'],
              tip: ['В начале доступно 6 ячеек. Tab — инвентарь, X — прошлый предмет, K — магазин рюкзаков.', 'You start with 6 slots. Tab opens inventory, X selects your previous item, K opens the backpack shop.'],
              goal: { has: 'log', n: 5 }, target: 'log', reward: { coins: 6 } },
            { id: 'feed', t: ['Подкинуть 5 брёвен в костёр', 'Feed the fire 5 logs'], d: ['Выбери бревно цифрой, подойди к костру, нажми E.', 'Select a log with the number keys, stand at the fire, press E.'],
              tip: ['Костёр гаснет без топлива! Топливо — над огнём. Чем ярче костёр, тем дальше безопасный круг и туман.', 'The fire burns out without fuel! The fuel bar is over the fire. A bigger fire means a bigger safe circle and more fog cleared.'],
              goal: { stat: 'fed', n: 5 }, target: 'camp', reward: { coins: 10 } },
            { id: 'berry', t: ['Найти еду: ягоды или морковь', 'Find food: berries or carrots'], d: ['Подойди к ягодному кусту или грядке и нажми E.', 'Go to a berry bush or the carrot patch and press E.'],
              tip: ['Голод (вилка) убывает всегда. На нуле — урон. Еда собирается (E) и ест­ся ЛКМ с едой в руке.', 'Hunger (fork icon) always drains; at zero you take damage. Pick food with E and eat it with LMB while holding it.'],
              goal: { ev: 'forage', n: 3, alt: { ev: 'harvest', n: 2 } }, target: 'berry', reward: { coins: 6 } },
            { id: 'eat', t: ['Съесть что-нибудь', 'Eat something'], d: ['Выбери еду в хотбаре (1–6) и нажми ЛКМ.', 'Select food on the hotbar (1–6) and press LMB.'],
              goal: { ev: 'eat', n: 1 }, target: 'none', reward: { coins: 4 } },
            { id: 'scrap', t: ['Принести лом к прессу (4 лома)', 'Bring 4 scrap to the press'], d: ['Подбирай хлам в лесу (болты, листы, шины) и неси к прессу у костра: E.', 'Pick up junk in the forest (bolts, sheets, tires) and bring it to the press by the fire: E.'],
              tip: ['Лом нужен для улучшений костра и крафта. Блестящие кучи хлама — возле ржавых машин и сундуков.', 'Scrap is used for fire upgrades and crafting. Junk piles sit near rusty cars and chests.'],
              goal: { scrapCamp: 4 }, target: 'scrap', reward: { coins: 12 } },
            { id: 'torch', t: ['Сделать факел на верстаке', 'Craft a torch at the workbench'], d: ['Верстак — рядом с костром: E, выбери «Факел».', 'The workbench is by the fire: E, pick “Torch”.'],
              tip: ['На верстаке делают инструменты, оружие, ловушки. Цена — в ломе и брёвнах.', 'Craft tools, weapons and traps at the workbench for scrap and logs.'],
              goal: { ev: 'craft:torch', n: 1 }, target: 'bench', reward: { coins: 8, items: [['torch', 1]] } },
            { id: 'night', t: ['Пережить первую ночь', 'Survive the first night'], d: ['Ночью приходят волки. Держись у костра и подкидывай дрова. Можно поспать в спальнике: E.', 'Wolves roam at night. Stay by the fire and keep it fed. Press E at a sleeping bag to sleep.'],
              tip: ['Когда темнеет, вернись в лагерь. Волки не заходят в круг света, пока горит костёр. Сон ускоряет время до утра.', 'Return to camp at dusk. Wolves will not enter the light while the fire burns. Sleeping skips to morning.'],
              goal: { day: 2 }, target: 'sleep', reward: { coins: 25 } },
            { id: 'upgrade', t: ['Улучшить костёр до 2 уровня', 'Upgrade the fire to level 2'], d: ['Нужно 8 брёвен и 4 лома. Подойди к костру и нажми F — окно улучшения (E с бревном в руке кормит огонь).', 'Needs 8 logs and 4 scrap. Stand at the fire and press F for the upgrade window (E with a log in hand feeds the fire).'],
              tip: ['Улучшение отодвигает туман и открывает НОВУЮ ЗОНУ с новыми зверями, сундуками и детьми в клетках. Вне тумана мир не загружен!', 'Upgrading pushes the fog back and opens a NEW ZONE with new beasts, chests and caged kids. Nothing outside the fog is loaded!'],
              goal: { level: 2 }, target: 'camp', reward: { coins: 40 } },
        ] },
        { id: 'c2', name: ['2. Берёзовая роща', '2. Birch Grove'], zone: 1, steps: [
            { id: 'cabin', t: ['Найти избушку', 'Find the cabin'], d: ['Избушка стоит в роще. Следуй за лучом.', 'A cabin stands in the grove. Follow the beam.'],
              tip: ['Открыта роща: больше припасов и зверей. M — карта, J — задания, N — записки, L — награды.', 'The grove has more supplies and more beasts. M opens the map, J quests, N notes, L rewards.'],
              goal: { near: 'site:poi-cabin#1', r: 700 }, target: 'site:poi-cabin#1', reward: { coins: 10 } },
            { id: 'chest', t: ['Открыть сундук', 'Open a chest'], d: ['Подойди к сундуку и нажми E.', 'Stand at a chest and press E.'],
              tip: ['Золотые сундуки богаче. Из любого сундука падают монеты и предметы.', 'Golden chests are richer. Every chest drops coins and items.'],
              goal: { ev: 'chest', n: 1 }, target: 'chest', reward: { coins: 10 } },
            { id: 'coins', t: ['Собрать 40 монет', 'Collect 40 coins'], d: ['Монеты падают из сундуков, с зверей и за задания — подбираются сами.', 'Coins drop from chests, beasts and quests and are picked up automatically.'],
              tip: ['Монеты тратятся в Магазине скинов (меню и пауза). Скины — за монеты или за просмотры рекламы.', 'Spend coins in the Skin Shop (menu and pause). Skins cost coins or ad views.'],
              goal: { ev: 'coins', n: 40 }, target: 'chest', reward: { coins: 15, items: [['fishing_rod', 1]] } },
            { id: 'spear', t: ['Сделать копьё', 'Craft a spear'], d: ['Копьё бьёт дальше топора. Верстак: 4 бревна + 4 лома.', 'The spear reaches farther than the axe. Workbench: 4 logs + 4 scrap.'],
              goal: { ev: 'craft:spear', n: 1 }, target: 'bench', reward: { coins: 12 } },
            { id: 'wolf', t: ['Победить волка', 'Defeat a wolf'], d: ['Волки нападают стаей. Бей с ЛКМ, отступай к свету костра.', 'Wolves attack in packs. Hit with LMB, fall back to the firelight.'],
              tip: ['Экипируй оружие (цифра) и бей врага перед собой. Полоска здоровья — слева. Бинты и аптечки лечат.', 'Equip a weapon and hit the enemy in front of you. Bandages and medkits heal.'],
              goal: { ev: 'kill_wolf', n: 1 }, target: 'enemy:wolf', reward: { coins: 20 } },
            { id: 'fish', t: ['Поймать рыбу в пруду', 'Catch a fish at the pond'], d: ['Возьми удочку, встань у воды и жми ЛКМ.', 'Hold the rod, stand at the water and press LMB.'],
              tip: ['Удочка лежит в сумке (награда). Когда поплавок уйдёт под воду — жми ЛКМ ещё раз!', 'The rod is in your bag. When the bobber dips, press LMB again!'],
              goal: { ev: 'fish', n: 1 }, target: 'pond', reward: { coins: 15 } },
            { id: 'cook', t: ['Приготовить еду в котелке', 'Cook food in the pot'], d: ['Подойди к котелку у костра: E, положи сырое мясо или рыбу.', 'At the pot by the fire: E, add raw meat or fish.'],
              goal: { ev: 'cook', n: 1 }, target: 'pot', reward: { coins: 12 } },
            { id: 'wood10', t: ['Накопить 14 брёвен', 'Gather 14 logs'], d: ['Для костра 3 уровня нужно 16 брёвен и 12 лома.', 'Fire level 3 needs 16 logs and 12 scrap.'],
              tip: ['На лесопилке лежат штабеля брёвен (E) — они пополняются каждый день.', 'The sawmill has log stacks (E) that refill every day.'],
              goal: { has: 'log', n: 14 }, target: 'site:poi-sawmill', reward: { coins: 15 } },
            { id: 'upgrade3', t: ['Улучшить костёр до 3 уровня', 'Upgrade the fire to level 3'], d: ['16 брёвен и 12 лома. Откроется Волчья лощина.', '16 logs and 12 scrap. Wolf Hollow opens.'],
              goal: { level: 3 }, target: 'camp', reward: { coins: 50 } },
        ] },
        { id: 'c3', name: ['3. Волчья лощина', '3. Wolf Hollow'], zone: 2, steps: [
            { id: 'den', t: ['Найти логово волков', 'Find the wolf den'], d: ['В логове живёт вожак — у него красный ключ.', 'The den leader carries the red key.'],
              tip: ['Волчья лощина опаснее. Возьми оружие, аптечки и факелы. В логове — клетка с Дино.', 'Wolf Hollow is dangerous. Bring weapons, medkits and torches. Dino is caged near the den.'],
              goal: { near: 'site:den-wolf#1', r: 2400 }, target: 'site:den-wolf#1', reward: { coins: 12 } },
            { id: 'keyred', t: ['Добыть красный ключ', 'Get the red key'], d: ['Победи вожака с красным ошейником.', 'Defeat the leader with the red collar.'],
              goal: { has: 'key_red', n: 1 }, target: 'guard:key_red', reward: { coins: 40 } },
            { id: 'dino', t: ['Освободить Дино', 'Free Dino'], d: ['Подойди к клетке с ключом в сумке и нажми E.', 'Go to the cage with the key in your bag and press E.'],
              goal: { kids: 1 }, target: 'kid:dino', reward: { coins: 30 } },
            { id: 'dinoHome', t: ['Привести Дино в лагерь', 'Bring Dino to camp'], d: ['Дети идут за тобой. Доведи до костра — они будут жить в лагере и помогать.', 'Kids follow you. Lead them to the fire — they live in camp and help you.'],
              tip: ['Спасённые дети дают бонусы лагерю. Следи, чтобы по пути их не съели волки.', 'Rescued kids give camp bonuses. Keep wolves off them on the way.'],
              goal: { ev: 'kidHome', n: 1 }, target: 'camp', reward: { coins: 40 } },
            { id: 'ruins', t: ['Обыскать руины', 'Search the ruins'], d: ['В древних руинах лежит золотой сундук.', 'Ancient ruins hide a golden chest.'],
              goal: { near: 'site:poi-ruins#1', r: 600 }, target: 'site:poi-ruins#1', reward: { coins: 15 } },
            { id: 'defense', t: ['Поставить 3 ловушки или колючки', 'Place 3 traps or spikes'], d: ['Сделай на верстаке колючки, проволоку или капкан, выбери и нажми ЛКМ: призрак → поставить.', 'Craft spikes, wire or a bear trap, select and press LMB to place.'],
              tip: ['R — повернуть, ЛКМ — поставить. Ловушки ранят и замедляют зверей у границы света.', 'R rotates, LMB places. Traps hurt and slow beasts at the edge of the light.'],
              goal: { ev: 'place', n: 3 }, target: 'camp', reward: { coins: 25 } },
            { id: 'axe2', t: ['Сделать лучший топор', 'Craft a better axe'], d: ['Верстак: «Хороший топор» за 10 лома — рубит быстрее.', 'Workbench: Good Axe for 10 scrap — chops faster.'],
              goal: { ev: 'craft:axe_good', n: 1 }, target: 'bench', reward: { coins: 20 } },
            { id: 'upgrade4', t: ['Улучшить костёр до 4 уровня', 'Upgrade the fire to level 4'], d: ['28 брёвен, 26 лома, 3 самоцвета.', '28 logs, 26 scrap, 3 gems.'],
              tip: ['Самоцветы дают золотые сундуки, культисты и шахта.', 'Gems come from golden chests, cultists and the mine.'],
              goal: { level: 4 }, target: 'camp', reward: { coins: 70 } },
        ] },
        { id: 'c4', name: ['4. Каменный кряж', '4. Stone Ridge'], zone: 3, steps: [
            { id: 'mine', t: ['Добыть 3 жилы в шахте', 'Mine 3 ore veins at the mine'], d: ['Сделай кирку на верстаке. Иди к шахте и бей по синим камням.', 'Craft a pickaxe. Go to the mine and hit the blue rocks.'],
              tip: ['Руда даёт самоцветы и лом. Жилы отрастают на следующий день.', 'Ore gives gems and scrap. Veins regrow the next day.'],
              goal: { ev: 'mine', n: 3 }, target: 'site:poi-mine#1', reward: { coins: 40 } },
            { id: 'alpha', t: ['Добыть синий ключ', 'Get the blue key'], d: ['Альфа-вожак логова носит синий ошейник. Он сильнее волков.', 'The alpha leader wears the blue collar. Stronger than wolves.'],
              goal: { has: 'key_blue', n: 1 }, target: 'guard:key_blue', reward: { coins: 60 } },
            { id: 'kraken', t: ['Освободить Кракена', 'Free Kraken'], d: ['Клетка возле логова альфы.', 'His cage is by the alpha den.'],
              goal: { kids: 2 }, target: 'kid:kraken', reward: { coins: 40 } },
            { id: 'krakenHome', t: ['Привести Кракена в лагерь', 'Bring Kraken to camp'], d: ['Проводи его к костру.', 'Escort him to the fire.'],
              goal: { ev: 'kidHome', n: 2 }, target: 'camp', reward: { coins: 40 } },
            { id: 'grave', t: ['Обыскать кладбище', 'Search the graveyard'], d: ['Ночью там бродят призраки.', 'Ghosts roam there at night.'],
              goal: { near: 'site:poi-graveyard#1', r: 700 }, target: 'site:poi-graveyard#1', reward: { coins: 20 } },
            { id: 'survive3', t: ['Пережить ещё 3 ночи', 'Survive 3 more nights'], d: ['Ночи становятся страшнее. Держи костёр и оборону.', 'Nights grow scarier. Keep the fire and defenses up.'],
              goal: { daysSince: 3 }, target: 'camp', reward: { coins: 50 } },
            { id: 'upgrade5', t: ['Улучшить костёр до 5 уровня', 'Upgrade the fire to level 5'], d: ['45 брёвен, 45 лома, 6 самоцветов.', '45 logs, 45 scrap, 6 gems.'],
              goal: { level: 5 }, target: 'camp', reward: { coins: 100 } },
        ] },
        { id: 'c5', name: ['5. Тёмная чаща', '5. Dark Thicket'], zone: 4, steps: [
            { id: 'bear', t: ['Добыть зелёный ключ', 'Get the green key'], d: ['Медведь-страж у пещеры.', 'The guardian bear at the cave.'],
              tip: ['Медведь медленный, но бьёт больно. Бей и отходи. Ружьё и дробовик помогают.', 'Bears are slow but hit hard. Hit and back off. Guns help.'],
              goal: { has: 'key_green', n: 1 }, target: 'guard:key_green', reward: { coins: 80 } },
            { id: 'squid', t: ['Освободить Кальмара', 'Free Squid'], d: ['Клетка рядом с пещерой.', 'The cage is by the cave.'],
              goal: { kids: 3 }, target: 'kid:squid', reward: { coins: 50 } },
            { id: 'cult', t: ['Добыть жёлтый ключ у культистов', 'Get the yellow key from the cult'], d: ['Главарь культистов носит его.', 'The cult leader carries it.'],
              goal: { has: 'key_yellow', n: 1 }, target: 'guard:key_yellow', reward: { coins: 90 } },
            { id: 'koala', t: ['Освободить Коалу', 'Free Koala'], d: ['Последняя клетка — в лагере культистов.', 'The last cage is in the cultist camp.'],
              goal: { kids: 4 }, target: 'kid:koala', reward: { coins: 60 } },
            { id: 'allHome', t: ['Привести всех детей в лагерь', 'Bring all kids to camp'], d: ['Все четверо должны жить у костра.', 'All four must live by the fire.'],
              goal: { ev: 'kidHome', n: 4 }, target: 'camp', reward: { coins: 100 } },
            { id: 'obelisk', t: ['Исследовать обелиск', 'Investigate the obelisk'], d: ['В глубине чащи стоит обелиск — там разгадка побега.', 'Deep in the thicket stands an obelisk — the key to escape.'],
              tip: ['Обелиск показывает, как позвать помощь: нужен сигнальный маяк.', 'The obelisk reveals how to call for help: a signal beacon.'],
              goal: { near: 'obelisk', r: 600 }, target: 'obelisk', reward: { coins: 40 } },
        ] },
        { id: 'c6', name: ['6. Побег', '6. Escape'], zone: 4, steps: [
            { id: 'beaconKit', t: ['Собрать сигнальный маяк', 'Build the signal beacon'], d: ['Верстак: маяк = 60 лома, 6 самоцветов, 2 двигателя, 2 рации.', 'Workbench: beacon = 60 scrap, 6 gems, 2 engines, 2 radios.'],
              tip: ['Двигатели и рации не неси в пресс — они нужны целыми! Ищи их в золотых сундуках и у ржавых машин.', 'Do not press engines and radios — keep them! Find them in golden chests and rusty cars.'],
              goal: { ev: 'craft:beacon_kit', n: 1 }, target: 'bench', reward: { coins: 120 } },
            { id: 'placeBeacon', t: ['Поставить маяк у лагеря', 'Place the beacon by camp'], d: ['Выбери маяк и поставь рядом с костром: ЛКМ.', 'Select the beacon and place it near the fire: LMB.'],
              goal: { ev: 'place:beacon', n: 1 }, target: 'camp', reward: { coins: 60 } },
            { id: 'activate', t: ['Подготовить маяк и победить Хозяина леса', 'Prepare the beacon and defeat the Warden'], d: ['Включи маяк: E. Настройка займёт 5 ночей. Для спасения победи Хозяина леса в 99-ю ночь.', 'Press E to start the beacon. Tuning takes 5 nights. Defeat the Warden on night 99 to secure your rescue.'],
              tip: ['Маяк готовит спасение, но не завершает забег. Запасай патроны, лечилки и ловушки к 99-й ночи.', 'The beacon prepares your rescue. Stock up on ammunition, healing and traps for night 99.'],
              goal: { fn: 'escape' }, target: 'beacon', reward: { coins: 300 } },
        ] },
    ],

    // ============================================================================ запуск
    init() {
        this.steps = [];
        this.chapters = this.DEF.map((c, ci) => { const from = this.steps.length; for (const s of c.steps) this.steps.push(Object.assign({ ch: ci }, s)); return { id: c.id, name: c.name, from, to: this.steps.length, zone: c.zone }; });
        this.seen = Store.getJSON(GAME_ID + '.tips', {});
        this.enabled = Store.get(GAME_ID + '.tut') !== '0';
        this._makeTipBox();
        if (!this.enabled) this._hideTutorialUI();
    },
    txt(pair) { return pair ? pair[Lang.code === 'en' ? 1 : 0] || pair[0] : ''; },
    // Тексты первых шагов для телефона и планшета: вместо клавиш — джойстик и кнопки на экране
    TOUCH: {
        camp: { tip: ['Джойстик слева — ходить, проведи пальцем по правой части экрана — камера. Справа кнопки: удар, прыжок, бег и ✋ «взять». Жёлтый луч и стрелка показывают, куда идти.', 'The left stick moves, swipe the right side of the screen to look around. Buttons on the right: attack, jump, run and ✋ grab. The yellow beam and arrow show where to go.'] },
        chop: { d: ['Подойди к дереву и держи кнопку удара.', 'Stand at a tree and hold the attack button.'] },
        logs: { tip: ['В начале доступно 6 ячеек. Мешок слева от хотбара открывает инвентарь, кнопка 🛒 вверху — магазин рюкзаков.', 'You start with 6 slots. The bag left of the hotbar opens the inventory, the 🛒 button at the top opens the backpack shop.'] },
        feed: { d: ['Выбери бревно в хотбаре, подойди к костру и нажми ✋.', 'Pick a log on the hotbar, stand at the fire and tap ✋.'] },
        berry: { d: ['Подойди к ягодному кусту или грядке и нажми ✋.', 'Go to a berry bush or the carrot patch and tap ✋.'], tip: ['Голод (вилка) убывает всегда. На нуле — урон. Еда собирается кнопкой ✋, а съедается кнопкой удара, когда она в руке.', 'Hunger (fork icon) always drains; at zero you take damage. Pick food with ✋ and eat it with the attack button while holding it.'] },
        eat: { d: ['Выбери еду в хотбаре и нажми кнопку удара.', 'Select food on the hotbar and press the attack button.'] },
    },
    // Мышь при экранном управлении (Playables на ПК): курсор свободен, камера — только зажатой правой кнопкой
    MOUSE: {
        camp: { tip: ['WASD или джойстик — ходить. Камера: зажми правую кнопку мыши и веди мышью. Shift — бег, Space — прыжок. Жёлтый луч и стрелка показывают, куда идти.', 'WASD or the joystick to move. Camera: hold the right mouse button and drag. Shift to run, Space to jump. The yellow beam and arrow show where to go.'] },
    },
    f(s, key) {
        const touch = (typeof Input !== 'undefined' && Input.isTouch) || (typeof IS_MOBILE !== 'undefined' && IS_MOBILE);
        const mouseUi = !touch && typeof UI !== 'undefined' && UI.touchVisible && UI.touchVisible();
        const t = (touch && this.TOUCH[s.id]) || (mouseUi && this.MOUSE[s.id]);
        return this.txt((t && t[key]) || s[key]);
    },

    reset() {
        this.i = 0; this.ev = {}; this.base = {}; this.escape = null; this._walk = 0; this.startDay = 1; this._stepShown = -1; this._lx = null;
        this._enterStep();
    },
    save() { return { i: this.i, ev: this.ev, base: this.base, esc: this.escape, sd: this.startDay }; },
    load(s) {
        this.reset();
        if (!s) return;
        this.i = Math.min(s.i || 0, this.steps.length); this.ev = s.ev || {}; this.base = s.base || Object.assign({}, this.ev); this.escape = s.esc || null; this.startDay = s.sd || Sky.day;
        this._stepShown = 0;
        this._enterStep(false, true);
    },
    // ---- переключатель «Подсказки и задания» (Store, на весь профиль): выключенный туториал не показывает цель, луч, карточки и не продвигается
    enabled: true,
    setEnabled(on) {
        this.enabled = !!on;
        Store.set(GAME_ID + '.tut', on ? '1' : '0');
        if (!on) this._hideTutorialUI();
        else if (this.steps.length) this.updateUI(true);
    },
    _hideTutorialUI() {
        this._target = null; this._hideBeacon(); this._hideTip(true);
        // Выбранная вручную метка ребёнка не принадлежит обучению.
        if (!Game.waypointKid) UI.setWaypoint(null);
        if (UI.objective?.key || (UI.el.objBox && UI.el.objBox.style.display !== 'none')) UI.setObjective('', 0, 0);
        if (UI.el.objDesc) { if (UI.el.objDesc.textContent) UI.el.objDesc.textContent = ''; if (UI.el.objDesc.style && UI.el.objDesc.style.display !== 'none') UI.el.objDesc.style.display = 'none'; }
    },
    current() { return this.steps[this.i] || null; },
    done() { return this.i >= this.steps.length; },

    // Событие из игры: счётчик растёт всегда, шаги считают разницу с момента своего старта
    event(name, n) {
        this.ev[name] = (this.ev[name] || 0) + (n == null ? 1 : n);
        // достижения и ежедневные задания считают те же события (срубленное дерево = 'chop' → 'tree')
        if (window.Ach) { try { Ach.event(name === 'chop' ? 'tree' : name, n); } catch (e) { /* не ломаем игру */ } }
    },
    since(name) { return (this.ev[name] || 0) - (this.base[name] || 0); },

    // keep — загрузка сохранения: счётчики шага (base) и день старта остаются как были, подсказка шага повторно не показывается
    _enterStep(silent, keep) {
        const s = this.current();
        if (!keep) this.base = Object.assign({}, this.ev);
        if (!s) { UI.setObjective('', 0, 0); this._hideBeacon(); return; }
        if (!keep) this.startDay = Sky.day;
        this.stepT = 0; this._tipShown = !!keep;
        if (!silent) this.updateUI(true);
    },

    // ============================================================================ проверка цели
    progress(s) {
        const g = s.goal || {};
        let cur = 0, max = 0, ok = false;
        if (g.ev) {
            max = g.n; cur = Math.min(max, this.since(g.ev));
            if (g.alt) { const c2 = Math.min(g.alt.n, this.since(g.alt.ev)); if (c2 >= g.alt.n) { cur = max; } }
            ok = cur >= max;
        } else if (g.stat) { max = g.n; cur = Math.min(max, Player.stats[g.stat] || 0); ok = cur >= max; }
        else if (g.has) { max = g.n; cur = Math.min(max, Inv.count(g.has)); ok = cur >= max; }
        else if (g.level) { max = g.level; cur = Math.min(max, Camp.level); ok = cur >= max; }
        else if (g.day) { max = 0; ok = Sky.day >= g.day; }
        else if (g.daysSince) { max = g.daysSince; cur = Math.min(max, Sky.day - this.startDay); ok = cur >= max; }
        else if (g.kids) { max = g.kids; cur = Math.min(max, Zones.rescuedCount()); ok = cur >= max; }
        else if (g.scrapCamp) { max = g.scrapCamp; cur = Math.min(max, Camp.scrap); ok = cur >= max || Camp.level >= 2; }
        else if (g.near) { const t = this.resolve(g.near); ok = !!t && Math.hypot(t.x - Player.x, t.z - Player.z) < (g.r || 500); }
        else if (g.fn === 'escape') { max = DATA.escapeNights; cur = this.escape ? Math.min(max, Math.max(0, Sky.day - this.escape.day)) : 0; ok = !!this.escape && cur >= max && !!Events.bossDown && !(Enemies.boss && Enemies.boss.alive); }
        return { cur, max, ok };
    },

    update(dt) {
        if (!this.enabled) { this._hideTutorialUI(); return; }
        if (this.i === 0 && this._stepShown === -1) { this._stepShown = 0; this._enterStep(); }
        this._t -= dt; this._tipT -= dt;
        // пройденный путь: нужен шагам без счётчика
        if (this._lx != null) this._walk += Math.hypot(Player.x - this._lx, Player.z - this._lz);
        this._lx = Player.x; this._lz = Player.z;
        if (this._tipT < 0 && this.tipEl && this.tipEl._on && performance.now() > this.tipEl._until) this._hideTip();
        this._updateBeacon(dt);
        if (this._t > 0) return;
        this._t = 0.25;
        const s = this.current();
        if (!s) return;
        this.stepT = (this.stepT || 0) + 0.25;
        if (!this._tipShown && this.stepT > 1.2 && s.tip) { this._tipShown = true; this.showTip(this.txt(s.t), this.f(s, 'tip'), 14); }
        const p = this.progress(s);
        this._p = p;
        if (p.ok) { this.complete(s); return; }
        this.updateUI(false);
    },

    complete(s) {
        const r = s.reward || {};
        UI.toast(Lang.t('q.done') + ' ' + this.txt(s.t), 'good'); Sfx.ui('rescue');
        if (r.coins) Econ.dropCoins(Player.x + Math.sin(Player.faceYaw) * 160, Player.z + Math.cos(Player.faceYaw) * 160, r.coins, 'quest');
        for (const [id, n] of r.items || []) { const left = Inv.add(id, n); if (left > 0) Items.spawn(id, left, Player.x + 80, Player.z + 40, { y: Player.y + 130 }); else UI.pickupFeed(id, n); }
        FX.ring(Player.x, Player.y + 20, Player.z, 500, '#b6ff9a');
        const chapterEnd = this.chapters.find(c => c.to === this.i + 1);
        this.i++;
        // Концовкой владеет Events/Game: готовый маяк не обходит живого босса.
        if (chapterEnd) { const c = chapterEnd; UI.banner(Lang.t('q.chapterDone'), this.txt(c.name), '#ffe066'); Sfx.ui('fanfare'); Econ.dropCoins(Player.x, Player.z, 40 + c.to, 'chapter'); }
        if (this.i >= this.steps.length) { UI.banner(Lang.t('q.allDone'), Lang.t('q.allDoneSub'), '#ffe066'); this._hideBeacon(); UI.setObjective('o.nights', Math.min(99, Sky.day), 99, {}); UI.setWaypoint(null); }
        else this._enterStep();
        if (Game.autosave) Game.autosave();
    },

    // ============================================================================ цели-указатели
    resolve(spec) {
        if (!spec || spec === 'none') return null;
        const px = Player.x, pz = Player.z;
        const nearest = (list, fx) => { let b = null, bd = 1e18; for (const o of list) { const d = (o.x - px) ** 2 + (o.z - pz) ** 2; if (d < bd) { bd = d; b = o; } } return b; };
        if (spec === 'camp') return { x: Camp.x, z: Camp.z, y: Camp.y + 250 };
        if (spec === 'bench') { const b = Camp.props.bench; return b ? { x: b.x, z: b.z, y: b.y + 240 } : null; }
        if (spec === 'scrapper') { const b = Camp.props.scrapper; return b ? { x: b.x, z: b.z, y: b.y + 260 } : null; }
        if (spec === 'pot') { const b = Camp.props.potPos; return b ? { x: b.x, z: b.z, y: Camp.y + 180 } : null; }
        if (spec === 'board') { const b = Camp.props.board; return b ? { x: b.x, z: b.z, y: b.y + 260 } : null; }
        if (spec === 'sleep') { const b = Camp.props.sleeps && Camp.props.sleeps[0]; return b ? { x: b.x, z: b.z, y: Camp.y + 160 } : null; }
        if (spec === 'tree') { const t = nearest(World.trees.filter(t => t.alive)); return t ? { x: t.x, z: t.z, y: (t.y || 0) + 420 } : null; }
        if (spec === 'berry') { const r = nearest(World.resources.filter(r => r.ready && r.kind === 'berry')) || nearest(Zones.crops.filter(c => c.ready)); return r ? { x: r.x, z: r.z, y: World.heightAt(r.x, r.z) + 200 } : null; }
        if (spec === 'log') { const it = nearest(Items.list.filter(i => i.id === 'log')); if (it) return { x: it.x, z: it.z, y: it.y + 140 }; return this.resolve('tree'); }
        if (spec === 'scrap') {
            const it = nearest(Items.list.filter(i => DATA.scrapValue(i.id) > 0 && i.ground));
            if (it) return { x: it.x, z: it.z, y: it.y + 160 };
            const sp = nearest(Zones.lootSpots.map(a => ({ x: a[0], z: a[1] })));
            if (sp) return { x: sp.x, z: sp.z, y: World.heightAt(sp.x, sp.z) + 260 };
            return this.resolve('scrapper');
        }
        if (spec === 'chest') { const c = nearest(Zones.chests.filter(c => !c.opened)); return c ? { x: c.x, z: c.z, y: World.heightAt(c.x, c.z) + 240 } : null; }
        if (spec === 'pond') { const p = (Zones.ponds || [])[0]; return p ? { x: p.x + 560, z: p.z, y: World.heightAt(p.x, p.z) + 240 } : null; }
        if (spec === 'well') { const w = nearest(Zones.wells); return w ? { x: w.x, z: w.z, y: World.heightAt(w.x, w.z) + 240 } : null; }
        if (spec === 'obelisk') { const o = Zones.obeliskPos; return o ? { x: o.x, z: o.z, y: World.heightAt(o.x, o.z) + 500 } : null; }
        if (spec === 'beacon') { const b = Camp.beaconPos; return b ? { x: b.x, z: b.z, y: World.heightAt(b.x, b.z) + 300 } : null; }
        if (spec.startsWith('site:')) { const s = Zones.siteById(spec.slice(5)); return s ? { x: s.x, z: s.z, y: World.heightAt(s.x, s.z) + 400 } : null; }
        if (spec.startsWith('kid:')) { const k = Zones.kids.find(k => k.def.id === spec.slice(4)); if (k) return { x: k.x, z: k.z, y: World.heightAt(k.x, k.z) + 340 }; const d = DATA.kids.find(k => k.id === spec.slice(4)); const s = d && Zones.sites.find(s => s.name === d.marker); return s ? { x: s.x, z: s.z, y: World.heightAt(s.x, s.z) + 400 } : null; }
        if (spec.startsWith('guard:')) { const key = spec.slice(6); const e = Enemies.list.find(e => e.alive && e.guard && e.guard.key === key); if (e) return { x: e.x, z: e.z, y: e.y + 300 }; const k = DATA.kids.find(k => k.key === key); const s = k && Zones.sites.find(s => s.name === k.marker); return s ? { x: s.x, z: s.z, y: World.heightAt(s.x, s.z) + 400 } : null; }
        if (spec.startsWith('enemy:')) { const e = nearest(Enemies.list.filter(e => e.alive && e.type === spec.slice(6))); return e ? { x: e.x, z: e.z, y: e.y + 260 } : null; }
        return null;
    },

    updateUI(force) {
        if (!this.enabled) { this._hideTutorialUI(); return; }
        const s = this.current();
        if (!s) return;
        const p = this._p && !force ? this._p : this.progress(s);
        UI.setObjective(this.txt(s.t), p.cur, p.max, {});
        if (UI.el.objDesc) UI.el.objDesc.textContent = this.f(s, 'd');
        // стрелка и луч на цель (путевая точка доски детей важнее)
        if (!Game.waypointKid) {
            this._rt = (this._rt || 0) - 0.25;
            if (force || this._rt <= 0 || !this._target) { this._rt = 1; this._target = this.track ? this.resolve(s.target) : null; }
            const t = this._target;
            UI.setWaypoint(t ? { x: t.x, y: t.y + 60, z: t.z } : null);
        } else this._target = null;
    },

    // --- луч света над целью
    _makeBeacon() {
        const scene = Game.view.scene;
        const beam = BABYLON.MeshBuilder.CreateCylinder('qBeam', { diameter: 46, height: 2600, tessellation: 14, cap: BABYLON.Mesh.NO_CAP }, scene);
        const m = new BABYLON.StandardMaterial('qBeamMat', scene);
        m.disableLighting = true; m.emissiveColor = new BABYLON.Color3(1, 0.86, 0.3); m.alpha = 0.2; m.backFaceCulling = false; m.disableDepthWrite = true; m.fogEnabled = false;
        m.metadata = { toon: false, mist: false };
        beam.material = m; beam.isPickable = false; beam.renderingGroupId = 1; beam.alwaysSelectAsActiveMesh = true;
        const arrow = BABYLON.MeshBuilder.CreateCylinder('qArrow', { diameterTop: 0, diameterBottom: 70, height: 100, tessellation: 4 }, scene);
        arrow.rotation.x = Math.PI;
        const a = new BABYLON.StandardMaterial('qArrowMat', scene);
        a.disableLighting = true; a.emissiveColor = new BABYLON.Color3(1, 0.9, 0.25); a.fogEnabled = false; a.metadata = { toon: false, mist: false };
        arrow.material = a; arrow.isPickable = false; arrow.renderingGroupId = 1; arrow.alwaysSelectAsActiveMesh = true;
        this.beacon = { beam, arrow, t: 0 };
    },
    _hideBeacon() { if (this.beacon) { this.beacon.beam.setEnabled(false); this.beacon.arrow.setEnabled(false); } },
    _updateBeacon(dt) {
        const t = this._target;
        if (!t || !this.track || UI.modal || Game.state !== 'play') { this._hideBeacon(); return; }
        if (!this.beacon) this._makeBeacon();
        const b = this.beacon;
        b.t += dt;
        const d = Math.hypot(t.x - Player.x, t.z - Player.z);
        const on = d > 200;
        b.beam.setEnabled(on); b.arrow.setEnabled(on);
        const gy = World.heightAt(t.x, t.z);
        b.beam.position.set(t.x, gy + 1300, t.z);
        b.arrow.position.set(t.x, (t.y || gy + 300) + Math.sin(b.t * 3) * 25, t.z);
        b.arrow.rotation.y = b.t * 1.6;
        b.beam.material.alpha = 0.14 + 0.08 * Math.sin(b.t * 2.4);
    },
    toggleTrack() { this.track = !this.track; UI.toast(Lang.t(this.track ? 'q.trackOn' : 'q.trackOff'), 'info'); this.updateUI(true); },

    // ============================================================================ подсказки
    _makeTipBox() {
        if (this.tipEl || !UI.root) return;
        const e = document.createElement('div');
        // ✕ в углу — заметная кнопка «скрыть» (на телефоне подпись «нажми, чтобы скрыть» не видна); вся карточка тоже закрывает
        e.id = 'tipBox'; e.innerHTML = '<div class="tx" role="button">' + UI.svg.x + '</div><div class="tt rb2"></div><div class="tb rb1"></div><div class="tk rb1"></div>';
        UI.root.appendChild(e);
        this.tipEl = /** @type {any} */ (e); this.tipEl._on = false;
        const x = /** @type {HTMLElement} */ (e.querySelector('.tx'));
        x.setAttribute('aria-label', Lang.t('q.tipHide'));
        x.onclick = (ev) => { ev.stopPropagation(); Sfx.ui('cancel'); this._hideTip(); };
        e.onclick = () => this._hideTip();
    },
    showTip(title, text, secs) {
        if (!this.enabled) return;
        this._makeTipBox();
        const e = this.tipEl; if (!e) return;
        e.style.display = '';
        e.querySelector('.tt').textContent = title; e.querySelector('.tb').textContent = text; e.querySelector('.tk').textContent = Lang.t('q.tipHide');
        e.classList.add('show'); e._on = true; e._until = performance.now() + (secs || 10) * 1000; this._tipT = 1;
        Sfx.ui('page');
    },
    _hideTip(immediate) { if (this.tipEl) { this.tipEl.classList.remove('show'); this.tipEl._on = false; if (immediate) this.tipEl.style.display = 'none'; } },
    // Подсказка, показываемая один раз за всю игру
    tipOnce(id, ru, en, secs) {
        if (!this.enabled) return;
        if (this.seen[id]) return;
        this.seen[id] = 1; Store.set(GAME_ID + '.tips', JSON.stringify(this.seen));
        this.showTip(Lang.t('q.tip'), Lang.code === 'en' ? en : ru, secs || 11);
    },
    // Контекстные подсказки: вызываются из игрового цикла раз в секунду
    contextTips() {
        if (!this.enabled || Game.state !== 'play' || UI.modal) return;
        if (Sky.day >= 2) this.tipOnce('survivorArmor', 'Опыт выживания снижает урон зверей с каждым днём (до 46%). Уровни костра и спасённые дети усиливают защиту и помогают даже против босса. Точная защита указана в паузе.', 'Survival experience reduces beast damage each day, up to 46%. Fire upgrades and rescued children add protection, including against the boss. See your protection in the pause menu.');
        if (Camp.level >= 2) this.tipOnce('weaponUpgrade', 'У верстака можно улучшить оружие до +3. Ловушки и баррикады изнашиваются: подойди к повреждённой постройке с ресурсами и нажми E для ремонта.', 'Upgrade weapons to +3 at the workbench. Traps and barricades wear out: bring resources to a damaged structure and press E to repair it.');
        if (Player.atFog) this.tipOnce('fog', 'Это стена тумана — граница открытой зоны. Улучшай костёр, чтобы отодвинуть туман и открыть новые земли.', 'That is the fog wall — the edge of the open zone. Upgrade the fire to push it back and open new lands.');
        if (Sky.isNight() && Sky.daylight < 0.25) this.tipOnce('night', 'Наступила ночь. Вернись к костру и держи его горящим — зверей отпугивает свет. Поспать можно в спальнике (E).', 'Night has fallen. Return to the fire and keep it burning — light scares beasts. You can sleep in a bag (E).');
        if (Player.hunger < 35) this.tipOnce('hunger', 'Ты голоден! Ешь ягоды, морковь, жареное мясо или рыбу: выбери еду в хотбаре и нажми ЛКМ.', 'You are hungry! Eat berries, carrots, cooked meat or fish: select food on the hotbar and press LMB.');
        if (Player.hp < 35) this.tipOnce('hp', 'Мало здоровья! Используй бинт или аптечку (выбрать и ЛКМ), сядь у костра или выпей из колодца.', 'Low health! Use a bandage or medkit (select + LMB), rest by the fire or drink at a well.');
        if (Camp.fuel / Camp.cap < 0.2 && Camp.lit) this.tipOnce('fuel', 'Костёр почти погас! Подкинь брёвна: выбери бревно и нажми E у огня.', 'The fire is nearly out! Add logs: select a log and press E at the fire.');
        if (Inv.has('grenade') || Inv.has('grenade_flash')) this.tipOnce('grenade', 'Граната: выбери её в быстром доступе и нажми ЛКМ — бросок в точку прицела. Взрыв через 2 секунды ранит и тебя: держись дальше 6 метров!', 'Grenade: select it on the hotbar and click — it is thrown at your aim point. It explodes after 2 seconds and hurts you too: stay 6+ meters away!');
        if (Inv.slots.every(Boolean)) this.tipOnce('bag', 'Сумка полна. Открой инвентарь (Tab): лишнее выбрасывай, хлам неси к прессу. Рюкзак побольше можно купить в магазине (K).', 'Your bag is full. Open the inventory (Tab): drop extras and press junk at the camp. A bigger backpack is sold in the shop (K).');
        if (Player.stamina < 12) this.tipOnce('stamina', 'Выносливость на нуле: бег и прыжки тратят её. Постой — восстановится.', 'Out of stamina: running and jumping drain it. Stand still to recover.');
        if (Zones.kids.some(k => k.state === 'caged' && Math.hypot(k.x - Player.x, k.z - Player.z) < 900)) this.tipOnce('cage', 'Ребёнок в клетке! Нужен ключ нужного цвета (его носит страж зоны). Подойди и нажми E.', 'A kid in a cage! You need the matching key (carried by the zone guard). Step close and press E.');
    },
    replayTips() {
        this.seen = {}; Store.set(GAME_ID + '.tips', '{}'); this.setEnabled(true);
        this._tipShown = false; this.stepT = 0; this._hideTip(true);
        // Меню и пауза остаются открытыми: их кнопка выводит совет внутри панели.
        // Повтор не сбрасывает выполненные задания и счётчики текущего шага.
        const s = this.current() || this.steps[0];
        const tip = { title: this.txt(s.t), text: this.f(s, 'tip') || this.f(s, 'd') };
        if (Game.state === 'play' && !UI.modal) { this.showTip(tip.title, tip.text, 14); this._tipShown = true; }
        return tip;
    },
};

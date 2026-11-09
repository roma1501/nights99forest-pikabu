// Lang.js — тексты интерфейса игры (I18N). Все видимые строки — ключами в
// LANG_STRINGS, в коде — Lang.t('ключ', { имя: значение }) с подстановкой {имя},
// в разметке — атрибуты data-t="ключ" (текст), data-t-title, data-t-placeholder
// (Lang.apply() проставляет их после init и смены языка).
//
// Язык — GAME_LANG (Constants.js): сборка ставит ru для Яндекса и en для Playables.
// Видимого переключателя языка нет. LANG_AUTO = 1 — язык платформы (Platform.lang),
// если он есть в словаре. Нет строки в языке — английская, нет и её — сам ключ.
// Новая строка = ключ в ОБОИХ словарях.

const LANG_STRINGS = {
    ru: {
        'loading': 'Загрузка…',
        'loadingScene': 'Готовим первый кадр…',
        'loadingReady': 'Готово',
        'loadingFailed': 'Не удалось загрузить. Попробуйте ещё раз.',
        'loadingRetry': 'Повторить',
        'no3d': '3D недоступен: браузер без WebGL',
        // общее
        'day': 'День', 'ok': 'ОК', 'yes': 'Да', 'no': 'Нет',
        'bagFull': 'Мешок полон', 'noAmmo': 'Нет патронов', 'hpFull': 'Здоровье полное',
        'lockHint': 'Мышь вращает камеру. Клик по игре — захватить курсор', 'flashOn': 'Фонарь включён', 'flashOff': 'Фонарь выключен',
        'fireLv': 'Костёр · ур. {n}',
        'needMore': 'Не хватает ресурсов', 'crafted': 'Создано: {n}',
        // подсказки E
        'pIn.pickup': 'Подобрать: {item}',
        'p.feed': 'Подкинуть в костёр', 'p.fire': 'Костёр', 'fireSub': 'Уровень {lv} · топливо {pct}%',
        'p.bench': 'Верстак', 'scrapHave': 'Лом: {n}',
        'p.scrapper': 'Пресс для лома', 'scrapCarry': 'В мешке хлама на {n} лома', 'scrapNone': 'Принеси хлам: болты, шины, радио…', 'noScrap': 'В мешке нет хлама',
        'p.board': 'Доска пропавших детей',
        'p.pot': 'Котелок', 'potHint': 'Возьми в руки сырой стейк или морковь', 'p.cookSteak': 'Пожарить стейк', 'p.cookStew': 'Сварить рагу', 'p.cooking': 'Готовится… {s} с', 'p.cookTake': 'Забрать готовое',
        'stewNeed': 'Рагу: 1 сырой стейк + 2 моркови',
        'p.sleep': 'Спать', 'notTired': 'Спать можно с наступлением вечера', 'fireLow': 'Костёр слишком слаб: подкинь дров, иначе олень придёт во сне', 'notSafe': 'Рядом враги — сейчас не уснуть',
        'p.pile': 'Взять бревно', 'pileLeft': 'В поленнице: {n}', 'pileEmpty': 'Поленница пуста — руби деревья',
        'p.pickStruct': 'Забрать',
        'p.cage': 'Клетка с ребёнком', 'p.useKey': 'Открыть замок ключом', 'needKey': 'Нужен предмет: {key}', 'needKeyShort': 'Нужен: {key}',
        'p.chest': 'Открыть сундук', 'p.chestGold': 'Открыть золотой сундук', 'p.berry': 'Собрать ягоды', 'p.mushroom': 'Сорвать гриб',
        // события
        'fireUp': 'Костёр · уровень {n}!', 'fireUpSub': 'Лес открылся дальше', 'fireOut': 'Костёр погас!', 'fireLowWarn': 'Костёр догорает — нужны дрова!',
        'goodMorning': 'Доброе утро', 'dayN': 'День {n}',
        'duskT': 'Вечереет…', 'duskS': 'Подготовь костёр', 'nightT': 'Ночь {n}', 'nightS': 'Не выходи из света', 'dayT': 'День {n}', 'daySurvived': 'Ночь пережита',
        'startHint': 'Найди топор в руках и руби деревья', 'fogWall': 'Туман слишком густой. Улучши костёр, чтобы идти дальше.',
        'objDone': 'Задача выполнена!', 'kidHome': '{n} дома, у костра', 'keyDropped': 'Выпал ключ!',
        'raid': 'Рейд культистов!', 'raidSub': 'Защити лагерь', 'deerComes': 'Олень выходит…', 'deerComesSub': 'Не выходи из света костра', 'deerFled': 'Олень бежит!', 'deerStunned': 'Олень ослеплён!', 'deerStunnedSub': 'Бей его!',
        'deerSleep': 'Олень пришёл во сне!', 'fireLowSub': 'Костёр почти погас',
        'kidSaved': '{n} спасён(а)!', 'kidSavedSub': 'Веди домой, к костру',
        'kid.dino': 'Дино', 'kid.kraken': 'Кракен', 'kid.squid': 'Кальмар', 'kid.koala': 'Коала',
        'kidhint.dino': 'Пропал у логова волков.', 'kidhint.kraken': 'Заперта у стаи альф.', 'kidhint.squid': 'Спрятан в медвежьей пещере.', 'kidhint.koala': 'Держат в лагере культистов.',
        'kidNeed': '{k} · костёр ур. {f}', 'kidState.done': 'Спасён', 'kidState.locked': 'Костёр ур. {f}', 'kidState.missing': 'Пропал',
        // цели
        'o.fire': 'Руби деревья и клади дрова в костёр', 'o.night1': 'Переживи ночь: держи костёр и ложись спать', 'o.scrap': 'Неси хлам в пресс — нужен лом', 'o.upgrade': 'Улучши костёр до уровня 2 (F у огня)',
        'o.craft': 'Скрафти что-нибудь на верстаке', 'o.kids': 'Спаси пропавших детей (доска у костра)', 'o.nights': 'Переживи 99 ночей',
        // меню
        'titleNights': 'NIGHTS', 'titleForest': 'IN THE FOREST', 'menu.play': 'Играть', 'menu.continue': 'Продолжить', 'menu.new': 'Новая игра', 'menu.outfit': 'Наряд', 'menu.help': 'Как играть', 'menu.settings': 'Настройки',
        'best': 'Рекорд: {n} ночей', 'confirmNewT': 'Начать заново?', 'confirmNewS': 'Текущее сохранение будет стёрто.',
        'pause.title': 'Пауза', 'pause.resume': 'Продолжить', 'pause.menu': 'В меню',
        'set.sfx': 'Звуки', 'set.music': 'Музыка', 'set.sens': 'Чувствительность мыши', 'set.sound': 'Звук', 'set.soundOn': 'Включён', 'set.soundOff': 'Выключен', 'set.screen': 'Экран', 'set.fullscreen': 'Во весь экран',
        'set.quality': 'Качество', 'set.q1': 'Низкое', 'set.q2': 'Среднее', 'set.q3': 'Высокое',
        'help.move': 'Ходьба', 'help.sprint': 'Бег (тратит силы)', 'help.jump': 'Прыжок', 'help.interact': 'Взаимодействие / подкинуть дрова', 'help.mouseL': 'ЛКМ', 'help.attack': 'Удар / выстрел / использовать', 'help.slots': 'Выбор предмета',
        'help.drop': 'Выбросить', 'help.rotate': 'Повернуть постройку', 'help.board': 'Карта', 'help.pause': 'Пауза',
        'help.tips': 'Кормите костёр дровами, ешьте, спите у огня — и не выходите из света ночью. Свет фонаря на Оленя ослепляет его.',
        'outfit.h1': 'Бекон', 'outfit.h2': 'Хвост', 'outfit.h3': 'Короткая', 'outfit.hairC': 'Цвет волос', 'outfit.shirt': 'Футболка', 'outfit.jacket': 'Куртка', 'outfit.pants': 'Штаны', 'outfit.skin': 'Кожа',
        // верстак и костёр
        'craft.title': 'Верстак', 'craft.do': 'Создать', 'sackTier': 'Мешок {n} · {s} мест', 'scrapName': 'Лом',
        'fire.title': 'Костёр · уровень {n}', 'fire.fuel': 'Топливо: {a} / {b}', 'fire.max': 'Костёр достиг максимума — весь лес открыт.', 'fire.next': 'Уровень {n}: туман отступит до {m} м', 'fire.up': 'Улучшить костёр',
        'board.title': 'Пропавшие дети', 'board.hint': 'Нажми на плакат — стрелка укажет путь. Для каждого нужен свой ключ от стражей.', 'board.clear': 'Убрать метку',
        'st.day': 'день', 'st.kids': 'дети', 'st.kills': 'убито', 'st.chests': 'сундуков', 'st.nights': 'ночей', 'st.best': 'рекорд',
        // смерть и финал
        'death.title': 'Ты погиб', 'death.retry': 'Ещё раз', 'death.hunger': 'Голод сломил тебя.', 'death.deer': 'Олень добрался до тебя.', 'death.bite': 'Волки растерзали тебя.', 'death.maul': 'Медведь оказался сильнее.',
        'death.stab': 'Культисты не знают пощады.', 'death.bolt': 'Болт культиста попал в цель.', 'death.shot': 'Пуля нашла цель.', 'death.fall': 'Слишком высокое падение.', 'death.x': 'Лес забрал ещё одного.',
        'end.goodT': 'Ты выжил!', 'end.goodS': '99 ночей позади, дети дома. Олень смотрит издалека… и исчезает в тумане.', 'end.badT': 'Ты выжил… но не все спасены', 'end.badS': 'Спасено детей: {k} из 4. Лес хранит остальных.', 'end.failT': 'Лес победил', 'end.failS': 'Этот поход окончен. Спасено детей: {k} из 4.', 'end.again': 'Новая игра',
        // предметы
        'item.axe_old': 'Старый топор', 'item.axe_good': 'Хороший топор', 'item.axe_strong': 'Крепкий топор', 'item.chainsaw': 'Бензопила', 'item.flashlight': 'Фонарик', 'item.spear': 'Копьё', 'item.katana': 'Катана',
        'item.revolver': 'Револьвер', 'item.rifle': 'Винтовка', 'item.compass': 'Компас', 'item.carrot': 'Морковь', 'item.berry': 'Ягоды', 'item.steak_raw': 'Сырой стейк', 'item.steak_cooked': 'Стейк', 'item.stew': 'Рагу',
        'item.bandage': 'Бинт', 'item.medkit': 'Аптечка', 'item.log': 'Бревно', 'item.coal': 'Уголь', 'item.canister': 'Канистра', 'item.bolt': 'Болт', 'item.sheet': 'Лист металла', 'item.fan': 'Сломанный вентилятор',
        'item.radio': 'Старое радио', 'item.tire': 'Шина', 'item.engine': 'Двигатель', 'item.gem': 'Самоцвет', 'item.diamond': 'Алмаз', 'item.pelt': 'Шкура', 'item.bunny_foot': 'Кроличья лапка', 'item.seed': 'Семена',
        'item.ammo_rev': 'Патроны к револьверу', 'item.ammo_rifle': 'Патроны к винтовке', 'item.key_red': 'Красный ключ', 'item.key_blue': 'Синий ключ', 'item.key_green': 'Зелёный ключ', 'item.key_yellow': 'Жёлтый ключ',
        'item.torch': 'Факел', 'item.wire': 'Колючая проволока', 'item.spikes': 'Шипы', 'item.beartrap': 'Капкан', 'item.sack1': 'Хороший мешок', 'item.sack2': 'Гигантский мешок',
        'itemd.axe_good': 'Рубит деревья быстрее.', 'itemd.axe_strong': 'Валит дерево за пару ударов.', 'itemd.chainsaw': 'Почти мгновенно рубит и режет врагов.', 'itemd.spear': 'Длинный колющий удар.',
        'itemd.katana': 'Быстрая и острая.', 'itemd.revolver': 'Точный выстрел с дальней дистанции.', 'itemd.rifle': 'Мощная винтовка.', 'itemd.ammo_rev': 'Пачка патронов.', 'itemd.ammo_rifle': 'Пачка патронов.',
        'itemd.bandage': 'Лечит немного.', 'itemd.medkit': 'Лечит полностью.', 'itemd.torch': 'Ставится на землю, освещает.', 'itemd.wire': 'Замедляет и ранит врагов.', 'itemd.spikes': 'Колет всех, кто наступит.',
        'itemd.beartrap': 'Ловит зверя на несколько секунд.', 'itemd.compass': 'Открывает доску пропавших.', 'itemd.sack1': '8 мест в мешке.', 'itemd.sack2': '12 мест в мешке.',
    },
    en: {
        'loading': 'Loading…',
        'loadingScene': 'Preparing the first frame…',
        'loadingReady': 'Ready',
        'loadingFailed': 'Loading failed. Please try again.',
        'loadingRetry': 'Retry',
        'no3d': '3D is unavailable: no WebGL in this browser',
        'day': 'Day', 'ok': 'OK', 'yes': 'Yes', 'no': 'No',
        'bagFull': 'Bag is full', 'noAmmo': 'No ammo', 'hpFull': 'Health is full',
        'lockHint': 'Move the mouse to look around. Click the game to capture the cursor', 'flashOn': 'Flashlight on', 'flashOff': 'Flashlight off',
        'fireLv': 'Campfire · Lv.{n}',
        'needMore': 'Not enough resources', 'crafted': 'Crafted: {n}',
        'pIn.pickup': 'Pick up {item}',
        'p.feed': 'Feed the fire', 'p.fire': 'Campfire', 'fireSub': 'Level {lv} · fuel {pct}%',
        'p.bench': 'Workbench', 'scrapHave': 'Scrap: {n}',
        'p.scrapper': 'Scrapper', 'scrapCarry': 'Junk worth {n} scrap in your bag', 'scrapNone': 'Bring junk: bolts, tires, radios…', 'noScrap': 'No junk in your bag',
        'p.board': 'Missing Kids Board',
        'p.pot': 'Cooking Pot', 'potHint': 'Hold raw steak or a carrot', 'p.cookSteak': 'Cook steak', 'p.cookStew': 'Make stew', 'p.cooking': 'Cooking… {s}s', 'p.cookTake': 'Take the food',
        'stewNeed': 'Stew: 1 raw steak + 2 carrots',
        'p.sleep': 'Sleep', 'notTired': 'You can sleep once evening comes', 'fireLow': 'The fire is too weak: add fuel or the Deer will come in your sleep', 'notSafe': 'Enemies nearby — you cannot sleep now',
        'p.pile': 'Take a log', 'pileLeft': 'In the pile: {n}', 'pileEmpty': 'The pile is empty — chop some trees',
        'p.pickStruct': 'Pick up',
        'p.cage': 'Caged child', 'p.useKey': 'Unlock with the key', 'needKey': 'You need: {key}', 'needKeyShort': 'Needs: {key}',
        'p.chest': 'Open chest', 'p.chestGold': 'Open golden chest', 'p.berry': 'Pick berries', 'p.mushroom': 'Pick mushroom',
        'fireUp': 'Campfire · Level {n}!', 'fireUpSub': 'The forest opens up', 'fireOut': 'The fire went out!', 'fireLowWarn': 'The fire is dying — it needs wood!',
        'goodMorning': 'Good morning', 'dayN': 'Day {n}',
        'duskT': 'Dusk is falling…', 'duskS': 'Get the fire ready', 'nightT': 'Night {n}', 'nightS': 'Stay in the light', 'dayT': 'Day {n}', 'daySurvived': 'You survived the night',
        'startHint': 'Chop trees with your axe', 'fogWall': 'The fog is too thick. Upgrade the campfire to go further.',
        'objDone': 'Objective complete!', 'kidHome': '{n} is home by the fire', 'keyDropped': 'A key dropped!',
        'raid': 'Cultist raid!', 'raidSub': 'Defend the camp', 'deerComes': 'The Deer is coming…', 'deerComesSub': 'Stay in the firelight', 'deerFled': 'The Deer flees!', 'deerStunned': 'The Deer is blinded!', 'deerStunnedSub': 'Hit it!',
        'deerSleep': 'The Deer came while you slept!', 'fireLowSub': 'The fire was nearly out',
        'kidSaved': '{n} rescued!', 'kidSavedSub': 'Lead them home to the fire',
        'kid.dino': 'Dino', 'kid.kraken': 'Kraken', 'kid.squid': 'Squid', 'kid.koala': 'Koala',
        'kidhint.dino': 'Vanished near the wolf den.', 'kidhint.kraken': 'Locked up by the alpha pack.', 'kidhint.squid': 'Hidden in the bear cave.', 'kidhint.koala': 'Held in the cultist camp.',
        'kidNeed': '{k} · campfire Lv.{f}', 'kidState.done': 'Rescued', 'kidState.locked': 'Campfire Lv.{f}', 'kidState.missing': 'Missing',
        'o.fire': 'Chop trees then place wood on the fire', 'o.night1': 'Survive the night: keep the fire lit and go to sleep', 'o.scrap': 'Bring junk to the Scrapper — you need scrap', 'o.upgrade': 'Upgrade the campfire to level 2 (F at the fire)',
        'o.craft': 'Craft something at the workbench', 'o.kids': 'Rescue the missing children (check the board)', 'o.nights': 'Survive 99 nights',
        'titleNights': 'NIGHTS', 'titleForest': 'IN THE FOREST', 'menu.play': 'Play', 'menu.continue': 'Continue', 'menu.new': 'New game', 'menu.outfit': 'Outfit', 'menu.help': 'How to play', 'menu.settings': 'Settings',
        'best': 'Best: {n} nights', 'confirmNewT': 'Start over?', 'confirmNewS': 'Your current save will be erased.',
        'pause.title': 'Paused', 'pause.resume': 'Resume', 'pause.menu': 'Main menu',
        'set.sfx': 'Sound effects', 'set.music': 'Music', 'set.sens': 'Mouse sensitivity', 'set.sound': 'Sound', 'set.soundOn': 'On', 'set.soundOff': 'Off', 'set.screen': 'Screen', 'set.fullscreen': 'Fullscreen',
        'set.quality': 'Quality', 'set.q1': 'Low', 'set.q2': 'Medium', 'set.q3': 'High',
        'help.move': 'Move', 'help.sprint': 'Sprint (uses stamina)', 'help.jump': 'Jump', 'help.interact': 'Interact / feed the campfire', 'help.mouseL': 'LMB', 'help.attack': 'Hit / shoot / use', 'help.slots': 'Select item',
        'help.drop': 'Drop', 'help.rotate': 'Rotate placement', 'help.board': 'Map', 'help.pause': 'Pause',
        'help.tips': 'Feed the fire, eat, sleep by the flames — and never leave the light at night. Shine your flashlight at the Deer to blind it.',
        'outfit.h1': 'Bacon', 'outfit.h2': 'Ponytail', 'outfit.h3': 'Short', 'outfit.hairC': 'Hair color', 'outfit.shirt': 'Shirt', 'outfit.jacket': 'Jacket', 'outfit.pants': 'Pants', 'outfit.skin': 'Skin',
        'craft.title': 'Workbench', 'craft.do': 'Craft', 'sackTier': 'Sack {n} · {s} slots', 'scrapName': 'Scrap',
        'fire.title': 'Campfire · Level {n}', 'fire.fuel': 'Fuel: {a} / {b}', 'fire.max': 'The campfire is at max level — the whole forest is open.', 'fire.next': 'Level {n}: the fog pushes back to {m} m', 'fire.up': 'Upgrade campfire',
        'board.title': 'Missing Kids', 'board.hint': 'Tap a poster — an arrow will point the way. Each child needs a key from their guards.', 'board.clear': 'Clear marker',
        'st.day': 'day', 'st.kids': 'kids', 'st.kills': 'kills', 'st.chests': 'chests', 'st.nights': 'nights', 'st.best': 'best',
        'death.title': 'You died', 'death.retry': 'Try again', 'death.hunger': 'Hunger got you.', 'death.deer': 'The Deer caught you.', 'death.bite': 'The wolves tore you apart.', 'death.maul': 'The bear was stronger.',
        'death.stab': 'The cultists show no mercy.', 'death.bolt': 'A cultist bolt found its mark.', 'death.shot': 'A bullet found its mark.', 'death.fall': 'That was a long fall.', 'death.x': 'The forest claimed another.',
        'end.goodT': 'You survived!', 'end.goodS': '99 nights are over and the children are home. The Deer watches from afar… and fades into the mist.', 'end.badT': 'You survived… but not everyone is safe', 'end.badS': 'Children rescued: {k} of 4. The forest keeps the rest.', 'end.failT': 'The forest prevailed', 'end.failS': 'This journey is over. Children rescued: {k} of 4.', 'end.again': 'New game',
        'item.axe_old': 'Old Axe', 'item.axe_good': 'Good Axe', 'item.axe_strong': 'Strong Axe', 'item.chainsaw': 'Chainsaw', 'item.flashlight': 'Flashlight', 'item.spear': 'Spear', 'item.katana': 'Katana',
        'item.revolver': 'Revolver', 'item.rifle': 'Rifle', 'item.compass': 'Compass', 'item.carrot': 'Carrot', 'item.berry': 'Berries', 'item.steak_raw': 'Raw Steak', 'item.steak_cooked': 'Steak', 'item.stew': 'Stew',
        'item.bandage': 'Bandage', 'item.medkit': 'Medkit', 'item.log': 'Log', 'item.coal': 'Coal', 'item.canister': 'Fuel Can', 'item.bolt': 'Bolt', 'item.sheet': 'Sheet Metal', 'item.fan': 'Broken Fan',
        'item.radio': 'Old Radio', 'item.tire': 'Tire', 'item.engine': 'Engine', 'item.gem': 'Cultist Gem', 'item.diamond': 'Diamond', 'item.pelt': 'Pelt', 'item.bunny_foot': 'Bunny Foot', 'item.seed': 'Seeds',
        'item.ammo_rev': 'Revolver Ammo', 'item.ammo_rifle': 'Rifle Ammo', 'item.key_red': 'Red Key', 'item.key_blue': 'Blue Key', 'item.key_green': 'Green Key', 'item.key_yellow': 'Yellow Key',
        'item.torch': 'Torch', 'item.wire': 'Barbed Wire', 'item.spikes': 'Spike Trap', 'item.beartrap': 'Bear Trap', 'item.sack1': 'Good Sack', 'item.sack2': 'Giant Sack',
        'itemd.axe_good': 'Chops trees faster.', 'itemd.axe_strong': 'Fells a tree in a few hits.', 'itemd.chainsaw': 'Chops almost instantly and shreds enemies.', 'itemd.spear': 'A long thrusting attack.',
        'itemd.katana': 'Fast and sharp.', 'itemd.revolver': 'Accurate long-range shots.', 'itemd.rifle': 'A powerful rifle.', 'itemd.ammo_rev': 'A box of ammo.', 'itemd.ammo_rifle': 'A box of ammo.',
        'itemd.bandage': 'Heals a little.', 'itemd.medkit': 'Heals fully.', 'itemd.torch': 'Place it on the ground for light.', 'itemd.wire': 'Slows and hurts enemies.', 'itemd.spikes': 'Stabs anything that steps on it.',
        'itemd.beartrap': 'Holds a beast for a few seconds.', 'itemd.compass': 'Opens the missing kids board.', 'itemd.sack1': '8 bag slots.', 'itemd.sack2': '12 bag slots.',
    },
};

/** @satisfies {Record<string, any>} */
const Lang = {
    // до Lang.init (ошибка загрузки облака и т. п.) — язык сборки: в Playables сразу английский
    code: typeof GAME_LANG !== 'undefined' ? GAME_LANG : 'ru',

    // platformLang — язык платформы (Platform.lang) или null.
    init(platformLang) {
        const def = typeof GAME_LANG !== 'undefined' ? GAME_LANG : 'ru';
        // Playgama и CrazyGames требуют язык платформы (platform.language, systemInfo.locale); остальные сборки — по LANG_AUTO
        const auto = (typeof LANG_AUTO !== 'undefined' ? LANG_AUTO : 0) || (typeof GAME_PLATFORM !== 'undefined' && (String(GAME_PLATFORM) === 'playgama' || String(GAME_PLATFORM) === 'crazygames') ? 1 : 0);
        let p = String(platformLang || '').toLowerCase().split(/[-_]/)[0];
        if (!p && auto > 0) p = String((navigator.language || '')).toLowerCase().split(/[-_]/)[0];
        this.code = auto > 0 && p && LANG_STRINGS[p] ? p : (LANG_STRINGS[def] ? def : 'en');
        document.documentElement.lang = this.code;
    },

    has(key) {
        return !!((LANG_STRINGS[this.code] || {})[key] || LANG_STRINGS.en[key]);
    },

    t(key, params) {
        const s = (LANG_STRINGS[this.code] || {})[key] || LANG_STRINGS.en[key] || key;
        return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s;
    },

    // Разметка: data-t, data-t-title, data-t-placeholder внутри root.
    apply(root) {
        const r = root || document;
        for (const el of /** @type {NodeListOf<HTMLElement>} */ (r.querySelectorAll('[data-t]'))) el.textContent = this.t(el.dataset.t);
        for (const el of /** @type {NodeListOf<HTMLElement>} */ (r.querySelectorAll('[data-t-title]'))) el.title = this.t(el.dataset.tTitle);
        for (const el of /** @type {NodeListOf<HTMLInputElement>} */ (r.querySelectorAll('[data-t-placeholder]'))) el.placeholder = this.t(el.dataset.tPlaceholder);
    },
};

// Пикабу Игры: название только по-русски — логотип меню «99 НОЧЕЙ В ЛЕСУ».
if (typeof GAME_PLATFORM !== 'undefined' && String(GAME_PLATFORM) === 'pikabu') for (const c of Object.keys(LANG_STRINGS)) Object.assign(/** @type {Record<string, Record<string, string>>} */ (LANG_STRINGS)[c], { 'titleNights': 'НОЧЕЙ', 'titleForest': 'В ЛЕСУ' });

// Lang3.js — тексты третьего слоя: босс и финал, особые ночи, записки, награды и достижения, карта, управление и геймпад,
// хардкор, улучшение снаряжения. Дополняет LANG_STRINGS. Новая строка = ключ в ОБОИХ словарях (ru и en).

Object.assign(LANG_STRINGS.ru, {
    'mode.start': 'Начать игру', 'bot.delivery': 'Боты приносят предметы игроку',
    'bot.deliveryHint': 'Выключено по умолчанию: добыча идёт в сундук лагеря, дрова — в костёр. Если включить, боты иногда принесут немного полезных предметов лично тебе.',
    'camp.storage': 'Сундук лагеря', 'camp.storageHint': 'Боты складывают сюда добычу. Можно брать и класть предметы.', 'camp.storageFar': 'Подойди ближе к сундуку лагеря', 'camp.storageCount': 'Предметов: {n}',
    'chest.title': 'Сундук лагеря', 'chest.hint': 'Общие припасы лагеря. Боты оставляют здесь добычу. Улучшения оружия сохраняются.',
    'chest.bag': 'Рюкзак: {a} из {b} ячеек занято', 'chest.empty': 'Сундук пока пуст.', 'chest.takeOne': 'Взять 1', 'chest.takeStack': 'Взять стопку',
    'chest.selected': 'Выбранный предмет в руках', 'chest.noSelected': 'Выбери предмет в хотбаре перед открытием сундука.', 'chest.putOne': 'Положить 1', 'chest.putStack': 'Положить стопку',
    'chest.taken': 'Взято: {n}.', 'chest.deposited': 'Положено: {n}.', 'chest.partial': 'Перенесено {n} из {total}. Для остального не хватает места.',
    'chest.bagFull': 'В рюкзаке нет места. Предметы остались в сундуке.', 'chest.depositNone': 'Предмет не перенесён: проверь выбранную ячейку и место в сундуке.',
    'save.transfer': 'Перенос партии', 'save.transferOpen': 'Открыть',
    'save.transferHint': 'Нажми «Скопировать сохранение» и отправь код другу. Другу нужно вставить код сюда, проверить его и начать игру. Переносятся партия, предметы и сердца; общие монеты, скины, достижения и ежедневные награды остаются на устройстве. Предыдущая партия останется в резервном слоте.',
    'save.codeLabel': 'Код сохранения', 'save.export': 'Получить код', 'save.selectCode': 'Выделить код', 'save.verify': 'Проверить код',
    'save.exportReady': 'Код готов. Скопируй его и сохрани в надёжном месте.', 'save.codeBad': 'Код повреждён или относится к другой игре. Сохранение не изменено.',
    'save.copy': 'Скопировать сохранение', 'save.copied': 'Сохранение скопировано! Отправь код другу сообщением.',
    'save.copyManual': 'Браузер не разрешил копирование. Код выделен: нажми Ctrl+C / ⌘C или удерживай текст и выбери «Копировать». Затем отправь его другу.',
    'save.codePreview': 'Код проверен: день {d}, костёр {l}.', 'save.import': 'Начать с этого сохранения', 'save.imported': 'Партия перенесена. Загружаем игру…',
    'rw.clockBack': 'Дата устройства раньше последней награды. Новая награда откроется после {d}.',
    'rw.secret': 'Скрытое достижение', 'rw.secretHint': 'Исследуй лес и проходи новые испытания, чтобы раскрыть его.', 'rw.remaining': 'До цели: {n}', 'rw.skin': 'Награда: скин «{n}»',
    'rw.modeNormal': 'Обычный: ночей {n} · финалов {w} · боссов {b}', 'rw.modeHardcore': 'Хардкор: ночей {n} · финалов {w} · боссов {b}',
    'inv.padTip': 'Геймпад: A — взять / положить предмет, B — отменить перенос или закрыть окно.',
    'tut.replay': 'Повторить советы', 'armor.status': 'Защита {n}%', 'armor.help': 'Опыт выживания, уровень костра и спасённые дети снижают входящий урон. Против босса действует только защита лагеря.',
    'enemy.boar': 'Кабан', 'enemy.ghost': 'Лесной призрак',
    'set.padUnsupported': 'Нестандартная раскладка геймпада. Используй клавиатуру или тач-управление.',
    'death.boar': 'Кабан сбил тебя с ног.', 'death.ghost': 'Лесной призрак настиг тебя.',
});
Object.assign(LANG_STRINGS.en, {
    'mode.start': 'Start game', 'bot.delivery': 'Bots bring items to the player',
    'bot.deliveryHint': 'Off by default: loot goes to the camp chest and firewood feeds the campfire. Turn this on for occasional small deliveries of useful items to you.',
    'camp.storage': 'Camp Chest', 'camp.storageHint': 'Bots store their loot here. Take or deposit items.', 'camp.storageFar': 'Move closer to the camp chest', 'camp.storageCount': 'Items: {n}',
    'chest.title': 'Camp Chest', 'chest.hint': 'Shared camp supplies. Bots leave their loot here. Weapon upgrades are preserved.',
    'chest.bag': 'Backpack: {a} of {b} slots occupied', 'chest.empty': 'The chest is empty.', 'chest.takeOne': 'Take 1', 'chest.takeStack': 'Take stack',
    'chest.selected': 'Item currently held', 'chest.noSelected': 'Select a hotbar item before opening the chest.', 'chest.putOne': 'Deposit 1', 'chest.putStack': 'Deposit stack',
    'chest.taken': 'Taken: {n}.', 'chest.deposited': 'Deposited: {n}.', 'chest.partial': 'Transferred {n} of {total}. There is no room for the rest.',
    'chest.bagFull': 'Your backpack is full. The items remain in the chest.', 'chest.depositNone': 'Nothing transferred. Check your selected slot and the room in the chest.',
    'save.transfer': 'Transfer run', 'save.transferOpen': 'Open',
    'save.transferHint': 'Choose Copy save and send the code to a friend. Your friend can paste it here, check it and start playing. The run, items and hearts transfer; coins, skins, achievements and daily rewards stay on each device. The previous run remains in the backup slot.',
    'save.codeLabel': 'Save code', 'save.export': 'Generate code', 'save.selectCode': 'Select code', 'save.verify': 'Check code',
    'save.exportReady': 'Code ready. Copy it and keep it somewhere safe.', 'save.codeBad': 'This code is damaged or belongs to another game. Your save was not changed.',
    'save.copy': 'Copy save', 'save.copied': 'Save copied! Send the code to your friend in a message.',
    'save.copyManual': 'The browser blocked copying. The code is selected: press Ctrl+C / ⌘C, or hold the text and choose Copy. Then send it to your friend.',
    'save.codePreview': 'Code verified: day {d}, campfire level {l}.', 'save.import': 'Start from this save', 'save.imported': 'Run imported. Loading the game…',
    'rw.clockBack': 'Your device date is earlier than your last reward. The next reward is available after {d}.',
    'rw.secret': 'Secret achievement', 'rw.secretHint': 'Explore the forest and take on new challenges to reveal it.', 'rw.remaining': 'Remaining: {n}', 'rw.skin': 'Reward: {n} skin',
    'rw.modeNormal': 'Normal: {n} nights · {w} finishes · {b} bosses', 'rw.modeHardcore': 'Hardcore: {n} nights · {w} finishes · {b} bosses',
    'inv.padTip': 'Gamepad: A picks up or places an item. B cancels the move or closes the inventory.',
    'tut.replay': 'Show tips again', 'armor.status': 'Protection {n}%', 'armor.help': 'Survival experience, campfire upgrades and rescued children reduce incoming damage. Only camp protection applies against the boss.',
    'enemy.boar': 'Boar', 'enemy.ghost': 'Forest Ghost',
    'set.padUnsupported': 'Unsupported gamepad layout. Use the keyboard or touch controls.',
    'death.boar': 'The boar knocked you down.', 'death.ghost': 'The forest ghost caught you.',
});

Object.assign(LANG_STRINGS.ru, {
    // босс и финал
    'boss.name': 'Хозяин леса', 'boss.riseT': 'Хозяин леса пробудился!', 'boss.riseS': 'Земля трескается… Победи его, чтобы закончить кошмар',
    'boss.p2T': 'Хозяин в гневе!', 'boss.p2S': 'Он зовёт стаю и бросается в рывок', 'boss.p3T': 'Последняя ярость!', 'boss.p3S': 'Он быстрее и бьёт сильнее',
    'boss.deadT': 'Хозяин леса повержен!', 'boss.deadS': 'Лес затихает. Дождись рассвета', 'boss.nightT': 'Последняя ночь', 'boss.nightS': 'Хозяин леса идёт за твоим огнём',
    'boss.dawnT': 'Рассвет, но Хозяин не ушёл', 'boss.dawnS': 'Победи его или продержись — осталось около ста секунд', 'death.warden': 'Хозяин леса раздавил тебя',
    // особые ночи
    'nm.blood': 'Кровавая луна', 'nm.bloodT': 'Кровавая луна!', 'nm.bloodS': 'Больше зверей и вдвое больше монет',
    'nm.swarm': 'Волчья стая', 'nm.swarmT': 'Волчья стая!', 'nm.swarmS': 'Много слабых, но быстрых волков',
    'nm.cold': 'Лютый мороз', 'nm.coldT': 'Лютый мороз!', 'nm.coldS': 'Вне света костра голод растёт быстрее',
    'nm.quiet': 'Тихая ночь', 'nm.quietT': 'Тихая ночь', 'nm.quietS': 'Зверей мало, монет больше',
    'nm.storm': 'Грозовая ночь', 'nm.stormT': 'Грозовая ночь', 'nm.stormS': 'Молнии, дождь и больше монет',
    'nm.fog': 'Туманная ночь', 'nm.fogT': 'Туманная ночь', 'nm.fogS': 'В густом тумане бродят волки',
    // постройки и записки
    'struct.broke': 'Сломано: {n}', 'p.repair': 'Починить: {n} ({hp}%)',
    'p.note': 'Прочитать записку', 'p.noteSub': 'Бумага пожелтела от времени', 'note.count': 'Найдено записок: {a} из {b}', 'note.ok': 'Закрыть',
    // награды
    'rw.title': 'Награды', 'rw.daily': 'Ежедневная', 'rw.tasks': 'Задания дня', 'rw.ach': 'Достижения', 'rw.notes': 'Записки',
    'rw.dailyHint': 'Заходи каждый день: награда растёт, а на 7-й день к монетам добавится сердце!', 'rw.dailyDone': 'Награда за сегодня получена. Приходи завтра!',
    'rw.day': 'День {n}', 'rw.streak': 'Серия дней подряд: {n}', 'rw.claim': 'Забрать +{n}', 'rw.claimed': 'Получено: +{n} монет', 'rw.double': 'Удвоить: +{n}',
    'rw.tasksHint': 'Три новых задания каждый день. Прогресс считается в обычной игре.', 'rw.bonus': 'Выполни все три — бонус +{n} монет', 'rw.bonusGot': 'Бонус за все задания получен (+{n})',
    'rw.achCount': 'Получено достижений: {a} из {b}', 'rw.notesHint': 'Записки раскрывают тайну леса: найдено {a} из {b}', 'rw.noteRead': 'Нажми, чтобы перечитать', 'rw.noteHint': 'Ищи у места: {s}',
    // названия мест
    'site.poi-cabin': 'Избушка лесника', 'site.poi-campsite': 'Заброшенный лагерь', 'site.poi-sawmill': 'Лесопилка', 'site.poi-ruins': 'Руины храма', 'site.poi-watchtower': 'Сторожевая вышка',
    'site.poi-graveyard': 'Кладбище', 'site.poi-mine': 'Шахта', 'site.poi-obelisk': 'Обелиск', 'site.den-wolf': 'Волчье логово', 'site.den-alpha': 'Логово альфы',
    'site.cave-bear': 'Пещера медведей', 'site.poi-cultist': 'Лагерь культистов', 'site.poi-well': 'Колодец', 'site.poi-pond': 'Пруд', 'site.poi-carrots': 'Огород', 'site.kid-dino': 'Клетка динозаврика',
    // карта
    'map.title': 'Карта', 'map.hint': 'Тяни — двигать карту, колесо — масштаб, клик — поставить или убрать метку', 'map.zoomIn': 'Приблизить', 'map.zoomOut': 'Отдалить', 'map.center': 'К игроку',
    'map.clearPins': 'Убрать метки', 'map.board': 'Доска', 'map.pinMax': 'Не больше 6 меток', 'map.unknown': 'неизвестно',
    'map.l.camp': 'Костёр', 'map.l.kid': 'Дети', 'map.l.chest': 'Сундуки', 'map.l.note': 'Записки', 'map.l.event': 'События', 'map.l.bot': 'Напарники', 'map.l.pin': 'Метки', 'map.l.quest': 'Цель задания',
    // управление
    'ctl.title': 'Управление', 'ctl.hint': 'Нажми на клавишу в таблице, затем на новую. Esc — отмена. У каждого действия две клавиши.', 'ctl.press': 'Нажми…', 'ctl.busy': 'Эту клавишу нельзя назначить',
    'ctl.reset': 'По умолчанию', 'ctl.back': 'Готово',
    'ctl.pad': 'Геймпад: левый стик — ходьба, правый — камера, A — прыжок, X — действие, RT — удар, LT — прицел, B — выбросить, Y — инвентарь, LB/RB — предметы, L3 — бег, Select — карта, Start — пауза, вверх на крестовине — задания, вниз — улучшить костёр, R3 — записки. В окнах: крестовина — выбор, A — нажать, B — назад.',
    'ctl.forward': 'Вперёд', 'ctl.back2': 'Назад', 'ctl.left': 'Влево', 'ctl.right': 'Вправо', 'ctl.jump': 'Прыжок', 'ctl.sprint': 'Бег', 'ctl.interact': 'Действие', 'ctl.drop': 'Выбросить',
    'ctl.inv': 'Инвентарь', 'ctl.swap': 'Прошлый предмет', 'ctl.map': 'Карта', 'ctl.quest': 'Задания', 'ctl.shop': 'Магазин', 'ctl.rewards': 'Награды', 'ctl.emote': 'Эмоция',
    // настройки
    'shop.noAds': 'Недоступно: реклама отключена', 'lookHintRmb': 'Камера: зажми правую кнопку мыши и веди мышью', 'set.touch': 'Экранное управление', 'set.touch_auto': 'Авто', 'set.touch_on': 'Всегда', 'set.touch_off': 'Выключено', 'set.amb': 'Окружение', 'set.wheel': 'Колесо мыши', 'set.wheelHotbar': 'Предметы (Shift — зум)', 'set.wheelZoom': 'Зум (Shift — предметы)', 'set.controls': 'Клавиши', 'set.controlsBtn': 'Настроить',
    'set.padOn': 'Геймпад подключён', 'set.padOff': 'Геймпад: нажми любую кнопку, чтобы подключить',
    'help.wheelK': 'колесо', 'help.swap': 'Прошлый предмет', 'help.inv': 'Инвентарь', 'help.quest': 'Задания', 'help.rewards': 'Награды',
    // хардкор и финал
    'mode.hc': 'Хардкор', 'mode.hcD': 'Одно сердце · одно возрождение за рекламу · монет ×1.5 · награда за финал ×2', 'hc.tag': 'ХАРДКОР',
    'end.boss': 'Хозяин леса побеждён: +1000 монет', 'end.hc': 'Хардкор пройден: награда ×2', 'end.coins': 'Награда: {n}',
    // улучшение снаряжения и задания
    'up.title': 'Улучшение снаряжения', 'up.hint': 'Каждый уровень: +18% урона и +15% скорости рубки. Максимум — +3.', 'up.bonus': 'Сейчас: +{d}% урона, +{t}% рубки', 'up.max': 'Максимум', 'up.do': 'Улучшить',
    'up.none': 'Нет предметов для улучшения: положи оружие или инструмент в сумку', 'up.done': '{n}: уровень +{l}!',
    'lore.newNote': 'Найдена записка!', 'lore.none': 'Пока ни одной записки. Ищи жёлтые ромбы у мест интереса — или подожди, пока их найдут напарники', 'pause.day': 'День {n}', 'pause.fire': 'Костёр {n}', 'pause.kids': 'Дети {a}/{b}', 'pause.notes': 'Записки {a}/{b}',
    'tut.on': 'Туториал: вкл', 'tut.off': 'Туториал: выкл', 'tut.nowOn': 'Подсказки и задания включены', 'tut.nowOff': 'Подсказки и задания отключены', 'tut.sOn': 'Включён', 'tut.sOff': 'Выключен',
    'tut.btnOff': 'Отключить туториал', 'tut.btnOn': 'Включить туториал', 'tut.disabledNote': 'Туториал отключён: цель, луч и подсказки скрыты, задания стоят. Включить — кнопка ниже, меню паузы или настройки.', 'set.tutorial': 'Туториал и подсказки',
    'fish.wait': 'Жди поклёвку. Подсечь — {k}. ПКМ или прыжок — убрать удочку', 'fish.hint': 'Жди поклёвку. Когда клюнет, нажми {k} — той же кнопкой, которой забросил', 'fish.bite': 'Клюёт! Жми {k}!', 'btn.attackTouch': 'кнопку удара',
    'fire.far': 'Подойди ближе к костру', 'p.fireUpHint': 'улучшить до ур. {n}', 'ctl.upgrade': 'Улучшить костёр', 'ctl.notes': 'Записки леса', 'help.upgrade': 'Улучшить костёр (у огня)', 'help.notes': 'Записки леса',
    'lore.botFound': '{n} нашёл записку', 'lore.hint': 'Все записки — клавиша N или кнопка 📜', 'lore.openJ': 'Открыть', 'lore.title': 'Записки леса', 'lore.pick': 'Выбери записку слева', 'lore.locked': 'Записка ещё не найдена', 'lore.foundNow': 'Найдена в этой партии', 'lore.foundOld': 'Найдена раньше', 'lore.prev': 'Назад', 'lore.next': 'Дальше',
    'q.onMap': 'На карте', 'q.noTarget': 'Цель появится позже', 'unit.m': 'м',
});

Object.assign(LANG_STRINGS.en, {
    // boss and finale
    'boss.name': 'Forest Warden', 'boss.riseT': 'The Forest Warden awakens!', 'boss.riseS': 'The ground cracks… Defeat him to end the nightmare',
    'boss.p2T': 'The Warden is furious!', 'boss.p2S': 'He calls the pack and charges', 'boss.p3T': 'Final rage!', 'boss.p3S': 'Faster and hits harder',
    'boss.deadT': 'The Forest Warden is defeated!', 'boss.deadS': 'The forest falls silent. Wait for dawn', 'boss.nightT': 'The Last Night', 'boss.nightS': 'The Forest Warden comes for your fire',
    'boss.dawnT': 'Dawn broke, but the Warden stays', 'boss.dawnS': 'Defeat him or hold out — about a hundred seconds left', 'death.warden': 'The Forest Warden crushed you',
    // special nights
    'nm.blood': 'Blood Moon', 'nm.bloodT': 'Blood Moon!', 'nm.bloodS': 'More beasts and double coins',
    'nm.swarm': 'Wolf Swarm', 'nm.swarmT': 'Wolf Swarm!', 'nm.swarmS': 'Lots of weak but fast wolves',
    'nm.cold': 'Bitter Frost', 'nm.coldT': 'Bitter Frost!', 'nm.coldS': 'Hunger grows faster outside the firelight',
    'nm.quiet': 'Quiet Night', 'nm.quietT': 'Quiet Night', 'nm.quietS': 'Few beasts, more coins',
    'nm.storm': 'Stormy Night', 'nm.stormT': 'Stormy Night', 'nm.stormS': 'Lightning, rain and more coins',
    'nm.fog': 'Foggy Night', 'nm.fogT': 'Foggy Night', 'nm.fogS': 'Wolves roam the thick fog',
    // structures and notes
    'struct.broke': 'Broken: {n}', 'p.repair': 'Repair: {n} ({hp}%)',
    'p.note': 'Read the note', 'p.noteSub': 'The paper has yellowed with age', 'note.count': 'Notes found: {a} of {b}', 'note.ok': 'Close',
    // rewards
    'rw.title': 'Rewards', 'rw.daily': 'Daily', 'rw.tasks': 'Daily tasks', 'rw.ach': 'Achievements', 'rw.notes': 'Notes',
    'rw.dailyHint': 'Come back every day: the reward grows, and on day 7 you also get a heart!', 'rw.dailyDone': 'Today\'s reward is claimed. See you tomorrow!',
    'rw.day': 'Day {n}', 'rw.streak': 'Day streak: {n}', 'rw.claim': 'Claim +{n}', 'rw.claimed': 'Received: +{n} coins', 'rw.double': 'Double: +{n}',
    'rw.tasksHint': 'Three new tasks every day. Progress counts during a run.', 'rw.bonus': 'Finish all three for a +{n} coin bonus', 'rw.bonusGot': 'All-tasks bonus claimed (+{n})',
    'rw.achCount': 'Achievements earned: {a} of {b}', 'rw.notesHint': 'Notes reveal the secret of the forest: {a} of {b} found', 'rw.noteRead': 'Click to read again', 'rw.noteHint': 'Look near: {s}',
    // place names
    'site.poi-cabin': 'Ranger\'s Cabin', 'site.poi-campsite': 'Abandoned Camp', 'site.poi-sawmill': 'Sawmill', 'site.poi-ruins': 'Temple Ruins', 'site.poi-watchtower': 'Watchtower',
    'site.poi-graveyard': 'Graveyard', 'site.poi-mine': 'Mine', 'site.poi-obelisk': 'Obelisk', 'site.den-wolf': 'Wolf Den', 'site.den-alpha': 'Alpha\'s Den',
    'site.cave-bear': 'Bear Cave', 'site.poi-cultist': 'Cultist Camp', 'site.poi-well': 'Well', 'site.poi-pond': 'Pond', 'site.poi-carrots': 'Vegetable Patch', 'site.kid-dino': 'Dino\'s Cage',
    // map
    'map.title': 'Map', 'map.hint': 'Drag to pan, wheel to zoom, click to add or remove a marker', 'map.zoomIn': 'Zoom in', 'map.zoomOut': 'Zoom out', 'map.center': 'Center on player',
    'map.clearPins': 'Clear markers', 'map.board': 'Board', 'map.pinMax': 'Up to 6 markers', 'map.unknown': 'unknown',
    'map.l.camp': 'Campfire', 'map.l.kid': 'Kids', 'map.l.chest': 'Chests', 'map.l.note': 'Notes', 'map.l.event': 'Events', 'map.l.bot': 'Companions', 'map.l.pin': 'Markers', 'map.l.quest': 'Quest target',
    // controls
    'ctl.title': 'Controls', 'ctl.hint': 'Click a key in the table, then press the new one. Esc cancels. Each action can have two keys.', 'ctl.press': 'Press…', 'ctl.busy': 'This key cannot be assigned',
    'ctl.reset': 'Reset to defaults', 'ctl.back': 'Done',
    'ctl.pad': 'Gamepad: left stick moves, right stick looks, A jump, X interact, RT attack, LT aim, B drop, Y inventory, LB/RB switch items, L3 sprint, Select map, Start pause, D-pad up quests, down upgrade the fire, R3 notes. In menus: D-pad selects, A presses, B goes back.',
    'ctl.forward': 'Forward', 'ctl.back2': 'Backward', 'ctl.left': 'Left', 'ctl.right': 'Right', 'ctl.jump': 'Jump', 'ctl.sprint': 'Sprint', 'ctl.interact': 'Interact', 'ctl.drop': 'Drop',
    'ctl.inv': 'Inventory', 'ctl.swap': 'Previous item', 'ctl.map': 'Map', 'ctl.quest': 'Quests', 'ctl.shop': 'Shop', 'ctl.rewards': 'Rewards', 'ctl.emote': 'Emote',
    // settings
    'shop.noAds': 'Unavailable: ads are off', 'lookHintRmb': 'Camera: hold the right mouse button and drag', 'set.touch': 'On-screen controls', 'set.touch_auto': 'Auto', 'set.touch_on': 'Always', 'set.touch_off': 'Off', 'set.amb': 'Ambience', 'set.wheel': 'Mouse wheel', 'set.wheelHotbar': 'Items (Shift — zoom)', 'set.wheelZoom': 'Zoom (Shift — items)', 'set.controls': 'Keys', 'set.controlsBtn': 'Customize',
    'set.padOn': 'Gamepad connected', 'set.padOff': 'Gamepad: press any button to connect',
    'help.wheelK': 'wheel', 'help.swap': 'Previous item', 'help.inv': 'Inventory', 'help.quest': 'Quests', 'help.rewards': 'Rewards',
    // hardcore and ending
    'mode.hc': 'Hardcore', 'mode.hcD': 'One heart · one ad revive per run · coins ×1.5 · ending reward ×2', 'hc.tag': 'HARDCORE',
    'end.boss': 'Forest Warden defeated: +1000 coins', 'end.hc': 'Hardcore cleared: reward ×2', 'end.coins': 'Reward: {n}',
    // gear upgrades and quests
    'up.title': 'Gear Upgrades', 'up.hint': 'Each level: +18% damage and +15% chopping speed. Maximum level: +3.', 'up.bonus': 'Now: +{d}% damage, +{t}% chopping', 'up.max': 'Maxed', 'up.do': 'Upgrade',
    'up.none': 'Nothing to upgrade: put a weapon or tool in your bag', 'up.done': '{n}: level +{l}!',
    'lore.newNote': 'Note found!', 'lore.none': 'No notes yet. Look for yellow diamonds near points of interest — or wait for your companions to find some', 'pause.day': 'Day {n}', 'pause.fire': 'Fire {n}', 'pause.kids': 'Kids {a}/{b}', 'pause.notes': 'Notes {a}/{b}',
    'tut.on': 'Tutorial: on', 'tut.off': 'Tutorial: off', 'tut.nowOn': 'Hints and tasks enabled', 'tut.nowOff': 'Hints and tasks disabled', 'tut.sOn': 'On', 'tut.sOff': 'Off',
    'tut.btnOff': 'Turn the tutorial off', 'tut.btnOn': 'Turn the tutorial on', 'tut.disabledNote': 'Tutorial is off: the objective, beam and tips are hidden and tasks are paused. Turn it on with the button below, in the pause menu or in settings.', 'set.tutorial': 'Tutorial and hints',
    'fish.wait': 'Wait for a bite. Hook it with {k}. RMB or jump puts the rod away', 'fish.hint': 'Wait for a bite. When it bites, press {k} — the same button you cast with', 'fish.bite': 'Bite! Press {k}!', 'btn.attackTouch': 'the attack button',
    'fire.far': 'Come closer to the fire', 'p.fireUpHint': 'upgrade to Lv {n}', 'ctl.upgrade': 'Upgrade the fire', 'ctl.notes': 'Forest notes', 'help.upgrade': 'Upgrade the fire (at the fire)', 'help.notes': 'Forest notes',
    'lore.botFound': '{n} found a note', 'lore.hint': 'All notes: press N or the 📜 button', 'lore.openJ': 'Open', 'lore.title': 'Forest Notes', 'lore.pick': 'Choose a note from the list', 'lore.locked': 'This note has not been found yet', 'lore.foundNow': 'Found in this run', 'lore.foundOld': 'Found earlier', 'lore.prev': 'Previous', 'lore.next': 'Next',
    'q.onMap': 'On the map', 'q.noTarget': 'The target appears later', 'unit.m': 'm',
});

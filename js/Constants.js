// Constants.js — ВСЕ числа игры на Lory Engine: земля, камера, рендер, звук. Грузится
// ПЕРВЫМ: остальные модули читают эти глобалы. Правит редактор (_utils/editor): сервер
// патчит только строки `const ИМЯ = <число>;` — значения держать числовыми
// литералами (цвета — 0xRRGGBB), формулу редактор не тронет. Карты (размер, рельеф,
// объекты) — в Maps.js.
const ENGINE_NAME = 'Lory Engine';
const ENGINE_VERSION = '1.20';
const GAME_MODE = '3d';              // '3d' | '2d': renderer selected before boot
const WORLD2D_WIDTH = 960;            // logical viewport width (world pixels)
const WORLD2D_HEIGHT = 540;            // logical viewport height
const WORLD2D_PIXEL_RATIO = 2;         // maximum device pixel ratio
const LOADING_TIMEOUT_MS = 45000;    // ожидание готовности шейдеров/текстур; при ошибке — повтор
const FX_MAX_SYSTEMS = 110;           // одновременно живые слои частиц
const FX_MAX_PARTICLES = 18000;       // общий бюджет ёмкости систем на ПК
const FX_MOBILE_SCALE = 0.55;        // плотность и бюджет частиц на мобильных
const ASTRA_SAVE_CODE_LIMIT = 2000000; // максимальная длина переносимого сохранения
const ASTRA_UI_NOTICE_LIMIT = 5;       // очередь уведомлений
const ASTRA_UI_NOTICE_SECONDS = 3.6;   // длительность уведомления
const ASTRA_PAD_REPEAT_DELAY = 0.34;   // задержка повторной навигации геймпада
const ASTRA_PAD_REPEAT_INTERVAL = 0.16;// интервал повторной навигации геймпада
const ATTACK_TRAIL_LIMIT = 12;        // переиспользуемые ленты ударов
const ASTRA_SHADOW_REFRESH = 2;      // обновление карты теней раз в N кадров на среднем/низком качестве
const ASTRA_SHADOW_MIN_RADIUS = 30;  // мелкие детали не отбрасывают тень на среднем качестве, px
const ASTRA_SHADOW_MIN_RADIUS_LOW = 40; // порог низкого качества, px
const QUALITY_KEEP_LOW = 0.2;         // доля деревьев, кустов, камней и мелкой растительности: низкое качество (−80%)
const QUALITY_KEEP_MID = 0.5;         // среднее качество (−50%)
const QUALITY_KEEP_HIGH = 0.7;        // высокое качество (−30%)
const QUALITY_PIXELS_LOW = 0.55;      // мегапикселей кадра на телефоне/планшете: низкое качество (чёткость без «мыла»)
const QUALITY_PIXELS_MID = 0.85;      // среднее качество
const QUALITY_PIXELS_HIGH = 1.4;      // высокое качество
const CG_REVIVE_OFFER_GAP = 300;      // CrazyGames: с, не чаще стольких секунд предлагать возрождение за рекламу (не при каждой смерти)
const QUALITY_DYNRES_MAX = 1.25;      // авто-снижение разрешения при низком FPS — не больше чем во столько раз по стороне
const QUALITY_ENEMY_VIEW_LOW = 34;    // м: дальше звери не рисуются и не анимируются (низкое качество)
const QUALITY_ENEMY_VIEW_MID = 46;    // м: среднее качество (высокое — весь радиус активности)
const LORE_SEARCH_RADIUS = 1800;      // безопасное размещение записки вне POI
const LORE_RETRY_INTERVAL = 5;        // повтор поиска места для записки, с
const BOT_DELIVERY_LIMIT = 3;         // единиц личной передачи от всей команды за окно
const BOT_DELIVERY_WINDOW = 60;       // скользящее окно личных передач, игровых секунд
const BOT_FIRE_TARGET = 0.82;         // доля топлива, до которой напарники поддерживают огонь
const ITEM_MERGE_RADIUS = 150;       // px: слияние близких неподвижных стопок добычи
const ITEM_MERGE_HEIGHT = 50;        // px: допустимый перепад высоты между стопками
const ITEM_MERGE_INTERVAL = 1;       // с: период поиска соседних стопок
const ITEM_RENDER_CHUNK = 1600;     // px: spatial cell for ground-item thin instances (XYZ)
const ITEM_RENDER_CAPACITY = 16;    // initial dense slots per ground-item render cell
const GAME_ID = 'nights99forest';          // латиница, цифры, -: имя архива dist/<GAME_ID>-<платформа>-<версия>.zip и ключей сохранений
const GAME_TITLE = '99 ночей в лесу';     // название игры: заголовок вкладки браузера
const GAME_VERSION = '0.1.1';         // версия билда: ?v= у скриптов (tools/build.mjs) и имя архива
const GAME_PLATFORM = 'pikabu';          // 'web' | 'yandex' | 'playables' | 'playgama' | 'crazygames' — сборка ставит свою (build.bat <платформа>)
const GAME_LANG = 'ru';               // язык интерфейса: сборка ставит ru (yandex) или en (playables, playgama, crazygames); Lang.js
// Название игры по площадке: { <сборка>: 'Название' } — сборка ставит его в GAME_TITLE, <title> и заставку загрузки
// (tools/platforms.mjs platformTitle). Пикабу Игры: в названии нельзя иностранные слова.
/** @type {Record<string, string>} */
const GAME_TITLES = { pikabu: '99 ночей в лесу' };

// Шим localStorage: в sandbox-iframe и при запрете данных сайта прямой доступ бросает SecurityError.
// Все обращения к хранилищу — только через Store.
// Playgama, Playables, CrazyGames: localStorage не трогается вовсе — ключи живут в памяти (mem), Platform.js загружает их из
// хранилища платформы (Bridge Storage / ytgame loadData / модуль data) при старте и пишет изменения обратно пачкой (onChange).
/** @satisfies {Record<string, any>} */
const Store = {
    /** @type {Map<string, string> | null} */
    mem: String(GAME_PLATFORM) === 'playgama' || String(GAME_PLATFORM) === 'playables' || String(GAME_PLATFORM) === 'crazygames' ? new Map() : null,
    /** @type {((key: string) => void) | null} */
    onChange: null,
    get(key) {
        if (Store.mem) return Store.mem.has(key) ? Store.mem.get(key) : null;
        try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
        if (Store.mem) { Store.mem.set(key, String(value)); if (Store.onChange) Store.onChange(key); return true; }
        try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
    },
    remove(key) {
        if (Store.mem) { if (Store.mem.delete(key) && Store.onChange) Store.onChange(key); return; }
        try { localStorage.removeItem(key); } catch (e) { /* нечего удалять */ }
    },
    // Разбор JSON без падения: битое значение = как будто сохранения нет.
    getJSON(key, fallback = null) {
        const raw = Store.get(key);
        if (raw === null) return fallback;
        try {
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : fallback;
        } catch (e) {
            console.warn('Store: повреждённое значение "' + key + '", сбрасываю.');
            Store.remove(key);
            return fallback;
        }
    }
};

// Телефон или планшет: user agent, iPad под видом Mac, тач на небольшом экране.
const IS_MOBILE = (() => {
    const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasTouchScreen = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isSmallScreen = Math.max(window.innerWidth, window.innerHeight) <= 1366 &&
        Math.min(window.innerWidth, window.innerHeight) <= 1024;
    const isiPad = /iPad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return userAgentMobile || isiPad || (hasTouchScreen && isSmallScreen);
})();

// --- ЗЕМЛЯ (Terrain3D.js). Размер, текстура и рельеф — у каждой карты свои (Maps.js).
// Единицы мира — px: x вправо, y вниз по карте, высота вверх (скилл world3d, §Координаты). ---
const GROUND_TILE_SIZE = 900;           // px мира на один повтор текстуры земли
const TERRAIN_CELL = 100;                 // px: шаг сетки террейна (мобильные — не мельче 12)

// --- ЗВУК (Sound.js): громкость 0..1; выключенный звук игрок сохраняет сам (Store) ---
const SOUND_VOLUME = 0.8;               // эффекты
const SOUND_RADIUS_METERS = 12;         // радиус слышимости мировых звуков от игрока
const MUSIC_VOLUME = 0.5;               // музыка

// --- ЯЗЫК (Lang.js) ---
const LANG_AUTO = 0;                    // 1 — язык платформы, если он есть в словаре; 0 — всегда GAME_LANG

// --- КАМЕРА (CameraControl.js): цель на карте, азимут, наклон и зум. Зум —
// экранных px на мировой px в точке взгляда; расстояние выводится из него. ---
const CAMERA_FOV_DEG = 52;              // вертикальный угол обзора
const CAMERA_AZIMUTH_DEG = -90;         // куда смотрит камера по карте: −90 — север вверх, 0 — восток вверх
const CAMERA_PITCH_DEG = 57;            // наклон к земле: 90 — строго сверху, меньше — больше перспективы
const CAMERA_ZOOM = 1;                  // стартовый зум: ПК и планшеты
const CAMERA_ZOOM_MOBILE = 0.7;         // стартовый зум: телефоны (большая сторона экрана < 1024)
const CAMERA_ZOOM_MIN = 0.5;            // дальше колесо и щипок не отводят (ниже — в кадр попадёт край земли)
const CAMERA_ZOOM_MAX = 3;              // ближе не приближают
const CAMERA_ZOOM_WHEEL_STEP = 0.12;    // доля зума за один щелчок колеса
const CAMERA_ZOOM_LERP = 0.18;          // сглаживание зума: доля остатка за кадр
const CAMERA_FOLLOW_LERP = 0.05;        // слежение за объектом (follow): доля остатка за кадр
const CAMERA_PAN_KEY_SPEED = 900;       // WASD и стрелки: экранных px/с
const CAMERA_ORBIT = 1;                 // вращение камеры игроком (ПКМ): 0 — ориентация фиксирована, 1 — можно
const CAMERA_ORBIT_DEG_PER_PX = 0.3;    // градусов поворота на экранный px драга
const CAMERA_ORBIT_PITCH_MIN_DEG = 35;  // ниже к земле не опускается (предел поднимается и сам — край земли не в кадре)
const CAMERA_ORBIT_PITCH_MAX_DEG = 88;  // выше — почти строго сверху

// --- РЕНДЕР (World3D.js): свет, тени, небо, материалы, toon и контур. Читает
// World3D.cfg(), редактор применяет правки к живой сцене. ---
// Солнце одно на весь мир. Азимут — КУДА падает тень по карте (0 — вправо, 90 — вниз).
const WORLD3D_SUN_AZIMUTH_DEG = 32;
const WORLD3D_SUN_ELEVATION_DEG = 41;   // высота солнца над горизонтом
const WORLD3D_SUN_INTENSITY = 0.8;      // сила солнца (с небом в сумме ~1.0 на ровной земле — краска текстуры без изменений)
const WORLD3D_SUN_COLOR = 0xffedc7;     // цвет солнца
const WORLD3D_SKYLIGHT_INTENSITY = 0.45; // рассеянный свет неба (полусферический источник)
const WORLD3D_SKYLIGHT_COLOR = 0xb1d8f7; // цвет света неба (грани, смотрящие вверх)
const WORLD3D_GROUNDLIGHT_COLOR = 0xc2c7ad; // подсветка снизу (отражение от земли)
const WORLD3D_SKY_COLOR = 0x8fb4c8;     // цвет неба и тумана
const WORLD3D_FOG_DENSITY = 0.00021;    // экспоненциальный туман к горизонту (0 — выключить)
// Тени: один цвет на все (красит toon-плагин, Babylon даёт только видимость солнца)
const WORLD3D_SHADOW_COLOR = 0x0f3a4d;  // цвет тени
const WORLD3D_SHADOW_STRENGTH = 0.55;    // сила тени 0..1: поверхность в тени умножается на смесь белого и цвета тени
const WORLD3D_SHADOW_SOFT = 2;          // край: 0 — жёсткий (под toon), 1..3 — PCF низкое/среднее/высокое (мобильные — не выше 1)
const WORLD3D_SHADOW_MAP = 2048;        // размер карты теней (мобильные — вдвое меньше); действует с новой сцены
const WORLD3D_SHADOW_RADIUS = 3600;      // px: ПРЕДЕЛ полуразмера ортокадра теней; сам кадр ужимается по объектам в кадре
const WORLD3D_SHADOW_BIAS = 0.0006;     // смещение глубины против «акне» (полосы тени на освещённых гранях)
const WORLD3D_SHADOW_NORMAL_BIAS = 0.8; // смещение вдоль нормали против «акне» (полосы и «пила» на гранях под острым углом к солнцу), в текселях карты теней сверх радиуса сглаживания края (его прибавляет движок)
// Материалы по группам (блик — доля 0..1, размер — показатель степени: больше — блик мельче)
const WORLD3D_GROUND_SPECULAR = 0;      // блик земли (0 — матовая)
const WORLD3D_GROUND_SPEC_POWER = 1;    // размер блика земли
const WORLD3D_OUTER_TINT = 1;           // яркость земли ЗА краем локации (меньше 1 — граница локации видна)
const WORLD3D_PROP_SPECULAR = 0.05;     // блик окружения (группа 'prop')
const WORLD3D_PROP_SPEC_POWER = 7;     // размер блика окружения
const WORLD3D_ACTOR_SPECULAR = 0;       // блик главных объектов (группа 'actor'); под toon — яркость «зайчика»
const WORLD3D_ACTOR_SPEC_POWER = 23;    // размер блика главных объектов
// Toon-шейдер (LoryToonPlugin): свет всех источников (солнце + небо, с тенью) квантуется в ступени
const WORLD3D_TOON = 0;                 // 1 — toon-затенение и обводка силуэта, 0 — обычное плавное без обводки
const WORLD3D_TOON_BANDS = 4;           // ступеней света (2..6)
const WORLD3D_TOON_SOFT = 0.02;         // мягкость границы ступени (0 — резко, 0.5 — почти плавно)
const WORLD3D_TOON_LOW = 0.48;          // яркость самой тёмной ступени (доля от полной)
const WORLD3D_TOON_GROUND = 1;          // 1 — ступени и на земле, 0 — земля затеняется плавно
const WORLD3D_TOON_SPEC = 0.25;            // сила блика-«зайчика» (0 — без блика)
const WORLD3D_TOON_SPEC_SIZE = 0.075;    // порог блика (меньше — крупнее пятно)
const WORLD3D_TOON_RIM = 0.28;           // светлый ободок по краю силуэта объектов (0 — нет)
const WORLD3D_TOON_RIM_WIDTH = 0.24;    // ширина ободка
// Контур рёбер (EdgesRenderer): рёбра, изломанные круче порога
const WORLD3D_TOON_INK = 0;             // 0 — нет, 1 — главные объекты, 2 — и окружение
const WORLD3D_TOON_INK_WIDTH = 25;      // толщина линии (≈ мировых px × 100; тоньше с удалением камеры)
const WORLD3D_TOON_INK_COLOR = 0x171717; // цвет чернил: контур рёбер и обводка силуэта
const WORLD3D_TOON_INK_ANGLE = 40;      // °: ребро рисуется, если грани изломаны круче
const WORLD3D_TOON_INK_MAX_TRIS = 20000; // часть модели тяжелее (треугольников) — без контура рёбер; 0 — без предела
// Обводка внешнего силуэта: постэффект (HighlightLayer, isStroke), толщина — в экранных px
const WORLD3D_TOON_OUTLINE = 0;         // 0 — нет, 1 — главные объекты, 2 — и окружение (только при WORLD3D_TOON = 1)
const WORLD3D_TOON_OUTLINE_ACTOR_WIDTH = 1.5;   // экранных px: обводка главных объектов
const WORLD3D_TOON_OUTLINE_PROP_WIDTH = 1;  // экранных px: обводка окружения (его в кадре много — тоньше)

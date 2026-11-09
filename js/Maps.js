// Maps.js — карты игры: земля, рельеф и объекты каждой карты. Пишет редактор
// (вкладки Maps и Objects) — файл целиком, формат держать.
// Карта: id — латиница, цифры, _ и - (по нему игра грузит карту: app.loadMap(id));
//   name — название для редактора; width, height — px мира; ground — текстура земли
//   (0 — трава, 1 — песок, 2 — снег); terrain — рельеф: amp — высота холмов px (0 —
//   плоско), scale — размер холма px, seed — сид шума, base — уровень земли px.
// Объект карты: kind — 'prop' (окружение) | 'actor' (главный объект кадра) | 'marker'
//   (точка для логики игры без модели: спавн, враг, финиш — location.markers(имя));
//   model — путь модели от assets/ (.fbx, .obj, .glb, .gltf) строковым литералом: сборщик
//   берёт в архив только ассеты с такими ссылками; x, y — px карты; h — px над землёй;
//   rot — [x, y, z] градусы: y — курс (0 — вдоль +x, 90 — вниз по карте), x и z — наклон;
//   scale — [x, y, z] к размеру модели (1 см = 1 px); anim — вращение части модели
//   (необязательно): part — объект внутри модели, axis — его ось 'x' | 'y' | 'z' (с
//   минусом — обратный конец), speed — об/мин, dir — 'cw' | 'ccw' с конца оси.
const GAME_MAPS = [
    {
        id: 'forest', name: '99 Nights', width: 40000, height: 40000, ground: 0,
        terrain: { amp: 420, scale: 4200, seed: 99, base: 0 },
        objects: [
            { name: 'spawn', kind: 'marker', x: 20000, y: 20000, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'camp-storage', kind: 'marker', x: 19630, y: 19940, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-carrots', kind: 'marker', x: 18910, y: 18444, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-campsite', kind: 'marker', x: 22949, y: 22065, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-pond', kind: 'marker', x: 21139, y: 15750, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-well', kind: 'marker', x: 19425, y: 26575, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-cabin', kind: 'marker', x: 13422, y: 22394, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-sawmill', kind: 'marker', x: 26582, y: 16200, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-cabin', kind: 'marker', x: 28645, y: 23147, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'den-wolf', kind: 'marker', x: 11481, y: 16027, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-ruins', kind: 'marker', x: 18264, y: 29848, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'kid-dino', kind: 'marker', x: 10393, y: 15520, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-watchtower', kind: 'marker', x: 25950, y: 30306, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'den-alpha', kind: 'marker', x: 26050, y: 9521, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-graveyard', kind: 'marker', x: 8254, y: 24275, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-mine', kind: 'marker', x: 15554, y: 7784, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'kid-kraken', kind: 'marker', x: 26700, y: 8395, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-cabin', kind: 'marker', x: 25130, y: 5905, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'cave-bear', kind: 'marker', x: 30748, y: 30748, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-cultist', kind: 'marker', x: 9844, y: 32104, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'kid-squid', kind: 'marker', x: 30413, y: 32410, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'kid-koala', kind: 'marker', x: 8542, y: 32287, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'poi-obelisk', kind: 'marker', x: 3273, y: 13912, h: 0, rot: [0, 0, 0], scale: [1, 1, 1] },
        ],
    },
];

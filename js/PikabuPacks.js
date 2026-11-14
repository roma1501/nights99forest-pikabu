// @ts-nocheck
// PikabuPacks.js — наборы за рубли в сборке Пикабу Игр (js/PikabuShop.js). Цены и названия товаров — в Студии
// (каталог CSV: coins_s 19 ₽, coins_m 49 ₽, coins_l 99 ₽, starter 29 ₽, no_ads 59 ₽), здесь — что игрок получает.
// Монеты — Econ.addCoins (сохраняет и обновляет счётчик), облики и рюкзак набора — Econ.owned.
PikabuShop.setup({
    colors: ['#ff8a3d', '#2e7d32'],
    ready: () => !!(typeof Econ !== 'undefined' && Econ.owned && typeof Game !== 'undefined' && Game.state && Game.state !== 'boot'),
    visible: () => Game.state === 'menu' && !(typeof UI !== 'undefined' && UI.modal),
    persist: () => Econ.save(),
    button: { corner: 'tr', x: 12, y: 74 },
    packs: [
        { id: 'coins_s', type: 'consumable', icon: '🪙', name: 'Горсть монет', desc: '500 монет на облики и рюкзаки', grant: () => Econ.addCoins(500, 'pikabu') },
        { id: 'coins_m', type: 'consumable', icon: '💰', name: 'Мешок монет', desc: '1 500 монет', grant: () => Econ.addCoins(1500, 'pikabu') },
        { id: 'coins_l', type: 'consumable', icon: '🏆', name: 'Сундук монет', desc: '4 000 монет — хватит на самые дорогие облики', best: true, grant: () => Econ.addCoins(4000, 'pikabu') },
        {
            id: 'starter', type: 'non_consumable', icon: '🎒', name: 'Король леса', best: 'Один раз',
            desc: '800 монет, облики «Король леса» и «Звёздный капитан» и легендарный рюкзак на 25 мест',
            grant: () => Econ.addCoins(800, 'pikabu'),
            apply: () => {
                let n = 0;
                for (const id of ['forestking', 'starcaptain', 'pack6']) if (!Econ.owned[id]) { Econ.owned[id] = true; n++; }
                if (n) Econ.save();
            },
        },
        { id: 'no_ads', type: 'non_consumable', icon: '🚫', name: 'Без рекламы', desc: 'Убирает межстраничную рекламу навсегда. Награды за рекламу остаются', noAds: true },
    ],
});

// Panels2.js — окна второго слоя: магазин скинов, журнал заданий, смерть (сердца), «сердца закончились», выбор режима игры.
// Дополняет UIPanels (методы build_<имя>); загружается после UIPanels.js.

(function () {
    const s = document.createElement('style');
    s.textContent = `
.shopP{position:absolute !important;left:max(2vw,10px);top:50%;transform:translateY(-50%);width:min(640px,96vw);max-height:92vh;animation:none !important;padding:16px 16px 14px}
.shopHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 46px 8px 0}
.coinPill{display:flex;align-items:center;gap:8px;padding:4px 14px 4px 6px;border-radius:22px;background:rgba(0,0,0,.4);border:3px solid #000;font-size:22px}
.coinPill .ci{width:30px;height:30px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2a8,#ffc21a 55%,#c98a00);border:3px solid #000;display:flex;align-items:center;justify-content:center;font-size:16px;color:#7a4a00;-webkit-text-stroke:0}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.tab{flex:1 1 auto;min-width:92px;padding:6px 10px;border-radius:12px;border:3px solid #000;background:#2c2e3a;cursor:pointer;font-size:16px;text-align:center;transition:transform .1s,background .1s}
.tab:hover{transform:translateY(-2px)}
.tab.on{background:var(--c,#4ade6a);color:#0a0a10;-webkit-text-stroke:0;text-shadow:none}
.skGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px;max-height:calc(92vh - 210px);overflow:auto;padding:2px 4px 6px 2px}
.sk{position:relative;padding:8px 8px 10px;border-radius:14px;background:linear-gradient(#34364a,#23242f);border:3px solid #000;cursor:pointer;transition:transform .12s;display:flex;flex-direction:column;gap:6px}
.sk:hover{transform:translateY(-3px)}
.sk.sel{outline:4px solid #fff;outline-offset:1px}
.sk.eq{border-color:#4ade6a}
.sk .rar{position:absolute;left:0;top:0;right:0;height:7px;border-radius:10px 10px 0 0;background:var(--rc)}
.sk .nm{margin-top:6px;font-size:17px;line-height:1.05;min-height:36px}
.sk .sw3{display:flex;gap:4px}
.sk .sw3 i{flex:1;height:16px;border-radius:6px;border:2px solid #000}
.sk .rt{font-size:12px;opacity:.85;-webkit-text-stroke:0;color:var(--rc)}
.sk .btn{min-height:38px;padding:4px 10px;font-size:16px;border-width:3px;box-shadow:0 3px 0 rgba(0,0,0,.4)}
.sk .own{font-size:15px;text-align:center;color:#8aff9a}
.adBar{display:flex;gap:4px;justify-content:center}
.adBar i{width:18px;height:8px;border-radius:4px;border:2px solid #000;background:#2a2c38}
.adBar i.on{background:#ffb020}
.hearts4{display:flex;gap:8px;justify-content:center;margin:6px 0 10px}
.hearts4 svg{width:54px;height:54px;filter:drop-shadow(0 4px 0 rgba(0,0,0,.6))}
.hearts4 .lost{opacity:.3;filter:grayscale(1)}
.hearts4 .brk{animation:heartBreak 1s .3s both}
@keyframes heartBreak{0%{transform:scale(1)}25%{transform:scale(1.5) rotate(-10deg)}100%{transform:scale(1);opacity:.3;filter:grayscale(1)}}
.modeRow{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin:14px 0 6px}
.mode{width:min(178px,42vw);padding:12px 10px;border-radius:16px;background:linear-gradient(#34364a,#23242f);border:4px solid #000;cursor:pointer;text-align:center;transition:transform .12s}
.mode:hover{transform:translateY(-4px) scale(1.03)}
.mode .ic{font-size:44px;line-height:1.1}
.mode h3{margin:4px 0;font-size:22px}
.mode p{margin:0;font-size:14px;font-weight:600;opacity:.85;-webkit-text-stroke:0;color:#fff}
.qCh{margin:10px 0 4px;font-size:20px;color:#ffe066}
.qStep{display:flex;gap:10px;align-items:flex-start;padding:5px 8px;border-radius:10px;font-size:16px}
.qStep .mk{flex:0 0 26px;height:26px;border-radius:50%;border:3px solid #000;background:#2a2c38;display:flex;align-items:center;justify-content:center;font-size:14px;-webkit-text-stroke:0}
.qStep.done{opacity:.55}
.qStep.done .mk{background:#22a446}
.qStep.cur{background:rgba(255,224,102,.14);outline:3px solid #ffe066}
.qStep.cur .mk{background:#ffe066;color:#000}
.qStep .dd{font-size:14px;font-weight:600;opacity:.9;-webkit-text-stroke:0;color:#dfe6ff;margin-top:2px}
.qList{max-height:min(60vh,520px);overflow:auto;padding-right:6px}
.sk .ico{display:flex;justify-content:center;margin-top:4px}
.sk .ico img{width:86px;height:86px;object-fit:contain;filter:drop-shadow(0 3px 0 rgba(0,0,0,.45))}
.tab img{width:22px;height:22px;vertical-align:-5px;margin-right:4px}
.coinPill .ci{width:30px;height:30px;object-fit:contain}
.btn img.bi{width:22px;height:22px;vertical-align:-5px;margin-right:6px}
.invP{width:min(800px,96vw);max-height:94vh;overflow:auto}
.invHead{display:flex;align-items:center;gap:12px;margin:0 46px 10px 0;padding:6px 10px;border-radius:14px;background:rgba(0,0,0,.32);border:3px solid #000}
.invHead img.pkI{width:54px;height:54px;object-fit:contain}
.invHead .pkN{font-size:22px;line-height:1.05}
.invHead .pkS{font-size:15px;opacity:.85;-webkit-text-stroke:0}
.invHead .btn{margin-left:auto;min-height:40px;padding:4px 14px;font-size:16px}
.invBody{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}
.invLeft{flex:1 1 360px;min-width:280px}
.invRight{flex:1 1 220px;min-width:200px;padding:10px;border-radius:14px;background:rgba(0,0,0,.28);border:3px solid #000;min-height:250px}
.invLab{font-size:15px;margin:6px 2px 4px;opacity:.9}
.invGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}
.cell{position:relative;aspect-ratio:1;border-radius:11px;background:linear-gradient(#34364a,#23242f);border:3px solid #000;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .1s}
.cell:hover{transform:translateY(-2px)}
.cell img{width:78%;height:78%;object-fit:contain;pointer-events:none;filter:drop-shadow(0 2px 0 rgba(0,0,0,.5))}
.cell .k{position:absolute;left:4px;top:1px;font-size:11px;opacity:.85}
.cell .n{position:absolute;right:4px;bottom:0;font-size:15px}
.cell .fb{font-size:24px}
.cell.empty{opacity:.55}
.cell.held{border-color:#4ade6a}
.cell.sel{outline:4px solid #fff;outline-offset:1px}
.cell.mv{outline:4px dashed #ffd24a;outline-offset:1px}
.cell.over{background:#4a4f6a;outline:3px solid #ffd24a}
.cell{touch-action:none;user-select:none;-webkit-user-select:none}
.cell.dragSrc{opacity:.35}
.dragGhost{position:fixed;left:0;top:0;width:60px;height:60px;pointer-events:none;z-index:99999;filter:drop-shadow(0 8px 6px rgba(0,0,0,.6));will-change:transform}
.dragGhost img{width:100%;height:100%;object-fit:contain}
.dragGhost .n{position:absolute;right:0;bottom:-4px;font-size:16px;color:#fff}
.invDetail .big{width:84px;height:84px;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:rgba(255,255,255,.07);border:3px solid #000}
.invDetail .big img{width:88%;height:88%;object-fit:contain}
.invDetail h3{margin:0 0 2px;text-align:center;font-size:22px}
.invDetail .ds{font-size:14px;font-weight:600;opacity:.9;-webkit-text-stroke:0;text-align:center;margin:2px 0 6px;color:#dfe6ff}
.invDetail .chips{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-bottom:8px}
.invDetail .chips span{padding:1px 9px;border-radius:10px;background:#2c2e3a;border:2px solid #000;font-size:13px;-webkit-text-stroke:0}
.invDetail .acts{display:flex;flex-direction:column;gap:6px}
.invDetail .acts .btn{min-height:40px;font-size:16px;padding:4px 10px}
.invFoot{margin-top:8px;font-size:13px;opacity:.75;text-align:center;font-weight:600;-webkit-text-stroke:0}
.shopP h2{margin-right:44px}
@media (max-width:600px){
#panels .shopP{left:2vw;width:96vw;padding:12px 10px 10px}
#panels .shopP h2{font-size:24px;text-align:left;margin:0 46px 6px 4px}
#panels .shopHead{margin:0 0 6px}#panels .shopHead .hint{display:none}
#panels .tabs{flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto;padding-bottom:5px;margin-bottom:6px}
#panels .tab{flex:0 0 auto;min-width:0;padding:5px 9px;font-size:14px;white-space:nowrap}
#panels .skGrid{grid-template-columns:repeat(2,minmax(0,1fr));max-height:calc(92vh - 140px)}
#panels .sk .ico img{width:66px;height:66px}#panels .sk .nm{font-size:15px;min-height:30px}
#panels .invP{padding:12px 10px}#panels .invP h2{font-size:24px;text-align:left;margin:0 46px 6px 4px}
#panels .invHead{margin:0 0 8px}#panels .invHead .pkN{font-size:18px}
#panels .invLeft{flex-basis:100%}#panels .invRight{flex-basis:100%;min-height:0}
}
@media (max-height:520px){
#panels .shopP{width:min(760px,96vw);max-height:96vh;padding:10px 12px}#panels .shopP h2{font-size:22px;margin:0 46px 4px 0}#panels .shopHead .hint{display:none}#panels .shopHead{margin:0 0 4px}
#panels .skGrid{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));max-height:calc(96vh - 110px)}#panels .sk .ico img{width:56px;height:56px}
#panels .invP{max-height:96vh}#panels .invP h2{font-size:22px;margin:0 46px 4px 0}#panels .invBody{flex-wrap:nowrap}#panels .invRight{min-height:0}
#panels .invHead img.pkI{width:36px;height:36px}#panels .invHead{padding:2px 8px;margin-bottom:4px}#panels .invHead .pkN{font-size:17px}#panels .invGrid{gap:5px}#panels .invLab{margin:2px 2px 2px}#panels .invFoot{display:none}
#panels .invLeft{flex:0 0 52%}#panels .invRight{padding:6px}#panels .invDetail .big{width:52px;height:52px;margin-bottom:2px}#panels .invDetail h3{font-size:18px}#panels .invDetail .ds{font-size:12px;margin:0 0 4px}
#panels .invDetail .acts{flex-direction:row;flex-wrap:wrap}#panels .invDetail .acts .btn{flex:1 1 45%;min-height:32px;font-size:14px;padding:2px 6px}
}
#ui #panels .shopP{width:min(640px,44vw)}
@media(max-width:600px) and (orientation:portrait){#ui #panels .shopP{left:2vw;top:auto;bottom:max(10px,env(safe-area-inset-bottom));transform:none;width:96vw;max-height:54vh;padding:10px}#panels .shopP .skGrid{max-height:calc(54vh - 128px)}#panels .shopP h2{font-size:22px}}
`;
    document.head.appendChild(s);
})();

/** @type {Record<string, any>} */
const PANELS2 = {
    // ------------------------------------------------------------------------------ магазин скинов
    // Кнопка с иконкой (монета / реклама): иконка — assets/icons/ui/<kind>.webp или временная
    priceBtn(kind, text, cls, fn) {
        const b = this.el('button', 'btn ' + (cls || ''));
        b.innerHTML = Icons.html('ui', kind, 'bi');
        b.appendChild(document.createTextNode(text));
        b.onclick = (e) => { Sfx.ui('click'); fn(e); };
        return b;
    },
    build_shop(d) {
        Game.outfitEnter && Game.outfitEnter();
        if (d && d.from) this._shopFrom = d.from;
        const PACKS = { id: 'packs', color: '#ffb020', name: ['Рюкзаки', 'Backpacks'] };
        this._shopTheme = (d && d.theme) || this._shopTheme || SKINS.themes[0].id;
        const nm = (pair) => pair[Lang.code === 'en' ? 1 : 0];
        const p = this.panel(Lang.t('shop.title'), true);
        p.classList.add('shopP');
        p.querySelector('.close').onclick = () => { Sfx.ui('cancel'); this.leaveShop(); };
        const head = this.el('div', 'shopHead');
        head.appendChild(this.el('div', 'hint rb1', Lang.t('shop.hint')));
        head.appendChild(this.el('div', 'coinPill', Icons.html('ui', 'coin', 'ci') + '<span class="rb1">' + Econ.coins + '</span>'));
        p.appendChild(head);
        // категории: 5 тем скинов + рюкзаки
        const tabs = this.el('div', 'tabs');
        for (const t of SKINS.themes.concat([PACKS])) {
            const isPack = t.id === 'packs';
            const cnt = isPack ? DATA.packs.filter((q, i) => i === 0 || Econ.has(q.id)).length + '/' + DATA.packs.length : SKINS.items.filter(i => i.theme === t.id && Econ.has(i.id)).length + '/8';
            const b2 = this.el('div', 'tab rb1' + (t.id === this._shopTheme ? ' on' : ''), Icons.html('themes', t.id, '') + nm(t.name) + ' <small>' + cnt + '</small>');
            b2.style.setProperty('--c', t.color);
            b2.onclick = () => { Sfx.ui('select'); this._shopTheme = t.id; this.open('shop'); };
            tabs.appendChild(b2);
        }
        p.appendChild(tabs);
        setTimeout(() => { const on = tabs.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' }); }, 0);
        const grid = this.el('div', 'skGrid');
        p.appendChild(grid);
        if (this._shopTheme === 'packs') { this.shopPacks(grid, nm); return p; }
        // карточки скинов
        const list = SKINS.items.filter(i => i.theme === this._shopTheme);
        if (this._shopTheme === SKINS.themes[0].id) list.unshift(SKINS.default);
        for (const sk of list) {
            const R = SKINS.rarity[sk.rarity];
            const card = this.el('div', 'sk' + (this._shopSel === sk.id ? ' sel' : '') + (Econ.skin === sk.id ? ' eq' : ''));
            card.style.setProperty('--rc', R.color);
            card.appendChild(this.el('div', 'rar'));
            card.appendChild(this.el('div', 'ico', Icons.html('skins', sk.id, '')));
            card.appendChild(this.el('div', 'nm rb1', nm(sk.name)));
            card.appendChild(this.el('div', 'rt', nm(R.name)));
            if (sk.colors) { const sw = this.el('div', 'sw3'); for (const k of ['shirt', 'jacket', 'pants', 'accA']) { const i = this.el('i'); i.style.background = sk.colors[k]; sw.appendChild(i); } card.appendChild(sw); }
            const owned = Econ.has(sk.id);
            if (Econ.skin === sk.id) card.appendChild(this.el('div', 'own rb1', '✔ ' + Lang.t('shop.worn')));
            else if (owned) card.appendChild(this.btn(Lang.t('shop.wear'), 'sm', () => { Econ.equip(sk.id); Sfx.ui('select'); this._shopSel = sk.id; this.open('shop'); }));
            else if (sk.unlock.coins) {
                const can = Econ.coins >= sk.unlock.coins;
                card.appendChild(this.priceBtn('coin', '' + sk.unlock.coins, 'sm' + (can ? '' : ' gray'), () => { if (Econ.buy(sk.id)) { Econ.equip(sk.id); UI.setCoins(Econ.coins, 0); UI.toast(Lang.t('shop.bought', { n: nm(sk.name) }), 'good'); this._shopSel = sk.id; this.open('shop'); } }));
            } else if (sk.unlock.ads && !Platform.adsAvailable()) {
                card.appendChild(this.el('div', 'hint', Lang.t('shop.noAds')));
            } else if (sk.unlock.ads) {
                const have = Econ.ads[sk.id] || 0, need = Econ.adsNeed(sk);
                const bar = this.el('div', 'adBar'); for (let i = 0; i < need; i++) bar.appendChild(this.el('i', i < have ? 'on' : ''));
                card.appendChild(bar);
                card.appendChild(this.priceBtn('ad', Lang.t('shop.watch') + ' ' + have + '/' + need, 'sm blue', async () => {
                    const ok = await Econ.watchAd(sk.id);
                    if (ok) { if (Econ.has(sk.id)) { Econ.equip(sk.id); UI.toast(Lang.t('shop.bought', { n: nm(sk.name) }), 'good'); } this._shopSel = sk.id; this.open('shop'); }
                    else if (!Platform.adsAvailable()) this.open('shop');
                }));
            }
            // выбор карточки = примерка на герое
            card.onclick = (e) => { if (e.target.closest && e.target.closest('.btn')) return; this._shopSel = sk.id; Player.previewSkin(sk.id); Sfx.ui('select'); grid.querySelectorAll('.sk').forEach(x => x.classList.remove('sel')); card.classList.add('sel'); };
            grid.appendChild(card);
        }
        if (this._shopSel && this._shopSel !== Econ.skin && !Econ.has(this._shopSel)) Player.previewSkin(this._shopSel);
        else if (this._shopSel && Econ.has(this._shopSel) && this._shopSel !== Econ.skin) Player.previewSkin(this._shopSel);
        return p;
    },
    // Вкладка рюкзаков: от старого мешка до легендарного рюкзака
    shopPacks(grid, nm) {
        const best = Econ.packTier();
        DATA.packs.forEach((pk, i) => {
            const R = SKINS.rarity[pk.rarity];
            const owned = i === 0 || Econ.has(pk.id), worn = i === best;
            const card = this.el('div', 'sk' + (worn ? ' eq' : ''));
            card.style.setProperty('--rc', R.color);
            card.appendChild(this.el('div', 'rar'));
            card.appendChild(this.el('div', 'ico', Icons.html('packs', pk.id, '')));
            card.appendChild(this.el('div', 'nm rb1', nm(pk.name)));
            card.appendChild(this.el('div', 'rt', Lang.t('pack.slots', { n: pk.slots }) + ' · ' + nm(R.name)));
            if (worn) card.appendChild(this.el('div', 'own rb1', '✔ ' + Lang.t('pack.worn')));
            else if (owned || i < best) card.appendChild(this.el('div', 'own rb1', Lang.t(owned ? 'pack.have' : 'pack.lower')));
            else if (pk.unlock.coins) {
                const can = Econ.coins >= pk.unlock.coins;
                card.appendChild(this.priceBtn('coin', '' + pk.unlock.coins, 'sm' + (can ? '' : ' gray'), () => { if (Econ.buyPack(i)) { UI.setCoins(Econ.coins, 0); UI.toast(Lang.t('pack.bought', { n: nm(pk.name) }), 'good'); this.open('shop'); } }));
            } else if (pk.unlock.ads && !Platform.adsAvailable()) {
                card.appendChild(this.el('div', 'hint', Lang.t('shop.noAds')));
            } else if (pk.unlock.ads) {
                const have = Econ.ads[pk.id] || 0, need = Econ.adsNeed(pk);
                const bar = this.el('div', 'adBar'); for (let q = 0; q < need; q++) bar.appendChild(this.el('i', q < have ? 'on' : ''));
                card.appendChild(bar);
                card.appendChild(this.priceBtn('ad', Lang.t('shop.watch') + ' ' + have + '/' + need, 'sm blue', async () => {
                    const ok = await Econ.watchPack(i);
                    if (ok) { if (Econ.has(pk.id)) UI.toast(Lang.t('pack.bought', { n: nm(pk.name) }), 'good'); this.open('shop'); }
                    else if (!Platform.adsAvailable()) this.open('shop');
                }));
            }
            grid.appendChild(card);
        });
    },
    leaveShop() {
        Player.applySkin(Econ.skin);
        this._shopSel = null;
        if (this._shopFrom === 'title' || Game.state === 'menu') { Game.outfitBack && Game.outfitBack(); this.open('title'); }
        else if (this._shopFrom === 'inv' && Game.state === 'play') { Game.outfitBack && Game.outfitBack(); this._shopFrom = null; Cam.mode = 'follow'; Cam._cd = null; this.open('inv'); }
        else { this.close(); if (Game.state === 'play') { Cam.mode = 'follow'; Cam._cd = null; } }
    },

    // ------------------------------------------------------------------------------ инвентарь
    INV_TYPE: { tool: ['Инструмент', 'Tool'], weapon: ['Оружие', 'Weapon'], food: ['Еда', 'Food'], heal: ['Лечение', 'Healing'], res: ['Ресурс', 'Resource'], ammo: ['Патроны', 'Ammo'], key: ['Ключ', 'Key'], build: ['Постройка', 'Buildable'], throw: ['Граната', 'Grenade'], misc: ['Разное', 'Misc'] },
    build_inv() {
        Input.unlock && Input.unlock();
        const nm = (pair) => pair[Lang.code === 'en' ? 1 : 0];
        const p = this.panel(Lang.t('inv.title'), true);
        p.classList.add('invP');
        this._invSel = Math.min(this._invSel == null ? Inv.sel : this._invSel, Inv.cap - 1); this._invMove = null;
        const head = this.el('div', 'invHead');
        head.appendChild(this.el('div', 'invHeadIn'));
        head.appendChild(this.btn(Lang.t('inv.more'), 'sm blue', () => this.open('shop', { theme: 'packs', from: 'inv' })));
        p.appendChild(head);
        const body = this.el('div', 'invBody');
        const left = this.el('div', 'invLeft'), right = this.el('div', 'invRight invDetail');
        body.appendChild(left); body.appendChild(right);
        p.appendChild(body);
        p.appendChild(this.el('div', 'invFoot', Lang.t('inv.tip')));
        p.appendChild(this.el('div', 'invFoot', Lang.t('inv.padTip')));
        this._inv = { head, left, right, nm };
        this._invRender();
        return p;
    },
    _invRender() {
        const I = this._inv; if (!I) return;
        const { head, left, right, nm } = I;
        // шапка: рюкзак
        const pk = DATA.packs[Inv.tier], used = Inv.slots.filter(Boolean).length;
        const hi = head.querySelector('.invHeadIn'); hi.style.display = 'contents';
        hi.innerHTML = Icons.html('packs', pk.id, 'pkI') + '<div><div class="pkN rb1">' + nm(pk.name) + '</div><div class="pkS">' + Lang.t('inv.slots', { a: used, b: Inv.cap }) + '</div></div>';
        // сетка слотов
        left.innerHTML = '';
        const hot = Inv.hot;
        const mkGrid = (from, to, label, keys) => {
            left.appendChild(this.el('div', 'invLab rb1', label));
            const g = this.el('div', 'invGrid');
            for (let i = from; i < to; i++) {
                const s = Inv.slots[i];
                const c = this.el('div', 'cell' + (s ? '' : ' empty') + (i === Inv.sel ? ' held' : '') + (i === this._invSel ? ' sel' : '') + (i === this._invMove ? ' mv' : ''));
                if (keys) c.appendChild(this.el('span', 'k rb1', '' + ((i + 1) % 10)));
                if (s) { c.insertAdjacentHTML('beforeend', UI.icon(s.id)); if (s.n > 1) c.appendChild(this.el('span', 'n rb1', '' + s.n)); if (s.lv) c.appendChild(this.el('span', 'lv rb1' + (s.lv >= 3 ? ' l3' : ''), '+' + s.lv)); }
                c.dataset.i = '' + i;
                c.onclick = () => { if (this._dragged) return; this._invClick(i); };
                c.oncontextmenu = (e) => { e.preventDefault(); this._invSel = i; this._invMove = Inv.slots[i] ? i : null; this._invRender(); };
                // drag & drop на pointer-событиях: мышь и палец одинаково (HTML5 DnD в некоторых оболочках не работает)
                if (s) c.onpointerdown = (e) => this._dragStart(e, i, c);
                g.appendChild(c);
            }
            left.appendChild(g);
        };
        mkGrid(0, hot, Lang.t('inv.hot'), true);
        if (Inv.cap > hot) {
            mkGrid(hot, Inv.cap, Lang.t('inv.bag'), false);
            const sortB = this.btn(Lang.t('inv.sort'), 'sm gray', () => { Inv.sortBag(); Sfx.ui('select'); this._invRender(); });
            sortB.style.marginTop = '8px'; left.appendChild(sortB);
        }
        // подробности
        right.innerHTML = '';
        const s = Inv.slots[this._invSel];
        if (!s) { right.appendChild(this.el('div', 'hint rb1', Lang.t('inv.pick'))); return; }
        const d = DATA.items[s.id];
        right.appendChild(this.el('div', 'big', UI.icon(s.id)));
        right.appendChild(this.el('h3', 'rb1', UI.name(s.id) + (s.lv ? ' +' + s.lv : '')));
        const dk = 'itemd.' + s.id, dt = Lang.t(dk);
        if (dt !== dk) right.appendChild(this.el('div', 'ds', dt));
        const chips = this.el('div', 'chips');
        const tp = this.INV_TYPE[d.throw ? 'throw' : d.type] || this.INV_TYPE.misc;
        chips.appendChild(this.el('span', '', nm(tp)));
        if (d.stack > 1) chips.appendChild(this.el('span', '', Lang.t('inv.stack', { a: s.n, b: d.stack })));
        if (d.dmg) chips.appendChild(this.el('span', '', Lang.t('inv.dmg', { n: Math.round(d.dmg * (1 + 0.18 * (s.lv | 0))) })));
        if (d.hp > 0) chips.appendChild(this.el('span', '', Lang.t('inv.heal', { n: d.hp })));
        if (d.hunger) chips.appendChild(this.el('span', '', Lang.t('inv.food', { n: d.hunger })));
        if (d.fuel) chips.appendChild(this.el('span', '', Lang.t('inv.fuel', { n: d.fuel })));
        right.appendChild(chips);
        const acts = this.el('div', 'acts');
        const inHot = this._invSel < hot;
        const useful = d.type === 'food' || d.type === 'heal' || d.type === 'weapon' || d.type === 'tool' || d.type === 'build' || d.throw;
        if (useful) acts.appendChild(this.btn(Lang.t(d.type === 'food' || d.type === 'heal' ? 'inv.use' : 'inv.equip'), '', () => this._invHold(d.type === 'food' || d.type === 'heal')));
        else if (!inHot) acts.appendChild(this.btn(Lang.t('inv.toHot'), 'gray', () => this._invHold(false, true)));
        acts.appendChild(this.btn(Lang.t('inv.move'), 'gray', () => { this._invMove = this._invSel; Sfx.ui('select'); this._invRender(); }));
        if (d.type !== 'key' && d.type !== 'wallet') {
            acts.appendChild(this.btn(Lang.t('inv.drop1'), 'gray', () => { Player.dropSlot(this._invSel, 1); this._invRender(); }));
            if (s.n > 1) acts.appendChild(this.btn(Lang.t('inv.dropAll'), 'gray', () => { Player.dropSlot(this._invSel, s.n); this._invRender(); }));
        }
        right.appendChild(acts);
    },
    // Перетаскивание предмета: потянул ячейку — за курсором летит иконка; отпустил на другой ячейке — обмен/слияние стопок,
    // отпустил за пределами окна — предмет выбрасывается в мир. Короткий клик без сдвига остаётся выбором ячейки.
    _dragStart(e, i, cell) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (this._drag) return;
        const D = this._drag = { i, x0: e.clientX, y0: e.clientY, active: false, ghost: null, cell, pid: e.pointerId, over: null };
        const move = (ev) => {
            if (ev.pointerId !== D.pid) return;
            if (!D.active) {
                if (Math.hypot(ev.clientX - D.x0, ev.clientY - D.y0) < 6) return;
                D.active = true;
                const s = Inv.slots[i];
                const g = document.createElement('div');
                g.className = 'dragGhost';
                g.innerHTML = UI.icon(s.id) + (s.n > 1 ? '<span class="n rb1">' + s.n + '</span>' : '');
                (UI.root || document.body).appendChild(g);
                // начало слоя интерфейса в окне (Playgama на ПК: поле 2:1 по центру окна)
                const host = UI.root || document.body, rr = host.getBoundingClientRect ? host.getBoundingClientRect() : null;
                D.ox = rr ? rr.left : 0; D.oy = rr ? rr.top : 0;
                D.ghost = g; cell.classList.add('dragSrc'); Sfx.ui('select');
            }
            ev.preventDefault();
            D.ghost.style.transform = 'translate(' + (ev.clientX - 30 - (D.ox || 0)) + 'px,' + (ev.clientY - 30 - (D.oy || 0)) + 'px)';
            const t = document.elementFromPoint(ev.clientX, ev.clientY), tc = t && t.closest ? t.closest('.cell') : null;
            if (D.over !== tc) { if (D.over) D.over.classList.remove('over'); D.over = tc; if (tc) tc.classList.add('over'); }
        };
        const end = (ev) => {
            if (ev.pointerId !== D.pid) return;
            document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end);
            this._drag = null;
            if (D.ghost) D.ghost.remove();
            if (!D.active) return;
            this._dragged = true; setTimeout(() => { this._dragged = false; }, 60);
            const t = document.elementFromPoint(ev.clientX, ev.clientY);
            const tc = /** @type {HTMLElement | null} */ (t && t.closest ? t.closest('.cell') : null);
            if (ev.type === 'pointercancel') { this._invRender(); return; }
            if (tc && tc.dataset.i != null) {
                const j = +tc.dataset.i;
                if (j !== i) { Inv.swap(i, j); Sfx.ui('select'); this._invSel = j; }
            } else if (!(t && t.closest && t.closest('.invP'))) {
                // за окном — выбросить стопку
                const s = Inv.slots[i];
                if (s && DATA.items[s.id].type !== 'key' && DATA.items[s.id].type !== 'wallet') { Player.dropSlot(i, s.n); this._invSel = i; }
            }
            this._invRender();
        };
        D.cancel = () => end({ pointerId: D.pid, type: 'pointercancel', clientX: D.x0, clientY: D.y0 });
        document.addEventListener('pointermove', move, { passive: false });
        document.addEventListener('pointerup', end);
        document.addEventListener('pointercancel', end);
    },
    _invClick(i) {
        if (this._invMove != null && this._invMove !== i) { Inv.swap(this._invMove, i); Sfx.ui('select'); this._invSel = i; this._invMove = null; this._invRender(); return; }
        this._invMove = null; this._invSel = i; Sfx.ui('select');
        if (i < Inv.hot && Inv.slots[i]) Inv.select(i);
        this._invRender();
    },
    _invPadClick(i) {
        if (!Number.isInteger(i) || i < 0 || i >= Inv.cap) return;
        if (this._invMove != null) {
            if (this._invMove !== i) Inv.swap(this._invMove, i);
            this._invMove = null;
        } else if (Inv.slots[i]) this._invMove = i;
        this._invSel = i; Sfx.ui('select'); this._invRender();
    },
    // Взять выбранный предмет в руки (из рюкзака — в активный слот быстрого доступа); use — сразу использовать
    _invHold(use, onlyMove) {
        let i = this._invSel;
        if (i >= Inv.hot) { Inv.swap(i, Inv.sel); i = Inv.sel; this._invSel = i; } else Inv.select(i);
        Sfx.ui('equip');
        if (onlyMove) { this._invRender(); return; }
        const id = Inv.slots[i] && Inv.slots[i].id;
        this.close();
        if (use && id) { const d = DATA.items[id]; setTimeout(() => { if (Game.state === 'play' && !Player.dead) Player.consume(id, d); }, 120); }
    },

    // ------------------------------------------------------------------------------ журнал заданий
    build_quests() {
        const p = this.panel(Lang.t('q.title'), true);
        p.style.width = 'min(720px,96vw)';
        const t = (pair) => Quests.txt(pair);
        const cur = Quests.current();
        const head = this.el('div', 'row'); head.style.marginBottom = '8px';
        head.appendChild(this.btn(Lang.t(Quests.track ? 'q.trackBtnOn' : 'q.trackBtnOff'), 'blue sm', () => { Quests.toggleTrack(); this.open('quests'); }));
        if (cur && cur.tip) head.appendChild(this.btn(Lang.t('q.showTip'), 'gray sm', () => { this.close(); Quests.showTip(t(cur.t), t(cur.tip), 16); }));
        p.appendChild(head);
        const list = this.el('div', 'qList');
        Quests.chapters.forEach((c, ci) => {
            const steps = Quests.steps.slice(c.from, c.to);
            const doneN = Math.max(0, Math.min(steps.length, Quests.i - c.from));
            list.appendChild(this.el('div', 'qCh rb1', t(c.name) + ' — ' + doneN + '/' + steps.length));
            steps.forEach((s, si) => {
                const idx = c.from + si, done = idx < Quests.i, isCur = idx === Quests.i;
                const row = this.el('div', 'qStep' + (done ? ' done' : '') + (isCur ? ' cur' : ''));
                row.appendChild(this.el('div', 'mk', done ? '✔' : isCur ? '▶' : ''));
                const tx = this.el('div'); tx.appendChild(this.el('div', 'rb1', t(s.t)));
                if (isCur || done) tx.appendChild(this.el('div', 'dd', t(s.d)));
                if (isCur && s.reward) tx.appendChild(this.el('div', 'dd', Lang.t('q.reward') + ': ' + (s.reward.coins ? '🪙 ' + s.reward.coins : '') + (s.reward.items ? ' ' + s.reward.items.map(([id, n]) => Lang.t('item.' + id) + ' ×' + n).join(', ') : '')));
                row.appendChild(tx);
                list.appendChild(row);
            });
        });
        p.appendChild(list);
        return p;
    },

    // ------------------------------------------------------------------------------ торговец
    TRADE_BUY: [['bandage', 1, 12], ['medkit', 1, 40], ['carrot', 3, 10], ['berry', 4, 8], ['arrow', 8, 10], ['ammo_rev', 12, 30], ['ammo_rifle', 10, 34], ['shell', 8, 30], ['torch', 1, 10], ['grenade', 2, 70], ['grenade_flash', 2, 45], ['herb', 2, 12], ['cola', 1, 14], ['pie', 1, 24], ['lantern', 1, 60], ['fishing_rod', 1, 30], ['beartrap', 1, 22], ['spikes', 1, 18]],
    TRADE_SELL: { pelt: 10, bunny_foot: 8, steak_raw: 4, fish_raw: 3, mushroom_food: 2, gem: 25, diamond: 45, engine: 20, radio: 14, bolt: 2, sheet: 3, fan: 6, tire: 5, key_red: 0 },
    build_trade(d) {
        const p = this.panel(Lang.t('trade.title'), true);
        p.style.width = 'min(760px,96vw)';
        const tab = (d && d.tab) || this._tradeTab || 'buy'; this._tradeTab = tab;
        const head = this.el('div', 'row'); head.style.marginBottom = '8px';
        head.appendChild(this.el('div', 'coinPill', '<span class="ci">$</span><span class="rb1">' + Econ.coins + '</span>'));
        head.appendChild(this.btn(Lang.t('trade.buy'), tab === 'buy' ? '' : 'gray sm', () => this.open('trade', { tab: 'buy' })));
        head.appendChild(this.btn(Lang.t('trade.sell'), tab === 'sell' ? '' : 'gray sm', () => this.open('trade', { tab: 'sell' })));
        p.appendChild(head);
        const grid = this.el('div', 'grid'); grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(min(300px,100%),1fr))';
        if (tab === 'buy') {
            const rnd = U.rng(Sky.day * 97 + 13); const pool = this.TRADE_BUY.slice(); const stock = [];
            while (stock.length < 8 && pool.length) stock.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
            for (const [id, n, price] of stock) {
                const card = this.el('div', 'card'); card.innerHTML = UI.icon(id);
                const mid = this.el('div'); mid.style.flex = '1';
                mid.appendChild(this.el('div', 'nm rb2', Lang.t('item.' + id) + (n > 1 ? ' ×' + n : '')));
                const dk = 'itemd.' + id, dt = Lang.t(dk);
                mid.appendChild(this.el('div', 'ds', dt === dk ? '' : dt));
                card.appendChild(mid);
                const can = Econ.coins >= price;
                card.appendChild(this.btn('🪙 ' + price, 'sm' + (can ? '' : ' gray'), () => {
                    if (!Econ.spend(price)) { UI.toast(Lang.t('shop.noCoins'), 'warn'); return; }
                    const left = Inv.add(id, n); if (left > 0) Items.spawn(id, left, Player.x + 60, Player.z + 40, { y: Player.y + 130 });
                    Sfx.ui('coin'); UI.toast(Lang.t('trade.done', { n: Lang.t('item.' + id) }), 'good'); Quests.event('trade', 1); this.open('trade', { tab });
                }));
                grid.appendChild(card);
            }
        } else {
            let any = false;
            for (const s of Inv.slots) {
                if (!s || !this.TRADE_SELL[s.id]) continue;
                any = true;
                const price = this.TRADE_SELL[s.id];
                const card = this.el('div', 'card'); card.innerHTML = UI.icon(s.id);
                const mid = this.el('div'); mid.style.flex = '1';
                mid.appendChild(this.el('div', 'nm rb2', Lang.t('item.' + s.id) + ' ×' + s.n));
                mid.appendChild(this.el('div', 'ds', '🪙 ' + price + ' / шт'));
                card.appendChild(mid);
                card.appendChild(this.btn('🪙 ' + price * s.n, 'sm', () => { const n = Inv.count(s.id); Inv.take(s.id, n); Econ.addCoins(price * n, 'sell'); Sfx.ui('coin'); Quests.event('trade', 1); if (!Inv.current()) Player.equipCurrent(); this.open('trade', { tab }); }));
                grid.appendChild(card);
            }
            if (!any) grid.appendChild(this.el('div', 'hint rb1', Lang.t('trade.none')));
        }
        p.appendChild(grid);
        return p;
    },

    // ------------------------------------------------------------------------------ смерть
    build_death(d) {
        const p = this.panel(null, false);
        p.style.width = 'min(560px,94vw)';
        p.appendChild(this.el('div', 'big rb', Lang.t('death.title')));
        p.appendChild(this.el('div', 'sub rb1', Lang.t('death.' + (d.kind || 'x'))));
        const hearts = this.el('div', 'hearts4');
        for (let i = 0; i < DATA.lives.max; i++) { const h = this.el('div', i < d.hearts ? '' : (i === d.hearts ? 'lost brk' : 'lost'), UI.svg.heart); hearts.appendChild(h); }
        p.appendChild(hearts);
        p.appendChild(this.el('div', 'hint rb1', Lang.t('death.hearts', { n: d.hearts, m: DATA.lives.max })));
        const c = this.el('div', 'col deathCol'); c.style.marginTop = '8px'; c.style.gap = '10px';
        // CrazyGames: предложение не на каждой смерти и не вместе с midgame; кнопка отказа — того же цвета и размера
        const offer = d.reviveOffer != null ? d.reviveOffer : (d.reviveOffer = Platform.reviveOffer());
        if (offer) {
            const rv = this.btn('🎬 ' + Lang.t('death.reviveAd'), 'blue', async () => { const ok = await Game.reviveHere(); if (!ok && !Platform.adsAvailable() && Game.state === 'dead') { d.reviveOffer = false; this.open('death', d); } });
            rv.dataset.rewardedOffer = '1';
            c.appendChild(rv);
            c.appendChild(this.el('div', 'hint', Lang.t('death.reviveAdSub')));
        }
        // естественная пауза после смерти: на Playgama — interstitial перед возрождением в лагере или выходом в меню
        c.appendChild(this.btn('🏕️ ' + Lang.t('death.respawn'), offer && String(GAME_PLATFORM) === 'crazygames' ? 'blue' : '', () => Platform.ads.pause(() => Game.respawnBase(), 'respawn')));
        c.appendChild(this.el('div', 'hint', Lang.t('death.respawnSub')));
        c.appendChild(this.btn(Lang.t('pause.menu'), 'gray sm', () => Platform.ads.pause(() => { if (Game.state !== 'dead') return; UIPanels.close(true); Player.dead = false; Game.enterMenu(); }, 'menu')));
        p.appendChild(c);
        return p;
    },
    build_gameover(d) {
        const p = this.panel(null, false);
        p.style.width = 'min(560px,94vw)';
        const hcAd = Game.canHcRevive() && Platform.adsAvailable();   // хардкор: возрождение за рекламу — одно на забег
        p.appendChild(this.el('div', 'big rb', Lang.t(hcAd ? 'death.title' : 'over.title')));
        p.appendChild(this.el('div', 'sub rb1', Lang.t(hcAd ? 'death.hcChoice' : Game.hardcore && Game.hcRevived ? 'death.hcUsed' : 'over.sub')));
        const hearts = this.el('div', 'hearts4');
        for (let i = 0; i < (Game.hardcore ? 1 : DATA.lives.max); i++) hearts.appendChild(this.el('div', 'lost', UI.svg.heart));
        p.appendChild(hearts);
        const s = this.el('div', 'stat');
        s.innerHTML = '<div><b>' + Math.max(0, d.day - 1) + '</b>' + Lang.t('st.nights') + '</div><div><b>' + (d.stats.kills || 0) + '</b>' + Lang.t('st.kills') + '</div><div><b>' + Zones.rescuedCount() + '/4</b>' + Lang.t('st.kids') + '</div><div><b>' + Econ.coins + '</b>' + Lang.t('st.coins') + '</div>';
        p.appendChild(s);
        p.appendChild(this.el('div', 'hint rb1', Lang.t('over.keep')));
        if (hcAd) {
            const ad = this.btn('🎬 ' + Lang.t('death.hcReviveAd'), 'blue', async () => {
                ad.disabled = true;
                try { await Game.reviveHere(); } finally { ad.disabled = false; }
                if (!Platform.adsAvailable() && Game.state === 'dead') this.open('gameover', d);
            });
            ad.dataset.rewardedOffer = '1';
            p.appendChild(ad);
            p.appendChild(this.el('div', 'hint', Lang.t('death.hcReviveSub')));
        }
        const r = this.el('div', 'row');
        r.appendChild(this.btn(Lang.t('over.again'), hcAd && String(GAME_PLATFORM) === 'crazygames' ? 'blue' : '', () => Game.retry()));
        r.appendChild(this.btn(Lang.t('pause.menu'), 'gray', () => Game.nextResult(() => { UIPanels.close(true); Player.dead = false; Game.enterMenu(); })));
        p.appendChild(r);
        return p;
    },

    // ------------------------------------------------------------------------------ выбор режима: один или с ботами
    build_newgame() {
        const p = this.panel(Lang.t('mode.title'), true);
        p.style.width = 'min(860px,96vw)';
        p.querySelector('.close').onclick = () => { Sfx.ui('cancel'); this.open('title'); };
        p.appendChild(this.el('div', 'hint rb1', Lang.t('mode.hint')));
        const row = this.el('div', 'modeRow');
        const modes = [[0, '🧍', 'mode.solo', 'mode.soloD'], [1, '🧍🤖', 'mode.b1', 'mode.b1D'], [2, '🤖🧍🤖', 'mode.b2', 'mode.b2D'], [3, '🤖🤖🧍🤖', 'mode.b3', 'mode.b3D']];
        for (const [n, ic, t, dsc] of modes) {
            const m = this.el('div', 'mode');
            m.appendChild(this.el('div', 'ic', ic)); m.appendChild(this.el('h3', 'rb2', Lang.t(t))); m.appendChild(this.el('p', '', Lang.t(dsc)));
            m.onclick = () => { Sfx.ui('click'); Game.startGame(true, { bots: n }); };
            row.appendChild(m);
        }
        p.appendChild(row);
        return p;
    },
};
Object.assign(UIPanels, PANELS2);

// Окна закрываются: скин возвращается к надетому; камера из орбиты в игре — за спину
(function () {
    const close = UIPanels.close;
    UIPanels.close = function (silent) {
        if (this._drag && this._drag.cancel) this._drag.cancel();
        const was = this.cur;
        close.call(this, silent);
        if (was === 'shop' && !silent) { Player.applySkin(Econ.skin); this._shopSel = null; if (Game.state === 'play' || Game.state === 'pause') { if (Game.state === 'play') { Cam.mode = 'follow'; Cam._cd = null; } } }
    };
})();

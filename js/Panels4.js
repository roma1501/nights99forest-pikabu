// Panels4.js — журнал записок (общее окно чтения и списка), новое меню паузы, переключатель туториала (пауза, настройки, журнал заданий),
// кнопка 📜 в верхней панели с красным числом новых записок. Дополняет UIPanels и Hud3; загружается после Panels3.js и MapView.js.

(function () {
    const s = document.createElement('style');
    s.textContent = `
.jrnP{width:min(940px,96vw);max-height:94vh;overflow:auto;padding:16px 18px 18px}
.jBody{display:flex;gap:14px;align-items:stretch;min-height:min(430px,64vh)}
.jList{flex:0 0 min(300px,38%);max-height:min(560px,66vh);overflow:auto;padding:4px 10px 4px 4px;display:flex;flex-direction:column;gap:7px;overscroll-behavior:contain}
.jItem{position:relative;display:flex;flex-shrink:0;min-height:56px;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;background:linear-gradient(#34364a,#23242f);border:3px solid #000;cursor:pointer;transition:transform .14s,box-shadow .2s,background .2s}
.jItem:hover{transform:translateX(4px);box-shadow:0 0 0 2px rgba(255,255,255,.15)}
.jItem .ji{flex:0 0 34px;height:34px;border-radius:10px;background:rgba(255,255,255,.08);border:2px solid #000;display:flex;align-items:center;justify-content:center;font-size:19px}
.jItem .jt{flex:1;min-width:0;font-size:16px;line-height:1.1}
.jItem .js{font-size:12px;font-weight:600;opacity:.75;-webkit-text-stroke:0;color:#dfe6ff}
.jItem.lock{opacity:.6}
.jItem.sel{background:linear-gradient(#5a4a2a,#3a2f1a);box-shadow:0 0 0 3px #ffd24a,0 0 16px rgba(255,210,74,.45);transform:translateX(6px)}
.jItem .jn{position:absolute;right:8px;top:6px;padding:0 7px;border-radius:9px;background:#ff3b3b;border:2px solid #fff;font-size:11px;-webkit-text-stroke:0;animation:jnPulse 1.1s infinite}
@keyframes jnPulse{50%{transform:scale(1.15)}}
.jPaper{position:relative;flex:1;min-width:0;padding:22px 24px 16px;border-radius:10px;background:repeating-linear-gradient(#f3e8c8 0,#f3e8c8 31px,#e3d4a8 32px),#f3e8c8;color:#3a2a18;border:4px solid #000;box-shadow:inset 0 0 40px rgba(120,80,20,.28),0 10px 22px rgba(0,0,0,.45);transform-origin:50% 0;display:flex;flex-direction:column}
.jPaper.turn{animation:pageTurn .42s cubic-bezier(.2,1.2,.4,1)}
@keyframes pageTurn{0%{opacity:0;transform:perspective(900px) rotateX(-14deg) translateY(-16px) scale(.97)}100%{opacity:1;transform:none}}
.jPaper .seal{position:absolute;right:16px;top:12px;font-size:34px;filter:drop-shadow(0 3px 0 rgba(0,0,0,.3));transform:rotate(12deg)}
.jPaper h3{margin:0 56px 10px 0;font-family:'Rubik',sans-serif;font-weight:800;font-size:clamp(24px,4vh,34px);color:#5a3a14;-webkit-text-stroke:0;text-shadow:0 2px 0 rgba(255,255,255,.5)}
.jPaper .jtext{flex:1;font-size:clamp(17px,2.6vh,22px);line-height:32px;font-weight:600;-webkit-text-stroke:0;color:#3a2a18;white-space:pre-wrap;overflow:auto}
.jPaper .jfoot{margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:14px;-webkit-text-stroke:0;color:#6a4a24;border-top:2px dashed rgba(90,60,20,.4);padding-top:8px}
.jPaper .jfoot .sp{flex:1}
.jPaper .lockBig{margin:auto;text-align:center;font-size:20px;color:#6a4a24;-webkit-text-stroke:0}
.jPaper .lockBig b{display:block;font-size:64px;line-height:1.2;filter:grayscale(.4)}
.jPaper.empty .jtext{display:flex;align-items:center;justify-content:center;text-align:center;color:#8a6a40}
.pauseP{width:min(580px,94vw);padding-bottom:20px}
.pauseChips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:-4px 0 14px}
.pauseChips span{padding:3px 12px;border-radius:14px;background:rgba(0,0,0,.35);border:3px solid #000;font-size:16px;-webkit-text-stroke:0;color:#fff}
#ui .panel>.col.pauseCol,.pauseCol{width:min(500px,100%);margin:0 auto}
.pauseGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pauseGrid .btn{font-size:19px;padding:8px 10px;min-width:0;text-align:center;line-height:1.05}
.pauseCol>.btn{width:100%}
.tutOn{box-shadow:0 5px 0 #0c5a22,0 0 14px rgba(80,255,120,.35) !important}
.mode.on{border-color:#ffe066;box-shadow:0 0 0 2px #ffe066;background:linear-gradient(#485843,#273b2b)}
.modeP .modeRow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.modeP .mode{width:auto;min-width:0;padding:10px 5px}.modeP .mode .ic{font-size:30px;white-space:nowrap}.modeP .mode .ic img.glyphArt{width:1em;height:1em;margin:0;object-fit:contain}.modeP .mode h3{font-size:21px}
.botDelivery{margin:12px 0 6px;padding:9px 10px;border:2px solid rgba(255,224,102,.35);border-radius:12px;background:rgba(0,0,0,.2)}
.botDelivery .kv{gap:10px}.botDelivery .kv>span{flex:1;min-width:0}.botDelivery .hint{font-size:13px;line-height:1.3;text-align:left;margin:4px 0 0}
.chestP{width:min(760px,96vw);max-height:94vh;overflow:auto}.chestP h2{margin-right:40px}
.chestStatus{padding:8px;border-radius:9px;background:rgba(0,0,0,.3);font-size:15px;line-height:1.3;text-align:center}
.chestList{display:flex;flex-direction:column;gap:8px;margin:10px 0}.chestItem{display:flex;align-items:center;gap:10px;padding:8px;border:2px solid #111;border-radius:12px;background:rgba(0,0,0,.22)}
.chestItem>img{width:44px;height:44px;object-fit:contain;flex-shrink:0}.chestItem>.chestName{flex:1;min-width:0;font-size:17px}.chestItem .row{margin:0;gap:6px;flex-shrink:0}.chestItem .btn{font-size:14px;min-height:36px;padding:4px 8px}
.chestDeposit{padding-top:10px;border-top:2px solid rgba(255,255,255,.15)}.chestDeposit>.hint{text-align:left;margin:0 0 4px}
@media(max-width:480px){.chestItem{flex-wrap:wrap}.chestItem .row{width:100%}.chestItem .row>.btn{flex:1}.chestP{padding:12px 10px}.chestP h2{font-size:26px}.botDelivery .kv{font-size:16px}}
@media(max-width:600px){.modeP .modeRow{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.modeP .mode .ic{font-size:26px}.modeP .mode h3{font-size:19px}.modeP .mode p{font-size:12px}.modeP .hcSw{font-size:16px;padding:7px 8px}.modeP .hcSw small{font-size:12px}}
@media (max-width:480px){.pauseGrid{grid-template-columns:1fr}.jBody{flex-direction:column}.jList{flex:0 0 auto;max-height:26vh;flex-direction:row;flex-wrap:wrap}.jItem{flex:1 1 44%}}
@media (max-height:520px){.pauseCol{gap:8px}.pauseChips{margin-bottom:8px}.pauseP .btn{min-height:40px}.jBody{min-height:0}}
`;
    document.head.appendChild(s);
})();

/** @type {Record<string, any>} */
const PANELS4 = {
    botDeliveryControl() {
        Bots.loadDeliverySetting();
        const box = this.el('div', 'botDelivery'), row = this.el('div', 'kv');
        row.appendChild(this.el('span', '', Lang.t('bot.delivery')));
        const enabled = () => !!Bots.deliverToPlayer;
        const b = this.btn(Lang.t(enabled() ? 'tut.sOn' : 'tut.sOff'), enabled() ? 'blue sm' : 'gray sm', () => {
            Bots.setDeliveryToPlayer(!enabled());
            b.textContent = Lang.t(enabled() ? 'tut.sOn' : 'tut.sOff'); b.className = 'btn ' + (enabled() ? 'blue sm' : 'gray sm');
            b.setAttribute('aria-checked', String(enabled())); Sfx.ui(enabled() ? 'toggle' : 'toggleoff');
        });
        b.dataset.padKey = 'bot-delivery'; b.setAttribute('role', 'switch'); b.setAttribute('aria-label', Lang.t('bot.delivery')); b.setAttribute('aria-checked', String(enabled()));
        row.appendChild(b); box.appendChild(row); box.appendChild(this.el('div', 'hint', Lang.t('bot.deliveryHint')));
        return box;
    },
    _campChestStamp() { return JSON.stringify([Camp.storage, Inv.current(), Inv.slots.filter(Boolean).length, Inv.cap]); },
    build_campchest(d) {
        const p = this.panel('📦 ' + Lang.t('chest.title'), true); p.classList.add('chestP');
        p.appendChild(this.el('div', 'hint', Lang.t('chest.hint')));
        p.appendChild(this.el('div', 'hint rb1', Lang.t('chest.bag', { a: Inv.slots.filter(Boolean).length, b: Inv.cap })));
        if (d.message) { const status = this.el('div', 'chestStatus', d.message); status.setAttribute('role', 'status'); p.appendChild(status); }
        const refresh = (moved, requested, deposit) => {
            const key = moved === 0 ? (!Camp.storageReach() ? 'camp.storageFar' : deposit ? 'chest.depositNone' : 'chest.bagFull') : moved < requested ? 'chest.partial' : deposit ? 'chest.deposited' : 'chest.taken';
            this.open('campchest', { message: Lang.t(key, { n: moved, total: requested }) });
            if (!moved) Sfx.ui('deny');
        };
        const list = this.el('div', 'chestList');
        for (const item of Camp.storage || []) {
            const row = this.el('div', 'chestItem', UI.icon(item.id));
            row.appendChild(this.el('div', 'chestName rb1', UI.name(item.id) + (item.lv ? ' +' + item.lv : '') + ' ×' + item.n));
            const actions = this.el('div', 'row');
            for (const all of [false, true]) {
                const b = this.btn(Lang.t(all ? 'chest.takeStack' : 'chest.takeOne'), all ? 'blue sm' : 'gray sm', () => {
                    const i = Camp.storage.findIndex(s => s.id === item.id && (s.lv || 0) === (item.lv || 0) && (s.mag || 0) === (item.mag || 0));
                    const current = Camp.storage[i];
                    const count = current ? (all ? current.n : 1) : 0;
                    refresh(count ? Camp.takeStored(i, count) : 0, count, false);
                });
                b.dataset.padKey = 'chest-take-' + item.id + '-' + (item.lv || 0) + '-' + (item.mag || 0) + '-' + all; actions.appendChild(b);
            }
            row.appendChild(actions); list.appendChild(row);
        }
        if (!list.children.length) list.appendChild(this.el('div', 'hint', Lang.t('chest.empty')));
        p.appendChild(list);
        const dep = this.el('div', 'chestDeposit'); dep.appendChild(this.el('div', 'hint rb1', Lang.t('chest.selected')));
        const held = Inv.current();
        if (held) {
            const row = this.el('div', 'chestItem', UI.icon(held.id));
            row.appendChild(this.el('div', 'chestName rb1', UI.name(held.id) + (held.lv ? ' +' + held.lv : '') + ' ×' + held.n));
            const actions = this.el('div', 'row');
            for (const all of [false, true]) {
                const b = this.btn(Lang.t(all ? 'chest.putStack' : 'chest.putOne'), all ? 'blue sm' : 'gray sm', () => { const current = Inv.current(), count = current ? (all ? current.n : 1) : 0; refresh(count ? Camp.depositSelected(count) : 0, count, true); });
                b.dataset.padKey = 'chest-put-' + all; actions.appendChild(b);
            }
            row.appendChild(actions); dep.appendChild(row);
        } else dep.appendChild(this.el('div', 'hint', Lang.t('chest.noSelected')));
        p.appendChild(dep); this._chestStamp = this._campChestStamp(); this._chestUpdateT = 0.5;
        return p;
    },
    updateCampChest(dt) {
        if (this.cur !== 'campchest' || (this._chestUpdateT -= dt) > 0) return;
        this._chestUpdateT = 0.5;
        if (this._campChestStamp() === this._chestStamp) return;
        const old = this.overlay.querySelector('.chestP'), scroll = old ? old.scrollTop : 0;
        this.open('campchest'); this.overlay.querySelector('.chestP').scrollTop = scroll;
    },
    // ---- журнал записок: список слева, бумага справа
    build_journal(d) {
        const L = Lang.code === 'en' ? 1 : 0;
        const p = this.panel('📜 ' + Lang.t('lore.title') + '  ' + Lore.countAll() + '/' + Lore.NOTES.length, true);
        p.classList.add('jrnP');
        const from = (d && d.from) || null;
        p.querySelector('.close').onclick = () => { Sfx.ui('cancel'); if (from === 'rewards') this.open('rewards', { tab: 'notes' }); else if (from === 'pause') this.open('pause'); else this.close(); };
        const firstFound = Lore.NOTES.find(n => Lore.seen[n.id]);
        let sel = (d && d.id) || this._jSel || (firstFound ? firstFound.id : null);
        if (sel && !Lore.noteById(sel)) sel = null;
        const body = this.el('div', 'jBody');
        const list = this.el('div', 'jList'), paper = this.el('div', 'jPaper');
        body.appendChild(list); body.appendChild(paper);
        p.appendChild(body);
        const paint = (anim) => {
            paper.className = 'jPaper' + (anim ? ' turn' : '');
            paper.innerHTML = '';
            const n = sel ? Lore.noteById(sel) : null;
            if (!n) { paper.classList.add('empty'); paper.appendChild(this.el('div', 'jtext', Lang.t(Lore.countAll() ? 'lore.pick' : 'lore.none'))); return; }
            const found = !!Lore.seen[n.id];
            if (!found) {
                const lb = this.el('div', 'lockBig', '<b>🔒</b>' + Lang.t('lore.locked') + '<br><small>' + Lang.t('rw.noteHint', { s: Lang.t('site.' + n.site) }) + '</small>');
                paper.appendChild(lb); return;
            }
            paper.appendChild(this.el('div', 'seal', Icons.glyph('📜')));
            paper.appendChild(this.el('h3', '', n.name[L]));
            paper.appendChild(this.el('div', 'jtext', n[L ? 'en' : 'ru']));
            const foot = this.el('div', 'jfoot');
            foot.appendChild(this.el('span', '', '📍 ' + Lang.t('site.' + n.site) + ' · ' + Lang.t(Lore.runFound.has(n.id) ? 'lore.foundNow' : 'lore.foundOld')));
            foot.appendChild(this.el('span', 'sp'));
            const foundIds = Lore.NOTES.filter(x => Lore.seen[x.id]).map(x => x.id), at = foundIds.indexOf(n.id);
            if (foundIds.length > 1) {
                foot.appendChild(this.btn('◀ ' + Lang.t('lore.prev'), 'gray sm', () => { sel = foundIds[(at - 1 + foundIds.length) % foundIds.length]; pick(sel, true); }));
                foot.appendChild(this.btn(Lang.t('lore.next') + ' ▶', 'sm', () => { sel = foundIds[(at + 1) % foundIds.length]; pick(sel, true); }));
            }
            paper.appendChild(foot);
        };
        const mark = () => { if (sel) { Lore.markViewed(sel); } };
        const fill = () => {
            list.innerHTML = '';
            for (const n of Lore.NOTES) {
                const found = !!Lore.seen[n.id], isNew = found && !Lore.viewed[n.id];
                const it = this.el('div', 'jItem' + (found ? '' : ' lock') + (n.id === sel ? ' sel' : ''));
                it.dataset.padKey = 'note:' + n.id;
                it.appendChild(this.el('div', 'ji', found ? Icons.glyph('📜') : '🔒'));
                const mid = this.el('div', 'jt');
                mid.appendChild(this.el('div', 'rb1', found ? n.name[L] : '???'));
                mid.appendChild(this.el('div', 'js', found ? Lang.t('site.' + n.site) : Lang.t('rw.noteHint', { s: Lang.t('site.' + n.site) })));
                it.appendChild(mid);
                if (isNew) it.appendChild(this.el('div', 'jn', 'NEW'));
                it.onclick = () => { Sfx.ui('page'); sel = n.id; pick(n.id, true); };
                list.appendChild(it);
            }
        };
        const reveal = () => {
            const cur = list.querySelector('.jItem.sel');
            if (!cur || !list.isConnected) return;
            const r = cur.getBoundingClientRect(), bounds = list.getBoundingClientRect();
            if (r.top < bounds.top + 6) list.scrollTop += r.top - bounds.top - 6;
            else if (r.bottom > bounds.bottom - 6) list.scrollTop += r.bottom - bounds.bottom + 6;
        };
        const pick = (id, anim) => {
            const focus = typeof PadNav !== 'undefined' && p.contains(PadNav.cur) ? PadNav.key(PadNav.cur) : null;
            this._jSel = id; sel = id; mark(); fill(); paint(anim);
            if (focus) {
                const next = Array.from(p.querySelectorAll('[data-pad-key]')).find(e => PadNav.key(e) === focus);
                if (next) PadNav.focus(next, false);
            }
            if (list.isConnected) reveal(); else requestAnimationFrame(reveal);
        };
        pick(sel, false);
        return p;
    },
    // старое окно одной записки теперь — тот же журнал, открытый на нужной записке
    build_note(d) { return this.build_journal({ id: d && d.id, from: d && d.from }); },

    // ---- пауза: сводка и кнопки сеткой, по центру
    build_pause() {
        const p = this.panel(Lang.t('pause.title'), false);
        p.classList.add('pauseP');
        const chips = this.el('div', 'pauseChips');
        const night = Sky.isNight && Sky.isNight();
        const chip = (text) => { const s = this.el('span', ''); Icons.btnLabel(s, text); chips.appendChild(s); };
        chip((night ? '🌙 ' : '☀️ ') + Lang.t('pause.day', { n: Sky.day }));
        chip('🔥 ' + Lang.t('pause.fire', { n: Camp.level }));
        chip('🧒 ' + Lang.t('pause.kids', { a: Zones.rescuedCount(), b: 4 }));
        chip('❤️ ' + Econ.hearts + '/' + (Game.hardcore ? 1 : DATA.lives.max));
        if (Game.hardcore) chip('💀 ' + Lang.t('hc.tag'));
        if (Player.armor) chip('🛡️ ' + Lang.t('armor.status', { n: Math.round(Player.armor() * 100) }));
        p.appendChild(chips);
        const c = this.el('div', 'col pauseCol');
        c.appendChild(this.btn(Lang.t('pause.resume'), '', () => Platform.ads.gate(() => Game.resume(), 'resume')));
        const g = this.el('div', 'pauseGrid');
        g.appendChild(this.btn('💾 ' + Lang.t('save.btn'), 'blue', () => { if (Save.flush('manual', true)) UI.toast(Lang.t('save.saved'), 'good'); else UI.toast(Lang.t('save.writeFail'), 'warn'); }));
        const rw = this.btn('🎁 ' + Lang.t('rw.title'), 'blue', () => this.open('rewards', { from: 'pause' }));
        if (window.Ach && Ach.hasClaimable()) rw.insertAdjacentHTML('beforeend', '<span class="rdot"></span>');
        g.appendChild(rw);
        const nt = this.btn('📜 ' + Lang.t('pause.notes', { a: Lore.countAll(), b: Lore.NOTES.length }), 'blue', () => this.open('journal', { from: 'pause' }));
        if (Lore.unread() > 0) nt.insertAdjacentHTML('beforeend', '<span class="rdot"></span>');
        g.appendChild(nt);
        const tl = () => Lang.t(Quests.enabled ? 'tut.on' : 'tut.off');
        const tut = this.btn('📖 ' + tl(), Quests.enabled ? 'blue tutOn' : 'gray', () => {
            Quests.setEnabled(!Quests.enabled);
            Icons.btnLabel(tut, '📖 ' + tl()); tut.className = 'btn ' + (Quests.enabled ? 'blue tutOn' : 'gray');
            UI.toast(Lang.t(Quests.enabled ? 'tut.nowOn' : 'tut.nowOff'), Quests.enabled ? 'good' : 'info'); Sfx.ui(Quests.enabled ? 'toggle' : 'toggleoff');
        });
        g.appendChild(tut);
        g.appendChild(this.btn(Lang.t('menu.help'), 'blue', () => this.open('help', { from: 'pause' })));
        g.appendChild(this.btn('⚙️ ' + Lang.t('menu.settings'), 'gray', () => this.open('settings', { from: 'pause' })));
        c.appendChild(g);
        if (Bots.list.length > 0 || Game.newgameBots > 0) c.appendChild(this.botDeliveryControl());
        c.appendChild(this.btn(Lang.t('pause.menu'), 'red', () => Platform.ads.pause(() => Game.toMenu(), 'menu')));
        p.appendChild(c);
        return p;
    },
};
Object.assign(UIPanels, PANELS4);

(function () {
    const P = UIPanels;
    const wrap = (name, fn) => { const orig = P[name]; P[name] = function (d, o) { const r = orig.call(this, d, o); try { fn.call(this, r, d); } catch (e) { console.warn('Panels4 wrap ' + name, e); } return r; }; };

    // настройки: переключатель туториала
    wrap('build_settings', /** @this {any} */ function (p) {
        if (Bots.list.length > 0 || Game.newgameBots > 0) p.appendChild(this.botDeliveryControl());
        const r = this.el('div', 'kv'); r.appendChild(this.el('span', '', Lang.t('set.tutorial')));
        const tl = () => Lang.t(Quests.enabled ? 'tut.sOn' : 'tut.sOff');
        const b = this.btn(tl(), Quests.enabled ? 'blue sm' : 'gray sm', () => { Quests.setEnabled(!Quests.enabled); b.textContent = tl(); b.className = 'btn ' + (Quests.enabled ? 'blue sm' : 'gray sm'); if (!Quests.enabled) preview.style.display = 'none'; Sfx.ui(Quests.enabled ? 'toggle' : 'toggleoff'); });
        r.appendChild(b);
        const note = p.querySelector('.setNote');
        p.insertBefore(r, note || null);
        const preview = this.el('div', 'hint rb1'); preview.id = 'replayTipPreview'; preview.style.display = 'none';
        const tips = this.btn('📖 ' + Lang.t('tut.replay'), 'blue sm', () => {
            const tip = Quests.replayTips();
            b.textContent = tl(); b.className = 'btn blue sm';
            preview.replaceChildren();
            const title = this.el('strong'); title.textContent = Lang.t('tut.nowOn') + ' · ' + tip.title;
            const body = this.el('div'); body.textContent = tip.text;
            preview.append(title, body); preview.style.display = 'block';
        });
        tips.style.marginTop = '8px'; p.insertBefore(tips, note || null);
        p.insertBefore(preview, note || null);
    });

    // журнал заданий: кнопка включения/выключения туториала; при выключенном — пояснение
    wrap('build_quests', /** @this {any} */ function (p) {
        const row = this.el('div', 'row'); row.style.margin = '0 0 8px';
        if (!Quests.enabled) row.appendChild(this.el('div', 'hint rb1', Lang.t('tut.disabledNote')));
        const b = this.btn('📖 ' + Lang.t(Quests.enabled ? 'tut.btnOff' : 'tut.btnOn'), Quests.enabled ? 'gray sm' : 'sm', () => { Quests.setEnabled(!Quests.enabled); this.open('quests'); });
        row.appendChild(b);
        const list = p.querySelector('.qList'); p.insertBefore(row, list || null);
    });

    // геймпад видит элементы журнала
    if (typeof PadNav !== 'undefined') PadNav.SEL += ', .jItem';

    // кнопка 📜 в верхней панели с числом новых записок
    if (typeof Hud3 !== 'undefined') {
        const init0 = Hud3.init, update0 = Hud3.update;
        Hud3.init = function () {
            init0.call(this);
            const tb = document.getElementById('topBtns');
            if (tb) {
                const b = document.createElement('div'); b.className = 'rbtn'; b.id = 'btnNotes'; b.title = 'N';
                b.innerHTML = Icons.glyph('📜') + '<div id="noteDot"></div>';
                b.onclick = () => UI.open('journal');
                tb.appendChild(b); this.notes = b; this.noteDot = b.querySelector('#noteDot');
            }
        };
        Hud3.update = function (dt) {
            update0.call(this, dt);
            UIPanels.updateCampChest(dt);
            if (this.noteDot) { this._tn = (this._tn === undefined ? 0 : this._tn) - dt; if (this._tn <= 0) { this._tn = 0.4; const n = Lore.unread(); this.noteDot.style.display = n ? 'flex' : 'none'; this.noteDot.textContent = String(n); } }
        };
    }
})();

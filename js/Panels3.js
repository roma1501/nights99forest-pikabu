// Panels3.js — окна и HUD третьего слоя: «Награды» (ежедневная награда, задания дня, достижения, записки), «Управление» (переназначение
// клавиш), расширенные настройки (громкость окружения, колесо мыши), справка по текущим клавишам, режим хардкор при старте, улучшение
// оружия у верстака, карточка задания с прогрессом и целью, полоса здоровья босса, кнопка наград с красной точкой, навигация по окнам
// геймпадом (PadNav). Дополняет UIPanels; загружается после Panels2.js.

(function () {
    const s = document.createElement('style');
    s.textContent = `
.rwP{width:min(860px,96vw);max-height:94vh;overflow:auto}
.rwHead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 46px 8px 0}
.dayRow{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;margin:8px 0}
.dayC{position:relative;padding:8px 4px 6px;border-radius:12px;background:linear-gradient(#34364a,#23242f);border:3px solid #000;text-align:center}
.dayC .dn{font-size:13px;opacity:.85}
.dayC .dc{font-size:19px;margin:2px 0}
.dayC .dh{font-size:18px;line-height:1}
.dayC.done{background:linear-gradient(#2c6a3c,#1d4a2a)}
.dayC.today{outline:4px solid #ffe061;outline-offset:1px;animation:pulseO 1.2s infinite}
@keyframes pulseO{50%{outline-color:#fff}}
.dayC .ck{position:absolute;right:3px;top:0;font-size:16px}
.rwCard{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;background:linear-gradient(#34364a,#23242f);border:3px solid #000;margin-bottom:8px}
.rwCard .ic{flex:0 0 46px;height:46px;border-radius:12px;background:rgba(255,255,255,.08);border:3px solid #000;display:flex;align-items:center;justify-content:center;font-size:26px}
.rwCard .mid{flex:1;min-width:0}
.rwCard .nm{font-size:18px;line-height:1.05}
.rwCard .ds{font-size:13px;font-weight:600;opacity:.88;-webkit-text-stroke:0;color:#dfe6ff}
.rwCard.done{background:linear-gradient(#2c6a3c,#1d4a2a)}
.rwCard.lock{opacity:.7}
.pbar{height:10px;border-radius:6px;background:#000;overflow:hidden;margin-top:4px;border:2px solid #000}
.pbar i{display:block;height:100%;background:linear-gradient(#ffd24a,#ff9a1a)}
.rwCard .rw{font-size:15px;white-space:nowrap}
.achGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(380px,100%),1fr));gap:0 10px;max-height:calc(94vh - 190px);overflow:auto;padding-right:4px}
.rdot{display:inline-block;width:12px;height:12px;border-radius:50%;background:#ff3b3b;border:2px solid #fff;margin-left:8px;vertical-align:middle}
.notePaper{width:min(620px,94vw);background:#f1e6c8 !important;color:#2a2018}
.notePaper h2{color:#3a2a18 !important;-webkit-text-stroke:0 !important;text-shadow:none !important}
.notePaper .nbody{font-size:19px;line-height:1.35;font-weight:600;-webkit-text-stroke:0;color:#3a2a18;margin:8px 4px 14px;white-space:pre-wrap}
.ctlP{width:min(760px,96vw);max-height:94vh;overflow:auto}
.ctlRow{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:3px 0;border-bottom:2px solid rgba(255,255,255,.08)}
.ctlRow .kb{min-width:92px;padding:3px 10px;border-radius:10px;border:3px solid #000;background:#fff;color:#111;cursor:pointer;font:inherit;font-size:17px;-webkit-text-stroke:0;text-align:center}
.ctlRow .kb.wait{background:#ffe061;animation:pulseO .8s infinite}
.ctlRow .kb.empty{background:#2c2e3a;color:#aab}
.padBox{margin-top:10px;padding:8px 12px;border-radius:12px;background:rgba(0,0,0,.3);border:3px solid #000;font-size:15px;line-height:1.5;-webkit-text-stroke:0}
.setNote{font-size:13px;opacity:.8;-webkit-text-stroke:0;margin:2px 0 6px;text-align:right}
.hcRow{display:flex;justify-content:center;margin:12px 0 2px}
.hcSw{display:flex;align-items:center;gap:10px;padding:8px 16px;border-radius:16px;border:4px solid #000;background:#2c2e3a;cursor:pointer;font-size:19px}
.hcSw.on{background:#7a1c1c;border-color:#e04a3a;box-shadow:0 0 14px rgba(255,60,40,.5)}
.hcSw small{display:block;font-size:13px;opacity:.9;-webkit-text-stroke:0;font-weight:600}
.upSec{margin-top:14px;padding-top:10px;border-top:4px solid rgba(255,255,255,.14)}
.upSec h3{margin:0 0 6px;font-size:22px;color:#ffd24a}
.qNow{margin:6px 0 10px;padding:10px 12px;border-radius:14px;background:rgba(255,224,102,.12);border:4px solid #ffe066}
.qNow .qn{font-size:21px}
.qNow .qd{font-size:14px;font-weight:600;opacity:.92;-webkit-text-stroke:0;color:#eef2ff;margin:3px 0}
.qNow .qrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px}
.qNow .qrow .btn{min-height:36px;padding:2px 12px;font-size:15px}
.padFocus{outline:4px solid #ffe61a !important;outline-offset:2px;position:relative;z-index:3;box-shadow:0 0 14px rgba(255,230,26,.65)}
@media (max-width:600px){#panels .dayRow{grid-template-columns:repeat(4,minmax(0,1fr))}#panels .rwP,#panels .ctlP{padding:12px 10px}.ctlRow{grid-template-columns:1fr auto auto}
#panels .rwP .tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}#panels .rwP .tab{white-space:normal;padding:5px 3px;line-height:1.2;display:flex;align-items:center;justify-content:center;gap:4px}#panels .rwP .tab img{width:20px;height:20px;margin-right:0;flex-shrink:0}#panels .rwP .tab .rdot{width:8px;height:8px;margin-left:0;flex-shrink:0}}
`;
    document.head.appendChild(s);
})();

// ----------------------------------------------------------------------------------------------------------- HUD: босс, хардкор, награды
/** @type {Record<string, any>} */
const Hud3 = {
    bar: null, tag: null, gift: null, dot: null, _t: 0,
    init() {
        const hud = UI.el.hud;
        const bar = document.createElement('div'); bar.id = 'bossBar'; bar.innerHTML = '<div class="bn rb2"></div><div class="bb"><i></i></div>';
        hud.appendChild(bar); this.bar = bar;
        const tag = document.createElement('div'); tag.id = 'hcTag'; tag.className = 'rb1'; hud.appendChild(tag); this.tag = tag;
        const tb = document.getElementById('topBtns');
        if (tb) {
            const g = document.createElement('div'); g.className = 'rbtn'; g.id = 'btnGift'; g.title = 'L';
            g.innerHTML = Icons.glyph('🎁') + '<div id="giftDot"></div>';
            g.onclick = () => UI.open('rewards');
            tb.appendChild(g); this.gift = g; this.dot = g.querySelector('#giftDot');
        }
    },
    update(dt) {
        this._t -= dt;
        if (this._t > 0) return;
        this._t = 0.18;
        if (!UI.hudOn) return;
        const b = Enemies.boss;
        const show = !!(b && b.alive && b.state !== 'rise');
        this.bar.style.display = show ? 'block' : 'none';
        if (show) {
            Icons.label(this.bar.querySelector('.bn'), '👑 ' + Lang.t('boss.name') + (b.phase > 1 ? ' · ' + ['', 'I', 'II', 'III'][b.phase] : ''));
            /** @type {HTMLElement} */ (this.bar.querySelector('.bb i')).style.width = Math.max(0, b.hp / b.maxHp * 100) + '%';
        }
        const hc = !!Game.hardcore;
        this.tag.style.display = hc ? 'block' : 'none';
        if (hc) this.tag.textContent = '💀 ' + Lang.t('hc.tag');
        if (this.dot) this.dot.style.display = (window.Ach && Ach.hasClaimable()) ? 'block' : 'none';
    },
};

// ----------------------------------------------------------------------------------------------------------- геймпад: навигация по окнам
/** @type {Record<string, any>} */
const PadNav = {
    cur: null, _ov: null, _rep: 0, _dir: 0,
    SEL: 'button, .btn, .tab, .cell, .sk, .mode, .poster, .hairBtn, .sw, .hcSw, .kb, .rbtn.close, input[type=range]',
    items(ov) {
        return Array.from(ov.querySelectorAll(this.SEL)).filter((e) => { const r = e.getBoundingClientRect(); return !e.disabled && !e.classList.contains('dis') && r.width > 4 && r.height > 4 && e.offsetParent !== null; });
    },
    key(el) { return el && (el.dataset.padKey || el.id || (el.dataset.i != null ? 'slot:' + el.dataset.i : el.textContent)); },
    snapshot(ov) { if (!ov || !this.cur) return null; return { key: this.key(this.cur), index: this.items(ov).indexOf(this.cur) }; },
    restore(ov, snap) { const list = this.items(ov); this.focus(list.find(e => this.key(e) === snap.key) || list[Math.max(0, Math.min(snap.index, list.length - 1))]); },
    clear() { if (this.cur) this.cur.classList.remove('padFocus'); this.cur = null; },
    focus(el, scroll = true) {
        if (this.cur && this.cur !== el) this.cur.classList.remove('padFocus');
        this.cur = el;
        if (el) { el.classList.add('padFocus'); if (scroll) try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* ок */ } }
    },
    update(dt) {
        const ov = UIPanels.overlay;
        if (!ov || !Input.pad.on) { if (this.cur) this.clear(); this._ov = null; return; }
        if (ov !== this._ov) { this._ov = ov; this.clear(); }
        const P = Input.pad;
        const anyPress = [0, 1, 12, 13, 14, 15].some(i => Input.padPressed(i)) || Math.abs(P.lx) > 0.5 || Math.abs(P.ly) > 0.5;
        if (!this.cur && !anyPress) return;
        const list = this.items(ov);
        if (!list.length) return;
        if (!this.cur || !list.includes(this.cur)) { const key = this.key(this.cur); this.focus((key && list.find(e => this.key(e) === key)) || list.find(e => e.matches('.btn, button')) || list[0]); if (!anyPress) return; }
        // направление: крестовина (по нажатию) или левый стик (с повтором)
        let dir = 0;
        if (Input.padPressed(14)) dir = 1; else if (Input.padPressed(15)) dir = 2; else if (Input.padPressed(12)) dir = 3; else if (Input.padPressed(13)) dir = 4;
        else {
            const st = Math.abs(P.lx) > Math.abs(P.ly) ? (P.lx < -0.6 ? 1 : P.lx > 0.6 ? 2 : 0) : (P.ly < -0.6 ? 3 : P.ly > 0.6 ? 4 : 0);
            if (st && (st !== this._dir || (this._rep -= dt) <= 0)) { dir = st; this._rep = this._dir === st ? ASTRA_PAD_REPEAT_INTERVAL : ASTRA_PAD_REPEAT_DELAY; }
            this._dir = st;
        }
        const cur = this.cur;
        if (dir && cur.matches('input[type=range]') && (dir === 1 || dir === 2)) {
            const inp = /** @type {HTMLInputElement} */ (cur); inp.value = String(Math.max(0, Math.min(100, +inp.value + (dir === 2 ? 5 : -5)))); inp.dispatchEvent(new Event('input')); Sfx.ui('select');
        } else if (dir) {
            const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
            let best = null, bs = 1e12;
            for (const e of list) {
                if (e === cur) continue;
                const r = e.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
                const along = dir === 1 ? -dx : dir === 2 ? dx : dir === 3 ? -dy : dy, across = dir <= 2 ? Math.abs(dy) : Math.abs(dx);
                if (along < 4) continue;
                const sc = along + across * 2.2;
                if (sc < bs) { bs = sc; best = e; }
            }
            if (best) { this.focus(best); Sfx.ui('select'); }
        }
        if (Input.padPressed(0) && this.cur) { Sfx.ui('click'); if (UIPanels.cur === 'inv' && this.cur.matches('.cell')) UIPanels._invPadClick(+this.cur.dataset.i); else this.cur.click(); }
        if (Input.padPressed(1)) {
            if (UIPanels.cur === 'inv' && UIPanels._invMove != null) { UIPanels._invMove = null; UIPanels._invRender(); Input._padPressed.delete(1); return; }
            const c = ov.querySelector('.close'); if (c) { Input._padPressed.delete(1); /** @type {HTMLElement} */ (c).click(); }
        }
    },
};

// ----------------------------------------------------------------------------------------------------------- окна
/** @type {Record<string, any>} */
const PANELS3 = {
    // ---- награды
    RW_TABS: [['daily', '🎁', 'rw.daily', '#ffd24a'], ['tasks', '📋', 'rw.tasks', '#6ec8ff'], ['ach', '🏆', 'rw.ach', '#ff9a4a'], ['notes', '📜', 'rw.notes', '#c9b27a']],
    build_rewards(d) {
        const L = Lang.code === 'en' ? 1 : 0;
        const p = this.panel(Lang.t('rw.title'), true);
        p.classList.add('rwP');
        const from = (d && d.from) || this._rwFrom || null; this._rwFrom = from;
        p.querySelector('.close').onclick = () => { Sfx.ui('cancel'); if (from === 'title') this.open('title'); else if (from === 'pause') this.open('pause'); else this.close(); };
        const tab = (d && d.tab) || this._rwTab || 'daily'; this._rwTab = tab;
        const tabs = this.el('div', 'tabs');
        for (const [id, ic, key, col] of this.RW_TABS) {
            const t = this.el('div', 'tab rb1' + (tab === id ? ' on' : '')); Icons.label(t, ic + ' ' + Lang.t(key));
            t.style.setProperty('--c', col);
            if (id === 'daily' && Ach.dailyState().can) t.insertAdjacentHTML('beforeend', '<span class="rdot"></span>');
            if (id === 'tasks' && Ach.rollDaily().list.some(q => { const P = Ach.POOL.find(x => x.id === q.id); return P && !q.claimed && q.p >= P.n; })) t.insertAdjacentHTML('beforeend', '<span class="rdot"></span>');
            t.onclick = () => { Sfx.ui('select'); this.open('rewards', { tab: id, from }); };
            tabs.appendChild(t);
        }
        p.appendChild(tabs);
        const body = this.el('div');
        p.appendChild(body);
        if (tab === 'daily') this._rwDaily(body);
        else if (tab === 'tasks') this._rwTasks(body, L);
        else if (tab === 'ach') this._rwAch(body, L);
        else this._rwNotes(body, L);
        return p;
    },
    _rwDaily(body) {
        const st = Ach.dailyState();
        body.appendChild(this.el('div', 'hint rb1', Lang.t(st.clockBack ? 'rw.clockBack' : st.can ? 'rw.dailyHint' : 'rw.dailyDone', { d: Ach.data.dr.last })));
        const row = this.el('div', 'dayRow');
        const today = st.can ? st.day : Math.min(7, Math.max(1, Ach.data.dr.streak % 7 === 0 ? 7 : Ach.data.dr.streak % 7));
        for (let i = 1; i <= 7; i++) {
            const done = st.can ? i < st.day : i <= today;
            const c = this.el('div', 'dayC' + (done ? ' done' : '') + (st.can && i === st.day ? ' today' : ''));
            c.appendChild(this.el('div', 'dn rb1', Lang.t('rw.day', { n: i })));
            c.appendChild(this.el('div', 'dc rb1', '🪙 ' + Ach.DAILY[i - 1]));
            c.appendChild(this.el('div', 'dh', i === 7 ? '❤️' : '·'));
            if (done) c.appendChild(this.el('div', 'ck', '✔'));
            row.appendChild(c);
        }
        body.appendChild(row);
        body.appendChild(this.el('div', 'hint', Lang.t('rw.streak', { n: Ach.data.dr.streak || 0 })));
        const r = this.el('div', 'row'); r.style.marginTop = '8px';
        if (st.can) r.appendChild(this.btn('🎁 ' + Lang.t('rw.claim', { n: Ach.DAILY[st.day - 1] }), '', () => {
            const res = Ach.claimDaily();
            if (!res) return;
            Sfx.ui('fanfare'); FX && FX.sparkBurst(Player.x, Player.y + 120, Player.z, 30, '#ffe066'); if (window.UiFX) UiFX.confetti(70);
            UI.toast(Lang.t('rw.claimed', { n: res.coins }) + (res.heart ? ' ❤️' : ''), 'good');
            this.open('rewards', { tab: 'daily' });
        }));
        else if (Ach.data.dr.last === Ach.today() && Ach.data.dr.dbl !== Ach.data.dr.last && Ach.data.dr.took > 0 && Platform.adsAvailable()) {
            r.appendChild(this.priceBtn('ad', Lang.t('rw.double', { n: Ach.data.dr.took }), 'blue', async () => {
                if (await Ach.doubleDaily()) { Sfx.ui('fanfare'); UI.toast(Lang.t('rw.claimed', { n: Ach.data.dr.took }), 'good'); this.open('rewards', { tab: 'daily' }); }
                else if (!Platform.adsAvailable()) this.open('rewards', { tab: 'daily' });
            }));
        }
        body.appendChild(r);
    },
    _rwTasks(body, L) {
        const dl = Ach.rollDaily();
        const clockBack = dl.date > Ach.today();
        body.appendChild(this.el('div', 'hint rb1', Lang.t(clockBack ? 'rw.clockBack' : 'rw.tasksHint', { d: dl.date })));
        for (const q of dl.list) {
            const P = Ach.POOL.find(x => x.id === q.id); if (!P) continue;
            const ok = !clockBack && q.p >= P.n;
            const card = this.el('div', 'rwCard' + (q.claimed ? ' done' : ''));
            card.appendChild(this.el('div', 'ic', q.claimed ? '✔' : '📋'));
            const mid = this.el('div', 'mid');
            mid.appendChild(this.el('div', 'nm rb1', P.name[L]));
            mid.appendChild(this.el('div', 'ds', P.desc[L] + ' — ' + Math.min(q.p, P.n) + '/' + P.n));
            const bar = this.el('div', 'pbar', '<i style="width:' + Math.round(Math.min(1, q.p / P.n) * 100) + '%"></i>'); mid.appendChild(bar);
            card.appendChild(mid);
            if (q.claimed) card.appendChild(this.el('div', 'rw rb1', '✔'));
            else card.appendChild(this.btn('🪙 ' + P.coins, 'sm' + (ok ? '' : ' dis'), () => {
                const got = Ach.claimChallenge(q.id);
                if (!got) return;
                Sfx.ui('coin'); UI.toast(Lang.t('rw.claimed', { n: got }), 'good'); this.open('rewards', { tab: 'tasks' });
            }));
            body.appendChild(card);
        }
        body.appendChild(this.el('div', 'hint rb1', Lang.t(dl.bonus ? 'rw.bonusGot' : 'rw.bonus', { n: 150 })));
    },
    _rwAch(body, L) {
        body.appendChild(this.el('div', 'hint rb1', Lang.t('rw.achCount', { a: Ach.doneCount(), b: Ach.DEFS.length })));
        for (const mode of ['normal', 'hardcore']) {
            const c = (Ach.data.modes && Ach.data.modes[mode]) || {};
            body.appendChild(this.el('div', 'hint', Lang.t(mode === 'hardcore' ? 'rw.modeHardcore' : 'rw.modeNormal', { n: c.day || 0, w: c.win || 0, b: c.boss || 0 })));
        }
        const grid = this.el('div', 'achGrid');
        const defs = Ach.DEFS.slice().sort((a, b) => (Ach.data.done[b.id] ? 0 : 1) - (Ach.data.done[a.id] ? 0 : 1) || 0);
        for (const a of defs) {
            const done = !!Ach.data.done[a.id];
            const hidden = a.hidden && !done;
            const [cur, goal] = Ach.progress(a);
            const card = this.el('div', 'rwCard' + (done ? ' done' : ''));
            card.appendChild(this.el('div', 'ic', hidden ? '🔒' : Icons.glyph(a.icon)));
            const mid = this.el('div', 'mid');
            mid.appendChild(this.el('div', 'nm rb1', hidden ? Lang.t('rw.secret') : a.name[L]));
            mid.appendChild(this.el('div', 'ds', hidden ? Lang.t('rw.secretHint') : a.desc[L]));
            if (!done && !hidden) {
                mid.appendChild(this.el('div', 'pbar', '<i style="width:' + Math.round(Math.min(1, cur / goal) * 100) + '%"></i>'));
                mid.appendChild(this.el('div', 'ds', Lang.t('rw.remaining', { n: Math.max(0, goal - cur) })));
            }
            if (a.skin && SKINS.byId[a.skin] && !hidden) mid.appendChild(this.el('div', 'ds', Lang.t('rw.skin', { n: SKINS.byId[a.skin].name[L] })));
            card.appendChild(mid);
            card.appendChild(this.el('div', 'rw rb1', done ? '✔' : '🪙 ' + a.coins));
            grid.appendChild(card);
        }
        body.appendChild(grid);
    },
    _rwNotes(body, L) {
        body.appendChild(this.el('div', 'hint rb1', Lang.t('rw.notesHint', { a: Lore.countAll(), b: Lore.NOTES.length })));
        const grid = this.el('div', 'achGrid');
        for (const n of Lore.NOTES) {
            const found = !!Lore.seen[n.id];
            const card = this.el('div', 'rwCard' + (found ? ' done' : ' lock'));
            card.appendChild(this.el('div', 'ic', found ? Icons.glyph('📜') : '🔒'));
            const mid = this.el('div', 'mid');
            mid.appendChild(this.el('div', 'nm rb1', found ? n.name[L] : '???'));
            mid.appendChild(this.el('div', 'ds', found ? Lang.t('rw.noteRead') : Lang.t('rw.noteHint', { s: Lang.t('site.' + n.site) })));
            card.appendChild(mid);
            if (found) { card.style.cursor = 'pointer'; card.onclick = () => { Sfx.ui('page'); this.open('journal', { id: n.id, from: 'rewards' }); }; }
            grid.appendChild(card);
        }
        body.appendChild(grid);
    },

    // ---- записка: окно чтения теперь общее с журналом (Panels4.js: build_journal / build_note)

    // ---- управление: переназначение клавиш
    build_controls(d) {
        const p = this.panel(Lang.t('ctl.title'), true);
        p.classList.add('ctlP');
        const back = () => { Input.cancelCapture(); this.open('settings', { from: (d && d.from) || 'title' }); };
        p.querySelector('.close').onclick = () => { Sfx.ui('cancel'); back(); };
        p.appendChild(this.el('div', 'hint rb1', Lang.t('ctl.hint')));
        for (const a of Input.REBINDABLE) {
            const row = this.el('div', 'ctlRow');
            row.appendChild(this.el('div', 'rb1', Lang.t(a === 'back' ? 'ctl.back2' : 'ctl.' + a)));
            for (let slot = 0; slot < 2; slot++) {
                const code = Input.binds[a][slot];
                const b = this.el('button', 'kb' + (code ? '' : ' empty'), Input.label(code));
                b.onclick = () => {
                    Input.cancelCapture();
                    b.className = 'kb wait'; b.textContent = Lang.t('ctl.press');
                    Input.capture((c) => {
                        if (c === 'Escape') { this.open('controls', d); return; }
                        if (!Input.setBind(a, slot, c)) UI.toast(Lang.t('ctl.busy'), 'warn');
                        else Sfx.ui('select');
                        this.open('controls', d);
                    });
                };
                row.appendChild(b);
            }
            p.appendChild(row);
        }
        const r = this.el('div', 'row'); r.style.marginTop = '10px';
        r.appendChild(this.btn(Lang.t('ctl.reset'), 'gray sm', () => { Input.resetBinds(); Sfx.ui('select'); this.open('controls', d); }));
        r.appendChild(this.btn(Lang.t('ctl.back'), 'sm', back));
        p.appendChild(r);
        p.appendChild(this.el('div', 'padBox rb1', '🎮 ' + Lang.t('ctl.pad')));
        return p;
    },

    // ---- настройки
    build_settings(d) {
        const p = this.panel(Lang.t('menu.settings'), true);
        const back = () => this.open(d.from === 'pause' ? 'pause' : 'title');
        p.querySelector('.close').onclick = () => { Sfx.ui('cancel'); back(); };
        const row = (label, ctrl) => { const r = this.el('div', 'kv'); r.appendChild(this.el('span', '', label)); r.appendChild(ctrl); p.appendChild(r); };
        const slider = (get, set) => { const s = this.el('input', 'slider'); s.type = 'range'; s.min = 0; s.max = 100; s.value = String(Math.round(get() * 100)); s.oninput = () => set(+s.value / 100); return s; };
        row(Lang.t('set.sfx'), slider(() => Sound.masterK, (v) => { window.SOUND_VOLUME_USER = v; Sound.masterK = v; Sound._sync(); Store.set(GAME_ID + '.vol', String(v)); }));
        row(Lang.t('set.music'), slider(() => Sound.musicK, (v) => { Sound.musicK = v; Sound._sync(); Store.set(GAME_ID + '.volMusic', String(v)); }));
        row(Lang.t('set.amb'), slider(() => Sfx.ambK, (v) => { Sfx.ambK = v; Store.set(GAME_ID + '.volAmb', String(v)); }));
        row(Lang.t('set.sens'), slider(() => Cam.sens / 2, (v) => { Cam.sens = Math.max(0.15, v * 2); Store.set(GAME_ID + '.sens', String(Cam.sens)); }));
        const snd = this.btn(Sound.muted ? Lang.t('set.soundOff') : Lang.t('set.soundOn'), 'gray sm', () => { Sound.toggleMuted(); snd.textContent = Sound.muted ? Lang.t('set.soundOff') : Lang.t('set.soundOn'); UI.el.btnSound.innerHTML = Sound.muted ? UI.svg.mute : UI.svg.sound; });
        row(Lang.t('set.sound'), snd);
        const wl = () => Lang.t(Game.wheelMode === 'zoom' ? 'set.wheelZoom' : 'set.wheelHotbar');
        const wh = this.btn(wl(), 'gray sm', () => { Game.wheelMode = Game.wheelMode === 'zoom' ? 'hotbar' : 'zoom'; Store.set(GAME_ID + '.wheel', Game.wheelMode); wh.textContent = wl(); });
        row(Lang.t('set.wheel'), wh);
        const q = this.btn(this.qLabel(), 'gray sm', () => { Game.quality = ((Game.quality || 1) % 3) + 1; Game.applyQuality(); q.textContent = this.qLabel(); });
        row(Lang.t('set.quality'), q);
        // экранное управление: в Playables оно всегда на экране — переключателя нет
        if (String(GAME_PLATFORM) !== 'playables') {
            const tl = () => Lang.t({ auto: 'set.touch_auto', on: 'set.touch_on', off: 'set.touch_off' }[UI.touchMode()]);
            const tb = this.btn(tl(), 'gray sm', () => { const m = UI.touchMode(); UI.setTouchMode(m === 'auto' ? 'on' : m === 'on' ? 'off' : 'auto'); tb.textContent = tl(); });
            row(Lang.t('set.touch'), tb);
        }
        row(Lang.t('set.controls'), this.btn('⌨️ ' + Lang.t('set.controlsBtn'), 'blue sm', () => this.open('controls', { from: d.from })));
        row(Lang.t('save.transfer'), this.btn('💾 ' + Lang.t('save.transferOpen'), 'blue sm', () => this.open('transfer', { from: d.from })));
        p.appendChild(this.el('div', 'setNote', Lang.t(Input.pad.on ? 'set.padOn' : 'set.padOff')));
        return p;
    },

    build_transfer(d) {
        const p = this.panel(Lang.t('save.transfer'), true);
        p.querySelector('.close').onclick = () => this.open('settings', d);
        p.appendChild(this.el('div', 'hint', Lang.t('save.transferHint')));
        const code = this.el('textarea', 'saveCode'); code.spellcheck = false; code.setAttribute('aria-label', Lang.t('save.codeLabel'));
        code.maxLength = ASTRA_SAVE_CODE_LIMIT; code.placeholder = 'NF99.…';
        p.appendChild(code);
        const row = this.el('div', 'row'), status = this.el('div', 'hint rb1'), preview = this.el('div', 'col');
        status.setAttribute('role', 'status');
        const fail = e => { status.textContent = Lang.t(e.message || 'save.codeBad'); };
        let busy = false;
        const copy = this.btn(Lang.t('save.copy'), 'blue sm', async () => {
            if (busy) return; busy = true;
            try {
                code.value = await Save.exportCode(); preview.innerHTML = '';
                try {
                    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard unavailable');
                    await navigator.clipboard.writeText(code.value);
                    status.textContent = Lang.t('save.copied');
                } catch (e) { code.focus(); code.select(); status.textContent = Lang.t('save.copyManual'); }
            }
            catch (e) { fail(e); } finally { busy = false; }
        });
        copy.dataset.padKey = 'save-copy'; row.appendChild(copy);
        row.appendChild(this.btn(Lang.t('save.selectCode'), 'gray sm', () => { code.focus(); code.select(); }));
        row.appendChild(this.btn(Lang.t('save.verify'), 'sm', async () => {
            if (busy) return; busy = true; preview.innerHTML = '';
            const checkedCode = code.value;
            try {
                const result = await Save.readCode(checkedCode);
                if (code.value !== checkedCode) return;
                status.textContent = Lang.t('save.codePreview', { d: result.info.day, l: result.info.lv });
                preview.appendChild(this.btn(Lang.t('save.import'), 'blue', async () => {
                    if (busy) return; busy = true;
                    try {
                        // Leave the active expedition before committing, so menu autosave cannot overwrite the import.
                        if (Game.state !== 'menu') Game.toMenu();
                        await Save.importCode(checkedCode); Game.startGame(false); UI.toast(Lang.t('save.imported'), 'good');
                    } catch (e) { UI.toast(Lang.t(e.message || 'save.codeBad'), 'warn'); }
                    finally { busy = false; }
                }));
            } catch (e) { fail(e); } finally { busy = false; }
        }));
        code.oninput = () => { preview.innerHTML = ''; status.textContent = ''; };
        p.appendChild(row); p.appendChild(status); p.appendChild(preview);
        return p;
    },

    // ---- справка по текущим клавишам
    build_help(d) {
        const p = this.panel(Lang.t('menu.help'), true);
        p.querySelector('.close').onclick = () => { Sfx.ui('cancel'); this.open(d.from === 'pause' ? 'pause' : 'title'); };
        const g = this.el('div', 'ctrl');
        const k = (a) => (Input.binds[a] || []).slice(0, 1).map(c => Input.label(c)).join('');
        const rows = [
            [['forward', 'left', 'back', 'right'].map(k).join(' '), 'help.move'], [k('sprint'), 'help.sprint'], [k('jump'), 'help.jump'], [k('interact'), 'help.interact'],
            [Lang.t('help.mouseL'), 'help.attack'], ['1 – 9 / ' + Lang.t('help.wheelK'), 'help.slots'], [k('swap'), 'help.swap'], [k('drop'), 'help.drop'], [k('reload'), 'help.rotate'],
            [k('inv'), 'help.inv'], [k('map'), 'help.board'], [k('upgrade'), 'help.upgrade'], [k('quest'), 'help.quest'], [k('notes'), 'help.notes'], [k('rewards'), 'help.rewards'], ['Esc', 'help.pause'],
        ];
        for (const [kk, t] of rows) { g.appendChild(this.el('div', '', '<kbd>' + kk + '</kbd>')); g.appendChild(this.el('div', 'rb1', Lang.t(t))); }
        p.appendChild(g);
        p.appendChild(this.el('div', 'hint', Lang.t('help.tips')));
        p.appendChild(this.el('div', 'hint', Lang.t('armor.help')));
        p.appendChild(this.el('div', 'padBox rb1', '🎮 ' + Lang.t('ctl.pad')));
        return p;
    },

    // ---- новая игра: режимы + хардкор
    build_newgame() {
        const p = this.panel(Lang.t('mode.title'), true);
        p.classList.add('modeP');
        p.style.width = 'min(860px,96vw)';
        p.querySelector('.close').onclick = () => { Sfx.ui('cancel'); this.open('title'); };
        p.appendChild(this.el('div', 'hint rb1', Lang.t('mode.hint')));
        const row = this.el('div', 'modeRow');
        const modes = [[0, '🧍', 'mode.solo', 'mode.soloD'], [1, '🧍🤖', 'mode.b1', 'mode.b1D'], [2, '🤖🧍🤖', 'mode.b2', 'mode.b2D'], [3, '🤖🤖🧍🤖', 'mode.b3', 'mode.b3D']];
        Game.newgameBots = Math.max(0, Math.min(3, Game.newgameBots | 0));
        for (const [n, ic, t, dsc] of modes) {
            const m = this.el('div', 'mode' + (Game.newgameBots === n ? ' on' : ''));
            m.dataset.bots = String(n); m.dataset.padKey = 'newgame-bots-' + n;
            m.setAttribute('role', 'radio'); m.setAttribute('aria-checked', String(Game.newgameBots === n));
            m.appendChild(this.el('div', 'ic', Array.from(String(ic)).map(ch => Icons.glyph(ch)).join(''))); m.appendChild(this.el('h3', 'rb2', Lang.t(t))); m.appendChild(this.el('p', '', Lang.t(dsc)));
            m.onclick = () => { Sfx.ui('select'); Game.newgameBots = n; this.open('newgame'); };
            row.appendChild(m);
        }
        p.appendChild(row);
        const hr = this.el('div', 'hcRow');
        const sw = this.el('div', 'hcSw rb1' + (this._hc ? ' on' : ''), '<span style="font-size:30px">💀</span><span>' + Lang.t('mode.hc') + '<small>' + Lang.t('mode.hcD') + '</small></span><span>' + (this._hc ? '✔' : '✖') + '</span>');
        sw.onclick = () => { this._hc = !this._hc; Sfx.ui(this._hc ? 'toggle' : 'toggleoff'); this.open('newgame'); };
        hr.appendChild(sw); p.appendChild(hr);
        if (Game.newgameBots > 0) p.appendChild(this.botDeliveryControl());
        const start = this.btn(Lang.t('mode.start'), '', () => Platform.ads.gate(() => Game.startGame(true, { bots: Game.newgameBots, hardcore: !!this._hc }), 'start'));
        start.dataset.padKey = 'newgame-start'; start.style.margin = '12px auto 0'; start.style.display = 'block'; p.appendChild(start);
        return p;
    },

    // ---- улучшение оружия (раздел в окне верстака)
    upgradeItem(i) {
        const s = Inv.slots[i];
        if (!s || !Inv.upgradable(s.id)) return false;
        const lv = s.lv | 0;
        if (lv >= DATA.upgrade.max) return false;
        const cost = DATA.upgrade.cost[lv];
        for (const [k, n] of Object.entries(cost)) if ((k === 'scrap' ? Camp.scrap : Inv.count(k)) < n) { UI.toast(Lang.t('needMore'), 'warn'); Sfx.ui('deny'); return false; }
        for (const [k, n] of Object.entries(cost)) { if (k === 'scrap') Camp.spendScrap(n); else Inv.take(k, n); }
        s.lv = lv + 1; Inv.emit();
        const b = Camp.props.bench;
        Sfx.at('clang', b.x, 0, b.z, 1); Sfx.ui('gem'); FX.sparkBurst(b.x, Camp.y + 120, b.z, 30, '#ffd070');
        UI.toast(Lang.t('up.done', { n: UI.name(s.id), l: s.lv }), 'good');
        Quests.event('gearUp', 1);
        Game.autosave('upgrade');
        return true;
    },
    _upgradeSection(p) {
        const sec = this.el('div', 'upSec');
        sec.appendChild(this.el('h3', 'rb2', '⚒️ ' + Lang.t('up.title')));
        sec.appendChild(this.el('div', 'hint', Lang.t('up.hint')));
        const grid = this.el('div', 'grid'); grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(min(330px,100%),1fr))';
        let any = false;
        Inv.slots.forEach((s, i) => {
            if (!s || !Inv.upgradable(s.id)) return;
            any = true;
            const lv = s.lv | 0, max = lv >= DATA.upgrade.max;
            const card = this.el('div', 'card'); card.innerHTML = UI.icon(s.id);
            const mid = this.el('div'); mid.style.flex = '1';
            mid.appendChild(this.el('div', 'nm rb2', UI.name(s.id) + ' +' + lv + (max ? ' ★' : ' → +' + (lv + 1))));
            mid.appendChild(this.el('div', 'ds', Lang.t('up.bonus', { d: lv * 18, t: lv * 15 })));
            if (!max) { const c = DATA.upgrade.cost[lv]; mid.appendChild(this.cost(Object.entries(c).map(([k, n]) => [k, n, k === 'scrap' ? Camp.scrap : Inv.count(k)]))); }
            card.appendChild(mid);
            if (max) card.appendChild(this.el('div', 'rb1', Lang.t('up.max')));
            else {
                const can = Object.entries(DATA.upgrade.cost[lv]).every(([k, n]) => (k === 'scrap' ? Camp.scrap : Inv.count(k)) >= n);
                card.appendChild(this.btn(Lang.t('up.do'), 'sm' + (can ? '' : ' dis'), () => { if (this.upgradeItem(i)) this.open('craft'); }));
            }
            grid.appendChild(card);
        });
        if (!any) grid.appendChild(this.el('div', 'hint rb1', Lang.t('up.none')));
        sec.appendChild(grid);
        p.appendChild(sec);
    },
};
Object.assign(UIPanels, PANELS3);

// Обёртки: исходные окна остаются, к ним добавляются новые элементы
(function () {
    const P = UIPanels;
    const wrap = (name, fn) => { const orig = P[name]; P[name] = function (d, o) { const r = orig.call(this, d, o); try { fn.call(this, r, d); } catch (e) { console.warn('Panels3 wrap ' + name, e); } return r; }; };

    wrap('build_craft', /** @this {any} */ function (p) { this._upgradeSection(p); });

    wrap('build_title', /** @this {any} */ function (wrap) {
        const menu = wrap.querySelector('.menuTools') || wrap.querySelector('.menu'); if (!menu || !window.Ach) return;
        const b = this.btn('🎁 ' + Lang.t('rw.title'), 'blue menuRewards', () => this.open('rewards', { from: 'title' }));
        if (Ach.hasClaimable()) b.insertAdjacentHTML('beforeend', '<span class="rdot"></span>');
        menu.appendChild(b);
    });

    wrap('build_ending', /** @this {any} */ function (p, d) {
        if (!d) return;
        const extra = [];
        if (d.boss) extra.push('👑 ' + Lang.t('end.boss'));
        if (d.hc) extra.push('💀 ' + Lang.t('end.hc'));
        if (d.coins) extra.push('🪙 ' + Lang.t('end.coins', { n: d.coins }));
        if (!extra.length) return;
        const box = this.el('div', 'hint rb1', extra.join(' · '));
        const row = p.querySelector('.row'); p.insertBefore(box, row);
    });

    // Журнал заданий: карточка текущего шага — прогресс, расстояние, кнопки «на карте» и метка
    wrap('build_quests', /** @this {any} */ function (p) {
        const cur = Quests.current();
        const list = p.querySelector('.qList'); if (!cur || !list) return;
        const t = (pair) => Quests.txt(pair);
        const pr = Quests.progress(cur);
        const card = this.el('div', 'qNow');
        card.appendChild(this.el('div', 'qn rb1', '▶ ' + t(cur.t)));
        card.appendChild(this.el('div', 'qd', t(cur.d)));
        if (pr.max) card.appendChild(this.el('div', 'pbar', '<i style="width:' + Math.round(Math.min(1, pr.cur / pr.max) * 100) + '%"></i>'));
        const row = this.el('div', 'qrow');
        if (pr.max) row.appendChild(this.el('span', 'rb1', pr.cur + ' / ' + pr.max));
        const tg = Quests.resolve(cur.target);
        if (tg) {
            row.appendChild(this.el('span', 'rb1', '📏 ' + Math.round(Math.hypot(tg.x - Player.x, tg.z - Player.z) / M) + ' ' + Lang.t('unit.m')));
            row.appendChild(this.btn('🗺️ ' + Lang.t('q.onMap'), 'blue sm', () => this.open('map')));
        } else row.appendChild(this.el('span', 'rb1', Lang.t('q.noTarget')));
        card.appendChild(row);
        p.insertBefore(card, list);
        setTimeout(() => { const c = p.querySelector('.qStep.cur'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'center' }); }, 30);
    });
})();

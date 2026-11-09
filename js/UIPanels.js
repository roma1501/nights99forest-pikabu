// UIPanels.js — окна: титул, пауза, настройки, помощь, наряд, верстак, костёр, доска пропавших, смерть, финал.
// Открытое окно замораживает мир (Game.update: UI.modal), но кадр, звук и интерфейс живут.

/** @type {Record<string, any>} */
const UIPanels = {
    ui: null, host: null, cur: null, waypointKid: null,

    css() {
        const s = document.createElement('style');
        s.textContent = `
.title{position:absolute;inset:0;display:grid;grid-template-columns:minmax(240px,380px) minmax(320px,440px);gap:18px clamp(24px,5vw,90px);align-content:center;align-items:center;justify-content:center;padding:24px max(20px,env(safe-area-inset-right)) 24px max(20px,env(safe-area-inset-left));box-sizing:border-box;overflow-y:auto;pointer-events:auto;background:linear-gradient(90deg,rgba(4,9,12,.38),rgba(4,9,12,.08) 48%,rgba(4,9,12,.5))}
.title>*{pointer-events:auto}
.titleBrand{text-align:center;min-width:0}
.logo{text-align:center;margin-bottom:12px;animation:logo .7s cubic-bezier(.2,1.4,.4,1);filter:drop-shadow(0 8px 16px rgba(0,0,0,.45))}
@keyframes logo{from{transform:scale(.4) translateY(-40px);opacity:0}to{transform:none;opacity:1}}
.logo .l1{font-family:'Rubik',sans-serif;font-weight:900;font-size:clamp(100px,15vw,166px);line-height:.88;color:#ffd24a;-webkit-text-fill-color:#ffd24a;-webkit-text-stroke:6px #21190e;paint-order:stroke fill;position:relative;text-shadow:0 7px 0 #684216}
.logo .l2{font-family:'Rubik',sans-serif;font-weight:900;font-size:clamp(42px,6vw,70px);line-height:1;letter-spacing:3px;transform:rotate(-2deg);margin-top:7px}
.logo .l3{font-size:clamp(16px,2.2vw,23px);margin-top:8px;letter-spacing:3px;color:#b6ff8a}
.logo .logoLead{font-size:clamp(20px,3vw,30px);line-height:1.1;margin-bottom:9px;color:#b6ff8a}
.menu{display:flex;flex-direction:column;gap:16px;min-width:0;padding:22px;border:3px solid #0b1115;border-radius:24px;background:linear-gradient(145deg,rgba(37,45,54,.95),rgba(13,23,27,.94));box-shadow:0 10px 0 rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.15)}
.menuPrimary{display:flex;flex-direction:column;gap:10px}
.menuPrimary .btn{font-size:25px;min-height:62px;width:100%}
.menuTools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding-top:16px;border-top:1px solid rgba(255,255,255,.15)}
.menuTools .btn{min-width:0;min-height:60px;font-size:17px;line-height:1.15;padding:8px;white-space:normal;display:flex;align-items:center;justify-content:center;gap:6px}
.menuTools .glyphArt{width:28px;height:28px;flex-shrink:0}
.menuTools .menuRewards{grid-column:1/-1;min-height:52px}
.bestTag{display:inline-block;margin-top:14px;padding:7px 14px;font-size:17px;background:rgba(11,19,22,.65);border:1px solid rgba(255,218,119,.4);border-radius:24px}
.saveInfo{margin:0;text-align:center;font-size:14px;line-height:1.35;color:#b6ff8a}
.saveInfo.bad{color:#ff9a8a}
.title .foot{grid-column:1/-1;text-align:center;font-size:12px;opacity:.7;pointer-events:none;padding-bottom:env(safe-area-inset-bottom)}
@media(max-width:650px) and (orientation:portrait){.title{grid-template-columns:minmax(0,390px);gap:14px;padding-top:max(16px,env(safe-area-inset-top));padding-bottom:12px}.title .logo{margin:0}.title .logo .l1{font-size:94px;line-height:.8}.title .logo .l2{font-size:44px;margin-top:6px}.title .logo .l3{font-size:16px;letter-spacing:2px;margin-top:5px}.title .bestTag{font-size:14px;margin-top:10px;padding:4px 12px}.title .menu{padding:15px;gap:12px;border-radius:20px}.title .menuPrimary .btn{min-height:54px;font-size:22px}.title .menuTools{gap:8px;padding-top:12px}.title .menuTools .btn{min-height:52px;font-size:16px}.title .menuTools .menuRewards{min-height:46px}.title .foot{font-size:11px}}
@media(orientation:landscape) and (max-height:540px){.title{grid-template-columns:minmax(180px,300px) minmax(310px,420px);gap:10px 24px;padding-top:12px;padding-bottom:10px}.title .logo .l1{font-size:100px}.title .logo .l2{font-size:46px}.title .logo .l3{font-size:16px}.title .menu{padding:14px;gap:10px}.title .menuPrimary{gap:6px}.title .menuPrimary .btn{min-height:46px;font-size:20px}.title .menuTools{gap:7px;padding-top:10px}.title .menuTools .btn{min-height:43px;font-size:15px}.title .saveInfo{font-size:12px}.title .bestTag{font-size:14px;margin-top:4px}.title .foot{font-size:10px}}
@media(max-width:650px) and (max-height:700px) and (orientation:portrait){.title{gap:10px;padding-top:10px;align-content:safe center}.title .logo .l1{font-size:76px}.title .logo .l2{font-size:36px}.title .logo .l3{font-size:13px}.title .bestTag{margin-top:7px;padding:3px 10px;font-size:13px}.title .menu{padding:12px;gap:10px}.title .menuPrimary{gap:7px}.title .menuPrimary .btn{min-height:49px;font-size:21px}.title .menuTools{padding-top:10px;gap:7px}.title .menuTools .btn{min-height:48px}.title .menuTools .menuRewards{min-height:44px}}
@media(orientation:landscape) and (max-height:540px){.title{align-content:safe center}.title .menu{padding:10px}.title .menuPrimary .btn{padding:6px 10px}.title .menuTools .btn{padding:4px 6px;min-height:44px}.title .menuTools .glyphArt{width:20px;height:20px}.title .menuTools .menuRewards{min-height:44px}}
/* очень низкий альбом (телефон в iframe платформы, ~570–700 × 260–380): логотип и меню помещаются целиком */
@media(orientation:landscape) and (max-height:380px){.title{grid-template-columns:minmax(150px,250px) minmax(260px,370px);gap:4px 18px;padding:6px max(12px,env(safe-area-inset-right)) 6px max(12px,env(safe-area-inset-left))}.title .logo{margin:0}.title .logo .l1{font-size:clamp(56px,25vh,84px);-webkit-text-stroke:4px #21190e;text-shadow:0 4px 0 #684216}.title .logo .l2{font-size:clamp(26px,11vh,38px);margin-top:3px}.title .logo .l3{font-size:12px;margin-top:4px;letter-spacing:2px}.title .logo .logoLead{font-size:15px;margin-bottom:4px}.title .bestTag{font-size:12px;margin-top:4px;padding:2px 9px}.title .menu{padding:8px;gap:6px;border-radius:16px}.title .menuPrimary{gap:5px}.title .menuPrimary .btn{min-height:42px;font-size:18px;padding:3px 10px}.title .menuTools{gap:5px;padding-top:6px}.title .menuTools .btn{min-height:40px;font-size:13px;padding:2px 6px;border-width:3px;-webkit-text-stroke:2px #000}.title .menuTools .menuRewards{min-height:40px}.title .menuTools .glyphArt{width:18px;height:18px}.title .saveInfo{font-size:11px;line-height:1.2}.title .foot{font-size:9px;padding:0}}
@media(orientation:landscape) and (max-height:300px){.title .foot{display:none}.title .menuPrimary .btn{min-height:40px}.title .menuTools{gap:4px;padding-top:5px}}
.sw{display:inline-block;width:38px;height:38px;border-radius:50%;border:4px solid #000;cursor:pointer;transition:transform .1s}
.sw:hover{transform:scale(1.15)}
.sw.on{outline:4px solid #fff;outline-offset:1px}
.hairBtn{padding:6px 12px;border-radius:12px;border:4px solid #000;background:#2c2e3a;cursor:pointer;font-size:18px}
.hairBtn.on{background:#4ade6a}
.kv{display:flex;justify-content:space-between;gap:20px;font-size:20px;padding:4px 0;border-bottom:2px solid rgba(255,255,255,.08)}
.poster{position:relative;width:min(190px,42vw);padding:12px 10px 14px;border-radius:8px;background:#f1e6c8;color:#2a2018;border:4px solid #000;transform:rotate(var(--r,0deg));box-shadow:0 8px 0 rgba(0,0,0,.3);cursor:pointer;transition:transform .15s;-webkit-text-stroke:0;text-align:center}
.poster:hover{transform:rotate(0deg) scale(1.06)}
.poster .face{width:78px;height:78px;margin:0 auto 6px;border-radius:14px;border:4px solid #000;display:flex;align-items:center;justify-content:center;font-size:40px}
.poster .face img.glyphArt{width:100%;height:100%;object-fit:contain;margin:0}
.poster h3{margin:0 0 4px;font-size:22px;color:#2a2018}
.poster p{margin:2px 0;font-size:14px;font-weight:600;color:#4a3a2a}
.poster .st{margin-top:6px;padding:3px 8px;border-radius:9px;font-size:14px;color:#fff;border:3px solid #000}
.poster.done{filter:saturate(.7)}
.poster.track{outline:5px solid #ff3b3b;outline-offset:2px}
.slider{width:220px;accent-color:#4ade6a}
.hint{font-size:16px;opacity:.85;text-align:center;font-weight:600;max-width:520px;margin:6px auto}
.req{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:12px;background:rgba(0,0,0,.3);border:3px solid #000;font-size:18px}
.req img{width:34px;height:34px}
.req.ok{background:rgba(30,110,50,.5)}
.req .cnt{margin-left:auto}
.fuelbar{height:20px;border-radius:12px;background:rgba(0,0,0,.55);border:3px solid #000;overflow:hidden;position:relative}
.fuelbar i{position:absolute;inset:0 auto 0 0;background:linear-gradient(#ffb04a,#ff5a2a)}
.big{font-size:clamp(34px,7vh,64px);font-family:'Rubik',sans-serif;font-weight:900;text-align:center;line-height:1}
.sub{text-align:center;font-size:20px;opacity:.9;margin:6px 0 12px}
.stat{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;margin:10px 0 16px}
.stat div{min-width:96px;padding:8px 12px;border-radius:14px;background:rgba(0,0,0,.35);border:3px solid #000;text-align:center;font-size:15px}
.stat b{display:block;font-size:30px;font-family:'Rubik',sans-serif;font-weight:900}
.ctrl{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:19px;align-items:center}
.ctrl kbd{display:inline-block;min-width:34px;text-align:center;padding:2px 10px;border-radius:9px;background:#fff;color:#111;border:3px solid #000;font:inherit;-webkit-text-stroke:0}
`;
        document.head.appendChild(s);
    },

    init(ui) {
        this.ui = ui; this.host = ui.el.panels;
        this.css();
    },

    // ------------------------------------------------------------------------------ управление окнами
    open(name, data) {
        const samePanel = this.cur === name;
        const padFocus = samePanel && typeof PadNav !== 'undefined' ? PadNav.snapshot(this.overlay) : null;
        this.close(true, samePanel && name === 'shop');
        if (window.Quests && name !== 'title') Quests._hideTip();
        const build = this['build_' + name];
        if (!build) return;
        const o = document.createElement('div');
        o.className = 'overlay on'; o.id = 'ov_' + name;
        if (samePanel) o.classList.add('quick');
        if (name === 'title' || name === 'outfit' || name === 'shop') { o.style.background = 'none'; o.style.backdropFilter = 'none'; /** @type {any} */ (o.style).webkitBackdropFilter = 'none'; if (name === 'title') o.style.pointerEvents = 'none'; }
        const content = build.call(this, data || {}, o);
        if (content) o.appendChild(content);
        this.host.appendChild(o);
        this.cur = name; this.ui.modal = name; this.overlay = o;
        if (typeof Platform !== 'undefined' && Platform._syncGameplay) Platform._syncGameplay();
        // CrazyGames: экран результата без предложения награды — midgame (вместе с предложением награды нельзя)
        if ((name === 'death' || name === 'gameover' || name === 'ending') && !samePanel && !o.querySelector('[data-rewarded-offer]') && typeof Platform !== 'undefined' && Platform.ads && Platform.ads.result) Platform.ads.result(name);
        // открытие окна меню (кроме главного) — тоже место вызова interstitial в Playables
        if (name !== 'title' && this.ADS_PANELS.includes(name) && typeof Platform !== 'undefined' && Platform.ads && Platform.ads.tap) Platform.ads.tap(name);
        Input.unlock(); Input.releaseAll(); Input._pressed.clear();
        if (typeof PadNav !== 'undefined') { PadNav._ov = o; PadNav.clear(); if (padFocus) PadNav.restore(o, padFocus); }
        if (name !== 'title' && name !== 'death' && name !== 'ending') Sfx.ui('page');
        if (window.Lang) Lang.apply(o);
    },
    close(silent, preserveShop) {
        Input.cancelCapture();
        Input.releaseAll();
        if (this.overlay) { this.overlay.remove(); this.overlay = null; }
        const was = this.cur;
        this.cur = null; this.ui.modal = null;
        if (typeof Platform !== 'undefined' && Platform._syncGameplay) Platform._syncGameplay();
        if (!silent && Game.state === 'play' && !Player.dead) { Input.lock(); Input._pressed.clear(); }
        if (was === 'outfit') Game.outfitBack && Game.outfitBack();
        if (was === 'shop' && !preserveShop) {
            Player.applySkin(Econ.skin); this._shopSel = null; Game.outfitBack && Game.outfitBack();
            if (Game.state !== 'menu') { Cam.mode = 'follow'; Cam._cd = null; }
        }
    },

    el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; },
    // Окна вне игрового процесса: кнопки и открытие окна — места вызова interstitial в Playables (Platform.ads.tap).
    // Инвентарь, верстак, костёр, сундук, доска, карта и записка — часть игры: там рекламы нет.
    ADS_PANELS: ['title', 'pause', 'settings', 'controls', 'transfer', 'help', 'shop', 'outfit', 'rewards', 'journal', 'quests', 'newgame', 'confirmNew', 'death', 'gameover', 'ending', 'trade'],
    btn(text, cls, fn) {
        const b = this.el('button', 'btn ' + (cls || '')); Icons.btnLabel(b, text);
        b.onclick = (e) => { Sfx.ui('click'); const where = this.cur; fn(e); if (this.ADS_PANELS.includes(where) && typeof Platform !== 'undefined' && Platform.ads && Platform.ads.tap) Platform.ads.tap(where); };
        return b;
    },
    panel(title, close) {
        const p = this.el('div', 'panel');
        if (title) { const h = this.el('h2', 'rb'); Icons.label(h, title); p.appendChild(h); }
        if (close) { const c = this.el('div', 'rbtn close', UI.svg.x); c.onclick = () => { Sfx.ui('cancel'); this.close(); }; p.appendChild(c); }
        return p;
    },
    cost(list) {
        const d = this.el('div', 'cost');
        for (const [k, need, have] of list) {
            const ok = have >= need;
            const ic = { scrap: '🔩', log: '🪵', gem: '💎', pelt: '🐺', berry: '🫐', carrot: '🥕', engine: '⚙️', radio: '📻', ammo_rev: '🔫', bolt: '🔩', coal: '⬛', canister: '🛢️' }[k] || '';
            const s = this.el('span', ok ? 'ok' : 'no', ic + ' ' + need);
            d.appendChild(s);
        }
        return d;
    },

    // ------------------------------------------------------------------------------ титул
    build_title() {
        const t = this.el('div', 'title');
        const brand = this.el('div', 'titleBrand');
        const logo = this.el('div', 'logo');
        if (String(GAME_PLATFORM) === 'yandex' || String(GAME_PLATFORM) === 'playables' || String(GAME_PLATFORM) === 'playgama' || String(GAME_PLATFORM) === 'crazygames') {
            // Название задаёт сборка; сохраняем золотое число и порядок слов бренда.
            const [lead, tail = ''] = GAME_TITLE.split('99');
            const words = tail.trim().split(/\s+/);
            const line = (cls, text) => { const e = this.el('div', cls); e.textContent = text; logo.appendChild(e); };
            if (lead.trim()) line('logoLead rb2', lead.trim());
            line('l1 rb', '99');
            line('l2 rb', words.shift() || '');
            line('l3 rb2', words.join(' '));
        } else {
            logo.innerHTML = '<div class="l1 rb" data-t="99">99</div><div class="l2 rb">' + Lang.t('titleNights') + '</div><div class="l3 rb2">' + Lang.t('titleForest') + '</div>';
        }
        logo.setAttribute('role', 'img');
        logo.setAttribute('aria-label', GAME_TITLE);
        brand.appendChild(logo);
        if (Game.best > 0) brand.appendChild(this.el('div', 'bestTag rb2', Lang.t('best', { n: Game.best })));
        t.appendChild(brand);
        const menu = this.el('div', 'menu');
        const primary = this.el('div', 'menuPrimary');
        const extras = this.el('div', 'menuTools');
        const si = Game.hasSave ? Save.info : null;
        if (Game.hasSave) {
            primary.appendChild(this.btn(Lang.t('menu.continue'), '', () => Platform.ads.gate(() => Game.startGame(false), 'start')));
            if (si) primary.appendChild(this.el('div', 'saveInfo rb1', this.saveText(si)));
        } else if (Save.problem === 'corrupt' || Save.problem === 'newer') primary.appendChild(this.el('div', 'saveInfo bad rb1', Lang.t(Save.problem === 'newer' ? 'save.newer' : 'save.corrupt')));
        primary.appendChild(this.btn(Game.hasSave ? Lang.t('menu.new') : Lang.t('menu.play'), Game.hasSave ? 'gray' : '', () => {
            if (Game.hasSave) this.open('confirmNew'); else this.open('newgame');
        }));
        extras.appendChild(this.btn('🛒 ' + Lang.t('menu.shop'), 'blue', () => this.open('shop', { from: 'title' })));
        extras.appendChild(this.btn(Lang.t('menu.outfit'), 'blue', () => this.open('outfit')));
        extras.appendChild(this.btn(Lang.t('menu.help'), 'gray', () => this.open('help', { from: 'title' })));
        extras.appendChild(this.btn(Lang.t('menu.settings'), 'gray', () => this.open('settings', { from: 'title' })));
        menu.appendChild(primary); menu.appendChild(extras);
        t.appendChild(menu);
        t.appendChild(this.el('div', 'foot rb1', GAME_TITLE + ' · v' + GAME_VERSION));
        const wrap = this.el('div'); wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none';
        wrap.appendChild(t);
        wrap.style.pointerEvents = 'none';
        return wrap;
    },
    // «День 7 · ночь · костёр 3 · 5 мин назад»
    saveText(si) {
        const mins = Math.max(0, Math.round((Date.now() - (si.t || Date.now())) / 60000));
        const ago = mins < 1 ? Lang.t('save.now') : mins < 60 ? Lang.t('save.min', { n: mins }) : mins < 1440 ? Lang.t('save.hour', { n: Math.round(mins / 60) }) : Lang.t('save.days', { n: Math.round(mins / 1440) });
        return Lang.t('save.detail', { d: si.day || 1, n: si.night ? Lang.t('save.night') : '', l: si.lv || 1, a: ago });
    },
    build_confirmNew() {
        const p = this.panel(Lang.t('confirmNewT'), false);
        p.appendChild(this.el('div', 'hint', Lang.t('confirmNewS')));
        const r = this.el('div', 'row'); r.style.marginTop = '12px';
        r.appendChild(this.btn(Lang.t('yes'), 'red', () => this.open('newgame')));
        r.appendChild(this.btn(Lang.t('no'), 'gray', () => this.open('title')));
        p.appendChild(r);
        return p;
    },

    // ------------------------------------------------------------------------------ пауза
    build_pause() {
        const p = this.panel(Lang.t('pause.title'), false);
        const c = this.el('div', 'col'); c.style.width = 'min(340px,80vw)';
        c.appendChild(this.btn(Lang.t('pause.resume'), '', () => Platform.ads.gate(() => Game.resume(), 'resume')));
        c.appendChild(this.btn('💾 ' + Lang.t('save.btn'), 'blue', () => { if (Save.flush('manual', true)) UI.toast(Lang.t('save.saved'), 'good'); else UI.toast(Lang.t('save.writeFail'), 'warn'); }));
        c.appendChild(this.btn(Lang.t('menu.help'), 'blue', () => this.open('help', { from: 'pause' })));
        c.appendChild(this.btn(Lang.t('menu.settings'), 'gray', () => this.open('settings', { from: 'pause' })));
        c.appendChild(this.btn(Lang.t('pause.menu'), 'red', () => Platform.ads.pause(() => Game.toMenu(), 'menu')));
        p.appendChild(c);
        return p;
    },
    build_settings(d) {
        const p = this.panel(Lang.t('menu.settings'), true);
        const back = () => this.open(d.from === 'pause' ? 'pause' : 'title');
        p.querySelector('.close').onclick = () => { Sfx.ui('cancel'); back(); };
        const row = (label, ctrl) => { const r = this.el('div', 'kv'); r.appendChild(this.el('span', '', label)); r.appendChild(ctrl); p.appendChild(r); };
        const slider = (get, set) => { const s = this.el('input', 'slider'); s.type = 'range'; s.min = 0; s.max = 100; s.value = Math.round(get() * 100); s.oninput = () => set(s.value / 100); return s; };
        row(Lang.t('set.sfx'), slider(() => window.SOUND_VOLUME_USER != null ? window.SOUND_VOLUME_USER : 0.8, (v) => { window.SOUND_VOLUME_USER = v; Sound.masterK = v; Sound._sync(); Store.set(GAME_ID + '.vol', String(v)); }));
        row(Lang.t('set.music'), slider(() => Sound.musicK != null ? Sound.musicK : 1, (v) => { Sound.musicK = v; Sound._sync(); }));
        row(Lang.t('set.sens'), slider(() => Cam.sens / 2, (v) => { Cam.sens = Math.max(0.15, v * 2); Store.set(GAME_ID + '.sens', String(Cam.sens)); }));
        const snd = this.btn(Sound.muted ? Lang.t('set.soundOff') : Lang.t('set.soundOn'), 'gray sm', () => { Sound.toggleMuted(); snd.textContent = Sound.muted ? Lang.t('set.soundOff') : Lang.t('set.soundOn'); UI.el.btnSound.innerHTML = Sound.muted ? UI.svg.mute : UI.svg.sound; });
        row(Lang.t('set.sound'), snd);
        const fs = this.btn(Lang.t('set.fullscreen'), 'gray sm', () => { const e = document.documentElement; if (!document.fullscreenElement) e.requestFullscreen && e.requestFullscreen(); else document.exitFullscreen && document.exitFullscreen(); });
        row(Lang.t('set.screen'), fs);
        const q = this.btn(this.qLabel(), 'gray sm', () => { Game.quality = ((Game.quality || 1) % 3) + 1; Game.applyQuality(); q.textContent = this.qLabel(); });
        row(Lang.t('set.quality'), q);
        return p;
    },
    qLabel() { return Lang.t('set.q' + (Game.quality || 3)); },
    build_help(d) {
        const p = this.panel(Lang.t('menu.help'), true);
        p.querySelector('.close').onclick = () => { Sfx.ui('cancel'); this.open(d.from === 'pause' ? 'pause' : 'title'); };
        const g = this.el('div', 'ctrl');
        const rows = [['W A S D', 'help.move'], ['Shift', 'help.sprint'], ['Space', 'help.jump'], ['E', 'help.interact'], [Lang.t('help.mouseL'), 'help.attack'], ['1 – 9', 'help.slots'], ['Q', 'help.drop'], ['R', 'help.rotate'], ['M', 'help.board'], ['Esc', 'help.pause']];
        for (const [k, t] of rows) { g.appendChild(this.el('div', '', '<kbd>' + k + '</kbd>')); g.appendChild(this.el('div', 'rb1', Lang.t(t))); }
        p.appendChild(g);
        p.appendChild(this.el('div', 'hint', Lang.t('help.tips')));
        return p;
    },

    // ------------------------------------------------------------------------------ наряд
    build_outfit() {
        Game.outfitEnter && Game.outfitEnter();
        const p = this.panel(Lang.t('menu.outfit'), true);
        p.style.position = 'absolute'; p.style.left = 'max(3vw,12px)'; p.style.top = '50%'; p.style.transform = 'translateY(-50%)'; p.style.animation = 'none';
        p.querySelector('.close').onclick = () => { Sfx.ui('cancel'); this.open('title'); };
        const o = Player.outfit;
        const hairs = [['Hair_bacon', 'outfit.h1'], ['Hair_pony', 'outfit.h2'], ['Hair_short', 'outfit.h3'], ['Hair_bob', 'outfit.h4'], ['Hair_spiky', 'outfit.h5']];
        const hr = this.el('div', 'row'); hr.style.marginBottom = '10px';
        hairs.forEach(([id, key]) => { const b = this.el('div', 'hairBtn rb1' + (o.hair === id ? ' on' : ''), Lang.t(key)); b.onclick = () => { Player.setOutfit({ hair: id }); Sfx.ui('select'); this.open('outfit'); }; hr.appendChild(b); });
        p.appendChild(hr);
        const swatches = (label, key, colors) => {
            p.appendChild(this.el('div', 'hint', Lang.t(label)));
            const r = this.el('div', 'row'); r.style.gap = '8px';
            for (const c of colors) { const s = this.el('div', 'sw' + (o[key] === c ? ' on' : '')); s.style.background = c; s.onclick = () => { Player.setOutfit({ [key]: c }); Sfx.ui('select'); r.querySelectorAll('.sw').forEach(x => x.classList.remove('on')); s.classList.add('on'); }; r.appendChild(s); }
            p.appendChild(r);
        };
        swatches('outfit.hairC', 'hairColor', ['#e2792b', '#2b1c14', '#f2d16a', '#ff5da8', '#8a5cff', '#3aa0ff', '#d8d8dc', '#c0392b']);
        swatches('outfit.shirt', 'shirt', ['#3d78d8', '#e8e8ea', '#e0483a', '#3aa860', '#f5c542', '#8a5cff', '#ff8fc8', '#1c1c22']);
        swatches('outfit.jacket', 'jacket', ['#3f6248', '#2a2d34', '#7a3a24', '#b02a2a', '#3a4a8a', '#c8c8d0', '#5a2a6a', '#d0902a']);
        swatches('outfit.pants', 'pants', ['#4d4f5c', '#363a44', '#2a3f6a', '#5a4630', '#1c1c22', '#4a5a3a', '#7a2a2a', '#8a8a92', '#3a2a5a']);
        swatches('outfit.skin', 'skin', ['#f2c9a0', '#e0ac82', '#c68b60', '#8d5a3a', '#f7dcc0', '#5a3a26', '#ffd9c8', '#a6d8a0']);
        p.appendChild(this.el('div', 'sub'));
        p.appendChild(this.btn(Lang.t('ok'), '', () => this.open('title')));
        return p;
    },

    // ------------------------------------------------------------------------------ верстак
    build_craft() {
        const p = this.panel(Lang.t('craft.title'), true);
        p.style.width = 'min(880px,96vw)';
        const head = this.el('div', 'row'); head.style.marginBottom = '10px';
        head.appendChild(this.el('div', 'req', '🔩 <span class="rb1">' + Lang.t('scrapHave', { n: Camp.scrap }) + '</span>'));
        head.appendChild(this.el('div', 'req', UI.svg.sack + '<span class="rb1">' + DATA.packs[Inv.tier].name[Lang.code === 'en' ? 1 : 0] + ' · ' + Lang.t('pack.slots', { n: Inv.cap }) + '</span>'));
        p.appendChild(head);
        const grid = this.el('div', 'grid'); grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(min(330px,100%),1fr))';
        for (const r of DATA.recipes) {
            if (r.upgrade === 'sack' && r.to <= Inv.tier) continue;
            if (r.upgrade === 'sack' && r.to > Inv.tier + 1) continue;
            const card = this.el('div', 'card');
            const id = r.id;
            const icon = r.upgrade ? '<img src="assets/icons/sack.webp" onerror="this.replaceWith(UI.fallbackIcon(\'sack\'))">' : UI.icon(id);
            card.innerHTML = icon;
            const mid = this.el('div'); mid.style.flex = '1';
            mid.appendChild(this.el('div', 'nm rb2', Lang.t('item.' + id) + (r.count > 1 ? ' ×' + r.count : '')));
            mid.appendChild(this.el('div', 'ds', Lang.t('itemd.' + id)));
            const have = (k) => k === 'scrap' ? Camp.scrap : Inv.count(k);
            const list = Object.entries(r.cost).map(([k, n]) => [k, n, have(k)]);
            mid.appendChild(this.cost(list));
            card.appendChild(mid);
            const can = list.every(([k, n, h]) => h >= n) && Camp.level >= (r.need || 0);
            const b = this.btn(Lang.t('craft.do'), 'sm' + (can ? '' : ' dis'), () => { if (this.craft(r)) this.open('craft'); });
            card.appendChild(b);
            grid.appendChild(card);
        }
        p.appendChild(grid);
        return p;
    },
    craft(r) {
        for (const [k, n] of Object.entries(r.cost)) if ((k === 'scrap' ? Camp.scrap : Inv.count(k)) < n) { UI.toast(Lang.t('needMore'), 'warn'); return false; }
        if (r.upgrade === 'sack') { Inv.upgrade(r.to); }
        else if (Inv.canAdd(r.id, r.count || 1) < (r.count || 1) && !Inv.canAdd(r.id, 1)) { UI.toast(Lang.t('bagFull'), 'warn'); return false; }
        for (const [k, n] of Object.entries(r.cost)) { if (k === 'scrap') Camp.spendScrap(n); else Inv.take(k, n); }
        if (r.upgrade !== 'sack') {
            const left = Inv.add(r.id, r.count || 1);
            if (left > 0) Items.spawn(r.id, left, Camp.props.bench.x + 80, Camp.props.bench.z + 60, { y: Camp.y + 140 });
        }
        Sfx.at('clang', Camp.props.bench.x, 0, Camp.props.bench.z, 1); Sfx.ui('gem');
        const h = Camp.props.bench.node('hammer');
        if (h) Tween.to(0.5, (k) => { h.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, -Math.sin(k * Math.PI * 4) * 0.9 * (1 - k)); }, { ease: (k) => k });
        FX.sparkBurst(Camp.props.bench.x, Camp.y + 120, Camp.props.bench.z, 26, '#ffd070');
        UI.toast(Lang.t('crafted', { n: Lang.t('item.' + r.id) }), 'good');
        UI.objectiveEvent('craft'); Quests.event('craft:' + r.id, 1);
        Game.autosave('craft');
        if (!Inv.current()) Player.equipCurrent();
        return true;
    },

    // ------------------------------------------------------------------------------ костёр
    build_fire() {
        const p = this.panel(Lang.t('fire.title', { n: Camp.level }), true);
        p.style.width = 'min(560px,94vw)';
        const fb = this.el('div', 'fuelbar'); fb.innerHTML = '<i style="width:' + Math.round(Camp.fuelFrac() * 100) + '%"></i>';
        p.appendChild(fb);
        p.appendChild(this.el('div', 'sub rb1', Lang.t('fire.fuel', { a: Math.round(Camp.fuel), b: Camp.cap })));
        const next = DATA.fire[Camp.level + 1];
        if (!next) { p.appendChild(this.el('div', 'hint rb1', Lang.t('fire.max'))); return p; }
        p.appendChild(this.el('div', 'hint rb1', Lang.t('fire.next', { n: Camp.level + 1, m: Math.round(next.fog) })));
        const reqs = this.el('div', 'col'); reqs.style.margin = '10px 0';
        const c = next.cost;
        const add = (id, need, have, icon) => { const r = this.el('div', 'req' + (have >= need ? ' ok' : '')); r.innerHTML = (icon || '') + '<span class="rb1">' + (id === 'scrap' ? Lang.t('scrapName') : Lang.t('item.' + id)) + '</span><span class="cnt rb1">' + have + ' / ' + need + '</span>'; reqs.appendChild(r); };
        if (c.log) add('log', c.log, Inv.count('log'), UI.icon('log'));
        if (c.scrap) add('scrap', c.scrap, Camp.scrap, '<span style="font-size:28px">🔩</span>');
        if (c.gem) add('gem', c.gem, Inv.count('gem'), UI.icon('gem'));
        p.appendChild(reqs);
        const b = this.btn(Lang.t('fire.up'), Camp.canUpgrade() ? '' : 'dis', () => { if (Camp.upgrade()) this.close(); });
        b.style.width = '100%';
        p.appendChild(b);
        return p;
    },

    // ------------------------------------------------------------------------------ доска пропавших
    build_board() {
        const p = this.panel(Lang.t('board.title'), true);
        p.style.width = 'min(860px,96vw)';
        p.appendChild(this.el('div', 'hint rb1', Lang.t('board.hint')));
        const row = this.el('div', 'row'); row.style.margin = '14px 0'; row.style.gap = '16px';
        DATA.kids.forEach((k, i) => {
            const kid = Zones.kids.find(x => x.def.id === k.id);
            const done = kid && kid.rescued;
            const locked = Camp.level < k.fire;
            const po = this.el('div', 'poster' + (done ? ' done' : '') + (Game.waypointKid === k.id ? ' track' : ''));
            po.style.setProperty('--r', ((i - 1.5) * 2.4) + 'deg');
            const face = this.el('div', 'face', Icons.glyph({ dino: '🦖', kraken: '🐙', squid: '🦑', koala: '🐨' }[k.id] || '🧒'));
            face.style.background = k.color; po.appendChild(face);
            po.appendChild(this.el('h3', '', Lang.t('kid.' + k.id)));
            po.appendChild(this.el('p', '', Lang.t('kidhint.' + k.id)));
            po.appendChild(this.el('p', '', Lang.t('kidNeed', { k: Lang.t('item.' + k.key), f: k.fire })));
            const st = this.el('div', 'st', done ? Lang.t('kidState.done') : (locked ? Lang.t('kidState.locked', { f: k.fire }) : Lang.t('kidState.missing')));
            st.style.background = done ? '#22a446' : (locked ? '#7a4a2a' : '#c0392b'); po.appendChild(st);
            po.onclick = () => {
                if (done) return;
                Sfx.ui('select');
                Game.waypointKid = Game.waypointKid === k.id ? null : k.id;
                this.updateWaypoint();
                this.open('board');
            };
            row.appendChild(po);
        });
        p.appendChild(row);
        const stats = this.el('div', 'stat');
        stats.innerHTML = '<div><b>' + Sky.day + '</b>' + Lang.t('st.day') + '</div><div><b>' + Zones.rescuedCount() + '/4</b>' + Lang.t('st.kids') + '</div><div><b>' + (Player.stats.kills || 0) + '</b>' + Lang.t('st.kills') + '</div><div><b>' + (Player.stats.chests || 0) + '</b>' + Lang.t('st.chests') + '</div>';
        p.appendChild(stats);
        if (Game.waypointKid) p.appendChild(this.btn(Lang.t('board.clear'), 'gray sm', () => { Game.waypointKid = null; this.updateWaypoint(); this.open('board'); }));
        return p;
    },
    updateWaypoint() {
        const id = Game.waypointKid;
        if (!id) { UI.setWaypoint(null); return; }
        const kid = Zones.kids.find(k => k.def.id === id);
        if (!kid) { UI.setWaypoint(null); return; }
        UI.setWaypoint({ x: kid.x, y: World.heightAt(kid.x, kid.z) + 320, z: kid.z });
    },

    // ------------------------------------------------------------------------------ смерть / финал
    build_death(d) {
        const p = this.panel(null, false);
        p.appendChild(this.el('div', 'big rb', Lang.t('death.title')));
        p.appendChild(this.el('div', 'sub rb1', Lang.t('death.' + (d.kind || 'x'))));
        const s = this.el('div', 'stat');
        s.innerHTML = '<div><b>' + Math.max(0, d.day - 1) + '</b>' + Lang.t('st.nights') + '</div><div><b>' + (d.stats.kills || 0) + '</b>' + Lang.t('st.kills') + '</div><div><b>' + Zones.rescuedCount() + '/4</b>' + Lang.t('st.kids') + '</div><div><b>' + d.best + '</b>' + Lang.t('st.best') + '</div>';
        p.appendChild(s);
        const r = this.el('div', 'row');
        r.appendChild(this.btn(Lang.t('death.retry'), '', () => Game.retry()));
        r.appendChild(this.btn(Lang.t('pause.menu'), 'gray', () => { UIPanels.close(true); Player.dead = false; Game.enterMenu(); }));
        p.appendChild(r);
        return p;
    },
    build_ending(d) {
        const p = this.panel(null, false);
        p.style.width = 'min(640px,94vw)';
        p.appendChild(this.el('div', 'big rb', Lang.t(d.survived === false ? 'end.failT' : d.good ? 'end.goodT' : 'end.badT')));
        p.appendChild(this.el('div', 'sub rb1', Lang.t(d.survived === false ? 'end.failS' : d.good ? 'end.goodS' : 'end.badS', { k: d.kids })));
        const s = this.el('div', 'stat');
        s.innerHTML = '<div><b>' + (d.nights == null ? 99 : d.nights) + '</b>' + Lang.t('st.nights') + '</div><div><b>' + d.kids + '/4</b>' + Lang.t('st.kids') + '</div><div><b>' + (d.stats.kills || 0) + '</b>' + Lang.t('st.kills') + '</div>';
        p.appendChild(s);
        const r = this.el('div', 'row');
        r.appendChild(this.btn(Lang.t('end.again'), '', () => Game.retry()));
        r.appendChild(this.btn(Lang.t('pause.menu'), 'gray', () => Game.nextResult(() => { UIPanels.close(true); Game.enterMenu(); })));
        p.appendChild(r);
        return p;
    },
};

// HudLayout.js — адаптивная раскладка HUD под любой размер и соотношение сторон: ПК, планшеты, телефон в портрете
// и в альбомной ориентации, маленький iframe платформы (например, Яндекс Игры с рекламной колонкой справа).
// Раскладка считается в JS по размеру окна, safe-area и содержимому (число кнопок, ботов, видимость босса/события)
// и передаётся в CSS переменными на #ui: поэтому элементы, созданные позже (карточка записки, подсказка, отряд), сразу
// встают на место. Блоки не пересекаются: колонки слева/справа, центр сверху, хотбар между джойстиком и кнопками.
// Режимы: wide — ПК и альбомные планшеты; land — невысокое альбомное окно (телефон, iframe); port — портрет.

/** @satisfies {Record<string, any>} */
const HudLayout = {
    mode: '', k: 1, touch: false,
    promptY: 0,                       // нижний край подсказки «E» (px от верха окна)
    // свободная зона для меток мира (стрелка цели, метка костра); colL/colLB, colR/colRB — край и низ боковых колонок
    bounds: { top: 0, bottom: 0, left: 0, right: 0, colL: 0, colLB: 0, colR: 0, colRB: 0 },
    _inited: false, _t: 0, _vars: /** @type {Record<string, string>} */ ({}), _probe: /** @type {HTMLElement | null} */ (null),

    // Размеры при k = 1 и минимумы (касание пальцем на телефоне — не мельче MIN)
    BASE: {
        wide: { m: 14, gap: 10, btn: 46, mm: 120, heart: 30, barW: 260, barH: 30, slot: 64, stick: 140, atk: 96, jump: 74, act: 74, spr: 60, drop: 54, fire: 66, objFs: 30, coinFs: 22, row: 26 },
        land: { m: 10, gap: 8, btn: 42, mm: 104, heart: 24, barW: 172, barH: 26, slot: 54, stick: 136, atk: 90, jump: 68, act: 70, spr: 56, drop: 48, fire: 58, objFs: 22, coinFs: 20, row: 24 },
        port: { m: 10, gap: 8, btn: 42, mm: 96, heart: 24, barW: 152, barH: 24, slot: 54, stick: 128, atk: 84, jump: 64, act: 66, spr: 54, drop: 46, fire: 56, objFs: 22, coinFs: 19, row: 23 },
    },
    MIN: { m: 6, gap: 5, btn: 30, mm: 62, heart: 15, barW: 100, barH: 16, slot: 34, stick: 96, atk: 60, jump: 46, act: 50, spr: 40, drop: 36, fire: 42, objFs: 14, coinFs: 14, row: 18 },

    init() {
        if (this._inited || !UI.root) return;
        this._inited = true;
        this.css();
        UI.root.classList.add('hl');
        const on = () => { this.letterbox(); this.apply(); };
        this.letterbox();
        window.addEventListener('resize', on);
        window.addEventListener('orientationchange', () => { on(); setTimeout(on, 250); });
        if (window.visualViewport) window.visualViewport.addEventListener('resize', on);
        this.apply();
    },

    // Playgama на ПК: поле игры не шире 2:1 (чеклист Playgama) — на сверхшироком или низком окне по бокам поля.
    // body через transform становится контейнером fixed-слоёв (канвас, #ui, окна), а window.innerWidth — ширина поля:
    // HUD, метки и проекции считают в координатах поля без отдельных правок. Телефоны и другие сборки — как было.
    _lb: null,
    letterbox() {
        if (IS_MOBILE || String(GAME_PLATFORM) !== 'playgama') return;
        const doc = document.documentElement;
        const W = Math.max(1, doc.clientWidth), H = Math.max(1, doc.clientHeight);   // настоящее окно
        const on = W > 2 * H + 1, w = on ? Math.round(2 * H) : W;
        const lb = this._lb || (this._lb = { on: false, w: 0, desc: Object.getOwnPropertyDescriptor(window, 'innerWidth') });
        if (on === lb.on && (!on || w === lb.w)) return;
        lb.on = on; lb.w = w;
        if (on) {
            doc.style.setProperty('--lbw', w + 'px');
            doc.style.setProperty('--lbx', Math.round((W - w) / 2) + 'px');
            doc.classList.add('lb');
            Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => lb.w });
        } else {
            doc.classList.remove('lb');
            if (lb.desc) Object.defineProperty(window, 'innerWidth', lb.desc); else delete /** @type {any} */ (window).innerWidth;
        }
        if (typeof World3D !== 'undefined' && World3D.engine) World3D.resize();
    },

    // Содержимое HUD меняется (текст цели, отряд, босс) — пересчёт несколько раз в секунду, запись только изменений
    update(dt) {
        this._t -= dt;
        if (this._t > 0) return;
        this._t = 0.3;
        this.apply();
    },

    css() {
        const s = document.createElement('style');
        s.id = 'hudLayout';
        s.textContent = `
html.lb{background:#000}
html.lb body{position:fixed;top:0;bottom:0;left:var(--lbx);width:var(--lbw);height:auto;transform:translateZ(0);overflow:hidden}
#ui.hl #topBtns{top:var(--tb-y)!important;left:var(--tb-x)!important;display:grid!important;grid-template-columns:repeat(var(--tb-cols),var(--btn));gap:var(--tb-gap)!important;max-width:none!important;flex-wrap:nowrap!important}
#ui.hl #topBtns .rbtn{width:var(--btn)!important;height:var(--btn)!important;border-width:calc(var(--btn)*.065)}
#ui.hl #topBtns .rbtn svg{width:calc(var(--btn)*.52);height:calc(var(--btn)*.52)}
#ui.hl #giftDot,#ui.hl #noteDot{transform:scale(var(--dot-k));transform-origin:100% 0}
#ui.hl #hearts{top:var(--hr-y)!important;left:var(--hr-x)!important;gap:2px}
#ui.hl #hearts .h{width:var(--heart)!important;height:var(--heart)!important}
#ui.hl #hcTag{top:var(--hc-y)!important;left:var(--hc-x)!important;font-size:var(--hc-fs)!important;padding:1px 8px;border-width:2px}
#ui.hl #dayBox{top:var(--day-y)!important;left:var(--day-cx)!important;transform:translateX(-50%)!important}
#ui.hl #dayText{font-size:var(--day-fs)!important}
#ui.hl #dayArc{width:var(--day-arc)!important;height:var(--day-ah)!important;margin-top:calc(var(--day-ah)*.4)!important;border-width:2px}
#ui.hl #compass{top:var(--cp-y)!important;right:var(--cp-x)!important;width:var(--mm)!important;height:var(--mm)!important}
#ui.hl #coinBox{top:var(--coin-y)!important;right:var(--coin-x)!important;font-size:var(--coin-fs)!important;padding:2px calc(var(--coin-fs)*.6) 2px 4px;gap:calc(var(--coin-fs)*.3);border-width:2px}
#ui.hl #coinBox .ci{width:calc(var(--coin-fs)*1.35);height:calc(var(--coin-fs)*1.35);font-size:calc(var(--coin-fs)*.7);border-width:2px}
#ui.hl #evChip{top:var(--ev-y)!important;right:var(--ev-x)!important;max-width:var(--ev-w)!important;font-size:var(--ev-fs)!important;padding:2px 10px;border-width:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ui.hl #bars{top:var(--bars-y)!important;left:var(--bars-x)!important;transform:none!important;gap:var(--bars-gap)!important}
#ui.hl .bar{width:var(--barw)!important;height:var(--barh)!important;border-width:calc(var(--barh)*.1)}
#ui.hl .bar .ic{width:calc(var(--barh)*1.4);height:calc(var(--barh)*1.4);left:calc(var(--barh)*-.36);border-width:calc(var(--barh)*.1)}
#ui.hl .bar .ic svg{width:calc(var(--barh)*.84);height:calc(var(--barh)*.84)}
#ui.hl .bar .num{font-size:calc(var(--barh)*.52);right:calc(var(--barh)*.34)}
#ui.hl .bar i::after{top:calc(var(--barh)*.1);height:calc(var(--barh)*.2)}
#ui.hl #party{top:var(--pt-y)!important;left:var(--pt-l)!important;right:var(--pt-r)!important;flex-direction:var(--pt-dir)!important;gap:3px!important}
#ui.hl .bpRow{width:var(--pt-w)!important;font-size:var(--pt-fs)!important;padding:1px 7px 1px 5px!important;gap:5px!important;border-width:2px;min-height:var(--pt-row)}
#ui.hl.hl-ptN .bpRow .bpN{display:none!important}
#ui.hl:not(.hl-ptN) .bpRow .bpN{display:block!important}
#ui.hl .bpRow .bpBar{height:calc(var(--pt-row)*.32)}
#ui.hl #objBox{top:var(--obj-y)!important;left:50%!important;transform:translateX(-50%)!important;max-width:var(--obj-w)!important;gap:calc(var(--obj-fs)*.55)!important;padding:calc(var(--obj-fs)*.18) calc(var(--obj-fs)*.7) calc(var(--obj-fs)*.18) calc(var(--obj-fs)*.85)!important;border-width:2px!important}
#ui.hl #objText{font-size:var(--obj-fs)!important;line-height:1.08}
#ui.hl #objCount{font-size:calc(var(--obj-fs)*1.3)!important}
#ui.hl #objBox::before{left:calc(var(--obj-fs)*.3);width:calc(var(--obj-fs)*.22)}
#ui.hl #objDesc{top:var(--od-y)!important;left:50%!important;transform:translateX(-50%)!important;max-width:var(--od-w)!important;font-size:var(--od-fs)!important}
#ui.hl.hl-noDesc #objDesc{visibility:hidden!important}
#ui.hl #bossBar{top:var(--boss-y)!important;width:var(--boss-w)!important}
#ui.hl #bossBar .bn{font-size:calc(var(--obj-fs)*.8)}
#ui.hl #tipBox{top:var(--tip-y)!important;left:var(--tip-x)!important;width:var(--tip-w)!important;max-height:var(--tip-h)!important;overflow:auto;padding:calc(var(--tip-fs)*.6) calc(var(--tip-fs)*.75)}
#ui.hl #tipBox .tt{font-size:calc(var(--tip-fs)*1.18)!important}
#ui.hl #tipBox .tb{font-size:var(--tip-fs)!important}
#ui.hl #tipBox .tk{font-size:calc(var(--tip-fs)*.75)!important;margin-top:3px}
#ui.hl #tipBox .tt{padding-right:calc(var(--tip-fs)*2.2)}
#ui.hl #tipBox .tx{width:max(30px,calc(var(--tip-fs)*2.1));height:max(30px,calc(var(--tip-fs)*2.1))}
#ui.hl.hl-touch #tipBox .tk{display:none}
#ui.hl #hotbar{left:var(--hb-cx)!important;bottom:var(--hb-b)!important;top:auto!important;transform:translateX(-50%)!important;gap:var(--hb-gap)!important;width:auto!important;max-width:none!important}
#ui.hl .slot{width:var(--slot)!important;height:var(--slot)!important;border-radius:calc(var(--slot)*.2)!important;border-width:calc(var(--slot)*.045)!important}
#ui.hl .slot.sel{transform:translateY(calc(var(--slot)*-.12)) scale(1.08)}
#ui.hl .slot .k{display:var(--slot-k)!important;font-size:calc(var(--slot)*.2)}
#ui.hl .slot .n{font-size:calc(var(--slot)*.26)!important;right:3px}
#ui.hl .slot .lv{font-size:calc(var(--slot)*.22)!important}
#ui.hl #sackChip{height:calc(var(--slot)*.8)!important;min-width:0!important;padding:0 calc(var(--slot)*.14)!important;font-size:calc(var(--slot)*.27)!important;margin-right:2px!important;border-width:calc(var(--slot)*.045)!important;gap:3px!important}
#ui.hl #sackChip svg{width:calc(var(--slot)*.38);height:calc(var(--slot)*.38)}
#ui.hl #itemName{left:var(--hb-cx)!important;bottom:var(--in-b)!important;top:auto!important;font-size:var(--in-fs)!important}
#ui.hl #lockHint{bottom:var(--in-b)!important}
#ui.hl #feed{left:var(--fd-l)!important;right:var(--fd-r)!important;bottom:var(--fd-b)!important;align-items:var(--fd-al)!important;gap:4px}
#ui.hl .feedItem{font-size:var(--fd-fs);padding:2px 10px 2px 4px;border-width:2px}
#ui.hl .feedItem img{width:calc(var(--fd-fs)*1.6);height:calc(var(--fd-fs)*1.6)}
#ui.hl.hl-fd1 #feed .feedItem:nth-last-child(n+2),#ui.hl.hl-fd2 #feed .feedItem:nth-last-child(n+3),#ui.hl.hl-fd3 #feed .feedItem:nth-last-child(n+4),#ui.hl.hl-fd5 #feed .feedItem:nth-last-child(n+6){display:none}
#ui.hl #prompt{font-size:var(--pr-fs);max-width:var(--pr-w);padding:calc(var(--pr-fs)*.3) calc(var(--pr-fs)*.7) calc(var(--pr-fs)*.3) calc(var(--pr-fs)*.35);gap:calc(var(--pr-fs)*.45)}
#ui.hl #prompt>div:last-child{min-width:0}
#ui.hl #prompt .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ui.hl #prompt .sub{font-size:calc(var(--pr-fs)*.7);white-space:normal}
#ui.hl #prompt .key{min-width:calc(var(--pr-fs)*1.7);height:calc(var(--pr-fs)*1.7);font-size:var(--pr-fs);border-width:2px}
#ui.hl #toast{top:var(--toast-y)!important;font-size:var(--toast-fs)!important;max-width:var(--toast-w)!important}
#ui.hl #banner{top:var(--ban-y)!important}
#ui.hl #banner .t{font-size:var(--ban-fs)!important}
#ui.hl #banner .s{font-size:calc(var(--ban-fs)*.36)!important}
#ui.hl .noteCard{left:var(--nc-x)!important;top:var(--nc-t)!important;bottom:var(--nc-b)!important;max-width:var(--nc-w)!important;padding:6px 12px 6px 6px}
#ui.hl.hl-land .noteCard .nci{flex-basis:40px;height:40px;font-size:24px}#ui.hl.hl-land .noteCard .ncn{font-size:17px}#ui.hl.hl-land .noteCard .nch{display:none}
#ui.hl #stickBase{left:var(--st-x)!important;bottom:var(--st-b)!important;width:var(--stick)!important;height:var(--stick)!important}
#ui.hl #stickKnob{width:calc(var(--stick)*.46);height:calc(var(--stick)*.46);margin:calc(var(--stick)*-.23) 0 0 calc(var(--stick)*-.23)}
#ui.hl .tbtn{left:auto!important;top:auto!important}
#ui.hl .tbtn svg{width:46%;height:46%}
#ui.hl #tbAttack{right:var(--atk-r)!important;bottom:var(--atk-b)!important;width:var(--atk)!important;height:var(--atk)!important}
#ui.hl #tbJump{right:var(--jump-r)!important;bottom:var(--jump-b)!important;width:var(--jump)!important;height:var(--jump)!important}
#ui.hl #tbInteract{right:var(--act-r)!important;bottom:var(--act-b)!important;width:var(--act)!important;height:var(--act)!important}
#ui.hl #tbSprint{right:var(--spr-r)!important;bottom:var(--spr-b)!important;width:var(--spr)!important;height:var(--spr)!important}
#ui.hl #tbDrop{right:var(--drop-r)!important;bottom:var(--drop-b)!important;width:var(--drop)!important;height:var(--drop)!important;font-size:calc(var(--drop)*.3)!important}
#ui.hl #tbUpFire{right:var(--fire-r)!important;bottom:var(--fire-b)!important;width:var(--fire)!important;height:var(--fire)!important;font-size:calc(var(--fire)*.45)!important}
`;
        document.head.appendChild(s);
    },

    // safe-area (вырез, жесты) — через пробный элемент: env() читается только из CSS
    insets() {
        let p = this._probe;
        if (!p) {
            p = this._probe = document.createElement('div');
            p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
            document.body.appendChild(p);
        }
        const cs = getComputedStyle(p);
        return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    },

    // Видимый блок (display и не прозрачен целиком)
    _shown(el) { return !!(el && el.isConnected && el.offsetParent !== null && getComputedStyle(el).display !== 'none'); },

    // Наибольшая симметричная ширина вокруг cx в полосе [y0, y1], не задевая прямоугольники rs
    _freeWidth(cx, y0, y1, rs, W, pad) {
        let l = pad, r = W - pad;
        for (const q of rs) {
            if (!q || q.b <= y0 || q.t >= y1) continue;
            if (q.r <= cx) l = Math.max(l, q.r + pad); else if (q.l >= cx) r = Math.min(r, q.l - pad);
            else return 0;
        }
        return Math.max(0, 2 * Math.min(cx - l, r - cx));
    },

    apply() {
        const root = UI.root, el = UI.el;
        if (!root || !el.hud) return;
        const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight), S = this.insets();
        const touch = !!(el.touch && el.touch.classList.contains('on'));
        const land = W > H;
        const mode = land ? (H <= 540 || W <= 820 ? 'land' : 'wide') : 'port';
        const k = mode === 'wide' ? U.clamp(Math.min(W / 1366, H / 768), 0.86, 1.2) : mode === 'land' ? U.clamp(H / 470, 0.62, 1) : U.clamp(Math.min(W / 430, H / 860), 0.7, 1.25);
        const B = this.BASE[mode], MIN = this.MIN;
        const z = (n) => Math.max(MIN[n] || 0, Math.round(B[n] * k));
        this.mode = mode; this.k = k; this.touch = touch;
        const m = z('m'), g = z('gap');
        const L = S.l + m, R = S.r + m, T = S.t + m, Bt = S.b + m;
        const V = /** @type {Record<string, string>} */ ({});
        const px = (v) => Math.round(v) + 'px';
        const rect = (l, t, w, h) => ({ l, t, r: l + w, b: t + h });
        const leftObs = [], rightObs = [];     // занятые прямоугольники колонок (для центра: цель, подсказка, босс)

        // ---------------------------------------------------------------- верхняя строка: кнопки, день, компас
        const mm = z('mm');
        let btn = z('btn');
        const nBtn = el.btnPause && el.btnPause.parentElement ? el.btnPause.parentElement.children.length : 7;
        const tg = Math.max(3, Math.round(g * 0.55));
        const dayFs = mode === 'wide' ? U.clamp(H * 0.042, 26, 44) * Math.min(1, k * 1.1) : Math.max(18, Math.round((mode === 'land' ? 32 : 30) * k));
        const dayArc = mode === 'wide' ? Math.min(200, W * 0.36) : Math.round((mode === 'land' ? 150 : 140) * k);
        const dayAh = Math.max(8, Math.round((mode === 'wide' ? 12 : 11) * Math.min(1, k + 0.15)));
        const dayW = Math.max(dayArc, (el.dayText && el.dayText.offsetWidth) || dayFs * 4.2);
        const dayH = Math.round(dayFs * 1.02 + dayAh * 1.4 + 4);
        const tbW = (c, b) => c * b + (c - 1) * tg;
        let cols = nBtn;
        // ПК/альбом: кнопки слева от «Дня»; портрет: «День» строкой ниже, кнопки делят ряд только с компасом
        const tbMax = mode === 'port' ? W - L - R - mm - g : W / 2 - dayW / 2 - g - L;
        if (tbW(cols, btn) > tbMax) {
            const fit = Math.floor((tbMax - (nBtn - 1) * tg) / nBtn);
            if (fit >= MIN.btn) btn = Math.min(btn, fit);
            else {
                cols = Math.ceil(nBtn / 2);
                if (tbW(cols, btn) > tbMax) btn = Math.max(26, Math.min(btn, Math.floor((tbMax - (cols - 1) * tg) / cols)));
            }
        }
        const tbRows = Math.ceil(nBtn / cols), tbH = tbRows * btn + (tbRows - 1) * tg;
        V['--tb-x'] = px(L); V['--tb-y'] = px(T); V['--tb-cols'] = String(cols); V['--tb-gap'] = px(tg); V['--btn'] = px(btn);
        V['--dot-k'] = String(U.clamp(btn / 46, 0.7, 1).toFixed(2));
        leftObs.push(rect(L, T, tbW(cols, btn), tbH));
        V['--mm'] = px(mm); V['--cp-x'] = px(R); V['--cp-y'] = px(T);
        rightObs.push(rect(W - R - mm, T, mm, mm));
        // «День»: по центру сверху (портрет — под кнопками, между сердцами и компасом)
        let dayY = mode === 'wide' ? T - 6 : T - 2;
        if (mode === 'port') dayY = T + tbH + Math.round(g * 0.6);
        V['--day-y'] = px(dayY); V['--day-cx'] = px(W / 2); V['--day-fs'] = px(dayFs); V['--day-arc'] = px(dayArc); V['--day-ah'] = px(dayAh);
        const dayBottom = dayY + dayH;

        // ---------------------------------------------------------------- левая колонка: сердца, хардкор, шкалы
        const heart = z('heart');
        let y = T + tbH + Math.round(g * 0.7);
        V['--hr-x'] = px(L); V['--hr-y'] = px(y); V['--heart'] = px(heart);
        const heartsW = 4 * (heart + 2);
        V['--hc-x'] = px(L + heartsW + 6); V['--hc-y'] = px(y + Math.max(0, (heart - 20 * Math.min(1, k + 0.2)) / 2)); V['--hc-fs'] = px(Math.max(11, Math.round(14 * Math.min(1, k + 0.15))));
        const hcOn = this._shown(document.getElementById('hcTag'));
        leftObs.push(rect(L, y, heartsW + (hcOn ? 110 * k : 0), heart));
        y += heart + Math.round(g * 0.8);
        if (mode === 'port') y = Math.max(y, dayBottom + Math.round(g * 0.6));
        const barW = z('barW'), barH = z('barH'), barGap = Math.max(4, Math.round(barH * 0.45));
        const ic = Math.round(barH * 0.36);
        let barsY = y;
        const barsH = 3 * barH + 2 * barGap;
        if (mode === 'wide') barsY = Math.max(y + 8, Math.round(H * 0.5 - barsH * 0.1));
        V['--bars-x'] = px(L + ic); V['--bars-y'] = px(barsY); V['--barw'] = px(barW); V['--barh'] = px(barH); V['--bars-gap'] = px(barGap);
        leftObs.push(rect(L, barsY - barH * 0.2, barW + ic, barsH + barH * 0.4));
        const leftBottom = barsY + barsH + Math.round(barH * 0.2);   // включая шкалу бега: она появляется при беге

        // ---------------------------------------------------------------- хотбар и тач-управление
        let slot = z('slot');
        const stick = touch ? z('stick') : 0;
        const atk = z('atk'), jump = z('jump'), act = z('act'), spr = z('spr'), drop = z('drop'), fire = z('fire');
        const cg = Math.max(5, Math.round(g * 0.8));
        // кнопки: 1-я колонка (у края) — удар и «взять», 2-я — прыжок, бег и костёр; «выбросить» — у хотбара
        // в невысоком альбоме (действует на выбранный слот) или над «взять» в остальных режимах
        const dropAtHb = touch && mode === 'land';
        const clusterW = touch ? atk + cg + jump : 0;
        const col1H = atk + cg + act + (dropAtHb ? 0 : cg + drop), col2H = jump + cg + spr + cg + fire;
        const clusterH = touch ? Math.max(col1H, col2H) : 0;
        // ширина хотбара: мешок + 6 слотов; после первой раскладки — по факту (шрифт, число в мешке)
        const curSlot = parseFloat(this._vars['--slot']) || 0, realW = el.hotbar ? el.hotbar.offsetWidth : 0;
        const hbW = (s) => Math.max(Math.round(s * 1.3) + 6 * s + 6 * Math.max(3, Math.round(s * 0.08)), curSlot && realW ? Math.round(realW * s / curSlot) : 0);
        const extra = dropAtHb ? drop + g : 0;
        // по бокам от хотбара в альбоме — джойстик и кнопки; в портрете они над хотбаром
        let lo = L, hi = W - R;
        if (touch && mode !== 'port') { lo = L + stick + g; hi = W - R - clusterW - g; }
        const fit = (s0, min) => { let s1 = s0; while (s1 > min && hbW(s1) + extra > hi - lo) s1--; return s1; };
        slot = fit(slot, 30);
        let hbBottom = Bt, raised = false;
        // не влез между джойстиком и кнопками (очень узкое альбомное окно) — над ними, во всю ширину
        if (hbW(slot) + extra > hi - lo && touch && mode !== 'port') { raised = true; lo = L; hi = W - R; hbBottom = Bt + Math.max(stick, clusterH) + g; slot = fit(z('slot'), 30); }
        if (hbW(slot) + extra > hi - lo) slot = fit(slot, 24);
        const hbGap = Math.max(3, Math.round(slot * 0.08));
        const wHb = hbW(slot), wG = wHb + extra;
        let gCx = W / 2;
        if (gCx - wG / 2 < lo || gCx + wG / 2 > hi) gCx = (lo + hi) / 2;
        const hbLeft = gCx - wG / 2, hbCx = hbLeft + wHb / 2;
        V['--hb-cx'] = px(hbCx); V['--hb-b'] = px(hbBottom); V['--hb-gap'] = px(hbGap); V['--slot'] = px(slot);
        V['--slot-k'] = touch || slot < 44 ? 'none' : 'block';
        const hbTop = H - hbBottom - slot - Math.round(slot * 0.15);
        // над хотбаром: имя предмета
        const inFs = U.clamp(Math.round(slot * 0.32), 13, 20);
        V['--in-b'] = px(hbBottom + slot + Math.round(slot * 0.16) + 2); V['--in-fs'] = px(inFs);
        // джойстик и кнопки: в портрете поднимаются над хотбаром и подписью предмета
        const padB = mode === 'port' ? hbBottom + slot + inFs + 14 : Bt;
        V['--stick'] = px(stick || z('stick')); V['--st-x'] = px(L + 2); V['--st-b'] = px(padB);
        const stickTop = H - padB - stick;
        V['--atk'] = px(atk); V['--atk-r'] = px(R); V['--atk-b'] = px(padB);
        V['--act'] = px(act); V['--act-r'] = px(R + (atk - act) / 2); V['--act-b'] = px(padB + atk + cg);
        V['--jump'] = px(jump); V['--jump-r'] = px(R + atk + cg); V['--jump-b'] = px(padB);
        V['--spr'] = px(spr); V['--spr-r'] = px(R + atk + cg + (jump - spr) / 2); V['--spr-b'] = px(padB + jump + cg);
        V['--fire'] = px(fire); V['--fire-r'] = px(R + atk + cg + (jump - fire) / 2); V['--fire-b'] = px(padB + jump + cg + spr + cg);
        V['--drop'] = px(drop);
        if (dropAtHb) { V['--drop-r'] = px(W - hbLeft - wG); V['--drop-b'] = px(hbBottom + (slot - drop) / 2); }
        else { V['--drop-r'] = px(R + (atk - drop) / 2); V['--drop-b'] = px(padB + atk + cg + act + cg); }
        const clusterTop = touch ? H - padB - clusterH : H;
        const bottomTop = Math.min(hbTop, touch ? Math.min(stickTop, clusterTop) : hbTop);

        // ---------------------------------------------------------------- правая колонка: монеты, событие, отряд
        const coinFs = z('coinFs'), coinH = Math.round(coinFs * 1.35 + 8);
        const coinEl = el.coinBox, coinW = coinEl && coinEl.offsetWidth ? coinEl.offsetWidth : coinFs * 4;
        let coinY, coinX, rightTop;
        const coinLeftOf = mode === 'land' && W - R - mm - g - coinW > W / 2 + dayW / 2 + g;
        if (coinLeftOf) { coinX = R + mm + g; coinY = T + Math.max(0, (mm - coinH) / 2); rightTop = T + mm; }
        else { coinX = R; coinY = T + mm + Math.round(g * 0.6); rightTop = coinY + coinH; }
        V['--coin-x'] = px(coinX); V['--coin-y'] = px(coinY); V['--coin-fs'] = px(coinFs);
        rightObs.push(rect(W - coinX - coinW, coinY, coinW, coinH));
        const evEl = el.evChip, evOn = this._shown(evEl);
        const evFs = Math.max(12, Math.round(16 * Math.min(1, k + 0.1)));
        V['--ev-fs'] = px(evFs); V['--ev-x'] = px(coinX); V['--ev-y'] = px(coinY + coinH + 4);
        V['--ev-w'] = px(Math.max(120, Math.min(260, (coinLeftOf ? W - coinX - W / 2 - 20 : W * 0.46))));
        if (evOn) { const ew = evEl.offsetWidth || 120; rightObs.push(rect(W - coinX - ew, coinY + coinH + 4, ew, evFs + 10)); rightTop = Math.max(rightTop, coinY + coinH + 4 + evFs + 10); }

        // ---------------------------------------------------------------- отряд ботов: справа, слева или строкой сверху
        const party = window.Bots && Bots.party, pRows = party && party.style.display !== 'none' ? party.children.length : 0;
        const rowH = z('row'), ptW = mode === 'wide' ? 180 : Math.round(Math.max(96, 150 * k));
        const ptH = pRows ? pRows * (rowH + 3) : 0;
        let ptPlace = 'right', ptY = rightTop + Math.round(g * 0.7);
        const rightLimit = touch ? clusterTop : (mode === 'wide' ? H - Bt - slot - 150 : hbTop);
        if (pRows && ptY + ptH + g > rightLimit) {
            const ly = leftBottom + g;
            if (ly + ptH + g <= (touch ? stickTop : hbTop)) { ptPlace = 'left'; ptY = ly; }
            else ptPlace = 'top';
        }
        V['--pt-w'] = px(ptW); V['--pt-row'] = px(rowH); V['--pt-fs'] = px(Math.max(11, Math.round(rowH * 0.58)));
        V['--pt-dir'] = ptPlace === 'top' ? 'row' : 'column';
        root.classList.toggle('hl-ptN', ptW < 150 || ptPlace === 'top');
        let leftEnd = leftBottom, rightEnd = rightTop;
        if (ptPlace === 'right') { V['--pt-r'] = px(R); V['--pt-l'] = 'auto'; V['--pt-y'] = px(ptY); if (pRows) { rightObs.push(rect(W - R - ptW, ptY, ptW, ptH)); rightEnd = ptY + ptH; } }
        else if (ptPlace === 'left') { V['--pt-l'] = px(L); V['--pt-r'] = 'auto'; V['--pt-y'] = px(ptY); if (pRows) { leftObs.push(rect(L, ptY, ptW, ptH)); leftEnd = ptY + ptH; } }

        // ---------------------------------------------------------------- центр: босс, цель, описание, подсказка
        // ПК и альбом — полоса между колонками сверху; портрет — под колонками (они занимают почти всю ширину)
        let cy = (mode === 'port' ? Math.max(dayBottom, leftEnd, rightEnd) : dayBottom) + Math.round(g * 0.6);
        const objFs = mode === 'wide' ? U.clamp(H * 0.036, 20, 38) * Math.min(1, k * 1.1) : z('objFs');
        if (ptPlace === 'top' && pRows) {
            const tw = pRows * (Math.round(ptW * 0.75) + 3);
            V['--pt-l'] = px(W / 2 - tw / 2); V['--pt-r'] = 'auto'; V['--pt-y'] = px(cy); V['--pt-w'] = px(Math.round(ptW * 0.75));
            cy += rowH + 6;
        }
        const bossOn = this._shown(document.getElementById('bossBar'));
        V['--boss-y'] = px(cy);
        V['--boss-w'] = px(Math.min(560, Math.max(160, this._freeWidth(W / 2, cy, cy + objFs * 1.6, leftObs.concat(rightObs), W, g))));
        if (bossOn) cy += Math.round(objFs * 0.8 + 26);
        const objOn = this._shown(el.objBox);
        const objH = objOn ? Math.max(el.objBox.offsetHeight || 0, Math.round(objFs * 1.5)) : 0;
        V['--obj-y'] = px(cy); V['--obj-fs'] = px(objFs);
        V['--obj-w'] = px(Math.max(150, Math.min(mode === 'wide' ? 760 : 520, this._freeWidth(W / 2, cy, cy + Math.max(objH, objFs * 1.5), leftObs.concat(rightObs), W, g))));
        let cBottom = objOn ? cy + objH : cy;
        const odFs = Math.max(12, Math.round((mode === 'wide' ? 18 : 15) * Math.min(1, k + 0.15)));
        const descOk = objOn && (mode === 'wide' || (mode === 'land' ? H >= 400 : H >= 660)) && !!(el.objDesc && el.objDesc.textContent);
        root.classList.toggle('hl-noDesc', !descOk);
        V['--od-y'] = px(cBottom + 4); V['--od-fs'] = px(odFs);
        V['--od-w'] = px(Math.max(150, Math.min(640, this._freeWidth(W / 2, cBottom + 4, cBottom + 4 + odFs * 2.6, leftObs.concat(rightObs), W, g))));
        if (descOk) cBottom += 4 + Math.max((el.objDesc && el.objDesc.offsetHeight) || 0, Math.round(odFs * 1.5));
        // подсказка «E»: над хотбаром (в портрете с тачем — над джойстиком и кнопками)
        const prFs = Math.max(14, Math.round((mode === 'wide' ? 20 : 18) * Math.min(1, k + 0.12)));
        V['--pr-fs'] = px(prFs);
        let prY;
        if (mode === 'port' && touch) prY = Math.min(stickTop, clusterTop) - 10;
        else prY = H - (hbBottom + slot + Math.round(slot * 0.16) + inFs + 12);
        this.promptY = Math.max(cBottom + prFs * 3, prY);
        const prEl = el.prompt, prH = prEl && prEl.style.display !== 'none' ? prEl.offsetHeight : 0;
        const promptTop = this.promptY - Math.max(Math.round(prFs * 3.6 + 6), prH);
        V['--pr-w'] = px(touch && mode !== 'port' ? Math.max(220, hi - lo) : Math.min(W - 2 * m, 560));
        // подсказка обучения: ПК — слева под сердцами, иначе — по центру под целью
        const tipFs = Math.max(12, Math.round((mode === 'wide' ? 17 : 15) * Math.min(1, k + 0.12)));
        let tipX, tipY, tipW;
        const tipEl = document.getElementById('tipBox'), tipNeed = tipEl && tipEl.classList.contains('show') ? tipEl.scrollHeight : 0;
        let tipLeft = mode === 'wide';
        if (tipLeft) {
            tipW = Math.min(330, W * 0.42); tipX = L;
            tipY = Math.max(T + tbH + heart + 2 * g, Math.round(H * 0.17));
            const half = Math.max(objOn ? el.objBox.offsetWidth || 0 : 0, descOk ? el.objDesc.offsetWidth || 0 : 0) / 2;
            if (tipY < cBottom + g && L + tipW > W / 2 - half) tipY = cBottom + g;
            // слева над шкалами не помещается целиком — по центру под целью, как на телефоне
            if (tipNeed > Math.min(barsY - g, bottomTop - g) - tipY) tipLeft = false;
        }
        if (!tipLeft) {
            tipY = cBottom + g;
            tipW = Math.min(mode === 'port' ? 520 : 380, Math.max(200, this._freeWidth(W / 2, tipY, tipY + 80, leftObs.concat(rightObs), W, g)));
            if (touch && mode === 'land') tipW = Math.min(tipW, Math.max(200, hi - lo));
            tipX = W / 2 - tipW / 2;
        }
        const tipBottomLimit = tipLeft ? Math.min(barsY - g, bottomTop - g) : promptTop - g;
        V['--tip-x'] = px(tipX); V['--tip-y'] = px(tipY); V['--tip-w'] = px(tipW); V['--tip-fs'] = px(tipFs);
        V['--tip-h'] = px(Math.max(tipFs * 4, tipBottomLimit - tipY));

        // ---------------------------------------------------------------- лента подбора, тосты, записка
        const fdFs = Math.max(12, Math.round(18 * Math.min(1, k + 0.12)));
        V['--fd-fs'] = px(fdFs);
        // лента подбора: справа над кнопками, если там есть место; иначе — над подсказкой «E»
        const fdRow = Math.round(fdFs * 1.7 + 8);
        let fdMax = 6;
        V['--fd-l'] = 'auto'; V['--fd-al'] = 'flex-end';
        if (mode === 'land' && touch) {
            const roomR = clusterTop - g - (rightEnd + g), roomL = stickTop - g - (leftEnd + g);
            if (roomR >= 2 * fdRow) { V['--fd-r'] = px(R); V['--fd-b'] = px(H - clusterTop + g); fdMax = Math.min(3, Math.floor(roomR / fdRow)); }
            else if (roomL >= 1.6 * fdRow) { V['--fd-l'] = px(L); V['--fd-r'] = 'auto'; V['--fd-al'] = 'flex-start'; V['--fd-b'] = px(H - stickTop + g); fdMax = U.clamp(Math.floor(roomL / fdRow), 1, 3); }
            else { V['--fd-r'] = px(R + clusterW + g); V['--fd-b'] = px(H - promptTop + 4); fdMax = 3; }
        } else if (touch) { V['--fd-r'] = px(R); V['--fd-b'] = px(mode === 'port' ? H - promptTop + 6 : padB + clusterH + g); fdMax = mode === 'port' ? 3 : 5; }
        else { V['--fd-r'] = px(R); V['--fd-b'] = px(hbBottom + slot + inFs + 30); }
        for (const n of [1, 2, 3, 5]) root.classList.toggle('hl-fd' + n, fdMax === n);
        V['--toast-y'] = px(Math.max(cBottom + g, Math.round(H * (mode === 'land' ? 0.2 : 0.24))));
        V['--toast-fs'] = px(Math.max(16, Math.round(U.clamp(H * 0.04, 22, 40) * Math.min(1, k + 0.2))));
        V['--toast-w'] = px(Math.min(W - 2 * m, 720));
        V['--ban-y'] = px(Math.round(H * (mode === 'land' ? 0.26 : 0.32)));
        V['--ban-fs'] = px(Math.round(U.clamp(H * 0.11, 40, 120)));
        // карточка «найдена записка»: в невысоком альбоме — по центру под целью (на месте подсказки обучения)
        V['--nc-t'] = 'auto';
        if (mode === 'port' || mode === 'land') { const w = mode === 'port' ? W - L - R : Math.min(360, Math.max(220, touch ? hi - lo : W * 0.5)); V['--nc-x'] = px(W / 2 - w / 2); V['--nc-t'] = px(cBottom + g); V['--nc-b'] = 'auto'; V['--nc-w'] = px(w); }
        else { V['--nc-x'] = px(L); V['--nc-b'] = px(touch ? padB + stick + g * 2 : Math.max(200, H - barsY + g)); V['--nc-w'] = px(360); }
        // колонки слева/справа: стрелка цели и метки мира их обходят
        const lr = Math.max(L, ...leftObs.map(q => q.r)), lb = Math.max(0, ...leftObs.map(q => q.b));
        const rl = Math.min(W - R, ...rightObs.map(q => q.l)), rb = Math.max(0, ...rightObs.map(q => q.b));
        this.bounds = { top: cBottom + 8, bottom: bottomTop - 8, left: L, right: W - R, colL: lr, colLB: lb, colR: rl, colRB: rb };
        if (raised) this.bounds.bottom = Math.min(this.bounds.bottom, hbTop - 8);

        // ---------------------------------------------------------------- запись: только изменившиеся переменные
        for (const key in V) {
            if (this._vars[key] === V[key]) continue;
            this._vars[key] = V[key];
            root.style.setProperty(key, V[key]);
        }
        for (const c of ['wide', 'land', 'port']) root.classList.toggle('hl-' + c, c === mode);
        root.classList.toggle('hl-touch', touch);
    },
};

// UI.js — интерфейс поверх канваса (DOM): худ (день, показатели, хотбар, цель, подсказка E, метки над
// костром, всплывающие числа, лента подбора), баннеры, вспышки урона, кнопки паузы/звука, тач-управление.
// Окна (верстак, костёр, доска, пауза, смерть, финал, меню) — UIPanels.js. Шрифт — Rubik (OFL, латиница и кириллица,
// 300–900); оформление «Лагерь» — UiFX.js.

const UI_FONTS = ['assets/fonts/rubik.ttf'];

/** @type {Record<string, any>} */
const UI = {
    root: null, el: {},
    modal: null, hudOn: false,
    _last: {},
    floats: [],
    feed: [],
    objective: { key: null, cur: 0, max: 0 },
    lastSel: -1, nameT: 0,
    iconCache: {},

    css() {
        const s = document.createElement('style');
        s.textContent = `
@font-face{font-family:'Rubik';src:url('assets/fonts/rubik.ttf') format('truetype');font-weight:300 900;font-display:swap}
#ui{position:fixed;inset:0;pointer-events:none;z-index:20;font-family:'Rubik',sans-serif;font-weight:700;color:#fff;user-select:none;-webkit-user-select:none;overflow:hidden}
#ui *{box-sizing:border-box}
.glyphArt{display:inline-block;width:1.2em;height:1.2em;object-fit:contain;vertical-align:middle;pointer-events:none;flex-shrink:0}
#topBtns .glyphArt{width:75%;height:75%}.rwCard .ic .glyphArt{width:90%;height:90%}
.rb{color:#fff;-webkit-text-stroke:4px #000;paint-order:stroke fill;text-shadow:0 3px 0 rgba(0,0,0,.35);letter-spacing:.4px}
.rb2{color:#fff;-webkit-text-stroke:3px #000;paint-order:stroke fill;letter-spacing:.3px}
.rb1{color:#fff;-webkit-text-stroke:2px #000;paint-order:stroke fill}
.ylw{color:#f2ff1a}
.hud{position:absolute;inset:0;transition:opacity .4s}
.hud.hidden{opacity:0;pointer-events:none}
/* День */
#dayBox{position:absolute;top:calc(8px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);text-align:center}
#dayText{font-family:'Rubik',sans-serif;font-weight:900;font-size:clamp(26px,4.2vh,44px);font-style:italic;line-height:1;transform:rotate(-2deg)}
#dayArc{position:relative;width:min(200px,36vw);height:12px;margin:6px auto 0;border-radius:8px;background:rgba(0,0,0,.55);border:3px solid #000;overflow:hidden}
#dayFill{position:absolute;inset:0 auto 0 0;width:0;background:linear-gradient(90deg,#ffb84a,#fff2a0 45%,#8aa4ff 75%,#3b4a90)}
#dayMark{position:absolute;top:-4px;width:6px;bottom:-4px;background:#fff;border:2px solid #000;border-radius:3px;transform:translateX(-50%)}
#objBox{position:absolute;top:calc(64px + 6vh);left:50%;transform:translateX(-50%);width:min(760px,92vw);display:flex;justify-content:center;align-items:center;gap:22px;text-align:center}
#objText{font-size:clamp(20px,3.6vh,38px);line-height:1.08}
#objCount{font-size:clamp(34px,7vh,72px);line-height:1}
#objBox.pop #objText,#objBox.pop #objCount{animation:pop .5s}
@keyframes pop{0%{transform:scale(1)}35%{transform:scale(1.22)}100%{transform:scale(1)}}
#objDesc{position:absolute;top:calc(64px + 6vh + clamp(40px,8vh,78px));left:50%;transform:translateX(-50%);width:min(620px,88vw);text-align:center;font-size:clamp(14px,2.3vh,20px);line-height:1.15;pointer-events:none;opacity:.95}
/* Сердца и монеты */
#evChip{position:absolute;top:calc(156px + env(safe-area-inset-top));right:calc(14px + env(safe-area-inset-right));padding:4px 12px;border-radius:16px;background:rgba(14,14,18,.72);border:3px solid #ffb040;font-size:16px;pointer-events:none;display:none}
#hearts{position:absolute;top:calc(66px + env(safe-area-inset-top));left:calc(14px + env(safe-area-inset-left));display:flex;gap:3px;pointer-events:none}
#hearts .h{width:30px;height:30px;transition:transform .2s,opacity .3s,filter .3s}
#hearts .h svg{width:100%;height:100%;filter:drop-shadow(0 2px 0 rgba(0,0,0,.6))}
#hearts .h.lost{opacity:.35;filter:grayscale(1)}
#hearts .h.pop{animation:pop .6s}
#coinBox{position:absolute;top:calc(112px + env(safe-area-inset-top));right:calc(14px + env(safe-area-inset-right));display:flex;align-items:center;gap:8px;padding:4px 14px 4px 6px;border-radius:22px;background:rgba(14,14,18,.72);border:3px solid #000;font-size:22px;pointer-events:none}
#coinBox .ci{width:30px;height:30px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2a8,#ffc21a 55%,#c98a00);border:3px solid #000;display:flex;align-items:center;justify-content:center;font-size:16px;color:#7a4a00;-webkit-text-stroke:0}
#coinBox.pop{animation:pop .45s}
#coinBox .gain{position:absolute;right:8px;top:100%;font-size:18px;color:#ffe066;animation:coinGain 1.2s forwards;pointer-events:none}
@keyframes coinGain{0%{opacity:0;transform:translateY(-6px)}15%{opacity:1}100%{opacity:0;transform:translateY(16px)}}
/* Карточка подсказки (туториал) */
#tipBox{position:absolute;left:calc(14px + env(safe-area-inset-left));top:17%;width:min(330px,42vw);padding:12px 14px 10px;border-radius:16px;background:rgba(14,18,30,.86);border:3px solid #ffe066;box-shadow:0 6px 0 rgba(0,0,0,.4);opacity:0;transform:translateX(-30px);pointer-events:none;transition:opacity .35s,transform .35s}
#tipBox.show{opacity:1;transform:none;pointer-events:auto;cursor:pointer}
#tipBox .tt{font-size:clamp(17px,2.6vh,22px);color:#ffe066;margin-bottom:4px}
#tipBox .tb{font-size:clamp(14px,2.2vh,18px);line-height:1.22;font-weight:600;-webkit-text-stroke:0;paint-order:normal;color:#fff}
#tipBox .tk{font-size:12px;opacity:.6;margin-top:6px;-webkit-text-stroke:0;color:#fff}
#tipBox .tt{padding-right:34px}
#tipBox .tx{position:absolute;right:6px;top:6px;width:30px;height:30px;border-radius:50%;background:rgba(190,50,40,.85);border:2px solid #000;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 0 rgba(0,0,0,.45)}
#tipBox .tx svg{width:52%;height:52%}
#tipBox .tx:active{transform:scale(.9)}
/* Бары */
#bars{position:absolute;left:calc(14px + env(safe-area-inset-left));top:50%;transform:translateY(-10%);display:flex;flex-direction:column;gap:14px}
.bar{position:relative;width:min(260px,34vw);height:30px;border-radius:16px;background:rgba(10,10,14,.6);border:3px solid #000;box-shadow:0 3px 0 rgba(0,0,0,.35)}
.bar i{position:absolute;inset:0 auto 0 0;border-radius:12px;width:100%;transition:width .12s linear}
.bar i::after{content:'';position:absolute;left:6px;right:6px;top:3px;height:6px;border-radius:4px;background:rgba(255,255,255,.35)}
.bar .ic{position:absolute;left:-10px;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:#1b1b20;border:3px solid #000;display:flex;align-items:center;justify-content:center}
.bar .ic svg{width:26px;height:26px}
.bar .num{position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:15px}
#barHp i{background:linear-gradient(#54e26a,#2fb84a)}
#barHunger i{background:linear-gradient(#ffa04a,#f0761d)}
#barSta i{background:linear-gradient(#ffe45a,#f5c518)}
.bar.low{animation:lowbar .5s infinite alternate}
@keyframes lowbar{to{box-shadow:0 0 14px 3px #ff3b3b}}
.bar.hide{opacity:0;transform:translateX(-30px);transition:.4s}
/* Хотбар */
#hotbar{position:absolute;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:8px;align-items:flex-end;pointer-events:auto}
.slot{position:relative;width:min(66px,8.6vw);height:min(66px,8.6vw);border-radius:12px;background:rgba(18,18,24,.7);border:3px solid #000;box-shadow:0 3px 0 rgba(0,0,0,.4);transition:transform .12s,border-color .12s,background .12s;cursor:pointer;display:flex;align-items:center;justify-content:center}
.slot.sel{border-color:#fff;background:rgba(60,60,78,.85);transform:translateY(-8px) scale(1.1);box-shadow:0 0 0 2px #000,0 6px 18px rgba(0,0,0,.55)}
.slot img{width:78%;height:78%;object-fit:contain;pointer-events:none;filter:drop-shadow(0 2px 0 rgba(0,0,0,.5))}
.slot .k{position:absolute;left:5px;top:2px;font-size:12px;opacity:.85}
.slot .n{position:absolute;right:5px;bottom:1px;font-size:16px}
.slot .lv,.cell .lv{position:absolute;left:4px;bottom:1px;font-size:14px;color:#ffd24a;text-shadow:0 0 3px #000}
.slot .lv.l3,.cell .lv.l3{color:#ff9bff}
#hcTag{position:absolute;top:calc(100px + env(safe-area-inset-top));left:calc(14px + env(safe-area-inset-left));padding:2px 10px;border-radius:12px;background:rgba(40,8,8,.78);border:3px solid #d02a2a;font-size:14px;pointer-events:none;display:none;color:#ff9a8a}
#bossBar{position:absolute;top:calc(58px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(560px,70vw);display:none;pointer-events:none;text-align:center}
#bossBar .bn{font-size:20px;color:#e6c8ff;letter-spacing:1px}
#bossBar .bb{height:16px;margin-top:2px;border-radius:9px;background:#000;border:3px solid #000;overflow:hidden;box-shadow:0 0 0 2px #6a2f7c}
#bossBar .bb i{display:block;height:100%;width:100%;background:linear-gradient(#c070ff,#6a2f9c);transition:width .15s}
#bossBar .bb b{position:absolute}
#giftDot{position:absolute;right:-3px;top:-3px;width:14px;height:14px;border-radius:50%;background:#ff3b3b;border:2px solid #fff;display:none}
#btnGift{position:relative}
.slot.empty{opacity:.55}
.slot .fb{font-size:26px}
#sackChip{cursor:pointer;height:min(46px,6vw);padding:0 12px;border-radius:12px;background:rgba(18,18,24,.7);border:3px solid #000;display:flex;align-items:center;gap:6px;font-size:16px;margin-right:6px}
#sackChip svg{width:24px;height:24px}
#itemName{position:absolute;left:50%;bottom:calc(min(66px,8.6vw) + 34px + env(safe-area-inset-bottom));transform:translateX(-50%);font-size:20px;opacity:0;transition:opacity .3s;white-space:nowrap}
#itemName.show{opacity:1}
/* Прицел и подсказка */
#cross{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#fff;border:2px solid #000;opacity:.85;transition:transform .12s,opacity .2s}
#cross.aim{transform:scale(1.7);opacity:1;background:transparent;border-color:#fff;box-shadow:0 0 0 2px #000 inset,0 0 0 2px #000}
#cross.hide{opacity:0}
#prompt{position:absolute;left:0;top:0;transform:translate(-50%,-50%);display:none;align-items:center;gap:10px;padding:8px 16px 8px 8px;border-radius:26px;background:rgba(14,14,18,.78);border:3px solid #000;font-size:20px;white-space:nowrap;transition:opacity .15s;pointer-events:none}
#prompt .key{min-width:34px;height:34px;border-radius:9px;background:#fff;color:#111;-webkit-text-stroke:0;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #000;position:relative}
#prompt .key::before{content:'';position:absolute;inset:-7px;border-radius:14px;border:3px solid rgba(255,255,255,.65);animation:ping 1.1s infinite}
@keyframes ping{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.25);opacity:0}}
#prompt .sub{font-size:14px;opacity:.85}
#prompt.warn .key{background:#ff7a5a}
/* Метка костра */
#fireTag{position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:none;text-align:center}
#fireTag .lv{font-size:18px;margin-bottom:2px}
#fireTag .fb{width:min(160px,28vw);height:16px;border-radius:9px;background:rgba(0,0,0,.6);border:3px solid #000;overflow:hidden;position:relative}
#fireTag .fb i{position:absolute;inset:0 auto 0 0;background:linear-gradient(#57e86a,#25b940);width:100%;transition:width .2s}
#fireTag.low .fb i{background:linear-gradient(#ffb04a,#ff5a2a)}
#fireTag.out .fb i{background:#666}
/* Парящие числа */
.float{position:absolute;left:0;top:0;font-size:26px;white-space:nowrap;pointer-events:none;will-change:transform,opacity}
/* Лента подбора */
#feed{position:absolute;right:calc(16px + env(safe-area-inset-right));bottom:calc(110px + env(safe-area-inset-bottom));display:flex;flex-direction:column-reverse;gap:6px;align-items:flex-end}
.feedItem{display:flex;align-items:center;gap:8px;padding:4px 12px 4px 6px;border-radius:20px;background:rgba(14,14,18,.7);border:3px solid #000;font-size:18px;animation:feedin .25s;transition:opacity .5s,transform .5s}
.feedItem img{width:30px;height:30px}
.feedItem.out{opacity:0;transform:translateX(30px)}
@keyframes feedin{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}
/* Тост-баннеры */
#lockHint{position:absolute;left:50%;bottom:calc(112px + env(safe-area-inset-bottom));transform:translateX(-50%);font-size:clamp(14px,2.4vh,20px);opacity:0;transition:opacity .25s;pointer-events:none;text-align:center;max-width:86vw;padding:6px 14px;background:rgba(0,0,0,.45);border-radius:10px}
#lockHint.show{opacity:1}
#toast{position:absolute;left:50%;top:26%;transform:translateX(-50%);text-align:center;font-size:clamp(22px,4vh,40px);display:none;max-width:90vw}
#toast.show{display:block;animation:toast 2.6s forwards}
@keyframes toast{0%{opacity:0;transform:translate(-50%,10px) scale(.8)}10%{opacity:1;transform:translate(-50%,0) scale(1.06)}16%{transform:translate(-50%,0) scale(1)}84%{opacity:1}100%{opacity:0;transform:translate(-50%,-8px)}}
#banner{position:absolute;left:0;right:0;top:34%;text-align:center;pointer-events:none;opacity:0}
#banner .t{font-family:'Rubik',sans-serif;font-weight:900;font-size:clamp(46px,11vh,120px);letter-spacing:2px;line-height:1}
#banner .s{font-size:clamp(20px,4vh,38px);margin-top:8px}
#banner.show{animation:banner 3.6s forwards}
@keyframes banner{0%{opacity:0;transform:scale(1.5)}12%{opacity:1;transform:scale(1)}80%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.96) translateY(-10px)}}
/* Экранные эффекты */
.fx{position:absolute;inset:0;pointer-events:none;opacity:0}
#fxHit{background:radial-gradient(ellipse at center,rgba(255,0,0,0) 35%,rgba(210,10,10,.75) 100%)}
#fxFear{background:radial-gradient(ellipse at center,rgba(20,0,40,0) 30%,rgba(10,0,25,.85) 100%)}
#fxFade{background:#000;transition:opacity .8s}
#fxLow{background:radial-gradient(ellipse at center,rgba(120,0,0,0) 45%,rgba(120,0,0,.55) 100%)}
#fxFlash{background:#fff}
/* Верхние кнопки */
#topBtns{position:absolute;top:calc(10px + env(safe-area-inset-top));left:calc(12px + env(safe-area-inset-left));display:flex;gap:8px;pointer-events:auto}
.rbtn{width:46px;height:46px;border-radius:50%;background:rgba(14,14,18,.72);border:3px solid #000;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .1s,background .1s;color:#fff}
.rbtn:hover{background:rgba(70,70,90,.9);transform:scale(1.07)}
.rbtn:active{transform:scale(.94)}
.rbtn svg{width:24px;height:24px}
/* Компас/метки */
#compass{position:absolute;top:calc(10px + env(safe-area-inset-top));right:calc(12px + env(safe-area-inset-right));width:92px;height:92px;border-radius:50%;background:rgba(14,14,18,.62);border:3px solid #000;overflow:hidden}
#compass .dial{position:absolute;inset:0;transition:none}
#compass .n{position:absolute;left:50%;top:3px;transform:translateX(-50%);font-size:14px;color:#ff5a4a}
#compass .pin{position:absolute;left:50%;top:50%;width:0;height:0}
#compass .pin b{position:absolute;left:-7px;top:-40px;width:14px;height:14px;border-radius:50%;border:2px solid #000}
#compass .me{position:absolute;left:50%;top:50%;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:14px solid #fff;transform:translate(-6px,-9px);filter:drop-shadow(0 0 2px #000)}
#waypoint{position:absolute;left:50%;top:0;width:60px;height:60px;margin:-30px 0 0 -30px;display:none;pointer-events:none}
#waypoint svg{width:100%;height:100%;filter:drop-shadow(0 3px 0 rgba(0,0,0,.5))}
#waypoint .d{position:absolute;left:50%;top:100%;transform:translateX(-50%);font-size:16px;white-space:nowrap}
/* Тач-управление */
#touch{position:absolute;inset:0;display:none;pointer-events:none}
#touch.on{display:block}
#stickBase{position:absolute;left:calc(26px + env(safe-area-inset-left));bottom:calc(30px + env(safe-area-inset-bottom));width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,.14);border:3px solid rgba(0,0,0,.6);pointer-events:auto;touch-action:none}
#stickKnob{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:rgba(255,255,255,.55);border:3px solid #000}
.tbtn{position:absolute;width:74px;height:74px;border-radius:50%;background:rgba(20,20,26,.6);border:3px solid #000;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;font-size:15px}
.tbtn:active,.tbtn.dn{background:rgba(255,255,255,.35)}
.tbtn svg{width:34px;height:34px}
/* Окна */
.overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto;background:rgba(6,8,14,.55);backdrop-filter:blur(3px)}
.overlay.on{display:flex;animation:fade .2s}
@keyframes fade{from{opacity:0}to{opacity:1}}
.panel{position:relative;min-width:min(520px,94vw);max-width:96vw;max-height:92vh;overflow:auto;padding:20px 22px 22px;border-radius:22px;background:linear-gradient(#2a2c36,#1b1c24);border:4px solid #000;box-shadow:0 10px 0 rgba(0,0,0,.35),0 20px 60px rgba(0,0,0,.6);animation:panelin .28s cubic-bezier(.2,1.4,.4,1)}
@keyframes panelin{from{transform:scale(.86) translateY(20px);opacity:0}to{transform:none;opacity:1}}
.panel h2{margin:0 0 14px;font-size:30px;text-align:center}
.panel .close{position:absolute;right:12px;top:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:8px 22px;border-radius:14px;border:4px solid #000;background:linear-gradient(#4ade6a,#22a446);color:#fff;font:inherit;font-size:22px;cursor:pointer;box-shadow:0 5px 0 #0c5a22,0 8px 12px rgba(0,0,0,.35);-webkit-text-stroke:3px #000;paint-order:stroke fill;transition:transform .08s,filter .1s}
.btn:hover{filter:brightness(1.12);transform:translateY(-1px)}
.btn:active{transform:translateY(3px);box-shadow:0 2px 0 #0c5a22}
.btn.blue{background:linear-gradient(#5aa8ff,#2f6fd8);box-shadow:0 5px 0 #173f8c,0 8px 12px rgba(0,0,0,.35)}
.btn.red{background:linear-gradient(#ff6a5a,#d12f22);box-shadow:0 5px 0 #7c1409,0 8px 12px rgba(0,0,0,.35)}
.btn.gray{background:linear-gradient(#7d8190,#565a68);box-shadow:0 5px 0 #2c2f3a,0 8px 12px rgba(0,0,0,.35)}
.btn.dis{filter:grayscale(1) brightness(.7);pointer-events:none}
.btn.sm{min-height:38px;font-size:18px;padding:4px 14px;border-width:3px;-webkit-text-stroke:2px #000}
.row{display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap}
.col{display:flex;flex-direction:column;gap:12px;align-items:stretch}
.grid{display:grid;gap:10px}
.card{position:relative;padding:10px;border-radius:14px;background:rgba(0,0,0,.28);border:3px solid #000;display:flex;align-items:center;gap:12px}
.card img{width:52px;height:52px;object-fit:contain;filter:drop-shadow(0 2px 0 rgba(0,0,0,.5))}
.card .nm{font-size:20px}
.card .ds{font-size:14px;opacity:.75;font-weight:600}
.cost{display:flex;gap:6px;flex-wrap:wrap;font-size:15px}
.cost span{padding:2px 8px;border-radius:9px;background:rgba(0,0,0,.4);border:2px solid #000}
.cost span.no{background:#7a1f1a}
.cost span.ok{background:#1f6a2a}
.tabs{display:flex;gap:6px;margin-bottom:10px;justify-content:center;flex-wrap:wrap}
`;
        document.head.appendChild(s);
    },

    // Иконки-глифы (SVG)
    svg: {
        heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.800-8 11-8 11z" fill="#ff4a5e" stroke="#000" stroke-width="2"/></svg>',
        food: '<svg viewBox="0 0 24 24"><g fill="#fff" stroke="#000" stroke-width="1.6"><path d="M7 2v7a2.500 2.500 0 0 0 2 2.400V22h2V11.400A2.500 2.500 0 0 0 13 9V2h-1.600v6h-1V2H9v6H8V2z"/><path d="M17 2c-2 1.500-3 4-3 7 0 2 1 3 2 3.300V22h2V2z"/></g></svg>',
        bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="#ffe45a" stroke="#000" stroke-width="1.800" stroke-linejoin="round"/></svg>',
        gear: '<svg viewBox="0 0 24 24"><path d="M12 8.500a3.500 3.500 0 1 0 0 7 3.500 3.500 0 0 0 0-7zm8 5.500v-4l-2.200-.5a6.500 6.500 0 0 0-.8-1.900l1.200-1.900-2.800-2.800-1.900 1.200a6.500 6.500 0 0 0-1.900-.8L11 1.500H7l-.5 2.200a6.500 6.500 0 0 0-1.900.8L2.700 3.300-.1 6.100l1.200 1.900c-.4.600-.7 1.300-.8 1.900L-1.900 10v4l2.200.5c.2.700.5 1.300.8 1.900l-1.200 1.900 2.800 2.800 1.900-1.200c.6.400 1.300.7 1.900.8L7 22.500h4l.5-2.200c.7-.2 1.300-.5 1.900-.8l1.900 1.200 2.800-2.800-1.200-1.900c.4-.6.700-1.300.8-1.900z" transform="translate(2 0) scale(.9)" fill="#fff" stroke="#000" stroke-width="1.800"/></svg>',
        sound: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9z" fill="#fff" stroke="#000" stroke-width="1.800" stroke-linejoin="round"/><path d="M16 8.500a5 5 0 0 1 0 7M18.500 6a8.500 8.500 0 0 1 0 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
        mute: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9z" fill="#fff" stroke="#000" stroke-width="1.800" stroke-linejoin="round"/><path d="M16 9l6 6m0-6-6 6" stroke="#ff5a4a" stroke-width="2.400" stroke-linecap="round"/></svg>',
        sack: '<svg viewBox="0 0 24 24"><path d="M8 3h8l-1.600 3c3 1.500 5 4.500 5 8 0 4-3.500 7-7.400 7S4.600 18 4.600 14c0-3.500 2-6.500 5-8z" fill="#a8703a" stroke="#000" stroke-width="1.800" stroke-linejoin="round"/><path d="M8.500 6.500h7" stroke="#000" stroke-width="1.800"/></svg>',
        jump: '<svg viewBox="0 0 24 24"><path d="M12 4l7 8h-4v8H9v-8H5z" fill="#fff" stroke="#000" stroke-width="1.800" stroke-linejoin="round"/></svg>',
        hit: '<svg viewBox="0 0 24 24"><path d="M14 3 4 15l4 4L20 9z" fill="#fff" stroke="#000" stroke-width="1.800" stroke-linejoin="round"/><path d="M4 20l3-3" stroke="#000" stroke-width="2.500"/></svg>',
        hand: '<svg viewBox="0 0 24 24"><path d="M9 11V5a1.500 1.500 0 0 1 3 0v5h1V4a1.500 1.500 0 0 1 3 0v6h1V6a1.500 1.500 0 0 1 3 0v9c0 4-3 7-7 7-3 0-4.500-1.500-6-4l-2-3a1.500 1.500 0 0 1 2.300-1.800L9 15z" fill="#fff" stroke="#000" stroke-width="1.600" stroke-linejoin="round"/></svg>',
        run: '<svg viewBox="0 0 24 24"><path d="M13 4a2 2 0 1 1 0 .1zM7 21l3-6 3 2 2 4M11 8l-3 3-3-1m6-2 3 3 3 1" fill="none" stroke="#fff" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        arrow: '<svg viewBox="0 0 60 60"><path d="M30 6 12 34h11v20h14V34h11z" fill="#ffe61a" stroke="#000" stroke-width="4" stroke-linejoin="round" transform="rotate(180 30 30)"/></svg>',
        x: '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5 5 19" stroke="#fff" stroke-width="3.500" stroke-linecap="round"/></svg>',
        diamond: '<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 13L2 9z" fill="#5ad9ff" stroke="#000" stroke-width="1.800" stroke-linejoin="round"/><path d="M2 9h20M9 3l-2 6 5 13 5-13-2-6" fill="none" stroke="#000" stroke-width="1.200"/></svg>',
        bag: '<svg viewBox="0 0 24 24"><path d="M6 8h12l1 13H5z" fill="#c98a4a" stroke="#000" stroke-width="1.800" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="#000" stroke-width="1.800"/></svg>',
        mouseR: '<svg class="mouseR" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5A5.5 5.5 0 0 1 17.5 9v1H12z" fill="#e8843b"/><rect x="6.5" y="3.5" width="11" height="17" rx="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.5 10h11M12 3.5V10" stroke="currentColor" stroke-width="2"/></svg>',
        pause: '<svg viewBox="0 0 24 24"><path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="#fff" stroke="#000" stroke-width="1.800" stroke-linejoin="round"/></svg>',
    },

    init(app) {
        this.css();
        const root = this.root = document.createElement('div');
        root.id = 'ui';
        root.innerHTML = `
<div class="hud hidden" id="hud">
  <div id="topBtns"><div class="rbtn" id="btnPause">${this.svg.pause}</div><div class="rbtn" id="btnSound"></div><div class="rbtn" id="btnMap">${this.svg.arrow.replace('rotate(180 30 30)', 'rotate(0 30 30)')}</div><div class="rbtn" id="btnQuest" title="J">${Icons.glyph('📜')}</div><div class="rbtn" id="btnShop" title="K">${Icons.glyph('🛒')}</div></div>
  <div id="evChip" class="rb1"></div><div id="hearts"></div><div id="coinBox"><span class="ci">$</span><span id="coinNum" class="rb1">0</span></div>
  <div id="dayBox"><div id="dayText" class="rb"></div><div id="dayArc"><div id="dayFill"></div><div id="dayMark"></div></div></div>
  <div id="objBox" style="display:none"><div id="objText" class="rb2 ylw"></div><div id="objCount" class="rb"></div></div>
  <div id="objDesc" class="rb1" style="display:none"></div>
  <div id="bars">
    <div class="bar" id="barHp"><i></i><div class="ic">${this.svg.heart}</div><div class="num rb1"></div></div>
    <div class="bar" id="barHunger"><i></i><div class="ic">${this.svg.food}</div><div class="num rb1"></div></div>
    <div class="bar" id="barSta"><i></i><div class="ic">${this.svg.bolt}</div></div>
  </div>
  <div id="compass"><div class="dial" id="dial"><canvas id="miniMap" width="144" height="144"></canvas><div class="n rb1">N</div></div><div class="me"></div></div>
  <div id="waypoint">${this.svg.arrow}<div class="d rb2"></div></div>
  <div id="cross"></div>
  <div id="prompt"><div class="key rb1">E</div><div><div class="t rb2"></div><div class="sub rb1"></div></div></div>
  <div id="fireTag"><div class="lv rb2"></div><div class="fb"><i></i></div></div>
  <div id="feed"></div>
  <div id="itemName" class="rb2"></div>
  <div id="hotbar"><div id="sackChip" class="rb1"></div></div>
  <div id="lockHint" class="rb1"></div>
  <div id="toast" class="rb"></div>
  <div id="banner"><div class="t rb"></div><div class="s rb2 ylw"></div></div>
  <div id="touch">
    <div id="stickBase"><div id="stickKnob"></div></div>
    <div class="tbtn" id="tbAttack" style="right:calc(30px + env(safe-area-inset-right));bottom:calc(60px + env(safe-area-inset-bottom));width:96px;height:96px">${this.svg.hit}</div>
    <div class="tbtn" id="tbJump" style="right:calc(146px + env(safe-area-inset-right));bottom:calc(40px + env(safe-area-inset-bottom))">${this.svg.jump}</div>
    <div class="tbtn" id="tbInteract" style="right:calc(40px + env(safe-area-inset-right));bottom:calc(176px + env(safe-area-inset-bottom));background:rgba(40,120,60,.7)">${this.svg.hand}</div>
    <div class="tbtn" id="tbSprint" style="right:calc(160px + env(safe-area-inset-right));bottom:calc(128px + env(safe-area-inset-bottom));width:60px;height:60px">${this.svg.run}</div>
    <div class="tbtn" id="tbDrop" style="right:calc(20px + env(safe-area-inset-right));bottom:calc(290px + env(safe-area-inset-bottom));width:54px;height:54px;font-size:13px">Q</div>
    <div class="tbtn" id="tbUpFire" style="right:calc(262px + env(safe-area-inset-right));bottom:calc(64px + env(safe-area-inset-bottom));display:none;background:rgba(190,80,20,.78);font-size:30px">🔥</div>
  </div>
  <div class="fx" id="fxLow"></div><div class="fx" id="fxFear"></div><div class="fx" id="fxHit"></div>
</div>
<div class="fx" id="fxFlash"></div>
<div class="fx" id="fxFade" style="opacity:0"></div>
<div id="panels"></div>`;
        document.body.appendChild(root);
        const q = (id) => root.querySelector('#' + id);
        for (const id of ['hud', 'lockHint', 'dayText', 'dayFill', 'dayMark', 'objBox', 'objText', 'objCount', 'barHp', 'barHunger', 'barSta', 'compass', 'dial', 'waypoint', 'cross', 'prompt', 'fireTag', 'feed', 'itemName', 'hotbar', 'sackChip', 'toast', 'banner', 'touch', 'fxLow', 'fxFear', 'fxHit', 'fxFlash', 'fxFade', 'panels', 'btnPause', 'btnSound', 'btnMap', 'btnQuest', 'btnShop', 'evChip', 'hearts', 'coinBox', 'coinNum', 'objDesc', 'stickBase', 'stickKnob'])
            this.el[id] = q(id);
        this.el.promptT = this.el.prompt.querySelector('.t'); this.el.promptSub = this.el.prompt.querySelector('.sub'); this.el.promptKey = this.el.prompt.querySelector('.key');
        this.el.hpNum = this.el.barHp.querySelector('.num'); this.el.hgNum = this.el.barHunger.querySelector('.num');
        this.el.bannerT = this.el.banner.querySelector('.t'); this.el.bannerS = this.el.banner.querySelector('.s');
        this.el.fireLv = this.el.fireTag.querySelector('.lv'); this.el.fireFill = this.el.fireTag.querySelector('.fb i');
        this.el.wpD = this.el.waypoint.querySelector('.d');
        this.el.btnSound.innerHTML = Sound.muted ? this.svg.mute : this.svg.sound;
        this.el.btnPause.onclick = () => Game.pause();
        this.el.btnSound.onclick = () => { Sound.toggleMuted(); this.el.btnSound.innerHTML = Sound.muted ? this.svg.mute : this.svg.sound; };
        this.el.btnMap.onclick = () => this.openBoard();
        this.el.btnQuest.onclick = () => this.open('quests');
        this.el.btnShop.onclick = () => this.open('shop');
        this.el.sackChip.onclick = () => this.open('inv');
        this.setHearts(Econ.hearts, 0); this.setCoins(Econ.coins, 0);
        this._touchSetup();
        Inv.onChange.push(() => this.rebuildHotbar());
        this.rebuildHotbar();
        if (typeof UIPanels !== 'undefined') UIPanels.init(this);
    },

    showHud(on) { this.el.hud.classList.toggle('hidden', !on); this.hudOn = on; if (!on) this.clearNotices(); else if (window.HudLayout) HudLayout.apply(); },
    blocking() { return !!this.modal; },

    // ------------------------------------------------------------------------------ иконки
    icon(id, cls) {
        const d = DATA.items[id];
        const model = d ? d.model : id;
        return '<img class="' + (cls || '') + '" src="assets/icons/' + model + '.webp" alt="" draggable="false" onerror="this.replaceWith(UI.fallbackIcon(\'' + id + '\'))">';
    },
    fallbackIcon(id) {
        const s = document.createElement('span'); s.className = 'fb';
        const m = { log: '🪵', axe_old: '🪓', axe_good: '🪓', axe_strong: '🪓', flashlight: '🔦', spear: '🔱', revolver: '🔫', rifle: '🔫', carrot: '🥕', berry: '🫐', steak_raw: '🥩', steak_cooked: '🍖', bandage: '🩹', medkit: '🧰', gem: '💎', diamond: '💎' };
        s.textContent = m[id] || '📦';
        return s;
    },
    name(id) { return Lang.t('item.' + id); },

    // ------------------------------------------------------------------------------ хотбар
    rebuildHotbar() {
        const hb = this.el.hotbar; if (!hb) return;
        const sack = this.el.sackChip;
        const used = Inv.slots.filter(Boolean).length;
        sack.innerHTML = this.svg.sack + '<span>' + used + '/' + Inv.cap + '</span>';
        while (hb.children.length > 1) hb.removeChild(hb.lastChild);
        Inv.slots.slice(0, Inv.hot).forEach((s, i) => {
            const d = document.createElement('div');
            d.className = 'slot' + (i === Inv.sel ? ' sel' : '') + (s ? '' : ' empty');
            d.innerHTML = '<span class="k rb1">' + ((i + 1) % 10) + '</span>' + (s ? this.icon(s.id) + (s.n > 1 ? '<span class="n rb1">' + s.n + '</span>' : '') + (s.lv ? '<span class="lv rb1' + (s.lv >= 3 ? ' l3' : '') + '">+' + s.lv + '</span>' : '') : '');
            d.onclick = () => Inv.select(i);
            d.oncontextmenu = (e) => { e.preventDefault(); };
            hb.appendChild(d);
        });
        if (Inv.sel !== this.lastSel) {
            this.lastSel = Inv.sel;
            const s = Inv.current();
            if (s) { this.el.itemName.textContent = this.name(s.id) + (s.lv ? ' +' + s.lv : ''); this.el.itemName.classList.add('show'); this.nameT = 1.6; }
            else this.el.itemName.classList.remove('show');
        }
    },
    equipped() { this.rebuildHotbar(); },
    flashState(on) { this.toast(on ? Lang.t('flashOn') : Lang.t('flashOff'), 'info'); },

    // ------------------------------------------------------------------------------ кадр
    update(dt, ctx) {
        if (!this.hudOn) return;
        if (window.HudLayout) HudLayout.update(dt);
        const el = this.el, L = this._last;
        // день
        const p = Sky.p, T = DATA.time;
        const dayTxt = Lang.t('day') + ' ' + Sky.day;
        if (L.day !== dayTxt) { L.day = dayTxt; el.dayText.textContent = dayTxt; }
        el.dayMark.style.left = (p * 100) + '%';
        el.dayFill.style.width = (p * 100) + '%';
        // бары
        const hp = Math.round(Player.hp), hg = Math.round(Player.hunger), st = Player.stamina;
        if (L.hp !== hp) { L.hp = hp; el.barHp.querySelector('i').style.width = Math.max(0, Player.hp) + '%'; el.hpNum.textContent = hp; el.barHp.classList.toggle('low', hp < 30); }
        if (L.hg !== hg) { L.hg = hg; el.barHunger.querySelector('i').style.width = Player.hunger + '%'; el.hgNum.textContent = hg; el.barHunger.classList.toggle('low', hg < 15); }
        const sw = Math.round(st);
        if (L.st !== sw) { L.st = sw; el.barSta.querySelector('i').style.width = st + '%'; el.barSta.classList.toggle('hide', st > 98 && !Player.sprinting); }
        // подсказка «кликни, чтобы управлять камерой мышью» (только пока курсор не захвачен)
        this._lockT = Input.locked ? 7 : Math.max(0, (this._lockT == null ? 7 : this._lockT) - dt);   // подсказка — первые секунды без захвата
        const needLock = this._lockT > 0 && !Input.locked && !Input.isTouch && !this.modal && !Player.dead && !IS_MOBILE && !this.touchVisible();
        // мышь при экранном управлении: камера только зажатой ПКМ — подсказка, пока игрок её не попробовал (не дольше 25 с)
        const mouseUi = this.touchVisible() && !Input.isTouch && !IS_MOBILE && !this.modal && !Player.dead;
        if (mouseUi) { this._rmbT = (this._rmbT || 0) + dt; if (Input.mouse.buttons[2]) this._rmbUsed = (this._rmbUsed || 0) + dt; }
        const needRmb = !needLock && mouseUi && (this._rmbUsed || 0) < 0.6 && this._rmbT < 25;
        const hint = needLock ? 'lock' : needRmb ? 'rmb' : '';
        if (L.lock !== hint) {
            L.lock = hint;
            el.lockHint.textContent = hint === 'lock' ? Lang.t('lockHint') : '';
            if (hint === 'rmb') { el.lockHint.insertAdjacentHTML('afterbegin', this.svg.mouseR); el.lockHint.appendChild(document.createTextNode(Lang.t('lookHintRmb'))); }
            el.lockHint.classList.toggle('show', !!hint);
        }
        // хотбар: имя
        if (this.nameT > 0) { this.nameT -= dt; if (this.nameT <= 0) el.itemName.classList.remove('show'); }
        // компас
        const yaw = Cam.yaw;
        el.dial.style.transform = 'rotate(' + (yaw * 180 / Math.PI) + 'deg)';
        // прицел
        const aim = Player.aiming && Player.aiming();
        el.cross.classList.toggle('aim', !!aim);
        el.cross.classList.toggle('hide', !!this.modal || Player.dead || (!aim && !Player.heldDef()));
        // плавающие числа
        this._updateFloats(dt);
        // эффекты
        const hurt = Player.hurtT > 0 ? Player.hurtT / 0.4 : 0;
        this._fx('fxHit', Math.max(this._fxv.fxHit * 0.9, hurt * 0.0));
        el.fxLow.style.opacity = Player.hp < 35 && !Player.dead ? (0.25 + 0.3 * Math.sin(performance.now() / 260)) * (1 - Player.hp / 35) + '' : '0';
        el.fxFear.style.opacity = ctx && ctx.fear ? String(U.clamp(ctx.fear, 0, 1)) : '0';
        // кнопка улучшения костра на телефоне: только рядом с огнём
        const upf = this.root.querySelector('#tbUpFire');
        if (upf) { const nf = (Input.isTouch || IS_MOBILE) && !this.modal && Camp.level < 5 && Math.hypot(Player.x - Camp.x, Player.z - Camp.z) < 4.6 * M; if (L.upf !== nf) { L.upf = nf; /** @type {HTMLElement} */ (upf).style.display = nf ? 'flex' : 'none'; } }
        // подсказка E и метка костра
        this._updatePrompt(ctx);
        this._updateWaypoint(ctx);
        // лента подбора
        for (let i = this.feed.length - 1; i >= 0; i--) { const f = this.feed[i]; f.t -= dt; if (f.t < 0.5 && !f.out) { f.out = true; f.el.classList.add('out'); } if (f.t <= 0) { f.el.remove(); this.feed.splice(i, 1); } }
    },
    _fxv: { fxHit: 0 },
    _fx(id, v) { this._fxv[id] = v < 0.01 ? 0 : v; this.el[id].style.opacity = String(this._fxv[id]); },
    hitFlash(k) { this._fxv.fxHit = k; this.el.fxHit.style.opacity = String(k); this.el.fxHit.style.transition = 'none'; requestAnimationFrame(() => { this.el.fxHit.style.transition = 'opacity .7s'; this.el.fxHit.style.opacity = '0'; this._fxv.fxHit = 0; }); },
    flash(color, k, dur) { const e = this.el.fxFlash; e.style.background = color || '#fff'; e.style.transition = 'none'; e.style.opacity = String(k || 0.6); requestAnimationFrame(() => { e.style.transition = 'opacity ' + (dur || 0.5) + 's'; e.style.opacity = '0'; }); },
    fade(to, dur) { const e = this.el.fxFade; e.style.transition = 'opacity ' + (dur == null ? 0.8 : dur) + 's'; e.style.opacity = String(to); },

    // ------------------------------------------------------------------------------ подсказка E
    setPrompt(o) { this._prompt = o; },
    _updatePrompt(ctx) {
        const p = this._prompt, el = this.el.prompt;
        if (!p || this.modal || Player.dead || !p.pos) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
        const s = Cam.project(p.pos.x, p.pos.y, p.pos.z);
        if (!s.visible) { el.style.display = 'none'; return; }
        if (el.style.display !== 'flex') el.style.display = 'flex';
        const touch = Input.isTouch || IS_MOBILE;
        // над хотбаром (и над джойстиком/кнопками в портрете) — точку считает HudLayout под размер экрана
        const x = window.innerWidth / 2, y = window.HudLayout && HudLayout.promptY ? HudLayout.promptY : window.innerHeight - (touch && window.innerWidth < 601 ? 340 : window.innerHeight < 521 ? 12 : 116);
        el.style.transform = 'translate(-50%,-100%) translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
        el.style.left = '0'; el.style.top = '0';
        if (this._pk !== p.text + '|' + p.sub) { this._pk = p.text + '|' + p.sub; this.el.promptT.textContent = p.text; this.el.promptSub.textContent = p.sub || ''; this.el.promptSub.style.display = p.sub ? 'block' : 'none'; }
        el.classList.toggle('warn', !!p.warn);
        this.el.promptKey.textContent = Input.isTouch ? '✋' : Input.padActive() ? 'X' : (p.key || Input.label((Input.binds.interact || ['KeyE'])[0]));
    },
    _updateFireTag(ctx) { /* см. UI.fireTag */ },
    fireTag(o) {
        const t = this.el.fireTag;
        if (!o || this.modal) { t.style.display = 'none'; return; }
        const s = Cam.project(o.x, o.y, o.z);
        const bd = window.HudLayout ? HudLayout.bounds : null;
        const top = bd ? bd.top + 40 : 150, bottom = bd ? bd.bottom : window.innerHeight - 90;
        if (!s.visible || s.y < top || s.y > bottom || s.x < 110 || s.x > window.innerWidth - 110) { t.style.display = 'none'; return; }
        t.style.display = 'block';
        t.style.left = '0'; t.style.top = '0';
        t.style.transform = 'translate(-50%,-100%) translate(' + Math.round(s.x) + 'px,' + Math.round(s.y) + 'px)';
        this.el.fireLv.textContent = Lang.t('fireLv', { n: o.level });
        this.el.fireFill.style.width = U.clamp(o.frac * 100, 0, 100) + '%';
        t.classList.toggle('low', o.frac < 0.25 && o.frac > 0);
        t.classList.toggle('out', o.frac <= 0);
    },

    // ------------------------------------------------------------------------------ путевая точка (доска детей)
    setWaypoint(w) { this.waypoint = w; },
    _updateWaypoint() {
        const w = this.waypoint, e = this.el.waypoint;
        if (!w || this.modal) { e.style.display = 'none'; return; }
        const s = Cam.project(w.x, w.y, w.z);
        const dist = Math.hypot(w.x - Player.x, w.z - Player.z);
        e.style.display = 'block';
        this.el.wpD.textContent = Math.round(dist / M) + ' m';
        const W = window.innerWidth, H = window.innerHeight;
        let x = s.x, y = s.y - 30;
        if (!s.visible || s.behind) {
            // за экраном: прижать к краю по направлению
            const a = Math.atan2(w.x - Player.x, w.z - Player.z) - Cam.yaw;
            x = W / 2 + Math.sin(a) * W * 0.42; y = H / 2 - Math.cos(a) * H * 0.38;
        }
        // стрелка не заходит под строку дня и цель задания
        const ob = this.el.objBox, od = this.el.objDesc;
        const textBottom = Math.max(ob && ob.offsetHeight ? ob.getBoundingClientRect().bottom : 64, od && od.offsetHeight ? od.getBoundingClientRect().bottom : 0);
        const bd = window.HudLayout ? HudLayout.bounds : null;
        const yMax = bd ? Math.min(H - 100, bd.bottom - 36) : H - 100;
        const yMin = U.clamp(Math.max(textBottom, bd ? bd.top : 0) + 38, 64, yMax);
        x = U.clamp(x, 40, W - 40); y = U.clamp(y, yMin, Math.max(yMin, yMax));
        // не на кнопках/сердцах/шкалах (левая колонка) и не на компасе/отряде (правая)
        if (bd && bd.colL != null) { if (y - 30 < bd.colLB) x = Math.max(x, bd.colL + 34); if (y - 30 < bd.colRB) x = Math.min(x, bd.colR - 34); }
        e.style.left = '0'; e.style.top = '0';
        e.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
        e.style.margin = '-30px 0 0 -30px';
    },

    // ------------------------------------------------------------------------------ числа, тосты, баннеры
    floatText(pos, text, color, big) {
        const e = document.createElement('div');
        e.className = 'float rb2';
        e.textContent = text; e.style.color = color || '#fff';
        if (big) e.style.fontSize = '36px';
        this.root.appendChild(e);
        this.floats.push({ el: e, x: pos.x + (Math.random() - 0.5) * 60, y: pos.y, z: pos.z + (Math.random() - 0.5) * 60, t: 0, vy: 130 });
    },
    _updateFloats(dt) {
        for (let i = this.floats.length - 1; i >= 0; i--) {
            const f = this.floats[i];
            f.t += dt; f.y += f.vy * dt; f.vy *= 0.94;
            const s = Cam.project(f.x, f.y, f.z);
            const k = f.t / 1.1;
            if (k >= 1 || !s.visible) { f.el.remove(); this.floats.splice(i, 1); continue; }
            const sc = k < 0.12 ? 0.6 + k / 0.12 * 0.7 : 1.3 - Math.min(1, (k - 0.12) / 0.3) * 0.3;
            f.el.style.opacity = String(k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
            f.el.style.transform = 'translate(' + Math.round(s.x) + 'px,' + Math.round(s.y) + 'px) translate(-50%,-50%) scale(' + sc.toFixed(2) + ')';
        }
    },
    toast(text, kind) {
        this.queueNotice({ type: 'toast', title: text, kind });
    },
    banner(title, sub, color) {
        this.queueNotice({ type: 'banner', title, sub, color });
    },
    clearNotices() {
        clearTimeout(this._noticeTimer); this._noticeTimer = null; this._noticeActive = null; this._notices = [];
        if (this.root) this.root.classList.remove('noticeBusy');
        if (this.el.toast) this.el.toast.classList.remove('show');
        if (this.el.banner) this.el.banner.classList.remove('show');
    },
    queueNotice(n) {
        if (!this._notices) this._notices = [];
        if ((this._noticeActive && this._noticeActive.title === n.title) || this._notices.some(x => x.title === n.title)) return;
        if (this._notices.length >= ASTRA_UI_NOTICE_LIMIT) this._notices.shift();
        this._notices.push(n); this.nextNotice();
    },
    nextNotice() {
        if (this._noticeActive || !this._notices || !this._notices.length) return;
        const n = this._noticeActive = this._notices.shift();
        if (this.root) this.root.classList.add('noticeBusy');
        if (n.type === 'banner') this._showBanner(n.title, n.sub, n.color); else this._showToast(n.title, n.kind);
        this._noticeTimer = setTimeout(() => {
            this.el.toast.classList.remove('show'); this.el.banner.classList.remove('show');
            if (this.root) this.root.classList.remove('noticeBusy');
            this._noticeActive = null; this._noticeTimer = null; this.nextNotice();
        }, ASTRA_UI_NOTICE_SECONDS * 1000);
    },
    _showToast(text, kind) {
        const t = this.el.toast;
        t.textContent = text; t.dataset.k = kind || 'info';
        t.style.color = kind === 'warn' ? '#ffb0a0' : kind === 'good' ? '#b6ff9a' : '#fff';
        t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
        if (kind === 'warn') Sfx.ui('warn');
    },
    _showBanner(title, sub, color) {
        const b = this.el.banner;
        this.el.bannerT.textContent = title; this.el.bannerS.textContent = sub || '';
        this.el.bannerT.style.color = color || '#fff';
        b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    },
    pickupFeed(id, n) {
        const last = this.feed.find(f => f.id === id && f.t > 0.8);
        if (last) { last.n += n; last.t = 2.6; last.el.querySelector('.q').textContent = '+' + last.n + ' ' + this.name(id); last.el.style.animation = 'none'; void last.el.offsetWidth; last.el.style.animation = ''; return; }
        const e = document.createElement('div');
        e.className = 'feedItem rb1';
        e.innerHTML = this.icon(id) + '<span class="q">+' + n + ' ' + this.name(id) + '</span>';
        this.el.feed.appendChild(e);
        this.feed.push({ el: e, id, n, t: 2.6 });
        if (this.feed.length > 6) { const f = this.feed.shift(); f.el.remove(); }
    },

    // ------------------------------------------------------------------------------ цель
    setObjective(key, cur, max, params) {
        const o = this.objective;
        const changed = o.key !== key;
        o.key = key;
        const bump = !changed && (cur !== o.cur);
        o.cur = cur; o.max = max || 0;
        this.el.objText.textContent = key ? Lang.t(key, params) : '';
        this.el.objCount.textContent = max ? cur + '/' + max : '';
        this.el.objBox.style.display = key ? 'flex' : 'none';
        // UiFX добавляет фон/рамку даже пустому описанию: скрываем весь контейнер.
        if (this.el.objDesc) { this.el.objDesc.style.display = key ? '' : 'none'; if (!key) this.el.objDesc.textContent = ''; }
        if (changed || bump) { this.el.objBox.classList.remove('pop'); void this.el.objBox.offsetWidth; this.el.objBox.classList.add('pop'); }
    },
    objectiveEvent(ev) { if (window.Game && Game.quest) Game.quest.event(ev); },

    setEvent(text) { const e = this.el.evChip; if (!e) return; Icons.label(e, text); e.style.display = text ? 'block' : 'none'; },

    // ------------------------------------------------------------------------------ сердца и монеты
    setHearts(n, delta) {
        const box = this.el.hearts; if (!box) return;
        const max = DATA.lives.max;
        if (box.children.length !== max) {
            box.innerHTML = '';
            for (let i = 0; i < max; i++) { const h = document.createElement('div'); h.className = 'h'; h.innerHTML = this.svg.heart; box.appendChild(h); }
        }
        Array.from(box.children).forEach((h, i) => {
            h.classList.toggle('lost', i >= n);
            if (delta && i === (delta < 0 ? n : n - 1)) { h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop'); }
        });
    },
    setCoins(n, delta) {
        if (this.el.coinNum) this.el.coinNum.textContent = String(n);
        const b = this.el.coinBox; if (!b) return;
        if (delta) {
            b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
            if (delta > 0) { const g = document.createElement('span'); g.className = 'gain rb1'; g.textContent = '+' + delta; b.appendChild(g); setTimeout(() => g.remove(), 1300); }
        }
    },

    // ------------------------------------------------------------------------------ окна
    open(name, data) { if (window.UIPanels) UIPanels.open(name, data); },
    close() { if (window.UIPanels) UIPanels.close(); },
    openBoard() { this.open(window.MapView ? 'map' : 'board'); },

    // ------------------------------------------------------------------------------ тач
    _touchSetup() {
        const base = this.el.stickBase, knob = this.el.stickKnob;
        let id = null, cx = 0, cy = 0;
        let R = 52;
        const move = (t) => {
            let dx = t.clientX - cx, dy = t.clientY - cy; const d = Math.hypot(dx, dy) || 1;
            const k = Math.min(1, d / R);
            dx = dx / d * k * R; dy = dy / d * k * R;
            knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
            Input.move.x = dx / R; Input.move.y = -dy / R;
        };
        // Pointer Events: палец, мышь и перо — одно управление (Playables: touch и mouse для всех действий).
        // Каждый палец — свой pointerId: джойстик и кнопки работают одновременно (мультитач).
        const stop = () => { id = null; knob.style.transform = ''; Input.move.x = 0; Input.move.y = 0; };
        base.addEventListener('pointerdown', (e) => {
            if (id !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
            if (e.pointerType === 'touch') Input.isTouch = true;
            id = e.pointerId; const r = base.getBoundingClientRect(); R = Math.max(24, r.width / 2 - 18); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
            try { base.setPointerCapture(e.pointerId); } catch (er) { /* без захвата — по движению над джойстиком */ }
            move(e); e.preventDefault();
        });
        base.addEventListener('pointermove', (e) => { if (e.pointerId === id) { move(e); e.preventDefault(); } });
        const end = (e) => { if (e.pointerId === id) stop(); };
        base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end); base.addEventListener('lostpointercapture', end);
        const helds = [];
        const bind = (elId, action) => {
            const e = this.root.querySelector('#' + elId), held = new Set();
            helds.push(held);
            e.addEventListener('pointerdown', (ev) => {
                if (ev.pointerType === 'mouse' && ev.button !== 0) return;
                if (ev.pointerType === 'touch') Input.isTouch = true;
                held.add(ev.pointerId);
                try { e.setPointerCapture(ev.pointerId); } catch (er) { /* ок */ }
                Input.setVirtual(action, true); e.classList.add('dn'); ev.preventDefault();
            });
            const up = (ev) => { if (!held.delete(ev.pointerId) || held.size) return; Input.setVirtual(action, false); e.classList.remove('dn'); };
            e.addEventListener('pointerup', up); e.addEventListener('pointercancel', up); e.addEventListener('lostpointercapture', up);
        };
        bind('tbAttack', 'attack'); bind('tbJump', 'jump'); bind('tbInteract', 'interact'); bind('tbSprint', 'sprint'); bind('tbDrop', 'drop'); bind('tbUpFire', 'upgrade');
        Input.onRelease = () => { stop(); for (const h of helds) h.clear(); for (const b of this.root.querySelectorAll('.tbtn.dn')) b.classList.remove('dn'); };
        this.applyTouchUi();
        // авто: первое касание (сенсорный ноутбук, планшет с «настольным» браузером) включает экранное управление
        const firstTouch = () => { if (Input.isTouch && this._touchSeen) return; this._touchSeen = true; Input.isTouch = true; this.applyTouchUi(); };
        window.addEventListener('touchstart', firstTouch, { once: true, passive: true });
        window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') firstTouch(); }, { passive: true });
    },

    // Экранное управление (джойстик и кнопки): 'auto' — телефон или первое касание; 'on' — всегда (на ПК работает мышью);
    // 'off' — нет. Сборка Playables — всегда 'on'. Выбор игрока — Store GAME_ID.touchUi (Настройки).
    touchMode() {
        if (String(GAME_PLATFORM) === 'playables') return 'on';
        const m = Store.get(GAME_ID + '.touchUi');
        return m === 'on' || m === 'off' ? m : 'auto';
    },
    setTouchMode(m) { Store.set(GAME_ID + '.touchUi', m); this.applyTouchUi(); },
    touchVisible() { return !!(this.el.touch && this.el.touch.classList.contains('on')); },
    applyTouchUi() {
        const m = this.touchMode(), on = m === 'on' || (m === 'auto' && (Input.isTouch || IS_MOBILE));
        if (!this.el.touch) return;
        this.el.touch.classList.toggle('on', on);
        if (!on && Input.onRelease) Input.onRelease();
        // мышью на ПК при экранном управлении: курсор свободен, камера — правой кнопкой (не от каждого движения мыши)
        Input.freeLook = !on;
        if (on && Input.locked) { Input._ctrlUnlock = true; Input.unlock(); }
        if (window.HudLayout && HudLayout._inited) HudLayout.apply();
    },
};

// UiFX.js — оформление интерфейса «Лагерь»: окна — просмолённая доска с бумажной биркой заголовка, кнопки — плотная ткань
// с прострочкой и «толщиной» снизу, HUD — тёмные плашки из одного материала, шрифт Rubik (кириллица). Без бликов, ряби, свечения
// и стекла. Ещё: «шлейф урона» на шкалах, накрутка монет, ползунки, конфетти и карточка «найдена записка». Только вид.
// Стили вставляются после UI.init (Game.init → UiFX.init), поэтому перекрывают базовые правила UI.js.

/** @type {Record<string, any>} */
const UiFX = {
    _inited: false, _t: 0, trail: [], _coin: null, _coinRev: 0,

    init() {
        if (this._inited) return;
        this._inited = true;
        this.css();
        if (UI.root) UI.root.classList.toggle('liteFX', !!IS_MOBILE || Game.quality === 1);
        this.listen();
        this.bars();
        this.coins();
    },

    css() {
        const s = document.createElement('style');
        s.id = 'uifx';
        s.textContent = `
/* ============ «Лагерь»: интерфейс из походного снаряжения ============
   Материалы мира игры: просмолённая доска окон, бумажная бирка заголовка с гвоздиками, матерчатые кнопки с прострочкой,
   жёсткие тени без размытия. Палитра — хвоя, озеро, ржавчина, камень, угли, пергамент. Без бликов, ряби, свечения и стекла. */
#ui{--ink:#120e0a;--bark:#2a231b;--bark2:#352c22;--hud:rgba(24,20,15,.84);--hud2:rgba(44,37,28,.92);
--board:#1b1814;--bone:#f2e8d2;--paper:#e8dabb;--paperInk:#2c2116;
--pine:#557f3e;--pine2:#2e4a22;--lake:#3b6879;--lake2:#203d48;--rust:#a9462f;--rust2:#5e2418;--stone:#5b544a;--stone2:#38332c;
--ember:#e8843b;--gold:#e3b64e;--moss:#a8c46a;
--grain:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 .93 0 0 0 0 .82 0 0 0 .11 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
font-family:'Rubik',sans-serif;font-weight:600}
#ui .rb{-webkit-text-stroke:3px var(--ink);text-shadow:0 2px 0 rgba(0,0,0,.4);letter-spacing:.01em}
#ui .rb2{-webkit-text-stroke:2.5px var(--ink)}
#ui .rb1{-webkit-text-stroke:1.6px var(--ink)}
/* в окнах текст на тёмной доске — без обводки */
#ui .overlay:not(#ov_title) .rb,#ui .overlay:not(#ov_title) .rb1,#ui .overlay:not(#ov_title) .rb2,#ui .menu .rb1{-webkit-text-stroke:0;text-shadow:none}
#ui .li{display:inline-block;width:1.05em;height:1.05em;flex-shrink:0;vertical-align:-.16em}
#ui .li.coin{color:var(--gold)}#ui .li.heart{color:#e5604f}#ui .li.fire{color:var(--ember)}#ui .li.skull{color:#e39a8a}
/* ---------- окна ---------- */
#ui .overlay{background:radial-gradient(ellipse at 50% 45%,rgba(14,12,9,.5),rgba(6,5,4,.86) 80%);backdrop-filter:none;-webkit-backdrop-filter:none}
#ui .overlay.on{animation:skOv .14s ease-out}
@keyframes skOv{from{opacity:0}to{opacity:1}}
#ui .panel{background-color:var(--board);background-image:var(--grain),linear-gradient(180deg,rgba(255,226,180,.05),rgba(0,0,0,.24)),repeating-linear-gradient(90deg,transparent 0 119px,rgba(0,0,0,.2) 119px 121px,rgba(255,236,200,.025) 121px 122px);border:3px solid var(--ink);border-radius:12px;box-shadow:inset 0 0 0 1px rgba(242,232,210,.07),inset 0 1px 0 rgba(242,232,210,.1),0 10px 0 rgba(0,0,0,.42),0 24px 50px rgba(0,0,0,.45);animation:skPanel .18s ease-out both;z-index:1}
@keyframes skPanel{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
#ui .panel::before,#ui .panel h2::after{content:none}
#ui .panel h2{font-size:26px;font-weight:800}
/* заголовок окна — бумажная бирка на двух гвоздиках */
#ui .overlay .panel>h2{position:relative;display:block;width:fit-content;max-width:calc(100% - 96px);margin:2px auto 16px;padding:6px 28px 7px;color:var(--paperInk);-webkit-text-stroke:0;text-shadow:none;line-height:1.12;letter-spacing:.01em;
background:radial-gradient(circle at 12px 50%,#6e5a43 2.6px,rgba(0,0,0,.55) 3.2px,transparent 3.8px),radial-gradient(circle at calc(100% - 12px) 50%,#6e5a43 2.6px,rgba(0,0,0,.55) 3.2px,transparent 3.8px),var(--grain),var(--paper);
border:2px solid var(--ink);border-radius:3px;box-shadow:0 3px 0 rgba(0,0,0,.5);transform:rotate(-1deg)}
#ui .overlay .panel>h2 .glyphArt{width:1.1em;height:1.1em;margin-right:4px}
#ui .panel .close{border-radius:8px;background:var(--rust);border:2px solid var(--ink);box-shadow:0 3px 0 var(--rust2),0 5px 0 var(--ink);transition:transform .07s,box-shadow .07s,filter .12s}
#ui .panel .close:hover{transform:none;filter:brightness(1.12);background:var(--rust)}
#ui .panel .close:active{transform:translateY(3px);box-shadow:0 0 0 var(--rust2),0 2px 0 var(--ink)}
#ui .col{margin-left:auto;margin-right:auto}
#ui .panel>.col{width:min(380px,100%)}
#ui .overlay.quick .panel{animation:none}
/* ---------- кнопки: плотная ткань, прострочка, «толщина» снизу ---------- */
#ui .btn{--f:var(--pine);--s:var(--pine2);border:2px solid var(--ink);border-radius:9px;background:var(--f);background-image:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,0) 42%,rgba(0,0,0,.14)),var(--grain);
color:var(--bone);-webkit-text-stroke:0;text-shadow:0 1px 0 rgba(0,0,0,.45);font-family:'Rubik',sans-serif;font-weight:700;letter-spacing:.01em;
box-shadow:0 4px 0 var(--s),0 6px 0 var(--ink),0 9px 10px rgba(0,0,0,.22);outline:1.5px dashed rgba(242,232,210,.3);outline-offset:-6px;transition:transform .07s ease-out,box-shadow .07s ease-out,filter .12s}
#ui .btn::before,#ui .btn::after{content:none}
#ui .btn:hover{filter:brightness(1.08) saturate(1.04);transform:none}
#ui .btn:active{transform:translateY(4px);box-shadow:0 0 0 var(--s),0 2px 0 var(--ink),0 3px 4px rgba(0,0,0,.2)}
#ui .btn.blue{--f:var(--lake);--s:var(--lake2)}
#ui .btn.red{--f:var(--rust);--s:var(--rust2)}
#ui .btn.gray{--f:var(--stone);--s:var(--stone2)}
#ui .btn.dis{filter:grayscale(.8) brightness(.72)}
#ui .btn.sm{outline-width:1px;outline-offset:-5px;box-shadow:0 3px 0 var(--s),0 5px 0 var(--ink)}
#ui .btn.sm:active{box-shadow:0 0 0 var(--s),0 2px 0 var(--ink)}
#ui .btn.tutOn{box-shadow:0 4px 0 var(--s),0 6px 0 var(--ink),inset 0 0 0 2px rgba(168,196,106,.55)!important}
#ui .btn .glyphArt{width:1.25em;height:1.25em}
#ui .menuPrimary .btn{text-transform:uppercase;letter-spacing:.07em;font-weight:800}
/* ---------- вкладки и карточки ---------- */
#ui .tabs{gap:5px}
#ui .tab{background:var(--stone2);border-width:2px;border-radius:7px 7px 3px 3px;box-shadow:0 3px 0 var(--ink);transition:background .12s,transform .07s}
#ui .tab:hover{transform:none;background:#4a443b}
#ui .tab.on{background:var(--paper);color:var(--paperInk);-webkit-text-stroke:0;text-shadow:none;box-shadow:0 3px 0 var(--ink),inset 0 -4px 0 var(--c,var(--moss))}
#ui .card,#ui .sk,#ui .mode,#ui .cell,#ui .dayC,#ui .rwCard,#ui .jItem,#ui .invRight,#ui .invHead,#ui .req,#ui .stat div,#ui .padBox,#ui .qNow,#ui .botDelivery{background-color:var(--bark);background-image:var(--grain);border-width:2px;border-radius:8px;box-shadow:inset 0 1px 0 rgba(242,232,210,.08)}
#ui .card,#ui .rwCard,#ui .sk,#ui .mode,#ui .dayC,#ui .cell,#ui .jItem{transition:transform .1s,background-color .12s}
#ui .sk:hover,#ui .mode:hover,#ui .cell:hover{transform:translateY(-2px)}
#ui .card:hover,#ui .rwCard:hover,#ui .sk:hover,#ui .dayC:hover{box-shadow:inset 0 1px 0 rgba(242,232,210,.08)}
#ui .sk .rar{height:5px;border-radius:6px 6px 0 0}
#ui .sk.eq,#ui .cell.held{border-color:var(--moss)}
#ui .sk.sel,#ui .cell.sel{outline-color:var(--bone);outline-width:3px}
#ui .cell.over{background-color:#4a3f30;outline-color:var(--gold)}
#ui .mode.on{background-color:#33402a;border-color:var(--gold);box-shadow:0 0 0 2px var(--gold)}
#ui .rwCard.done,#ui .dayC.done{background-color:#2c3f24}
#ui .dayC.today{outline:3px solid var(--gold);outline-offset:1px;animation:none}
#ui .jItem:hover{transform:translateX(3px);box-shadow:none}
#ui .jItem.sel{background-color:#4a3c26;box-shadow:0 0 0 3px var(--gold);transform:translateX(4px)}
#ui .qNow{border:2px solid var(--gold);background-color:#2f2a1c}
#ui .pauseChips span,#ui .cost span,#ui .invDetail .chips span{background:rgba(18,15,11,.6);border:2px solid var(--ink);border-radius:6px;display:inline-flex;align-items:center;gap:5px}
#ui .cost span.no{background:#5e2418}#ui .cost span.ok{background:#2e4a22}
#ui .hcSw{border-width:3px;border-radius:9px;background:var(--stone2)}
#ui .hcSw.on{background:#5e2418;border-color:#c0503a;box-shadow:none}
#ui .kv{transition:background .15s;border-radius:6px;padding-left:6px;padding-right:6px;border-bottom:1px dashed rgba(242,232,210,.12)}
#ui .kv:hover{background:rgba(242,232,210,.05)}
#ui .pbar i,#ui .fuelbar i{background:var(--ember);box-shadow:inset 0 2px 0 rgba(255,255,255,.18)}
#ui .ctlRow .kb,#ui .ctrl kbd{background:var(--bone);color:var(--paperInk);border-width:2px;border-radius:6px;box-shadow:0 2px 0 #8f8572}
#ui .ctlRow .kb.wait{background:var(--gold);animation:none}
#ui .padFocus{outline:3px solid var(--gold)!important;box-shadow:none}
#ui ::-webkit-scrollbar{width:10px;height:10px}
#ui ::-webkit-scrollbar-thumb{background:#5b544a;border-radius:5px;border:2px solid #15120e}
#ui ::-webkit-scrollbar-track{background:rgba(0,0,0,.28);border-radius:5px}
#ui input[type=range].slider{-webkit-appearance:none;appearance:none;height:12px;border-radius:6px;background:linear-gradient(90deg,var(--moss) var(--p,50%),#15120e var(--p,50%));border:2px solid var(--ink);outline:none;cursor:pointer}
#ui input.slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:6px;background:var(--bone);border:2px solid var(--ink);box-shadow:0 2px 0 rgba(0,0,0,.45)}
#ui input.slider::-moz-range-thumb{width:18px;height:18px;border-radius:5px;background:var(--bone);border:2px solid var(--ink)}
#ui .big,#ui .stat b{font-family:'Rubik',sans-serif;font-weight:900;letter-spacing:.01em}
/* ---------- титул ---------- */
#ui .title{background:radial-gradient(ellipse at 50% 50%,transparent 38%,rgba(6,5,4,.5) 100%)}
#ui .title .menu{background-color:var(--board);background-image:var(--grain),linear-gradient(180deg,rgba(255,226,180,.05),rgba(0,0,0,.24)),repeating-linear-gradient(90deg,transparent 0 119px,rgba(0,0,0,.2) 119px 121px,rgba(255,236,200,.025) 121px 122px);border:3px solid var(--ink);border-radius:12px;box-shadow:inset 0 0 0 1px rgba(242,232,210,.07),0 10px 0 rgba(0,0,0,.42),0 24px 50px rgba(0,0,0,.4)}
#ui .menuTools{border-top:2px dashed rgba(242,232,210,.16)}
#ui .logo{animation:skLogo .5s ease-out both;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))}
@keyframes skLogo{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
#ui .logo .l1{font-family:'Rubik',sans-serif;font-weight:900;letter-spacing:-.05em;color:var(--bone);-webkit-text-fill-color:var(--bone);-webkit-text-stroke:5px var(--ink);text-shadow:0 7px 0 #8a3d17,0 10px 0 var(--ink);filter:none}
#ui .logo .l2{font-family:'Rubik',sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:.1em;transform:none;color:var(--bone)}
#ui .logo .l3,#ui .logo .logoLead{text-transform:uppercase;letter-spacing:.2em;color:var(--moss);font-weight:800}
#ui .bestTag{background:var(--hud);border:2px solid var(--ink);border-radius:6px;box-shadow:0 3px 0 rgba(0,0,0,.45)}
#ui .saveInfo{color:var(--moss)}
/* ---------- HUD: плашки из одного материала ---------- */
#ui #coinBox,#ui #evChip,#ui .feedItem,#ui #prompt,#ui #sackChip,#ui #hcTag,#ui #lockHint,#ui .bpRow,#ui .bTag .bn{background:var(--hud);border:2px solid var(--ink);border-radius:8px;box-shadow:inset 0 0 0 1px rgba(242,232,210,.08),0 3px 0 rgba(0,0,0,.45)}
#ui #evChip{border-color:var(--ember);animation:none}
#ui #hcTag{border-color:#b8432f;color:#f0a090}
/* подсказка туториала — листок из полевого журнала: тёмные чернила на бумаге, без обводки */
#ui #tipBox{background:var(--grain),var(--paper);border:2px solid var(--ink);border-left:6px solid var(--ember);border-radius:6px;box-shadow:0 4px 0 rgba(0,0,0,.45)}
#ui #tipBox .tt{color:#9a3f16;-webkit-text-stroke:0;text-shadow:none;font-weight:800}
#ui #tipBox .tb{color:var(--paperInk);-webkit-text-stroke:0;text-shadow:none;font-weight:600}
#ui #tipBox .tk{color:#6b5a44;opacity:1;-webkit-text-stroke:0;text-shadow:none}
#ui #lockHint{display:flex;align-items:center;gap:8px;-webkit-text-stroke:0;text-shadow:0 1px 0 rgba(0,0,0,.5);color:var(--bone)}
#ui #lockHint .mouseR{width:26px;height:26px;flex-shrink:0}
#ui #tipBox .tx{border-radius:7px;background:var(--rust);border:2px solid var(--ink);box-shadow:0 2px 0 var(--ink)}
#ui .rbtn{border-radius:9px;background:var(--hud);border:2px solid var(--ink);box-shadow:inset 0 0 0 1px rgba(242,232,210,.1),0 3px 0 rgba(0,0,0,.5);transition:transform .07s,background .12s}
#ui .rbtn:hover{background:var(--hud2);transform:none;box-shadow:inset 0 0 0 1px rgba(242,232,210,.18),0 3px 0 rgba(0,0,0,.5)}
#ui .rbtn:active{transform:translateY(2px)}
#ui #giftDot,#ui #noteDot{position:absolute;right:-4px;top:-4px;min-width:14px;height:14px;padding:0 3px;border-radius:7px;background:var(--ember);border:2px solid var(--ink);display:none;align-items:center;justify-content:center;font-size:10px;-webkit-text-stroke:0}
#ui #btnNotes{position:relative}
#ui .rdot{width:11px;height:11px;border-radius:50%;background:var(--ember);border:2px solid var(--ink);box-shadow:0 0 0 1.5px rgba(242,232,210,.55)}
#ui #dayText{font-family:'Rubik',sans-serif;font-weight:800;font-style:normal;text-transform:uppercase;letter-spacing:.08em;transform:none;font-size:clamp(20px,3.4vh,34px)}
#ui #dayArc{border-radius:4px;border-width:2px;background:rgba(18,15,11,.7)}
#ui #dayMark{border-radius:2px;background:var(--bone);border-color:var(--ink)}
#ui .bar{border-radius:6px;background:rgba(18,15,11,.82);border:2px solid var(--ink);box-shadow:0 3px 0 rgba(0,0,0,.4)}
#ui .bar i{z-index:1;border-radius:4px;box-shadow:inset 0 2px 0 rgba(255,255,255,.16);overflow:hidden}
#ui .bar i::before,#ui .bar i::after{content:none}
#ui .bar::after{content:'';position:absolute;inset:0;border-radius:4px;background:repeating-linear-gradient(90deg,transparent 0 calc(10% - 2px),rgba(0,0,0,.32) calc(10% - 2px) 10%);pointer-events:none;z-index:1}
#ui .bar u{position:absolute;inset:0 auto 0 0;border-radius:4px;background:rgba(242,232,210,.32);z-index:0;transition:width .6s ease-out .25s;width:100%}
#ui .bar .ic{z-index:2;border-radius:9px;background:var(--bark);border:2px solid var(--ink);box-shadow:0 2px 0 rgba(0,0,0,.45)}
#ui .bar .num{z-index:2}
#ui #barHp i{background:#6aa84a}
#ui #barHunger i{background:#d9822e}
#ui #barSta i{background:#d8b23a}
#ui .slot{border-radius:8px;background:var(--hud);border-width:2px;box-shadow:inset 0 0 0 1px rgba(242,232,210,.08),0 3px 0 rgba(0,0,0,.45)}
#ui .slot:hover{transform:translateY(-2px)}
#ui .slot.sel{border-color:var(--bone);background:var(--hud2);box-shadow:0 0 0 2px var(--ink),0 4px 0 rgba(0,0,0,.45);animation:none}
#ui #objBox{padding:6px 20px 6px 26px;border-radius:8px;background:var(--hud);border:2px solid var(--ink);box-shadow:inset 0 0 0 1px rgba(242,232,210,.08),0 4px 0 rgba(0,0,0,.4);width:max-content;max-width:92vw}
#ui #objBox::before{content:'';position:absolute;left:9px;top:50%;width:5px;height:58%;transform:translateY(-50%);border-radius:2px;background:var(--ember)}
#ui #objDesc{width:max-content;max-width:min(640px,90vw);padding:4px 16px;border-radius:6px;background:rgba(20,17,13,.66);border:1.5px solid rgba(242,232,210,.12)}
#ui #prompt .key{background:var(--bone);color:var(--paperInk);border:2px solid var(--ink);border-radius:6px;box-shadow:0 3px 0 #8f8572}
#ui #prompt .key::before{content:none}
#ui #toast{padding:8px 24px;border-radius:8px;background:var(--hud);border:2px solid var(--ink);box-shadow:inset 0 0 0 1px rgba(242,232,210,.08),0 5px 0 rgba(0,0,0,.45);-webkit-text-stroke:0;text-shadow:0 2px 0 rgba(0,0,0,.55)}
#ui #toast[data-k=good]{box-shadow:inset 0 -4px 0 var(--moss),0 5px 0 rgba(0,0,0,.45)}
#ui #toast[data-k=warn]{box-shadow:inset 0 -4px 0 var(--ember),0 5px 0 rgba(0,0,0,.45)}
#ui #toast[data-k=info]{box-shadow:inset 0 -4px 0 #7fa9bd,0 5px 0 rgba(0,0,0,.45)}
#ui #toast[data-k=sleep]{font-size:18px;line-height:1.2;padding:8px 12px;max-width:calc(100vw - 28px);width:max-content;box-shadow:inset 0 -4px 0 #7fa9bd,0 5px 0 rgba(0,0,0,.45)}
#ui #banner .t{font-family:'Rubik',sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:.04em;filter:none}
#ui #banner .s{text-shadow:0 2px 0 rgba(0,0,0,.55)}
#ui #compass{background:rgba(20,17,13,.72);border:3px solid var(--ink);box-shadow:0 0 0 2px rgba(242,232,210,.12),0 4px 0 rgba(0,0,0,.4)}
#ui #fireTag .fb{border-radius:5px;border-width:2px}
#ui #fireTag .fb i{background:#6aa84a}#ui #fireTag.low .fb i{background:var(--ember)}
#ui .bpRow .bpBar i,#ui .bTag .bb i{background:#7fb75a}
#ui .tbtn{background:rgba(24,20,15,.55);border:2px solid rgba(18,14,10,.9);box-shadow:inset 0 0 0 2px rgba(242,232,210,.12)}
#ui .tbtn:active,#ui .tbtn.dn{background:rgba(242,232,210,.3)}
#ui #stickBase{background:rgba(24,20,15,.32);border:2px solid rgba(18,14,10,.8);box-shadow:inset 0 0 0 2px rgba(242,232,210,.1)}
#ui #stickKnob{background:rgba(242,232,210,.6);border:2px solid var(--ink)}
/* карточка «найдена записка» — листок из журнала */
#ui .noteCard{position:absolute;left:calc(14px + env(safe-area-inset-left));bottom:200px;display:flex;align-items:center;gap:12px;max-width:min(360px,80vw);padding:10px 16px 10px 10px;border-radius:4px;background:var(--grain),var(--paper);color:var(--paperInk);border:2px solid var(--ink);box-shadow:0 5px 0 rgba(0,0,0,.4);transform:rotate(-1deg);pointer-events:auto;cursor:pointer;animation:skNote .3s ease-out both}
#ui .noteCard.out{animation:skNoteOut .35s ease-in forwards}
@keyframes skNote{from{transform:translateX(-30px) rotate(-1deg);opacity:0}to{transform:rotate(-1deg);opacity:1}}
@keyframes skNoteOut{to{transform:translateX(-30px) rotate(-1deg);opacity:0}}
#ui .noteCard .nci{flex:0 0 48px;height:48px;border-radius:6px;background:rgba(120,80,20,.14);border:2px solid var(--ink);display:flex;align-items:center;justify-content:center;font-size:28px}
#ui .noteCard .nct{font-size:14px;color:#8a5a20;-webkit-text-stroke:0}
#ui .noteCard .ncn{font-size:20px;line-height:1.05;color:#4a2e0c;-webkit-text-stroke:0;font-weight:800}
#ui .noteCard .nch{font-size:12px;margin-top:3px;color:#6a4a24;-webkit-text-stroke:0;font-weight:600}
/* конфетти */
#ui .cf{position:absolute;top:-24px;pointer-events:none;will-change:transform,opacity;z-index:30}
/* Safe areas, narrow windows and inexpensive mobile presentation. */
#ui .overlay{padding:calc(8px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) calc(8px + env(safe-area-inset-left))}
#ui .panel{min-width:0;max-width:100%;max-height:100%;width:min(620px,100%);overscroll-behavior:contain}
#ui .panel.rwP{width:min(860px,100%)}#ui .panel.jrnP{width:min(940px,100%)}#ui .panel.invP{width:min(1080px,100%)}
#ui .panel h2{padding:0 40px;overflow-wrap:anywhere}#ui .panel .btn{white-space:normal;overflow-wrap:anywhere}
#ui .overlay.quick{animation:none}#ui .bar.hide u{transition:none;opacity:0}
#ui.noticeBusy #prompt,#ui.noticeBusy #waypoint,#ui.noticeBusy #fireTag{visibility:hidden}
#ui .overlay[id=ov_shop] .panel{--gold:#8fd8ff}#ui .overlay[id=ov_journal] .panel{--gold:#e4c48e}#ui .overlay[id=ov_fire] .panel{--gold:#ff9f54}#ui .overlay[id=ov_campchest] .panel{--gold:#dfb06b}
#ui.liteFX .overlay{backdrop-filter:none;-webkit-backdrop-filter:none}#ui.liteFX .ffs,#ui.liteFX .cf{display:none}
#ui.liteFX .panel{box-shadow:inset 0 0 0 1px rgba(242,232,210,.07),0 8px 0 rgba(0,0,0,.42);animation:none}
#ui.liteFX .overlay,#ui.liteFX .overlay *{animation:none!important;transition:none!important}
#ui.liteFX .panel::before,#ui.liteFX .bar i::before,#ui.liteFX .pbar i::after{display:none}
#ui.liteFX #hearts svg,#ui.liteFX .slot,#ui.liteFX #coinBox .ci,#ui.liteFX .dayC,#ui.liteFX .jn{animation:none!important}
#ui .saveCode{width:100%;height:150px;resize:vertical;user-select:text;-webkit-user-select:text;font:14px monospace;color:#1c2433;background:#eef3fb;border:3px solid #000;border-radius:10px;padding:10px}
@media(max-width:600px){#ui .panel{padding:14px 10px}#ui .kv{gap:8px;flex-wrap:wrap;font-size:17px}#ui .slider{max-width:52vw}#ui .rwCard{gap:6px;padding:7px 6px}#ui .rwCard .ic{flex-basis:32px;width:32px;height:32px;font-size:20px}#ui .ctlRow .kb{min-width:64px;font-size:14px;padding:4px}#ui .jItem{min-width:0;overflow-wrap:anywhere}#ui .jPaper{padding:14px 12px}#ui .panel h2{font-size:25px}}
@media(prefers-reduced-motion:reduce){#ui *,#ui *::before,#ui *::after{animation:none!important;transition:none!important}#ui .ffs,#ui .cf{display:none}}
/* Положение и размеры HUD под экран считает HudLayout.js (переменные на #ui) — здесь только оформление. */
/* Окна — над всем HUD: числа и значки шкал (z-index 2) иначе просвечивали поверх панели. */
#ui #panels{position:absolute;inset:0;z-index:25;pointer-events:none}
/* Невысокий альбом (телефон, iframe платформы): окна компактнее, чтобы главное помещалось без прокрутки. */
@media(orientation:landscape) and (max-height:430px){#ui .overlay{padding:calc(4px + env(safe-area-inset-top)) calc(6px + env(safe-area-inset-right)) calc(4px + env(safe-area-inset-bottom)) calc(6px + env(safe-area-inset-left))}#ui .panel{padding:10px 12px 12px;border-radius:10px;border-width:3px}#ui .panel h2{font-size:22px;margin:0 0 6px;padding:0 38px}#ui .panel h2::after{margin-top:4px;height:3px}#ui .panel .close{right:6px;top:6px;width:34px;height:34px}#ui .panel .close svg{width:18px;height:18px}#ui .panel .btn{min-height:38px;font-size:17px;padding:4px 14px;border-width:2px;-webkit-text-stroke:0}#ui .overlay .panel>h2{margin:0 auto 8px;padding:3px 20px 4px}#ui .panel .btn.sm{min-height:32px;font-size:15px}#ui .hint{font-size:13px;margin:3px auto}#ui .kv{font-size:16px;padding:2px 0}#ui .row{gap:8px}#ui .col{gap:7px}#ui .modeP{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;align-items:center}#ui .modeP>*{grid-column:1/-1}#ui .modeP .modeRow{gap:6px;margin:6px 0 2px}#ui .modeP .mode{padding:6px 4px;border-width:2px;border-radius:8px}#ui .modeP .mode .ic{font-size:21px}#ui .modeP .mode h3{font-size:16px;margin:2px 0}#ui .modeP .mode p{font-size:11px;line-height:1.15}#ui .modeP>.hcRow{grid-column:1;grid-row:4;justify-content:flex-start;margin:6px 0 0}#ui .modeP .hcSw{font-size:14px;padding:4px 10px;gap:8px;border-width:2px;border-radius:8px}#ui .modeP .hcSw>span:first-child{font-size:20px!important}#ui .modeP .hcSw small{font-size:11px}#ui .modeP>.btn[data-pad-key=newgame-start]{grid-column:2;grid-row:4;margin:6px 0 0!important}#ui .modeP>.botDelivery{grid-row:5;margin:6px 0 0;padding:4px 8px}#ui .botDelivery .hint{display:none}#ui .pauseChips{margin:0 0 6px;gap:5px}#ui .pauseChips span{font-size:13px;padding:1px 8px;border-width:2px}#ui .pauseGrid{gap:6px}#ui .pauseGrid .btn{font-size:16px;padding:4px 8px}#ui .pauseCol{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:7px}#ui .pauseCol>*{grid-column:1/-1}#ui .pauseCol>:first-child{grid-column:1;grid-row:1}#ui .pauseCol>:last-child{grid-column:2;grid-row:1;min-height:38px}#ui .big{font-size:30px}#ui .sub{font-size:15px;margin:2px 0 6px}#ui .hearts4{margin:2px 0 4px;gap:6px}#ui .hearts4 svg{width:30px;height:30px}#ui .stat{margin:4px 0 6px;gap:8px}#ui .stat div{min-width:70px;padding:3px 8px;font-size:13px}#ui .stat b{font-size:22px}#ui .panel:has(.deathCol){width:min(700px,96vw)!important}#ui .deathCol{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:10px;row-gap:3px!important;align-items:start}#ui .deathCol>.hint{margin:0;font-size:12px}#ui .deathCol>:nth-child(1){grid-area:1/1}#ui .deathCol>:nth-child(2){grid-area:2/1}#ui .deathCol>:nth-child(3){grid-area:1/2}#ui .deathCol>:nth-child(4){grid-area:2/2}#ui .deathCol>:nth-child(5){grid-area:3/1/4/3;justify-self:center;margin-top:4px}#ui .req{padding:3px 8px;font-size:15px;border-width:2px}#ui .req img{width:24px;height:24px}#ui .fuelbar{height:14px}#ui .card{padding:5px 8px;gap:8px}#ui .card img{width:36px;height:36px}#ui .card .nm{font-size:16px}#ui #panels .rwP .tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-bottom:6px}#ui #panels .rwP .tab{padding:3px 4px;font-size:13px;white-space:nowrap}#ui .dayRow{gap:4px;margin:4px 0}#ui .dayC{padding:3px 2px}#ui .dayC .dc{font-size:15px}#ui .dayC .dh{font-size:14px}}
/* Узкий портрет: пауза в две колонки, «Продолжить» и «В меню» рядом; низкий портрет — окна плотнее. */
@media(orientation:portrait) and (max-width:480px){#ui .pauseGrid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}#ui .pauseGrid .btn{font-size:15px;padding:6px}#ui .pauseCol{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}#ui .pauseCol>*{grid-column:1/-1}#ui .pauseCol>:first-child{grid-column:1;grid-row:1}#ui .pauseCol>:last-child{grid-column:2;grid-row:1;min-height:48px}#ui .pauseChips{gap:5px;margin:0 0 8px}#ui .pauseChips span{font-size:13px;padding:1px 7px;border-width:2px}#ui .botDelivery .hint{display:none}}
@media(orientation:portrait) and (max-height:700px){#ui .panel{padding:10px 10px 12px}#ui .panel h2{font-size:22px;margin-bottom:6px}#ui .modeP .mode p{display:none}#ui .modeP .mode{padding:6px 4px}#ui .modeP .modeRow{margin:8px 0 4px}#ui .modeP>.hint{font-size:13px;margin:2px auto}#ui .modeP .hcRow{margin:6px 0 0}#ui .modeP .hcSw{font-size:14px;padding:5px 8px;gap:6px}#ui .modeP .hcSw small{font-size:11px}#ui .botDelivery{margin:6px 0 2px;padding:5px 8px}#ui .botDelivery .kv{font-size:15px;align-items:center}#ui .botDelivery .btn{min-height:34px!important;font-size:15px!important;padding:2px 10px}#ui .big{font-size:32px}#ui .hearts4{margin:2px 0 6px}#ui .hearts4 svg{width:38px;height:38px}#ui .deathCol>.hint{font-size:12px;margin:0 auto}#ui .panel .btn{min-height:42px;font-size:18px}}
@media(orientation:landscape) and (max-height:340px){#ui .modeP>.hint{display:none}#ui .modeP .mode p{display:none}#ui .panel h2{font-size:20px}#ui .pauseGrid{grid-template-columns:repeat(3,minmax(0,1fr))}}
/* узкие экраны: бирка заголовка в одну строку, широкий шрифт кнопок не рвёт слова */
@media(orientation:portrait) and (max-width:480px){#ui .panel h2{font-size:20px}#ui .overlay .panel>h2{padding:4px 22px 5px;margin-bottom:10px}#ui .pauseCol>.btn{font-size:19px;padding:6px 8px}}
@media(orientation:landscape) and (max-height:430px){#ui .panel h2{font-size:19px}}
`;
        document.head.appendChild(s);
    },

    // ---- события: положение заливки ползунков; окно, открытое повторно, — без анимации появления
    listen() {
        document.addEventListener('input', (e) => {
            const t = /** @type {HTMLInputElement} */ (e.target);
            if (t && t.classList && t.classList.contains('slider')) t.style.setProperty('--p', ((+t.value - +t.min) / Math.max(1, +t.max - +t.min) * 100) + '%');
        }, true);
        const host = UI.el.panels;
        if (!host) return;
        new MutationObserver((muts) => {
            for (const m of muts) {
                for (const n of Array.from(m.removedNodes)) if (n instanceof HTMLElement && n.classList.contains('overlay')) this._rm = { id: n.id, t: performance.now() };
                for (const n of Array.from(m.addedNodes)) {
                    if (!(n instanceof HTMLElement) || !n.classList.contains('overlay')) continue;
                    const quick = !!(this._rm && this._rm.id === n.id && performance.now() - this._rm.t < 250);
                    this.decorate(n, quick);
                }
            }
        }).observe(host, { childList: true });
    },
    decorate(ov, quick) {
        if (quick) ov.classList.add('quick');
        for (const sl of Array.from(ov.querySelectorAll('input.slider'))) { const t = /** @type {HTMLInputElement} */ (sl); t.style.setProperty('--p', ((+t.value - +t.min) / Math.max(1, +t.max - +t.min) * 100) + '%'); }
    },

    // ---- шкалы: «шлейф урона» — светлая полоса догоняет текущее значение с задержкой
    bars() {
        for (const b of Array.from(document.querySelectorAll('#ui .bar'))) {
            const fill = b.querySelector('i'); if (!fill) continue;
            const u = document.createElement('u'); b.insertBefore(u, fill);
            this.trail.push({ fill, u, w: 100 });
        }
    },
    update(dt) {
        this._t -= dt;
        if (this._t > 0) return;
        this._t = 0.08;
        for (const t of this.trail) {
            const w = parseFloat(t.fill.style.width) || 0;
            const hidden = !UI.hudOn || t.fill.parentElement.classList.contains('hide');
            if (hidden) { t.u.style.transition = 'none'; t.u.style.width = w + '%'; t.w = w; continue; }
            if (w === t.w) continue;
            // вверх — мгновенно, вниз — с задержкой (CSS transition на u)
            t.u.style.transition = w > t.w ? 'none' : '';
            t.u.style.width = Math.max(0, w) + '%';
            t.w = w;
        }
    },

    // ---- счётчик монет «накручивается» вместо мгновенной смены
    coins() {
        const orig = UI.setCoins;
        UI.setCoins = function (n, delta) {
            orig.call(UI, n, delta);
            const el = UI.el.coinNum; if (!el) return;
            const from = UiFX._coin != null ? UiFX._coin : n - (delta || 0);
            const revision = ++UiFX._coinRev;
            UiFX._coin = n;
            if (!delta || Math.abs(delta) < 2) { el.textContent = String(n); return; }
            const t0 = performance.now(), dur = Math.min(900, 350 + Math.abs(delta) * 6);
            const step = (now) => {
                if (revision !== UiFX._coinRev) return;
                const k = Math.min(1, (now - t0) / dur), v = Math.round(from + (n - from) * (1 - Math.pow(1 - k, 3)));
                el.textContent = String(v);
                if (k < 1 && UiFX._coin === n) requestAnimationFrame(step); else el.textContent = String(UiFX._coin);
            };
            requestAnimationFrame(step);
        };
    },

    // ---- карточка «найдена записка» (игрок или напарник); клик открывает журнал на этой записке
    noteCard(n, by) {
        const root = UI.root; if (!root) return;
        const L = Lang.code === 'en' ? 1 : 0;
        for (const old of Array.from(root.querySelectorAll('.noteCard'))) old.remove();
        const c = document.createElement('div'); c.className = 'noteCard';
        c.innerHTML = '<div class="nci">📜</div><div><div class="nct"></div><div class="ncn"></div><div class="nch"></div></div>';
        c.querySelector('.nct').textContent = by ? Lang.t('lore.botFound', { n: by }) : Lang.t('lore.newNote');
        c.querySelector('.ncn').textContent = n.name[L];
        c.querySelector('.nch').textContent = Lang.t('lore.hint');
        c.onclick = () => { c.remove(); UI.open('journal', { id: n.id }); };
        root.appendChild(c);
        this.confetti(26, { colors: ['#ffd24a', '#fff2a0', '#f3e8c8'], y: 0.6 });
        setTimeout(() => { c.classList.add('out'); setTimeout(() => c.remove(), 480); }, 7000);
    },

    // ---- конфетти: n кусочков падают сверху (Web Animations, без нагрузки на игру)
    confetti(n, o) {
        const root = UI.root; if (!root || !root.animate || root.classList.contains('liteFX')) return;
        const opt = o || {}, cols = opt.colors || ['#ffd24a', '#ff6a5a', '#6ec8ff', '#7dff9a', '#d58bff', '#ffffff'];
        const W = window.innerWidth, H = window.innerHeight;
        for (let i = 0; i < Math.min(80, n || 30); i++) {
            const e = document.createElement('i'); e.className = 'cf';
            const sz = 6 + Math.random() * 9;
            e.style.cssText = 'left:' + Math.round(Math.random() * W) + 'px;width:' + sz + 'px;height:' + (sz * (0.5 + Math.random() * 0.8)) + 'px;background:' + cols[i % cols.length] + ';border-radius:' + (Math.random() < 0.4 ? '50%' : '2px');
            root.appendChild(e);
            const dx = (Math.random() - 0.5) * 240, rot = (Math.random() - 0.5) * 900, dur = 1500 + Math.random() * 1400, start = (opt.y || 0.0) * 0;
            const a = e.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(' + dx + 'px,' + (H * (0.55 + Math.random() * 0.5)) + 'px) rotate(' + rot + 'deg)', opacity: 0.9, offset: 0.8 }, { transform: 'translate(' + dx * 1.2 + 'px,' + (H + 40) + 'px) rotate(' + rot * 1.2 + 'deg)', opacity: 0 }], { duration: dur, delay: Math.random() * 350 + start, easing: 'cubic-bezier(.3,.6,.5,1)' });
            a.onfinish = () => e.remove();
            setTimeout(() => e.remove(), dur + 900);
        }
    },
};

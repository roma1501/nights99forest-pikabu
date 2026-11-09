// Game.js — оркестр игры «99 Nights in the Forest»: загрузка мира, состояния (меню / игра / пауза / смерть / финал),
// цикл кадра, цели (Quest), сохранение, события суток. Модули: Sky, World, Player, Cam, Camp, Zones, Enemies, Items,
// Combat, FX, Sfx, UI (+UIPanels), Interact, Input.

/** @type {Record<string, any>} */
const Game = {
    app: null, state: 'boot', view: null,
    quest: null,
    best: 0,
    save: null,
    runStart: 0,
    sleepCam: false,
    _ambT: 0,

    async init(app) {
        this.app = app;
        const loc = app.location, view = this.view = loc.view;
        const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('world3d'));
        // камера движка отключается — свою ведёт Cam
        app.camera.detach(); app.camera.update = () => {};
        Input.init(canvas);
        Input.wantLock = () => this.state === 'play' && !UI.blocking() && !Player.dead && !UI.touchVisible();
        Input.onUnlock = () => { if (this.state === 'play' && !UI.blocking() && !Player.dead && !this._ignoreUnlock) this.pause(); };
        const T0 = performance.now(), tick = (n) => { (window.__tl = window.__tl || []).push('load ' + n + ' ' + Math.round(performance.now() - T0)); };
        Sfx.init(); tick('sfx');
        Sky.init(view); tick('sky');
        LoadingScreen.set(84, 'loading');
        await World.init(app); tick('world');
        LoadingScreen.set(88, 'loading');
        Cam.init(view);
        this.perfInit();
        await Items.init(view); tick('items');
        await Player.init(app, view); tick('player');
        FX.init(app, view);
        Combat.init(view);
        if (window.Archery) Archery.init(view);
        await Camp.init(app, view); tick('camp');
        await Zones.init(app, view); tick('zones');
        await Enemies.init(view); tick('enemies');
        UI.init(app);
        Inv.reset();
        this.loadMeta();
        this.quality = Number(Store.get(GAME_ID + '.quality')) || (IS_MOBILE ? 2 : 3);
        Cam.sens = Number(Store.get(GAME_ID + '.sens')) || 1;
        this.applyQuality();
        Zones.prepare(loc); Econ.load(); Player.applySkin(Econ.skin); tick('zones.prepare');
        FX.ambientMotes(() => ({ x: Player.x, y: Player.y, z: Player.z }));
        this.quest = Quests; Quests.init();
        // второй слой: достижения и награды, записки, карта, управление и настройки
        Input.loadBinds(); this.loadSettings();
        if (window.Ach) Ach.init();
        if (window.Lore) Lore.init();
        if (window.MapView) MapView.init(app);
        if (window.Hud3) Hud3.init();
        if (window.UiFX) UiFX.init();
        if (window.HudLayout) HudLayout.init();
        // события суток
        Sky.on('dusk', (d) => { UI.banner(Lang.t('duskT'), Lang.t('duskS'), '#ffb06a'); Sfx.ui('gong'); this.autosave('dusk'); });
        Sky.on('night', (d) => { if (this.state === 'play') { Events.onNight(); UI.banner(Lang.t('nightT', { n: d }), Lang.t('nightS'), '#8aa4ff'); Enemies.onNight(); this.autosave('night'); } });
        Sky.on('dawn', (d) => { Enemies.onDawn(); Events.onDawn(); });
        Sky.on('day', (d) => { if (this.state === 'play') { Camp.newDay(); Econ.onNewDay(d); Quests.event('day', 1); this.track('progression_completed', { step_id: 'night', step_index: d - 1, mode: this.hardcore ? 'hardcore' : 'normal' }); if (d >= DATA.time.totalNights + 1) { if (!Events.finalDawn()) this.ending(true); } else { UI.banner(Lang.t('dayT', { n: d }), Lang.t('daySurvived'), '#ffe8a0'); Sfx.ui('dawn'); this.autosave(); } } });
        Pause.onChange(() => { if (Pause.has('auto')) Input.releaseAll(); });
        app.onFrame(dt => this.pausedFrame(dt));
        this.state = 'menu';
        this.enterMenu(true);
        window.game = this;
    },

    // Меню уже на экране. CrazyGames: новый игрок сразу в игре, без меню (требование площадки), — игра готовится
    // под экраном загрузки; вернувшийся игрок видит меню с «Продолжить» (один клик).
    async ready() {
        if (Platform.name !== 'crazygames' || this.hasSave || this.best > 0 || Store.get(GAME_ID + '.played')) return;
        Store.set(GAME_ID + '.played', '1');
        await new Promise((resolve) => {
            this.startGame(true, { bots: this.newgameBots | 0 });
            const wait = () => { if (this.state === 'play') resolve(true); else setTimeout(wait, 50); };
            wait();
        });
    },

    // ------------------------------------------------------------------------------ меню
    enterMenu(first) {
        this.state = 'menu';
        Input.unlock();
        Input.enabled = false;
        UI.showHud(false); UI.close();
        Cam.mode = 'orbit';
        Cam.orbit.cx = Camp.x; Cam.orbit.cz = Camp.z; Cam.orbit.r = 780; Cam.orbit.h = 320; Cam.orbit.ty = 130; Cam.orbit.speed = 0.07;
        // игрок стоит у костра, «позирует»
        if (!Player.dead) { }
        Player.spawn(Camp.x + 150, Camp.z + 250);
        Player.faceYaw = Math.atan2(Camp.x - Player.x, Camp.z - Player.z) + 0.5; Player.apply();
        Player.control = false;
        Sky.p = 0.56; Sky.speed = 0.4; Sky.frozen = false;
        Sfx.startLoops(); Sfx.want.menu = true;
        UIPanels.open('title');
        Platform.gameplay(false);
    },

    startGame(fresh, opts) {
        // «Продолжить»: сначала убеждаемся, что есть что загружать; иначе говорим об этом, а не начинаем игру с нуля
        let saved = null;
        this._roundCounted = false;
        if (!fresh) {
            saved = Save.load();
            if (!saved) {
                UI.toast(Lang.t(Save.problem === 'newer' ? 'save.newer' : Save.problem === 'corrupt' ? 'save.corrupt' : 'save.none'), 'warn');
                Save.refreshInfo(); UIPanels.open('title');
                return;
            }
        }
        UI.fade(1, 0.5);
        setTimeout(() => {
            Enemies.clear(); Combat.clear(); Items.clear(); Tween.clear(); if (window.Bots) Bots.clear(); if (window.AttackFX) AttackFX.clear(); if (window.Archery) Archery.clear();
            if (saved) {
                let ok = true;
                try { this.applySave(saved); } catch (e) { console.error('applySave:', e); ok = this._recoverLoad(); }
                if (!ok) { UI.fade(0, 0.5); this.enterMenu(); Save.refreshInfo(); UIPanels.open('title'); UI.toast(Lang.t('save.loadFail'), 'warn'); return; }
            } else this.newRun(opts || {});
            UIPanels.close();
            this.state = 'play'; Input.enabled = true;
            Cam.mode = 'follow'; Cam.yaw = Player.faceYaw; Cam.pitch = 0.36; Cam.distTarget = 4.6 * M; Cam.dist = 4.6 * M; Cam.smoothFocus = true; Cam.shoulder = 0; Cam.focus.set(Player.x, Player.y + 145, Player.z);
            Player.control = true;
            UI.showHud(true);
            Sfx.want.menu = false; Sfx.want.chase = false;
            UI.fade(0, 1.0);
            Cam.smoothFocus = true;
            Sky.speed = 1;
            Platform.gameplay(true);
            this.track('progression_started', { step_id: 'run', step_index: Sky.day, mode: this.hardcore ? 'hardcore' : 'normal', resumed: !!saved });
            this.runStart = performance.now();
            Input.lock();
            if (!saved) UI.banner(Lang.t('dayT', { n: 1 }), Lang.t('startHint'), '#ffe8a0');
            else UI.toast(Lang.t('save.loaded', { d: Sky.day }), 'good');
            // новая партия сразу перезаписывает старое сохранение, чтобы «Продолжить» не вернуло прошлую игру
            if (!saved) setTimeout(() => Save.flush('start', true), 1500);
        }, 560);
    },

    // Закрыть мир: деревья целы, зоны не построены, враги не созданы; стартовый туман
    resetWorld() {
        Enemies.clear(); Zones.clearAll(); World.resetChunks();
        if (window.Lore) Lore.clear();
        this.zonesOpen = 0;
        World.openTo(DATA.fire[1].fog * M + 300, true);
    },

    // Открыть зоны до уровня костра. announce — апгрейд костра: баннер и эффект; fresh — разложить добычу
    openLevel(level, fresh, announce) {
        const from = this.zonesOpen || 0;
        World.openTo(DATA.fire[level].fog * M + 300, !announce);
        Zones.openLevel(level, fresh);
        Enemies.populate(this.app.location, level);
        this.zonesOpen = level;
        if (announce && level > from) {
            const z = DATA.zones[level - 1];
            UI.banner(Lang.t('zoneOpen'), Lang.t('zone.' + z.id), '#8aff9a');
            Sfx.ui('fanfare');
            if (window.Quests) Quests.event('zone', level);
            UI.toast(Lang.t('zoneSub.' + z.id), 'good');
        }
    },

    newRun(opts) {
        this.botMode = opts.bots || 0;
        this.hardcore = !!opts.hardcore;
        this.hcRevived = false;
        this.runId = Date.now(); Save.playMs = 0; Save.since = 0; Save.seq = Math.max(Save.seq, Save.lastSeq());
        Econ.resetHearts(this.hardcore);
        if (window.Lore) Lore.reset();
        if (window.MapView) MapView.reset();
        this.resetWorld();
        Inv.reset();
        Inv.add('axe_old', 1); Inv.add('flashlight', 1);
        Inv.sel = 0;
        Camp.reset();
        this.openLevel(1, true, false);
        Sky.p = DATA.time.startPhase; Sky.day = 1;
        Player.stats = { kills: 0, logs: 0, fed: 0, days: 0, kids: 0, chests: 0 };
        Player.spawn(Camp.x + 260, Camp.z + 120);
        Player.faceYaw = Math.atan2(Camp.x - Player.x, Camp.z - Player.z);
        Player.equipCurrent();
        this.quest.reset();
        if (window.Events) Events.reset();
        if (window.Bots) Bots.spawnAll(this.botMode);
    },

    // ------------------------------------------------------------------------------ пауза
    pause() {
        if (this.state !== 'play') return;
        Save.flush('pause', true);
        this.state = 'pause';
        Pause.set('manual', true);
        Input.unlock(); Input.releaseAll();
        UIPanels.open('pause');
    },
    resume() {
        if (this.state !== 'pause') return;
        UIPanels.close();
        this.state = 'play';
        Pause.set('manual', false);
        Input.lock();
    },
    // main.js freezes Game.update during manual pause; menu input still needs a frame.
    pausedFrame(dt) {
        if (this.state !== 'pause' || !Pause.has('manual') || Pause.has('auto') || Pause.has('ad') || Pause.has('platform')) return;
        Input.pollPad(dt);
        if (typeof PadNav !== 'undefined') PadNav.update(dt);
        if (Input.pressed('pause') || Input.padPressed(9) || Input.padPressed(1)) {
            const back = UIPanels.overlay && UIPanels.overlay.querySelector('.close');
            if (UIPanels.cur === 'pause' || !back || Input.padPressed(9)) this.resume();
            else back.click();
        }
        Input.consumeLook(); Input.endFrame();
    },
    // событие прохождения в аналитику платформы (Playgama; на других — ничего)
    track(name, data) { if (Platform.track) Platform.track(name, data); },
    roundEnded() {
        if (this._roundCounted) return;
        this._roundCounted = true;
        if (Platform.ads) Platform.ads.roundEnded();
    },
    nextResult(go) {
        // A hardcore death can still be continued by rewarded revival. Count the
        // result only when the player chooses to abandon that expedition.
        if (this.state === 'dead' && this.hardcore && Econ.hearts <= 0) this.roundEnded();
        if (this.state === 'dead') this._death = null;
        if (Platform.ads) Platform.ads.next(go); else go();
    },
    toMenu() {
        Pause.set('manual', false);
        Save.flush('menu', true);
        UIPanels.close();
        Enemies.clear(); Combat.clear(); if (window.Bots) Bots.clear();
        Player.dead = false;
        this.enterMenu();
    },

    // ------------------------------------------------------------------------------ смерть и финал
    // Каждая смерть забирает сердце. Остались сердца: возрождение на месте за рекламу (с вещами) или в лагере (без вещей).
    // Сердец не осталось: новый забег; в хардкоре можно вернуть одно сердце рекламным возрождением.
    onDeath(kind) {
        if (this.state === 'dead') return;
        this.state = 'dead';
        Input.unlock();
        this._death = { x: Player.x, z: Player.z, kind, inv: Inv.save(), hunger: Player.hunger, day: Sky.day, sleeping: false };
        const death = this._death;
        const day = Sky.day;
        if (day > this.best) { this.best = day; this.saveMeta(); }
        const left = Econ.loseHeart();
        Platform.gameplay(false);
        Platform.submitScore && Platform.submitScore(day);
        this.track('progression_failed', { step_id: 'night', step_index: day, mode: this.hardcore ? 'hardcore' : 'normal', cause: String(kind || 'x'), hearts_left: left });
        // хардкор с неиспользованным возрождением — забег ещё может продолжиться; иначе он окончен
        if (left > 0) this.writeSave(true); else { this.clearSave(); if (!this.canHcRevive()) this.roundEnded(); }
        if (window.Bots) Bots.onPlayerDeath();
        const stats = Player.stats;
        setTimeout(() => {
            if (this.state !== 'dead' || this._death !== death) return;
            UIPanels.open(left > 0 ? 'death' : 'gameover', { kind, day, stats, best: this.best, hearts: left });
            Sfx.ui('lose'); Cam.mode = 'orbit'; Cam.orbit.cx = Player.x; Cam.orbit.cz = Player.z; Cam.orbit.r = 340; Cam.orbit.h = 200; Cam.orbit.ty = 40; Cam.orbit.speed = 0.15;
        }, 2200);
    },

    // Общая часть возрождения: игрок встаёт, камера возвращается за спину
    _standUp(x, z, hp, hunger) {
        Player.spawn(x, z);
        Player.hp = hp; Player.hunger = hunger; Player.invuln = 4;
        Player.equipCurrent();
        this.state = 'play'; Input.enabled = true;
        Cam.mode = 'follow'; Cam.yaw = Player.faceYaw; Cam.pitch = 0.36; Cam.smoothFocus = true; Cam.focus.set(Player.x, Player.y + 145, Player.z); Cam._cd = null;
        Player.control = true;
        UI.showHud(true); UI.fade(0, 0.8);
        Platform.gameplay(true);
        Input.lock();
        if (Enemies.boss) Enemies.bossRetreat();
    },
    // Возрождение на месте за просмотр рекламы — с вещами, рядом враги отброшены.
    // Хардкор: возвращает сердце, поэтому только один раз за забег (иначе реклама = бесконечные жизни).
    canHcRevive() { return this.hardcore && !this.hcRevived; },
    async reviveHere() {
        if (this.state !== 'dead' || this._reviving || !this._death || (!this.hardcore && Econ.hearts <= 0)) return false;
        if (this.hardcore && this.hcRevived) return false;
        const d = this._death, run = this.runId;
        this._reviving = true;
        let ok = false;
        try { ok = await Platform.rewarded('revive'); } catch (e) { ok = false; } finally { this._reviving = false; }
        // SDK callbacks from a dismissed death screen or a different run cannot
        // revive that newer state. Truthy values are not a reward confirmation.
        if (this.state !== 'dead' || this._death !== d || this.runId !== run) return false;
        if (ok !== true) { UI.toast(Lang.t('ad.fail'), 'warn'); return false; }
        UIPanels.close(true);
        Inv.load(d.inv);
        if (this.hardcore) { Econ.resetHearts(true); this.hcRevived = true; }
        this._standUp(d.x, d.z, 70, Math.max(40, d.hunger));
        this._death = null;
        for (const e of Enemies.list) {
            if (!e.alive || Math.hypot(e.x - d.x, e.z - d.z) > 1400) continue;
            const dx = e.x - d.x, dz = e.z - d.z, l = Math.hypot(dx, dz) || 1;
            e.vx += dx / l * 900; e.vz += dz / l * 900; e.stun = Math.max(e.stun || 0, 2.5);
        }
        FX.ring(d.x, World.heightAt(d.x, d.z) + 20, d.z, 900, '#7dff9a'); FX.sparkBurst(d.x, World.heightAt(d.x, d.z) + 120, d.z, 40, '#9aff9a');
        Sfx.ui('rescue'); UI.banner(Lang.t('revived'), Lang.t('revivedSub'), '#7dff9a');
        if (window.Bots) Bots.onPlayerRevive(d.x, d.z);
        Save.flush('rewarded-revive', true);
        return true;
    },
    // Возрождение в лагере без вещей (остаются только начальные инструменты); прогресс мира сохраняется
    respawnBase() {
        if (this.state !== 'dead' || this.hardcore || Econ.hearts <= 0) return;
        UIPanels.close(true);
        Inv.reset(); Inv.add('axe_old', 1); Inv.add('flashlight', 1); Inv.sel = 0;
        this._standUp(Camp.x + 240, Camp.z + 110, 100, Math.max(55, Math.min(80, (this._death && this._death.hunger) || 60)));
        Player.faceYaw = Math.atan2(Camp.x - Player.x, Camp.z - Player.z);
        UI.banner(Lang.t('respawned'), Lang.t('respawnedSub'), '#ffd070');
        if (window.Bots) Bots.onPlayerRevive(Player.x, Player.z);
        this.autosave();
    },
    // Сердец нет: забег начинается с нуля
    retry() { this.nextResult(() => { UIPanels.close(true); Player.dead = false; Cam.mode = 'follow'; this.startGame(true, { bots: this.botMode, hardcore: this.hardcore }); }); },

    ending(good) {
        if (this.state === 'ending') return;
        const kids = Zones.rescuedCount();
        const survived = good !== false, isGood = survived && kids >= 4;
        this.state = 'ending';
        Input.unlock();
        Platform.gameplay(false);
        this.clearSave();
        this.roundEnded();
        const nights = survived ? DATA.time.totalNights : Math.min(DATA.time.totalNights, Math.max(0, (Sky.day || 1) - 1));
        this.track(survived ? 'progression_completed' : 'progression_failed', { step_id: 'run', step_index: nights, mode: this.hardcore ? 'hardcore' : 'normal', kids: kids, good_ending: isGood });
        if (nights > this.best) { this.best = nights; this.saveMeta(); }
        // награда: базовая + за победу над боссом; хардкор удваивает
        const boss = survived && !!Enemies.bossDead, hc = !!this.hardcore;
        let coins = survived ? (isGood ? 500 : 100) + (boss ? 1000 : 0) : 0;
        if (hc) coins *= DATA.hardcore.endingK;
        Econ.addCoins(coins, 'ending');
        if (window.Ach && survived) { Ach.event('win', 1); if (hc) Ach.event('hcwin', 1); Ach.check(); }
        UI.showHud(false);
        UI.fade(1, 1.2);
        setTimeout(() => { UIPanels.open('ending', { good: isGood, survived, kids, nights, stats: Player.stats, boss, hc, coins }); UI.fade(0, 1.2); Sfx.ui(isGood ? 'win' : 'lose'); }, 1300);
    },

    // ------------------------------------------------------------------------------ сон
    setSleepCam(on) {
        if (this.sleepCam === on) return;
        this.sleepCam = on;
        if (on) { this._camBack = { p: Cam.pitch, d: Cam.distTarget }; Cam.pitch = 0.9; Cam.distTarget = 4.2 * M; }
        else if (this._camBack) { Cam.pitch = this._camBack.p; Cam.distTarget = this._camBack.d; this._camBack = null; }
    },
    sleepCameraTarget() {
        const s = Camp._sleep;
        if (!this.sleepCam || !s) return Player;
        const center = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(0, 35, 0), s.matrix);
        const k = U.clamp(s.age / 1.2, 0, 1);
        return { x: U.lerp(s.start.x, center.x, k), z: U.lerp(s.start.z, center.z, k), y: U.lerp(s.start.y + 145, center.y, k), head: 1 };
    },
    sleepCameraFrame() {
        const s = Camp._sleep;
        if (!this.sleepCam || !s) return;
        // The normal camera treats nearby props as tall cylinders. Beside a bag
        // that shortens its boom into the mattress. A high sleep view stays above
        // the camp furniture and fits the whole bag even in portrait orientation.
        const aspect = window.innerWidth / Math.max(1, window.innerHeight);
        const distance = Math.max(Cam.distTarget, 225 / Math.min(1, aspect));
        const target = this.sleepCameraTarget(), pitch = 1.05;
        const from = Cam.cam.position.clone();
        const position = new BABYLON.Vector3(target.x - Math.sin(Cam.yaw) * Math.cos(pitch) * distance,
            target.y + 1 + Math.sin(pitch) * distance, target.z - Math.cos(Cam.yaw) * Math.cos(pitch) * distance);
        position.y = Math.max(position.y, World.heightAt(position.x, position.z) + 350);
        let k = U.clamp(s.age / 0.65, 0, 1);
        if (s.phase === 'leave') k = 1 - U.clamp(s.t / 0.55, 0, 1);
        k = k * k * (3 - 2 * k);
        Cam.cam.position.copyFrom(BABYLON.Vector3.Lerp(from, position, k));
        Cam.cam.setTarget(BABYLON.Vector3.Lerp(Cam.look, new BABYLON.Vector3(target.x, target.y + 1, target.z), k));
    },
    onNewDay() { Player.stats.days = Sky.day - 1; this.autosave(); },
    onKidHome(kid) {
        Quests.event('kidHome', 1); Econ.dropCoins(kid.x, kid.z, 35, 'kidHome');
        UI.toast(Lang.t('kidHome', { n: Lang.t('kid.' + kid.def.id) }), 'good');
        const p = { x: kid.x, y: World.heightAt(kid.x, kid.z) + 200, z: kid.z };
        FX.heal(kid.x, World.heightAt(kid.x, kid.z), kid.z);
        this.autosave();
    },

    // Бонусы детей (пассивные)
    kidBonus(id) { const k = Zones.kids.find(k => k.def.id === id); return !!(k && k.rescued && k.state === 'camp'); },

    // ------------------------------------------------------------------------------ кадр
    update(dt) {
        const st = this.state;
        const rawDt = dt;
        if (window.AttackFX) { dt = AttackFX.scale(dt); AttackFX.tick(rawDt); }   // hit-stop: короткая пауза на сильном ударе
        Tween.update(dt);
        this.perfTick(rawDt);
        if (Platform.perfFrame) Platform.perfFrame(st === 'play');
        Input.pollPad(rawDt);
        if (window.PadNav) PadNav.update(rawDt);
        // общее: небо и мир живут и в меню
        if (st === 'menu') {
            Sky.update(dt);
            World.update(dt, Camp.x, Camp.z); World.frame(dt); World.tickFog(dt, Sky);
            Player.rig.update(dt);
            Camp.update(dt);
            Items.update(dt, 1e9, 1e9);
            this.env(dt, true);
            Cam.update(dt, null);
            this.shopPreviewFrame();
            FX.screen(dt, { exposure: 1.2, bloom: 0.5 });
            Sfx.update(dt, { menu: true, fireDist: 700, fireLit: true, fireLevel: 0.2, windK: 0.2, hp: 100, deerK: 0 });
            Input.endFrame();
            return;
        }
        if (st === 'ending' || st === 'dead') {
            Sky.update(dt); World.update(dt, Player.x, Player.z); World.frame(dt); World.tickFog(dt, Sky);
            Player.update(dt); Enemies.update(dt); Items.update(dt, Player.x, Player.z); Camp.update(dt);
            if (window.Archery) Archery.update(dt);
            if (window.Bots) Bots.update(dt);
            Cam.update(dt, Player);
            this.env(dt, false);
            UI.update(dt, { fear: 0 });
            Input.endFrame();
            return;
        }
        if (st === 'pause' && (Input.padPressed(9) || Input.padPressed(1))) this.resume();
        if (st !== 'play') { Input.endFrame(); return; }
        if (UI.modal) {   // окно открыто: мир стоит, кадр и интерфейс живут
            Input.consumeLook(); Input.consumeWheel();
            if (Cam.mode === 'orbit') { Player.rig.update(dt); Cam.update(dt, null); this.shopPreviewFrame(); Sky.update(0); }
            if (Input.pressed('pause') || Input.padPressed(1) || (Input.pressed('inv') && UI.modal === 'inv') || (Input.pressed('map') && UI.modal === 'map') || (Input.pressed('rewards') && UI.modal === 'rewards') || (Input.pressed('notes') && UI.modal === 'journal') || (Input.pressed('upgrade') && UI.modal === 'fire') || (Input.pressed('quest') && UI.modal === 'quests')) UIPanels.close();
            this.tickExtras(dt, true);
            this.env(dt, false);
            UI.update(dt, { fear: Enemies.fear });
            Sfx.update(dt, { menu: false, fireDist: 600, fireLit: Camp.lit, fireLevel: Camp.level / 5, windK: 0, hp: Player.hp, deerK: 0, dead: false, nearFire: true });
            Input.endFrame();
            return;
        }
        // ---- игра
        // ввод: пауза, камера
        if (Input.pressed('pause')) { if (UI.modal) UIPanels.close(); else this.pause(); }
        if ((Input.pressed('map')) && !UI.blocking()) UI.openBoard();
        if (Input.pressed('quest') && !UI.blocking()) UI.open('quests');
        if (Input.pressed('upgrade') && !UI.blocking() && Player.control) Camp.openUpgrade();
        if (Input.pressed('notes') && !UI.blocking() && window.Lore) UI.open('journal');
        if (Input.pressed('rewards') && !UI.blocking() && window.Ach) UI.open('rewards');
        if (Input.pressed('swap') && !UI.blocking() && Player.control) Inv.quickSwap();
        if ((Input.padPressed(4) || Input.padPressed(14)) && !UI.blocking() && Player.control) Inv.select(Inv.sel - 1);
        if ((Input.padPressed(5) || Input.padPressed(15)) && !UI.blocking() && Player.control) Inv.select(Inv.sel + 1);
        if (Input.pressed('inv') && !UI.blocking() && Player.control) UI.open('inv');
        if (Input.pressed('shop') && !UI.blocking()) UI.open('shop');
        if (Input.pressed('emote') && !UI.blocking() && Player.control) Player.nextEmote();
        this._tipK = (this._tipK || 0) - dt; if (this._tipK <= 0) { this._tipK = 1; Quests.contextTips(); }
        const look = Input.consumeLook();
        if (!UI.blocking() && Player.control || this.sleepCam) Cam.turn(look.dx, look.dy);
        // колесо мыши: по умолчанию переключает хотбар, с зажатым Shift — зум камеры (в настройках можно поменять местами)
        const wh = Input.consumeWheel();
        if (wh && !UI.blocking()) { if ((this.wheelMode === 'zoom') !== Input.shiftDown() || !Player.control) Cam.zoom(wh); else Inv.select(Inv.sel + (wh > 0 ? 1 : -1)); }
        Sky.update(dt);
        Player.update(dt);
        Player.onWood = false;
        World.update(dt, Player.x, Player.z); World.frame(dt); World.tickFog(dt, Sky);
        Camp.update(dt);
        Interact.update(dt);
        Zones.update(dt);
        Enemies.update(dt);
        Combat.update(dt);
        if (window.Archery) Archery.update(dt);
        Items.update(dt, Player.x, Player.z);
        Cam.aim = U.damp(Cam.aim, Player.aiming() ? 1 : 0, 10, dt);
        Cam.update(dt, this.sleepCameraTarget());
        this.sleepCameraFrame();
        this.quest.update(dt);
        if (window.Events) Events.update(dt);
        if (window.Bots) Bots.update(dt);
        Save.tick(rawDt);
        this.tickExtras(dt, false);
        this.env(dt, false);
        const fear = Enemies.fear;
        UI.update(dt, { fear });
        this.fxScreen(dt);
        Sfx.update(dt, { menu: false, fireDist: Math.hypot(Player.x - Camp.x, Player.z - Camp.z), fireLit: Camp.lit, fireLevel: Camp.level / 5, windK: World.fogProximity(Player.x, Player.z), hp: Player.hp, deerK: Math.min(1, fear * 1.3), dead: Player.dead, nearFire: Camp.isSafe(Player.x, Player.z) });
        // граница тумана
        if (Player.atFog && Math.random() < dt * 0.4) UI.toast(Lang.t('fogWall'), 'info');
        // FOV: бег и страх
        Cam.fovBase = (62 + (Player.sprinting ? 7 : 0) + fear * 6 + (window.AttackFX ? AttackFX.fov : 0)) * Math.PI / 180;
        Cam.rollTarget = Math.sin(performance.now() / 1300) * 0.02 * fear;
        this.pauseKeys();
        Input.endFrame();
    },

    // Свет фонаря, светлячки, теневая рамка
    env(dt, menu) {
        const x = menu ? Camp.x : Player.x, z = menu ? Camp.z : Player.z;
        // кадр теней сдвигается по сетке текселей — края теней не «плывут» при ходьбе
        const R = 3900, q = 2 * R / Math.max(256, this.view._mapSize || 2048) * 4;
        this.view.updateLightFrustum(Math.round(x / q) * q, Math.round(z / q) * q, Math.round(World.heightAt(x, z) / 200) * 200, R);
        this._ambT -= dt;
        if (this._ambT < 0) { this._ambT = 0.5; FX.setAmbient(Sky.night, 0.4 * Sky.daylight); }
    },

    fxScreen(dt) {
        const fear = Enemies.fear;
        const low = Player.hp < 35 ? 1 - Player.hp / 35 : 0;
        FX.screen(dt, {
            chroma: fear * 0.9 + low * 0.5 + (Player.hurtT > 0 ? 0.6 : 0),
            vignette: Math.max(fear * 0.6, low * 0.7) + Sky.night * 0.15,
            grain: fear * 0.6 + Sky.night * 0.2,
            exposure: 1.12 + Sky.daylight * 0.12 - fear * 0.12,
            bloom: 0.34 + Sky.night * 0.22,
        });
    },

    pauseKeys() {},

    // Модули второго слоя: сбой в любом из них не должен ронять кадр
    _err(name, e) { this._errN = this._errN || {}; if ((this._errN[name] = (this._errN[name] || 0) + 1) <= 3) console.warn('Game.' + name + ':', e); },
    tickExtras(dt, frozen) {
        if (!frozen) {
            try { if (window.Ach) Ach.update(dt); } catch (e) { this._err('Ach', e); }
            try { if (window.Lore) Lore.update(dt); } catch (e) { this._err('Lore', e); }
        }
        try { if (window.MapView) MapView.update(dt, frozen); } catch (e) { this._err('MapView', e); }
        try { if (window.Hud3) Hud3.update(dt); } catch (e) { this._err('Hud3', e); }
        try { if (window.UiFX) UiFX.update(dt); } catch (e) { this._err('UiFX', e); }
    },

    // Громкость (эффекты, музыка, окружение), режим колеса мыши — из Store
    wheelMode: 'hotbar', hardcore: false,
    hcRevived: false,   // хардкор: возрождение за рекламу в этом забеге уже было (одно на забег; Save meta.hcRev)
    loadSettings() {
        const num = (k, d) => { const raw = Store.get(GAME_ID + k); const v = raw == null ? NaN : Number(raw); return isFinite(v) ? Math.max(0, Math.min(1, v)) : d; };
        Sound.masterK = num('.vol', 1); Sound.musicK = num('.volMusic', 1); Sfx.ambK = num('.volAmb', 1);
        window.SOUND_VOLUME_USER = Sound.masterK;
        Sound._sync();
        this.wheelMode = Store.get(GAME_ID + '.wheel') === 'zoom' ? 'zoom' : 'hotbar';
    },

    // Адаптивное разрешение: следим за кадром и подстраиваем масштаб рендера (чтобы не лагало на слабых машинах)
    perf: { acc: 0, n: 0, base: 1, level: 1, cooldown: 0 },
    // Масштаб кадра (hardware scaling: 1 — пиксель на CSS-точку, 0.5 — два). На телефоне — бюджет пикселей качества:
    // маленькое окно (iframe платформы) рисуется с плотностью экрана, а не растягивается «мылом»; на ПК — предел DPR.
    renderScale() {
        const q = this.quality || 2, dpr = window.devicePixelRatio || 1;
        if (!IS_MOBILE) return 1 / Math.min(dpr, q === 1 ? 1 : 1.5);
        const num = (v, d) => (typeof v === 'number' ? v : d);
        const mp = 1e6 * (q === 1 ? num(typeof QUALITY_PIXELS_LOW !== 'undefined' ? QUALITY_PIXELS_LOW : null, 0.55)
            : q === 2 ? num(typeof QUALITY_PIXELS_MID !== 'undefined' ? QUALITY_PIXELS_MID : null, 0.85)
            : num(typeof QUALITY_PIXELS_HIGH !== 'undefined' ? QUALITY_PIXELS_HIGH : null, 1.4));
        const css = Math.max(1, window.innerWidth) * Math.max(1, window.innerHeight);
        const cap = q === 1 ? 1.75 : q === 2 ? 2 : 2.5;
        return Math.max(1 / Math.min(dpr, cap), Math.min(Math.sqrt(css / mp), q === 1 ? 1.15 : 1));
    },
    dynresMax() { return typeof QUALITY_DYNRES_MAX === 'number' ? Math.max(1, QUALITY_DYNRES_MAX) : 1.25; },
    perfInit() {
        const base = this.renderScale();
        this.perf.base = base; this.perf.level = base;
        World3D.engine.setHardwareScalingLevel(base);
        // поворот экрана / смена размера окна — пересчёт бюджета пикселей
        window.addEventListener('resize', () => {
            const P = this.perf, b = this.renderScale();
            if (Math.abs(b - P.base) < 0.005) return;
            P.level = Math.max(b, Math.min(b * this.dynresMax(), P.level / P.base * b)); P.base = b;
            World3D.engine.setHardwareScalingLevel(P.level);
        });
    },
    // Авто-разрешение: при низком FPS кадр мельчает, но не больше чем в QUALITY_DYNRES_MAX раз по стороне
    // (раньше — в 2.2 раза поверх 1 пикселя на точку: на телефоне выходило ~290×130 и сильное «мыло»).
    perfTick(dt) {
        const P = this.perf;
        P.acc += dt; P.n++;
        if (P.acc < 1.2) return;
        const avg = P.acc / P.n; P.acc = 0; P.n = 0;
        if (P.cooldown > 0) { P.cooldown--; return; }
        let lvl = P.level;
        if (avg > 0.026) lvl = Math.min(P.base * this.dynresMax(), lvl * 1.06);
        else if (avg < 0.0165 && lvl > P.base) lvl = Math.max(P.base, lvl / 1.05);
        if (Math.abs(lvl - P.level) > 0.005) { P.level = lvl; World3D.engine.setHardwareScalingLevel(lvl); P.cooldown = 1; }
    },

    // Качество: 1 низкое, 2 среднее, 3 высокое
    quality: 3,
    applyQuality() {
        const q = this.quality = Math.max(1, Math.min(3, Math.round(Number(this.quality) || 2)));
        const scale = q === 1 ? 0.5 : q === 2 ? 0.75 : 1;
        World.shadowScale = scale;
        if (this.view && this.view.shadow) { const size = q === 1 ? 512 : q === 2 || IS_MOBILE ? 1024 : WORLD3D_SHADOW_MAP; if (this.view._mapSize !== size) { this.view.shadow.mapSize = size; this.view._mapSize = size; } }
        if (this.view && this.view.shadow) {
            this.view.shadowMinRadius = q === 3 ? 0 : q === 1 ? (typeof ASTRA_SHADOW_MIN_RADIUS_LOW !== 'undefined' ? ASTRA_SHADOW_MIN_RADIUS_LOW : 40) : (typeof ASTRA_SHADOW_MIN_RADIUS !== 'undefined' ? ASTRA_SHADOW_MIN_RADIUS : 30);
            this.view.shadow.getShadowMap().refreshRate = q === 3 ? 1 : (typeof ASTRA_SHADOW_REFRESH !== 'undefined' ? ASTRA_SHADOW_REFRESH : 2);
            for (const rig of this.view._shadowRigs || []) rig.setShadows(this.view, true);
            Items.refreshShadows();
        }
        if (FX.pf) FX.pf.qualityScale = scale;
        if (UI.root) UI.root.classList.toggle('liteFX', IS_MOBILE || q === 1);
        // низкое качество — без теней: нет второго прохода сцены в карту теней и выборок тени в шейдерах
        if (this.view && this.view.sun) this.view.sun.shadowEnabled = q > 1;
        // чёткость: бюджет пикселей качества; авто-понижение — в узких пределах
        this.perf.base = this.renderScale();
        this.perf.level = this.perf.base;
        World3D.engine.setHardwareScalingLevel(this.perf.level);
        World.viewScale = q === 1 ? 0.62 : q === 2 ? 0.82 : 1;
        World.viewR.grass = q === 1 ? 0 : q === 2 ? 2600 : 3800;
        World.viewR.flower = q === 1 ? 0 : q === 2 ? 2400 : 3400;
        // густота мира: низкое −80% деревьев, кустов, камней и мелочи; среднее −50%; высокое −30% (ягоды и грибы — все)
        if (World.setDensity) World.setDensity(World.keepFor(q));
        if (window.Zones && Zones.applyDecor) Zones.applyDecor();
        // звери дальше дальности прорисовки не рисуются (ИИ живёт)
        const num = (v, d) => (typeof v === 'number' ? v : d), M1 = typeof M === 'number' ? M : 100;
        Enemies.VIS = q === 1 ? num(typeof QUALITY_ENEMY_VIEW_LOW !== 'undefined' ? QUALITY_ENEMY_VIEW_LOW : null, 34) * M1
            : q === 2 ? num(typeof QUALITY_ENEMY_VIEW_MID !== 'undefined' ? QUALITY_ENEMY_VIEW_MID : null, 46) * M1 : Enemies.ACT;
        // постобработка: на низком — цветокоррекция в материалах, без HDR-текстуры и полноэкранных проходов
        if (FX.setPostFx) FX.setPostFx(q > 1);
        const p = FX.pipe;
        if (p) { p.bloomEnabled = q > 1 && !(IS_MOBILE && q === 2); p.sharpenEnabled = q > 2 && !IS_MOBILE; p.grainEnabled = q > 2 || (q > 1 && !IS_MOBILE); p.samples = IS_MOBILE ? 1 : 4; p.fxaaEnabled = IS_MOBILE; p.chromaticAberrationEnabled = !IS_MOBILE || q > 2; }
        Store.set(GAME_ID + '.quality', String(q));
        World.update(0, Player.x, Player.z, true);
    },

    // Наряд: камера вплотную к герою
    shopPreviewFrame() {
        if (UIPanels.cur !== 'shop' || !UIPanels.overlay || Cam.mode !== 'orbit') return;
        const panel = UIPanels.overlay.querySelector('.shopP'); if (!panel) return;
        const rect = panel.getBoundingClientRect(), w = window.innerWidth, h = window.innerHeight;
        const portrait = w <= 600 && h > w;
        Cam.orbit.r = 330;
        const x = portrait ? w / 2 : (rect.right + w) / 2;
        const y = portrait ? rect.top / 2 : h / 2;
        // Off-axis projection frames the hero without moving the camera through camp props/ground.
        const cam = Cam.cam; cam.fov = Cam.fovBase * (portrait ? 1.25 : 0.85); cam.unfreezeProjectionMatrix();
        const projection = cam.getProjectionMatrix(true).clone();
        const handed = projection.m[11];
        projection.setRowFromFloats(2, (x / w * 2 - 1) * handed, (1 - y / h * 2) * handed, projection.m[10], handed);
        cam.freezeProjectionMatrix(projection); this._shopProjection = true;
    },
    outfitEnter() {
        Cam.mode = 'orbit';
        Cam.orbit.cx = Player.x; Cam.orbit.cz = Player.z; Cam.orbit.r = 330; Cam.orbit.h = 175; Cam.orbit.ty = 105; Cam.orbit.speed = 0.28;
        Cam.orbit.a = Math.atan2(Player.faceYaw ? Math.cos(Player.faceYaw) : 1, 1) + 0.4;
    },
    outfitBack() {
        if (this._shopProjection && Cam.cam) { Cam.cam.unfreezeProjectionMatrix(); this._shopProjection = false; }
        if (this.state !== 'menu') return;
        Cam.orbit.cx = Camp.x; Cam.orbit.cz = Camp.z; Cam.orbit.r = 780; Cam.orbit.h = 320; Cam.orbit.ty = 130; Cam.orbit.speed = 0.07;
    },

    // ------------------------------------------------------------------------------ сохранение
    // Всё делает Save.js (слоты A/B с контрольной суммой, автосохранение, облако). Здесь — только связка с игрой.
    loadMeta() { const m = Store.getJSON(GAME_ID + '.meta', {}); this.best = m.best || 0; Save.init(); },
    saveMeta() { Store.set(GAME_ID + '.meta', JSON.stringify({ best: this.best })); },
    autosave(why) { Save.request(why || 'event'); },
    // respawn — сохранить состояние «возрождение в лагере без вещей» (на случай выхода на экране смерти)
    writeSave(respawn) { return Save.flush(respawn ? 'death' : 'manual', true, !!respawn); },
    clearSave() {
        Save.clearSlots(); this.hasSave = false;
        if (typeof Platform !== 'undefined' && Platform.save) Platform.save({ v: SAVE_VERSION, t: Date.now(), best: this.best });   // облако: сохранения больше нет
    },
    // Применение сохранения на чистом мире. Критичное (мир, инвентарь, лагерь, время) бросает ошибку, второстепенное изолировано.
    applySave(s) {
        Save.suspended = true;
        try {
            this.botMode = (s.bots && s.bots.n) || (s.meta && s.meta.bots) || 0;
            this.runId = (s.meta && s.meta.run) || Date.now();
            this.hardcore = !!(s.meta && s.meta.hc);
            this.hcRevived = !!(s.meta && s.meta.hcRev);
            if (s.meta && Number.isFinite(s.meta.hearts)) { Econ.hearts = Math.max(0, Math.min(this.hardcore ? 1 : DATA.lives.max, s.meta.hearts | 0)); Econ.save(); }
            if (window.Lore) Lore.setFound(s.lore);
            if (window.MapView) MapView.reset();
            this.resetWorld();
            Enemies.killed = new Set((s.enemies && s.enemies.killed) || []);
            World.loadState(s.world);
            Inv.load(s.inv);
            Camp.load(s.camp);
            Sky.load(s.sky);
            this.openLevel(Camp.level, false, false);
            World.applyPersistent();
            Zones.load(s.zones);
            Player.stats = Object.assign({ kills: 0, logs: 0, fed: 0, days: 0, kids: 0, chests: 0 }, s.stats || {});
            const p = s.player || { x: Camp.x + 240, z: Camp.z + 110, hp: 100, hunger: 70 };
            Player.spawn(p.x, p.z);
            Player.hp = Math.max(1, p.hp); Player.hunger = p.hunger;
            if (p.stamina != null) Player.stamina = p.stamina;
            if (p.yaw) { Player.faceYaw = Player.yaw = p.yaw; Player.apply(); }
            Player.buff = p.buff || null; Player.flashOn = !!p.flash; Player.lanternOn = p.lantern !== false;
            Player.equipCurrent();
            Items.load(s.items);
            // убитые «стражи» старого формата: их ключи уже выданы
            for (const key of (s.enemies && s.enemies.guards) || []) { const e = Enemies.list.find(e => e.guard && e.guard.key === key); if (e) { e.alive = false; e.deadT = 8; } }
            const soft = (name, fn) => { try { fn(); } catch (e) { console.warn('applySave:', name, e); } };
            soft('quest', () => this.quest.load(s.quest));
            soft('events', () => { if (window.Events) Events.load(s.ev); });
            soft('enemies', () => { if (Enemies.loadState) Enemies.loadState(s.enemies); });
            soft('combat', () => { if (Combat.loadState) Combat.loadState(s.combat); });
            soft('arrows', () => { if (window.Archery) Archery.load(s.arrows); });
            soft('map', () => { if (window.MapView) MapView.load(s.map); });
            soft('bots', () => { if (window.Bots) { Bots.spawnAll(this.botMode); Bots.restore(s.bots); } });
        } finally { Save.suspended = false; Save.since = 0; }
    },
    // Загрузка не удалась на применении — пробуем предыдущий слот; false — загрузить нечего
    _recoverLoad() {
        const alt = Save.loadOther(Save.lastSeq());
        if (!alt) return false;
        try { this.applySave(alt); return true; } catch (e) { console.error('applySave (резерв):', e); return false; }
    },
};

// const-глобалы классических скриптов не становятся свойствами window, а код проверяет `window.Sfx`, `window.Enemies`…
// (без этого удары по врагам, звуки шагов/ударов, частицы и подсказки молча пропускались). Вешаем модули на window явно.
Object.assign(window, { Game, Save, Sky, World, Cam, Items, Inv, Player, FX, Synth, Sfx, Combat, Interact, Camp, Zones, Enemies, UI, UIPanels, Input, Store, Mist, Lang, Sound, Platform, Pause, Tween, Econ, Quests, SKINS, Bots, Events });
// модули второго слоя грузятся до Game.js, но могут отсутствовать (например, в тестах): подвешиваем только существующие
for (const [n, v] of /** @type {[string, any][]} */ ([['Ach', typeof Ach !== 'undefined' ? Ach : null], ['Lore', typeof Lore !== 'undefined' ? Lore : null], ['UiFX', typeof UiFX !== 'undefined' ? UiFX : null], ['MapView', typeof MapView !== 'undefined' ? MapView : null], ['Hud3', typeof Hud3 !== 'undefined' ? Hud3 : null], ['PadNav', typeof PadNav !== 'undefined' ? PadNav : null], ['HudLayout', typeof HudLayout !== 'undefined' ? HudLayout : null], ['AttackFX', typeof AttackFX !== 'undefined' ? AttackFX : null], ['Archery', typeof Archery !== 'undefined' ? Archery : null]])) if (v) /** @type {any} */ (window)[n] = v;

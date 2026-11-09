// Sfx.js — звук игры: имена -> файлы Sound Pack и синтез (Synth), позиционирование относительно игрока
// (громкость по расстоянию + панорама), петли (костёр, ветер, фон дня/ночи, сверчки), сердцебиение.

/** @type {Record<string, any>} */
const Sfx = {
    loops: {},
    ambK: 1,   // множитель громкости окружения (дневной/ночной фон, ветер, сверчки, дождь)
    hbT: 0,
    musicNow: null,
    voices: [],
    T: {
        step:      { f: ['assets/sounds/step1.ogg', 'assets/sounds/step2.ogg', 'assets/sounds/step3.ogg', 'assets/sounds/step4.ogg'], v: 0.42, d: 0.14 },
        stepwood:  { f: ['assets/sounds/stepwood1.ogg', 'assets/sounds/stepwood2.ogg'], v: 0.5, d: 0.1 },
        stepstone: { f: ['synth:stepstone1', 'synth:stepstone2'], v: 0.6, d: 0.1 },
        stepsnow:  { f: ['synth:stepsnow1', 'synth:stepsnow2'], v: 0.6, d: 0.1 },
        stepwater: { f: ['synth:stepwater1', 'synth:stepwater2'], v: 0.75, d: 0.12 },
        stepdirt:  { f: ['synth:stepdirt1', 'synth:stepdirt2'], v: 0.6, d: 0.1 },
        land:      { f: ['synth:thud'], v: 0.5, r: 1.5, d: 0.1 },
        jump:      { f: ['assets/sounds/whoosh1.ogg'], v: 0.16, r: 1.7, d: 0.1 },
        hurt:      { f: ['synth:hurt1', 'synth:hurt2', 'synth:hurt3'], v: 0.9, d: 0.06 },
        death:     { f: ['synth:death'], v: 1.0 },
        chop:      { f: ['assets/sounds/chop1.ogg', 'assets/sounds/chop2.ogg', 'assets/sounds/chop3.ogg', 'assets/sounds/chop4.ogg'], v: 0.9, d: 0.08 },
        swing:     { f: ['assets/sounds/whoosh1.ogg', 'assets/sounds/whoosh2.ogg'], v: 0.4, r: 1.15, d: 0.1 },
        whoosh:    { f: ['assets/sounds/whoosh2.ogg'], v: 0.35, r: 1.3, d: 0.1 },
        bowshot:   { f: ['assets/sounds/bowshot1.ogg', 'assets/sounds/bowshot2.ogg'], v: 0.7, d: 0.06 },
        bowdraw:   { f: ['assets/sounds/bowdraw.ogg'], v: 0.35, r: 1.15, d: 0.1 },
        arrowhit:  { f: ['assets/sounds/arrowhit.ogg'], v: 0.65, d: 0.05 },
        arrowwood: { f: ['assets/sounds/arrowwood.ogg'], v: 0.55, d: 0.05 },
        treefall:  { f: ['synth:treefall'], v: 1.0, d: 0.04 },
        drop:      { f: ['assets/sounds/wood1.ogg', 'assets/sounds/wood2.ogg', 'assets/sounds/wood3.ogg'], v: 0.5, d: 0.15 },
        logdrop:   { f: ['assets/sounds/logdrop.ogg'], v: 0.7, d: 0.1 },
        eat:       { f: ['assets/sounds/munch.ogg', 'assets/sounds/chomp1.ogg', 'assets/sounds/chomp2.ogg', 'assets/sounds/chomp3.ogg', 'assets/sounds/chomp4.ogg'], v: 0.85, d: 0.05 },
        drink:     { f: ['assets/sounds/slurp.ogg'], v: 0.8 },
        bandage:   { f: ['assets/sounds/page.ogg'], v: 0.9, r: 0.8 },
        revolver:  { f: ['assets/sounds/shot.ogg'], v: 1.0, r: 1.15, d: 0.04 },
        rifle:     { f: ['assets/sounds/shot.ogg'], v: 1.0, r: 0.78, d: 0.03 },
        thunder:   { f: ['synth:thunder'], v: 1.0, d: 0.04, maxD: 20000 },
        boom:      { f: ['synth:boom'], v: 1.0, d: 0.03, maxD: 16000 },
        bang:      { f: ['synth:bang'], v: 0.9, d: 0.03, maxD: 9000 },
        fuse:      { f: ['synth:fuse'], v: 0.5, d: 0.05, maxD: 2500 },
        meteor:    { f: ['synth:meteor'], v: 0.9, d: 0.05, maxD: 14000 },
        howl:      { f: ['assets/sounds/wolfhowl.ogg', 'synth:howl', 'assets/sounds/wolfhowl.ogg'], v: 0.9, d: 0.06 },
        growl:     { f: ['assets/sounds/snarl1.ogg', 'assets/sounds/snarl2.ogg', 'assets/sounds/snarl3.ogg', 'assets/sounds/snarl5.ogg', 'synth:growl'], v: 0.85, d: 0.08 },
        snarl:     { f: ['assets/sounds/snarl4.ogg', 'assets/sounds/snarl2.ogg'], v: 0.9, d: 0.06 },
        bark:      { f: ['assets/sounds/dogbark1.ogg', 'assets/sounds/dogbark2.ogg', 'synth:bark'], v: 0.8, d: 0.1 },
        roar:      { f: ['assets/sounds/beastroar1.ogg', 'assets/sounds/beastroar2.ogg', 'assets/sounds/beastroar3.ogg', 'synth:roar'], v: 1.0, d: 0.05 },
        bossRoar:  { f: ['assets/sounds/beastroar1.ogg', 'assets/sounds/beastroar3.ogg'], v: .8, r: .7, d: .03, layer: 'synth:thud', layerVolume: .5, maxD: 14000 },
        boar:      { f: ['assets/sounds/grunt1.ogg', 'assets/sounds/grunt2.ogg'], v: .7, r: .72, d: .08, layer: 'synth:growl', layerVolume: .22 },
        ghostTell: { f: ['assets/sounds/ghost.ogg'], v: .5, r: .8, d: .08, layer: 'assets/sounds/creaturebreath.ogg', layerVolume: .25 },
        screech:   { f: ['synth:screech', 'assets/sounds/beastscream1.ogg', 'synth:screech', 'assets/sounds/beastscream2.ogg'], v: 1.0, d: 0.03 },
        thud:      { f: ['synth:thud'], v: 0.9, d: 0.08 },
        squeak:    { f: ['assets/sounds/cute1.ogg', 'assets/sounds/cute2.ogg', 'assets/sounds/cute3.ogg', 'assets/sounds/cute4.ogg', 'synth:squeak'], v: 0.6, d: 0.12 },
        enemyhurt: { f: ['assets/sounds/cryhurt1.ogg', 'assets/sounds/cryhurt2.ogg', 'assets/sounds/cryhurt3.ogg', 'assets/sounds/cryhurt4.ogg', 'assets/sounds/cryhurt5.ogg', 'assets/sounds/grunt1.ogg', 'assets/sounds/grunt2.ogg'], v: 0.8, d: 0.08 },
        creature:  { f: ['assets/sounds/monster1.ogg', 'assets/sounds/monster2.ogg', 'assets/sounds/monster3.ogg', 'assets/sounds/monster4.ogg', 'assets/sounds/monster5.ogg', 'assets/sounds/monster6.ogg', 'assets/sounds/monster7.ogg'], v: 0.6, d: 0.08 },
        snore:     { f: ['assets/sounds/snore.ogg'], v: 0.5 },
        hoot:      { f: ['synth:hoot'], v: 0.7, d: 0.05 },
        hit:       { f: ['assets/sounds/hit1.ogg', 'assets/sounds/hit2.ogg'], v: 0.9, d: 0.08 },
        splat:     { f: ['assets/sounds/splat.ogg'], v: 0.7, d: 0.1 },
        snap:      { f: ['assets/sounds/snap.ogg'], v: 0.8 },
        trap:      { f: ['synth:snapcall'], v: 1.0 },
        metal:     { f: ['assets/sounds/metal1.ogg', 'assets/sounds/metal2.ogg', 'assets/sounds/metal3.ogg'], v: 0.8, d: 0.1 },
        clang:     { f: ['assets/sounds/clang.ogg'], v: 0.8, d: 0.06 },
        heavy:     { f: ['assets/sounds/metalheavy.ogg'], v: 0.9 },
        chest:     { f: ['assets/sounds/chestopen1.ogg', 'assets/sounds/chestopen2.ogg'], v: 0.9 },
        chestclose:{ f: ['assets/sounds/chestclose.ogg'], v: 0.8 },
        gate:      { f: ['assets/sounds/gateopen.ogg'], v: 1.0 },
        unlock:    { f: ['assets/sounds/unlock.ogg'], v: 1.0 },
        ignite:    { f: ['assets/sounds/torchlight.ogg'], v: 0.8 },
        match:     { f: ['assets/sounds/match.ogg'], v: 0.8 },
        sizzle:    { f: ['synth:sizzle'], v: 0.8 },
        sting:     { f: ['assets/sounds/sting.ogg'], v: 0.9 },
        alarm:     { f: ['synth:alarm'], v: 0.8 },
        dawn:      { f: ['synth:dawn'], v: 0.8 },
        gong:      { f: ['synth:gong'], v: 0.9 },
        ghost:     { f: ['assets/sounds/ghost.ogg'], v: 0.5 },
        dig:       { f: ['assets/sounds/pickup.ogg'], v: 0.6 },
    },
    U: {
        click:  { f: ['assets/sounds/click.ogg'], v: 0.5 },
        select: { f: ['assets/sounds/select1.ogg'], v: 0.5 },
        cancel: { f: ['assets/sounds/cancel.ogg'], v: 0.5 },
        pop:    { f: ['assets/sounds/pop.ogg'], v: 0.55, d: 0.1 },
        warn:   { f: ['assets/sounds/warn.ogg'], v: 0.45 },
        deny:   { f: ['assets/sounds/deny.ogg'], v: 0.4 },
        toggle: { f: ['assets/sounds/toggleon.ogg'], v: 0.5 },
        toggleoff: { f: ['assets/sounds/toggleoff.ogg'], v: 0.5 },
        equip:  { f: ['assets/sounds/equip.ogg'], v: 0.5, d: 0.06 },
        pickup: { f: ['assets/sounds/pickup.ogg'], v: 0.75, d: 0.12 },
        drop:   { f: ['assets/sounds/logdrop.ogg'], v: 0.5, d: 0.1 },
        gem:    { f: ['assets/sounds/gem.ogg'], v: 0.8 },
        coin:   { f: ['assets/sounds/coin.ogg'], v: 0.7 },
        heal:   { f: ['assets/sounds/heal.ogg'], v: 0.8 },
        keys:   { f: ['assets/sounds/keys.ogg'], v: 0.8 },
        page:   { f: ['assets/sounds/page.ogg'], v: 0.7 },
        map:    { f: ['assets/sounds/mapopen.ogg'], v: 0.7 },
        empty:  { f: ['assets/sounds/tick.ogg'], v: 0.7 },
        win:    { f: ['assets/sounds/win.ogg'], v: 0.9 },
        lose:   { f: ['assets/sounds/lose.ogg'], v: 0.9 },
        rescue: { f: ['assets/sounds/rescue.ogg'], v: 0.9 },
        fanfare:{ f: ['assets/sounds/fanfare.ogg'], v: 0.8 },
        weapon: { f: ['assets/sounds/weaponequip.ogg'], v: 0.6 },
    },

    init() {
        Synth.init();
        // Menu feedback is immediate; creature/weapon variants decode on first use.
        Sound.preload(Object.values(this.U).flatMap(t => t.f).filter(f => !f.startsWith('synth:')));
    },

    _pick(t) { return t.f[Math.floor(Math.random() * t.f.length)]; },

    play(name, o) {
        const t = this.T[name] || this.U[name];
        if (!t) return null;
        const opts = o || {};
        const start = (url, base, rate, detune) => {
            const handle = Sound.play(url, { volume: base * (opts.vol == null ? 1 : opts.vol), rate, detune, pan: opts.pan || 0, spatial: !!opts.position });
            if (handle && opts.position) this.voices.push({ handle, x: opts.position.x, z: opts.position.z, volume: base * opts.position.volume });
            return handle;
        };
        if (t.layer) start(t.layer, t.layerVolume || .3, opts.rate || 1, 0);
        return start(this._pick(t), t.v || 1, (t.r || 1) * (opts.rate || 1), t.d || 0);
    },
    ui(name, vol) { return this.play(name, { vol }); },

    // Все мировые источники ограничены небольшим радиусом вокруг игрока.
    radius() { return (typeof SOUND_RADIUS_METERS === 'number' ? SOUND_RADIUS_METERS : 12) * M; },
    attenuation(distance) {
        const radius = this.radius(), near = Math.min(2 * M, radius * .25);
        if (!Number.isFinite(distance) || distance >= radius) return 0;
        if (distance <= near) return 1;
        const k = (distance - near) / (radius - near);
        return 1 - k * k * (3 - 2 * k);
    },
    // Позиционный звук: расстояние на плоскости мира; камера задаёт только панораму.
    at(name, x, y, z, vol, rate) {
        const t = this.T[name] || this.U[name];
        if (!t) return null;
        const dx = x - Player.x, dz = z - Player.z, d = Math.hypot(dx, dz);
        const att = this.attenuation(d);
        if (att <= 0) return null;
        const r = Cam.rightV;
        const pan = r && d > 60 ? U.clamp((dx * r.x + dz * r.z) / d * 0.85, -0.9, 0.9) : 0;
        return this.play(name, { vol: (vol == null ? 1 : vol) * att, rate, pan, position: { x, z, volume: vol == null ? 1 : vol } });
    },
    // Совместимость старых событий: даже вой/гром подчиняются общему радиусу.
    far(name, x, y, z, vol, maxD) {
        return this.at(name, x, y, z, vol);
    },

    // Поверхность под ногами: доски, вода пруда, утоптанная земля у лагеря, камень гряды, снег чащи; иначе — трава
    surface(x, z) {
        if (Player.onWood && Math.hypot(x - Player.x, z - Player.z) < 200) return 'wood';
        try {
            if (window.Zones && Zones.pondAt && Zones.pondAt(x, z)) return 'water';
            return World.surfaceAt(x, z);
        } catch (e) { /* без поверхности — обычный шаг */ }
        return 'grass';
    },
    step(x, y, z, k) {
        const s = this.surface(x == null ? Player.x : x, z == null ? Player.z : z);
        const name = { wood: 'stepwood', water: 'stepwater', stone: 'stepstone', snow: 'stepsnow', dirt: 'stepdirt' }[s] || 'step';
        this.at(name, x == null ? Player.x : x, y == null ? Player.y : y, z == null ? Player.z : z, (k == null ? 1 : k) * 0.9, 0.95 + Math.random() * 0.15);
    },

    // ---------------------------------------------------------------------------- петли
    startLoops() {
        if (this.loops.day) return;
        this.loops.day = Sound.loop('assets/sounds/amb-day.ogg', { volume: 0 });
        this.loops.night = Sound.loop('assets/sounds/amb-night.ogg', { volume: 0 });
        this.loops.wind = Sound.loop('synth:wind', { volume: 0 });
        this.loops.crick = Sound.loop('synth:crickets', { volume: 0 });
        this.loops.fire = Sound.loop('assets/sounds/fireloop.ogg', { volume: 0 });
        this.loops.crack = Sound.loop('synth:crackle', { volume: 0 });
        this.loops.breath = Sound.loop('synth:breath', { volume: 0 });
        this.loops.dark = Sound.loop('assets/sounds/amb-dark.ogg', { volume: 0 });
        this.loops.rain = Sound.loop('assets/sounds/rain.ogg', { volume: 0 });
    },

    update(dt, ctx) {
        // Пересчитывать уже звучащие эффекты тоже: игрок может отбежать от источника.
        this.voices = this.voices.filter(v => !v.handle.ended && !v.handle.stopped);
        for (const v of this.voices) {
            const dx = v.x - Player.x, dz = v.z - Player.z, d = Math.hypot(dx, dz), r = Cam.rightV;
            const pan = r && d > 60 ? U.clamp((dx * r.x + dz * r.z) / d * .85, -.9, .9) : 0;
            v.handle.set(v.volume * this.attenuation(d), pan);
        }
        const L = this.loops;
        if (!L.day) return;
        const dl = Sky.daylight, night = 1 - dl;
        const m = ctx.menu ? 0.5 : 1, am = this.ambK == null ? 1 : this.ambK;   // am — ползунок «Окружение» в настройках
        L.day.set(0.55 * dl * m * am);
        L.night.set(0.6 * night * m * am);
        L.wind.set((0.18 + 0.22 * night + ctx.windK * 0.2) * m * am);
        L.crick.set(0.14 * night * night * m * (ctx.nearFire ? 0.35 : 1) * am);
        // костёр: по расстоянию
        const fd = ctx.fireDist;
        const fk = ctx.fireLit ? this.attenuation(fd) * (0.55 + 0.45 * ctx.fireLevel) : 0;
        L.fire.set(fk * 0.75, 0.9 + ctx.fireLevel * 0.2);
        L.crack.set(fk * 0.5);
        // присутствие оленя: дыхание
        const deer = window.Enemies && Enemies.deer;
        const deerNear = deer && deer.alive ? this.attenuation(Math.hypot(deer.x - Player.x, deer.z - Player.z)) : 0;
        L.breath.set(ctx.deerK * deerNear * 0.9);
        L.dark.set((0.26 * night * night * am * (ctx.nearFire ? 0.2 : 1) + ctx.deerK * deerNear * 0.55) * m);
        if (L.rain) L.rain.set(((window.Events && Events.rain) || 0) * 0.85 * m * am);
        this.resolveMusic(ctx);
        this.nightSounds(dt, ctx);
        // сердцебиение при низком HP или страхе
        const fear = Math.max(ctx.deerK, ctx.hp < 35 ? (1 - ctx.hp / 35) : 0);
        if (fear > 0.15 && !ctx.dead) {
            this.hbT -= dt;
            if (this.hbT <= 0) { this.hbT = 1.15 - fear * 0.65; Sound.play('synth:heartbeat', { volume: 0.35 + fear * 0.55 }); }
        }
    },

    // Какую музыку хотят системы: menu > chase > night. Разбор — в update().
    want: { menu: false, chase: false },
    ambT: 12,
    resolveMusic(ctx) {
        let k = null;
        if (ctx.menu || this.want.menu) k = 'menu';
        else if (this.want.chase) k = 'chase';
        else if (Sky.night > 0.62 && !ctx.dead) k = 'night';
        this.music(k);
    },
    // Далёкие ночные звуки: вой, существа, сова
    nightSounds(dt, ctx) {
        if (ctx.menu || Sky.night < 0.6) return;
        this.ambT -= dt;
        if (this.ambT > 0) return;
        this.ambT = 12 + Math.random() * 22;
        const a = Math.random() * 6.28, r = (28 + Math.random() * 60) * M;
        const x = Player.x + Math.cos(a) * r, z = Player.z + Math.sin(a) * r, pick = Math.random();
        if (pick < 0.45) this.far('howl', x, 0, z, 0.8, 10000);
        else if (pick < 0.75) this.far('creature', x, 0, z, 0.8, 8000);
        else this.far('hoot', x, 0, z, 0.9, 9000);
    },
    // Музыка: 'menu' | 'chase' | 'night' | null
    music(kind) {
        if (kind === this.musicNow) return;
        this.musicNow = kind;
        if (kind === 'menu') Sound.music('assets/sounds/music-menu.ogg', { volume: 0.7, fade: 1.2 });
        else if (kind === 'chase') Sound.music('assets/sounds/music-chase.ogg', { volume: 0.8, fade: 0.6 });
        else if (kind === 'night') Sound.music('assets/sounds/music-night.ogg', { volume: 0.5, fade: 3.5 });
        else Sound.music(null, { fade: 1.5 });
    },
};

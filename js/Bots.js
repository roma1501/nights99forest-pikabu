// Bots.js — боты-помощники (1–3 штуки, выбираются при старте новой игры).
// Каждый бот — полноценный герой (Rig из Player.instanceFor) со случайным скином. Мозг — приоритетный автомат:
// down > mourn > fight/flee > heal > support > revive > guard (ночь у костра) > deliver > work (по роли) > follow.
// Роли: дровосек (рубит деревья, носит дрова в костёр), охотник (лук с кайтингом, добывает мясо), собиратель
// (ягоды, грядки, вещи с земли), универсал (режим «один бот»). Враги выбирают цель из игрока и ботов
// (Enemies.targetOf), бот получает урон через b.hurt(). Поверженного бота поднимает игрок (E), напарник или время.

/** @type {Record<string, any>} */
const Bots = {
    list: [], mode: 0, t: 0,
    deliverToPlayer: false, deliveryTimes: [],
    layer: null, party: null,
    threats: [], focus: null, _scanT: 0, _sayT: 0, _day: 0, _wasNight: false, pStill: 0, _tmp: { x: 0, z: 0, hit: null },
    playerDown: false,

    ROLES: {
        lumber: { icon: '🪓', color: '#ffb347', name: ['Дровосек', 'Lumberjack'], weapon: 'axe_good', tool: 'axe_good', flee: 0.3, avoidStrong: false, jobs: ['tree', 'log', 'pile'], proactive: false },
        hunter: { icon: '🏹', color: '#ff7a7a', name: ['Охотник', 'Hunter'], weapon: 'bow', tool: 'bow', flee: 0.2, avoidStrong: false, jobs: ['hunt', 'loot'], proactive: true },
        gather: { icon: '🧺', color: '#7dff9a', name: ['Собиратель', 'Gatherer'], weapon: 'axe_old', tool: 'axe_old', flee: 0.45, avoidStrong: true, jobs: ['plant', 'loot', 'note'], proactive: false },
        all: { icon: '⭐', color: '#ffd070', name: ['Помощник', 'Companion'], weapon: 'spear', tool: 'axe_good', flee: 0.28, avoidStrong: false, jobs: ['tree', 'plant', 'log', 'loot', 'note'], proactive: false },
    },
    PLAN: { 1: ['all'], 2: ['lumber', 'hunter'], 3: ['lumber', 'hunter', 'gather'] },
    NAMES: {
        ru: ['Макс', 'Луна', 'Тоша', 'Мира', 'Бублик', 'Ёжик', 'Рекс', 'Соня', 'Гоша', 'Лисса'],
        en: ['Max', 'Luna', 'Toby', 'Mira', 'Biscuit', 'Pip', 'Rex', 'Sunny', 'Gus', 'Fern'],
    },
    PH: {
        greet: { ru: ['Я с тобой!', 'Вместе веселее!', 'Погнали!', 'Прикрою тебя!'], en: ['I got your back!', 'Together we are strong!', 'Let us go!', 'Covering you!'] },
        fight: { ru: ['Держись, я иду!', 'Получай!', 'Не подходи!', 'Я займусь им!'], en: ['Hold on, coming!', 'Take that!', 'Stay back!', 'I got this one!'] },
        wolf: { ru: ['Волки!', 'Волки рядом!', 'Слышу рычание!'], en: ['Wolves!', 'Wolves nearby!', 'I hear growling!'] },
        bear: { ru: ['Медведь! Осторожно!', 'Большой медведь!'], en: ['Bear! Careful!', 'That is a big bear!'] },
        raid: { ru: ['Культисты!', 'Это рейд!'], en: ['Cultists!', 'It is a raid!'] },
        hurt: { ru: ['Ай!', 'Больно!', 'Ох!'], en: ['Ouch!', 'That hurt!', 'Oof!'] },
        flee: { ru: ['Отступаю!', 'Мне нужна помощь!', 'Я ранен!'], en: ['Falling back!', 'I need help!', 'I am hurt!'] },
        down: { ru: ['Помоги мне...', 'Я упал...'], en: ['Help me...', 'I am down...'] },
        note: { ru: ['Смотри, записка!', 'Нашёл бумажку!', 'Тут что-то написано!'], en: ['Look, a note!', 'Found a paper!', 'Something is written here!'] },
        nade: { ru: ['Граната!', 'Берегись, бросаю!', 'Бум!'], en: ['Grenade!', 'Fire in the hole!', 'Boom!'] },
        thanks: { ru: ['Спасибо!', 'Ты спас меня!', 'Я снова в строю!'], en: ['Thanks!', 'You saved me!', 'Back in action!'] },
        revive: { ru: ['Держись, я помогу!', 'Вставай!'], en: ['Hang on, helping!', 'Get up!'] },
        chop: { ru: ['Руби-руби!', 'Дрова будут!', 'Тимбер!'], en: ['Chop chop!', 'Firewood incoming!', 'Timber!'] },
        gather: { ru: ['Ягодки!', 'Нашёл съедобное!', 'Соберу побольше.'], en: ['Berries!', 'Found something tasty!', 'Gathering more.'] },
        give: { ru: ['Держи!', 'Это тебе!', 'Держи запасы!'], en: ['Here you go!', 'This is for you!', 'Supplies for you!'] },
        fire: { ru: ['Подкину в костёр!', 'Костёр не погаснет!'], en: ['Feeding the fire!', 'The fire stays lit!'] },
        heal: { ru: ['Подлатаю тебя!', 'Вот бинт!'], en: ['Patching you up!', 'Here is a bandage!'] },
        healed: { ru: ['Так лучше.', 'Полегчало.'], en: ['Better now.', 'Feeling better.'] },
        night: { ru: ['Темнеет. К костру!', 'Ночь близко!', 'Пора к огню.'], en: ['It is getting dark. To the fire!', 'Night is coming!', 'Time to gather by the fire.'] },
        dawn: { ru: ['Рассвет! Мы выжили!', 'Ещё одна ночь позади!'], en: ['Dawn! We made it!', 'One more night survived!'] },
        kill: { ru: ['Есть!', 'Один готов!', 'Так его!'], en: ['Got it!', 'One down!', 'Nice!'] },
        rip: { ru: ['Нет! Только не ты...', 'Мы тебя вернём...'], en: ['No! Not you...', 'We will bring you back...'] },
        back: { ru: ['Ты вернулся!', 'Рад тебя видеть!', 'С возвращением!'], en: ['You are back!', 'Good to see you!', 'Welcome back!'] },
        late: { ru: ['Подожди меня!', 'Я догоняю!'], en: ['Wait for me!', 'Catching up!'] },
        idle: { ru: ['Тихий лес...', 'Что дальше?', 'Я готов.', 'Красиво тут.'], en: ['Quiet forest...', 'What is next?', 'Ready when you are.', 'Pretty here.'] },
    },

    // Роли и облик определяются номером бота; груз и нулевое здоровье сохраняются без бесплатного восстановления.
    loadDeliverySetting() { this.deliverToPlayer = typeof Store !== 'undefined' && Store.get(GAME_ID + '.botDelivery') === '1'; },
    setDeliveryToPlayer(on) { this.deliverToPlayer = !!on; if (typeof Store !== 'undefined') Store.set(GAME_ID + '.botDelivery', on ? '1' : '0'); },
    deliveryBudget() { this.deliveryTimes = this.deliveryTimes.filter(t => this.t - t < BOT_DELIVERY_WINDOW); return Math.max(0, BOT_DELIVERY_LIMIT - this.deliveryTimes.length); },
    save() { this.deliveryBudget(); return { n: this.mode, delivery: this.deliveryTimes.map(t => BOT_DELIVERY_WINDOW - (this.t - t)), l: this.list.map(b => ({ hp: Math.round(b.hp), dead: !!b.dead, md: b.meds, g: b.nades, carry: { ...b.carry }, carryLevels: this.cargoRows(b).filter(o => o.lv > 0), cargoMeta: this.cargoRows(b).filter(o => Number.isFinite(o.mag)) })) }; },
    restore(s) {
        if (!s || !s.l) return;
        this.deliveryTimes = (Array.isArray(s.delivery) ? s.delivery : []).filter(v => Number.isFinite(v) && v > 0).slice(0, BOT_DELIVERY_LIMIT).map(v => this.t - BOT_DELIVERY_WINDOW + Math.min(BOT_DELIVERY_WINDOW, v));
        s.l.forEach((o, i) => {
            const b = this.list[i]; if (!b) return;
            b.hp = Number.isFinite(o.hp) ? Math.max(0, Math.min(b.maxHp, o.hp)) : b.maxHp;
            if (o.md != null) b.meds = Math.max(0, Math.min(3, o.md | 0));
            if (o.g != null) b.nades = Math.max(0, Math.min(3, o.g | 0));
            b.carry = {}; b.carryN = 0; b.carryLevels = {}; b.cargoMeta = [];
            for (const [id, count] of Object.entries(o.carry || {})) {
                if (!DATA.items[id] || !Number.isSafeInteger(count)) continue;
                const n = Math.max(0, Number(count));
                if (n) { b.carry[id] = n; b.carryN += n; }
            }
            for (const row of Array.isArray(o.carryLevels) ? o.carryLevels : []) {
                if (!DATA.items[row.id] || !Number.isSafeInteger(row.n) || row.n <= 0 || !Number.isInteger(row.lv) || row.lv < 1 || row.lv > DATA.upgrade.max) continue;
                const levels = b.carryLevels[row.id] || (b.carryLevels[row.id] = {}), used = Object.values(levels).reduce((a, n) => a + Number(n), 0);
                const n = Math.min(row.n, (b.carry[row.id] || 0) - used); if (n > 0) levels[row.lv] = (levels[row.lv] || 0) + n;
            }
            // Старые carry/carryLevels остаются источником количества; метаданные
            // только разделяют уже существующий груз и не могут добавить оружие.
            for (const row of Array.isArray(o.cargoMeta) ? o.cargoMeta : []) {
                const def = DATA.items[row.id];
                if (!def?.mag || !Number.isSafeInteger(row.n) || row.n <= 0 || !Number.isInteger(row.lv) || row.lv < 0 || row.lv > DATA.upgrade.max || !Number.isFinite(row.mag)) continue;
                const available = this.cargoRows(b).find(r => r.id === row.id && r.lv === row.lv && !Number.isFinite(r.mag));
                const n = Math.min(row.n, available?.n || 0);
                if (n > 0) b.cargoMeta.push({id:row.id,n,lv:row.lv,mag:Math.max(0,Math.min(def.mag,Math.floor(row.mag)))});
            }
            b.dead = !!o.dead || b.hp <= 0;
            if (b.dead) {
                b.hp = 0; b.mode = 'down'; b.downT = 0;
                b.rig.play('death', { layer: 2, fade: 0, loop: false, hold: true, weight: 1, restart: true, mask: null });
                b.rig.layers[2].target = 1;
            }
        });
    },
    lang() { return Lang.code === 'ru' ? 'ru' : 'en'; },
    L() { return Lang.code === 'ru' ? 0 : 1; },

    // ------------------------------------------------------------------------------ создание
    clear() {
        for (const b of this.list) this._free(b);
        this.list = []; this.threats = []; this.focus = null; this.playerDown = false;
        this.deliveryTimes = [];
        if (this.layer) this.layer.innerHTML = '';
        if (this.party) { this.party.innerHTML = ''; this.party.style.display = 'none'; }
    },
    _free(b) {
        if (b.task && b.task.kind === 'tree' && b.task.obj._lock === b) b.task.obj._lock = null;
        if (b.held) { const r = b.held; if (r._rig) r._rig.dispose(); else { for (const m of r._meshes || []) m.dispose(); r.dispose(); } b.held = null; }
        if (b.rig) { b.rig.dispose(); b.rig = null; }
        if (b.tag) b.tag.remove();
        if (b.row) b.row.remove();
    },

    initUI() {
        if (this.layer) return;
        const st = document.createElement('style');
        st.textContent = `
#botLayer{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.bTag{position:absolute;left:0;top:0;display:none;text-align:center;will-change:transform;white-space:nowrap}
.bTag .bn{display:inline-block;font-size:15px;padding:1px 9px;border-radius:11px;background:rgba(10,10,14,.62);border:2px solid #000}
.bTag .bb{width:56px;height:6px;margin:2px auto 0;background:#000;border-radius:4px;overflow:hidden}
.bTag .bb i{display:block;height:100%;width:100%;background:#6dff8a}
.bTag .bs{display:none;max-width:200px;white-space:normal;margin:0 auto 4px;padding:3px 10px;border-radius:12px;background:#fff;color:#1a1a22;border:3px solid #000;font-size:15px;line-height:1.15}
#party{position:absolute;top:calc(var(--mm, 92px) + 108px + env(safe-area-inset-top));right:calc(14px + env(safe-area-inset-right));display:none;flex-direction:column;gap:5px;pointer-events:none}
.bpRow{display:flex;align-items:center;gap:6px;width:180px;padding:3px 9px 3px 6px;border-radius:14px;background:rgba(14,14,18,.72);border:3px solid #000;font-size:14px}
.bpRow .bpN{flex:0 0 auto;max-width:70px;overflow:hidden;text-overflow:ellipsis}
.bpRow .bpBar{flex:1;height:8px;background:#000;border-radius:5px;overflow:hidden}
.bpRow .bpBar i{display:block;height:100%;width:100%;background:#6dff8a}
.bpRow.dead{opacity:.6}
/* место и размер отряда на экране — HudLayout.js */`;
        document.head.appendChild(st);
        const root = (window.UI && UI.root) || document.body;
        // под окнами (#panels), но над игрой
        const before = window.UI && UI.el && UI.el.panels && UI.el.panels.parentNode === root ? UI.el.panels : null;
        this.layer = document.createElement('div'); this.layer.id = 'botLayer'; root.insertBefore(this.layer, before);
        this.party = document.createElement('div'); this.party.id = 'party'; root.insertBefore(this.party, before);
    },

    spawnAll(n) {
        this.clear();
        this.loadDeliverySetting();
        this.mode = n || 0;
        if (!this.mode || !Player.data) return;
        this.initUI();
        const plan = this.PLAN[Math.min(3, this.mode)] || [];
        plan.forEach((role, i) => this.spawn(i, role));
        this.party.style.display = 'flex';
        this._day = Sky.day;
    },

    spawn(i, role) {
        const cfg = this.ROLES[role];
        const rnd = U.rng(9100 + i * 37 + 5);
        const pool = SKINS.items.filter(s => s.id !== Econ.skin);
        const skin = pool[Math.floor(rnd() * pool.length)];
        const look = Player.lookOf(skin.id);
        const rig = Player.instanceFor(look, 'bot' + i);
        rig.setShadows(Player.view, true);
        const names = this.NAMES[this.lang()];
        const b = {
            idx: i, role, name: names[(i * 3 + Math.floor(rnd() * 7)) % names.length], skin: skin.id, rig,
            x: Player.x, z: Player.z, y: 0, yaw: Player.faceYaw, vx: 0, vz: 0, kx: 0, kz: 0, speed: 0,
            hp: 100, maxHp: 100, dead: false, sleeping: false, control: true,
            mode: 'follow', modeT: 0, thinkT: Math.random() * 0.2, tgt: null, task: null, nextTaskT: 1 + i * 0.6, atkCd: 0, acting: 0, pend: null,
            emote: null, emoteT: 0, hurtT: 0, invuln: 0, lastHurt: -99, meds: 2, medCd: 0, healCd: 0, dodgeCd: 0, flank: (i % 3 - 1) * 0.8,
            carry: {}, carryN: 0, cargoMeta: [], side: i % 2 ? 1 : -1, stuck: 0, stuckT: 0, _lx: 0, _lz: 0, _wm: false, _moved: false,
            nades: 1, nadeCd: 4,
            held: null, weaponId: null, weaponT: 0, downT: 0, bub: null, bubT: 0, sayT: 0, idleT: 3 + i * 2, wander: null, chan: 0, lastStepPhase: 0,
            upper: rig.maskOf(['UpperTorso']), armR: rig.maskOf(['ArmR']), ally: null, _hdOff: 0, _hdT: 0, _hdBase: 0, post: null, mx: 0, mz: 0,
        };
        b.hurt = function (a, sx, sz, k) { return Bots.hurt(this, a, sx, sz, k); };
        this.applyScale(b, true);
        this.warp(b, Player.x, Player.z, true, i);
        rig.play('idle', { fade: 0 });
        this.equip(b, cfg.weapon);
        // HUD: метка над головой и строка в группе
        const tag = document.createElement('div'); tag.className = 'bTag';
        tag.innerHTML = '<div class="bs rb1"></div><div class="bn rb1"><span class="bi"></span> <span class="bnn"></span></div><div class="bb"><i></i></div>';
        tag.querySelector('.bnn').textContent = b.name;
        /** @type {HTMLElement} */ (tag.querySelector('.bn')).style.color = cfg.color;
        this.layer.appendChild(tag); b.tag = tag;
        b.tBub = tag.querySelector('.bs'); b.tIc = tag.querySelector('.bi'); b.tBar = tag.querySelector('.bb i');
        const row = document.createElement('div'); row.className = 'bpRow';
        row.innerHTML = '<span class="bpIc"></span><span class="bpN rb1"></span><div class="bpBar"><i></i></div><span class="bpSt"></span>';
        row.querySelector('.bpIc').textContent = cfg.icon; row.querySelector('.bpN').textContent = b.name; /** @type {HTMLElement} */ (row.querySelector('.bpN')).style.color = cfg.color;
        this.party.appendChild(row); b.row = row; b.rBar = row.querySelector('.bpBar i'); b.rSt = row.querySelector('.bpSt');
        this.list.push(b);
        b.emote = 'wave'; b.emoteT = 1.6;
        if (i === 0) setTimeout(() => this.say(b, 'greet', true), 900);
    },

    // Здоровье растёт с днями
    applyScale(b, full) {
        const mx = 100 + Math.min(120, (Sky.day - 1) * 3);
        const f = b.maxHp ? b.hp / b.maxHp : 1;
        b.maxHp = mx; b.hp = full ? mx : Math.max(1, Math.round(mx * f));
    },

    // ------------------------------------------------------------------------------ предмет в руке
    equip(b, id) {
        if (b.weaponId === id && b.held) return;
        if (b.held) { const r = b.held; if (r._rig) r._rig.dispose(); else { for (const m of r._meshes || []) m.dispose(); r.dispose(); } b.held = null; }
        b.weaponId = id; b.weaponT = this.t;
        b.rig.stop(1, 0.1);
        const d = DATA.items[id];
        if (!d) return;
        if (id === 'bow' && window.Archery) { b.held = Archery.makeBow(b); return; }
        const root = Items.make(id);
        b.held = root;
        const g = Player.GRIPS[d.grip || 'hold'] || Player.GRIPS.hold;
        root.parent = b.rig.node(g.bone || 'GripR');
        root.position.set(g.pos[0] * M, g.pos[1] * M, g.pos[2] * M);
        root.rotationQuaternion = new BABYLON.Quaternion(g.q[0], g.q[1], g.q[2], g.q[3]);
        root.scaling.setAll((g.scale || 1) * (d.holdScale || 1));
        for (const m of root._meshes || []) Player.view.addShadowCaster(m, false);
        if (g.stance && b.rig.has(g.stance)) b.rig.play(g.stance, { layer: 1, mask: g.arms === 'both' ? b.upper : b.armR, fade: 0.16, weight: 1, restart: true });
    },
    ensureWeapon(b, id) { if (b.weaponId !== id && this.t - b.weaponT > 1.1) this.equip(b, id); },

    // ------------------------------------------------------------------------------ речь
    say(b, key, force) {
        if (b.dead && key !== 'down') return;
        if (!force && (this.t - this._sayT < 1.8 || this.t - b.sayT < 5)) return;
        const pool = this.PH[key];
        if (!pool) return;
        const arr = pool[this.lang()];
        b.bub = arr[Math.floor(Math.random() * arr.length)]; b.bubT = 3.2;
        b.sayT = this.t; this._sayT = this.t;
        if (b.tBub) { b.tBub.textContent = b.bub; b.tBub.style.display = 'block'; }
    },

    // ------------------------------------------------------------------------------ движение
    blockedAt(x, z, r) {
        let hit = false;
        World.colliders.query(x, z, r, () => { hit = true; });
        return hit || !!(Zones.pondAt && Zones.pondAt(x, z));
    },
    // Направление с обходом препятствий: пробуем отклонения слева/справа, выбор кэшируется на 0.12 с
    heading(b, dx, dz, d, o) {
        const base = Math.atan2(dx, dz);
        if (o.direct || d < 280) return base;
        if (this.t < b._hdT && Math.abs(U.angleDiff(base, b._hdBase)) < 0.3) return base + b._hdOff;
        const s = b.side;
        const offs = [0, 0.5 * s, -0.5 * s, 1.0 * s, -1.0 * s, 1.5 * s, -1.5 * s, 2.4 * s];
        let pick = 2.4 * s;
        for (const off of offs) {
            const a = base + off, sa = Math.sin(a), ca = Math.cos(a);
            if (!this.blockedAt(b.x + sa * 130, b.z + ca * 130, 40) && !this.blockedAt(b.x + sa * 270, b.z + ca * 270, 40)) { pick = off; break; }
        }
        if (pick !== 0) b.side = Math.sign(pick);
        b._hdOff = pick; b._hdBase = base; b._hdT = this.t + 0.12;
        return base + pick;
    },
    moveTo(b, tx, tz, speed, dt, o) {
        o = o || {};
        b._moved = true;
        const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
        const stop = o.stop != null ? o.stop : 40;
        let sp = speed;
        if (d <= stop) sp = 0; else if (d < stop + 160) sp *= 0.25 + 0.75 * (d - stop) / 160;
        const ang = sp > 0 ? this.heading(b, dx, dz, d, o) : Math.atan2(dx, dz);
        if (sp > 0) { b._wm = true; if (!o.noTurn) b.yaw = U.dampAngle(b.yaw, ang, o.turnK || 10, dt); }
        b.vx = U.damp(b.vx, Math.sin(ang) * sp, 8, dt); b.vz = U.damp(b.vz, Math.cos(ang) * sp, 8, dt);
        this.step(b, dt);
        return d;
    },
    settle(b, dt) { b._moved = true; b.vx = U.damp(b.vx, 0, 10, dt); b.vz = U.damp(b.vz, 0, 10, dt); this.step(b, dt); },
    face(b, tx, tz, dt, k) { b.yaw = U.dampAngle(b.yaw, Math.atan2(tx - b.x, tz - b.z), k || 10, dt); },
    step(b, dt) {
        let nx = b.x + (b.vx + b.kx) * dt, nz = b.z + (b.vz + b.kz) * dt;
        b.kx = U.damp(b.kx, 0, 6, dt); b.kz = U.damp(b.kz, 0, 6, dt);
        // не слипаться с напарниками и игроком
        for (const o of this.list) {
            if (o === b || o.dead) continue;
            const ax = nx - o.x, az = nz - o.z;
            if (Math.abs(ax) < 100 && Math.abs(az) < 100) { const dd = Math.hypot(ax, az) || 1; if (dd < 100) { nx += ax / dd * (100 - dd) * 0.5; nz += az / dd * (100 - dd) * 0.5; } }
        }
        if (!Player.dead) { const ax = nx - Player.x, az = nz - Player.z, dd = Math.hypot(ax, az) || 1; if (dd < 105) { nx += ax / dd * (105 - dd) * 0.5; nz += az / dd * (105 - dd) * 0.5; } }
        const rr = World.colliders.resolve(nx, nz, 42, this._tmp);
        if (Zones.pondAt && Zones.pondAt(rr.x, rr.z)) { b.vx *= 0.3; b.vz *= 0.3; b.side = -b.side; }
        else { b.x = rr.x; b.z = rr.z; }
        const p = { x: b.x, z: b.z };
        if (World.clampToFog(p, 260)) { b.x = p.x; b.z = p.z; }
        b.speed = Math.hypot(b.vx, b.vz);
    },
    // Телепорт в укромную точку рядом с (x, z) — сзади камеры
    warp(b, x, z, quiet, n) {
        const base = Cam.yaw + Math.PI + (((n != null ? n : b.idx) % 3) - 1) * 0.7;
        let px = x, pz = z;
        for (let k = 0; k < 14; k++) {
            const a = base + (k % 2 ? 1 : -1) * Math.floor(k / 2) * 0.45, r = (5.5 + b.idx * 0.6 + Math.floor(k / 4)) * M;
            const cx = x + Math.sin(a) * r, cz = z + Math.cos(a) * r;
            if (!this.blockedAt(cx, cz, 60)) { px = cx; pz = cz; break; }
        }
        if (!quiet && b.rig) FX.poof(b.x, b.y + 90, b.z, false);
        b.x = px; b.z = pz; b.y = World.heightAt(px, pz); b.vx = b.vz = b.kx = b.kz = 0; b._hdT = 0;
        b.task = null; b.stuck = 0;
        if (!quiet) FX.poof(b.x, b.y + 90, b.z, false);
    },

    // ------------------------------------------------------------------------------ главный цикл
    update(dt) {
        if (!this.list.length) return;
        this.t += dt;
        this.pStill = Player.speed < 120 && !Player.dead ? this.pStill + dt : 0;
        if (Sky.day !== this._day) this.onNewDay();
        const night = Sky.isNight();
        if (night && !this._wasNight && !Player.dead) { const b = this.list.find(o => !o.dead); if (b) this.say(b, 'night', true); }
        this._wasNight = night;
        this._scanT -= dt;
        if (this._scanT <= 0) { this._scanT = 0.25; this.scan(); }
        for (const b of this.list) {
            this.timers(b, dt);
            if (!b.dead) {
                b.thinkT -= dt;
                if (b.thinkT <= 0) { b.thinkT = 0.2 + Math.random() * 0.06; this.setMode(b, this.think(b)); }
            }
            b._moved = false; b._wm = false;
            this.run(b, dt);
            if (!b._moved) this.settle(b, dt);
            this.stuckCheck(b, dt);
            this.animate(b, dt);
        }
        this.updateHud(dt);
    },

    timers(b, dt) {
        b.modeT += dt;
        if (b.atkCd > 0) b.atkCd -= dt;
        if (b.acting > 0) b.acting -= dt;
        if (b.dodgeCd > 0) b.dodgeCd -= dt;
        if (b.invuln > 0) b.invuln -= dt;
        if (b.hurtT > 0) b.hurtT -= dt;
        if (b.medCd > 0) b.medCd -= dt;
        if (b.healCd > 0) b.healCd -= dt;
        if (b.nadeCd > 0) b.nadeCd -= dt;
        if (b.emoteT > 0) { b.emoteT -= dt; if (b.emoteT <= 0) b.emote = null; }
        if (b.pend) { b.pend.left -= dt; if (b.pend.left <= 0) { const f = b.pend.fn; b.pend = null; f(); } }
        if (window.Archery && b.weaponId === 'bow') Archery.botTick(b, dt);
        if (b.bubT > 0) { b.bubT -= dt; if (b.bubT <= 0 && b.tBub) b.tBub.style.display = 'none'; }
        if (!b.dead) {
            // восстановление: у костра быстро, в лесу медленно
            const calm = this.t - b.lastHurt > 6;
            if (b.hp < b.maxHp) {
                if (Camp.isSafe(b.x, b.z, 0)) b.hp = Math.min(b.maxHp, b.hp + 4 * dt);
                else if (calm) b.hp = Math.min(b.maxHp, b.hp + 0.7 * dt);
            }
        } else {
            b.downT += dt;
            if (b.downT > 80) this.respawn(b);
        }
    },

    stuckCheck(b, dt) {
        b.stuckT += dt;
        if (b.stuckT < 0.9) return;
        b.stuckT = 0;
        const moved = Math.hypot(b.x - b._lx, b.z - b._lz);
        b._lx = b.x; b._lz = b.z;
        if (b._wm && moved < 55) {
            b.stuck++;
            b.side = -b.side; b._hdT = 0;
            const a = Math.random() * 6.28; b.kx = Math.sin(a) * 520; b.kz = Math.cos(a) * 520;
            if (b.stuck >= 3 && b.task) this.endTask(b, true);
            if (b.stuck >= 7 && (b.mode === 'follow' || b.mode === 'deliver')) { const p = b.mode === 'deliver' ? this.deliveryTarget(b) : Player; this.warp(b, p.x, p.z, false); }
        } else b.stuck = 0;
    },

    // ------------------------------------------------------------------------------ обзор угроз
    scan() {
        const th = []; let focus = null, fs = -1e9;
        for (const e of Enemies.list) {
            if (!e.alive || e.type === 'deer') continue;
            const dP = Math.hypot(e.x - Player.x, e.z - Player.z);
            if (dP > 55 * M) continue;
            th.push(e);
            if (e.type === 'bunny') continue;
            if (e.state === 'chase' || e.state === 'attack') {
                const s = 100 - dP / M + (e.type === 'bear' || e.type === 'alpha' ? 10 : 0) - (e.hp / e.maxHp) * 3;
                if (s > fs) { fs = s; focus = e; }
            }
        }
        this.threats = th; this.focus = focus;
    },
    isStrong(e) { return e.type === 'bear' || e.type === 'alpha' || e.maxHp >= 150; },

    // Лучшая цель для боя или null
    pickThreat(b) {
        const cfg = this.ROLES[b.role], hpF = b.hp / b.maxHp;
        let best = null, bs = -1e9;
        for (const e of this.threats) {
            if (e.type === 'bunny') continue;
            const dist = Math.hypot(e.x - b.x, e.z - b.z), dP = Math.hypot(e.x - Player.x, e.z - Player.z);
            const aggro = e.state === 'chase' || e.state === 'attack';
            let ok = false;
            if (aggro) ok = dist < 22 * M || dP < 16 * M;
            else if (e.state === 'alert') ok = dist < 14 * M || dP < 12 * M;
            else if (e.state === 'flee' || e.stun > 0) ok = dist < 7 * M;
            else if (cfg.proactive && (e.type === 'wolf' || e.type === 'cultist') && !e.guard && dist < 12 * M && dP < 18 * M && hpF > 0.65) ok = true;
            if (!ok) continue;
            const s = -dist / M + (aggro ? 6 : e.state === 'alert' ? 3 : 0) + (e === this.focus ? 4 : 0) + (dP < 12 * M ? 4 : 0) + (e.hp / e.maxHp < 0.5 ? 2 : 0) - (e.type === 'cultist' && e.ranged ? 0 : 0);
            if (s > bs) { bs = s; best = e; }
        }
        return best;
    },

    // ------------------------------------------------------------------------------ выбор режима
    think(b) {
        const P = Player, cfg = this.ROLES[b.role];
        if (b.dead) return 'down';
        const hpF = b.hp / b.maxHp;
        if (P.dead) return 'mourn';
        const pd = Math.hypot(b.x - P.x, b.z - P.z);
        // угрозы
        const e = this.pickThreat(b);
        if (e) {
            b.tgt = e;
            const strong = this.isStrong(e);
            let crowd = 0;
            for (const o of this.threats) if (o.state !== 'idle' && o.type !== 'bunny' && Math.hypot(o.x - b.x, o.z - b.z) < 12 * M) crowd++;
            const gap = Math.hypot(e.x - b.x, e.z - b.z) - e.rad;
            const weak = hpF < cfg.flee || (cfg.avoidStrong && (strong || crowd >= 3) && hpF < 0.9) || (crowd >= 3 && hpF < 0.55);
            if (weak && !(b.mode === 'fight' && gap < 2.2 * M && hpF > 0.12)) {
                if (b.mode !== 'flee') this.say(b, 'flee');
                return 'flee';
            }
            if (b.mode !== 'fight') this.say(b, e.type === 'bear' ? 'bear' : e.raid || e.type === 'cultist' ? 'raid' : e.type === 'wolf' || e.type === 'alpha' ? 'wolf' : 'fight');
            return 'fight';
        }
        b.tgt = null;
        if (hpF < 0.5 && b.meds > 0 && b.medCd <= 0) return 'heal';
        if (!P.dead && P.hp < P.maxHp * 0.4 && b.meds > 0 && b.healCd <= 0) return 'support';
        const dd = this.downedAlly(b);
        if (dd) { b.ally = dd; return 'revive'; }
        const night = Sky.isNight(), inCamp = Camp.isSafe(P.x, P.z, 0);
        if (this.needsStoredFuel(b)) return 'deliver';
        if (b.carryN > 0 && (this.fuelCargo(b) || b.carryN >= 5 || !b.task)) return 'deliver';
        if ((night && inCamp) || P.sleeping) return 'guard';
        if (pd > 34 * M) return 'follow';
        const nearCamp = Math.hypot(P.x - Camp.x, P.z - Camp.z) < 40 * M;
        if (this.pStill > 1.2 || nearCamp) return 'work';
        return 'follow';
    },
    setMode(b, m) {
        if (m === b.mode) return;
        if (b.mode === 'work' && m !== 'work') this.endTask(b, false);
        b.mode = m; b.modeT = 0; b.chan = 0; b.pend = null; b.wander = null;
        if (m === 'fight') b.dodgeCd = Math.max(b.dodgeCd, 0.4);
    },
    downedAlly(b) {
        for (const o of this.list) {
            if (o === b || !o.dead) continue;
            if (o.helper && o.helper !== b && !o.helper.dead) continue;
            if (Math.hypot(o.x - b.x, o.z - b.z) > 40 * M) continue;
            let danger = false;
            for (const e of this.threats) if (e.type !== 'bunny' && e.state !== 'idle' && Math.hypot(e.x - o.x, e.z - o.z) < 9 * M) { danger = true; break; }
            if (!danger) { o.helper = b; return o; }
        }
        return null;
    },

    // ------------------------------------------------------------------------------ исполнение режимов
    run(b, dt) {
        switch (b.mode) {
            case 'down': return this.tickDown(b, dt);
            case 'mourn': return this.tickMourn(b, dt);
            case 'fight': return this.tickFight(b, dt);
            case 'flee': return this.tickFlee(b, dt);
            case 'heal': return this.tickHeal(b, dt);
            case 'support': return this.tickSupport(b, dt);
            case 'revive': return this.tickRevive(b, dt);
            case 'guard': return this.tickGuard(b, dt);
            case 'deliver': return this.tickDeliver(b, dt);
            case 'work': return this.tickWork(b, dt);
            default: return this.tickFollow(b, dt);
        }
    },

    // ---- следование: место в строю, подтягивание, простой
    slot(b) {
        const n = this.list.length, P = Player;
        const moving = P.speed > 120;
        const face = moving ? Math.atan2(P.vx, P.vz) : P.faceYaw;
        const a = face + Math.PI + (b.idx - (n - 1) / 2) * 0.95;
        const r = (moving ? 2.7 : 3.5) * M + b.idx * 0.35 * M;
        return { x: P.x + Math.sin(a) * r, z: P.z + Math.cos(a) * r };
    },
    tickFollow(b, dt, loose) {
        const P = Player, Pl = DATA.player;
        const pd = Math.hypot(b.x - P.x, b.z - P.z);
        if (pd > 62 * M) { this.warp(b, P.x, P.z, false); this.say(b, 'late'); return; }
        const s = this.slot(b), d = Math.hypot(s.x - b.x, s.z - b.z);
        if (pd > 18 * M && b.modeT > 1) this.say(b, 'late');
        const inner = loose ? 5.5 * M : 1.5 * M;
        if (d > 450 || pd > 7 * M || P.speed > 150) {
            const sp = pd > 26 * M ? Pl.sprint * 1.06 : d > 1600 ? Pl.sprint * 0.98 : U.clamp(d * 1.7, Pl.walk * 0.8, Pl.run * 1.05);
            this.moveTo(b, s.x, s.z, sp, dt, { stop: 90 });
            b.wander = null; b.idleT = 3 + Math.random() * 4;
            return;
        }
        // рядом с игроком: осматриваемся
        if (b.wander) {
            const dd = this.moveTo(b, b.wander.x, b.wander.z, Pl.walk * 0.8, dt, { stop: 40 });
            if (dd < 70) b.wander = null;
            return;
        }
        this.face(b, P.x, P.z, dt, 4);
        this.settle(b, dt);
        b.idleT -= dt;
        if (b.idleT <= 0) {
            b.idleT = 4 + Math.random() * 7;
            const r = Math.random();
            if (r < 0.45) { const a = Math.random() * 6.28, rr = (1 + Math.random() * 2.2) * M; b.wander = { x: s.x + Math.cos(a) * rr, z: s.z + Math.sin(a) * rr }; if (this.blockedAt(b.wander.x, b.wander.z, 60)) b.wander = null; }
            else if (r < 0.62 && this.pStill > 6) { b.emote = ['wave', 'clap', 'dance', 'flex'][Math.floor(Math.random() * 4)]; b.emoteT = b.emote === 'wave' ? 1.8 : 3 + Math.random() * 3; }
            else if (r < 0.72 && this.pStill > 6) this.say(b, 'idle');
        }
    },

    // ---- ночь у костра: посты по кругу, лицом наружу
    tickGuard(b, dt) {
        const n = this.list.length, Pl = DATA.player;
        const a0 = b.idx / n * 6.283 + 0.7;
        const r = U.clamp(Camp.safeRadius() * 0.58, 3.2 * M, 9 * M);
        const tx = Camp.x + Math.cos(a0) * r, tz = Camp.z + Math.sin(a0) * r;
        const d = Math.hypot(tx - b.x, tz - b.z);
        if (d > 160) { this.moveTo(b, tx, tz, d > 1800 ? Pl.sprint : Pl.run * 0.9, dt, { stop: 80 }); return; }
        this.settle(b, dt);
        this.face(b, Camp.x + Math.cos(a0) * 5000, Camp.z + Math.sin(a0) * 5000, dt, 5);
        if (Player.sleeping && !b.emote) { b.emote = 'sit'; b.emoteT = 30; }
    },

    // ---- скорбь: игрок погиб
    tickMourn(b, dt) {
        const a = b.idx / Math.max(1, this.list.length) * 6.283;
        const tx = b.mx + Math.cos(a) * 2.6 * M, tz = b.mz + Math.sin(a) * 2.6 * M;
        const d = Math.hypot(tx - b.x, tz - b.z);
        if (d > 130) { this.moveTo(b, tx, tz, DATA.player.run * 0.85, dt, { stop: 70 }); return; }
        this.settle(b, dt);
        this.face(b, b.mx, b.mz, dt, 4);
        if (!b.emote) { b.emote = 'sit'; b.emoteT = 20; }
    },

    // ---- бой
    // Граната: по сильному врагу (медведь, альфа, босс) или толпе из 3+ зверей, с 7–17 м, если рядом нет игрока и напарников
    nadeOk(b, e, dist) {
        if (b.nades <= 0 || b.nadeCd > 0 || b.acting > 0 || b.dead || e.type === 'bunny' || e.type === 'deer') return false;
        if (dist < 7 * M || dist > 17 * M) return false;
        let crowd = 0;
        for (const o of this.threats) if (o.alive && o.type !== 'bunny' && o.state !== 'idle' && Math.hypot(o.x - e.x, o.z - e.z) < 6 * M) crowd++;
        if (!(this.isStrong(e) || e.boss || crowd >= 3)) return false;
        const safeR = 7 * M;
        if (!Player.dead && Math.hypot(Player.x - e.x, Player.z - e.z) < safeR) return false;
        for (const o of this.list) if (o !== b && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < safeR) return false;
        return true;
    },
    throwNade(b, e) {
        const T = DATA.items.grenade.throw, rig = b.rig;
        const d0 = rig.duration('throw') || 0.8, speed = 1.15, dur = d0 / speed;
        rig.play('throw', { layer: 2, mask: b.upper, fade: 0.05, loop: false, speed, restart: true });
        rig.layers[2].target = 1;
        b.acting = dur; b.atkCd = 1.0; b.nadeCd = 7; b.emote = null;
        this.say(b, 'nade', true);
        b.pend = { left: dur * 0.55, fn: () => {
            if (b.dead || b.nades <= 0) return;
            b.nades--;
            const from = { x: b.x + Math.sin(b.yaw) * 40, y: b.y + 130, z: b.z + Math.cos(b.yaw) * 40 };
            // цель чуть впереди движения врага
            const tx = e.x + (e.vx || 0) * 0.5, tz = e.z + (e.vz || 0) * 0.5;
            Combat.throwGrenade('grenade', from, { x: tx, y: World.heightAt(tx, tz) + 30, z: tz }, T, 'bot');
            if (window.Game) Game.autosave('nade');
        } };
        Sfx.at('swing', b.x, b.y, b.z, 0.6);
    },
    engage(b, e, dt, hunting) {
        const cfg = this.ROLES[b.role], Pl = DATA.player;
        const dx = e.x - b.x, dz = e.z - b.z, dist = Math.hypot(dx, dz) || 1, gap = dist - e.rad;
        const ranged = b.role === 'hunter';
        if (!hunting && this.nadeOk(b, e, dist)) { this.face(b, e.x, e.z, dt, 14); this.throwNade(b, e); return; }
        // уклонение от замаха
        if (!hunting && b.dodgeCd <= 0 && (e.state === 'attack' && e.st < (e.atkDur || 0.8) * 0.42) && dist < e.def.reach * 1.7 + 100 && Math.random() < 0.6) {
            b.dodgeCd = 2.4;
            const s = Math.random() < 0.5 ? 1 : -1;
            b.kx = -dz / dist * s * 980; b.kz = dx / dist * s * 980;
            FX.dust(b.x, b.y, b.z, 3, 0.4);
        }
        if (ranged) {
            this.ensureWeapon(b, 'bow');
            const bow = DATA.items.bow;
            const fleeR = e.type === 'bunny' ? 2.5 * M : 5.5 * M;
            if (gap < fleeR && e.type !== 'bunny') {
                // отступаем, не отводя взгляд
                this.moveTo(b, b.x - dx / dist * 500, b.z - dz / dist * 500, Pl.sprint * 0.95, dt, { noTurn: true });
                b.yaw = U.dampAngle(b.yaw, Math.atan2(dx, dz), 12, dt);
            } else if (gap > 15 * M) this.moveTo(b, e.x, e.z, Pl.run, dt, { stop: 12 * M });
            else if (gap > 9.5 * M) this.moveTo(b, e.x, e.z, Pl.walk, dt, { stop: 9 * M });
            else {
                // кружим боком
                const s = b.idx % 2 ? 1 : -1;
                if (e.type !== 'bunny') this.moveTo(b, b.x - dz / dist * s * 300, b.z + dx / dist * s * 300, Pl.walk * 0.6, dt, { noTurn: true }); else this.settle(b, dt);
                b.yaw = U.dampAngle(b.yaw, Math.atan2(dx, dz), 14, dt);
            }
            const aim = Math.abs(U.angleDiff(b.yaw, Math.atan2(dx, dz)));
            if (b.atkCd <= 0 && b.acting <= 0 && aim < 0.22 && gap < 26 * M) this.shoot(b, e, bow);
            return;
        }
        // ближний бой
        const wid = cfg.weapon;
        this.ensureWeapon(b, wid);
        const def = DATA.items[wid];
        const reach = (def.reach || 2.4) * M;
        if (gap > reach * 0.9) {
            // заходим с разных сторон
            const ang = Math.atan2(b.z - e.z, b.x - e.x) + b.flank * (gap > 500 ? 0.5 : 0);
            const tx = e.x + Math.cos(ang) * (reach * 0.72 + e.rad), tz = e.z + Math.sin(ang) * (reach * 0.72 + e.rad);
            this.moveTo(b, tx, tz, e.state === 'chase' ? Pl.sprint * 0.98 : Pl.run, dt, { stop: 30, direct: gap < 500 });
        } else {
            this.settle(b, dt);
            this.face(b, e.x, e.z, dt, 14);
            if (b.atkCd <= 0 && b.acting <= 0 && Math.abs(U.angleDiff(b.yaw, Math.atan2(dx, dz))) < 0.5) {
                this.swing(b, def, def.anim || 'swing', () => {
                    if (!e.alive) return;
                    if (Math.hypot(e.x - b.x, e.z - b.z) - e.rad > reach * 1.3) return;
                    const cb = b._fxCb || { fin: false }, k = (0.9 + Math.random() * 0.3) * (cb.fin ? 1.25 : 1), hl = Math.hypot(e.x - b.x, e.z - b.z) || 1;
                    Enemies.damage(e, def.dmg * k * (1 + Sky.day * 0.015), b.x, b.z, { knock: (def.stun ? 620 : 380) * (cb.fin ? 1.4 : 1), stun: def.stun, fx: window.AttackFX ? AttackFX.fxOpt(b.weaponId, cb, { x: (e.x - b.x) / hl, z: (e.z - b.z) / hl }) : null });
                    if (!e.alive) this.onKill(b);
                });
            }
        }
    },
    tickFight(b, dt) {
        const e = b.tgt;
        if (!e || !e.alive) { this.settle(b, dt); return; }
        this.engage(b, e, dt, false);
    },
    onKill(b) {
        if (Math.random() < 0.45) this.say(b, 'kill');
        if (Math.random() < 0.3) { b.emote = Math.random() < 0.5 ? 'flex' : 'cheer'; b.emoteT = 1.6; }
    },
    swing(b, def, anim, fn) {
        const rig = b.rig;
        const cb = window.AttackFX ? AttackFX.combo(b, def, anim) : { anim, n: 0, fin: false, flip: false };
        anim = cb.anim; b._fxCb = cb;
        const rate = (def.rate || 0.85) * (cb.fin ? 1.1 : 1);
        const dur0 = rig.duration(anim) || 0.8, speed = dur0 / rate, dur = dur0 / speed;
        rig.play(anim, { layer: 2, mask: b.speed > 60 ? b.upper : null, fade: 0.05, loop: false, speed, restart: true });
        rig.layers[2].target = 1;
        b.acting = dur; b.atkCd = rate * 0.98; b.emote = null;
        const hitAt = anim === 'stab' ? 0.42 : anim === 'chop' ? 0.52 : 0.5;
        b.pend = { left: dur * hitAt, fn };
        Sfx.at('swing', b.x, b.y, b.z, cb.fin ? 0.7 : 0.5, cb.fin ? 0.85 : 1);
        if (window.AttackFX) AttackFX.swingStart(b, def, cb, dur, hitAt);
    },
    shoot(b, e, def) {
        // лук: бот натягивает тетиву, стрела летит снарядом и застревает там, куда попала
        if (b.weaponId === 'bow' && window.Archery) {
            if (Archery.botShoot(b, e, def, () => this.onKill(b))) { b.acting = Archery.DRAW + 0.1; b.atkCd = def.rate * 1.05 + Archery.DRAW; }
            return;
        }
        const rig = b.rig;
        rig.play('fire', { layer: 2, mask: b.upper, loop: false, fade: 0.02, restart: true });
        rig.layers[2].target = 1;
        b.acting = 0.25; b.atkCd = def.rate * 1.05;
        const from = { x: b.x + Math.sin(b.yaw) * 55, y: b.y + 130, z: b.z + Math.cos(b.yaw) * 55 };
        const ty = e.y + (e.hgt || 100) * 0.5;
        let dx = e.x - from.x + (Math.random() - 0.5) * 30, dy = ty - from.y, dz = e.z - from.z + (Math.random() - 0.5) * 30;
        const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
        Sfx.at('swing', b.x, b.y, b.z, 0.6);
        const was = e.alive;
        if (window.AttackFX) AttackFX.shot(b, from, { x: dx, y: dy, z: dz }, 'bow', 1);
        Combat.hitscan(from, { x: dx, y: dy, z: dz }, def.range * M, def.dmg * (1 + Sky.day * 0.015), 'player', { id: 'bow' });
        if (was && !e.alive) this.onKill(b);
    },

    // ---- отступление
    tickFlee(b, dt) {
        const e = b.tgt, Pl = DATA.player;
        let tx = Player.x, tz = Player.z;
        if (Camp.isSafe(Camp.x, Camp.z, 0) && Math.hypot(b.x - Camp.x, b.z - Camp.z) < 48 * M) { tx = Camp.x; tz = Camp.z; }
        if (e && e.alive) {
            // бежим к цели, но в стороне от врага
            const ex = b.x - e.x, ez = b.z - e.z, el = Math.hypot(ex, ez) || 1;
            const ax = tx - b.x, az = tz - b.z, al = Math.hypot(ax, az) || 1;
            if (al < 300) { this.settle(b, dt); this.face(b, e.x, e.z, dt, 10); return; }
            const mx = ax / al + ex / el * 0.55, mz = az / al + ez / el * 0.55;
            this.moveTo(b, b.x + mx * 600, b.z + mz * 600, Pl.sprint * 1.02, dt, {});
        } else this.moveTo(b, tx, tz, Pl.sprint, dt, { stop: 260 });
    },

    // ---- лечение себя
    tickHeal(b, dt) {
        this.settle(b, dt);
        if (b.chan === 0) {
            b.chan = 1; b.rig.play('drink', { layer: 2, mask: null, fade: 0.06, loop: false, restart: true }); b.rig.layers[2].target = 1; b.acting = 1.2;
            b.pend = { left: 0.85, fn: () => { b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.45); b.meds--; b.medCd = 14; FX.heal(b.x, b.y, b.z); UI.floatText({ x: b.x, y: b.y + 220, z: b.z }, '+' + Math.round(b.maxHp * 0.45), '#6dff8a'); Sfx.at('heal', b.x, b.y, b.z, 0.5); this.say(b, 'healed'); } };
        }
    },

    // ---- помощь игроку: бинт
    tickSupport(b, dt) {
        const P = Player;
        const d = this.moveTo(b, P.x, P.z, DATA.player.sprint, dt, { stop: 190 });
        if (d < 300 && b.chan === 0 && b.acting <= 0) {
            b.chan = 1; this.face(b, P.x, P.z, 1, 99);
            b.rig.play('place', { layer: 2, mask: null, fade: 0.05, loop: false, restart: true, speed: 1.2 }); b.rig.layers[2].target = 1; b.acting = 0.7;
            this.say(b, 'heal', true);
            b.pend = { left: 0.5, fn: () => { if (!P.dead && Math.hypot(b.x - P.x, b.z - P.z) < 520) { P.heal(32); b.meds--; b.healCd = 45; Sfx.at('heal', P.x, P.y, P.z, 1); } } };
        }
    },

    // ---- поднять упавшего напарника
    tickRevive(b, dt) {
        const o = b.ally;
        if (!o || !o.dead) { b.ally = null; b.mode = 'follow'; return; }
        const d = this.moveTo(b, o.x, o.z, DATA.player.sprint, dt, { stop: 130 });
        if (d < 230) {
            b.chan += dt;
            if (!b.emote || b.emote !== 'pickup') { b.rig.play('pickup', { layer: 2, mask: null, fade: 0.06, loop: true, restart: true }); b.rig.layers[2].target = 1; b.emote = 'pickup'; b.emoteT = 99; this.say(b, 'revive', true); }
            this.face(b, o.x, o.z, dt, 10);
            if (b.chan > 2.6) { b.emote = null; b.emoteT = 0; b.rig.stop(2, 0.1); o.helper = null; this.revive(o, 0.5, false); this.say(o, 'thanks', true); b.ally = null; }
        }
    },

    // ---- работа по роли
    tickWork(b, dt) {
        const Pl = DATA.player;
        const task = b.task;
        if (!task) {
            this.tickFollow(b, dt, true);
            b.nextTaskT -= dt;
            if (b.nextTaskT <= 0) { b.nextTaskT = 1.3; b.task = this.pickTask(b); if (b.task && b.task.kind === 'tree') { b.task.obj._lock = b; b.task.obj._lockT = this.t + 15; } }
            return;
        }
        task.t += dt;
        const o = task.obj, P = Player;
        /** @type {boolean | string} */
        let bad = task.t > 18;
        if (task.kind === 'tree' && !o.alive) bad = 'done';
        else if (task.kind === 'plant' && !o.ready) bad = 'done';
        else if (task.kind === 'loot' && Items.list.indexOf(o) < 0) bad = 'done';
        else if (task.kind === 'pile' && o.stock <= 0) bad = 'done';
        else if (task.kind === 'note' && !(window.Lore && Lore.spots.includes(o))) bad = 'done';
        else if (task.kind === 'hunt' && !o.alive) bad = 'done';
        else if (Math.hypot(o.x - P.x, o.z - P.z) > 36 * M) bad = true;
        if (bad) { this.endTask(b, bad === true); return; }
        switch (task.kind) {
            case 'tree': {
                o._lock = b; o._lockT = this.t + 6;
                this.ensureWeapon(b, this.ROLES[b.role].tool);
                const gap = Math.hypot(o.x - b.x, o.z - b.z) - o.rad;
                if (gap > 135) { this.moveTo(b, o.x, o.z, Pl.run * 0.95, dt, { stop: o.rad + 110 }); break; }
                this.settle(b, dt); this.face(b, o.x, o.z, dt, 12);
                if (b.atkCd <= 0 && b.acting <= 0 && b.weaponId === this.ROLES[b.role].tool) {
                    const def = DATA.items[b.weaponId];
                    this.swing(b, def, 'chop', () => { if (o.alive) this.chopTree(b, o, def); });
                    if (Math.random() < 0.12) this.say(b, 'chop');
                }
                break;
            }
            case 'plant': {
                const d = this.moveTo(b, o.x, o.z, Pl.run * 0.95, dt, { stop: 70 });
                if (d < 120 && b.acting <= 0 && task.phase !== 1) {
                    task.phase = 1; this.face(b, o.x, o.z, 1, 99);
                    b.rig.play('pickup', { layer: 2, mask: null, fade: 0.06, loop: false, restart: true, speed: 1.3 }); b.rig.layers[2].target = 1; b.acting = 0.9;
                    b.pend = { left: 0.55, fn: () => { if (o.ready) { if (o.kind) Zones.pickResource(o, b); else Zones.pickCrop(o, b); if (Math.random() < 0.25) this.say(b, 'gather'); } this.endTask(b, false); } };
                }
                if (task.phase === 1) this.settle(b, dt);
                break;
            }
            case 'pile': {
                const d = this.moveTo(b, o.x, o.z, Pl.run * 0.95, dt, { stop: 100 });
                if (d < 160 && b.acting <= 0 && task.phase !== 1) {
                    task.phase = 1; this.face(b, o.x, o.z, 1, 99);
                    b.rig.play('pickup', { layer: 2, mask: null, fade: 0.06, loop: false, restart: true, speed: 1.2 }); b.rig.layers[2].target = 1; b.acting = 1;
                    b.pend = { left: 0.6, fn: () => { if (o.stock > 0) { o.stock--; o.day = Sky.day; this.carry(b, 'log', 1); } this.endTask(b, false); } };
                }
                if (task.phase === 1) this.settle(b, dt);
                break;
            }
            case 'loot': {
                const d = this.moveTo(b, o.x, o.z, Pl.run * 0.95, dt, { stop: 20, direct: true });
                if (d < 90 && o.ground) {
                    this.carry(b, o.id, o.n, o.lv, o.mag); FX.pickup(o.x, o.y, o.z); Sfx.at('pickup', b.x, b.y, b.z, 0.4);
                    Items.remove(o); this.endTask(b, false);
                }
                break;
            }
            case 'note': {
                const d = this.moveTo(b, o.x, o.z, Pl.run * 0.95, dt, { stop: 50, direct: true });
                if (d < 130 && b.acting <= 0 && task.phase !== 1) {
                    task.phase = 1; this.face(b, o.x, o.z, 1, 99);
                    b.rig.play('pickup', { layer: 2, mask: null, fade: 0.06, loop: false, restart: true, speed: 1.3 }); b.rig.layers[2].target = 1; b.acting = 0.9;
                    b.pend = { left: 0.5, fn: () => { if (b.task !== task || b.dead) return; if (window.Lore && Lore.spots.includes(o)) { Lore.read(o.id, b.name); this.say(b, 'note', true); } this.endTask(b, false); } };
                }
                if (task.phase === 1) this.settle(b, dt);
                break;
            }
            case 'hunt': this.engage(b, o, dt, true); break;
        }
    },
    endTask(b, bad) {
        const t = b.task;
        if (!t) return;
        if (t.kind === 'tree' && t.obj._lock === b) t.obj._lock = null;
        if (bad && t.obj) t.obj._bad = this.t + 40;
        if (t.kind === 'loot' && bad) t.obj._lk = this.t + 40;
        b.task = null; b.nextTaskT = 0.25; b.pend = null; b.chan = 0;
    },
    carry(b, id, n, lv, mag) {
        b.carry[id] = (b.carry[id] || 0) + n; b.carryN += n;
        if (lv > 0) { const levels = (b.carryLevels || (b.carryLevels = {})); const item = levels[id] || (levels[id] = {}); item[lv] = (item[lv] || 0) + n; }
        const def = DATA.items[id];
        if (def?.mag && Number.isFinite(mag)) {
            const rows = b.cargoMeta || (b.cargoMeta = []); lv = lv | 0; mag = Math.max(0,Math.min(def.mag,Math.floor(mag)));
            const row = rows.find(o => o.id === id && o.lv === lv && o.mag === mag);
            if (row) row.n += n; else rows.push({id,n,lv,mag});
        }
    },
    cargoRows(b) {
        const rows = [];
        for (const [id, n] of Object.entries(b.carry || {})) {
            let base = n;
            const groups = [];
            for (const [lv, count] of Object.entries(b.carryLevels?.[id] || {})) if (count > 0) { const take = Math.min(base, count); if (take > 0) groups.push({n:take,lv:Number(lv)}); base -= take; }
            if (base > 0) groups.push({n:base,lv:0});
            for (const group of groups) {
                let left = group.n;
                for (const meta of b.cargoMeta || []) if (meta.id === id && meta.lv === group.lv && meta.n > 0 && Number.isFinite(meta.mag)) {
                    const take = Math.min(left, meta.n); if (take > 0) rows.push({id,n:take,lv:group.lv,mag:meta.mag}); left -= take;
                }
                if (left > 0) rows.push({id,n:left,lv:group.lv});
            }
        }
        return rows;
    },
    takeCargo(b, id, n, lv, mag) {
        b.carry[id] -= n; b.carryN -= n;
        if (lv > 0 && b.carryLevels?.[id]) b.carryLevels[id][lv] -= n;
        if (Number.isFinite(mag)) {
            let left = n;
            for (const row of b.cargoMeta || []) if (row.id === id && row.lv === (lv | 0) && row.mag === mag) { const take = Math.min(left,row.n); row.n -= take; left -= take; }
            b.cargoMeta = (b.cargoMeta || []).filter(o => o.n > 0);
        }
    },

    pickTask(b) {
        const P = Player, cfg = this.ROLES[b.role];
        const R = 30 * M;
        let best = null, bc = 1e18;
        const add = (kind, o, w) => {
            if (o._bad > this.t) return;
            const c = Math.hypot(o.x - b.x, o.z - b.z) * w;
            if (c < bc) { bc = c; best = { kind, obj: o, t: 0, phase: 0 }; }
        };
        const jobs = cfg.jobs;
        if (jobs.includes('tree')) {
            World.colliders.query(P.x, P.z, R, (c) => {
                const t = c.owner && c.owner.tree;
                if (!t || !t.alive || t._bad > this.t || (t._lock && t._lock !== b && t._lockT > this.t)) return;
                if (Math.hypot(t.x - World.cx, t.z - World.cz) > World.fogRadius - 600) return;
                if (Camp.isSafe(t.x, t.z, -100) === false && Math.hypot(t.x - Camp.x, t.z - Camp.z) < 500) return;
                add('tree', t, 1);
            });
        }
        if (jobs.includes('note') && window.Lore) for (const n of Lore.spots) {
            if (Math.hypot(n.x - P.x, n.z - P.z) < R && Math.hypot(n.x - Camp.x, n.z - Camp.z) < World.fogRadius - DATA.player.radius) add('note', n, 0.5);
        }
        if (jobs.includes('pile') && Camp.fuelFrac() < 0.5) for (const p of Zones.piles) { if (p.stock > 0 && Math.hypot(p.x - P.x, p.z - P.z) < R) add('pile', p, 1.3); }
        if (jobs.includes('plant')) {
            for (const r of World.resources) if (r.ready && Math.hypot(r.x - P.x, r.z - P.z) < R) add('plant', r, 0.8);
            for (const c of Zones.crops) if (c.ready && Math.hypot(c.x - P.x, c.z - P.z) < R) add('plant', c, 0.8);
        }
        if (jobs.includes('hunt') && (P.hunger < 75 || Inv.count('steak_raw') < 2)) {
            for (const e of this.threats) if (e.type === 'bunny' && e.alive && Math.hypot(e.x - P.x, e.z - P.z) < R) add('hunt', e, 0.7);
        }
        if (jobs.includes('log') || jobs.includes('loot')) {
            for (const it of Items.list) {
                if (!it.ground || it.noPickup > 0 || it.id === 'coin' || it._fromBot || it._lk > this.t) continue;
                if (!jobs.includes('loot') && it.id !== 'log') continue;
                const dP = Math.hypot(it.x - P.x, it.z - P.z);
                if (dP < 450 || dP > R) continue;
                add('loot', it, it.id === 'log' ? 0.35 : 0.55);
            }
        }
        return best;
    },
    chopTree(b, t, def) {
        const f = { x: Math.sin(b.yaw), z: Math.cos(b.yaw) };
        t.hp -= def.tree || 1;
        const hx = t.x - f.x * t.rad * 0.6, hz = t.z - f.z * t.rad * 0.6, hy = World.heightAt(t.x, t.z) + 130;
        World.shakeTree(t, f.x, f.z);
        FX.chips(hx, hy, hz, f); FX.leaves(t.x, hy + 250 * t.s, t.z, 5);
        if (window.AttackFX) AttackFX.chop({ x: hx, y: hy, z: hz }, f, def, b.weaponId);
        Sfx.at('chop', t.x, hy, t.z, 0.9);
        if (t.hp > 0) return;
        World.removeTree(t);
        const drops = Math.max(2, Math.round(2 + t.s * 1.6 + (/pine_b/.test(t.v) ? 1 : 0)));
        Sfx.at('treefall', t.x, t.y || 100, t.z, 1);
        World.fellVisual(t, f.x, f.z, () => {});
        const sx = t.x + f.x * 300 * t.s, sz = t.z + f.z * 300 * t.s;
        for (let i = 0; i < drops; i++) {
            const a = Math.random() * 6.28, s = 120 + Math.random() * 180;
            Events.queueLoot('log', 1, sx + Math.cos(a) * 60, sz + Math.sin(a) * 60, World.heightAt(sx, sz) + 160, .9,
                { vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 460 + Math.random() * 220 });
        }
    },

    // ---- доставка: сначала нужное топливо, затем сундук; личные передачи включаются отдельно.
    fuelCargo(b) { return Camp.fuelFrac() < BOT_FIRE_TARGET ? Object.keys(DATA.fuel).find(id => b.carry[id] > 0) : null; },
    needsStoredFuel(b) {
        if (b.dead || Camp.fuelFrac() >= BOT_FIRE_TARGET || !Camp.chestPos || typeof Camp.takeStoredFuel !== 'function') return false;
        if (!(Camp.storage || []).some(o => o.n > 0 && DATA.fuel[o.id] > 0)) return false;
        // Уже несомое топливо — единственная необходимая «бронь». Оно сохраняется вместе с ботом.
        if (this.list.some(o => !o.dead && this.fuelCargo(o))) return false;
        const p = Camp.chestPos;
        let closest = null, best = Infinity;
        for (const o of this.list) if (!o.dead) {
            const d = Math.hypot(o.x - p.x, o.z - p.z);
            if (d < best) { best = d; closest = o; }
        }
        return closest === b;
    },
    deliveryTarget(b) { return this.fuelCargo(b) ? Camp : this.needsStoredFuel(b) ? Camp.chestPos : this.deliverToPlayer && this.deliveryBudget() > 0 ? Player : (Camp.chestPos || Camp); },
    tickDeliver(b, dt) {
        const P = Player, Pl = DATA.player;
        const fuel = this.fuelCargo(b);
        if (fuel) {
            const d = this.moveTo(b, Camp.x, Camp.z, Pl.run, dt, { stop: 240 });
            if (d < 340 && b.acting <= 0 && b.atkCd <= 0) {
                b.atkCd = 0.6; b.acting = 0.5;
                b.rig.play('place', { layer: 2, mask: b.speed > 60 ? b.upper : null, fade: 0.05, loop: false, restart: true, speed: 1.2 }); b.rig.layers[2].target = 1;
                b.pend = { left: 0.3, fn: () => {
                    if (b.dead || !(b.carry[fuel] > 0) || Camp.fuelFrac() >= BOT_FIRE_TARGET) return;
                    this.takeCargo(b, fuel, 1, 0);
                    const add = DATA.fuel[fuel];
                    Camp.fuel = Math.min(Camp.cap, Camp.fuel + add); Camp.lit = true; Camp.pulse = 1;
                    FX.sparkBurst(Camp.x, Camp.y + 70, Camp.z, 14, '#ffb050'); Sfx.at('ignite', Camp.x, Camp.y, Camp.z, 0.5);
                    UI.floatText({ x: Camp.x, y: Camp.y + 200, z: Camp.z }, '+' + add + ' 🔥', '#ffb84a');
                    if (Math.random() < 0.3) this.say(b, 'fire');
                    if (window.Game) Game.autosave('bot-fire');
                } };
            }
            return;
        }
        if (this.needsStoredFuel(b)) {
            const p = Camp.chestPos, d = this.moveTo(b, p.x, p.z, Pl.run, dt, {stop:120});
            if (d < 160 && b.acting <= 0 && b.atkCd <= 0 && this.needsStoredFuel(b)) {
                // Изъятие и добавление в груз идут в одном синхронном вызове, до autosave.
                const item = Camp.takeStoredFuel();
                if (item) {
                    this.carry(b, item.id, item.n, item.lv, item.mag); b.acting = 0.6;
                    b.rig.play('pickup', {layer:2,mask:null,fade:.05,loop:false,restart:true,speed:1.2}); b.rig.layers[2].target = 1;
                    Sfx.at('pickup',p.x,p.y||Camp.y,p.z,.5);
                    if (window.Game) Game.autosave('bot-fuel-withdraw');
                }
            }
            return;
        }
        const target = this.deliveryTarget(b), d = this.moveTo(b, target.x, target.z, Pl.run, dt, { stop: target === P ? 210 : 120 });
        if (d < (target === P ? 330 : 160) && b.acting <= 0 && b.carryN > 0) { if (target === P) this.handOver(b); else this.depositCargo(b); }
        else if (b.carryN <= 0) b.mode = 'follow';
    },
    depositCargo(b) {
        if (typeof Camp.storeItems !== 'function' || b._depositAt > this.t) return;
        let deposited = 0;
        for (const o of this.cargoRows(b)) {
            const left = Camp.storeItems(o.id, o.n, o.lv, o.mag);
            if (!Number.isFinite(left) || left < 0 || left > o.n) continue;
            const n = o.n - left; if (n > 0) { this.takeCargo(b, o.id, n, o.lv, o.mag); deposited += n; }
        }
        b._depositAt = this.t + (b.carryN > 0 ? 5 : 0.8);
        if (deposited) {
            b.acting = 0.8; b.rig.play('place', {layer:2,mask:null,fade:.05,loop:false,restart:true,speed:1.2}); b.rig.layers[2].target = 1;
            const p = Camp.chestPos || Camp; Sfx.at('drop',p.x,p.y||Camp.y,p.z,.6);
            if (window.Game) Game.autosave('bot-storage');
        }
    },
    handOver(b) {
        if (!this.deliverToPlayer || b.dead || b.carryN <= 0 || this.fuelCargo(b)) return;
        let budget = this.deliveryBudget(); if (!budget) return;
        const P = Player;
        b.acting = 0.8; this.face(b, P.x, P.z, 1, 99);
        b.rig.play('place', { layer: 2, mask: null, fade: 0.05, loop: false, restart: true, speed: 1.2 }); b.rig.layers[2].target = 1;
        this.say(b, 'give');
        const dx = P.x - b.x, dz = P.z - b.z, l = Math.hypot(dx, dz) || 1;
        for (const o of this.cargoRows(b)) {
            const n = Math.min(o.n, budget); if (!n) break;
            Events.queueLoot(o.id, n, b.x + dx / l * 60, b.z + dz / l * 60, b.y + 120, .35,
                { vx: dx / l * 240, vz: dz / l * 240, vy: 380, fromBot: true, lv:o.lv, mag:o.mag });
            this.takeCargo(b, o.id, n, o.lv, o.mag); budget -= n;
            for (let i=0;i<n;i++) this.deliveryTimes.push(this.t);
        }
        if (window.Game) Game.autosave('bot-delivery');
    },

    // ------------------------------------------------------------------------------ урон, падение, подъём
    hurt(b, amount, sx, sz, kind) {
        if (b.dead || b.invuln > 0) return false;
        amount = Math.max(1, Math.round(amount * 0.8));
        b.hp -= amount; b.invuln = kind === 'dot' ? 0.2 : 0.5; b.hurtT = 0.4; b.lastHurt = this.t;
        const dx = b.x - sx, dz = b.z - sz, d = Math.hypot(dx, dz) || 1;
        if (kind !== 'dot') { b.kx += dx / d * 330; b.kz += dz / d * 330; }
        if (b.acting <= 0 || b.acting < 0.3) {
            const behind = Math.abs(U.angleDiff(b.yaw, Math.atan2(sx - b.x, sz - b.z))) > 2.1;
            b.rig.play(behind ? 'hit_back' : 'hit', { layer: 2, fade: 0.04, loop: false, restart: true, mask: null }); b.rig.layers[2].target = 1;
        }
        UI.floatText({ x: b.x, y: b.y + 210, z: b.z }, '-' + amount, '#ff8a7a');
        Sfx.at('hurt', b.x, b.y, b.z, 0.7);
        FX.hitSpark(b.x, b.y + 110, b.z, '#ff5a4d');
        if (Math.random() < 0.18) this.say(b, 'hurt');
        if (b.hp <= 0) this.down(b, kind);
        return true;
    },
    down(b, kind) {
        b.dead = true; b.hp = 0; b.downT = 0; b.helper = null; b.emote = null; b.pend = null; b.acting = 0;
        b.mode = 'down'; b.modeT = 0; b.tgt = null;
        if (b.task) this.endTask(b, false);
        // Груз остаётся у поверженного напарника и попадёт в сундук после подъёма.
        b.rig.stop(1, 0.1);
        b.rig.play('death', { layer: 2, fade: 0.1, loop: false, hold: true, weight: 1, restart: true, mask: null });
        b.rig.layers[2].target = 1; b.rig.layers[2].weight = 1;
        Sfx.at('death', b.x, b.y, b.z, 0.7);
        this.say(b, 'down', true);
        if (window.UI && Math.hypot(b.x - Player.x, b.z - Player.z) < 40 * M) UI.toast(Lang.t('bot.down', { n: b.name }), 'warn');
    },
    tickDown(b, dt) { this.settle(b, dt); },
    revive(b, frac, byPlayer) {
        if (!b.dead) return;
        b.dead = false; b.hp = Math.max(1, b.maxHp * frac); b.invuln = 2.5; b.downT = 0; b.helper = null;
        b.rig.stop(2, 0.15);
        for (const i of [2]) { const L = b.rig.layers[i]; L.weight = 0; L.target = 0; L.cur = null; }
        b.mode = 'follow'; b.modeT = 0;
        FX.heal(b.x, b.y, b.z); FX.ring(b.x, b.y + 20, b.z, 420, '#7dff9a');
        Sfx.at('heal', b.x, b.y, b.z, 1);
        if (byPlayer) { this.say(b, 'thanks', true); if (window.Quests) Quests.event('botRevive', 1); }
    },
    respawn(b) {
        b.rig.stop(2, 0.1);
        this.revive(b, 0.6, false);
        this.warp(b, Camp.x, Camp.z, false, b.idx);
        FX.sparkBurst(b.x, b.y + 100, b.z, 20, '#9aff9a');
    },

    boltHit(bolt) {
        for (const b of this.list) {
            if (b.dead) continue;
            if (Math.abs(bolt.y - (b.y + 90)) < 100 && U.dist2(bolt.x, bolt.z, b.x, b.z) < 55 * 55) { this.hurt(b, bolt.dmg, bolt.x - bolt.dx * 100, bolt.z - bolt.dz * 100, 'bolt'); return true; }
        }
        return false;
    },

    // ------------------------------------------------------------------------------ события игры
    onPlayerDeath() {
        this.playerDown = true;
        for (const b of this.list) { b.mx = Player.x; b.mz = Player.z; if (b.task) this.endTask(b, false); }
        const b = this.list.find(o => !o.dead);
        if (b) this.say(b, 'rip', true);
    },
    onPlayerRevive(x, z) {
        this.playerDown = false;
        let n = 0;
        for (const b of this.list) {
            if (b.dead) this.revive(b, 0.6, false);
            if (Math.hypot(b.x - x, b.z - z) > 14 * M) this.warp(b, x, z, false, b.idx);
            b.mode = 'follow'; b.emote = 'cheer'; b.emoteT = 1.8;
            if (n++ === 0) this.say(b, 'back', true);
        }
    },
    onNewDay() {
        this._day = Sky.day;
        for (const b of this.list) { this.applyScale(b, false); b.meds = Math.min(3, b.meds + 1); b.nades = Math.min(3, (b.nades || 0) + 1); }
        const b = this.list.find(o => !o.dead);
        if (b && !Player.dead) { this.say(b, 'dawn', true); for (const o of this.list) if (!o.dead && !o.emote) { o.emote = 'cheer'; o.emoteT = 1.8; } }
    },

    // ------------------------------------------------------------------------------ анимация
    animate(b, dt) {
        const rig = b.rig, Pl = DATA.player;
        const gy = World.heightAt(b.x, b.z);
        b.y = b.y ? U.damp(b.y, gy, 26, dt) : gy;
        rig.root.position.set(b.x, b.y, b.z);
        rig.root.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(0, b.yaw, 0);
        if (b.dead) { rig.update(dt); return; }
        if (window.AttackFX) AttackFX.pose(rig, b, dt);
        let name = 'idle', sp = 1;
        if (b.speed > 40) {
            if (b.speed > Pl.run * 1.08) { name = 'sprint'; sp = U.clamp(b.speed / (Pl.sprint * 0.95), 0.7, 1.35); }
            else if (b.speed > Pl.walk * 1.25) { name = 'run'; sp = U.clamp(b.speed / (Pl.run * 0.95), 0.6, 1.3); }
            else { name = 'walk'; sp = U.clamp(b.speed / (Pl.walk * 0.92), 0.6, 1.3); }
            if (b.emote && b.emote !== 'pickup') { b.emote = null; b.emoteT = 0; }
        } else if (b.emote && b.emote !== 'pickup' && b.acting <= 0 && b.hurtT <= 0) name = b.emote;
        if (rig.current(0) !== name) rig.play(name, { fade: name === 'idle' ? 0.22 : 0.16, loop: !(name === 'wave' || name === 'cheer') });
        if (rig.layers[0].cur && (name === 'walk' || name === 'run' || name === 'sprint')) rig.layers[0].cur.speed = sp;
        // шаги — только рядом с игроком
        if (b.speed > 60 && Math.hypot(b.x - Player.x, b.z - Player.z) < 2400) {
            const ph = rig.phase(0), cross = (a) => (b.lastStepPhase < a && ph >= a) || (b.lastStepPhase > ph && (ph >= a || b.lastStepPhase < a));
            if (cross(0.0) || cross(0.5) || b.lastStepPhase > ph) Sfx.step(b.x, b.y, b.z, 0.45);
            b.lastStepPhase = ph;
        }
        rig.update(dt);
    },

    // ------------------------------------------------------------------------------ интерфейс
    updateHud(dt) {
        const vis = !(window.UI && UI.modal);
        this.layer.style.display = vis ? 'block' : 'none';
        this.party.style.visibility = vis ? '' : 'hidden';
        this._hudT = (this._hudT || 0) - dt;
        const slow = this._hudT <= 0; if (slow) this._hudT = 0.2;
        for (const b of this.list) {
            const f = Math.max(0, b.hp / b.maxHp);
            if (slow) {
                b.tBar.style.width = Math.round(f * 100) + '%'; b.tBar.style.background = f > 0.5 ? '#6dff8a' : f > 0.25 ? '#ffd24a' : '#ff5a4d';
                b.rBar.style.width = Math.round(f * 100) + '%'; b.rBar.style.background = b.tBar.style.background;
                const st = b.dead ? '💤' : b.mode === 'fight' ? '⚔️' : b.mode === 'flee' ? '💨' : b.mode === 'work' ? (b.task ? { tree: '🪓', plant: '🧺', pile: '🪵', loot: '🎒', hunt: '🏹' }[b.task.kind] || '' : '') : b.mode === 'guard' ? '🛡️' : b.mode === 'heal' || b.mode === 'support' ? '🩹' : b.mode === 'revive' ? '⛑️' : b.mode === 'deliver' ? '📦' : '';
                b.rSt.textContent = st; b.tIc.textContent = b.dead ? '💤' : this.ROLES[b.role].icon;
                b.row.classList.toggle('dead', b.dead);
            }
            // метка над головой
            const d = Math.hypot(b.x - Player.x, b.z - Player.z);
            let show = vis && d < 40 * M;
            if (show) {
                const s = Cam.project(b.x, b.y + (b.dead ? 120 : 240), b.z);
                // метка не лезет на верхнюю полосу HUD (кнопки, день, цель) — там её прячем
                const top = window.HudLayout ? HudLayout.bounds.top - 10 : 0;
                if (!s.visible || s.behind || s.y < top) show = false; else b.tag.style.transform = 'translate(' + Math.round(s.x) + 'px,' + Math.round(s.y) + 'px) translate(-50%,-100%)';
            }
            b.tag.style.display = show ? 'block' : 'none';
        }
    },

    // Игрок поднимает упавшего бота по E
    register() {
        Interact.providers.push((consider) => {
            for (const b of Bots.list) {
                if (!b.dead) continue;
                if (!b._e) b._e = { x: 0, z: 0, r: 2.6 * M, h: 120, prio: 1, text: () => Lang.t('bot.revive', { n: b.name }), sub: () => Lang.t('bot.reviveSub'), act: () => Bots.revive(b, 0.6, true) };
                b._e.x = b.x; b._e.z = b.z;
                consider(b._e);
            }
        });
    },
};
if (typeof Interact !== 'undefined') Bots.register();

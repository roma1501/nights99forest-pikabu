// Player.js — герой: управление от третьего лица, анимации слоями, жизнь/голод/выносливость,
// инвентарь в руке, удары (рубка, ближний бой, стрельба), еда и лечение, фонарь.
// Оси: x, z — плоскость, y — высота (px). yaw=0 — лицом к +Z. Игрок — тело-цилиндр радиуса P.radius.

/** @type {Record<string, any>} */
const Player = {
    rig: null, node: null, scene: null, view: null,
    x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, faceYaw: 0,
    onGround: true, coyote: 0, jumpBuf: 0, airTime: 0,
    hp: 100, maxHp: 100, hunger: 100, stamina: 100, dead: false,
    speed: 0, moving: false, sprinting: false,
    invuln: 0, hurtT: 0,
    control: true,           // выключается сценами, сном, смертью
    sleeping: false, acting: 0, attackCd: 0, actionQueued: null,
    held: null, heldId: null, heldRoot: null,
    flashOn: false, flash: null, flashBeam: 0,
    lastStepPhase: 0,
    stats: { kills: 0, logs: 0, days: 0 },
    tmpV: { x: 0, z: 0, hit: null },
    fx: { dustT: 0 },

    async init(app, view) {
        this.view = view; this.scene = view.scene;
        const data = await Rig.load('assets/models/player.glb');
        this.data = data;
        this.node = new BABYLON.TransformNode('playerRoot', this.scene);
        this.outfit = Store.getJSON(GAME_ID + '.outfit', { hair: 'Hair_bacon', hairColor: '#e2792b', shirt: '#3d78d8', jacket: '#3f6248', pants: '#4d4f5c', skin: '#f2c9a0' });
        // сохранённые нетронутые старые цвета (почти чёрный костюм) заменяем новыми по умолчанию
        if (this.outfit.jacket === '#2a2d34' && this.outfit.pants === '#363a44') { this.outfit.jacket = '#3f6248'; this.outfit.pants = '#4d4f5c'; }
        this.buildRig();
        this.flash = new BABYLON.SpotLight('flash', new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, 0, 1), 0.62, 4, this.scene);
        this.flash.intensity = 0; this.flash.range = 4200; this.flash.diffuse = new BABYLON.Color3(1, 0.96, 0.82); this.flash.specular = new BABYLON.Color3(0.4, 0.4, 0.35);
        this.flash.renderPriority = 8;
        Inv.onSelect = () => this.equipCurrent();
        // предмет в активном слоте появился/исчез (подобрали, съели, выбросили) — рука обновляется сразу
        Inv.onChange.push(() => { if (!this.rig) return; const s = Inv.current(); const id = s ? s.id : null; if (id !== this.heldId || (id && !this.heldRoot)) this.equipCurrent(); });
    },

    // Внешний вид героя: look = цвета + причёска + аксессуары (Acc_* на костях). Скин из магазина подменяет look,
    // у «Классики» look — это наряд из конструктора (this.outfit).
    lookOf(id) {
        const o = this.outfit, S = id && id !== 'default' ? SKINS.byId[id] : null;
        if (!S || !S.colors) return { hair: o.hair, hairColor: o.hairColor, shirt: o.shirt, jacket: o.jacket, pants: o.pants, skin: o.skin, acc: [], accA: '#ffffff', accB: '#cccccc', accC: '#888888', id: 'default' };
        const c = S.colors;
        return { hair: S.hairStyle === undefined ? o.hair : S.hairStyle, hairColor: c.hair, shirt: c.shirt, jacket: c.jacket, pants: c.pants, skin: c.skin || o.skin, acc: S.acc || [], accA: c.accA, accB: c.accB, accC: c.accC, id };
    },
    applySkin(id) { this.look = this.lookOf(id); if (this.rig) this.buildRig(); },
    previewSkin(id) { this.applySkin(id); },

    buildRig() {
        if (this.rig) { this.rig.dispose(); }
        const o = this.look || this.outfit;
        // причёска/аксессуар состоят из нескольких узлов: имя == id или начинается с id + '_'
        const names = this.data && this.data.byName ? Array.from(this.data.byName.keys()) : [];
        const keep = (n, id) => n === id || n.indexOf(id + '_') === 0;
        const accWant = (o.acc || []).map(a => 'Acc_' + a);
        const hide = names.filter(n => (/^Hair_/.test(n) && !(o.hair && keep(n, o.hair))) || (/^Acc_/.test(n) && !accWant.some(id => keep(n, id))));
        this.rig = Rig.instance(this.data, this.scene, {
            name: 'player', hide, merge: true, flat: true,
            materials: { hair: o.hairColor, shirt: o.shirt, jacket: o.jacket, pants: o.pants, skin: o.skin, accA: o.accA || '#ffffff', accB: o.accB || '#cccccc', accC: o.accC || '#888888', glow_acc: o.accC || '#ffffff' },
        });
        this.rig.root.parent = this.node;
        this.rig.setShadows(this.view, true);
        this.rig.play('idle');
        this.headNode = this.rig.node('Head');
        this.upperMask = this.rig.maskOf(['UpperTorso']);
        this.armRMask = this.rig.maskOf(['ArmR']);
        this.heldRoot = null; this.heldId = null;
        this.equipCurrent();
    },

    // Конструктор (цвета/причёска) работает на скине «Классика»: правка цвета переключает на неё
    setOutfit(o) {
        Object.assign(this.outfit, o);
        Store.set(GAME_ID + '.outfit', JSON.stringify(this.outfit));
        if (window.Econ && Econ.skin !== 'default') { Econ.skin = 'default'; Econ.save(); }
        this.look = this.lookOf('default');
        if (this.rig) this.buildRig();
    },

    spawn(x, z) {
        this.x = x; this.z = z; this.y = World.heightAt(x, z); this.vx = this.vz = this.vy = 0;
        this.knock = null; this.fxPose = null; this._combo = null;
        this.hp = this.maxHp = DATA.player.hp; this.hunger = DATA.player.hunger; this.stamina = DATA.player.stamina;
        this.dead = false; this.sleeping = false; this.control = true; this.invuln = 0;
        this.yaw = this.faceYaw = Math.PI;
        this.apply();
        this.rig.play('idle', { fade: 0 });
        this.rig.stop(1, 0); this.rig.stop(2, 0);
        this.layerReset();
        this.applyStance();
    },

    // Стойка руки под предмет в руке (слой 1) — после сброса слоёв и при экипировке
    applyStance() {
        const d = this.heldDef();
        if (!d || !this.rig) return;
        const g = Player.GRIPS[d.grip || 'hold'] || Player.GRIPS.hold;
        this.stance = g.stance || null;
        if (g.stance && this.rig.has(g.stance)) this.rig.play(g.stance, { layer: 1, mask: g.arms === 'both' ? this.upperMask : this.armRMask, fade: 0.16, weight: 1, restart: true });
    },

    layerReset() { for (const i of [1, 2]) { const L = this.rig.layers[i]; L.weight = 0; L.target = 0; L.cur = null; } },

    headPos() { return { x: this.x, y: this.y + 1.5 * M, z: this.z }; },
    pos() { return { x: this.x, y: this.y, z: this.z }; },
    facingVec() { return { x: Math.sin(this.faceYaw), z: Math.cos(this.faceYaw) }; },
    apply() {
        this.node.position.set(this.x, this.y, this.z);
        this.node.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(0, this.faceYaw, 0);
    },

    // ---------------------------------------------------------------------------------------- кадр
    update(dt) {
        const P = DATA.player, rig = this.rig;
        if (this.invuln > 0) this.invuln -= dt;
        if (this.attackCd > 0) this.attackCd -= dt;
        this.vitals(dt);
        if (this.dead) { rig.update(dt); return; }

        const ax = Input.axis();
        let mx = 0, mz = 0;
        const canMove = this.control && !this.sleeping && !(this.busy && this.busy.lock);
        if (canMove) {
            const s = Math.sin(Cam.yaw), c = Math.cos(Cam.yaw);
            mx = s * ax.y + (-c) * ax.x;
            mz = c * ax.y + s * ax.x;
        }
        const want = Math.hypot(mx, mz);
        this.moving = want > 0.05;
        // спринт
        const wantSprint = canMove && Input.down('sprint') && this.moving && this.stamina > 6 && this.onGround && !this.aiming();
        this.sprinting = wantSprint;
        let target = 0;
        if (this.moving) target = (this.sprinting ? P.sprint : (want > 0.55 ? P.run : P.walk)) * Math.min(1, want);
        if (this.busy && this.busy.slow) target *= this.busy.slow;
        if (this.buff) target *= this.buff.speed;
        if (this.slowT > 0) { this.slowT -= dt; target *= 0.5; }
        if (this.aiming()) target *= 0.55;
        if (this.heldId === 'bow' && window.Archery && Archery.slow(this)) target *= 0.6;
        const tvx = want > 0.001 ? mx / want * target : 0, tvz = want > 0.001 ? mz / want * target : 0;
        const acc = this.onGround ? (this.moving ? 14 : 16) : 3.4;
        this.vx = U.damp(this.vx, tvx, acc, dt); this.vz = U.damp(this.vz, tvz, acc, dt);
        if (this.knock) { this.vx += this.knock.x; this.vz += this.knock.z; this.knock = null; }
        // прыжок
        if (canMove && Input.pressed('jump')) this.jumpBuf = 0.14;
        if (this.jumpBuf > 0) this.jumpBuf -= dt;
        this.coyote = this.onGround ? 0.11 : Math.max(0, this.coyote - dt);
        if (this.jumpBuf > 0 && this.coyote > 0 && this.stamina > 4) {
            this.vy = P.jump; this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.stamina -= 4;
            rig.play('jump', { fade: 0.06, loop: false, hold: true, restart: true });
            if (window.Sfx) Sfx.at('jump', this.x, this.y, this.z, 0.5);
            if (window.FX) FX.dust(this.x, this.y, this.z, 6, 0.6);
        }
        // перемещение
        const spd2 = this.vx * this.vx + this.vz * this.vz;
        this.speed = Math.sqrt(spd2);
        this.moveHorizontal(this.vx * dt, this.vz * dt);
        // вертикаль
        const gy = World.heightAt(this.x, this.z);
        this.vy -= P.gravity * dt;
        this.y += this.vy * dt;
        const wasAir = !this.onGround;
        if (this.y <= gy) {
            const impact = -this.vy;
            this.y = gy;
            if (!this.onGround) {
                this.onGround = true;
                if (impact > 520) this.landed(impact);
            }
            this.vy = 0;
        } else if (this.y > gy + 4) this.onGround = false;
        this.airTime = this.onGround ? 0 : this.airTime + dt;
        // поворот корпуса
        const aimTurn = this.aiming() || this.acting > 0 || (this.busy && this.busy.face) || (this.heldId === 'bow' && window.Archery && Archery.turning(this));
        if (aimTurn && this.control) this.faceYaw = U.dampAngle(this.faceYaw, Cam.yaw, 18, dt);
        else if (this.moving && canMove) this.faceYaw = U.dampAngle(this.faceYaw, Math.atan2(mx, mz), 13, dt);
        // наклон корпуса при беге (процедурно)
        this.animate(dt);
        if (window.AttackFX) AttackFX.pose(rig, this, dt);
        this.apply();
        // атаки и действия
        this.actions(dt, canMove);
        // фонарь
        this.updateFlash(dt);
        // выносливость
        if (this.sprinting) this.stamina = Math.max(0, this.stamina - P.staminaDrain * dt);
        else this.stamina = Math.min(100, this.stamina + P.staminaRegen * (this.moving ? 0.6 : 1) * dt);
        // шаги
        this.footsteps(dt);
        rig.update(dt);
    },

    // Прицел: ПКМ с дальнобойным оружием или лук, натянутый и удерживаемый
    aiming() { const d = this.heldDef(); return !!(d && d.ranged && this.control && (Input.down('aim') || (this.heldId === 'bow' && window.Archery && Archery.aimZoom(this)))); },
    heldDef() { return this.heldId ? DATA.items[this.heldId] : null; },

    landed(impact) {
        if (window.FX) FX.dust(this.x, this.y, this.z, 10, 1);
        if (window.Sfx) Sfx.at('land', this.x, this.y, this.z, Math.min(1, impact / 1200));
        Cam.shake(Math.min(0.4, impact / 3200));
        if (impact > 900) this.rig.play('land', { layer: 2, fade: 0.05, loop: false, mask: null });
        if (impact > 1500) this.hurt((impact - 1500) / 60, this.x, this.z, 'fall');
    },

    // ---------------------------------------------------------------------------------------- анимация
    animate(dt) {
        const rig = this.rig;
        if (this.sleeping) return;
        let name, speed = 1;
        if (!this.onGround && this.airTime > 0.12) {
            name = this.vy > 0 ? 'jump' : 'fall';
            if (name === 'jump') { if (!rig.isPlaying(0, 'jump') && rig.current(0) !== 'jump') rig.play('jump', { loop: false, hold: true, fade: 0.08 }); }
            else if (rig.current(0) !== 'fall') rig.play('fall', { fade: 0.18 });
            return;
        }
        if (this.moving && this.speed > 40) {
            if (this.sprinting) { name = 'sprint'; speed = U.clamp(this.speed / (DATA.player.sprint * 0.95), 0.7, 1.35); }
            else if (this.speed > DATA.player.walk * 1.25) { name = 'run'; speed = U.clamp(this.speed / (DATA.player.run * 0.95), 0.6, 1.3); }
            else { name = 'walk'; speed = U.clamp(this.speed / (DATA.player.walk * 0.92), 0.6, 1.3); }
        } else name = 'idle';
        if (rig.current(0) !== name) rig.play(name, { fade: name === 'idle' ? 0.22 : 0.16 });
        if (rig.layers[0].cur) rig.layers[0].cur.speed = speed;
        // процедурный наклон вперёд, когда бежим
        if (this.moving && this.onGround) {
            const lean = U.clamp(this.speed / DATA.player.sprint, 0, 1) * 0.06;
            rig.offset('Hips', lean, 0, 0);
        }
        // голова смотрит туда, куда камера (мягко)
        const d = U.angleDiff(this.faceYaw, Cam.yaw);
        rig.offset('Head', -U.clamp(Cam.pitch - 0.2, -0.6, 0.6) * 0.5, 0, 0);
        rig.offset('Head', 0, 0, U.clamp(d, -0.9, 0.9) * 0.5 * -1 * 0);
    },

    footsteps(dt) {
        const rig = this.rig;
        if (!this.onGround || !this.moving || this.speed < 60) return;
        const ph = rig.phase(0);
        const cross = (a) => (this.lastStepPhase < a && ph >= a) || (this.lastStepPhase > ph && (ph >= a || this.lastStepPhase < a));
        if (cross(0.0) || cross(0.5) || (this.lastStepPhase > ph)) {
            if (window.Sfx) Sfx.step(this.x, this.y, this.z, this.sprinting ? 1 : 0.7);
            if (window.FX && this.speed > 300) FX.dust(this.x, this.y, this.z, 2, 0.35);
        }
        this.lastStepPhase = ph;
    },

    // ---------------------------------------------------------------------------------------- показатели
    vitals(dt) {
        if (this.dead || this.sleeping && Sky.speed > 10) { /* во сне голод тратится быстрее — учитывается временем */ }
        if (this.dead) return;
        const P = DATA.player;
        const k = this.sleeping ? 0.55 : 1;
        this.hunger = Math.max(0, this.hunger - P.hungerDrain * dt * (this.sprinting ? 1.6 : 1) * k * (Sky.speed > 10 ? Sky.speed * 0.02 : 1));
        if (this.hunger <= 0) { if (this.hpTick(P.starveDmg * dt)) this.die('hunger'); }
        else if (this.hunger > 60 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + P.regenHp * dt);
        if (this.hurtT > 0) this.hurtT -= dt;
    },
    hpTick(n) { this.hp -= n; return this.hp <= 0; },

    // Проверяем весь путь рывка: одна проверка конечной точки пропускает тонкие препятствия.
    moveHorizontal(dx, dz) {
        const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / DATA.balance.movement.sweepStep));
        this.atFog = false;
        for (let i = 0; i < n; i++) {
            const p = World.colliders.resolve(this.x + dx / n, this.z + dz / n, DATA.player.radius, this.tmpV);
            const next = { x: p.x, z: p.z };
            if (World.clampToFog(next, 180)) this.atFog = true;
            this.x = next.x; this.z = next.z;
        }
    },
    armor(kind) { return DATA.armor(Sky.day, Camp.level, Zones.rescuedCount(), kind); },

    hurt(amount, sx, sz, kind) {
        if (this.dead || this.invuln > 0) return false;
        amount = DATA.incomingDamage(amount, Sky.day, Camp.level, Zones.rescuedCount(), kind);
        this.hp -= amount;
        this.invuln = kind === 'dot' ? 0.2 : 0.55;
        this.hurtT = 0.4;
        const dx = this.x - sx, dz = this.z - sz, d = Math.hypot(dx, dz) || 1;
        if (kind !== 'dot' && kind !== 'fall') { this.knock = { x: dx / d * 380, z: dz / d * 380 }; }
        const behind = Math.abs(U.angleDiff(this.faceYaw, Math.atan2(sx - this.x, sz - this.z))) > 2.1;
        this.rig.play(behind ? 'hit_back' : 'hit', { layer: 2, fade: 0.04, loop: false, restart: true, mask: null });
        Cam.shake(0.45 + Math.min(0.4, amount / 90)); Cam.kick(0.06);
        if (window.UI) { UI.hitFlash(Math.min(1, 0.5 + amount / 60)); UI.floatText(this.headPos(), '-' + amount, '#ff5a4d'); }
        if (window.Sfx) Sfx.at('hurt', this.x, this.y, this.z, 0.9);
        if (window.FX) FX.hitSpark(this.x, this.y + 1.1 * M, this.z, '#ff5a4d');
        if (this.hp <= 0) { this.die(kind); return true; }
        return true;
    },

    heal(n) {
        this.hp = Math.min(this.maxHp, this.hp + n);
        if (window.FX) FX.heal(this.x, this.y, this.z);
        if (window.UI) UI.floatText(this.headPos(), '+' + Math.round(n), '#6dff8a');
    },

    die(kind) {
        if (this.dead) return;
        this.dead = true; this.hp = 0; this.control = false;
        this.rig.stop(1, 0.1);
        this.rig.play('death', { layer: 2, fade: 0.1, loop: false, hold: true, weight: 1, restart: true, mask: null });
        this.rig.layers[2].target = 1; this.rig.layers[2].weight = 1;
        if (this.flashOn) this.setFlash(false);
        Cam.shake(0.9); Cam.kick(0.12);
        if (window.Sfx) Sfx.at('death', this.x, this.y, this.z, 1);
        if (window.Game) Game.onDeath(kind);
    },

    // ---------------------------------------------------------------------------------------- предмет в руке
    equipCurrent() {
        const s = Inv.current();
        this.equip(s ? s.id : null);
    },

    equip(id) {
        if (id === this.heldId && (this.heldRoot || !id)) return;
        if (this.heldRoot) { const r = this.heldRoot; if (r._rig) r._rig.dispose(); else { for (const m of r._meshes || []) m.dispose(); r.dispose(); } this.heldRoot = null; }
        this.heldId = id || null;
        this.rig.stop(1, 0.12);
        if (!id) { this.stance = null; return; }
        const d = DATA.items[id];
        // лук — своя модель (плечи гнутся, тетива, стрела); в кулак левой руки его ставит Archery каждый кадр
        if (id === 'bow' && window.Archery) {
            this.heldRoot = Archery.makeBow(this);
            this.applyStance();
            if (window.UI) UI.equipped(id);
            if (window.Sfx) Sfx.ui('equip');
            return;
        }
        const root = Items.make(id);
        this.heldRoot = root;
        const g = Player.GRIPS[d.grip || 'hold'] || Player.GRIPS.hold;
        const parent = this.rig.node(g.bone || 'GripR');
        root.parent = parent;
        root.position.set(g.pos[0] * M, g.pos[1] * M, g.pos[2] * M);
        root.rotationQuaternion = new BABYLON.Quaternion(g.q[0], g.q[1], g.q[2], g.q[3]);
        root.scaling.setAll((g.scale || 1) * (d.holdScale || 1));
        for (const m of root._meshes || []) this.view.addShadowCaster(m, false);
        this.applyStance();
        if (window.UI) UI.equipped(id);
        if (window.Sfx) Sfx.ui('equip');
    },

    // ---------------------------------------------------------------------------------------- действия
    actions(dt, canMove) {
        if (!canMove || this.dead) return;
        const def = this.heldDef();
        const rig = this.rig;
        if (this.acting > 0) {
            this.acting -= dt;
            if (this.pendingHit && this.acting <= this.pendingHit.at) { const h = this.pendingHit; this.pendingHit = null; h.fn(); }
            if (this.acting <= 0) this.pendingHit = null;
        }
        // выбросить
        if (Input.pressed('drop') && Inv.current()) this.dropCurrent();
        // хотбар
        const sl = Input.slotPressed();
        if (sl >= 0 && sl < Inv.hot) Inv.select(sl);
        // атака / использование
        const held = Input.down('attack');
        if (!def || Camp.placing) return;
        // лук: натяжение и выстрел по своему циклу (тап — выстрел, удержание — держать натянутым)
        if (this.heldId === 'bow' && window.Archery) { Archery.playerInput(this, def, dt); return; }
        if (window.UI && UI.blocking()) return;
        if (!(Input.pressed('attack') || (held && (def.type === 'tool' || def.type === 'weapon') && !def.throw && !def.type.includes('food')))) return;
        if (this.attackCd > 0 || this.acting > 0) return;
        this.useHeld(def);
    },

    useHeld(def) {
        const id = this.heldId, rig = this.rig;
        if (def.type === 'tool' && def.tree) return this.swing(def, 'chop');
        if (def.type === 'weapon' && !def.ranged) return this.swing(def, def.anim || 'swing');
        if (def.type === 'weapon' && def.ranged) return this.shoot(def);
        if (def.type === 'food' || def.type === 'heal') return this.consume(id, def);
        if (id === 'flashlight' && Input.pressed('attack')) { this.setFlash(!this.flashOn); if (window.Sfx) Sfx.ui('click'); return; }
        if (id === 'compass' && Input.pressed('attack')) { if (window.UI) UI.openBoard(); return; }
    },

    // Запуск одноразовой анимации: на бегу — только верх тела
    playAction(name, speed, hold) {
        const rig = this.rig;
        const mask = this.moving && this.onGround ? this.upperMask : null;
        rig.play(name, { layer: 2, mask, fade: 0.05, loop: false, speed: speed || 1, restart: true, hold: !!hold });
        rig.layers[2].target = 1;
        return rig.duration(name) / (speed || 1);
    },

    swing(def, anim) {
        // комбо: ближнее оружие чередует удары, третий подряд — финишер (дольше, сильнее, с эффектами)
        const cb = window.AttackFX ? AttackFX.combo(this, def, anim) : { anim, n: 0, fin: false, flip: false };
        anim = cb.anim;
        const rate = (def.rate || 0.8) * (cb.fin ? 1.12 : 1);
        const dur0 = this.rig.duration(anim) || 0.8;
        const speed = dur0 / rate;
        const dur = this.playAction(anim, speed);
        this.acting = dur; this.attackCd = rate * 0.98;
        const hitAt = anim === 'stab' ? 0.42 : anim === 'chop' ? 0.52 : 0.5;
        const remain = dur * (1 - hitAt);
        this._swingFx = cb;
        this.pendingHit = { at: remain, fn: () => this.strike(def) };
        if (window.Sfx) Sfx.at('swing', this.x, this.y, this.z, cb.fin ? 0.85 : 0.6, cb.fin ? 0.85 : 1 + (cb.n ? 0.08 : 0));
        this.faceYaw = Cam.yaw;
        if (window.AttackFX) AttackFX.swingStart(this, def, cb, dur, hitAt);
    },

    // Множитель улучшения оружия в руках: урон +18% за уровень, скорость рубки +15%
    lvDmgK() { const s = Inv.current(); return 1 + 0.18 * (s ? s.lv | 0 : 0); },
    lvTreeK() { const s = Inv.current(); return 1 + 0.15 * (s ? s.lv | 0 : 0); },

    // Момент удара: дерево или враг перед игроком
    strike(def) {
        const f = { x: Math.sin(this.faceYaw), z: Math.cos(this.faceYaw) };
        const reach = (def.reach || 2.4) * M;
        // враги
        let hitAny = false;
        const e = window.Enemies ? Enemies.inFront(this.x, this.z, f.x, f.z, reach, 0.62) : null;
        const tree = def.tree ? World.treeInFront(this.x, this.z, f.x, f.z, reach) : null;
        let dTree = 1e9;
        if (tree) dTree = Math.hypot(tree.x - this.x, tree.z - this.z) - tree.rad;
        let dEn = 1e9;
        if (e) dEn = Math.hypot(e.x - this.x, e.z - this.z) - e.rad;
        if (tree && dTree <= dEn) { this.chopTree(tree, def, f); hitAny = true; }
        if (e && dEn < dTree + 40) {
            const cb = this._swingFx || { fin: false, n: 0 }, crit = Math.random() < 0.1;
            const dmg = def.dmg * this.lvDmgK() * (1 + this.rand() * 0.2) * (cb.fin ? 1.3 : 1) * (crit ? 1.6 : 1);
            Enemies.damage(e, dmg, this.x, this.z, { knock: (def.stun ? 620 : 380) * (cb.fin ? 1.5 : 1), stun: (def.stun || 0) + (cb.fin ? 0.35 : 0), crit, fx: window.AttackFX ? AttackFX.fxOpt(this.heldId, cb, f) : null });
            hitAny = true;
        }
        if (!hitAny && window.Sfx) Sfx.at('whoosh', this.x, this.y, this.z, 0.4);
    },
    rand() { return Math.random() * 0.4 - 0.1; },

    chopTree(t, def, f) {
        const dmg = (def.tree || 1) * this.lvTreeK();
        t.hp -= dmg;
        const hx = t.x - f.x * t.rad * 0.6, hz = t.z - f.z * t.rad * 0.6, hy = World.heightAt(t.x, t.z) + 130;
        World.shakeTree(t, f.x, f.z);
        Cam.shake(0.22);
        if (window.FX) { FX.chips(hx, hy, hz, f); FX.leaves(t.x, hy + 250 * t.s, t.z, Math.min(10, 4 + dmg * 2)); }
        if (window.AttackFX) AttackFX.chop({ x: hx, y: hy, z: hz }, f, def, this.heldId);
        if (window.Sfx) Sfx.at('chop', t.x, hy, t.z, 1);
        if (t.hp <= 0) this.fellTree(t, f);
    },

    fellTree(t, f) {
        World.removeTree(t);
        const drops = Math.max(2, Math.round(2 + t.s * 1.6 + (/pine_b/.test(t.v) ? 1 : 0)));
        if (window.Sfx) Sfx.at('treefall', t.x, t.y || 100, t.z, 1);
        Cam.shake(0.3);
        this.stats.logs += drops;
        World.fellVisual(t, f.x, f.z, () => {});
        // логи вылетают после падения
        const spawnAt = (t.x + f.x * 300 * t.s), spawnZ = (t.z + f.z * 300 * t.s);
        for (let i = 0; i < drops; i++) {
            const a = Math.random() * 6.28, s = 120 + Math.random() * 180;
            Events.queueLoot('log', 1, spawnAt + Math.cos(a) * 60, spawnZ + Math.sin(a) * 60, World.heightAt(spawnAt, spawnZ) + 160, .9,
                { vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 460 + Math.random() * 220 });
        }
        if (window.UI) UI.objectiveEvent('chop');
    },

    // Выстрел из-за плеча в точку под прицелом
    shoot(def) {
        if (!Inv.has(def.ammo, 1)) { if (window.UI) UI.toast(Lang.t('noAmmo'), 'warn'); if (window.Sfx) Sfx.ui('empty'); this.attackCd = 0.4; return; }
        Inv.take(def.ammo, 1);
        this.attackCd = def.rate;
        const rig = this.rig;
        rig.play('fire', { layer: 2, mask: this.upperMask, loop: false, fade: 0.02, restart: true });
        rig.layers[2].target = 1;
        this.acting = 0.2;
        this.faceYaw = Cam.yaw;
        const from = this.muzzle();
        const dir = this.aimDir(from);
        if (window.Sfx) Sfx.at(def.silent ? 'swing' : (this.heldId === 'rifle' || this.heldId === 'shotgun' ? 'rifle' : 'revolver'), this.x, this.y, this.z, 1);
        if (window.FX && !def.silent) FX.muzzle(from.x, from.y, from.z, dir);
        Cam.shake(0.3); Cam.kick(def.silent ? 0.015 : 0.03);
        if (window.AttackFX) AttackFX.shot(this, from, dir, this.heldId, this.heldId === 'shotgun' ? 1.5 : this.heldId === 'rifle' ? 1.25 : 1);
        const crit = Math.random() < 0.08, cm = crit ? 1.5 : 1;
        if (def.pellets) {
            const sp = def.spread || 0.1;
            for (let i = 0; i < def.pellets; i++) {
                const d2 = { x: dir.x + (Math.random() - 0.5) * sp * 2, y: dir.y + (Math.random() - 0.5) * sp * 2, z: dir.z + (Math.random() - 0.5) * sp * 2 };
                const l = Math.hypot(d2.x, d2.y, d2.z); d2.x /= l; d2.y /= l; d2.z /= l;
                Combat.hitscan(from, d2, def.range * M, def.dmg * this.lvDmgK(), 'player', { id: this.heldId });
            }
        } else Combat.hitscan(from, dir, def.range * M, def.dmg * this.lvDmgK() * cm, 'player', { id: this.heldId, crit });
        if (window.UI) UI.objectiveEvent('shoot');
    },

    muzzle() {
        if (this.heldRoot) { const p = this.heldRoot.getAbsolutePosition(); return { x: p.x + Math.sin(this.faceYaw) * 55, y: p.y + 6, z: p.z + Math.cos(this.faceYaw) * 55 }; }
        return { x: this.x + Math.sin(this.faceYaw) * 60, y: this.y + 1.3 * M, z: this.z + Math.cos(this.faceYaw) * 60 };
    },
    // Направление выстрела: из дула на точку, куда смотрит камера
    aimDir(from) {
        const c = Cam.cam.position, f = Cam.fwd;
        // точка по лучу камеры на 30 м
        const tx = c.x + f.x * 3000, ty = c.y + f.y * 3000, tz = c.z + f.z * 3000;
        const dx = tx - from.x, dy = ty - from.y, dz = tz - from.z, l = Math.hypot(dx, dy, dz);
        return { x: dx / l, y: dy / l, z: dz / l };
    },

    consume(id, def) {
        if (def.type === 'food') {
            if (this.hunger >= 99 && !def.raw && def.hp <= 0) return;
            if (this.hunger >= 99 && def.hp <= 0 && !def.raw) return;
        }
        if (def.type === 'heal' && this.hp >= this.maxHp - 0.5) { if (window.UI) UI.toast(Lang.t('hpFull'), 'info'); return; }
        const dur = this.playAction(def.type === 'heal' ? 'heal' : (def.buff ? 'drink' : 'eat'), 1.0);
        this.acting = dur; this.attackCd = dur + 0.1;
        this.pendingHit = { at: dur * 0.35, fn: () => {
            const s = Inv.current();
            if (!s || s.id !== id) return;
            Inv.removeSlot(Inv.sel, 1);
            if (def.hunger) { this.hunger = Math.min(100, this.hunger + def.hunger); if (window.UI) UI.floatText(this.headPos(), '+' + def.hunger + ' 🍖', '#ffb84a'); }
            if (def.hp > 0) this.heal(def.hp);
            if (def.stamina) this.stamina = Math.min(100, this.stamina + def.stamina);
            if (def.buff) { this.buff = { speed: def.buff.speed, t: def.buff.t }; if (window.UI) UI.toast(Lang.t('buffOn'), 'good'); }
            if (def.hp < 0) this.hurt(-def.hp, this.x, this.z, 'dot');
            if (window.Sfx) Sfx.at(def.type === 'heal' ? 'bandage' : 'eat', this.x, this.y, this.z, 0.9);
            if (window.FX) FX.eat(this.x, this.y + 1.2 * M, this.z);
            if (!Inv.current()) this.equipCurrent();
            if (window.UI) UI.objectiveEvent('eat');
        } };
    },

    dropCurrent() {
        const s = Inv.current();
        if (!s) return;
        this.dropSlot(Inv.sel, DATA.items[s.id].stack > 1 ? 1 : s.n);
    },
    // Выбросить n предметов из слота i перед героем
    dropSlot(i, n) {
        const rec = Inv.removeSlot(i, n);
        if (!rec) return;
        const f = { x: Math.sin(this.faceYaw), z: Math.cos(this.faceYaw) };
        Items.spawn(rec.id, rec.n, this.x + f.x * 90, this.z + f.z * 90, { y: this.y + 130, vx: f.x * 260, vz: f.z * 260, vy: 260, delay: 1.1, lv: rec.lv, mag: rec.mag });
        if (!Inv.current()) this.equipCurrent();
        if (window.Sfx) Sfx.ui('drop');
    },

    // ---------------------------------------------------------------------------------------- фонарь
    setFlash(on) { this.flashOn = on; if (window.UI) UI.flashState(on); },
    updateFlash(dt) {
        const want = this.flashOn && this.heldId === 'flashlight' && !this.dead;
        this.flashBeam = U.damp(this.flashBeam, want ? 1 : 0, 14, dt);
        const fl = this.flash;
        fl.intensity = this.flashBeam * 3.4 * (0.7 + 0.3 * Sky.night);
        if (this.flashBeam > 0.01) {
            const h = this.headPos();
            fl.position.set(h.x + Math.sin(this.faceYaw) * 30, h.y, h.z + Math.cos(this.faceYaw) * 30);
            fl.direction.set(Cam.fwd.x, Cam.fwd.y * 0.9 - 0.02, Cam.fwd.z);
        }
    },
};

// Позы рук с предметами. q — поворот предмета относительно кости GripR (кватернион x,y,z,w), pos — сдвиг (м),
// stance — клип слоя 1, arms — какие руки перекрывает стойка ('R' | 'both'). Значения найдены Player.calibrate().
Player.GRIPS = {
    hold:  { bone: 'GripR', pos: [0, 0, 0], q: [-0.0765, -0.0233, 0.0662, 0.9946], scale: 1, stance: 'hold', arms: 'R' },
    axe:   { bone: 'GripR', pos: [0, 0, 0], q: [-0.2007, -0.0314, 0.0627, 0.9771], scale: 1, stance: 'hold', arms: 'R' },
    saw:   { bone: 'GripR', pos: [0, 0, 0], q: [0.1351, -0.0088, 0.0696, 0.9883], scale: 1, stance: 'hold', arms: 'R' },
    spear: { bone: 'GripR', pos: [0, 0, 0], q: [-0.0492, 0.8602, -0.5052, 0.05], scale: 1, stance: 'hold', arms: 'R' },
    sword: { bone: 'GripR', pos: [0, 0, 0], q: [-0.2425, -0.0341, 0.0613, 0.9676], scale: 1, stance: 'hold', arms: 'R' },
    light: { bone: 'GripR', pos: [0, 0, 0], q: [0.0378, -0.6217, 0.7815, -0.037], scale: 1, stance: 'light', arms: 'R' },
    gun:   { bone: 'GripR', pos: [0, 0, 0], q: [-0.0328, -0.0647, 0.0566, 0.9958], scale: 1, stance: 'aim', arms: 'both' },
    rifle: { bone: 'GripR', pos: [0, 0, 0], q: [-0.0328, -0.0647, 0.0566, 0.9958], scale: 1, stance: 'aim', arms: 'both' },
    bow:   { bone: 'GripL', pos: [0, 0, 0], q: [0, 0, 0, 1], scale: 1, stance: null, arms: 'both' },     // лук ведёт Archery (IK рук)
    carry: { bone: 'GripR', pos: [0, 0, 0], q: [-0.2912, -0.6949, 0.0996, 0.6499], scale: 1, stance: 'carry', arms: 'both' },
    compass: { bone: 'GripR', pos: [0, 0, 0], q: [-0.0225, -0.0197, 0.0674, 0.9973], scale: 1, stance: 'hold', arms: 'R' },
};

// Калибровка хвата: для каждой позы находит поворот предмета относительно GripR так, чтобы оси предмета смотрели
// в заданные направления в системе игрока (вперёд +Z, вверх +Y, влево +X). spec: [{ axis: [x,y,z] в предмете, dir: [x,y,z] в мире игрока }, ...] (2 записи).
Player.solveGrip = function (grip, spec) {
    const rig = this.rig, g = Player.GRIPS[grip];
    // поза: ждём установившуюся стойку
    rig.play('idle', { fade: 0, restart: true });
    for (const L of [rig.layers[1], rig.layers[2]]) { L.cur = null; L.weight = 0; L.target = 0; }
    if (g.stance) rig.play(g.stance, { layer: 1, mask: g.arms === 'both' ? this.upperMask : this.armRMask, fade: 0.01, weight: 1 });
    rig.layers[1].weight = 1;
    for (let i = 0; i < 6; i++) rig.update(0.05);
    const node = rig.node(g.bone);
    // мировые матрицы всей цепочки — сверху вниз (иначе у промежуточных костей они «вчерашние»)
    const upd = (n) => { n.computeWorldMatrix(true); for (const c of n.getChildren()) upd(c); };
    upd(this.node);
    const inv = this.node.getWorldMatrix().clone().invert();
    const Mg = node.getWorldMatrix().multiply(inv);
    const V = BABYLON.Vector3;
    const norm = (v) => v.normalize();
    // образы осей предмета: primary точно, secondary — после ортогонализации
    const A = spec[0], B = spec[1];
    const a = norm(new V(A.dir[0], A.dir[1], A.dir[2]));
    let b = new V(B.dir[0], B.dir[1], B.dir[2]);
    b = norm(b.subtract(a.scale(V.Dot(b, a))));
    // построим базис предмета: найдём образы e_x, e_y, e_z
    const axisA = new V(A.axis[0], A.axis[1], A.axis[2]).normalize(), axisB = new V(B.axis[0], B.axis[1], B.axis[2]).normalize();
    const axisC = V.Cross(axisA, axisB), imgC = V.Cross(a, b);
    // матрица P (столбцы = оси предмета) и Q (столбцы = образы): R = Q * P^T
    const P = [axisA, axisB, axisC], Q = [a, b, imgC];
    const images = [null, null, null];
    for (let k = 0; k < 3; k++) {
        const e = [new V(1, 0, 0), new V(0, 1, 0), new V(0, 0, 1)][k];
        let r = new V(0, 0, 0);
        for (let j = 0; j < 3; j++) r = r.add(Q[j].scale(V.Dot(e, P[j])));
        images[k] = r;
    }
    const Mdes = BABYLON.Matrix.FromValues(
        images[0].x, images[0].y, images[0].z, 0,
        images[1].x, images[1].y, images[1].z, 0,
        images[2].x, images[2].y, images[2].z, 0,
        0, 0, 0, 1);
    // убрать перенос/масштаб из Mg
    const s = new V(), q = new BABYLON.Quaternion(), t = new V();
    Mg.decompose(s, q, t);
    const Rg = new BABYLON.Matrix(); BABYLON.Matrix.FromQuaternionToRef(q, Rg);
    const L = Mdes.multiply(Rg.clone().invert());
    const out = new BABYLON.Quaternion(); BABYLON.Quaternion.FromRotationMatrixToRef(L, out);
    return out.asArray().map(v => +v.toFixed(4));
};

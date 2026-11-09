// Player2.js — расширение героя: рыбалка, кирка и рудные жилы, лук/дробовик, баф энергетика, лампа, эмоции,
// оглядывание/потягивание в простое, направленные реакции на удар. Обёртки над методами Player (Player.js грузится раньше).

(function () {
    const P = Player;
    const _useHeld = P.useHeld, _strike = P.strike, _animate = P.animate, _update = P.update, _spawn = P.spawn, _die = P.die;

    /** @type {Record<string, any>} */
    const EXT = {
        fish: null, buff: null, emoteName: null, _idleT: 0, _idleNext: 9, lanternOn: true, lantern: null,
        EMOTES: ['wave', 'cheer', 'dance', 'flex', 'clap', 'sit'],
        spawn(x, z) { Camp.cancelSleep(); return _spawn.call(this, x, z); },
        die(kind) { Camp.cancelSleep(); return _die.call(this, kind); },

        // Экземпляр героя с произвольным видом (торговец, боты): look — как у Player.lookOf
        instanceFor(o, name) {
            const names = this.data && this.data.byName ? Array.from(this.data.byName.keys()) : [];
            const keep = (n, id) => n === id || n.indexOf(id + '_') === 0;
            const accWant = (o.acc || []).map(a => 'Acc_' + a);
            const hide = names.filter(n => (/^Hair_/.test(n) && !(o.hair && keep(n, o.hair))) || (/^Acc_/.test(n) && !accWant.some(id => keep(n, id))));
            return Rig.instance(this.data, this.scene, { name: name || 'npc', hide, merge: true, flat: true,
                materials: { hair: o.hairColor, shirt: o.shirt, jacket: o.jacket, pants: o.pants, skin: o.skin, accA: o.accA || '#ffffff', accB: o.accB || '#cccccc', accC: o.accC || '#888888', glow_acc: o.accC || '#ffffff' } });
        },

        // ------------------------------------------------------------------------------ использование предметов
        useHeld(def) {
            if (def.throw) return this.throwGrenade(def);
            if (def.fish) { if (!Input.pressed('attack')) return; return this.castRod(def); }   // только нажатие (не удержание): заброс и подсечка — одна и та же кнопка
            if (def.lantern) { this.lanternOn = !this.lanternOn; if (window.UI) UI.toast(Lang.t(this.lanternOn ? 'flashOn' : 'flashOff'), 'info'); if (window.Sfx) Sfx.ui('click'); this.attackCd = 0.3; return; }
            return _useHeld.call(this, def);
        },

        // Кирка: рудные жилы впереди; иначе — обычный удар (дерево/враг)
        strike(def) {
            if (def.mine && Zones.ores) {
                const f = { x: Math.sin(this.faceYaw), z: Math.cos(this.faceYaw) }, reach = (def.reach || 2.3) * M;
                let best = null, bd = 1e9;
                for (const o of Zones.ores) {
                    if (o.hp <= 0) continue;
                    const dx = o.x - this.x, dz = o.z - this.z, l = Math.hypot(dx, dz), d = l - 90;
                    if (d > reach || (dx * f.x + dz * f.z) / (l || 1) < 0.35) continue;
                    if (d < bd) { bd = d; best = o; }
                }
                if (best) { Zones.hitOre(best, def.dmg * this.lvDmgK()); return; }
            }
            return _strike.call(this, def);
        },

        // ------------------------------------------------------------------------------ гранаты
        // Бросок в точку прицела: рука замахивается, в момент отпускания граната летит по дуге (Combat.throwGrenade)
        throwGrenade(def) {
            const T = def.throw, id = this.heldId;
            if (this.acting > 0 || this.attackCd > 0 || !id) return;
            const dur = this.playAction('throw', 1.15);
            this.acting = dur; this.attackCd = 0.85; this.faceYaw = Cam.yaw;
            this.fxPose = { kind: 'throw', t: 0, dur };
            this.pendingHit = { at: dur * 0.55, fn: () => {
                const s = Inv.current();
                if (!s || s.id !== id) return;
                Inv.removeSlot(Inv.sel, 1);
                const hp = this.heldRoot ? this.heldRoot.getAbsolutePosition() : null;
                const from = hp ? { x: hp.x, y: hp.y + 20, z: hp.z } : { x: this.x, y: this.y + 1.4 * M, z: this.z };
                const p = Camp.aimPoint((T.range || 20) * M);
                Combat.throwGrenade(id, from, { x: p.x, y: World.heightAt(p.x, p.z) + 30, z: p.z }, T, 'player');
                if (!Inv.current()) this.equipCurrent();
                if (window.Quests) Quests.event('grenade', 1);
            } };
            if (window.Sfx) Sfx.at('swing', this.x, this.y, this.z, 0.6);
        },

        // ------------------------------------------------------------------------------ рыбалка
        castRod(def) {
            const F = this.fish;
            if (F) {
                // клюёт — та же кнопка, которой забрасывали; ожидание повторным нажатием не отменяется (убрать удочку: ПКМ, прыжок или другой предмет)
                if (F.state === 'bite') return this.reelFish(F);
                if (F.state === 'wait') { const now = performance.now(); if (now - (this._fishHint || 0) > 5000) { this._fishHint = now; UI.toast(Lang.t('fish.wait', { k: Input.attackLabel() }), 'info'); } this.attackCd = 0.25; }
                return;
            }
            const f = this.facingVec();
            let pond = null;
            for (const d of [280, 420, 560]) { pond = Zones.pondAt(this.x + f.x * d, this.z + f.z * d); if (pond) { this.castAt = d; break; } }
            if (!pond) { UI.toast(Lang.t('fish.noWater'), 'warn'); this.attackCd = 0.5; return; }
            const d = this.castAt + 120;
            const bx = this.x + f.x * d, bz = this.z + f.z * d;
            const dur = this.playAction('fish_cast', 1.1);
            this.acting = dur; this.attackCd = dur + 0.2;
            this.faceYaw = Cam.yaw;
            const y = Zones.pondDisc ? Zones.pondDisc.position.y : World.heightAt(bx, bz);
            const bob = BABYLON.MeshBuilder.CreateSphere('bobber', { diameter: 18, segments: 8 }, this.scene);
            const bm = new BABYLON.StandardMaterial('bobberMat', this.scene); bm.diffuseColor = new BABYLON.Color3(1, 0.25, 0.2); bm.emissiveColor = new BABYLON.Color3(0.4, 0.05, 0.05); bm.metadata = { mist: false };
            bob.material = bm; bob.isPickable = false; bob.position.set(this.x, this.y + 160, this.z);
            this.fish = { state: 'cast', t: 0, wait: 3 + Math.random() * 5.5, bx, bz, y, bob, line: null, pond, tx: bx, tz: bz };
            this.busy = { lock: true, face: true };
            UI.toast(Lang.t('fish.hint', { k: Input.attackLabel() }), 'info');
            if (window.Sfx) Sfx.at('swing', this.x, this.y, this.z, 0.6);
        },
        reelFish(F) {
            this.playAction('fish_reel', 1.1);
            const r = Math.random();
            let got = null;
            if (r < 0.04) got = ['diamond', 1]; else if (r < 0.14) got = ['bolt', 2]; else if (r < 0.19) got = ['pie', 1]; else got = ['fish_raw', 1 + (Math.random() < 0.25 ? 1 : 0)];
            if (window.FX) { FX.ring(F.bx, F.y + 4, F.bz, 240, '#bfe8ff'); FX.sparkBurst(F.bx, F.y + 30, F.bz, 14, '#bfe8ff'); }
            if (window.Sfx) Sfx.ui('gem');
            Items.spawn(got[0], got[1], this.x + Math.sin(this.faceYaw) * 160, this.z + Math.cos(this.faceYaw) * 160, { y: this.y + 160, vy: 420, delay: 0.3 });
            UI.toast(Lang.t('fish.caught', { n: Lang.t('item.' + got[0]) }), 'good');
            Quests.event('fish', 1);
            this.attackCd = 0.6;
            Econ.dropCoins(this.x + Math.sin(this.faceYaw) * 140, this.z + Math.cos(this.faceYaw) * 140, 2 + Math.floor(Math.random() * 4), 'fish');
            this.endFish(true);
        },
        endFish(keepAnim) {
            const F = this.fish; if (!F) return;
            if (F.bob) { if (F.bob.material) F.bob.material.dispose(); F.bob.dispose(); } if (F.line) F.line.dispose();
            this.fish = null; this.busy = null;
        },
        updateFish(dt) {
            const F = this.fish; if (!F) return;
            F.t += dt;
            if (this.dead || (this.hurtT > 0.3)) { this.endFish(false); return; }
            // убрать удочку: другой предмет, ПКМ или прыжок
            if (this.heldId !== 'fishing_rod' || (F.state !== 'cast' && (Input.pressed('aim') || Input.pressed('jump')))) { this.endFish(false); this.attackCd = 0.3; return; }
            const sinB = Math.sin(performance.now() / 420);
            // поплавок
            const hb = this.heldRoot ? BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(0, 95, 0), this.heldRoot.getWorldMatrix()) : new BABYLON.Vector3(this.x, this.y + 150, this.z);
            if (F.state === 'cast') {
                const k = Math.min(1, F.t / 0.7);
                F.bob.position.set(U.lerp(hb.x, F.bx, k), U.lerp(hb.y, F.y, k) + Math.sin(k * Math.PI) * 140, U.lerp(hb.z, F.bz, k));
                if (k >= 1) { F.state = 'wait'; F.t = 0; FX.ring(F.bx, F.y + 3, F.bz, 140, '#ffffff'); if (window.Sfx) Sfx.at('drop', F.bx, F.y, F.bz, 0.6); }
            } else if (F.state === 'wait') {
                F.bob.position.set(F.bx, F.y + 4 + sinB * 2, F.bz);
                if (F.t > F.wait) { F.state = 'bite'; F.t = 0; UI.toast(Lang.t('fish.bite', { k: Input.attackLabel() }), 'good'); UI.floatText({ x: F.bx, y: F.y + 140, z: F.bz }, '!', '#ffe066', true); FX.ring(F.bx, F.y + 3, F.bz, 220, '#ffffff'); if (window.Sfx) Sfx.at('drop', F.bx, F.y, F.bz, 0.9); Cam.shake(0.1); }
            } else if (F.state === 'bite') {
                F.bob.position.set(F.bx, F.y - 8 + Math.sin(performance.now() / 70) * 4, F.bz);
                if (F.t > 1.7) { UI.toast(Lang.t('fish.escaped'), 'warn'); this.endFish(false); return; }
            }
            // леска
            if (F.state !== 'cast' || F.t > 0.05) {
                const pts = [hb, F.bob.position.clone()];
                pts[1].y += 6;
                if (!F.line) F.line = BABYLON.MeshBuilder.CreateLines('fishLine', { points: pts, updatable: true }, this.scene);
                else F.line = BABYLON.MeshBuilder.CreateLines('fishLine', { points: pts, instance: F.line });
                F.line.color = new BABYLON.Color3(0.92, 0.92, 0.85); F.line.isPickable = false;
            }
        },

        // ------------------------------------------------------------------------------ эмоции и простой
        emote(name) {
            if (this.dead || this.sleeping || !this.control) return;
            this.emoteName = name;
        },
        nextEmote() {
            const i = this.EMOTES.indexOf(this.emoteName);
            if (this.emoteName && i === this.EMOTES.length - 1) { this.emoteName = null; return; }
            this.emote(this.EMOTES[i + 1]);
        },
        animate(dt) {
            if (this.fish && !this.sleeping) {
                const rig = this.rig;
                if (this.fish.state !== 'cast' && rig.current(0) !== 'fish_idle') rig.play('fish_idle', { fade: 0.25 });
                else if (this.fish.state === 'cast' && rig.current(0) !== 'idle') rig.play('idle', { fade: 0.1 });
                return;
            }
            if (this.emoteName) {
                if (this.moving || !this.onGround || this.acting > 0 || this.dead || this.hurtT > 0 || this.sleeping) this.emoteName = null;
                else {
                    const rig = this.rig;
                    if (rig.current(0) !== this.emoteName) rig.play(this.emoteName, { fade: 0.2, loop: !['wave'].includes(this.emoteName) });
                    return;
                }
            }
            _animate.call(this, dt);
            // мелкие оживления в простое
            if (!this.moving && this.onGround && this.acting <= 0 && !this.sleeping && !this.dead && !this.heldId) {
                this._idleT += dt;
                if (this._idleT > this._idleNext) {
                    this._idleT = 0; this._idleNext = 8 + Math.random() * 10;
                    const n = Math.random() < 0.5 ? 'idle2' : 'idle3';
                    this.rig.play(n, { layer: 2, mask: null, fade: 0.25, loop: false, restart: true });
                    this.rig.layers[2].target = 1;
                }
            } else this._idleT = 0;
        },

        // ------------------------------------------------------------------------------ кадр: баф, лампа, рыбалка
        update(dt) {
            if (this.buff) { this.buff.t -= dt; if (this.buff.t <= 0) { this.buff = null; UI.toast(Lang.t('buffEnd'), 'info'); } }
            if (this.sleeping) {
                if (this.invuln > 0) this.invuln -= dt;
                this.vitals(dt);
                if (!this.dead) this.layerReset();
                this.rig.update(dt);
            } else _update.call(this, dt);
            this.updateFish(dt);
            // лампа: тёплый свет у героя, пока лампа в руке
            const want = this.heldId === 'lantern' && this.lanternOn && !this.dead && !this.sleeping;
            if (want && !this.lantern) {
                const L = this.lantern = new BABYLON.PointLight('lanternLight', new BABYLON.Vector3(0, 0, 0), this.scene);
                L.diffuse = new BABYLON.Color3(1, 0.78, 0.4); L.specular = new BABYLON.Color3(0.6, 0.4, 0.2); L.range = 1500; L.intensity = 0; L.renderPriority = 7;
            }
            if (this.lantern) {
                this.lantern.intensity = U.damp(this.lantern.intensity, want ? 2.2 * (0.85 + 0.15 * Math.sin(performance.now() / 130)) : 0, 10, dt);
                if (this.lantern.intensity > 0.02) { const h = this.headPos(); this.lantern.position.set(h.x + Math.sin(this.faceYaw) * 40, h.y - 20, h.z + Math.cos(this.faceYaw) * 40); }
            }
        },
    };
    Object.assign(P, EXT);
})();

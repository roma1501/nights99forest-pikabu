// Econ.js — глобальная экономика: монеты, сердца (жизни), владение скинами и прогресс разблокировки рекламой.
// Всё хранится в мета-записи (Store), переживает новые забеги; «сброс забега» трогает только мир, не кошелёк и не скины.

/** @type {Record<string, any>} */
const Econ = {
    coins: 0, hearts: 4, owned: { default: true }, ads: {}, skin: 'default', earned: 0,
    _lastHeartDay: 0,

    key() { return GAME_ID + '.econ'; },
    load() {
        const m = Store.getJSON(this.key(), {});
        this.coins = Math.max(0, m.coins | 0);
        this.hearts = m.hearts != null ? Math.max(0, Math.min(DATA.lives.max, m.hearts | 0)) : DATA.lives.max;
        this.owned = Object.assign({ default: true }, m.owned || {});
        this.ads = m.ads || {};
        this.skin = SKINS.byId[m.skin] && this.owned[m.skin] ? m.skin : 'default';
        this.earned = m.earned | 0;
        this._lastHeartDay = m.lhd | 0;
    },
    save() { Store.set(this.key(), JSON.stringify({ coins: this.coins, hearts: this.hearts, owned: this.owned, ads: this.ads, skin: this.skin, earned: this.earned, lhd: this._lastHeartDay })); },

    // ------------------------------------------------------------------------------ монеты
    addCoins(n, why) {
        n = Math.round(n); if (n <= 0) return;
        this.coins += n; this.earned += n;
        this.save();
        if (window.UI) UI.setCoins(this.coins, n);
        if (window.Quests) Quests.event('coins', n);
    },
    spend(n) {
        if (this.coins < n) return false;
        this.coins -= n; this.save();
        if (window.UI) UI.setCoins(this.coins, -n);
        return true;
    },
    // Выбросить монеты россыпью (монеты подбираются магнитом и идут в кошелёк, а не в сумку)
    dropCoins(x, z, total, why) {
        total = Math.round(total * (Game.coinK || 1) * (Game.hardcore ? DATA.hardcore.coinK : 1));
        if (total <= 0 || !window.Items) return;
        const dens = [10, 5, 1], out = [];
        let left = total;
        for (const d of dens) while (left >= d && out.length < 14) { out.push(d); left -= d; }
        if (left > 0) out.push(left);
        const y = World.heightAt(x, z) + 70;
        out.forEach((v, i) => {
            const a = Math.random() * 6.283, s = 120 + Math.random() * 230;
            setTimeout(() => {
                const it = Items.spawn('coin', v, x, z, { y, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 480 + Math.random() * 260, delay: 0.5 });
                it.root.scaling.setAll(v >= 10 ? 1.5 : v >= 5 ? 1.2 : 0.95);
            }, 60 + i * 55);
        });
    },

    // ------------------------------------------------------------------------------ сердца
    heartsMax() { return DATA.lives.max; },
    loseHeart() { this.hearts = Math.max(0, this.hearts - 1); this.save(); if (window.UI) UI.setHearts(this.hearts, -1); return this.hearts; },
    gainHeart(why) {
        if (Game.hardcore || this.hearts >= DATA.lives.max) return false;
        this.hearts++; this.save();
        if (window.UI) { UI.setHearts(this.hearts, 1); UI.toast(Lang.t('heartGained'), 'good'); }
        Sfx.ui('heal');
        return true;
    },
    // Hardcore держит одно сердце; Game возвращает его только при подтверждённом рекламном возрождении.
    resetHearts(hardcore) { this.hearts = hardcore ? 1 : DATA.lives.max; this._lastHeartDay = 1; this.save(); if (window.UI) UI.setHearts(this.hearts, 0); },
    // Каждые regenDays пережитых суток возвращается сердце
    onNewDay(day) {
        if (day - this._lastHeartDay >= DATA.lives.regenDays) { this._lastHeartDay = day; this.gainHeart('day'); this.save(); }
    },

    // ------------------------------------------------------------------------------ скины
    has(id) { return !!this.owned[id]; },
    // Сколько просмотров нужно. CrazyGames запрещает цепочки реклам ради одной награды: там всегда один.
    adsNeed(item) { const n = item && item.unlock ? item.unlock.ads || 0 : 0; return typeof GAME_PLATFORM !== 'undefined' && String(GAME_PLATFORM) === 'crazygames' ? Math.min(1, n) : n; },
    adsLeft(id) { const s = SKINS.byId[id]; return s && s.unlock.ads ? Math.max(0, this.adsNeed(s) - (this.ads[id] || 0)) : 0; },
    buy(id) {
        const s = SKINS.byId[id];
        if (!s || this.owned[id] || !s.unlock.coins) return false;
        if (!this.spend(s.unlock.coins)) { if (window.UI) UI.toast(Lang.t('shop.noCoins'), 'warn'); Sfx.ui('deny'); return false; }
        this.owned[id] = true; this.save(); Sfx.ui('fanfare');
        return true;
    },
    // Просмотр рекламы ради скина: засчитывается только по подтверждению SDK
    async watchAd(id) {
        const s = SKINS.byId[id];
        if (!s || this.owned[id] || !s.unlock.ads) return false;
        const ok = await Platform.rewarded('skin_' + id);
        if (!ok) { if (window.UI) UI.toast(Lang.t('ad.fail'), 'warn'); return false; }
        this.ads[id] = (this.ads[id] || 0) + 1;
        if (this.ads[id] >= this.adsNeed(s)) { this.owned[id] = true; Sfx.ui('fanfare'); }
        else Sfx.ui('gem');
        this.save();
        return true;
    },
    equip(id) {
        if (!this.owned[id]) return false;
        this.skin = id; this.save();
        if (window.Player && Player.applySkin) Player.applySkin(id);
        return true;
    },

    // ------------------------------------------------------------------------------ рюкзаки
    // Лучший купленный рюкзак действует в каждом забеге (слоты растут вместе с ним)
    packTier() { let t = 0; DATA.packs.forEach((p, i) => { if (i === 0 || this.owned[p.id]) t = Math.max(t, i); }); return t; },
    packAdsLeft(i) { const p = DATA.packs[i]; return p && p.unlock.ads ? Math.max(0, this.adsNeed(p) - (this.ads[p.id] || 0)) : 0; },
    buyPack(i) {
        const p = DATA.packs[i];
        if (!p || this.owned[p.id] || !p.unlock.coins) return false;
        if (!this.spend(p.unlock.coins)) { if (window.UI) UI.toast(Lang.t('shop.noCoins'), 'warn'); Sfx.ui('deny'); return false; }
        this.owned[p.id] = true; this.save(); Sfx.ui('fanfare');
        if (window.Inv) Inv.upgrade(this.packTier());
        return true;
    },
    async watchPack(i) {
        const p = DATA.packs[i];
        if (!p || this.owned[p.id] || !p.unlock.ads) return false;
        const ok = await Platform.rewarded('pack_' + p.id);
        if (!ok) { if (window.UI) UI.toast(Lang.t('ad.fail'), 'warn'); return false; }
        this.ads[p.id] = (this.ads[p.id] || 0) + 1;
        if (this.ads[p.id] >= this.adsNeed(p)) { this.owned[p.id] = true; Sfx.ui('fanfare'); if (window.Inv) Inv.upgrade(this.packTier()); }
        else Sfx.ui('gem');
        this.save();
        return true;
    },

    // ------------------------------------------------------------------------------ награды за действия (монеты)
    killReward(type) { const r = DATA.coinKill[type]; if (r) return r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1)); return 0; },
};

// Mist.js — туман леса: высотная дымка (густая у земли, редеет к кронам), плывущие пятна тумана,
// подсветка тумана солнцем/луной и стена тумана на краю мира (шейдер вместо плоской текстуры).
//
// Высотная дымка — плагин материала (BABYLON.MaterialPluginBase), как LoryToonPlugin: вешается на каждый
// StandardMaterial и подмешивает туман перед штатным (Scene fog, EXP2) в default.fragment. Оптическая
// глубина считается аналитически вдоль луча камера—точка: плотность падает экспоненциально с высотой,
// поэтому в низинах туман гуще, на холмах и у крон чище. Пятна — value-noise по XZ, сдвигаются ветром.
// Значения приходят из Sky.apply() каждый кадр (Mist.set), в шейдер уходят uniform'ами.
//
// Подключать ПОСЛЕ libs/babylon.js и ДО создания материалов (регистрация фабрики — при загрузке файла).

/** @type {Record<string, any>} */
const Mist = {
    on: true,
    // плотность у земли (1/px), спад с высотой (1/px), уровень «земли» по Y, сила смешивания
    dens: 0.00012, falloff: 1 / 480, base: -60, amount: 1,
    color: [0.62, 0.7, 0.75], glow: 0.0,
    sun: [0, 1, 0],
    time: 0,
    registered: false,

    register() {
        if (this.registered || typeof BABYLON === 'undefined' || !BABYLON.MaterialPluginBase || typeof BABYLON.RegisterMaterialPlugin !== 'function') return;
        this.registered = true;
        BABYLON.RegisterMaterialPlugin('LoryMist', (material) => {
            if (!(material instanceof BABYLON.StandardMaterial)) return null;
            if (material.shaderLanguage != null && material.shaderLanguage !== 0) return null;
            material.loryMist = new LoryMistPlugin(material);
            return material.loryMist;
        });
    },

    // Из Sky: плотность, цвет, направление на источник света, сила свечения в его сторону
    set(dens, color, sunDir, glow) {
        this.dens = dens;
        this.color[0] = color.r; this.color[1] = color.g; this.color[2] = color.b;
        this.sun[0] = sunDir.x; this.sun[1] = sunDir.y; this.sun[2] = sunDir.z;
        this.glow = glow;
    },
    tick(dt) { this.time = (this.time + dt) % 4000; },
};

class LoryMistPlugin extends BABYLON.MaterialPluginBase {
    constructor(material) {
        super(material, 'LoryMist', 620, { LORYMIST: false }, true, true);
    }

    getClassName() { return 'LoryMistPlugin'; }

    prepareDefines(defines) {
        const m = /** @type {any} */ (this._material);
        defines.LORYMIST = !!(Mist.on && !(m.metadata && m.metadata.mist === false));
    }

    getUniforms() {
        return {
            ubo: [
                { name: 'loryMistA', size: 4, type: 'vec4' },
                { name: 'loryMistB', size: 4, type: 'vec4' },
                { name: 'loryMistC', size: 4, type: 'vec4' }
            ],
            fragment: '#ifdef LORYMIST\nuniform vec4 loryMistA;\nuniform vec4 loryMistB;\nuniform vec4 loryMistC;\n#endif'
        };
    }

    bindForSubMesh(ubo) {
        ubo.updateFloat4('loryMistA', Mist.dens, Mist.falloff, Mist.base, Mist.time);
        ubo.updateFloat4('loryMistB', Mist.color[0], Mist.color[1], Mist.color[2], Mist.amount);
        ubo.updateFloat4('loryMistC', Mist.sun[0], Mist.sun[1], Mist.sun[2], Mist.glow);
    }

    getCustomCode(shaderType) {
        return shaderType === 'fragment' ? LoryMistPlugin.CODE : null;
    }
}

LoryMistPlugin.CODE = {
    CUSTOM_FRAGMENT_DEFINITIONS: `
#ifdef LORYMIST
float loryHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float loryNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(loryHash(i), loryHash(i + vec2(1.0, 0.0)), f.x), mix(loryHash(i + vec2(0.0, 1.0)), loryHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
#endif
`,
    CUSTOM_FRAGMENT_BEFORE_FOG: `
#ifdef LORYMIST
#ifdef FOG
{
    vec3 mD = vPositionW - vEyePosition.xyz;
    float mL = length(mD);
    float mk = loryMistA.y;
    float mY0 = vEyePosition.y - loryMistA.z;
    float mKy = mk * mD.y;
    // интеграл exp(-k*y) вдоль луча (средняя относительная плотность на пути)
    float mT = abs(mKy) > 1e-3 ? (exp(-mk * mY0) - exp(-mk * (mY0 + mD.y))) / mKy : exp(-mk * mY0);
    // плывущие пятна: шум на точке и на середине луча, два масштаба, разный дрейф
    float tt = loryMistA.w;
    vec2 mMid = (vPositionW.xz + vEyePosition.xz) * 0.5;
    float mN1 = loryNoise(mMid * 0.00075 + vec2(tt * 0.021, tt * 0.012));
    float mN2 = loryNoise(vPositionW.xz * 0.0019 - vec2(tt * 0.014, tt * 0.026));
    float mN3 = loryNoise(mMid * 0.0042 + vec2(-tt * 0.03, tt * 0.017));
    float mPatch = clamp(0.10 + 1.55 * (0.5 * mN1 + 0.32 * mN2 + 0.18 * mN3), 0.0, 2.2);
    float mOd = loryMistA.x * mL * mT * mPatch;
    float mF = 1.0 - exp(-mOd);
    // свет сквозь дымку: ярче и теплее в сторону солнца (луны)
    vec3 mV = mD / max(mL, 1.0);
    float mSun = pow(max(dot(mV, loryMistC.xyz), 0.0), 4.0) * (0.35 + loryMistC.w);
    vec3 mTint = mix(vec3(0.16, 0.25, 0.45), vec3(0.55, 0.42, 0.26), smoothstep(0.3, 0.7, loryMistC.w));
    vec3 mCol = loryMistB.rgb * (1.0 + 0.25 * mN2) + mSun * mTint;
    color.rgb = mix(color.rgb, mCol, clamp(mF, 0.0, 0.92) * loryMistB.a);
}
#endif
#endif
`
};

Mist.register();

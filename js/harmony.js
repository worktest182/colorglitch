// harmony.js — Чистая логика "Дизайнера" (Стабилизированная версия, Этап 1)
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ColorGlitchHarmony = factory(root);
}(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  // Изолируем глобальный контекст для безопасности SSR / Node / Bundlers
  const globalObj = typeof window !== 'undefined' ? window : (root || {});
  const SWATCH_LIMIT = 12;
  const MIN_RECOMMENDATION_DELTA_E = 4.0;
  const NEAREST_POOL_MULTIPLIER = 6;


  function isHex(hex) { return typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function wrapHue(h) { return (h + 360) % 360; }
  function lerp(a, b, t) { return a + ((b - a) * t); }

  // Переходный слой: Хранит правила колористики для базовых семейств
  const DESIGN_RULES = {
    Beige: {
      monochrome: [{ h: 36, s: [8, 22], l: [70, 90] }, { h: 30, s: [10, 26], l: [55, 75] }],
      neutralPartners: [{ h: 0, s: [0, 10], l: [55, 85] }, { h: 32, s: [12, 25], l: [58, 82] }],
      naturalHarmony: [{ h: 102, s: [12, 24], l: [45, 68] }, { h: 74, s: [14, 30], l: [38, 58] }],
      contrastAccent: [{ h: 205, s: [18, 34], l: [24, 42] }, { h: 130, s: [22, 38], l: [18, 34] }]
    },
    Grey: {
      monochrome: [{ h: 0, s: [0, 9], l: [25, 80] }],
      neutralPartners: [{ h: 35, s: [8, 22], l: [62, 82] }],
      naturalHarmony: [{ h: 90, s: [14, 28], l: [38, 62] }, { h: 205, s: [12, 28], l: [38, 62] }],
      contrastAccent: [{ h: 22, s: [25, 45], l: [30, 48] }, { h: 220, s: [25, 45], l: [20, 35] }]
    },
    default: {
      monochrome: [{ mode: 'base', dl: -14, ds: -8 }, { mode: 'base', dl: 12, ds: -12 }],
      neutralPartners: [{ h: 30, s: [10, 24], l: [66, 86] }, { h: 0, s: [0, 10], l: [68, 92] }],
      naturalHarmony: [{ mode: 'base', dh: 26, ds: -12, dl: -4 }, { mode: 'base', dh: -20, ds: -8, dl: 8 }],
      contrastAccent: [{ mode: 'base', dh: 180, s: [16, 32], l: [30, 52] }, { mode: 'base', dh: 165, s: [18, 35], l: [24, 44] }]
    }
  };

  function getProfile(hex) {
    if (globalObj.colorScience && typeof globalObj.colorScience.getColorProfile === 'function') {
      const r = globalObj.colorScience.getColorProfile(hex);
      if (r && r.ok) return r.result;
    }
    return { hue: 0, saturation: 0, lightness: 50, baseFamily: 'default', isLight: false, isDark: false };
  }

  function hslToHex(h, sPct, lPct) {
    const s = sPct / 100; const l = lPct / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];

    const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0').toUpperCase();
    return `#${to(r)}${to(g)}${to(b)}`;
  }

  function hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  function hexToHsl(hex) {
    const rgb = hexToRgb(hex);
    const rn = rgb.r / 255;
    const gn = rgb.g / 255;
    const bn = rgb.b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    let sat = 0;
    const l = (max + min) / 2;

    if (d !== 0) {
      sat = d / (1 - Math.abs((2 * l) - 1));
      if (max === rn) h = 60 * (((gn - bn) / d) % 6);
      else if (max === gn) h = 60 * (((bn - rn) / d) + 2);
      else h = 60 * (((rn - gn) / d) + 4);
    }

    if (h < 0) h += 360;
    return { h, s: sat * 100, l: l * 100 };
  }

  function getLabMetrics(hex) {
    if (globalObj.colorScience && typeof globalObj.colorScience.toLab === 'function') {
      const labResult = globalObj.colorScience.toLab(hex);
      if (labResult && labResult.ok && labResult.result) {
        const lab = labResult.result;
        return {
          labL: lab.L,
          chroma: Math.sqrt((lab.a * lab.a) + (lab.b * lab.b))
        };
      }
    }

    const hsl = hexToHsl(hex);
    return { labL: hsl.l, chroma: hsl.s };
  }

  function isHighlySaturatedBase(profile, baseHex) {
    const metrics = getLabMetrics(baseHex);
    const saturation = Number(profile.saturation) || 0;
    const lightness = Number(profile.lightness) || 0;
    const chroma = Number(metrics.chroma) || 0;

    // Only activate the guardrail for hot, vivid bases; pastels/muted/standard colors keep the legacy math.
    return saturation >= 68 && chroma >= 50 && lightness >= 25 && lightness <= 72;
  }

  function passesVibrantBaseGuard(candidate) {
    const hex = candidate && candidate.hex;
    if (!isHex(hex)) return false;

    const hsl = hexToHsl(hex);
    const metrics = getLabMetrics(hex);
    const lightness = metrics.labL;
    const chroma = metrics.chroma;

    // "Air": high lightness with low saturation/chroma so vivid bases have visual breathing room.
    const isAiryPastel = lightness >= 78 && hsl.s <= 35 && chroma <= 38;

    // "Depth": low lightness, but not an over-saturated neon-dark that would reintroduce vibration.
    const isDeepGraphic = lightness <= 30 && hsl.s <= 70 && chroma <= 62;

    return isAiryPastel || isDeepGraphic;
  }

  function getRecommendationFilter(profile, baseHex) {
    if (!isHighlySaturatedBase(profile, baseHex)) return null;
    return passesVibrantBaseGuard;
  }


  function materialize(rule, base, t) {
    const isRelative = typeof rule.mode === 'string';
    const progress = typeof t === 'number' ? clamp(t, 0, 1) : 0.5;
    const h = isRelative ? wrapHue(base.hue + (rule.dh || 0)) : rule.h;
    const s = Array.isArray(rule.s)
      ? clamp(lerp(rule.s[0], rule.s[1], progress), 4, 55)
      : clamp(base.saturation + (rule.ds || 0), 4, 55);
    const l = Array.isArray(rule.l)
      ? clamp(lerp(rule.l[0], rule.l[1], progress), 12, 92)
      : clamp(base.lightness + (rule.dl || 0), 12, 92);
    return hslToHex(wrapHue(h), s, l);
  }

  function getActiveRules(profile, familyRules) {
    const H = profile.hue;
    const L = profile.lightness;
    const isDarkBase = L < 35;

    if (!isDarkBase) return familyRules;

    return {
      monochrome: [
        { mode: 'lighten', dl: 45, ds: -15 },
        { mode: 'lighten', dl: 25, ds: -10 }
      ],
      neutralPartners: familyRules.neutralPartners,
      naturalHarmony: [
        { h: (H + 30) % 360, s: [15, 25], l: [50, 65] },
        { h: (H - 30 + 360) % 360, s: [15, 25], l: [55, 68] }
      ],
      contrastAccent: [
        { h: 45, s: [30, 45], l: [75, 85] },
        { h: 0, s: [0, 5], l: [88, 95] }
      ]
    };
  }

  function profileHue(profile) {
    if (!profile.isNeutral || profile.saturation > 4) return profile.hue;
    if (profile.baseFamily === 'Grey') return 210;
    return profile.hue;
  }

  function buildMonochromeTargets(profile) {
    const h = profileHue(profile);
    const baseS = clamp(profile.saturation, profile.isNeutral ? 3 : 8, profile.isNeutral ? 16 : 38);
    const lower = profile.isDark ? 26 : clamp(profile.lightness - 34, 16, 54);
    const upper = profile.isLight ? 92 : clamp(profile.lightness + 34, 58, 92);
    const minL = Math.min(lower, upper - 36);
    const maxL = Math.max(upper, minL + 36);
    const targets = [];

    for (let i = 0; i < SWATCH_LIMIT; i += 1) {
      const t = i / (SWATCH_LIMIT - 1);
      const l = lerp(clamp(maxL, 20, 94), clamp(minL, 12, 88), t);
      const s = clamp(baseS + lerp(-4, 6, t), profile.isNeutral ? 2 : 6, 42);
      targets.push(hslToHex(h, s, l));
    }

    return targets;
  }

  function buildNaturalTargets(profile, rules) {
    const h = profileHue(profile);
    const offsets = [-42, -30, -18, -8, 8, 18, 30, 42];
    const targets = offsets.map((dh, index) => {
      const t = offsets.length === 1 ? 0.5 : index / (offsets.length - 1);
      const s = clamp(Math.max(profile.saturation, 16) + lerp(-4, 8, t), 10, 44);
      const l = clamp(profile.lightness + lerp(8, -6, t), 34, 82);
      return hslToHex(wrapHue(h + dh), s, l);
    });

    rules.forEach((rule, ruleIndex) => {
      [0.25, 0.5, 0.75].forEach((t) => {
        if (targets.length < SWATCH_LIMIT) {
          const shifted = Object.assign({}, rule);
          if (typeof shifted.h === 'number') shifted.h = wrapHue(shifted.h + ((ruleIndex % 2 === 0 ? -1 : 1) * 8));
          targets.push(materialize(shifted, profile, t));
        }
      });
    });

    return targets.slice(0, SWATCH_LIMIT);
  }

  function buildContrastTargets(profile, rules) {
    const h = profileHue(profile);
    const complementOffsets = [180, 168, 192, 156, 204, 180, 174, 186];
    const targets = complementOffsets.map((dh, index) => {
      const t = complementOffsets.length === 1 ? 0.5 : index / (complementOffsets.length - 1);
      const s = clamp(Math.max(profile.saturation + 10, 24) + lerp(2, 12, t), 18, 50);
      const l = clamp(profile.isDark ? lerp(62, 82, t) : lerp(36, 62, t), 28, 84);
      return hslToHex(wrapHue(h + dh), s, l);
    });

    rules.forEach((rule) => {
      [0.35, 0.65].forEach((t) => {
        if (targets.length < SWATCH_LIMIT) targets.push(materialize(rule, profile, t));
      });
    });

    return targets.slice(0, SWATCH_LIMIT);
  }

  function buildRuleTargets(rules, profile, limit) {
    const targets = [];
    const samplesPerRule = Math.max(1, Math.ceil(limit / Math.max(rules.length, 1)));

    rules.forEach((rule) => {
      for (let i = 0; i < samplesPerRule && targets.length < limit; i += 1) {
        const t = samplesPerRule === 1 ? 0.5 : i / (samplesPerRule - 1);
        targets.push(materialize(rule, profile, t));
      }
    });

    return targets;
  }



  function mapScenarioTargets(baseHex) {
    const profile = getProfile(baseHex);
    const familyRules = DESIGN_RULES[profile.baseFamily] || DESIGN_RULES.default;
    const activeRules = getActiveRules(profile, familyRules);
    const out = {
      monochrome: buildMonochromeTargets(profile),
      neutralPartners: buildRuleTargets(activeRules.neutralPartners, profile, SWATCH_LIMIT),
      naturalHarmony: buildNaturalTargets(profile, activeRules.naturalHarmony),
      contrastAccent: buildContrastTargets(profile, activeRules.contrastAccent)
    };

    if (profile.isLight) out.contrastAccent.push('#2E2E2E');
    if (profile.isDark) out.neutralPartners.push('#EEE9E1');
    return out;
  }

  function passesDiversity(candidate, picked, minDeltaE) {
    if (!globalObj.colorScience || typeof globalObj.colorScience.deltaE !== 'function') return true;


    for (let i = 0; i < picked.length; i += 1) {
      const d = globalObj.colorScience.deltaE(candidate.hex, picked[i].hex);
      if (d && d.ok && d.result <= minDeltaE) return false;
    }


    return true;
  }


  function pickBatchNearestPaints(targets, limit, minDeltaE, candidateFilter) {
    const cs = globalObj.colorScience;
    if (!cs || !cs._state || !Array.isArray(cs._state.catalog) || typeof cs._getLab !== 'function' || typeof cs._deltaE2000Lab !== 'function') {
      return null;
    }


    const targetLabs = targets.map((target) => {
      try { return cs._getLab(target); } catch (e) { return null; }
    }).filter(Boolean);


    if (!targetLabs.length) return [];

    const candidates = cs._state.catalog.map((item) => {
      const lab = item.lab || cs._getLab(item.hex);
      let bestDelta = Infinity;

      for (let i = 0; i < targetLabs.length; i += 1) {
        const d = cs._deltaE2000Lab(targetLabs[i], lab);
        if (d < bestDelta) bestDelta = d;
      }

      return {
        id: item.id,
        name: item.name || '',
        hex: item.hex.toUpperCase(),
        source: item.source,
        deltaE: bestDelta
      };
    }).sort((a, b) => a.deltaE - b.deltaE);

    const picked = [];
    const used = new Set();

    for (let i = 0; i < candidates.length && picked.length < limit; i += 1) {
      const candidate = candidates[i];
      if (candidateFilter && !candidateFilter(candidate)) continue;
      if (used.has(candidate.hex) || !passesDiversity(candidate, picked, minDeltaE)) continue;
      used.add(candidate.hex);
      picked.push(candidate);
    }

    return picked;
  }

  // ПОЧИНЕНО: Регистронезависимый ключ + глубокий поиск с perceptual diversity фильтром.
  function nearestRealPaints(targets, k, options) {
    const limit = k || SWATCH_LIMIT;
    const minDeltaE = (options && options.minDeltaE) || MIN_RECOMMENDATION_DELTA_E;
    const candidateFilter = options && typeof options.candidateFilter === 'function' ? options.candidateFilter : null;
    const batchPicked = pickBatchNearestPaints(targets, limit, minDeltaE, candidateFilter);


    if (batchPicked) return batchPicked.slice(0, limit);

    const picked = [];
    const used = new Set();
    const poolMultiplier = candidateFilter ? Math.max(NEAREST_POOL_MULTIPLIER, 20) : NEAREST_POOL_MULTIPLIER;
    const poolSize = Math.max(limit * poolMultiplier, 48);


    // Рассчитываем квоту: сколько максимум красок может дать ОДНА математическая точка
    const quotaPerTarget = Math.ceil(limit / (targets.length || 1));

    targets.forEach((t) => {
      if (!globalObj.colorScience || typeof globalObj.colorScience.findNearest !== 'function') return;

      const r = globalObj.colorScience.findNearest(t, poolSize, { clusterThreshold: minDeltaE });
      if (!r || !r.ok || !Array.isArray(r.result)) return;

      let addedFromTarget = 0; // Счетчик для текущей точки

      for (let i = 0; i < r.result.length; i += 1) {
        // Если текущая точка уже забила свою квоту, переходим к следующей цели
        if (addedFromTarget >= quotaPerTarget || picked.length >= limit) break;

        const c = r.result[i];
        const key = c.hex.toUpperCase();
        const candidate = {

          id: c.id,
          name: c.name || '',
          hex: key,
          source: c.source
        };

        if (candidateFilter && !candidateFilter(candidate)) continue;

        if (!used.has(key) && passesDiversity(candidate, picked, minDeltaE)) {
          used.add(key);
          picked.push(candidate);
          addedFromTarget += 1;
        }
      }

    });

    return picked.slice(0, limit);
  }


  function sortByLightnessDescending(paints) {
    if (!globalObj.colorScience || typeof globalObj.colorScience.toLab !== 'function') return paints;

    return paints.slice().sort((a, b) => {
      const labA = globalObj.colorScience.toLab(a.hex);
      const labB = globalObj.colorScience.toLab(b.hex);
      const lightnessA = labA && labA.ok ? labA.result.L : 0;
      const lightnessB = labB && labB.ok ? labB.result.L : 0;
      return lightnessB - lightnessA;
    });
  }



  // ГЛАВНЫЙ МЕТОД: Генерация чистых, дедуплицированных данных
  function generateVariations(hex) {
    if (!isHex(hex)) return { ok: false, errors: ['invalid hex'] };

    const profile = getProfile(hex);
    const targets = mapScenarioTargets(hex);
    const recommendationFilter = getRecommendationFilter(profile, hex);
    const recommendationOptions = recommendationFilter ? { candidateFilter: recommendationFilter } : null;


    const monoPaints = sortByLightnessDescending(nearestRealPaints(targets.monochrome, SWATCH_LIMIT, recommendationOptions));
    const contrastPaints = nearestRealPaints(targets.contrastAccent, SWATCH_LIMIT, recommendationOptions);


    // Извлекаем сырые списки для природной гармонии и нейтральных партнеров с запасом
    const naturalRaw = nearestRealPaints(targets.naturalHarmony, SWATCH_LIMIT, recommendationOptions);
    const neutralRaw = nearestRealPaints(targets.neutralPartners, SWATCH_LIMIT, recommendationOptions);


    // ПОЧИНЕНО: Сквозной дедуп для объединенного бакета Harmony
    const harmonyPaints = [];
    const harmonySeen = new Set();

    // Заливаем сначала природные компаньоны, затем добиваем нейтралами до 12 уникальных    
      naturalRaw.concat(neutralRaw).forEach((c) => {
      const key = c.hex.toUpperCase();
      if (!harmonySeen.has(key) && harmonyPaints.length < SWATCH_LIMIT && passesDiversity(c, harmonyPaints, MIN_RECOMMENDATION_DELTA_E)) {
        harmonySeen.add(key);
        harmonyPaints.push(c);
      }
    });

    const cleanResult = {
      monochrome: monoPaints,
      harmony: harmonyPaints,
      contrast: contrastPaints
    };

    // Безопасная отправка кастомного события через глобальный контекст
    if (typeof globalObj.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      const event = new CustomEvent('colorGlitchHarmonyGenerated', { detail: cleanResult });
      globalObj.dispatchEvent(event);
    }

    return { ok: true, result: cleanResult };
  }

  return {
    init: function () { return { ok: true }; },
    generateVariations: generateVariations
  };
}));

/* colorScience.js — версия с усиленным порогом кластеризации и упрощённым UMD wrapper
   - DEFAULT_CLUSTER_THRESHOLD = 4.0
   - Упрощённый глобальный wrapper: (function (global) { ... })(window);
   - Сохранён API: init, toLab, deltaE, findNearest, extractDominant
   - ΔE2000, Lab кэширование и прочие улучшения сохранены
*/

console.log("colorScience loaded");

(function (global) {
  'use strict';

  const state = {
    catalog: [],        // [{id,name,hex,source,lab}]
    labCache: new Map() // Map<HEX, {L,a,b}>
  };

  // Минимальная заметная разница между соседними рекомендациями (ΔE2000).
  const DEFAULT_CLUSTER_THRESHOLD = 4.0; // human-perceptible diversity floor

  function ok(result) { return { ok: true, result }; }
  function fail(message) { return { ok: false, errors: [String(message)] }; }

  // --- HEX utilities ---
  function normalizeHex(raw) {
    if (typeof raw !== 'string') return null;
    const s = raw.trim();
    const withHash = s.startsWith('#') ? s : ('#' + s);
    const up = withHash.toUpperCase();
    return (/^#[0-9A-F]{6}$/.test(up)) ? up : null;
  }

  function isHex(hex) {
    return typeof hex === 'string' && /^#[0-9A-F]{6}$/.test(hex.toUpperCase());
  }

  function hexToRgb(hex) {
    const normalized = normalizeHex(hex);
    if (!normalized) throw new Error('hexToRgb: invalid hex: ' + String(hex));
    const v = normalized.slice(1);
    return {
      r: parseInt(v.slice(0, 2), 16),
      g: parseInt(v.slice(2, 4), 16),
      b: parseInt(v.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    const to = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
    return `#${to(r)}${to(g)}${to(b)}`;
  }

  // --- sRGB -> linear -> XYZ -> Lab conversion (D65, observer 2°) ---
  function pivotRgbComponent(v) {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function rgbToXyz(r, g, b) {
    const R = pivotRgbComponent(r);
    const G = pivotRgbComponent(g);
    const B = pivotRgbComponent(b);
    const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) * 100;
    const y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750) * 100;
    const z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) * 100;
    return { x, y, z };
  }

  function pivotXyz(v) {
    return v > 0.008856 ? Math.cbrt(v) : (7.787 * v) + (16 / 116);
  }

  function xyzToLab(x, y, z) {
    const Xn = 95.047, Yn = 100.0, Zn = 108.883;
    const fx = pivotXyz(x / Xn);
    const fy = pivotXyz(y / Yn);
    const fz = pivotXyz(z / Zn);
    const L = (116 * fy) - 16;
    const a = 500 * (fx - fy);
    const b = 200 * (fy - fz);
    return { L, a, b };
  }

  function getLab(hex) {
    const normalized = normalizeHex(hex);
    if (!normalized) throw new Error('getLab: invalid hex: ' + String(hex));
    if (state.labCache.has(normalized)) return state.labCache.get(normalized);
    const { r, g, b } = hexToRgb(normalized);
    const { x, y, z } = rgbToXyz(r, g, b);
    const lab = xyzToLab(x, y, z);
    state.labCache.set(normalized, lab);
    return lab;
  }

  // --- Full CIEDE2000 implementation ---
  function deg2rad(d) { return d * (Math.PI / 180); }
  function rad2deg(r) { return r * (180 / Math.PI); }

  function deltaE2000Lab(lab1, lab2) {
    const L1 = lab1.L, a1 = lab1.a, b1 = lab1.b;
    const L2 = lab2.L, a2 = lab2.a, b2 = lab2.b;
    const kL = 1, kC = 1, kH = 1;

    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const Cbar = (C1 + C2) / 2.0;

    const Cbar7 = Math.pow(Cbar, 7);
    const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

    const a1p = (1 + G) * a1;
    const a2p = (1 + G) * a2;

    const C1p = Math.sqrt(a1p * a1p + b1 * b1);
    const C2p = Math.sqrt(a2p * a2p + b2 * b2);

    const h1p = Math.atan2(b1, a1p);
    const h2p = Math.atan2(b2, a2p);
    const H1p = h1p >= 0 ? rad2deg(h1p) : rad2deg(h1p) + 360;
    const H2p = h2p >= 0 ? rad2deg(h2p) : rad2deg(h2p) + 360;

    const dLp = L2 - L1;
    const dCp = C2p - C1p;

    let dhp = H2p - H1p;
    if (C1p * C2p === 0) {
      dhp = 0;
    } else {
      if (dhp > 180) dhp -= 360;
      else if (dhp < -180) dhp += 360;
    }

    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(dhp) / 2);

    const Lbp = (L1 + L2) / 2;
    const Cbp = (C1p + C2p) / 2;

    let Hbp;
    if (C1p * C2p === 0) {
      Hbp = H1p + H2p;
    } else {
      if (Math.abs(H1p - H2p) > 180) Hbp = (H1p + H2p + 360) / 2;
      else Hbp = (H1p + H2p) / 2;
    }

    const T = 1 - 0.17 * Math.cos(deg2rad(Hbp - 30))
                + 0.24 * Math.cos(deg2rad(2 * Hbp))
                + 0.32 * Math.cos(deg2rad(3 * Hbp + 6))
                - 0.20 * Math.cos(deg2rad(4 * Hbp - 63));

    const dTheta = 30 * Math.exp(-Math.pow((Hbp - 275) / 25, 2));
    const Rc = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
    const Sl = 1 + ((0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2)));
    const Sc = 1 + 0.045 * Cbp;
    const Sh = 1 + 0.015 * Cbp * T;
    const Rt = -Math.sin(deg2rad(2 * dTheta)) * Rc;

    const termL = dLp / (kL * Sl);
    const termC = dCp / (kC * Sc);
    const termH = dHp / (kH * Sh);

    const deltaE = Math.sqrt(
      termL * termL +
      termC * termC +
      termH * termH +
      Rt * termC * termH
    );

    return deltaE;
  }

  // --- Initialization: load catalog and cache Lab for each valid entry ---
  async function init({ catalogPath, catalogData, cacheLab = true, onProgress } = {}) {
    try {
      let catalog = Array.isArray(catalogData) ? catalogData.slice() : [];
      if (!catalog.length && catalogPath && typeof fetch === 'function') {
        const resp = await fetch(catalogPath);
        catalog = await resp.json();
      }

      state.catalog = [];
      state.labCache.clear();

      const total = catalog.length;
      for (let idx = 0; idx < total; idx += 1) {
        const item = catalog[idx];
        if (!item || !item.hex) continue;
        const normalizedHex = normalizeHex(item.hex);
        if (!normalizedHex) continue; // skip invalid hex
        const lab = getLab(normalizedHex);
        state.catalog.push({
          id: item.id || item.name || normalizedHex,
          name: item.name || '',
          hex: normalizedHex,
          source: item.source || 'catalog',
          lab
        });
        if (onProgress) onProgress({ current: idx + 1, total });
      }

      return ok({ catalogSize: state.catalog.length });
    } catch (e) {
      return fail(e && e.message ? e.message : 'init failed');
    }
  }

  // --- Public helpers ---
  function toLab(hex) {
    try {
      const normalized = normalizeHex(hex);
      if (!normalized) return fail('invalid hex');
      return ok(getLab(normalized));
    } catch (e) {
      return fail(e.message || 'toLab failed');
    }
  }

  function deltaE(hex1, hex2) {
    try {
      const n1 = normalizeHex(hex1);
      const n2 = normalizeHex(hex2);
      if (!n1 || !n2) return fail('invalid hex');
      const lab1 = getLab(n1);
      const lab2 = getLab(n2);
      return ok(deltaE2000Lab(lab1, lab2));
    } catch (e) {
      return fail(e.message || 'deltaE failed');
    }
  }

  // --- findNearest: preserve API, improve ranking using ΔE2000 and clustering ---
  // findNearest(hexOrId, k = 5, options = {})
  // options.clusterThreshold (number) overrides default threshold
  function findNearest(hexOrId, k = 5, options = {}) {
    try {
      let queryHex = null;
      if (typeof hexOrId === 'string') {
        const maybe = normalizeHex(hexOrId);
        if (maybe) queryHex = maybe;
        else {
          const found = state.catalog.find((it) => it.id === hexOrId);
          if (found) queryHex = found.hex;
        }
      } else {
        return fail('invalid query type');
      }

      if (!queryHex) return fail('invalid query or not found in catalog');

      const qLab = getLab(queryHex);
      const qChroma = Math.sqrt((qLab.a * qLab.a) + (qLab.b * qLab.b));
      const requestedThreshold = Number(options && options.clusterThreshold);
      const minDiversityDeltaE = Number.isFinite(requestedThreshold)
        ? Math.max(0, requestedThreshold)
        : DEFAULT_CLUSTER_THRESHOLD;


      const candidates = state.catalog.map((item) => {
        const lab = item.lab || getLab(item.hex);

        return {
          id: item.id,
          name: item.name,
          hex: item.hex,
          source: item.source,
          lab,
          deltaE: deltaE2000Lab(qLab, lab),
          chroma: Math.sqrt((lab.a * lab.a) + (lab.b * lab.b)),
          L: lab.L,
          hueShift: Math.sqrt(((lab.a - qLab.a) * (lab.a - qLab.a)) + ((lab.b - qLab.b) * (lab.b - qLab.b)))

        };
      }).sort((a, b) => a.deltaE - b.deltaE);

      const chosen = [];
      const chosenByHex = new Set();



      const canAdd = (candidate) => {
        if (!candidate || candidate.hex === queryHex || chosenByHex.has(candidate.hex)) return false;
        for (let i = 0; i < chosen.length; i += 1) {
          if (deltaE2000Lab(candidate.lab, chosen[i].lab) <= minDiversityDeltaE) return false;
        }
        return true;
      };

      const pickFirst = (predicate) => {
        for (let i = 0; i < candidates.length; i += 1) {
          const c = candidates[i];
          if (!predicate(c)) continue;
          if (!canAdd(c)) continue;
          chosen.push(c);
          chosenByHex.add(c.hex);
          return true;
        }
        return false;
      };

      // Bucket 1 — Exact Match substitute (closest by deltaE)
      pickFirst(() => true);

      // Bucket 2 — Soft Alternative (same hue direction, lower chroma)
      pickFirst((c) => {
        const sameHueDirection = ((qLab.a === 0 || (qLab.a * c.lab.a) >= 0) && (qLab.b === 0 || (qLab.b * c.lab.b) >= 0));
        return sameHueDirection && c.chroma < qChroma;
      });

      // Bucket 3 — Light Alternative (same hue, L +7..15)
      pickFirst((c) => {
        const lDiff = c.L - qLab.L;
        const hueCloseness = c.hueShift <= 10;
        return lDiff >= 7 && lDiff <= 15 && hueCloseness;
      });

      // Bucket 4 — Dark Alternative (same hue, L -7..15)
      pickFirst((c) => {
        const lDiff = qLab.L - c.L;
        const hueCloseness = c.hueShift <= 10;
        return lDiff >= 7 && lDiff <= 15 && hueCloseness;
      });

      // Bucket 5 — Warm/Cool shift (slight hue deviation)
      pickFirst((c) => c.hueShift >= 4 && c.hueShift <= 16);

      // Backfill up to k with nearest diverse options
      for (let i = 0; i < candidates.length && chosen.length < k; i += 1) {
        const c = candidates[i];
        if (!canAdd(c)) continue;
        chosen.push(c);
        chosenByHex.add(c.hex);

      }

      const output = chosen.slice(0, k).map(({ id, name, hex, source, deltaE }) => ({ id, name, hex, source, deltaE }));
      return ok(output);
    } catch (e) {
      return fail(e && e.message ? e.message : 'findNearest failed');
    }
  }

  // --- extractDominant: simple histogram-based extractor (returns HEXs) ---
  function extractDominant(imageData, options) {
    try {
      if (!imageData || !imageData.data) return fail('invalid imageData');
      const paletteSize = (options && options.paletteSize) || 3;
      const bins = new Map();
      for (let i = 0; i < imageData.data.length; i += 4) {
        const hex = rgbToHex(imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]);
        bins.set(hex, (bins.get(hex) || 0) + 1);
      }
      const sorted = Array.from(bins.entries()).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
      return ok({ dominantHex: sorted[0] || '#000000', palette: sorted.slice(0, paletteSize) });
    } catch (e) {
      return fail(e && e.message ? e.message : 'extractDominant failed');
    }
  }


  function rgbToHsl(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
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

  function classifyBaseFamily(profile) {
    const h = profile.hue;
    const s = profile.saturation;
    const l = profile.lightness;

    if (l <= 10) return 'Black';
    if (s <= 9) {
      if (l >= 88) return 'White';
      return 'Grey';
    }

    if (l >= 84 && s <= 18) return profile.isWarm ? 'Beige' : 'White';
    if (h >= 10 && h < 28 && s < 55 && l > 40) return 'Terracotta';
    if (h >= 330 || h < 8) return l > 55 && s < 35 ? 'Dusty Rose' : 'Red';
    if (h >= 8 && h < 42) return l < 45 ? 'Brown' : 'Beige';
    if (h >= 42 && h < 68) return s < 26 ? 'Beige' : 'Yellow';
    if (h >= 68 && h < 92) return 'Olive';
    if (h >= 92 && h < 160) return 'Green';
    if (h >= 160 && h < 210) return 'Blue';
    if (h >= 210 && h < 255) return l < 34 ? 'Navy' : 'Blue';
    if (h >= 255 && h < 330) return l < 40 ? 'Navy' : 'Dusty Rose';
    return 'Grey';
  }

  function getColorProfile(hex) {
    const normalized = normalizeHex(hex);
    if (!normalized) return fail('invalid hex');

    const { r, g, b } = hexToRgb(normalized);
    const hsl = rgbToHsl(r, g, b);
    const isWarm = hsl.h < 70 || hsl.h >= 300;
    const isCool = !isWarm;
    const isNeutral = hsl.s <= 12;

    const profile = {
      hue: hsl.h,
      saturation: hsl.s,
      lightness: hsl.l,
      isLight: hsl.l >= 72,
      isDark: hsl.l <= 30,
      isNeutral,
      isMuted: hsl.s <= 35,
      isPastel: hsl.l >= 74 && hsl.s <= 38,
      isWarm,
      isCool
    };

    profile.baseFamily = classifyBaseFamily(profile);
    return ok(profile);
  }


  // --- Exported API ---
  const api = {
    init,
    toLab,
    deltaE,
    findNearest,
    extractDominant,
    getColorProfile,
    // debug helpers (optional)
    _state: state,
    _getLab: getLab,
    _deltaE2000Lab: deltaE2000Lab
  };

  // --- Minimal inline sanity checks (non-fatal) ---
  (function _selfTests() {
    try {
      const labWhite = getLab('#FFFFFF');
      console.log('colorScience selftest: Lab(#FFFFFF)=', labWhite);
      const d = deltaE2000Lab(getLab('#FFFFFF'), getLab('#FEFEFE'));
      console.log('colorScience selftest: ΔE(#FFFFFF,#FEFEFE)=', d);
      if (state.catalog.length === 0) {
        state.catalog.push({ id: 'TEST_RED', name: 'Red', hex: '#FF0000', source: 'TEST', lab: getLab('#FF0000') });
        state.catalog.push({ id: 'TEST_GREEN', name: 'Green', hex: '#00FF00', source: 'TEST', lab: getLab('#00FF00') });
        state.catalog.push({ id: 'TEST_BLUE', name: 'Blue', hex: '#0000FF', source: 'TEST', lab: getLab('#0000FF') });
      }
      const nn = findNearest('#FF0100', 1);
      console.log('colorScience selftest: nearest to #FF0100 =>', nn);
    } catch (e) {
      console.warn('colorScience selftest failed:', e && e.message);
    }
  }());

  // Простой глобальный экспорт в конце (по просьбе)
  global.colorScience = api;
})(window);

// simulation.js
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ColorGlitchSimulation = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const state = { rootElement: null };
  const ok = (result) => ({ ok: true, result });
  const fail = (message) => ({ ok: false, errors: [message] });
  
  function isHex(hex) { 
    return typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex); 
  }

  function init({ rootElement } = {}) { 
    state.rootElement = rootElement || null; 
    return { ok: true }; 
  }

  // Тонирование базового цвета оттенком света с ограничением интенсивности
  function tint(base, target, strength) {
    const b = parseInt(base.slice(1), 16);
    const t = parseInt(target.slice(1), 16);

    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const tr = (t >> 16) & 255, tg = (t >> 8) & 255, tb = t & 255;
    
    // В отличие от полного смешивания, добавляем только часть светового оттенка
    const tone = (channel, lightChannel) => {
      const shift = (lightChannel - 128) * strength;
      return Math.max(0, Math.min(255, Math.round(channel + shift)));
    };

    const toHex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(tone(br, tr))}${toHex(tone(bg, tg))}${toHex(tone(bb, tb))}`;

  }

// Симуляция освещения: вычисление результирующего цвета стены
  function simulate(hex, { kelvin = 6500, intensity = 1 } = {}) {
    if (!isHex(hex)) return fail('Некорректный HEX формат');
    
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const blend = tint;
    const currentKelvin = clamp(kelvin, 2000, 6500);

    let tintHex = '#FFFFFF';
    let ratio = 0;

    if (currentKelvin < 4000) {
      tintHex = '#FFD1A4';
      const progress = (4000 - currentKelvin) / 2000;
      ratio = progress * 0.30 * intensity;
    } else {
      tintHex = '#E6EEFA';
      const progress = (currentKelvin - 4000) / 2500;
      ratio = progress * 0.20 * intensity;
    }

    ratio = Math.min(0.30, Math.max(0, ratio));

    const simulatedHex = blend(
      hex.toUpperCase(),
      tintHex,
      ratio
    );

    return ok({ simulatedHex: simulatedHex });

  }

  // Рендер цвета на DOM-элемент
  function renderToElement(hex, options = {}) {
    if (!isHex(hex)) return fail('Некорректный HEX формат');
    
    const element = options.element || state.rootElement;
    if (element && typeof element.style !== 'undefined') {
      element.style.backgroundColor = hex.toUpperCase();
      return { ok: true };
    }
    return fail('Целевой элемент не задан или недоступен');
  }

  return { init, simulate, renderToElement };
}));
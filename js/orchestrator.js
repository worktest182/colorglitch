// orchestrator.js
console.log("ORCHESTRATOR API EXECUTED");

(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], function () { return factory(root); });
  else if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.ColorGlitchOrchestrator = factory(root); // Единый стиль именования
}(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  // Подвязываем актуальные модули
  // === ДОБАВЛЕНО: viewMode в состояние ===
  const state = { colorScience: null, harmony: null, lighting: null, viewMode: 'schematic' };
  const ok = (result) => ({ ok: true, result });
  const fail = (message) => ({ ok: false, errors: [message] });

  // Строгий контроль формата для движка
  function isHex(hex) {
    return typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/i.test(hex);
  }

  function init({ colorScience, harmony, lighting }) {
    if (!colorScience || !harmony || !lighting) return fail('Отсутствуют необходимые модули');
    state.colorScience = colorScience;
    state.harmony = harmony;
    state.lighting = lighting;
    return { ok: true };
  }

  // === ДОБАВЛЕНО: Управление режимом отображения (Схема / Фото) ===
  function setViewMode(mode) {
    if (mode !== 'schematic' && mode !== 'photo') return fail('Неизвестный режим отображения');
    state.viewMode = mode;
    
    // Уведомляем модуль стены (если он подгружен), что нужно перерисовать сцену
    if (root.ColorGlitchWall && typeof root.ColorGlitchWall.render === 'function') {
      root.ColorGlitchWall.render();
    }
    return ok({ viewMode: state.viewMode });
  }

  function getViewMode() {
    return state.viewMode;
  }

  // Программный вызов генерации дизайнерских палитр
  function recommendAccent(hex) {
    if (!isHex(hex)) return fail('Ошибка: Движок принимает только HEX значения (напр. #AABBCC)');
    
    if (state.harmony && typeof state.harmony.generateVariations === 'function') {
      state.harmony.generateVariations(hex);
      return ok({ message: "Интерьерные палитры успешно пересчитаны", baseHex: hex });
    }
    return fail('Модуль Harmony не готов');
  }

  // Прямой поиск ближайших красок по всем загруженным каталогам
  function findSimilar(hex, k = 5) {
    if (!isHex(hex)) return fail('Ошибка: Движок принимает только HEX значения');
    if (!state.colorScience) return fail('Каталог красок (colorScience) не загружен');
    
    return state.colorScience.findNearest(hex, k);
  }

  // Программное переключение температуры света в Кельвинах
  function simulateLighting(kelvin) {
    if (typeof kelvin !== 'number') return fail('Кельвины должны быть числом');
    if (state.lighting && typeof state.lighting.sync === 'function') {
      // Имитируем включение света с нужной температурой
      state.lighting.sync({ lighting: kelvin > 4500 ? 'cool' : 'warm', intensity: kelvin });
      return ok({ message: "Освещение обновлено", kelvin: kelvin });
    }
    return fail('Модуль освещения не готов');
  }

  // === ОБНОВЛЕНО: Экспортируем функции управления режимами ===
  const api = { init, recommendAccent, findSimilar, simulateLighting, setViewMode, getViewMode };

  // Автоматическая подвязка при загрузке страницы
  function autoInit() {
    if (!root.colorScience || !root.ColorGlitchHarmony || !root.ColorGlitchLighting) {
      console.warn("Orchestrator API: Ожидание загрузки модулей...");
      return;
    }
    init({
      colorScience: root.colorScience,
      harmony: root.ColorGlitchHarmony,
      lighting: root.ColorGlitchLighting
    });

    // === ДОБАВЛЕНО: Авто-подписка на кнопки тумблера режимов ===
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        if (!mode) return;
        
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        setViewMode(mode);
      });
    });

    console.log("Orchestrator API успешно инициализирован. Доступен глобально как window.ColorGlitchOrchestrator");
  }

  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoInit);
    } else {
      // Даем небольшую задержку, чтобы main.js успел собрать DOM
      setTimeout(autoInit, 100);
    }
  }

  return api;
}));
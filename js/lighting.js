// lighting.js
(function attachLightingModule(global) {
  'use strict';

  function initLighting(options) {
    var config = options || {};
    var WARM_PRESET_INTENSITY = 2800;
    var COOL_PRESET_INTENSITY = 6000;

    var warmButton = document.querySelector('[data-lighting="warm"]');
    var coolButton = document.querySelector('[data-lighting="cool"]');
    var toggleButton = document.getElementById('toggleLightingButton');
    var rangeInput = document.getElementById('lightIntensity');
    
    // Элементы отображения температуры из нашего нового HTML
    var intensityValueLabel = document.getElementById('lightIntensityValue');
    var intensityBubble = document.getElementById('lightIntensityBubble');

    var state = {
      lighting:
        config.initialState && typeof config.initialState.lighting === 'string'
          ? config.initialState.lighting
          : 'warm',
      intensity:
        config.initialState && typeof config.initialState.intensity === 'number'
          ? config.initialState.intensity
          : rangeInput
            ? Number(rangeInput.value)
            : 4500,
      lastEnabledMode: 'warm'
    };

    if (state.lighting !== 'off') {
      state.lastEnabledMode = state.lighting;
    }

    // --- ФУНКЦИЯ ОБНОВЛЕНИЯ ИНТЕРФЕЙСА ОСВЕЩЕНИЯ ---
    function updateLightingUI() {
      // Обновляем текстовые индикаторы Кельвинов
      var textValue = state.lighting === 'off' ? 'Выключено' : state.intensity + 'K';
      if (intensityValueLabel) intensityValueLabel.textContent = textValue;
      if (intensityBubble) {
        intensityBubble.textContent = textValue;
        // Двигаем баббл вслед за ползунком (интерьерная эстетика)
        if (rangeInput) {
          var pct = (state.intensity - rangeInput.min) / (rangeInput.max - rangeInput.min) * 100;
          intensityBubble.style.left = 'calc(' + pct + '% + (' + (8 - pct * 0.15) + 'px))';
        }
      }

      // Переключаем классы активности у кнопок пресетов
      if (warmButton) warmButton.classList.toggle('active', state.lighting === 'warm');
      if (coolButton) coolButton.classList.toggle('active', state.lighting === 'cool');
      
      // Обновляем кнопку полного отключения
      if (toggleButton) {
        if (state.lighting === 'off') {
          toggleButton.textContent = 'Включить освещение';
          toggleButton.classList.add('active');
          toggleButton.setAttribute('aria-pressed', 'true');
          if (rangeInput) rangeInput.disabled = true; // Блокируем ползунок, если свет выключен
        } else {
          toggleButton.textContent = 'Отключить освещение';
          toggleButton.classList.remove('active');
          toggleButton.setAttribute('aria-pressed', 'false');
          if (rangeInput) rangeInput.disabled = false;
        }
      }

      if (rangeInput && state.lighting !== 'off') {
        rangeInput.value = String(state.intensity);
      }
    }

    function emitStateChange() {
      updateLightingUI();
      if (typeof config.onStateChange === 'function') {
        config.onStateChange({
          lighting: state.lighting,
          intensity: state.intensity
        });
      }
    }

    function setLighting(mode) {
      if (mode !== 'warm' && mode !== 'cool') return;
      state.lighting = mode;
      state.lastEnabledMode = mode;
      emitStateChange();
    }

    function applyIntensityPreset(value) {
      state.intensity = value;
      emitStateChange();
    }

    function toggleLighting() {
      if (state.lighting === 'off') {
        state.lighting = state.lastEnabledMode;
      } else {
        state.lastEnabledMode = state.lighting;
        state.lighting = 'off';
      }
      emitStateChange();
    }

    // Слушатели событий кликов
    if (warmButton) {
      warmButton.addEventListener('click', function () {
        setLighting('warm');
        applyIntensityPreset(WARM_PRESET_INTENSITY);
      });
    }

    if (coolButton) {
      coolButton.addEventListener('click', function () {
        setLighting('cool');
        applyIntensityPreset(COOL_PRESET_INTENSITY);
      });
    }

    if (toggleButton) {
      toggleButton.addEventListener('click', function () {
        toggleLighting();
      });
    }

    if (rangeInput) {
      rangeInput.addEventListener('input', function (event) {
        state.intensity = Number(event.target.value);
        // Если крутят ползунок, а свет был выключен — включаем его в текущем режиме
        if (state.lighting === 'off') {
          state.lighting = state.lastEnabledMode;
        }
        emitStateChange();
      });
    }

    // Инициализируем UI при старте
    updateLightingUI();

    return {
      sync: function (nextState) {
        if (nextState && typeof nextState.lighting === 'string') {
          state.lighting = nextState.lighting;
          if (state.lighting !== 'off') {
            state.lastEnabledMode = state.lighting;
          }
        }
        if (nextState && typeof nextState.intensity === 'number') {
          state.intensity = nextState.intensity;
        }
        updateLightingUI();
      }
    };
  }

  global.ColorGlitchLighting = {
    init: initLighting
  };
})(window);
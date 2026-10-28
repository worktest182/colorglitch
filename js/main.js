// js/main.js
(function (global) {
  'use strict';

  var app = {
    wall: null,
    lighting: null,
    colorPicker: null,
    imagePalette: null,
    currentColor: '#AABBCC',
    lightingState: { lighting: 'warm', intensity: 4500 },
    segmentState: {},

    init: function () {
      console.log("ColorGlitch: Начинаю инициализацию...");

      this.initWall();
      this.initOrchestrator();
      this.initLighting();
      this.initColorPicker();
      this.initImagePalette();
      this.bindEvents();
      this.ensureSegmentState();
      this.applyGlobalLighting();

      console.log('ColorGlitch: Инициализация завершена.');
    },

    initWall: function () {
      if (global.ColorGlitchWall && typeof global.ColorGlitchWall.init === 'function') {
        this.wall = global.ColorGlitchWall.init({
          onSegmentChange: function (_, index) {
            console.log('Main: Выбран сегмент №' + index);
            app.syncCurrentColorWithActiveSegment();
          }
        });
      } else {
        console.error('ColorGlitch: ОШИБКА! Модуль ColorGlitchWall не загружен.');
      }
    },

    initOrchestrator: function () {
      if (!global.ColorGlitchOrchestrator || typeof global.ColorGlitchOrchestrator.init !== 'function') return;
      var result = global.ColorGlitchOrchestrator.init({
        colorScience: global.colorScience,
        harmony: global.ColorGlitchHarmony,
        lighting: global.ColorGlitchLighting
      });
      if (!result || !result.ok) {
        console.warn('Main: Orchestrator не инициализирован полностью.', result && result.errors);
      }
    },

    initLighting: function () {
      if (!global.ColorGlitchLighting || typeof global.ColorGlitchLighting.init !== 'function') return;
      this.lighting = global.ColorGlitchLighting.init({
        initialState: { lighting: 'warm', intensity: 4500 },
        onStateChange: function (nextState) {
          app.applyLighting(nextState);
        }
      });
    },

    initImagePalette: function () {
      if (!global.ColorGlitchImagePalette || typeof global.ColorGlitchImagePalette.init !== 'function') return;
      this.imagePalette = global.ColorGlitchImagePalette.init();
    },

initColorPicker: function () {
      if (!global.ColorGlitchColorPicker || typeof global.ColorGlitchColorPicker.init !== 'function') return;
      this.colorPicker = global.ColorGlitchColorPicker.init({
        initialColor: this.currentColor,
        onColorInput: function (hex) {
          app.currentColor = hex;
        },
        onApplyColor: function (hex) {
          var colorInput = document.getElementById('color-input');
          var rawInput = colorInput ? colorInput.value.trim() : hex;

          var activeSegment = app.wall ? app.wall.getActiveSegment() : null;
          if (activeSegment && rawInput) {
            // Запись оригинального ввода напрямую в DOM-атрибут
            activeSegment.setAttribute('data-original-id', rawInput);
          }

          app.currentColor = hex;
          app.applyColorToActiveSegment(hex);
          app.applyGlobalLighting();
          app.triggerGlitch();
        }
      });
    },

bindEvents: function () {
      var applyBtn = document.getElementById('applyColorButton');
      var colorInput = document.getElementById('color-input');
      
      if (applyBtn && colorInput) {
        applyBtn.addEventListener('click', function () {
          var rawInput = colorInput.value.trim();
          var activeSegment = app.wall ? app.wall.getActiveSegment() : null;
          if (activeSegment && rawInput) {
            // Записываем пользовательский ввод напрямую перед сбросом
            activeSegment.dataset.originalId = rawInput;
          }
        });
      }

      var lightIntensity = document.getElementById('lightIntensity');
      if (!lightIntensity) {
        console.warn('Main: Элемент #lightIntensity не найден (событие не назначено)');
      }
    },

    applyColorToActiveSegment: function (val) {
      if (!this.wall) return;
      this.ensureSegmentState();
      
      var activeIndex = this.wall.getActiveSegmentIndex();
      var activeSegment = this.getAllSegments()[activeIndex];
      if (!activeSegment) return;

      var colorInput = document.getElementById('color-input');
      var rawInput = colorInput ? colorInput.value.trim() : '';

      if (rawInput) {
        activeSegment.setAttribute('data-original-id', rawInput);
      } else if (!activeSegment.getAttribute('data-original-id')) {
        activeSegment.setAttribute('data-original-id', val);
      }
      
      var segmentId = activeSegment.getAttribute('data-segment') || String(activeIndex);
      if (this.segmentState[segmentId]) {
        this.segmentState[segmentId].baseHex = val;
        this.segmentState[segmentId].appliedHex = null;
        this.segmentState[segmentId].appliedMeta = null;
      }
    },

    getAllSegments: function () {
      return this.wall && typeof this.wall.getSegments === 'function' ? this.wall.getSegments() : [];
    },

    ensureSegmentState: function () {
      var segments = this.getAllSegments();
      for (var i = 0; i < segments.length; i += 1) {
        var segment = segments[i];
        var segmentId = segment.getAttribute('data-segment') || String(i);
        if (!this.segmentState[segmentId]) {
          this.segmentState[segmentId] = {
            id: segmentId,
            element: segment,
            baseHex: this.currentColor,
            appliedHex: null,
            appliedMeta: null
          };
        } else {
          this.segmentState[segmentId].element = segment;
          if (!this.segmentState[segmentId].baseHex) {
            this.segmentState[segmentId].baseHex = this.currentColor;
          }
        }
        this.attachSegmentHoverHandlers(segment);
      }
    },

attachSegmentHoverHandlers: function (segmentElement) {
      if (!segmentElement || segmentElement.dataset.hoverBound === 'true') return;
      segmentElement.dataset.hoverBound = 'true';

      segmentElement.addEventListener('mouseenter', function (e) {
        var id = e.currentTarget.getAttribute('data-segment') || '0';
        id = parseInt(id) + 1; // 1-based индекс

        var target = e.currentTarget;
        // Чтение сохраненного оригинального кода через getAttribute
        var code = target.getAttribute('data-original-id');
        
        var hex = e.currentTarget.style.backgroundColor || '#CCCCCC';
        if (app.segmentState[e.currentTarget.getAttribute('data-segment')]) {
          var stateItem = app.segmentState[e.currentTarget.getAttribute('data-segment')];
          hex = stateItem.appliedHex || stateItem.baseHex || hex;
        }

        var tooltip = document.getElementById('wallColorIndicator');
        if (tooltip) {
          tooltip.textContent = "Сегмент " + id + ": " + (code ? code : hex);
          tooltip.classList.remove('hidden');
        }
      });


      segmentElement.addEventListener('mouseleave', function () {
        var tooltip = document.getElementById('wallColorIndicator');
        if (tooltip) {
          tooltip.classList.add('hidden');
        }
      });
    },

    getActiveSegmentId: function () {
      if (!this.wall) return null;
      var active = this.wall.getActiveSegment();
      return active ? (active.getAttribute('data-segment') || String(this.wall.getActiveSegmentIndex())) : null;
    },

    setSegmentColor: function (segmentId, hex) {
      var segmentInfo = this.segmentState[segmentId];
      if (!segmentInfo || !segmentInfo.element) return;
      if (global.ColorGlitchSimulation && typeof global.ColorGlitchSimulation.renderToElement === 'function') {
        global.ColorGlitchSimulation.renderToElement(hex, { element: segmentInfo.element });
      }
      // Мгновенная перерисовка при прямои изменении цвета
      if (this.wall && typeof this.wall.render === 'function') {
        this.wall.render();
      }
    },

    updateSegmentMeta: function (segmentId, meta) {
      if (!this.segmentState[segmentId]) return;
      this.segmentState[segmentId].appliedMeta = meta || null;
    },

    setBaseColorForActiveSegment: function (hex) {
      if (!this.wall) return;
      this.ensureSegmentState();
      var activeIndex = this.wall.getActiveSegmentIndex();
      var activeSegment = this.getAllSegments()[activeIndex];
      if (!activeSegment) return;
      var segmentId = activeSegment.getAttribute('data-segment') || String(activeIndex);
      if (!this.segmentState[segmentId]) return;
      this.segmentState[segmentId].baseHex = hex;
      this.segmentState[segmentId].appliedHex = null;
      this.segmentState[segmentId].appliedMeta = null;
      activeSegment.removeAttribute('title');
      delete activeSegment.dataset.appliedColorName;
      delete activeSegment.dataset.appliedColorCatalog;
    },

    syncCurrentColorWithActiveSegment: function () {
      if (!this.wall) return;
      this.ensureSegmentState();
      var activeIndex = this.wall.getActiveSegmentIndex();
      var activeSegment = this.getAllSegments()[activeIndex];
      if (!activeSegment) return;
      var segmentId = activeSegment.getAttribute('data-segment') || String(activeIndex);
      var stateItem = this.segmentState[segmentId];
      if (stateItem && stateItem.baseHex) {
        this.currentColor = stateItem.baseHex;
      }
    },

    applyLighting: function (lightingState) {
      this.lightingState = {
        lighting: lightingState.lighting,
        intensity: lightingState.intensity
      };

      this.applyGlobalLighting();
    },

    applyGlobalLighting: function () {
      this.ensureSegmentState();

      var lightingMode = this.lightingState && this.lightingState.lighting ? this.lightingState.lighting : 'warm';
      var kelvin = this.lightingState && typeof this.lightingState.intensity === 'number' ? this.lightingState.intensity : 4500;
      var intensity = lightingMode === 'off' ? 0 : 1;
      var allSegments = this.getAllSegments();

      for (var i = 0; i < allSegments.length; i += 1) {
        var segment = allSegments[i];
        var segmentId = segment.getAttribute('data-segment') || String(i);
        var segmentInfo = this.segmentState[segmentId];
        var baseHex = segmentInfo && segmentInfo.appliedHex ? segmentInfo.appliedHex : (segmentInfo && segmentInfo.baseHex ? segmentInfo.baseHex : this.currentColor);
        var finalHex = baseHex;

        if (lightingMode !== 'off' && global.ColorGlitchSimulation && typeof global.ColorGlitchSimulation.simulate === 'function') {
          var sim = global.ColorGlitchSimulation.simulate(baseHex, { kelvin: kelvin, intensity: intensity });
          if (sim && sim.ok && sim.result && sim.result.simulatedHex) {
            finalHex = sim.result.simulatedHex;
          }
        }

        if (global.ColorGlitchSimulation && typeof global.ColorGlitchSimulation.renderToElement === 'function') {
          global.ColorGlitchSimulation.renderToElement(finalHex, { element: segment });
        }
      }

      // ⚡ Мгновенная перерисовка Canvas/схемы после применения цветов и света
      if (this.wall && typeof this.wall.render === 'function') {
        this.wall.render();
      }
    },

    triggerGlitch: function () {
      if (!this.wall) return;
      var activeEl = this.wall.getActiveSegment();
      if (!activeEl) return;

      if (global.ColorGlitchGlitchEffect && typeof global.ColorGlitchGlitchEffect.applyGlitch === 'function') {
        global.ColorGlitchGlitchEffect.applyGlitch(activeEl);
      }
    }
  };

  global.ColorGlitchState = {
    getActiveSegmentId: function () { return app.getActiveSegmentId(); },
    updateSegmentMeta: function (segmentId, meta) { app.updateSegmentMeta(segmentId, meta); }
  };

  global.ColorGlitchRenderer = {
    setSegmentColor: function (segmentId, hex) { app.setSegmentColor(segmentId, hex); }
  };

  global.ColorGlitchMain = app;
})(window);
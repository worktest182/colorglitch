(function attachWallModule(global) {
  'use strict';

  var state = {
    activeSegmentIndex: 0,
    hoveredSegmentIndex: null,
    segmentButtons: [],
    wallPanel: null,
    canvas: null,
    ctx: null,
    wallImage: null
  };

  function getCanvasCoordinates(e, canvas, image) {
    var rect = canvas.getBoundingClientRect();
    var canvasWidth = rect.width;
    var canvasHeight = rect.height;

    var imageRatio = image.naturalWidth / image.naturalHeight;
    var canvasRatio = canvasWidth / canvasHeight;

    var drawWidth, drawHeight;
    var offsetX = 0, offsetY = 0;

    if (canvasRatio > imageRatio) {
      drawWidth = canvasWidth;
      drawHeight = drawWidth / imageRatio;
      offsetY = (canvasHeight - drawHeight) / 2;
    } else {
      drawHeight = canvasHeight;
      drawWidth = drawHeight * imageRatio;
      offsetX = (canvasWidth - drawWidth) / 2;
    }

    var clientX = e.clientX - rect.left - offsetX;
    var clientY = e.clientY - rect.top - offsetY;

    var scaleX = image.naturalWidth / drawWidth;
    var scaleY = image.naturalHeight / drawHeight;

    var targetX = clientX * scaleX;
    var targetY = clientY * scaleY;

    return {
      x: targetX,
      y: targetY,
      inside: (targetX >= 0 && targetX <= image.naturalWidth && targetY >= 0 && targetY <= image.naturalHeight)
    };
  }

  function initWall(options) {
    var config = options || {};
    state.segmentButtons = Array.prototype.slice.call(
      document.querySelectorAll('.wall-segment')
    );
    var fullscreenButton = document.getElementById('fullscreenButton');
    state.wallPanel = document.querySelector('.wall-panel');
    state.canvas = document.getElementById('visualizerCanvas');

    if (state.segmentButtons.length === 0) {
      console.warn("ColorGlitchWall: Сегменты стены (.wall-segment) не найдены.");
      return null;
    }

    state.activeSegmentIndex = state.segmentButtons.findIndex(function (button) {
      return button.classList.contains('active');
    });

    if (state.activeSegmentIndex < 0) state.activeSegmentIndex = 0;

    initCanvasEngine();

    function updateSegmentState(index) {
      state.segmentButtons.forEach(function (button, buttonIndex) {
        var isActive = buttonIndex === index;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });

      state.activeSegmentIndex = index;

      if (typeof config.onSegmentChange === 'function') {
        config.onSegmentChange(state.segmentButtons[index], index);
      }

      renderWall();
    }

    if (state.canvas) {
      state.canvas.addEventListener('click', function (e) {
        if (!state.canvas || !state.wallImage) return;

        var coords = getCanvasCoordinates(e, state.canvas, state.wallImage);
        if (!coords.inside) return;

        var w = state.wallImage.naturalWidth;
        var h = state.wallImage.naturalHeight;
        var ceilingY = h * 0.065;
        var floorY = h * 0.838;
        var leftX = w * 0.118;
        var rightX = w * 1.000;

        if (coords.x >= leftX && coords.x <= rightX && coords.y >= ceilingY && coords.y <= floorY) {
          var wallWidth = rightX - leftX;
          var numSegments = state.segmentButtons.length || 4;
          var segmentWidth = wallWidth / numSegments;
          var clickedIndex = Math.floor((coords.x - leftX) / segmentWidth);

          if (clickedIndex >= 0 && clickedIndex < numSegments) {
            updateSegmentState(clickedIndex);
          }
        }
      });

      state.canvas.addEventListener('mousemove', function (e) {
        if (!state.canvas || !state.wallImage) return;

        var coords = getCanvasCoordinates(e, state.canvas, state.wallImage);
        var label = document.getElementById('wallColorIndicator');

        if (coords.inside) {
          var w = state.wallImage.naturalWidth;
          var h = state.wallImage.naturalHeight;
          var ceilingY = h * 0.065;
          var floorY = h * 0.838;
          var leftX = w * 0.118;
          var rightX = w * 1.000;

          if (coords.x >= leftX && coords.x <= rightX && coords.y >= ceilingY && coords.y <= floorY) {
            var wallWidth = rightX - leftX;
            var numSegments = state.segmentButtons.length || 4;
            var segmentWidth = wallWidth / numSegments;
            var hoveredIndex = Math.floor((coords.x - leftX) / segmentWidth);

            if (hoveredIndex >= 0 && hoveredIndex < numSegments) {
              if (state.hoveredSegmentIndex !== hoveredIndex) {
                state.hoveredSegmentIndex = hoveredIndex;
                renderWall();
              }

              var btn = state.segmentButtons[hoveredIndex];
              if (btn && label) {
                var segmentId = btn.getAttribute('data-segment') || String(hoveredIndex);
                var segmentNum = parseInt(segmentId) + 1;
                
                var colorLabel = btn.getAttribute('data-original-id');
                
                var hex = btn.style.backgroundColor || '#CCCCCC';
                if (global.ColorGlitchMain && global.ColorGlitchMain.segmentState && global.ColorGlitchMain.segmentState[segmentId]) {
                  hex = global.ColorGlitchMain.segmentState[segmentId].appliedHex || global.ColorGlitchMain.segmentState[segmentId].baseHex || hex;
                }

                label.textContent = "Сегмент " + segmentNum + ": " + (colorLabel ? colorLabel : hex);
                label.classList.remove('hidden');
              }
              return;
            }
          }
        }

        if (state.hoveredSegmentIndex !== null) {
          state.hoveredSegmentIndex = null;
          renderWall();
        }
        if (label) {
          label.classList.add('hidden');
        }
      });

      state.canvas.addEventListener('mouseleave', function () {
        state.hoveredSegmentIndex = null;
        renderWall();
        var label = document.getElementById('wallColorIndicator');
        if (label) {
          label.classList.add('hidden');
        }
      });
    }

    state.segmentButtons.forEach(function (button, index) {
      button.addEventListener('click', function () {
        updateSegmentState(index);
      });
    });

    function updateFullscreenButton(isFullscreen) {
      if (!fullscreenButton) return;
      fullscreenButton.setAttribute('aria-pressed', String(isFullscreen));
      fullscreenButton.setAttribute('aria-label', isFullscreen ? 'Свернуть' : 'Развернуть');
      fullscreenButton.textContent = isFullscreen ? '🗗' : '⛶';
    }

    function toggleFullscreen() {
      if (!state.wallPanel || !document.fullscreenEnabled) return;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        state.wallPanel.requestFullscreen();
      }
    }

    if (fullscreenButton) {
      fullscreenButton.addEventListener('click', toggleFullscreen);
    }

    document.addEventListener('fullscreenchange', function () {
      var isFullscreen = document.fullscreenElement === state.wallPanel;
      updateFullscreenButton(isFullscreen);
      if (typeof config.onFullscreenToggle === 'function') {
        config.onFullscreenToggle(isFullscreen, state.wallPanel);
      }
    });

    updateSegmentState(state.activeSegmentIndex);

    return {
      getActiveSegmentIndex: function () { return state.activeSegmentIndex; },
      getActiveSegment: function () { return state.segmentButtons[state.activeSegmentIndex] || null; },
      getSegments: function () { return state.segmentButtons.slice(); },
      setActiveSegment: function (index) {
        if (index >= 0 && index < state.segmentButtons.length) {
          updateSegmentState(index);
        }
      },
      render: renderWall
    };
  }

  function initCanvasEngine() {
    if (!state.canvas && state.wallPanel) {
      state.canvas = document.createElement('canvas');
      state.canvas.id = 'visualizerCanvas';
      state.wallPanel.appendChild(state.canvas);
    }
    if (state.canvas) {
      state.ctx = state.canvas.getContext('2d');
    }

    state.wallImage = new Image();
    state.wallImage.src = 'base_wall.png';

    state.wallImage.onload = function () {
      if (state.canvas) {
        state.canvas.width = state.wallImage.naturalWidth;
        state.canvas.height = state.wallImage.naturalHeight;
      }
      renderWall();
    };

    state.wallImage.onerror = function () {
      console.warn("base_wall.png не найден. Генерируется резервный интерактивный шаблон.");
      generateFallbackWall();
    };
  }

  function generateFallbackWall() {
    var fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 1200;
    fallbackCanvas.height = 800;
    var fCtx = fallbackCanvas.getContext('2d');

    fCtx.fillStyle = '#EBEBEB';
    fCtx.fillRect(0, 0, 1200, 52);

    fCtx.fillStyle = '#CCCCCC';
    fCtx.fillRect(0, 52, 1200, 618);

    var wallGlow = fCtx.createLinearGradient(0, 0, 142, 0);
    wallGlow.addColorStop(0, '#555555');
    wallGlow.addColorStop(1, '#CCCCCC');
    fCtx.fillStyle = wallGlow;
    fCtx.fillRect(0, 0, 142, 800);

    var floorGlow = fCtx.createLinearGradient(0, 670, 0, 800);
    floorGlow.addColorStop(0, '#8B8070');
    floorGlow.addColorStop(1, '#4A3E38');
    fCtx.fillStyle = floorGlow;
    fCtx.fillRect(0, 670, 1200, 130);

    var shadowGlow = fCtx.createLinearGradient(0, 52, 0, 120);
    shadowGlow.addColorStop(0, 'rgba(0,0,0,0.4)');
    shadowGlow.addColorStop(1, 'rgba(0,0,0,0)');
    fCtx.fillStyle = shadowGlow;
    fCtx.fillRect(142, 52, 1058, 68);

    state.wallImage.src = fallbackCanvas.toDataURL();
  }

  function renderWall() {
    var viewMode = 'schematic';
    if (global.ColorGlitchOrchestrator && typeof global.ColorGlitchOrchestrator.getViewMode === 'function') {
      viewMode = global.ColorGlitchOrchestrator.getViewMode();
    }

    var schematicContainer = document.querySelector('.wall-segments-container');

    if (viewMode === 'schematic') {
      if (state.canvas) state.canvas.style.display = 'none';
      if (schematicContainer) schematicContainer.style.display = 'flex';
    } else {
      if (schematicContainer) schematicContainer.style.display = 'none';
      if (state.canvas) {
        state.canvas.style.display = 'block';
        drawPhotoCanvas();
      }
    }
  }

  function drawPhotoCanvas() {
    if (!state.ctx || !state.wallImage || !state.wallImage.complete) return;

    var w = state.canvas.width;
    var h = state.canvas.height;

    state.ctx.clearRect(0, 0, w, h);
    state.ctx.globalCompositeOperation = 'source-over';
    state.ctx.drawImage(state.wallImage, 0, 0, w, h);

    var ceilingY = h * 0.065;
    var floorY = h * 0.838;
    var leftX = w * 0.118;
    var rightX = w * 1.000;
    var wallWidth = rightX - leftX;
    var wallHeight = floorY - ceilingY;

    state.ctx.save();
    state.ctx.beginPath();
    state.ctx.rect(leftX, ceilingY, wallWidth, wallHeight);
    state.ctx.clip();

    var numSegments = state.segmentButtons.length || 4;
    var segmentWidth = wallWidth / numSegments;

    for (var i = 0; i < numSegments; i++) {
      var btn = state.segmentButtons[i];
      var color = btn ? (btn.style.backgroundColor || '#CCCCCC') : '#CCCCCC';
      state.ctx.fillStyle = color;
      state.ctx.fillRect(leftX + i * segmentWidth, ceilingY, segmentWidth, wallHeight);
    }

    if (state.hoveredSegmentIndex !== null && state.hoveredSegmentIndex < numSegments) {
      state.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      state.ctx.fillRect(
        leftX + state.hoveredSegmentIndex * segmentWidth,
        ceilingY,
        segmentWidth,
        wallHeight
      );
    }

    if (state.activeSegmentIndex < numSegments) {
      state.ctx.lineWidth = 3;
      state.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      state.ctx.strokeRect(
        leftX + state.activeSegmentIndex * segmentWidth + 1.5,
        ceilingY + 1.5,
        segmentWidth - 3,
        wallHeight - 3
      );
    }

    state.ctx.restore();

    state.ctx.save();
    state.ctx.globalCompositeOperation = 'multiply';
    state.ctx.drawImage(state.wallImage, 0, 0, w, h);
    state.ctx.restore();
  }

  global.ColorGlitchWall = {
    init: initWall,
    render: renderWall
  };
})(window);
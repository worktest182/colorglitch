(function attachGlitchEffectModule(global) {
  'use strict';

  function applyGlitch(targetElement) {
    if (!targetElement || targetElement.dataset.glitchActive === 'true') {
      return;
    }

    targetElement.dataset.glitchActive = 'true';

    var originalTransition = targetElement.style.transition;
    var originalTransform = targetElement.style.transform;
    var originalFilter = targetElement.style.filter;

    targetElement.style.transition = 'transform 80ms linear, filter 80ms linear';

    var tick = 0;
    var maxTicks = 6;

    var intervalId = window.setInterval(function () {
      tick += 1;

      var shiftX = (Math.random() - 0.5) * 6;
      var shiftY = (Math.random() - 0.5) * 4;
      var hue = (Math.random() - 0.5) * 12;

      targetElement.style.transform = 'translate(' + shiftX.toFixed(1) + 'px,' + shiftY.toFixed(1) + 'px)';
      targetElement.style.filter = 'hue-rotate(' + hue.toFixed(1) + 'deg) saturate(1.08)';

      if (tick >= maxTicks) {
        window.clearInterval(intervalId);
        targetElement.style.transform = originalTransform;
        targetElement.style.filter = originalFilter;
        targetElement.style.transition = originalTransition;
        delete targetElement.dataset.glitchActive;
      }
    }, 70);
  }

  function initGlitchEffect() {
    return {
      applyGlitch: applyGlitch
    };
  }

  global.ColorGlitchGlitchEffect = {
    init: initGlitchEffect,
    applyGlitch: applyGlitch
  };
})(window);

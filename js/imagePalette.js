// imagePalette.js
(function attachImagePaletteModule(global) {
  'use strict';

  var CANVAS_SIZE = 40;
  var MAX_COLORS = 5;
  var MIN_COLORS = 2;
  var DARK_LUMA_LIMIT = 34;
  var LIGHT_LUMA_LIMIT = 244;
  var MIN_USABLE_LIGHTNESS = 0.30;
  var MIDTONE_LIGHTNESS_MIN = 0.35;
  var MIDTONE_LIGHTNESS_MAX = 0.70;
  var MIN_COLOR_MIDTONE_SATURATION = 0.12;
  var MIN_NEUTRAL_MIDTONE_SATURATION = 0.04;

  var MIN_ALPHA = 200;
  var MIN_BUCKET_SHARE = 0.018;
  var MIN_SECONDARY_BUCKET_SHARE = 0.009;
  var DISTINCT_HUE_GAP = 16;
  var DISTINCT_RGB_DISTANCE = 34;
  var SWATCH_HUE_STEP = 10;
  var SWATCH_SATURATION_STEP = 0.08;
  var SWATCH_LIGHTNESS_STEP = 0.08;


  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }


  function componentToHex(value) {
    var hex = clamp(Math.round(value), 0, 255).toString(16).toUpperCase();
    return hex.length === 1 ? '0' + hex : hex;
  }

  function rgbToHex(r, g, b) {
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
  }

  function getLuma(r, g, b) {
    return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
  }

  function getDistance(a, b) {
    var dr = a.r - b.r;
    var dg = a.g - b.g;
    var db = a.b - b.b;
    return Math.sqrt((dr * dr) + (dg * dg) + (db * db));
  }

  function getHueDistance(a, b) {
    var distance = Math.abs(a - b) % 360;
    return Math.min(distance, 360 - distance);
  }

  function rgbToHsl(r, g, b) {
    var red = r / 255;
    var green = g / 255;
    var blue = b / 255;
    var max = Math.max(red, green, blue);
    var min = Math.min(red, green, blue);
    var delta = max - min;
    var hue = 0;
    var saturation = 0;
    var lightness = (max + min) / 2;

    if (delta !== 0) {
      saturation = delta / (1 - Math.abs((2 * lightness) - 1));


      if (max === red) {
        hue = 60 * (((green - blue) / delta) % 6);
      } else if (max === green) {
        hue = 60 * (((blue - red) / delta) + 2);
      } else {
        hue = 60 * (((red - green) / delta) + 4);
      }
    }

    if (hue < 0) hue += 360;

    return {
      h: hue,
      s: saturation,
      l: lightness
    };
  }

  function isTooDark(r, g, b, luma, hsl) {
    return luma < DARK_LUMA_LIMIT || hsl.l < MIN_USABLE_LIGHTNESS || Math.max(r, g, b) < 36;
  }

  function isTooBright(r, g, b, luma, hsl) {
    var darkestChannel = Math.min(r, g, b);
    var brightestChannel = Math.max(r, g, b);
    var channelSpread = brightestChannel - darkestChannel;

    return luma > LIGHT_LUMA_LIMIT || hsl.l > 0.94 ||
      (darkestChannel > 232 && channelSpread < 20);

  }

  function isUsableInteriorColor(r, g, b, alpha, hsl) {
    if (alpha < MIN_ALPHA) return false;

    var luma = getLuma(r, g, b);
    return !isTooDark(r, g, b, luma, hsl) && !isTooBright(r, g, b, luma, hsl);
  }

  function getHueBucket(sample) {
    var h = sample.h;
    var s = sample.s;
    var l = sample.l;
    var warmBias = (sample.r - sample.b) / 255;

    // Low-saturation interiors still carry design information: beige sheets,
    // greige walls, and gray shadows should not all collapse into one brown blob.
    if (s < 0.12) {
      if (warmBias > 0.08 || (h >= 32 && h < 82)) return 'warm-neutrals';
      return 'grays';
    }

    if (h >= 72 && h < 168) return 'greens';
    if (h >= 168 && h < 205) return 'cyans';
    if (h >= 205 && h < 260) return 'blues';
    if (h >= 260 && h < 322) return 'violets';
    if (h >= 322 && h < 350) return 'roses';
    if (h >= 350 || h < 15) return 'reds-browns';

    // Split orange-brown woods from lighter yellow/beige textiles.
    if (h >= 15 && h < 45 && l < 0.68) return 'woods';
    if (h >= 15 && h < 82) return 'yellows-beiges';

    return 'earth-tones';

  }

  function getSwatchKey(sample) {
    var hue = Math.round(sample.h / SWATCH_HUE_STEP) * SWATCH_HUE_STEP;
    var saturation = Math.round(sample.s / SWATCH_SATURATION_STEP) * SWATCH_SATURATION_STEP;
    var lightness = Math.round(sample.l / SWATCH_LIGHTNESS_STEP) * SWATCH_LIGHTNESS_STEP;


    return [hue % 360, saturation.toFixed(2), lightness.toFixed(2)].join('|');
  }


  function createBucket(name) {
    return {
      name: name,
      count: 0,
      swatches: {}
    };
  }

  function addSampleToSwatch(bucket, sample) {
    var key = getSwatchKey(sample);
    var swatch = bucket.swatches[key];

    if (!swatch) {
      swatch = bucket.swatches[key] = {
        count: 0,
        r: 0,
        g: 0,
        b: 0,
        hX: 0,
        hY: 0,
        s: 0,
        l: 0,
        luma: 0
      };
    }


    swatch.count += 1;
    swatch.r += sample.r;
    swatch.g += sample.g;
    swatch.b += sample.b;
    swatch.hX += Math.cos(sample.h * Math.PI / 180);
    swatch.hY += Math.sin(sample.h * Math.PI / 180);
    swatch.s += sample.s;
    swatch.l += sample.l;
    swatch.luma += sample.luma;

  }

  function extractPixels(data) {
    var pixels = [];

    for (var i = 0; i < data.length; i += 4) {
      var r = data[i];
      var g = data[i + 1];
      var b = data[i + 2];
      var alpha = data[i + 3];
      var hsl = rgbToHsl(r, g, b);

      if (isUsableInteriorColor(r, g, b, alpha, hsl)) {
        pixels.push({
          r: r,
          g: g,
          b: b,
          h: hsl.h,
          s: hsl.s,
          l: hsl.l,
          luma: getLuma(r, g, b)
        });
      }
    }

    return pixels;
  }

  function buildHueBuckets(pixels) {
    var buckets = {};

    pixels.forEach(function (sample) {
      var name = getHueBucket(sample);
      if (!buckets[name]) buckets[name] = createBucket(name);
      buckets[name].count += 1;
      addSampleToSwatch(buckets[name], sample);
    });

    return Object.keys(buckets).map(function (key) {
      return buckets[key];
    });
  }

  function normalizeSwatch(swatch) {
    var count = Math.max(1, swatch.count);
    var hue = Math.atan2(swatch.hY / count, swatch.hX / count) * 180 / Math.PI;
    if (hue < 0) hue += 360;

    return {
      count: swatch.count,
      r: swatch.r / count,
      g: swatch.g / count,
      b: swatch.b / count,
      h: hue,
      s: swatch.s / count,
      l: swatch.l / count,
      luma: swatch.luma / count
    };
  }

  function getMidtoneScore(lightness) {
    return 1 - clamp(Math.abs(lightness - 0.52) / 0.45, 0, 0.72);
  }

  function getMidtoneSaturationFloor(bucketName) {
    if (bucketName === 'grays') return 0;
    if (bucketName === 'warm-neutrals') return MIN_NEUTRAL_MIDTONE_SATURATION;
    return MIN_COLOR_MIDTONE_SATURATION;
  }

  function isGoodMidtoneSwatch(swatch, bucketName) {
    return swatch.l >= MIDTONE_LIGHTNESS_MIN &&
      swatch.l <= MIDTONE_LIGHTNESS_MAX &&
      swatch.s >= getMidtoneSaturationFloor(bucketName);
  }

  function getLeaderScore(swatch) {
    return swatch.count * (1 + (swatch.s * 1.9)) * getMidtoneScore(swatch.l);
  }


  function getBucketLeader(bucket) {
    var swatches = Object.keys(bucket.swatches).map(function (key) {
      return normalizeSwatch(bucket.swatches[key]);
    });

    if (!swatches.length) return null;


    var candidateSwatches = swatches.filter(function (swatch) {
      return isGoodMidtoneSwatch(swatch, bucket.name);

    });

    // Prefer a clean, illuminated interior mid-tone over the raw modal swatch.
    // If a bucket has no ideal candidate, fall back to all already shadow-filtered
    // swatches so very neutral/low-color photos can still produce a palette.
    if (!candidateSwatches.length) candidateSwatches = swatches;

    candidateSwatches.sort(function (a, b) {
      return getLeaderScore(b) - getLeaderScore(a);
    });


    var leader = candidateSwatches[0];
    leader.bucketName = bucket.name;
    leader.bucketCount = bucket.count;
    return leader;
  }

  function isDistinctColor(candidate, palette) {
    for (var i = 0; i < palette.length; i += 1) {
      var existing = palette[i];
      var hueGap = getHueDistance(candidate.h, existing.h);
      var rgbGap = getDistance(candidate, existing);
      var differentNeutralGroup = candidate.bucketName !== existing.bucketName &&
        (candidate.bucketName === 'warm-neutrals' || candidate.bucketName === 'grays' ||
          existing.bucketName === 'warm-neutrals' || existing.bucketName === 'grays');

      if (!differentNeutralGroup && hueGap < DISTINCT_HUE_GAP && rgbGap < DISTINCT_RGB_DISTANCE) {
        return false;
      }

      if (rgbGap < 24) return false;
    }

 
    return true;
  }

  function bucketsToPalette(buckets, totalPixels) {
    var minimumShare = totalPixels * MIN_BUCKET_SHARE;
    var fallbackShare = totalPixels * MIN_SECONDARY_BUCKET_SHARE;
    var leaders = [];

    buckets.forEach(function (bucket) {
      var leader = getBucketLeader(bucket);
      if (!leader) return;
      if (bucket.count < fallbackShare) return;

      leader.dominance = bucket.count / totalPixels;
      leader.score = bucket.count * (1 + (leader.s * 0.9)) * getMidtoneScore(leader.l);
      leaders.push(leader);
    });

    leaders.sort(function (a, b) {
      var aSignificant = a.bucketCount >= minimumShare ? 1 : 0;
      var bSignificant = b.bucketCount >= minimumShare ? 1 : 0;
      if (aSignificant !== bSignificant) return bSignificant - aSignificant;
      return b.score - a.score;
    });

    var palette = [];
    leaders.forEach(function (leader) {
      if (palette.length >= MAX_COLORS) return;
      if (leader.bucketCount < minimumShare && palette.length >= MIN_COLORS) return;
      if (!isDistinctColor(leader, palette)) return;
      palette.push(leader);
    });

    if (palette.length < MIN_COLORS) {
      leaders.forEach(function (leader) {
        if (palette.length >= MIN_COLORS) return;
        if (!isDistinctColor(leader, palette)) return;
        palette.push(leader);
      });
    }

    return palette
      .sort(function (a, b) { return b.dominance - a.dominance; })
      .map(function (color) { return rgbToHex(color.r, color.g, color.b); });


  }

  // Draw to a 40x40 offscreen canvas. This is high enough to preserve separate
  // wall/textile/wood regions, but still cheap to process on every uploaded image.

  function extractPaletteFromImage(image) {
    var canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

    var data = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
    var pixels = extractPixels(data);
    if (!pixels.length) return [];

    return bucketsToPalette(buildHueBuckets(pixels), pixels.length);
  }

  // Use the existing recommendation entry point, supporting both legacy and namespaced globals.
  function callGenerateVariations(hex) {
    if (typeof global.generateVariations === 'function') {
      global.generateVariations(hex);
      return;
    }

    if (global.ColorGlitchHarmony && typeof global.ColorGlitchHarmony.generateVariations === 'function') {
      global.ColorGlitchHarmony.generateVariations(hex);
    }
  }

  function activateColor(hex, activeHexValue, mainColorBar) {
    activeHexValue.textContent = hex;

    Array.prototype.forEach.call(mainColorBar.querySelectorAll('.color-segment'), function (segment) {
      segment.classList.toggle('active', segment.dataset.hex === hex);
      segment.setAttribute('aria-pressed', segment.dataset.hex === hex ? 'true' : 'false');
    });

    if (global.ColorGlitchColorPicker && typeof global.ColorGlitchColorPicker.updateColorFromOutside === 'function') {
      global.ColorGlitchColorPicker.updateColorFromOutside(hex);
    }

    callGenerateVariations(hex);
  }

  // Render a flexible bar where every extracted color receives equal space.
  function renderPalette(colors, elements) {
    elements.mainColorBar.innerHTML = '';
    if (!colors.length) return;

    colors.forEach(function (hex) {
      var segment = document.createElement('button');
      segment.type = 'button';
      segment.className = 'color-segment';
      segment.dataset.hex = hex;
      segment.style.backgroundColor = hex;
      segment.setAttribute('aria-label', 'Выбрать цвет ' + hex);
      segment.setAttribute('aria-pressed', 'false');

      segment.addEventListener('click', function () {
        activateColor(hex, elements.activeHexValue, elements.mainColorBar);
      });

      elements.mainColorBar.appendChild(segment);
    });

    activateColor(colors[0], elements.activeHexValue, elements.mainColorBar);
  }

  // Shared handler for both file input and drag-and-drop uploads.
  function handleFile(file, elements) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) return;

    var image = new Image();
    var objectUrl = URL.createObjectURL(file);

    image.alt = 'Загруженное интерьерное фото';
    image.className = 'image-preview-photo';

    image.addEventListener('load', function () {
      URL.revokeObjectURL(objectUrl);
      var colors = extractPaletteFromImage(image);
      renderPalette(colors, elements);
    }, { once: true });

    image.addEventListener('error', function () {
      URL.revokeObjectURL(objectUrl);
    }, { once: true });

    image.src = objectUrl;
    elements.imagePreview.innerHTML = '';
    elements.imagePreview.appendChild(image);
  }

  function init() {
    var imageInput = document.getElementById('imageInput');
    var imagePreview = document.getElementById('imagePreview');
    var mainColorBar = document.getElementById('mainColorBar');
    var activeHexValue = document.getElementById('activeHexValue');
    var dropzone = document.getElementById('colorDropzone');

    if (!imageInput || !imagePreview || !mainColorBar || !activeHexValue || !dropzone) return null;

    var elements = {
      imageInput: imageInput,
      imagePreview: imagePreview,
      mainColorBar: mainColorBar,
      activeHexValue: activeHexValue,
      dropzone: dropzone
    };

    imageInput.addEventListener('change', function (event) {
      handleFile(event.target.files && event.target.files[0], elements);
    });

    ['dragenter', 'dragover'].forEach(function (eventName) {
      dropzone.addEventListener(eventName, function (event) {
        event.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(function (eventName) {
      dropzone.addEventListener(eventName, function (event) {
        event.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', function (event) {
      var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file) return;
      handleFile(file, elements);
    });

    return {
      extractPaletteFromImage: extractPaletteFromImage,
      renderPalette: function (colors) { renderPalette(colors, elements); }
    };
  }

  global.ColorGlitchImagePalette = {
    init: init,
    extractPaletteFromImage: extractPaletteFromImage
  };
})(window);

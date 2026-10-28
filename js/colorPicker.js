(function attachColorPickerModule(global) {
 'use strict';

 // --- СЛУЖЕБНЫЕ ФУНКЦИИ ---
 function normalizeHex(value) {
 if (!value) return null;
 var clean = value.trim().replace('#', '');
 /^[\da-f]{3}$/i.test(clean) && (clean = clean.split('').map(function (c) { return c + c; }).join(''));
 if (!/^[\da-f]{6}$/i.test(clean)) return null;
 return '#' + clean.toUpperCase();
 }

 function normalizeCatalogCode(v) {
 return v ? v.trim().toUpperCase() : '';
 }

 function normalizeToken(v) {
 var n = normalizeCatalogCode(v);
 return n ? n.replace(/[\s_-]+/g, '') : '';
 }

 function rgbToHex(r, g, b) {
 return '#' + [r, g, b].map(function (x) {
 var hex = parseInt(x, 10).toString(16);
 return hex.length === 1 ? '0' + hex : hex;
 }).join('').toUpperCase();
 }

 function parseRgbString(value) {
 if (!value) return null;
 var match = value.match(/(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
 if (!match) return null;
 var r = Math.min(255, parseInt(match[1], 10));
 var g = Math.min(255, parseInt(match[2], 10));
 var b = Math.min(255, parseInt(match[3], 10));
 return rgbToHex(r, g, b);
 }

 function hexToRgb(hex) {
 var clean = hex.replace('#', '');
 if (clean.length !== 6) return null;
 var num = parseInt(clean, 16);
 return {
 r: (num >> 16) & 255,
 g: (num >> 8) & 255,
 b: num & 255
 };
 }

 function createCatalogIndex(items) {
 var index = {};
 var byHex = {};
 if (!Array.isArray(items)) return { byId: index, byHex: byHex };
 items.forEach(function (item) {
 if (!item || !item.id || !item.hex) return;
 var hex = normalizeHex(item.hex);
 if (!hex) return;

 var cleanId = item.original_id || item.id.replace(/^dufa_vision_2\.0_/i, '');
 var catalogName = item.source || 'Catalog';
 if (catalogName.toLowerCase().indexOf('dufa') !== -1) {
 catalogName = 'Dufa Vision 2.0';
 }

 var colorObj = { 
 id: cleanId, 
 original_id: cleanId, 
 name: item.name || '', 
 catalog: catalogName, 
 hex: hex 
 };

 index[normalizeCatalogCode(cleanId)] = colorObj;
 index[normalizeCatalogCode(item.id)] = colorObj;
 if (item.original_id) index[normalizeCatalogCode(item.original_id)] = colorObj;
 if (item.name) index[normalizeCatalogCode(item.name)] = colorObj;
 if (!byHex[hex]) byHex[hex] = colorObj;
 });
 return { byId: index, byHex: byHex };
 }

 // --- ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА ---
 function initColorPicker(config) {
 config = config || {};

 var input = document.getElementById('color-input');
 var applyButton = document.getElementById('applyColorButton');
 
 var recommendationsButton = document.getElementById('recommendationsButton');
 var recommendationsArea = document.getElementById('recommendationsArea');
 var monoList = document.getElementById('mono-list');
 var harmonyList = document.getElementById('harmony-list');
 var contrastList = document.getElementById('contrast-list');

 if (!input || !applyButton) {
 return null;
 }

 var state = {
 catalogById: {},
 catalogByHex: {},
 colorScienceReady: false,
 currentColor: {
 id: '',
 original_id: '',
 name: '',
 catalog: '',
 hex: normalizeHex(config.initialColor || input.value) || '#AABBCC'
 }
 };

 // Слушаем внешнее событие смены сегмента
 global.addEventListener('colorGlitchSegmentChanged', function(e) {
 if (e && e.detail && e.detail.hex) {
 global.ColorGlitchColorPicker.updateColorFromOutside(e.detail.hex);
 }
 });

 global.ColorGlitchColorPicker.updateColorFromOutside = function (hex) {
 var v = normalizeHex(hex);
 if (v) {
 var known = state.catalogByHex[v] || findClosestColorInCatalog(v);
 var next = known ? known : { id: v, original_id: v, name: '', catalog: '', hex: v };
 
 input.value = next.original_id || next.hex;
 setColor(next);
 }
 };

 input.value = state.currentColor.hex;

 function findClosestColorInCatalog(targetHex) {
 var targetRgb = hexToRgb(targetHex);
 if (!targetRgb || !state.catalogByHex) return null;

 var minDistance = Infinity;
 var closestColor = null;

 Object.keys(state.catalogByHex).forEach(function (hexKey) {
 var catalogColor = state.catalogByHex[hexKey];
 var catRgb = hexToRgb(hexKey);
 if (!catRgb) return;

 var dist = Math.sqrt(
 Math.pow(targetRgb.r - catRgb.r, 2) +
 Math.pow(targetRgb.g - catRgb.g, 2) +
 Math.pow(targetRgb.b - catRgb.b, 2)
 );

 if (dist < minDistance) {
 minDistance = dist;
 closestColor = catalogColor;
 }
 });

 return closestColor;
 }

 function resolve(value) {
 if (!value) return null;
 var trimmed = value.trim();

 // 1. Проверяем RGB или HEX ввод
 var rgbHex = parseRgbString(trimmed);
 var targetHex = rgbHex ? normalizeHex(rgbHex) : normalizeHex(trimmed);

 if (targetHex) {
 if (state.catalogByHex[targetHex]) {
 return state.catalogByHex[targetHex];
 }
 var closest = findClosestColorInCatalog(targetHex);
 if (closest) {
 return closest;
 }
 return { id: targetHex, original_id: targetHex, name: '', catalog: '', hex: targetHex };
 }

 // 2. Поиск по коду каталога
 var code = normalizeCatalogCode(trimmed);
 if (state.catalogById[code]) return state.catalogById[code];
 return state.catalogById[normalizeToken(trimmed)] || null;
 }

 function applyColorUI(hex) {
 if (applyButton) {
 applyButton.style.backgroundColor = hex;
 }
 }

 function ensureColorScienceReady() {
 if (state.colorScienceReady) return Promise.resolve(true);
 if (!global.colorScience || typeof global.colorScience.init !== 'function') return Promise.resolve(false);

 return global.colorScience
 .init({ catalogPath: 'data/final_catalog.json', cacheLab: true })
 .then(function () {
 state.colorScienceReady = true;
 return true;
 })
 .catch(function () {
 return false;
 });
 }

 function loadCatalog() {
 if (typeof fetch !== 'function') return Promise.resolve();
 return fetch('data/final_catalog.json')
 .then(function (r) { return r.json(); })
 .then(function (data) {
 var catalogIndex = createCatalogIndex(data);
 state.catalogById = catalogIndex.byId;
 state.catalogByHex = catalogIndex.byHex;
 })
 .catch(function () {
 state.catalogById = {};
 });
 }

 function setColor(colorObj) {
 state.currentColor = { 
 id: colorObj.original_id || colorObj.id || colorObj.hex, 
 original_id: colorObj.original_id || colorObj.id || colorObj.hex, 
 name: colorObj.name || '', 
 catalog: colorObj.catalog || '', 
 hex: colorObj.hex 
 };
 applyColorUI(state.currentColor.hex);
 if (config.onColorInput) config.onColorInput(state.currentColor.hex);
 }

 function validate() {
 var resolved = resolve(input.value);
 if (!resolved) {
 input.setAttribute('aria-invalid', 'true');
 return false;
 }
 input.setAttribute('aria-invalid', 'false');
 setColor(resolved);
 input.value = state.currentColor.original_id || state.currentColor.hex;
 return true;
 }

 function renderRecommendationList(container, items) {
 if (!container) return;
 container.innerHTML = '';
 (items || []).forEach(function (item) {
 var cleanId = item.original_id || (item.id ? item.id.replace(/^dufa_vision_2\.0_/i, '') : '');
 var catalogName = item.catalog || item.source || 'Catalog';
 if (catalogName.toLowerCase().indexOf('dufa') !== -1) {
 catalogName = 'Dufa Vision 2.0';
 }

 var swatchButton = document.createElement('button');
 swatchButton.type = 'button';
 swatchButton.className = 'color-swatch';
 swatchButton.title = [cleanId, item.name || ''].filter(Boolean).join(' — ');

 var fill = document.createElement('span');
 fill.className = 'color-swatch-fill';
 fill.style.backgroundColor = item.hex || '#000000';

 var code = document.createElement('span');
 code.className = 'color-swatch-code';
 code.textContent = cleanId || item.hex || '';

 swatchButton.appendChild(fill);
 swatchButton.appendChild(code);

 if (item.name) {
 var name = document.createElement('span');
 name.className = 'color-swatch-name';
 name.textContent = item.name;
 swatchButton.appendChild(name);
 }

 swatchButton.addEventListener('click', function () {
 var nextHex = normalizeHex(item.hex);
 if (!nextHex) return;
 var activeSegmentId = global.ColorGlitchState && typeof global.ColorGlitchState.getActiveSegmentId === 'function'
 ? global.ColorGlitchState.getActiveSegmentId()
 : null;
 if (!activeSegmentId) return;

 if (global.ColorGlitchMain && global.ColorGlitchMain.segmentState && global.ColorGlitchMain.segmentState[activeSegmentId]) {
 global.ColorGlitchMain.segmentState[activeSegmentId].appliedHex = nextHex;
 }

 if (global.ColorGlitchRenderer && typeof global.ColorGlitchRenderer.setSegmentColor === 'function') {
 global.ColorGlitchRenderer.setSegmentColor(activeSegmentId, nextHex);
 }

 var segmentElement = document.querySelector('.wall-segment[data-segment="' + activeSegmentId + '"]') || document.getElementById(activeSegmentId);

 if (segmentElement) {
 segmentElement.dataset.appliedColorId = cleanId;
 segmentElement.dataset.appliedColorName = item.name || '';
 segmentElement.dataset.appliedColorCatalog = catalogName;
 segmentElement.dataset.appliedColorHex = nextHex;

 segmentElement.setAttribute('title', cleanId + (item.name ? ' ' + item.name : '') + ' [' + catalogName + ']');
 }

 if (global.ColorGlitchState && typeof global.ColorGlitchState.updateSegmentMeta === 'function') {
 global.ColorGlitchState.updateSegmentMeta(activeSegmentId, { 
 id: cleanId, 
 original_id: cleanId, 
 name: item.name || '', 
 catalog: catalogName, 
 hex: nextHex 
 });
 }

 if (global.ColorGlitchMain && typeof global.ColorGlitchMain.applyGlobalLighting === 'function') {
 global.ColorGlitchMain.applyGlobalLighting();
 }
 if (global.ColorGlitchMain && typeof global.ColorGlitchMain.triggerGlitch === 'function') {
 global.ColorGlitchMain.triggerGlitch();
 }
 });

 container.appendChild(swatchButton);
 });
 }

 function handleHarmonyGenerated(event) {
 var detail = event && event.detail ? event.detail : {};
 renderRecommendationList(monoList, detail.monochrome);
 renderRecommendationList(harmonyList, detail.harmony);
 renderRecommendationList(contrastList, detail.contrast);
 if (recommendationsArea) recommendationsArea.classList.remove('hidden');
 if (recommendationsButton) {
 recommendationsButton.setAttribute('aria-expanded', 'true');
 recommendationsButton.textContent = 'Скрыть';
 }
 }

 function triggerRecommendations() {
 if (!validate()) return;
 
 if (global.ColorGlitchHarmony && typeof global.ColorGlitchHarmony.generateVariations === 'function') {
 ensureColorScienceReady().then(function() {
 global.ColorGlitchHarmony.generateVariations(state.currentColor.hex);
 });
 }
 }

 applyButton.addEventListener('click', function () {
 var isValid = validate();
 if (!isValid) return;

 if (config.onApplyColor) {
 config.onApplyColor(state.currentColor.hex);
 }
 });

 input.addEventListener('input', function () {
 var v = resolve(input.value);
 if (v) setColor(v);
 });

 if (recommendationsButton) {
 recommendationsButton.addEventListener('click', function () {
 var isExpanded = recommendationsButton.getAttribute('aria-expanded') === 'true';
 if (isExpanded && recommendationsArea) {
 recommendationsArea.classList.add('hidden');
 recommendationsButton.setAttribute('aria-expanded', 'false');
 recommendationsButton.textContent = 'Показать';
 return;
 }
 triggerRecommendations();
 });
 }
 window.addEventListener('colorGlitchHarmonyGenerated', handleHarmonyGenerated);

 loadCatalog().then(ensureColorScienceReady);

 return {
 getColor: function () { return state.currentColor; },
 setExternalColor: function (displayCode, hex) {
 var validHex = normalizeHex(hex) || '#AABBCC';
 state.currentColor = {
 id: displayCode,
 original_id: displayCode,
 name: '',
 catalog: '',
 hex: validHex
 };
 applyColorUI(validHex);
 if (input) {
 input.value = displayCode;
 }
 },
 updateColorFromOutside: function (hex) {
 global.ColorGlitchColorPicker.updateColorFromOutside(hex);
 }
 };
 }

 global.ColorGlitchColorPicker = {
 init: initColorPicker,
 normalizeHex: normalizeHex
 };

})(window);
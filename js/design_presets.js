function renderDesignPresets(containerSelector) {
  var container = document.querySelector(containerSelector);
  if (!container || !window.DESIGN_PRESETS) return;

  container.innerHTML = '';

  DESIGN_PRESETS.forEach(function(preset) {
    // Предварительно прогоняем пресет через каталог
    var matched = ColorMatcher.mapPresetToCatalog(preset, window.catalog || []);

    var card = document.createElement('div');
    card.className = 'preset-card';
    card.dataset.presetId = preset.id;

    // Генерируем плашки с цветами для превью
    var swatchesHtml = matched.segments.map(function(seg) {
      return '<div class="preset-swatch" style="background-color: ' + seg.hex + ';" title="' + seg.originalId + '"></div>';
    }).join('');

    card.innerHTML = 
      '<div class="preset-title">' + preset.title + '</div>' +
      '<div class="preset-category">' + preset.category + '</div>' +
      '<div class="preset-swatches">' + swatchesHtml + '</div>';

    // Навешиваем клик для применения пресета на стену
    card.addEventListener('click', function() {
      applyPresetToRoom(matched);
    });

    container.appendChild(card);
  });
}

function applyPresetToRoom(matchedPreset) {
  matchedPreset.segments.forEach(function(seg, index) {
    var segNum = index + 1;
    // Используем правильный атрибут data-segment
    var segmentEl = document.querySelector('[data-segment="' + segNum + '"]');
    
    if (segmentEl) {
      segmentEl.setAttribute('data-original-id', seg.originalId);
      segmentEl.setAttribute('data-hex', seg.hex);
    }
  });

  // Отправляем событие в главный движок
  var event = new CustomEvent('preset:applied', {
    detail: {
      presetId: matchedPreset.id,
      title: matchedPreset.title,
      lighting: matchedPreset.lighting,
      segments: matchedPreset.segments
    },
    bubbles: true
  });

  document.dispatchEvent(event);
  console.log('Событие preset:applied отправлено:', matchedPreset);
}

window.DESIGN_PRESETS = [
  {
    id: "japandi_01",
    title: "Japandi Balance",
    category: "Гостиная",
    lighting: 3000,
    // 4 базовых дизайнерских оттенка для сегментов 1-4
    hexes: ["#E8E3D9", "#D0C8B8", "#A39B8B", "#3C3835"] 
  },
  {
    id: "loft_01",
    title: "Industrial Loft",
    category: "Кабинет",
    lighting: 4000,
    hexes: ["#D5D5D5", "#8D99AE", "#2B2D42", "#B55A30"]
  },
  {
    id: "scandi_01",
    title: "Scandi Nature",
    category: "Спальня",
    lighting: 3500,
    hexes: ["#F7F4EF", "#E2D7C5", "#8F9E8B", "#4A5859"]
  }
];


// Автоматический запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', function () {
  var container = document.querySelector('.presets-container');
  if (!container) return;

  // Если каталог уже успел загрузиться в window.catalog
  if (window.catalog && window.catalog.length) {
    renderDesignPresets('.presets-container');
  } else {
    // Если еще нет — подгружаем сами и рендерим карточки
    fetch('data/final_catalog.json')
      .then(function (res) { return res.json(); })
      .then(function (catalog) {
        window.catalog = catalog;
        renderDesignPresets('.presets-container');
      })
      .catch(function (err) {
        console.error('Ошибка загрузки каталога для пресетов:', err);
      });
  }
});
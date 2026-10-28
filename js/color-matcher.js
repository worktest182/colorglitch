window.ColorMatcher = {
  // 1. Конвертация HEX в RGB
  hexToRgb: function (hex) {
    var cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(function (c) { return c + c; }).join('');
    }
    var num = parseInt(cleanHex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  },

  // 2. Поиск ближайшей краски из реального каталога по HEX
  findClosest: function (targetHex, catalog) {
    if (!catalog || !catalog.length) return null;
    var targetRgb = this.hexToRgb(targetHex);
    var closest = null;
    var minDistance = Infinity;

    for (var i = 0; i < catalog.length; i++) {
      var item = catalog[i];
      if (!item.hex) continue;

      var itemRgb = this.hexToRgb(item.hex);
      // Евклидово расстояние между цветами в RGB-пространстве
      var distance = Math.sqrt(
        Math.pow(targetRgb[0] - itemRgb[0], 2) +
        Math.pow(targetRgb[1] - itemRgb[1], 2) +
        Math.pow(targetRgb[2] - itemRgb[2], 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closest = item;
      }
    }
    return closest; // Возвращает точный объект краски из твоего каталога
  },

  // 3. Генерация готового пресета, где все цвета заменены на артикулы каталога
  mapPresetToCatalog: function (rawPreset, catalog) {
    var self = this;
    var matchedSegments = rawPreset.hexes.map(function (hex) {
      var match = self.findClosest(hex, catalog);
      return {
        originalId: match ? (match.original_id || match.code || match.id) : hex,
        hex: match ? match.hex : hex,
        name: match ? (match.name || match.title) : 'Базовый цвет'
      };
    });

    return {
      id: rawPreset.id,
      title: rawPreset.title,
      category: rawPreset.category,
      lighting: rawPreset.lighting || 3000,
      segments: matchedSegments
    };
  }
};
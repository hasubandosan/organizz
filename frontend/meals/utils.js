/* МенюПлан — utils.js: общие хелперы */
'use strict';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg, type = 'ok') {
  if (window.UI && UI.toast) UI.toast(msg, type); else console.log('[toast]', msg);
}

// Подставляет картинки: <img data-img="ID"> -> src из DB.getImage (ссылка временная, обновляется ядром)
function loadImages(root = document) {
  root.querySelectorAll('img[data-img]').forEach(async img => {
    try {
      const rec = await DB.getImage(img.dataset.img);
      if (rec && rec.data) img.src = rec.data;
    } catch (e) { console.warn('[meals] картинка не загрузилась:', e.message); }
  });
}

// Файл -> уменьшенный JPEG (data URL). Сжимаем до загрузки, чтобы не упираться в лимиты.
function fileToResizedDataUrl(file, max = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать картинку')); };
    img.src = url;
  });
}

// Теги/категории из общего каталога (id -> имя)
async function mealTagOptions() {
  try { return await DB.getTagOptions('meals'); } catch (e) { return []; }
}

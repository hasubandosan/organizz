// МенюПлан — screens/profile.js (DEMO)
'use strict';

  const ProfileScreen = {
    async render(container) {
      let html = '<div class="screen"><div class="screen-title">Профиль</div>';
      html += '<div class="settings-section"><div class="settings-section-title">Настройки</div>';
      html += `<div class="settings-row"><span class="settings-row-icon">🥗</span><div class="settings-row-body"><div class="settings-row-label">Типы приёмов пищи</div><div class="settings-row-desc">Завтрак, Обед, Ужин</div></div></div>`;
      html += `<div class="settings-row"><span class="settings-row-icon">📤</span><div class="settings-row-body"><div class="settings-row-label">Экспорт данных</div><div class="settings-row-desc">Скачать JSON-бекап</div></div><span class="settings-row-arrow" onclick="DataIO.exportAll()">→</span></div>`;
      html += `<div class="settings-row"><span class="settings-row-icon">📥</span><div class="settings-row-body"><div class="settings-row-label">Импорт данных</div><div class="settings-row-desc">Загрузить JSON-бекап</div></div><span class="settings-row-arrow" onclick="DataIO.importAll()">→</span></div>`;
      html += `<div class="settings-row"><span class="settings-row-icon">⚖️</span><div class="settings-row-body"><div class="settings-row-label">Режимы питания</div><div class="settings-row-desc">Настройка диет и генерация плана</div></div><span class="settings-row-arrow" onclick="Router.go('profile.diets')">→</span></div>`;
      html += '</div>';
      html += '</div>';
      container.innerHTML = html;
      LifeShell.update({ title: 'Профиль' });
    }
  };


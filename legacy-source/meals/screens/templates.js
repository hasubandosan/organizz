// МенюПлан — screens/templates.js (DEMO)
'use strict';

const TemplatesScreen = {
  async render(container) {
    let html = '<div class="screen"><div class="screen-title">Шаблоны меню</div>';
    html += '<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">Нет шаблонов</div><div class="empty-desc">Сохрани неделю меню как шаблон</div></div>';
    html += '</div>';
    container.innerHTML = html;
    document.getElementById('header-title').textContent = 'Шаблоны';
    document.getElementById('header-icon').textContent = '📋';
  }
};
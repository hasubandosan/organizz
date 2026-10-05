// МенюПлан — screens/mealprep.js (DEMO)
'use strict';

const MealPrepScreen = {
  async render(container) {
    let html = '<div class="screen"><div class="screen-title">Заготовки (Meal Prep)</div>';
    html += '<div class="empty"><div class="empty-icon">🥘</div><div class="empty-title">Нет заготовок</div><div class="empty-desc">Раздел для планирования готовки на неделю</div></div>';
    html += '</div>';
    container.innerHTML = html;
    LifeShell.update({ title: 'Заготовки' });
  }
};
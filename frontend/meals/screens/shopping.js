// МенюПлан — screens/shopping.js (DEMO)
'use strict';

const ShoppingScreen = {
  async render(container) {
    const weekKey = WeekDB.currentKey();
    // Пытаемся собрать покупки
    let items = [];
    try {
      items = await ShoppingDB.build(weekKey);
    } catch(e) {
      console.warn('[Shopping] build error:', e);
    }

    let html = '<div class="screen"><div class="screen-title">Список покупок</div>';
    html += `<div class="week-nav"><div class="week-label">${WeekDB.label(weekKey)}</div></div>`;

    if (!items.length) {
      html += '<div class="empty"><div class="empty-icon">🛒</div><div class="empty-title">Список пуст</div><div class="empty-desc">Добавь рецепты в меню, чтобы сформировать список покупок</div></div>';
    } else {
      // Группируем по категориям
      const groups = {};
      for (const it of items) {
        const cat = it.category || 'Прочее';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(it);
      }
      let total = 0;
      for (const [cat, its] of Object.entries(groups)) {
        const catSum = its.reduce((s, i) => s + (i.cost || 0), 0);
        total += catSum;
        html += '<div class="shop-cat-group">';
        html += `<div class="shop-cat-header">${cat} <span class="shop-cat-sum">${catSum.toFixed(2)} ₽</span></div>`;
        for (const item of its) {
          html += `<div class="shop-item${item.checked ? ' checked' : ''}" onclick="ShoppingScreen.toggle('${item.productId}')">
            <div class="shop-check">${item.checked ? '✓' : ''}</div>
            <div class="shop-item-body">
              <div class="shop-item-name">${item.name}</div>
              <div class="shop-item-qty">${item.qty} ${item.unit}</div>
            </div>
            <div class="shop-item-cost">${(item.cost || 0).toFixed(2)} ₽</div>
          </div>`;
        }
        html += '</div>';
      }
      html += `<div class="shop-total-bar"><span class="shop-total-label">Итого</span><span class="shop-total-val">${total.toFixed(2)} ₽</span></div>`;
    }
    html += '</div>';
    container.innerHTML = html;
    document.getElementById('header-title').textContent = 'Покупки';
    document.getElementById('header-icon').textContent = '🛒';
  },

  async toggle(productId) {
    const weekKey = WeekDB.currentKey();
    try {
      await ShoppingDB.toggle(weekKey, productId);
      await this.render(document.getElementById('app-content'));
    } catch(e) {
      console.warn('[Shopping] toggle error:', e);
    }
  }
};
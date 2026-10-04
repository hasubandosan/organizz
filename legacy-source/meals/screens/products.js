// МенюПлан — screens/products.js (DEMO)
'use strict';

const ProductsScreen = {
  async render(container) {
    const products = await Products.list();
    let html = '<div class="screen"><div class="screen-title">Продукты</div>';
    html += '<div class="search-bar"><span class="search-icon">🔍</span><input type="text" placeholder="Поиск продуктов..." oninput="ProductsScreen._search(this.value)"></div>';
    html += '<div style="padding:8px 16px"><button class="menu-action-btn" onclick="Router.go(\'product.new\')">➕ Новый продукт</button></div>';
    if (!products.length) {
      html += '<div class="empty"><div class="empty-icon">🥕</div><div class="empty-title">Нет продуктов</div></div>';
    } else {
    html += products.map(p => `
        <div class="product-row" onclick="Router.go('product.edit', { id: '${p.id}' })">
          <div class="product-emoji">${p.emoji || '🛒'}</div>
          <div class="product-body">
            <div class="product-name">${p.name}</div>
            <div class="product-meta">${p.unit || 'г'} · ${p.category || ''}</div>
          </div>
          <div class="product-kcal">${p.kcal || 0} ккал</div>
        </div>
      `).join('');
    }
    html += '</div>';
    container.innerHTML = html;
    document.getElementById('header-title').textContent = 'Продукты';
    document.getElementById('header-icon').textContent = '🥕';
  },
  async _search(q) {
    const products = await Products.list(q);
    const container = document.getElementById('app-content');
    await this.render(container);
  }
};

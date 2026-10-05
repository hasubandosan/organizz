// МенюПлан — screens/products.js: общий каталог продуктов (только чтение + предложка)
'use strict';

const ProductsScreen = {
  _all: [],
  async render(container) {
    this._all = await Products.list();
    container.innerHTML = `<div class="screen"><div class="screen-title">Продукты</div>
      <div class="search-bar"><span class="search-icon">🔍</span><input type="text" id="pr-search" placeholder="Поиск продуктов..."></div>
      <div class="mp-actions">
        <button class="menu-action-btn" onclick="Router.go('product.new')">➕ Предложить продукт</button>
        <button class="menu-action-btn" onclick="Router.go('product.suggestions')">🗳 Предложка</button>
      </div>
      <div id="pr-list"></div></div>`;
    document.getElementById('header-title').textContent = 'Продукты';
    document.getElementById('header-icon').textContent = '🥕';
    document.getElementById('pr-search').addEventListener('input', e => this._list(e.target.value));
    this._list('');
  },
  _list(q) {
    q = q.trim().toLowerCase();
    const items = this._all.filter(p => !q || (p.name || '').toLowerCase().includes(q));
    document.getElementById('pr-list').innerHTML = items.length
      ? items.map(p => `<div class="product-row" onclick="Router.go('product.edit', { id: '${esc(p.id)}' })">
          <div class="product-emoji">🛒</div>
          <div class="product-body"><div class="product-name">${esc(p.name)}</div><div class="product-meta">${esc(p.unit || 'г')}${p.category ? ' · ' + esc(p.category) : ''}</div></div></div>`).join('')
      : '<div class="empty"><div class="empty-icon">🥕</div><div class="empty-title">' + (this._all.length ? 'Ничего не найдено' : 'В каталоге пока пусто') + '</div></div>';
  },
};

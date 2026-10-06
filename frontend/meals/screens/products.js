// МенюПлан — screens/products.js: общий каталог продуктов (только чтение + предложка)
'use strict';

const ProductsScreen = {
  _all: [], _state: { search: '', cat: '' },

  async render(container) {
    this._all = await Products.list();
    const st = this._state;
    if (st.cat && !this._all.some(p => this._catKey(p) === st.cat)) st.cat = '';
    container.innerHTML = `<div class="screen">
      <div class="rc-bar"><div class="search-bar"><span class="search-icon">🔍</span><input type="text" id="pr-search" placeholder="Поиск продуктов..." value="${esc(st.search)}"></div>
        <button class="rc-ib" id="pr-new" title="Предложить продукт" aria-label="Предложить продукт">＋</button>
        <button class="rc-ib" id="pr-sugg" title="Предложка" aria-label="Предложка">🗳</button></div>
      <div class="mp-chips rc-scroll" id="pr-cats"></div>
      <div class="rc-sum"><span id="pr-sum"></span></div>
      <div id="pr-list"></div></div>`;
    LifeShell.update({ title: 'Продукты' });
    const $ = id => document.getElementById(id);
    $('pr-search').addEventListener('input', e => { st.search = e.target.value; this._refresh(); });
    $('pr-new').addEventListener('click', () => Router.go('product.new'));
    $('pr-sugg').addEventListener('click', () => Router.go('product.suggestions'));
    $('pr-cats').addEventListener('click', e => {
      const c = e.target.closest('[data-cat]'); if (!c) return;
      st.cat = c.dataset.cat; this._refresh();
    });
    this._refresh();
  },

  _catKey(p) { return p.category ? p.category : '__none'; },

  _refresh() {
    const list = document.getElementById('pr-list');
    if (!list) return;
    const st = this._state, q = st.search.trim().toLowerCase();
    const bySearch = this._all.filter(p => !q || (p.name || '').toLowerCase().includes(q));
    // категории: счётчики учитывают поиск
    const cnt = new Map(); bySearch.forEach(p => cnt.set(this._catKey(p), (cnt.get(this._catKey(p)) || 0) + 1));
    const allCnt = new Map(); this._all.forEach(p => allCnt.set(this._catKey(p), 1));
    const keys = [...allCnt.keys()].filter(k => k !== '__none').sort((a, b) => a.localeCompare(b, 'ru'));
    if (allCnt.has('__none')) keys.push('__none');
    const bar = document.getElementById('pr-cats');
    bar.style.display = keys.length > 1 ? 'flex' : 'none';
    bar.innerHTML = `<span class="mp-chip${!st.cat ? ' on' : ''}" data-cat="">Все<i class="cnt">${bySearch.length}</i></span>`
      + keys.map(k => `<span class="mp-chip${st.cat === k ? ' on' : ''}" data-cat="${esc(k)}">${esc(k === '__none' ? 'Без категории' : k)}<i class="cnt">${cnt.get(k) || 0}</i></span>`).join('');

    const items = bySearch.filter(p => !st.cat || this._catKey(p) === st.cat);
    document.getElementById('pr-sum').innerHTML = `<b>${items.length}</b> ${this._plural(items.length)}` + (items.length !== this._all.length ? ` из ${this._all.length}` : '');
    list.innerHTML = items.length
      ? items.map(p => `<div class="product-row" onclick="Router.go('product.edit', { id: '${esc(p.id)}' })">
          <div class="product-emoji">🛒</div>
          <div class="product-body"><div class="product-name">${esc(p.name)}</div><div class="product-meta">${esc(p.unit || 'г')}${p.category ? ' · ' + esc(p.category) : ''}</div></div></div>`).join('')
      : '<div class="empty"><div class="empty-icon">🥕</div><div class="empty-title">' + (this._all.length ? 'Ничего не найдено' : 'В каталоге пока пусто') + '</div></div>';
  },
  _plural(n) {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? 'продукт' : (a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 'продукта' : 'продуктов');
  },
};

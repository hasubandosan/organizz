'use strict';

const tabQueue = document.getElementById('tabQueue');
const tabProducts = document.getElementById('tabProducts');
const queuePane = document.getElementById('queuePane');
const productsPane = document.getElementById('productsPane');

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

tabQueue.addEventListener('click', () => switchTab('queue'));
tabProducts.addEventListener('click', () => switchTab('products'));

function switchTab(name) {
  tabQueue.classList.toggle('active', name === 'queue');
  tabProducts.classList.toggle('active', name === 'products');
  queuePane.classList.toggle('hidden', name !== 'queue');
  productsPane.classList.toggle('hidden', name !== 'products');
  if (name === 'queue') loadQueue();
  else loadProducts();
}

// ───────── Очередь модерации ─────────

async function loadQueue() {
  queuePane.innerHTML = '<div class="empty">Загрузка…</div>';
  let items;
  try {
    items = await DB.request('/catalog/suggestions?status=pending');
  } catch (e) {
    queuePane.innerHTML = `<div class="empty">Ошибка: ${esc(e.message)}${e.status === 403 ? ' (нет роли admin в каталоге?)' : ''}</div>`;
    return;
  }
  if (!items.length) {
    queuePane.innerHTML = '<div class="empty">Очередь пуста 🎉</div>';
    return;
  }
  queuePane.innerHTML = items.map(s => `
    <div class="row" data-id="${esc(s.id)}">
      <div class="row-main">
        <div class="row-title">${esc(s.payload?.name || '')}</div>
        <div class="row-meta">
          ${s.type === 'new_product' ? 'Новый продукт' : 'Правка продукта'}
          ${s.payload?.category ? ' · ' + esc(s.payload.category) : ''}
          ${s.payload?.unit ? ' · ' + esc(s.payload.unit) : ''}
          · 👍 ${s.voteCount || 0}
        </div>
      </div>
      <div class="row-actions">
        <button class="btn btn-approve" onclick="approveSuggestion('${esc(s.id)}')">Одобрить</button>
        <button class="btn btn-reject" onclick="rejectSuggestion('${esc(s.id)}')">Отклонить</button>
      </div>
    </div>`).join('');
}

async function approveSuggestion(id) {
  try {
    await DB.request(`/catalog/suggestions/${encodeURIComponent(id)}/approve`, { method: 'POST' });
    loadQueue();
  } catch (e) { alert('Ошибка: ' + e.message); }
}

async function rejectSuggestion(id) {
  if (!confirm('Отклонить заявку?')) return;
  try {
    await DB.request(`/catalog/suggestions/${encodeURIComponent(id)}/reject`, { method: 'POST' });
    loadQueue();
  } catch (e) { alert('Ошибка: ' + e.message); }
}

// ───────── Все продукты (прямое управление) ─────────

let _allProducts = [];

async function loadProducts() {
  productsPane.innerHTML = '<div class="empty">Загрузка…</div>';
  try {
    _allProducts = await DB.request('/catalog/products');
  } catch (e) {
    productsPane.innerHTML = `<div class="empty">Ошибка: ${esc(e.message)}</div>`;
    return;
  }
  productsPane.innerHTML = `
    <div class="search-bar"><input type="text" id="prodSearch" placeholder="Поиск по названию..."></div>
    <div id="prodList"></div>`;
  document.getElementById('prodSearch').addEventListener('input', (e) => renderProducts(e.target.value));
  renderProducts('');
}

function renderProducts(q) {
  q = q.trim().toLowerCase();
  const items = _allProducts.filter(p => !q || p.name.toLowerCase().includes(q));
  const el = document.getElementById('prodList');
  el.innerHTML = items.length ? items.map(p => `
    <div class="row" data-id="${esc(p.id)}">
      <div class="row-main">
        <div class="row-title">${esc(p.name)}</div>
        <div class="row-meta">${esc(p.category || '—')} · ${esc(p.unit || '—')}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-edit" onclick="editProduct('${esc(p.id)}')">✏️</button>
        <button class="btn btn-delete" onclick="deleteProduct('${esc(p.id)}')">🗑</button>
      </div>
    </div>`).join('') : '<div class="empty">Ничего не найдено</div>';
}

async function editProduct(id) {
  const p = _allProducts.find(x => x.id === id);
  if (!p) return;
  const name = prompt('Название', p.name);
  if (name === null) return;
  const category = prompt('Категория', p.category || '');
  if (category === null) return;
  const unit = prompt('Единица (г/мл/шт...)', p.unit || '');
  if (unit === null) return;
  try {
    await DB.request(`/catalog/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, category, unit }),
    });
    loadProducts();
  } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteProduct(id) {
  if (!confirm('Удалить продукт из каталога? Действие необратимо.')) return;
  try {
    await DB.request(`/catalog/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadProducts();
  } catch (e) { alert('Ошибка: ' + e.message); }
}

// ───────── Старт ─────────
(async () => {
  try {
    await lifeosInit();
  } catch (e) {
    console.warn('[Admin] lifeosInit:', e.message);
    if (!localStorage.getItem('token')) return; // идёт редирект на логин
  }
  loadQueue();
})();

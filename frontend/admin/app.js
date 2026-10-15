'use strict';

const PANES = { queue: 'queuePane', products: 'productsPane', diets: 'dietsPane', subs: 'subsPane', log: 'logPane' };
const queuePane = document.getElementById('queuePane');
const productsPane = document.getElementById('productsPane');
const dietsPane = document.getElementById('dietsPane');
const subsPane = document.getElementById('subsPane');
const logPane = document.getElementById('logPane');

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Боковое меню слева
document.getElementById('side').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab);
});

function switchTab(name) {
  document.querySelectorAll('.side-i').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  for (const [k, id] of Object.entries(PANES)) document.getElementById(id).classList.toggle('hidden', k !== name);
  ({ queue: loadQueue, products: loadProducts, diets: loadDiets, subs: loadSubs, log: loadLog })[name]();
}

// Правка в таблице сохраняется сама (на change). Показываем результат подсветкой строки.
function flashRow(tr, ok, msg) {
  tr.classList.remove('ok', 'err'); tr.classList.add(ok ? 'ok' : 'err');
  tr.title = ok ? '' : (msg || '');
  if (ok) setTimeout(() => tr.classList.remove('ok'), 900); else alert('Не сохранилось: ' + msg);
}

// ───────── Заявки на модерацию ─────────

async function loadQueue() {
  queuePane.innerHTML = '<div class="empty">Загрузка…</div>';
  let items;
  try {
    items = await DB.request('/catalog/suggestions?status=pending');
  } catch (e) {
    queuePane.innerHTML = `<div class="empty">Ошибка: ${esc(e.message)}${e.status === 403 ? ' (нет роли admin в каталоге?)' : ''}</div>`;
    return;
  }
  setQueueBadge(items.length);
  if (!items.length) { queuePane.innerHTML = '<div class="empty">Очередь пуста 🎉</div>'; return; }
  queuePane.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Продукт</th><th>Тип</th><th>Категория</th><th>Ед.</th><th>Ккал</th><th>Цена</th><th>👍</th><th></th></tr></thead><tbody>`
    + items.map(s => { const p = s.payload || {}, d = p.data || {};
      return `<tr><td class="nm"><b>${esc(p.name || '')}</b></td><td class="mut">${s.type === 'new_product' ? 'Новый' : 'Правка'}</td><td>${esc(_CATS[p.category] || p.category || '—')}</td><td>${esc(_UNITS[p.unit] || p.unit || '—')}</td>
        <td>${d.kcal ? +d.kcal : '—'}</td><td>${d.price ? +d.price + ' ₽' : '—'}</td><td>${s.voteCount || 0}</td>
        <td class="act"><button class="btn btn-approve" onclick="approveSuggestion('${esc(s.id)}')">Одобрить</button> <button class="btn btn-reject" onclick="rejectSuggestion('${esc(s.id)}')">Отклонить</button></td></tr>`; }).join('')
    + '</tbody></table></div>';
}

function setQueueBadge(n) {
  const b = document.getElementById('qBadge');
  b.textContent = n > 99 ? '99+' : n; b.classList.toggle('hidden', !n);
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

// ───────── Все продукты: таблица с полями, которые правятся прямо в ячейках ─────────

let _allProducts = [];
const _pv = { q: '', cat: '', noPrice: false, noKbzhu: false, sort: 'name', dir: 1, limit: 100 };
const _NUM = ['kcal', 'protein', 'fat', 'carbs', 'packageSize', 'price', 'unitWeight'];

async function loadProducts() {
  productsPane.innerHTML = '<div class="empty">Загрузка…</div>';
  try {
    _allProducts = await DB.request('/catalog/products');
  } catch (e) {
    productsPane.innerHTML = `<div class="empty">Ошибка: ${esc(e.message)}</div>`;
    return;
  }
  productsPane.innerHTML = `
    <div class="tbl-bar">
      <button class="btn btn-approve" onclick="editProduct()">＋ Продукт</button>
      <button class="btn btn-edit" onclick="refreshPrices(true)">💰 Цены: предпросмотр</button>
      <button class="btn btn-approve" onclick="refreshPrices(false)">💰 Обновить цены (ИИ)</button>
    </div>
    <div id="priceLog" class="row-meta" style="margin-bottom:10px"></div>
    <div class="tbl-bar">
      <input type="text" id="prodSearch" placeholder="Поиск по названию…" value="${esc(_pv.q)}">
      <select id="prodCat"><option value="">Все категории</option>${Object.entries(_CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <label><input type="checkbox" id="prodNoPrice"> без цены</label>
      <label><input type="checkbox" id="prodNoKbzhu"> без КБЖУ</label>
    </div>
    <div id="prodTable"></div>`;
  const $ = id => document.getElementById(id);
  $('prodCat').value = _pv.cat; $('prodNoPrice').checked = _pv.noPrice; $('prodNoKbzhu').checked = _pv.noKbzhu;
  const upd = () => { _pv.q = $('prodSearch').value; _pv.cat = $('prodCat').value; _pv.noPrice = $('prodNoPrice').checked; _pv.noKbzhu = $('prodNoKbzhu').checked; _pv.limit = 100; renderProducts(); };
  ['prodSearch', 'prodCat', 'prodNoPrice', 'prodNoKbzhu'].forEach(id => $(id).addEventListener(id === 'prodSearch' ? 'input' : 'change', upd));
  renderProducts();
}

function renderProducts() {
  const q = _pv.q.trim().toLowerCase();
  let items = _allProducts.filter(p => (!q || p.name.toLowerCase().includes(q)) && (!_pv.cat || p.category === _pv.cat)
    && (!_pv.noPrice || !(+p.data?.price > 0)) && (!_pv.noKbzhu || !(+p.data?.kcal > 0)));
  const key = p => _pv.sort === 'category' ? (_CATS[p.category] || p.category || '') : _pv.sort === 'price' ? (+p.data?.price || 0) : _pv.sort === 'kcal' ? (+p.data?.kcal || 0) : p.name.toLowerCase();
  items = items.slice().sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * _pv.dir; });
  const total = items.length, shown = items.slice(0, _pv.limit);
  const opt = (map, cur) => Object.entries(map).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${v}</option>`).join('') + (cur && !map[cur] ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : '');
  const num = (p, f) => `<td><input class="n" type="number" min="0" step="any" data-f="${f}" value="${p.data?.[f] ?? ''}"></td>`;
  const th = (label, k) => `<th class="sort" data-sort="${k}">${label}${_pv.sort === k ? (_pv.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
  const el = document.getElementById('prodTable');
  el.innerHTML = total ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th>${th('Название', 'name')}${th('Категория', 'category')}<th>Ед.</th>${th('Ккал', 'kcal')}<th>Б</th><th>Ж</th><th>У</th><th title="Размер упаковки в ед. учёта">Упак.</th>${th('Цена ₽', 'price')}<th title="Вес 1 шт, г">Шт, г</th><th></th></tr></thead><tbody>`
    + shown.map(p => `<tr data-id="${esc(p.id)}"><td><input class="e" data-f="emoji" maxlength="4" value="${esc(p.data?.emoji || p.emoji || '')}"></td>
      <td class="nm"><input data-f="name" value="${esc(p.name)}"></td>
      <td><select data-f="category">${opt(_CATS, p.category || 'other')}</select></td>
      <td><select data-f="unit">${opt(_UNITS, p.unit || 'g')}</select></td>
      ${num(p, 'kcal')}${num(p, 'protein')}${num(p, 'fat')}${num(p, 'carbs')}${num(p, 'packageSize')}${num(p, 'price')}${num(p, 'unitWeight')}
      <td class="act">${p.data?.source === 'user' ? '<span class="mut" title="Правлен вручную — ИИ не перезапишет">✎</span> ' : ''}<button class="btn btn-edit" title="Свойства и полная правка" onclick="editProduct('${esc(p.id)}')">⚙</button> <button class="btn btn-delete" title="Удалить" onclick="deleteProduct('${esc(p.id)}')">🗑</button></td></tr>`).join('')
    + `</tbody></table></div><div class="tbl-note">Показано ${shown.length} из ${total}. Изменения в ячейках сохраняются сами; строка подсвечивается зелёным.${total > shown.length ? ' <button class="btn btn-edit" id="prodMore">Показать ещё 100</button>' : ''}</div>`
    : '<div class="empty">Ничего не найдено</div>';
  const more = document.getElementById('prodMore'); if (more) more.onclick = () => { _pv.limit += 100; renderProducts(); };
  el.querySelectorAll('th.sort').forEach(h => h.onclick = () => { const k = h.dataset.sort; _pv.dir = _pv.sort === k ? -_pv.dir : 1; _pv.sort = k; renderProducts(); });
  el.querySelectorAll('tbody input, tbody select').forEach(c => c.addEventListener('change', () => saveProductCell(c)));
}

async function saveProductCell(el) {
  const tr = el.closest('tr'), id = tr.dataset.id, f = el.dataset.f;
  const p = _allProducts.find(x => x.id === id); if (!p) return;
  const d = { ...(p.data || {}) }; let name = p.name, category = p.category, unit = p.unit;
  const v = el.value.trim();
  if (f === 'name') { if (!v) { el.value = p.name; return; } name = v; }
  else if (f === 'category') category = v;
  else if (f === 'unit') unit = v;
  else if (f === 'emoji') { if (v) d.emoji = v; else delete d.emoji; }
  else { if (v === '') delete d[f]; else d[f] = Math.max(0, +v); if (f === 'price' && d.price !== p.data?.price) d.priceUpdatedAt = new Date().toISOString(); }
  d.source = 'user';   // ручная правка: ИИ-скрипты цен и КБЖУ такой продукт не перезаписывают
  try {
    const row = await DB.request(`/catalog/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name, category, unit, data: d }) });
    Object.assign(p, row); flashRow(tr, true);
  } catch (e) {
    el.value = f === 'name' ? p.name : (_NUM.includes(f) ? (p.data?.[f] ?? '') : f === 'emoji' ? (p.data?.emoji || '') : (p[f] || ''));
    flashRow(tr, false, e.message);
  }
}

// Актуализация цен через Gemini: порциями по 15, пока сервер не скажет next = null. Это оценка ИИ — проверяйте предпросмотром.
// Свой запрос без авто-выхода на логин: показываем настоящий код и текст ошибки сервера
async function adminPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(110000),
  }).catch(e => { throw new Error('нет связи с сервером (' + (e.name === 'TimeoutError' ? 'таймаут' : e.message) + ')'); });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${res.status}: ${data?.error || (res.status === 401 ? 'сессия истекла — войдите заново' : 'ошибка сервера')}`);
  return data;
}

async function refreshPrices(dry) {
  const region = prompt('Регион и валюта для оценки цен', 'Приднестровье (Тирасполь), рубли ПМР');
  if (!region) return;
  if (!dry && !confirm('Записать новые цены в каталог? Продукты, правленные людьми, не затрагиваются.')) return;
  const log = document.getElementById('priceLog');
  let offset = 0, done = 0, skipped = 0; const lines = [];
  try {
    while (offset !== null) {
      log.textContent = `Обновляю цены… ${offset}`;
      let r;
      for (let attempt = 0; ; attempt++) {   // Render может «проснуться» или перегрузиться — пробуем тот же кусок ещё до 3 раз
        try { r = await adminPost('/catalog/prices/refresh', { offset, limit: 10, region, dry }); break; }
        catch (e) {
          if (attempt >= 3 || /^40\d:/.test(e.message)) throw e;
          log.textContent = `Сервер не ответил (${e.message}), повтор ${attempt + 1}/3…`;
          await new Promise(res => setTimeout(res, 6000 * (attempt + 1)));
        }
      }
      done += r.changes.length; skipped += r.skipped;
      r.changes.forEach(c => lines.push(`${esc(c.name)}: ${c.old || '—'} → <b>${c.price}</b>`));
      offset = r.next;
      log.innerHTML = `${dry ? 'Предпросмотр' : 'Обновлено'}: ${done}, пропущено ${skipped}${offset !== null ? ' … продолжаю' : ''}<br>` + lines.slice(-40).join('<br>');
    }
    if (!dry) loadProducts();
  } catch (e) {
    log.innerHTML = `Остановилось на ${offset}. Ответ сервера — ${esc(e.message)}. Уже записанное сохранено — можно запустить снова.<br>` + lines.slice(-40).join('<br>');
  }
}

// Полная правка продукта: название, категория, единица, эмодзи, КБЖУ на 100 г/мл, упаковка и цена, вес штуки, свойства.
// Ручная правка помечает продукт data.source = 'user' — ИИ-скрипты цен и КБЖУ его потом не перезаписывают.
const _CATS = { meat: 'Мясо', fish: 'Рыба', dairy: 'Молочные', vegetables: 'Овощи', fruits: 'Фрукты', grains: 'Крупы', grocery: 'Бакалея', drinks: 'Напитки', sauces: 'Соусы', spices: 'Специи', other: 'Прочее' };
const _UNITS = { g: 'г', ml: 'мл', pcs: 'шт', kg: 'кг', l: 'л' };
const _PROPS = { gluten: 'Без глютена', lactose: 'Без лактозы', vegan: 'Веганский', raw: 'Сырой продукт', frozen: 'Замороженный', bio: 'Био/Органик', local: 'Местный', seasonal: 'Сезонный' };

function editProduct(id) {
  const p = id ? _allProducts.find(x => x.id === id) : { name: '', category: 'other', unit: 'g', data: {} };
  if (!p) return;
  const d = p.data || {};
  const opt = (map, cur) => Object.entries(map).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${v}</option>`).join('')
    + (cur && !map[cur] ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : '');
  const num = (key, label, step) => `<label class="pf">${label}<input type="number" min="0" step="${step || 'any'}" id="pf-${key}" value="${d[key] ?? ''}"></label>`;
  document.getElementById('prodModal')?.remove();
  const ov = document.createElement('div');
  ov.id = 'prodModal'; ov.className = 'pm-overlay';
  ov.innerHTML = `<div class="pm">
    <div class="pm-h"><b>${id ? 'Правка продукта' : 'Новый продукт'}</b><button class="btn btn-edit" data-x>✕</button></div>
    <div class="pm-b">
      <div class="pm-row"><label class="pf" style="flex:0 0 70px">Эмодзи<input id="pf-emoji" maxlength="4" value="${esc(d.emoji || '')}"></label>
        <label class="pf">Название<input id="pf-name" value="${esc(p.name)}"></label></div>
      <div class="pm-row"><label class="pf">Категория<select id="pf-cat">${opt(_CATS, p.category || 'other')}</select></label>
        <label class="pf">Единица учёта<select id="pf-unit">${opt(_UNITS, p.unit || 'g')}</select></label></div>
      <div class="pm-sec">КБЖУ на 100 г / 100 мл</div>
      <div class="pm-row">${num('kcal', 'Ккал')}${num('protein', 'Белки, г')}${num('fat', 'Жиры, г')}${num('carbs', 'Углеводы, г')}</div>
      <div class="pm-sec">Упаковка и цена (руб. ПМР)</div>
      <div class="pm-row">${num('packageSize', 'Размер упаковки (в ед. учёта)')}${num('price', 'Цена упаковки')}${num('unitWeight', 'Вес 1 шт, г (для «шт»)')}</div>
      <div class="pm-sec">Свойства</div>
      <div class="pm-props">${Object.entries(_PROPS).map(([k, v]) => `<label><input type="checkbox" data-prop="${k}"${(d.props || []).includes(k) ? ' checked' : ''}> ${v}</label>`).join('')}</div>
    </div>
    <div class="pm-f"><span id="pf-err" class="row-meta" style="color:var(--red)"></span><span style="flex:1"></span><button class="btn btn-approve" id="pf-save">Сохранить</button></div></div>`;
  document.body.appendChild(ov);
  const $ = i => ov.querySelector('#' + i), close = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-x]')) close(); });
  $('pf-save').onclick = async () => {
    const name = $('pf-name').value.trim();
    if (!name) { $('pf-err').textContent = 'Введите название'; return; }
    const n = k => { const v = $('pf-' + k).value; return v === '' ? undefined : Math.max(0, +v); };
    const data = { ...d, emoji: $('pf-emoji').value.trim() || d.emoji, source: 'user',
      props: [...ov.querySelectorAll('[data-prop]:checked')].map(c => c.dataset.prop) };
    ['kcal', 'protein', 'fat', 'carbs', 'packageSize', 'price', 'unitWeight'].forEach(k => { const v = n(k); if (v === undefined) delete data[k]; else data[k] = v; });
    if (data.price !== d.price) data.priceUpdatedAt = new Date().toISOString();
    const body = { name, category: $('pf-cat').value, unit: $('pf-unit').value, data };
    $('pf-save').disabled = true;
    try {
      await DB.request(id ? `/catalog/products/${encodeURIComponent(id)}` : '/catalog/products', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      close(); loadProducts();
    } catch (e) { $('pf-save').disabled = false; $('pf-err').textContent = 'Ошибка: ' + e.message; }
  };
}

async function deleteProduct(id) {
  if (!confirm('Удалить продукт из каталога? Действие необратимо.')) return;
  try {
    await DB.request(`/catalog/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadProducts();
  } catch (e) { alert('Ошибка: ' + e.message); }
}


// ───────── Системные режимы питания (видны всем пользователям модуля «Питание») — тоже таблицей ─────────

let _diets = [];
const _PROP_IDS = 'gluten, lactose, vegan, raw, frozen, bio, local, seasonal';

async function loadDiets() {
  dietsPane.innerHTML = '<div class="empty">Загрузка…</div>';
  try { _diets = await DB.request('/catalog/diets'); }
  catch (e) { dietsPane.innerHTML = `<div class="empty">Ошибка: ${esc(e.message)}</div>`; return; }
  const list = a => esc((a || []).join(', '));
  dietsPane.innerHTML = '<div class="tbl-bar"><button class="btn btn-approve" onclick="newDiet()">＋ Новый режим</button></div>' +
    (_diets.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Название</th><th title="руб. ПМР в день на всех">Бюджет/день ₽</th><th>Мин. ккал</th><th title="${_PROP_IDS}">Предпочитать (id)</th><th title="${_PROP_IDS}">Исключать (id)</th><th></th></tr></thead><tbody>`
      + _diets.map(d => `<tr data-id="${esc(d.id)}"><td><input class="e" data-f="emoji" maxlength="4" value="${esc(d.data?.emoji || '🎯')}"></td>
        <td class="nm"><input data-f="name" value="${esc(d.name)}"></td>
        <td><input class="n" type="number" min="0" data-f="budgetDay" value="${d.data?.budgetDay || 0}"></td>
        <td><input class="n" type="number" min="0" data-f="minKcal" value="${d.data?.minKcal || 0}"></td>
        <td><input data-f="allowProps" value="${list(d.data?.allowProps)}" placeholder="через запятую"></td>
        <td><input data-f="denyProps" value="${list(d.data?.denyProps)}" placeholder="через запятую"></td>
        <td class="act"><button class="btn btn-delete" title="Удалить" onclick="deleteDiet('${esc(d.id)}')">🗑</button></td></tr>`).join('')
      + `</tbody></table></div><div class="tbl-note">Свойства — id через запятую: ${_PROP_IDS}. Изменения сохраняются сами.</div>`
      : '<div class="empty">Системных режимов пока нет</div>');
  dietsPane.querySelectorAll('tbody input').forEach(c => c.addEventListener('change', () => saveDietCell(c)));
}

async function saveDietCell(el) {
  const tr = el.closest('tr'), id = tr.dataset.id, f = el.dataset.f, d = _diets.find(x => x.id === id); if (!d) return;
  const list = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  const data = { ...(d.data || {}) }; let name = d.name;
  if (f === 'name') { if (!el.value.trim()) { el.value = d.name; return; } name = el.value.trim(); }
  else if (f === 'emoji') data.emoji = el.value.trim() || '🎯';
  else if (f === 'allowProps' || f === 'denyProps') data[f] = list(el.value);
  else data[f] = Math.max(0, +el.value || 0);
  try {
    const row = await DB.request(`/catalog/diets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name, data }) });
    Object.assign(d, row); flashRow(tr, true);
  } catch (e) { flashRow(tr, false, e.message); loadDiets(); }
}

async function newDiet() {
  const name = prompt('Название нового режима'); if (!name || !name.trim()) return;
  try { await DB.request('/catalog/diets', { method: 'POST', body: JSON.stringify({ name: name.trim(), data: { emoji: '🎯', budgetDay: 0, minKcal: 0, allowProps: [], denyProps: [] } }) }); loadDiets(); }
  catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteDiet(id) {
  if (!confirm('Удалить режим? У пользователей он пропадёт из списка.')) return;
  try { await DB.request(`/catalog/diets/${encodeURIComponent(id)}`, { method: 'DELETE' }); loadDiets(); }
  catch (e) { alert('Ошибка: ' + e.message); }
}

// ───────── Журнал действий админов ─────────

const _LOG_ACT = { 'product.create': '➕ Продукт создан', 'product.update': '✏️ Продукт изменён', 'product.delete': '🗑 Продукт удалён', 'suggestion.approve': '✅ Заявка одобрена', 'suggestion.reject': '⛔ Заявка отклонена',
  'diet.create': '➕ Режим создан', 'diet.update': '✏️ Режим изменён', 'diet.delete': '🗑 Режим удалён', 'prices.refresh': '💰 Цены обновлены ИИ', 'subscription.grant': '⭐ Подписка выдана', 'subscription.revoke': '⭐ Подписка снята' };
const _LOG_F = { name: 'название', category: 'категория', unit: 'ед.', emoji: 'эмодзи', kcal: 'ккал', protein: 'Б', fat: 'Ж', carbs: 'У', packageSize: 'упаковка', price: 'цена', unitWeight: 'вес шт', props: 'свойства', budgetDay: 'бюджет/день', minKcal: 'мин. ккал', allowProps: 'предпочитать', denyProps: 'исключать' };
let _logRows = [], _logEnd = false;

function logDetails(r) {
  const x = r.details || {}, v = o => esc(Array.isArray(o) ? o.join(', ') || '—' : (o === null || o === undefined || o === '' ? '—' : o));
  if (x.changes) {
    if (r.action === 'prices.refresh') return `${x.region ? esc(x.region) + '<br>' : ''}` + x.changes.slice(0, 6).map(c => `${esc(c.name)}: ${v(c.old)} → <b>${v(c.new)}</b>`).join('<br>') + (x.changes.length > 6 ? `<br>…и ещё ${x.changes.length - 6}` : '');
    return x.changes.map(c => `${esc(_LOG_F[c.field] || c.field)}: ${v(c.old)} → <b>${v(c.new)}</b>`).join('<br>');
  }
  if (r.action === 'subscription.grant') return `${esc(x.plan || '')}${x.expiresAt ? ' до ' + esc(new Date(x.expiresAt).toLocaleDateString('ru-RU')) : ' бессрочно'}`;
  if (x.was) return 'было: ' + esc(JSON.stringify(x.was)).slice(0, 200);
  if (x.type) return x.type === 'new_product' ? 'новый продукт' : 'правка продукта';
  return '';
}

async function loadLog(more) {
  if (!more) { _logRows = []; _logEnd = false; logPane.innerHTML = '<div class="empty">Загрузка…</div>'; }
  try {
    const before = more && _logRows.length ? '&before=' + encodeURIComponent(_logRows[_logRows.length - 1].createdAt) : '';
    const rows = await DB.request('/catalog/admin-log?limit=50' + before);
    _logRows = _logRows.concat(rows); _logEnd = rows.length < 50;
  } catch (e) { logPane.innerHTML = `<div class="empty">Ошибка: ${esc(e.message)}</div>`; return; }
  logPane.innerHTML = _logRows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Когда</th><th>Кто</th><th>Действие</th><th>Объект</th><th>Детали</th></tr></thead><tbody>`
    + _logRows.map(r => `<tr><td class="mut" style="white-space:nowrap">${esc(new Date(r.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</td>
      <td class="mut">${esc(r.email || '—')}</td><td style="white-space:nowrap">${esc(_LOG_ACT[r.action] || r.action)}</td><td><b>${esc(r.target || '')}</b></td><td class="log-d">${logDetails(r)}</td></tr>`).join('')
    + `</tbody></table></div>${_logEnd ? '' : '<div class="tbl-note"><button class="btn btn-edit" onclick="loadLog(true)">Показать ещё</button></div>'}`
    : '<div class="empty">Журнал пока пуст — записи появятся после первых правок</div>';
}

// ───────── Старт ─────────
// Render (Free) засыпает: пока сервер просыпается, он отвечает 502 без CORS-заголовков — ждём /health, потом грузим данные
async function wakeServer() {
  const box = document.getElementById('queuePane');
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(`${API_BASE}/health`, { cache: 'no-store' }); if (r.ok) return true; } catch (e) { /* ещё спит */ }
    if (box) box.innerHTML = `<div class="empty">Сервер просыпается… (${i * 3} с, обычно до минуты)</div>`;
    await new Promise(r => setTimeout(r, 3000));
  }
  return false;
}

(async () => {
  // lifeosInit() тут не нужен: у админки slug «catalog», его миграции локального хранилища давали 404 /catalog/_meta и /catalog/tags
  if (!localStorage.getItem('token')) { try { await DB.request('/catalog/me'); } catch (e) { /* ядро отправит на вход */ } return; }
  if (!(await wakeServer())) { const b = document.getElementById('queuePane'); if (b) b.innerHTML = '<div class="empty">Сервер не отвечает. Обновите страницу через минуту.</div>'; return; }
  loadQueue();
})();

// ───────── Подписки (без оплаты: тариф выдаёт админ по почте) ─────────

async function loadSubs() {
  subsPane.innerHTML = '<div class="empty">Загрузка…</div>';
  let d;
  try { d = await DB.request('/subscription'); }
  catch (e) { subsPane.innerHTML = `<div class="empty">Ошибка: ${esc(e.message)}</div>`; return; }
  const plans = d.plans.map(p => `<option value="${esc(p.code)}">${esc(p.name)} (личных режимов: ${p.personalDiets})</option>`).join('');
  subsPane.innerHTML = `<div class="row-actions" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <input id="subEmail" type="email" placeholder="Почта пользователя" style="flex:1;min-width:200px">
      <select id="subPlan">${plans}</select>
      <input id="subUntil" type="date" title="Действует до (пусто — бессрочно)">
      <button class="btn btn-approve" onclick="grantSub()">Выдать</button></div>
    <div class="empty" style="text-align:left;font-size:12px">Дата — по желанию: пусто = бессрочно. Чтобы продлить или сменить тариф, выдайте ещё раз на ту же почту.</div>`
    + (d.items.length ? d.items.map(s => `<div class="card" style="padding:10px;margin-top:8px;display:flex;gap:10px;align-items:center">
        <div style="flex:1"><b>${esc(s.email)}</b><br><span style="font-size:12px;color:var(--text3)">${esc((d.plans.find(p => p.code === s.plan) || {}).name || s.plan)} · ${s.expiresAt ? 'до ' + esc(new Date(s.expiresAt).toLocaleDateString('ru-RU')) : 'бессрочно'}${s.active ? '' : ' · истекла'}</span></div>
        <button class="btn" onclick="revokeSub('${esc(s.email)}')">Забрать</button></div>`).join('') : '<div class="empty">Подписок пока нет</div>');
}

async function grantSub() {
  const email = document.getElementById('subEmail').value.trim();
  const plan = document.getElementById('subPlan').value;
  const until = document.getElementById('subUntil').value;
  if (!email) return alert('Введите почту');
  try {
    await DB.request('/subscription', { method: 'PUT', body: JSON.stringify({ email, plan, expiresAt: until ? until + 'T23:59:59' : null }) });
    loadSubs();
  } catch (e) { alert('Ошибка: ' + e.message); }
}

async function revokeSub(email) {
  if (!confirm('Забрать подписку у ' + email + '?')) return;
  try { await DB.request('/subscription/' + encodeURIComponent(email), { method: 'DELETE' }); loadSubs(); }
  catch (e) { alert('Ошибка: ' + e.message); }
}

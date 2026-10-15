'use strict';

const tabQueue = document.getElementById('tabQueue');
const tabProducts = document.getElementById('tabProducts');
const queuePane = document.getElementById('queuePane');
const productsPane = document.getElementById('productsPane');
const tabDiets = document.getElementById('tabDiets');
const dietsPane = document.getElementById('dietsPane');
const tabSubs = document.getElementById('tabSubs');
const subsPane = document.getElementById('subsPane');

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

tabQueue.addEventListener('click', () => switchTab('queue'));
tabProducts.addEventListener('click', () => switchTab('products'));
tabDiets.addEventListener('click', () => switchTab('diets'));
tabSubs.addEventListener('click', () => switchTab('subs'));

function switchTab(name) {
  tabQueue.classList.toggle('active', name === 'queue');
  tabProducts.classList.toggle('active', name === 'products');
  queuePane.classList.toggle('hidden', name !== 'queue');
  productsPane.classList.toggle('hidden', name !== 'products');
  tabDiets.classList.toggle('active', name === 'diets');
  dietsPane.classList.toggle('hidden', name !== 'diets');
  tabSubs.classList.toggle('active', name === 'subs');
  subsPane.classList.toggle('hidden', name !== 'subs');
  if (name === 'queue') loadQueue();
  else if (name === 'subs') loadSubs();
  else if (name === 'diets') loadDiets();
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
          ${s.payload?.unit ? ' · ' + esc(s.payload.unit) : ''}${s.payload?.data?.kcal ? ' · ' + (+s.payload.data.kcal) + ' ккал' : ''}${s.payload?.data?.price ? ' · ' + (+s.payload.data.price) + ' ₽' : ''}
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
    <div class="row-actions" style="margin-bottom:10px;flex-wrap:wrap">
      <button class="btn btn-approve" onclick="editProduct()">＋ Продукт</button>
      <button class="btn btn-edit" onclick="refreshPrices(true)">💰 Цены: предпросмотр</button>
      <button class="btn btn-approve" onclick="refreshPrices(false)">💰 Обновить цены (ИИ)</button>
    </div>
    <div id="priceLog" class="row-meta" style="margin-bottom:10px"></div>
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
        <div class="row-meta">${esc(p.emoji || p.data?.emoji || '')} ${esc(p.category || '—')} · ${esc(p.unit || '—')}${p.data?.kcal ? ' · ' + (+p.data.kcal) + ' ккал' : ''}${p.data?.price ? ' · ' + (+p.data.price) + ' руб./' + (+p.data.packageSize || '?') : ' · без цены'}${p.data?.source === 'user' ? ' · ✎' : ''}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-edit" onclick="editProduct('${esc(p.id)}')">✏️</button>
        <button class="btn btn-delete" onclick="deleteProduct('${esc(p.id)}')">🗑</button>
      </div>
    </div>`).join('') : '<div class="empty">Ничего не найдено</div>';
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

// ───────── Системные режимы питания (видны всем пользователям модуля «Питание») ─────────

let _diets = [];

async function loadDiets() {
  dietsPane.innerHTML = '<div class="empty">Загрузка…</div>';
  try { _diets = await DB.request('/catalog/diets'); }
  catch (e) { dietsPane.innerHTML = `<div class="empty">Ошибка: ${esc(e.message)}</div>`; return; }
  dietsPane.innerHTML = '<div class="row-actions" style="margin-bottom:10px"><button class="btn btn-approve" onclick="editDiet()">＋ Новый режим</button></div>' +
    (_diets.length ? _diets.map(d => `
    <div class="row">
      <div class="row-main">
        <div class="row-title">${esc(d.data?.emoji || '🎯')} ${esc(d.name)}</div>
        <div class="row-meta">${d.data?.budgetDay ? esc(d.data.budgetDay) + ' руб./день' : 'без бюджета'}${d.data?.minKcal ? ' · от ' + esc(d.data.minKcal) + ' ккал' : ''}${(d.data?.allowProps || []).length ? ' · ✓ ' + esc(d.data.allowProps.join(', ')) : ''}${(d.data?.denyProps || []).length ? ' · ✕ ' + esc(d.data.denyProps.join(', ')) : ''}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-edit" onclick="editDiet('${esc(d.id)}')">✏️</button>
        <button class="btn btn-delete" onclick="deleteDiet('${esc(d.id)}')">🗑</button>
      </div>
    </div>`).join('') : '<div class="empty">Системных режимов пока нет</div>');
}

// Свойства — id продуктов каталога: gluten, lactose, vegan, raw, frozen, bio, local, seasonal (через запятую)
async function editDiet(id) {
  const d = id ? _diets.find(x => x.id === id) : null;
  const name = prompt('Название режима', d?.name || ''); if (!name) return;
  const emoji = prompt('Эмодзи', d?.data?.emoji || '🎯'); if (emoji === null) return;
  const budget = prompt('Бюджет на день, руб. ПМР (0 — без бюджета)', d?.data?.budgetDay || 0); if (budget === null) return;
  const kcal = prompt('Минимум ккал в день (0 — не важно)', d?.data?.minKcal || 0); if (kcal === null) return;
  const list = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  const allow = prompt('Предпочитать свойства (id через запятую)', (d?.data?.allowProps || []).join(', ')); if (allow === null) return;
  const deny = prompt('Исключать рецепты со свойствами (id через запятую)', (d?.data?.denyProps || []).join(', ')); if (deny === null) return;
  const body = { name: name.trim(), data: { emoji: emoji || '🎯', budgetDay: +budget || 0, minKcal: +kcal || 0, allowProps: list(allow), denyProps: list(deny) } };
  try {
    await DB.request(id ? `/catalog/diets/${encodeURIComponent(id)}` : '/catalog/diets', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
    loadDiets();
  } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteDiet(id) {
  if (!confirm('Удалить режим? У пользователей он пропадёт из списка.')) return;
  try { await DB.request(`/catalog/diets/${encodeURIComponent(id)}`, { method: 'DELETE' }); loadDiets(); }
  catch (e) { alert('Ошибка: ' + e.message); }
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

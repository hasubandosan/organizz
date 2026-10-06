// МенюПлан — screens/recipes.js: список рецептов (поиск, коллекции, фильтры, сортировка)
'use strict';

const RecipesScreen = {
  _all: [], _cols: [], _tags: [], _tagName: {},
  _state: { search: '', collectionId: '', tagIds: [], meals: [], diff: [], maxTime: 0, ingredient: '', noPhoto: false, noTags: false, sort: 'name' },
  _TIMES: [[0, 'Любое'], [15, 'до 15 мин'], [30, 'до 30 мин'], [60, 'до 60 мин']],
  _DIFF: { 1: '★ Легко', 2: '★★ Средне', 3: '★★★ Сложно' },
  _SORTS: [['name', 'по названию'], ['time', 'быстрее'], ['diff', 'проще'], ['new', 'сначала новые']],

  async render(container) {
    const [recipes, collections, tags] = await Promise.all([Recipes.list(), Collections.list(), mealTagOptions()]);
    this._all = recipes; this._cols = collections; this._tags = tags;
    this._tagName = Object.fromEntries(tags.map(t => [t.id, t.name]));
    const st = this._state;
    // выбранное могло исчезнуть (удалили коллекцию/тег) — не оставляем «невидимых» фильтров
    if (st.collectionId && !collections.some(c => c.id === st.collectionId)) st.collectionId = '';
    st.tagIds = st.tagIds.filter(id => this._tagName[id]);

    let html = '<div class="screen">';
    html += '<div class="rc-bar"><div class="search-bar"><span class="search-icon">🔍</span><input type="text" id="rc-search" placeholder="Поиск: название, ингредиент, тег" value="' + esc(st.search) + '"></div>';
    html += '<button class="rc-flt" id="rc-flt" title="Фильтры" aria-label="Фильтры"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg><span class="n" id="rc-fltn">0</span></button>';
    html += '<button class="rc-ib" id="rc-ai" title="Импорт через ИИ" aria-label="Импорт через ИИ">🤖</button></div>';
    if (collections.length) {
      html += '<div class="mp-chips rc-scroll" id="rc-cols"><span class="mp-chip" data-col="">Все книги<i class="cnt"></i></span>';
      for (const c of collections) html += `<span class="mp-chip" data-col="${esc(c.id)}">${esc(c.emoji || '📚')} ${esc(c.name)}<i class="cnt"></i></span>`;
      html += '</div>';
    }
    html += '<div class="rc-sum"><span id="rc-sumtxt"></span><span class="sp"></span><select id="rc-sort" class="rc-sort" aria-label="Сортировка">'
      + this._SORTS.map(([v, l]) => `<option value="${v}"${st.sort === v ? ' selected' : ''}>${l}</option>`).join('') + '</select></div>';
    html += '<div class="mp-chips" id="rc-active" style="display:none"></div>';
    html += '<div id="rc-grid"></div></div>';
    container.innerHTML = html;
    LifeShell.update({ title: 'Рецепты', actions: [{ icon: '＋', label: 'Новый рецепт', onClick: () => Router.go('recipe.new') }] });

    const $ = id => document.getElementById(id);
    $('rc-search').addEventListener('input', e => { st.search = e.target.value; this._refresh(); });
    $('rc-flt').addEventListener('click', () => this._openFilters());
    $('rc-ai').addEventListener('click', () => AIImport.open());
    $('rc-sort').addEventListener('change', e => { st.sort = e.target.value; this._refresh(); });
    const cols = $('rc-cols');
    if (cols) cols.addEventListener('click', e => {
      const c = e.target.closest('[data-col]'); if (!c) return;
      st.collectionId = c.dataset.col; this._refresh();
    });
    $('rc-active').addEventListener('click', e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const k = b.dataset.k, v = b.dataset.v;
      if (k === 'all') this._reset(true);
      else this._drop(k, v);
      this._refresh();
    });
    this._refresh();
  },

  // ── фильтрация ──
  _match(r, skip) {
    const st = this._state, q = st.search.trim().toLowerCase();
    if (q) {
      const hit = (r.name || '').toLowerCase().includes(q)
        || (r.ingredients || []).some(i => (i.name || '').toLowerCase().includes(q))
        || (r.tagIds || []).some(id => (this._tagName[id] || '').toLowerCase().includes(q));
      if (!hit) return false;
    }
    if (skip !== 'collection' && st.collectionId && r.collectionId !== st.collectionId) return false;
    if (st.tagIds.length && !st.tagIds.every(id => (r.tagIds || []).includes(id))) return false;
    if (st.meals.length && !st.meals.some(m => (r.recommendedMeals || []).includes(m))) return false;
    if (st.maxTime && !((+r.cookTimeMin || 0) > 0 && +r.cookTimeMin <= st.maxTime)) return false;
    if (st.diff.length && !st.diff.includes(+r.difficulty || 1)) return false;
    const ing = st.ingredient.trim().toLowerCase();
    if (ing && !(r.ingredients || []).some(i => (i.name || '').toLowerCase().includes(ing))) return false;
    if (st.noPhoto && r.imageId) return false;
    if (st.noTags && (r.tagIds || []).length) return false;
    return true;
  },
  _sorted(list) {
    const k = this._state.sort, num = (v, d) => (+v || d);
    if (k === 'time') return list.slice().sort((a, b) => num(a.cookTimeMin, 9999) - num(b.cookTimeMin, 9999));
    if (k === 'diff') return list.slice().sort((a, b) => num(a.difficulty, 1) - num(b.difficulty, 1));
    if (k === 'new')  return list.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list;   // Recipes.list() уже отсортирован по названию
  },
  _filterCount() {
    const st = this._state;
    return st.tagIds.length + st.meals.length + st.diff.length + (st.maxTime ? 1 : 0) + (st.ingredient.trim() ? 1 : 0) + (st.noPhoto ? 1 : 0) + (st.noTags ? 1 : 0);
  },
  _reset(withCollection) {
    const st = this._state;
    st.tagIds = []; st.meals = []; st.diff = []; st.maxTime = 0; st.ingredient = ''; st.noPhoto = false; st.noTags = false;
    if (withCollection) st.collectionId = '';
  },
  _drop(k, v) {
    const st = this._state, del = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); };
    if (k === 'tag') del(st.tagIds, v);
    else if (k === 'meal') del(st.meals, v);
    else if (k === 'diff') del(st.diff, +v);
    else if (k === 'time') st.maxTime = 0;
    else if (k === 'ing') st.ingredient = '';
    else if (k === 'noPhoto') st.noPhoto = false;
    else if (k === 'noTags') st.noTags = false;
  },
  _plural(n) {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? 'рецепт' : (a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 'рецепта' : 'рецептов');
  },

  // ── отрисовка (без повторной загрузки данных) ──
  _refresh() {
    const box = document.getElementById('rc-grid');
    if (!box) return;                       // ушли с экрана
    const st = this._state;
    const items = this._sorted(this._all.filter(r => this._match(r)));
    const total = this._all.length;

    // коллекции: подсветка и счётчики с учётом остальных фильтров
    const byCol = {}; let allCols = 0;
    this._all.forEach(r => { if (this._match(r, 'collection')) { allCols++; if (r.collectionId) byCol[r.collectionId] = (byCol[r.collectionId] || 0) + 1; } });
    document.querySelectorAll('#rc-cols [data-col]').forEach(el => {
      el.classList.toggle('on', el.dataset.col === st.collectionId);
      const cnt = el.querySelector('.cnt'); if (cnt) cnt.textContent = el.dataset.col ? (byCol[el.dataset.col] || 0) : allCols;
    });

    const book = this._cols.find(c => c.id === st.collectionId);
    LifeShell.update({ title: book ? book.name : 'Рецепты' });
    const n = items.length;
    document.getElementById('rc-sumtxt').innerHTML = `<b>${n}</b> ${this._plural(n)}` + (n !== total ? ` из ${total}` : '');
    document.getElementById('rc-sort').value = st.sort;

    // активные фильтры — чипами с крестиком
    const chips = [];
    st.tagIds.forEach(id => chips.push(['tag', id, '# ' + (this._tagName[id] || 'тег')]));
    st.meals.forEach(m => chips.push(['meal', m, '🍴 ' + m]));
    if (st.maxTime) chips.push(['time', '', '⏱ до ' + st.maxTime + ' мин']);
    st.diff.slice().sort().forEach(d => chips.push(['diff', d, this._DIFF[d]]));
    if (st.ingredient.trim()) chips.push(['ing', '', '🥕 ' + st.ingredient.trim()]);
    if (st.noPhoto) chips.push(['noPhoto', '', 'Без фото']);
    if (st.noTags) chips.push(['noTags', '', 'Без тегов']);
    const act = document.getElementById('rc-active');
    act.style.display = chips.length ? 'flex' : 'none';
    act.innerHTML = chips.map(([k, v, t]) => `<span class="mp-chip on fx">${esc(t)}<b class="x" data-k="${k}" data-v="${esc(String(v))}" role="button" aria-label="Убрать">✕</b></span>`).join('')
      + (chips.length > 1 ? '<span class="mp-chip" data-k="all">Сбросить всё</span>' : '');
    const fc = this._filterCount();
    document.getElementById('rc-flt').classList.toggle('on', fc > 0);
    document.getElementById('rc-fltn').textContent = fc;

    const narrowed = fc > 0 || !!st.search.trim() || !!st.collectionId;
    box.innerHTML = n
      ? '<div class="recipe-grid">' + items.map(MealComponents.recipeCard).join('') + '</div>'
      : '<div class="empty"><div class="empty-icon">📖</div><div class="empty-title">' + (total ? 'Ничего не найдено' : 'Пока нет рецептов') + '</div>'
        + (total && narrowed ? '<button class="rc-clear" id="rc-clear">Сбросить фильтры</button>' : '') + '</div>';
    const clr = document.getElementById('rc-clear');
    if (clr) clr.addEventListener('click', () => {
      this._reset(true); st.search = '';
      const s = document.getElementById('rc-search'); if (s) s.value = '';
      this._refresh();
    });
    loadImages(box);
  },

  // ── окно фильтров ──
  _closeFilters() { const m = document.getElementById('rc-filter-modal'); if (m) m.remove(); },
  _openFilters() {
    this._closeFilters();
    const st = this._state;
    const cnt = {}; this._all.forEach(r => (r.tagIds || []).forEach(id => { cnt[id] = (cnt[id] || 0) + 1; }));
    const usedTags = this._tags.filter(t => cnt[t.id]);
    const chip = (f, v, label, extra) => `<span class="mp-chip" data-f="${f}" data-v="${esc(String(v))}">${esc(label)}${extra ? `<i class="cnt">${extra}</i>` : ''}</span>`;
    const sec = (title, inner) => `<div class="f-sec"><div class="f-lbl">${title}</div><div class="mp-chips">${inner}</div></div>`;
    const el = document.createElement('div');
    el.className = 'modal-overlay open'; el.id = 'rc-filter-modal';
    el.innerHTML = `<div class="modal">
      <div class="modal-header"><div class="modal-title">Фильтры</div><button class="modal-close" data-close>✕</button></div>
      <div class="modal-body">
        ${usedTags.length ? sec('Теги (подходят все выбранные)', usedTags.map(t => chip('tag', t.id, '# ' + t.name, cnt[t.id])).join('')) : ''}
        ${sec('Приём пищи', MEAL_TYPES.map(m => chip('meal', m, m)).join(''))}
        ${sec('Время готовки', this._TIMES.map(([v, l]) => chip('time', v, l)).join(''))}
        ${sec('Сложность', [1, 2, 3].map(d => chip('diff', d, this._DIFF[d])).join(''))}
        <div class="f-sec"><div class="f-lbl">Есть ингредиент</div><input id="rc-f-ing" class="f-input" type="text" placeholder="например, молоко" value="${esc(st.ingredient)}"></div>
        ${sec('Навести порядок', chip('noPhoto', '', 'Без фото') + chip('noTags', '', 'Без тегов'))}
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" data-reset>Сбросить</button><button class="btn btn-primary" data-apply>Показать</button></div>
    </div>`;
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('[data-close],[data-apply]')) return this._closeFilters();
      if (e.target.closest('[data-reset]')) { this._reset(false); const i = document.getElementById('rc-f-ing'); if (i) i.value = ''; this._refresh(); return this._syncFilters(); }
      const c = e.target.closest('[data-f]'); if (!c) return;
      const f = c.dataset.f, v = c.dataset.v;
      const tog = (arr, x) => { const i = arr.indexOf(x); i < 0 ? arr.push(x) : arr.splice(i, 1); };
      if (f === 'tag') tog(st.tagIds, v);
      else if (f === 'meal') tog(st.meals, v);
      else if (f === 'diff') tog(st.diff, +v);
      else if (f === 'time') st.maxTime = +v;
      else if (f === 'noPhoto') st.noPhoto = !st.noPhoto;
      else if (f === 'noTags') st.noTags = !st.noTags;
      this._refresh(); this._syncFilters();
    });
    el.addEventListener('input', e => {
      if (e.target.id !== 'rc-f-ing') return;
      st.ingredient = e.target.value; this._refresh(); this._syncFilters();
    });
    document.body.appendChild(el);
    this._syncFilters();
  },
  _syncFilters() {
    const m = document.getElementById('rc-filter-modal'); if (!m) return;
    const st = this._state;
    m.querySelectorAll('[data-f]').forEach(c => {
      const f = c.dataset.f, v = c.dataset.v;
      const on = f === 'tag' ? st.tagIds.includes(v) : f === 'meal' ? st.meals.includes(v) : f === 'diff' ? st.diff.includes(+v)
        : f === 'time' ? st.maxTime === +v : f === 'noPhoto' ? st.noPhoto : st.noTags;
      c.classList.toggle('on', on);
    });
    m.querySelector('[data-apply]').textContent = 'Показать: ' + this._all.filter(r => this._match(r)).length;
  },
};

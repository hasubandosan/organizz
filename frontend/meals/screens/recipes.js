// МенюПлан — screens/recipes.js: список рецептов (поиск, коллекции, теги)
'use strict';

const RecipesScreen = {
  _all: [], _tags: [], _state: { search: '', collectionId: '', tagId: '' },

  async render(container) {
    const [recipes, collections, tags] = await Promise.all([Recipes.list(), Collections.list(), mealTagOptions()]);
    this._all = recipes; this._tags = tags;
    const st = this._state;
    const usedTagIds = new Set(recipes.flatMap(r => r.tagIds || []));
    const usedTags = tags.filter(t => usedTagIds.has(t.id));

    let html = '<div class="screen"><div class="screen-title">Рецепты</div>';
    html += '<div class="search-bar"><span class="search-icon">🔍</span><input type="text" id="rc-search" placeholder="Поиск рецептов..." value="' + esc(st.search) + '"></div>';
    html += '<div class="mp-actions"><button class="menu-action-btn" onclick="Router.go(\'recipe.new\')">➕ Новый рецепт</button>';
    html += '<button class="menu-action-btn" onclick="AIImport.open()">🤖 Импорт через ИИ</button></div>';

    if (collections.length) {
      html += '<div class="mp-chips" id="rc-cols"><span class="mp-chip' + (!st.collectionId ? ' on' : '') + '" data-col="">Все</span>';
      for (const c of collections) html += `<span class="mp-chip${st.collectionId === c.id ? ' on' : ''}" data-col="${esc(c.id)}">${esc(c.emoji || '📚')} ${esc(c.name)}</span>`;
      html += '</div>';
    }
    if (usedTags.length) {
      html += '<div class="mp-chips" id="rc-tags"><span class="mp-chip' + (!st.tagId ? ' on' : '') + '" data-tag="">Все теги</span>';
      for (const t of usedTags) html += `<span class="mp-chip${st.tagId === t.id ? ' on' : ''}" data-tag="${esc(t.id)}">${esc(t.name)}</span>`;
      html += '</div>';
    }
    html += '<div id="rc-grid"></div></div>';
    container.innerHTML = html;
    LifeShell.update({ title: 'Рецепты' });

    document.getElementById('rc-search').addEventListener('input', e => { st.search = e.target.value; this._grid(); });
    container.querySelectorAll('#rc-cols .mp-chip').forEach(el => el.addEventListener('click', () => { st.collectionId = el.dataset.col; this.render(container); }));
    container.querySelectorAll('#rc-tags .mp-chip').forEach(el => el.addEventListener('click', () => { st.tagId = el.dataset.tag; this.render(container); }));
    this._grid();
  },

  _grid() {
    const st = this._state, q = st.search.trim().toLowerCase();
    const items = this._all.filter(r =>
      (!q || (r.name || '').toLowerCase().includes(q)) &&
      (!st.collectionId || r.collectionId === st.collectionId) &&
      (!st.tagId || (r.tagIds || []).includes(st.tagId)));
    const box = document.getElementById('rc-grid');
    box.innerHTML = items.length
      ? '<div class="recipe-grid">' + items.map(MealComponents.recipeCard).join('') + '</div>'
      : '<div class="empty"><div class="empty-icon">📖</div><div class="empty-title">' + (this._all.length ? 'Ничего не найдено' : 'Пока нет рецептов') + '</div></div>';
    loadImages(box);
  },
};

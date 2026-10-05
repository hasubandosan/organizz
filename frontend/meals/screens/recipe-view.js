// МенюПлан — screens/recipe-view.js
'use strict';

const RecipeViewScreen = {
  async render(container, data) {
    const r = data?.id ? await Recipes.get(data.id) : null;
    if (!r) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">😕</div><div class="empty-title">Рецепт не найден</div></div>';
      return;
    }
    const [tags, collections] = await Promise.all([mealTagOptions(), Collections.list()]);
    const tagName = id => tags.find(t => t.id === id)?.name;
    const col = collections.find(c => c.id === r.collectionId);

    let h = '<div class="screen recipe-view"><div class="rv-header">';
    h += '<button class="icon-btn" onclick="Router.back()">←</button><span style="flex:1"></span>';
    h += `<button class="icon-btn" onclick="Router.go('recipe.edit', { id: '${esc(r.id)}' })">✏️</button>`;
    h += `<button class="icon-btn" onclick="RecipeViewScreen._del('${esc(r.id)}')">🗑</button></div>`;

    h += r.imageId ? `<img class="rv-image" data-img="${esc(r.imageId)}" alt="">` : `<div class="rv-emoji">${esc(r.emoji || '🍽️')}</div>`;
    h += `<h2 class="rv-title">${esc(r.name)}</h2>`;
    if (r.description) h += `<p class="rv-desc">${esc(r.description)}</p>`;
    h += `<div class="rv-meta"><span>⏱ ${+r.cookTimeMin || 0} мин</span><span class="difficulty-stars">${MealComponents.stars(r.difficulty)}</span><span>👤 ${+r.portions || 4} порц.</span>`;
    if (col) h += `<span>${esc(col.emoji || '📚')} ${esc(col.name)}</span>`;
    h += '</div>';

    const names = (r.tagIds || []).map(tagName).filter(Boolean);
    if (names.length) h += '<div class="rv-tags">' + names.map(n => `<span class="rv-tag">${esc(n)}</span>`).join('') + '</div>';

    this._r = r; this._n = Math.max(1, +r.portions || 4);
    if ((r.ingredients || []).length) {
      h += '<div class="rv-section"><div class="rv-ing-head"><h3>🧂 Ингредиенты</h3>';
      h += '<div class="portion-stepper"><button class="icon-btn" onclick="RecipeViewScreen._step(-1)">−</button>';
      h += '<span id="rv-portions"></span><button class="icon-btn" onclick="RecipeViewScreen._step(1)">+</button></div></div>';
      h += '<ul class="rv-ingredients" id="rv-ing-list"></ul></div>';
    }
    if ((r.steps || []).length) {
      h += '<div class="rv-section"><h3>📝 Приготовление</h3><ol class="rv-steps">';
      r.steps.forEach((s, n) => {
        h += `<li><span class="step-num">${n + 1}</span><span class="step-text">${esc(s.text)}</span>`;
        if (s.timerMin) h += `<span class="step-timer">⏱ ${+s.timerMin} мин</span>`;
        if (s.tip) h += `<span class="step-tip">💡 ${esc(s.tip)}</span>`;
        h += '</li>';
      });
      h += '</ol></div>';
    }
    if ((r.recommendedMeals || []).length) h += '<div class="rv-section"><h3>🍽️ Рекомендуется для</h3><div class="rv-tags">' + r.recommendedMeals.map(m => `<span class="rv-tag">${esc(m)}</span>`).join('') + '</div></div>';
    if (r.notes) h += `<div class="rv-section"><h3>📌 Заметки</h3><div class="rv-notes">${esc(r.notes)}</div></div>`;
    if (r.sourceUrl) h += `<div class="rv-section"><a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">🔗 Источник</a></div>`;
    h += '</div>';

    container.innerHTML = h;
    this._renderIngredients();
    document.getElementById('header-title').textContent = r.name;
    document.getElementById('header-icon').textContent = r.emoji || '🍽️';
  },

  // ── масштабирование порций (только просмотр, сам рецепт не меняется) ──
  _step(d) {
    this._n = Math.min(99, Math.max(1, this._n + d));
    this._renderIngredients();
  },

  _fmt(n) {
    const v = Math.round(n * 100) / 100;                  // до сотых
    return String(v).replace('.', ',');
  },

  _renderIngredients() {
    const list = document.getElementById('rv-ing-list');
    if (!list) return;
    const r = this._r, base = Math.max(1, +r.portions || 4), k = this._n / base;
    document.getElementById('rv-portions').textContent = this._n + ' порц.' + (this._n !== base ? ` (×${this._fmt(k)})` : '');
    list.innerHTML = r.ingredients.map(i => {
      const q = i.qty ? `${esc(this._fmt(i.qty * k))} ${esc(i.unit || '')}` : '';
      return `<li><span class="ing-qty">${q}</span> <span class="ing-name">${esc(i.name)}</span>${i.note ? `<span class="ing-note-view">${esc(i.note)}</span>` : ''}</li>`;
    }).join('');
  },

  async _del(id) {
    if (!confirm('Удалить рецепт?')) return;
    try { await Recipes.del(id); toast('Рецепт удалён'); Router.go('recipes', null, { reset: true }); }
    catch (e) { toast('Ошибка: ' + e.message, 'err'); }
  },
};

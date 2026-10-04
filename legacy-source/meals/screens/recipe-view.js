// МенюПлан — screens/recipe-view.js
'use strict';

const RecipeViewScreen = {
  async render(container, recipeOrId) {
    const id = recipeOrId?.id || recipeOrId;
    if (!id) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">😕</div><div class="empty-title">Рецепт не найден</div></div>';
      return;
    }

    // Загружаем полноценные данные
    const fullRecipe = await Recipes.get(id);
    if (!fullRecipe) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">😕</div><div class="empty-title">Рецепт не найден</div></div>';
      return;
    }

    const recipe = fullRecipe;

    // Считаем БЖУ
    let nutr = { p: 0, f: 0, c: 0, kcal: 0, cost: 0 };
    try {
      nutr = await Nutrition.recipeNutrition(fullRecipe, fullRecipe.portions || 1);
    } catch (e) { console.warn('[RecipeView] nutrition error:', e); }

    const diffStars = [1, 2, 3].map(i => `<span class="${i <= (fullRecipe.difficulty || 1) ? 'star-on' : 'star-off'}">★</span>`).join('');

    let html = '<div class="screen recipe-view">';

    // Хедер
    html += '<div class="rv-header">';
    html += `<button class="icon-btn" onclick="Router.back()">←</button>`;
    html += `<button class="icon-btn" onclick="Router.go('recipe.edit', { id: '${fullRecipe.id}' })">✏️</button>`;
    html += `<button class="icon-btn" onclick="Router.go('recipe.cook', { id: '${fullRecipe.id}' })">👨‍🍳</button>`;
    html += '</div>';

    // Название и мета
    html += `<div class="rv-emoji">${fullRecipe.emoji || '🍽️'}</div>`;
    html += `<h2 class="rv-title">${fullRecipe.name}</h2>`;
    if (fullRecipe.description) html += `<p class="rv-desc">${fullRecipe.description}</p>`;
    html += `<div class="rv-meta">`;
    html += `<span>⏱ ${fullRecipe.cookTimeMin || 0} мин</span>`;
    html += `<span>${diffStars}</span>`;
    html += `<span>👤 ${fullRecipe.portions || 4} порции</span>`;
    html += '</div>';

    // Теги
    if (fullRecipe.tags && fullRecipe.tags.length) {
      html += '<div class="rv-tags">';
      for (const t of fullRecipe.tags) {
        html += `<span class="rv-tag">${t}</span>`;
      }
      html += '</div>';
    }

    // БЖУ карточка
    html += '<div class="rv-nutrition">';
    html += `<div class="nutr-item"><span class="nutr-val">${nutr.kcal}</span><span class="nutr-label">ккал</span></div>`;
    html += `<div class="nutr-item"><span class="nutr-val">${nutr.p}</span><span class="nutr-label">белки</span></div>`;
    html += `<div class="nutr-item"><span class="nutr-val">${nutr.f}</span><span class="nutr-label">жиры</span></div>`;
    html += `<div class="nutr-item"><span class="nutr-val">${nutr.c}</span><span class="nutr-label">углеводы</span></div>`;
    html += `<div class="nutr-item"><span class="nutr-val">${nutr.cost}₽</span><span class="nutr-label">цена</span></div>`;
    html += '</div>';

    // Ингредиенты
    html += '<div class="rv-section"><h3>🧂 Ингредиенты</h3><ul class="rv-ingredients">';
    for (const ing of (fullRecipe.ingredients || [])) {
      html += `<li><span class="ing-qty">${ing.qty} ${ing.unit || ''}</span> <span class="ing-name">${ing.name || 'Ингредиент'}</span></li>`;
    }
    html += '</ul></div>';

    // Шаги
    html += '<div class="rv-section"><h3>📝 Приготовление</h3><ol class="rv-steps">';
    for (let i = 0; i < (fullRecipe.steps || []).length; i++) {
      const s = fullRecipe.steps[i];
      html += '<li>';
      html += `<span class="step-num">${i + 1}</span>`;
      html += `<span class="step-text">${typeof s === 'string' ? s : s.text || ''}</span>`;
      if (s.timerMin) html += `<span class="step-timer">⏱ ${s.timerMin} мин</span>`;
      if (s.tip) html += `<span class="step-tip">💡 ${s.tip}</span>`;
      html += '</li>';
    }
    html += '</ol></div>';

    // Рекомендуемые приёмы пищи
    if (fullRecipe.recommendedMeals && fullRecipe.recommendedMeals.length) {
      html += '<div class="rv-section"><h3>🍽️ Рекомендуется для</h3><div class="rv-meal-types">';
      for (const rm of fullRecipe.recommendedMeals) html += `<span class="rv-meal-tag">${rm}</span>`;
      html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;
    document.getElementById('header-title').textContent = fullRecipe.name;
    document.getElementById('header-icon').textContent = fullRecipe.emoji || '🍽️';
  }
};
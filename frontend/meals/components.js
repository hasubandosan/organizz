// МенюПлан — components.js
'use strict';

const MealComponents = {};

MealComponents.stars = function (n, on = 'on') {
  return [1, 2, 3].map(i => `<span class="${i <= (n || 1) ? on : ''}">★</span>`).join('');
};

MealComponents.recipeCard = function (r) {
  const pic = r.imageId
    ? `<img data-img="${esc(r.imageId)}" alt="">`
    : `<span>${esc(r.emoji || '🍽️')}</span>`;
  return `<div class="recipe-card" onclick="Router.go('recipe.view', { id: '${esc(r.id)}' })">
    <div class="recipe-card-img">${pic}</div>
    <div class="recipe-card-body">
      <div class="recipe-card-name">${esc(r.name)}</div>
      <div class="recipe-card-meta">
        <span>⏱ ${+r.cookTimeMin || 0} мин</span>
        <span class="difficulty-stars">${MealComponents.stars(r.difficulty)}</span>
        <span>👤 ${+r.portions || 4}</span>
      </div>
    </div>
  </div>`;
};

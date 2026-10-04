// МенюПлан — components.js (DEMO заглушка)
'use strict';

const MealComponents = {};

/**
 * Рендерит карточку рецепта
 */
MealComponents.recipeCard = function(recipe) {
  const diffStars = '<div class="difficulty-stars">' +
    [1,2,3].map(i => `<span class="${i <= (recipe.difficulty||1) ? 'on' : ''}">★</span>`).join('') +
    '</div>';
  return `<div class="recipe-card" data-id="${recipe.id}" onclick="Router.go('recipe.view')">
    <div class="recipe-card-img">
      <span>${recipe.emoji || '🍽️'}</span>
    </div>
    <div class="recipe-card-body">
      <div class="recipe-card-name">${recipe.name}</div>
      <div class="recipe-card-meta">
        <span>⏱ ${recipe.cookTimeMin || 0} мин</span>
        <span>${diffStars}</span>
        <span>👤 ${recipe.portions || 4} порц.</span>
      </div>
    </div>
  </div>`;
};

/**
 * Рендерит чип рецепта для сетки меню
 */
MealComponents.recipeChip = function(recipe) {
  return `<span class="recipe-chip" draggable="true">${recipe.emoji || '🍽️'} ${recipe.name}</span>`;
};
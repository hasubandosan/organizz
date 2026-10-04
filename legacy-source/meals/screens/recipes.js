// МенюПлан — screens/recipes.js (DEMO)
'use strict';

const RecipesScreen = {
  async render(container) {
    const recipes = await Recipes.list();
    let html = '<div class="screen"><div class="screen-title">Рецепты</div>';
    if (!recipes.length) {
      html += '<div class="empty"><div class="empty-icon">📖</div><div class="empty-title">Нет рецептов</div></div>';
    } else {
      html += '<div class="recipe-grid">';
      for (const r of recipes) {
        html += MealComponents.recipeCard(r);
      }
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
    document.getElementById('header-title').textContent = 'Рецепты';
    document.getElementById('header-icon').textContent = '📖';
  }
};

const RecipeCookScreen = {
  async render(container, recipe) {
    container.innerHTML = `
      <div class="screen">
        <div class="pe-header">
          <button class="icon-btn" onclick="Router.back()">←</button>
          <h2>Готовим: ${recipe?.name || 'Рецепт'}</h2>
        </div>
        <div class="empty">
          <div class="empty-icon">👨‍🍳</div>
          <div class="empty-title">Режим пошаговой готовки</div>
          <div class="empty-desc">Функционал находится в разработке. Скоро здесь будут таймеры и озвучивание шагов!</div>
        </div>
      </div>
    `;
    document.getElementById('header-title').textContent = 'Готовим';
  }
};

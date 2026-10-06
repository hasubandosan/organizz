/* app.js — запуск модуля «Питание»: инициализация ядра, роуты, навигация */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await lifeosInit();   // при отсутствии токена ядро само отправит на страницу входа
  } catch (e) {
    console.warn('[Питание] lifeosInit:', e.message);
    if (!localStorage.getItem('token')) return;   // идёт редирект на логин
  }

  document.getElementById('bottom-nav').classList.remove('hidden');
  LifeShell.mount({ module: 'meals', title: 'Кухня', replace: '#app-header' });

  Router.register('home',         HomeScreen);
  Router.register('recipes',      RecipesScreen);
  Router.register('recipe.view',  RecipeViewScreen);
  Router.register('recipe.edit',  RecipeEditScreen);
  Router.register('recipe.new',   RecipeEditScreen);
  Router.register('collections',  CollectionsScreen);
  Router.register('products',           ProductsScreen);
  Router.register('product.new',        ProductEditScreen);   // теперь экран «предложить продукт»
  Router.register('product.edit',       ProductEditScreen);   // теперь экран «предложить правку»
  Router.register('product.suggestions', SuggestionsScreen);  // предложка: голосование

  document.querySelectorAll('.nav-item').forEach(btn =>
    btn.addEventListener('click', () => Router.go(btn.dataset.route, null, { reset: true })));

  await Router.go('home', null, { reset: true });
});

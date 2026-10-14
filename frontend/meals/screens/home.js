// Кухня — screens/home.js: сверху план питания (таблица недели/дня), ниже полка с книгами и превью рецептов
'use strict';

const HomeScreen = {
  async render(container) {
    const [recipes, cols] = await Promise.all([Recipes.list(), Collections.list()]);
    const byNew = [...recipes].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    let h = '<div class="lo-page kt-home"><section class="kt-sec" id="kt-planbox"></section>';

    // 2. Полка с книгами (энциклопедия продуктов — первой на полке)
    h += '<section class="kt-sec"><div class="kt-h"><h2>Библиотека</h2><span class="sp"></span><button class="kt-link" id="kt-books">Все книги →</button></div><div class="kt-shelf">';
    h += '<div class="kt-book enc" data-go="products"><div class="kt-bc">🥕</div><div class="kt-bt">Энциклопедия продуктов</div></div>';
    for (const c of cols) {
      const n = recipes.filter(r => r.collectionId === c.id).length;
      const bi = c.imageId ? `<img class="kt-bimg" data-img="${esc(c.imageId)}" alt="">` : '';
      h += `<div class="kt-book${c.imageId ? ' pic' : ''}" data-col="${esc(c.id)}">${bi}<div class="kt-bc">${esc(c.emoji || '📚')}</div><div class="kt-bt">${esc(c.name)}</div><div class="kt-bn">${n}</div></div>`;
    }
    h += '</div></section>';

    // 3. Рецепты — превью (полный список в отдельном окне)
    h += `<section class="kt-sec"><div class="kt-h"><h2>Рецепты</h2><span class="kt-n">${recipes.length}</span><span class="sp"></span><button class="kt-link" id="kt-all">Все ${recipes.length} →</button></div>`;
    if (recipes.length) {
      h += '<div class="kt-hscroll">' + byNew.slice(0, 8).map(r => `<div class="kt-rc">${MealComponents.recipeCard(r)}</div>`).join('') + '</div>';
    } else {
      h += '<div class="kt-empty">Пока нет рецептов — добавьте первый кнопкой ниже</div>';
    }
    h += '<button class="kt-main" id="kt-new">＋ Рецепт</button></section>';

    container.innerHTML = h + '</div>';
    await PlanScreen.render(document.getElementById('kt-planbox'));

    const $ = id => document.getElementById(id);
    $('kt-new').addEventListener('click', () => Router.go('recipe.new'));
    $('kt-all').addEventListener('click', () => { RecipesScreen._state.collectionId = ''; Router.go('recipes'); });
    $('kt-books').addEventListener('click', () => Router.go('collections'));
    container.querySelector('.kt-home').addEventListener('click', e => {
      const b = e.target.closest('.kt-book');
      if (!b) return;
      if (b.dataset.go) Router.go(b.dataset.go);
      else { RecipesScreen._state.collectionId = b.dataset.col; Router.go('recipes'); }
    });
    LifeShell.update({ title: 'Кухня', actions: [{ icon: '＋', label: 'Новый рецепт', onClick: () => Router.go('recipe.new') }] });
  },
};

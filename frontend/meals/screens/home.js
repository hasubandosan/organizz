// Кухня — screens/home.js: план питания (макет), рецепты, полка с книгами, помощники
'use strict';

const HomeScreen = {
  _DAYS: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],

  async render(container) {
    const [recipes, cols, people] = await Promise.all([Recipes.list(), Collections.list(), People.list().catch(() => [])]);
    const byNew = [...recipes].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const today = (new Date().getDay() + 6) % 7;   // Пн=0

    let h = '<div class="lo-page kt-home">';

    // 1. План питания (макет — позже подключим меню недели)
    h += '<section class="kt-sec"><div class="kt-h"><h2>План питания</h2><span class="kt-tag">макет</span></div>';
    h += '<div class="kt-days">' + this._DAYS.map((d, i) => `<span class="kt-day${i === today ? ' on' : ''}">${d}</span>`).join('') + '</div>';
    h += '<div class="kt-plan">' + MEAL_TYPES.slice(0, 3).map(m => {
      const r = recipes.find(x => (x.recommendedMeals || []).includes(m));
      const pic = r && r.imageId ? `<img data-img="${esc(r.imageId)}" alt="">` : `<span>${esc(r ? (r.emoji || '🍽️') : '＋')}</span>`;
      return `<div class="kt-meal${r ? '' : ' empty'}"${r ? ` data-rid="${esc(r.id)}"` : ''}>
        <div class="kt-mpic">${pic}</div>
        <div class="kt-mtxt"><div class="kt-mtype">${m}</div><div class="kt-mname">${r ? esc(r.name) : 'Не запланировано'}</div></div></div>`;
    }).join('') + '</div></section>';

    // 2. Рецепты
    h += `<section class="kt-sec"><div class="kt-h"><h2>Рецепты</h2><span class="kt-n">${recipes.length}</span><span class="sp"></span><button class="kt-link" id="kt-all">Все →</button></div>`;
    if (recipes.length) {
      h += '<div class="kt-hscroll">' + byNew.slice(0, 12).map(r => `<div class="kt-rc">${MealComponents.recipeCard(r)}</div>`).join('') + '</div>';
    } else {
      h += '<div class="kt-empty">Пока нет рецептов — добавьте первый кнопкой ниже</div>';
    }
    h += '<button class="kt-main" id="kt-new">＋ Рецепт</button></section>';

    // 3. Полка с книгами (энциклопедия продуктов — первой на полке)
    h += '<section class="kt-sec"><div class="kt-h"><h2>Полка</h2><span class="sp"></span><button class="kt-link" id="kt-books">Все книги →</button></div><div class="kt-shelf">';
    h += '<div class="kt-book enc" data-go="products"><div class="kt-bc">🥕</div><div class="kt-bt">Энциклопедия продуктов</div></div>';
    for (const c of cols) {
      const n = recipes.filter(r => r.collectionId === c.id).length;
      const bi = c.imageId ? `<img class="kt-bimg" data-img="${esc(c.imageId)}" alt="">` : '';
      h += `<div class="kt-book${c.imageId ? ' pic' : ''}" data-col="${esc(c.id)}">${bi}<div class="kt-bc">${esc(c.emoji || '📚')}</div><div class="kt-bt">${esc(c.name)}</div><div class="kt-bn">${n}</div></div>`;
    }
    h += '</div></section>';

    // 4. Помощники (люди)
    h += '<section class="kt-sec"><div class="kt-h"><h2>Помощники</h2><span class="sp"></span><button class="kt-link" id="kt-people">Все →</button></div><div class="kt-people">';
    for (const p of people.slice(0, 10)) h += `<div class="kt-person" data-go="people"><span class="kt-pe">${esc(p.emoji || '🙂')}</span><span>${esc(p.name)}</span></div>`;
    h += '<div class="kt-person add" id="kt-addp"><span class="kt-pe">＋</span><span>Добавить</span></div></div></section>';

    container.innerHTML = h + '</div>';

    const $ = id => document.getElementById(id);
    $('kt-new').addEventListener('click', () => Router.go('recipe.new'));
    $('kt-all').addEventListener('click', () => { RecipesScreen._state.collectionId = ''; Router.go('recipes'); });
    $('kt-books').addEventListener('click', () => Router.go('collections'));
    $('kt-people').addEventListener('click', () => Router.go('people'));
    $('kt-addp').addEventListener('click', () => Router.go('people', { add: true }));
    container.querySelector('.kt-home').addEventListener('click', e => {
      const rid = e.target.closest('[data-rid]');
      if (rid) return Router.go('recipe.view', { id: rid.dataset.rid });
      const pp = e.target.closest('.kt-person[data-go]');
      if (pp) return Router.go('people');
      const b = e.target.closest('.kt-book');
      if (!b) return;
      if (b.dataset.go) Router.go(b.dataset.go);
      else { RecipesScreen._state.collectionId = b.dataset.col; Router.go('recipes'); }
    });
    LifeShell.update({ title: 'Кухня', actions: [{ icon: '＋', label: 'Новый рецепт', onClick: () => Router.go('recipe.new') }] });
  },
};

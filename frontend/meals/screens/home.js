// Кухня — screens/home.js: стартовая страница с крупными плитками
'use strict';

const HomeScreen = {
  async render(container) {
    const [recipes, cols] = await Promise.all([Recipes.list(), Collections.list()]);
    let prodN = null;
    try { prodN = (await Products.list()).length; } catch (e) { /* каталог недоступен — счётчик просто не покажем */ }

    // фото плитки: обложка первого рецепта с картинкой (для книг — из рецептов, лежащих в книгах)
    const withImg = list => list.find(r => r.imageId);
    const anyPic = withImg(recipes);
    const colPic = withImg(recipes.filter(r => r.collectionId));

    const tiles = [
      { route: 'collections', emoji: '📚', title: 'Книги рецептов', cnt: cols.length, unit: this._plural(cols.length, ['книга', 'книги', 'книг']), pic: colPic },
      { route: 'recipes',     emoji: '🍽️', title: 'Все рецепты',    cnt: recipes.length, unit: this._plural(recipes.length, ['рецепт', 'рецепта', 'рецептов']), pic: anyPic },
      { route: null,          emoji: '🗓️', title: 'Меню недели',    soon: true },
      { route: null,          emoji: '👥', title: 'Люди',           soon: true },
      { route: 'products',    emoji: '🥕', title: 'Продукты',       cnt: prodN, unit: prodN == null ? '' : this._plural(prodN, ['продукт', 'продукта', 'продуктов']) },
    ];

    let h = '<div class="lo-page kt-home"><div class="lo-grid" style="--col:150px">';
    for (const t of tiles) {
      const pic = t.pic ? `<img data-img="${esc(t.pic.imageId)}" alt="">` : `<span class="kt-emoji">${t.emoji}</span>`;
      const sub = t.soon ? '<span class="kt-soon">скоро</span>' : (t.cnt == null ? '' : `<span class="kt-cnt">${t.cnt} ${t.unit}</span>`);
      h += `<div class="kt-tile${t.soon ? ' soon' : ''}" ${t.route ? `data-route="${t.route}"` : ''}>
        <div class="kt-pic">${pic}</div>
        <div class="kt-body"><div class="kt-title">${esc(t.title)}</div>${sub}</div></div>`;
    }
    h += '</div><button class="kt-main" id="kt-new">＋ Рецепт</button></div>';
    container.innerHTML = h;

    container.querySelectorAll('.kt-tile[data-route]').forEach(el =>
      el.addEventListener('click', () => Router.go(el.dataset.route)));
    document.getElementById('kt-new').addEventListener('click', () => Router.go('recipe.new'));
    LifeShell.update({ title: 'Кухня', actions: [{ icon: '＋', label: 'Новый рецепт', onClick: () => Router.go('recipe.new') }] });
  },

  _plural(n, f) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f[2];
    if (b > 1 && b < 5) return f[1];
    return b === 1 ? f[0] : f[2];
  },
};

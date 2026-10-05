// Роутер модуля «Питание»: стек экранов, кнопка «назад», подсветка вкладки
'use strict';

const Router = {
  _routes: {}, _stack: [],
  _tabOf: { recipe: 'recipes', recipes: 'recipes', collections: 'collections', product: 'products', products: 'products' },

  register(name, screen) { this._routes[name] = screen; },

  async go(name, data, opts = {}) {
    if (!this._routes[name]) { console.warn('[Router] Unknown route:', name); return; }
    if (opts.reset) this._stack = [];
    if (opts.replace) this._stack.pop();
    this._stack.push({ name, data: data || null });
    await this._render(name, data || null);
  },

  async back() {
    if (this._stack.length > 1) {
      this._stack.pop();
      const t = this._stack[this._stack.length - 1];
      await this._render(t.name, t.data);
    } else {
      await this.go('recipes', null, { reset: true });
    }
  },

  async _render(name, data) {
    const container = document.getElementById('app-content');
    container.innerHTML = '<div class="empty"><div class="empty-icon">🍽️</div><div class="empty-desc">Загрузка…</div></div>';
    try {
      await Promise.race([
        this._routes[name].render(container, data),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Экран не ответил за 15 секунд')), 15000)),
      ]);
      if (window.loadImages) loadImages(container);
    } catch (e) {
      console.error('[Router] Screen error:', e);
      container.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-title">Ошибка загрузки</div><div class="empty-desc">${esc(e.message)}</div></div>`;
    }
    const tab = this._tabOf[name.split('.')[0]];
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.route === tab));
    LifeShell.update({ back: this._stack.length > 1 ? () => this.back() : null });
  },
};
window.Router = Router;

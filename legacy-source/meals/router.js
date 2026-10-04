// Minimal router implementation for LifeOS meals module with timeout
'use strict';

const Router = {
  _routes: {},
  _current: null,
  _data: null,

  register(name, screen) {
    this._routes[name] = screen;
  },

  async go(name, data) {
    const screen = this._routes[name];
    if (!screen) {
      console.warn('[Router] Unknown route:', name);
      return;
    }
    this._current = name;
    this._data = data || null;
    const container = document.getElementById('app-content');
    if (!container) {
      console.error('[Router] app-content container not found');
      return;
    }
    // Show loading spinner
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100dvh;flex-direction:column;gap:16px"><div style="font-size:56px">🍽️</div><div style="color:var(--text2);font-size:14px;font-family:var(--f)">Загрузка…</div></div>';
    try {
      // Race the screen render against a 10-second timeout
      await Promise.race([
        screen.render(container, this._data),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Screen render timeout')), 10000))
      ]);
    } catch (e) {
      console.error('[Router] Screen error:', e);
      container.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-title">Ошибка загрузки</div><div class="empty-desc">${e.message}</div></div>`;
    }
    // Highlight nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const nav = document.querySelector(`.nav-item[data-route="${name}"]`);
    if (nav) nav.classList.add('active');
  },

  back() {
    history.back();
  }
};

window.Router = Router;
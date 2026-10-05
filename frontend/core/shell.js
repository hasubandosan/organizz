// LifeOS — core/shell.js: единая шапка для всех модулей.
// Подключать после core/nav.js. Использование:
//   LifeShell.mount({ module: 'meals', title: 'Рецепты', back: () => Router.back(),
//                     actions: [{ icon: '＋', label: 'Новый', onClick: fn }] });
//   LifeShell.update({ title: 'Сырники', back: true });   // при смене экрана
// module — slug модуля (если не задан: <html data-module>, домен organizz-<slug>.pages.dev или LIFEOS_APP_SLUG).
// Шапка ставится первым элементом <body> (или вместо элемента opts.replace — селектор).
'use strict';

const LifeShell = (function () {
  const MODULES = {
    hub:       { label: 'LifeOS',  icon: '🏠', href: 'https://organizz-hub.pages.dev/' },
    projects:  { label: 'Проекты', icon: '📋', href: 'https://organizz-projects.pages.dev/' },
    meals:     { label: 'Питание', icon: '🍽', href: 'https://organizz-meals.pages.dev/' },
    purchases: { label: 'Покупки', icon: '🛒', href: 'https://organizz-purchases.pages.dev/' },
    cosplays:  { label: 'Косплеи', icon: '🎭', href: 'https://organizz-cosplays.pages.dev/' },
    admin:     { label: 'Админка', icon: '🛠', href: 'https://organizz-admin.pages.dev/' },
  };
  const ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let opts = {}, el = null, handlers = [];

  function detectModule(explicit) {
    const fromHost = (location.hostname.match(/^organizz-([a-z0-9]+)\.pages\.dev$/i) || [])[1];
    const slug = explicit || document.documentElement.dataset.module || fromHost || window.LIFEOS_APP_SLUG;
    return MODULES[slug] ? slug : 'hub';
  }

  function render() {
    const slug = opts.module, m = MODULES[slug];
    document.documentElement.dataset.module = slug;   // подключает акцентный цвет модуля
    handlers = [];
    const act = (opts.actions || []).map((a) => {
      const i = handlers.push(a.onClick) - 1;
      const inner = a.html || esc(a.icon || '');
      const attrs = `class="lo-ib" ${a.id ? `id="${esc(a.id)}"` : ''} title="${esc(a.label || '')}" aria-label="${esc(a.label || '')}"`;
      return a.href ? `<a ${attrs} href="${esc(a.href)}">${inner}</a>` : `<button ${attrs} data-act="${i}">${inner}</button>`;
    }).join('');
    const back = opts.back ? `<button class="lo-ib" data-back title="Назад" aria-label="Назад">${ICON.back}</button>` : '';
    el.className = 'lo-header' + (opts.title ? ' has-crumb' : '');
    el.innerHTML = `${back}<a class="lo-mark" href="${esc(m.href)}" title="${esc(m.label)}">${m.icon}</a>
      <a class="lo-name" href="${esc(m.href)}">${esc(m.label)}</a>${opts.title ? `<span class="lo-crumb">${esc(opts.title)}</span>` : ''}
      <span class="lo-sp"></span>${act}
      <button class="lo-ib lo-switch" data-switch title="Другие модули" aria-label="Другие модули">${ICON.grid}</button>`;
  }

  function onClick(e) {
    const b = e.target.closest('button[data-act],button[data-back],button[data-switch]');
    if (!b || !el.contains(b)) return;
    if (b.hasAttribute('data-switch')) { if (window.LifeNav) LifeNav.toggle(); return; }
    if (b.hasAttribute('data-back')) { typeof opts.back === 'function' ? opts.back() : history.back(); return; }
    const fn = handlers[+b.dataset.act]; if (fn) fn(e);
  }

  function mount(o) {
    opts = { ...o, module: detectModule(o && o.module) };
    if (!el) {
      el = document.createElement('header');
      el.id = 'lifeos-header';
      el.addEventListener('click', onClick);
    }
    const old = opts.replace ? document.querySelector(opts.replace) : null;
    if (old) old.replaceWith(el); else if (!el.isConnected) document.body.insertBefore(el, document.body.firstChild);
    document.body.classList.add('lo-has-header');
    render();
    return el;
  }

  function update(patch) { if (!el) return mount(patch); opts = { ...opts, ...patch }; render(); return el; }

  return { mount, update, MODULES };
})();
window.LifeShell = LifeShell;

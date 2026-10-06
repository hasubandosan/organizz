// LifeOS — core/shell.js: единая шапка для всех модулей.
// Подключать после core/nav.js. Использование:
//   LifeShell.mount({ module: 'meals', title: 'Рецепты', back: () => Router.back(),
//                     actions: [{ icon: '＋', label: 'Новый', onClick: fn }] });
//   LifeShell.update({ title: 'Сырники', back: true });   // при смене экрана
// Справа всегда есть меню аккаунта (аватар → Аккаунт / Настройки / Выйти). Свои экраны можно подключить:
//   opts.onAccount / opts.onSettings — функции вместо встроенных окон; opts.account === false — скрыть меню.
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
  ICON.burger = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 8h14M5 12h14M5 16h14"/></svg>';
  const LOGIN_URL = 'https://organizz-login.pages.dev/';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let opts = {}, el = null, handlers = [], menu = null, dlg = null;

  const userEmail = () => { try { return localStorage.getItem('email') || ''; } catch (e) { return ''; } };
  const initial = (e) => ((e || '?').trim()[0] || '?').toUpperCase();

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
      <button class="lo-ib lo-switch" data-switch title="Другие модули" aria-label="Другие модули">${ICON.grid}</button>${opts.account === false ? '' : `
      <button class="lo-acct" data-acct title="Аккаунт" aria-label="Меню аккаунта" aria-haspopup="menu" aria-expanded="false">${ICON.burger}<span class="lo-ava">${esc(initial(userEmail()))}</span></button>`}`;
  }

  // ── меню аккаунта ──
  function menuOpen() { return !!menu && menu.classList.contains('open'); }
  function closeMenu() {
    if (menu) menu.classList.remove('open');
    const b = el && el.querySelector('[data-acct]'); if (b) b.setAttribute('aria-expanded', 'false');
  }
  function toggleMenu() {
    if (menuOpen()) return closeMenu();
    if (window.LifeNav) LifeNav.close();
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'lifeos-acct-menu'; menu.setAttribute('role', 'menu');
      menu.addEventListener('click', onMenuClick);
      document.body.appendChild(menu);
    }
    const e = userEmail();
    // opts.menuItems — пункты, которые добавляет конкретный модуль (например «Зоны» в покупках)
    const mi = (opts.menuItems || []).map((x, i) => `<button role="menuitem" data-mi="${i}">${x.icon ? esc(x.icon) + ' ' : ''}${esc(x.label)}</button>`).join('');
    menu.innerHTML = `<div class="lo-mh"><span class="lo-ava lg">${esc(initial(e))}</span><div class="lo-mi"><b>${e ? 'Аккаунт' : 'Гость'}</b><span>${esc(e || 'вход не выполнен')}</span></div></div>
      ${mi ? mi + '<div class="lo-msep"></div>' : ''}
      <button role="menuitem" data-m="account">👤 Аккаунт</button>
      <button role="menuitem" data-m="settings">⚙️ Настройки</button>
      <div class="lo-msep"></div>
      <button role="menuitem" data-m="logout" class="danger">⎋ Выйти</button>`;
    menu.classList.add('open');
    const b = el.querySelector('[data-acct]'); if (b) b.setAttribute('aria-expanded', 'true');
  }
  function onMenuClick(e) {
    const mi = e.target.closest('[data-mi]');
    if (mi) { closeMenu(); const it = (opts.menuItems || [])[+mi.dataset.mi]; if (it && typeof it.onClick === 'function') it.onClick(); return; }
    const b = e.target.closest('[data-m]'); if (!b) return;
    closeMenu(); runItem(b.dataset.m);
  }
  function runItem(kind) {
    if (kind === 'logout') return logout();
    if (kind === 'account' && typeof opts.onAccount === 'function') return opts.onAccount();
    if (kind === 'settings' && typeof opts.onSettings === 'function') return opts.onSettings();
    showDialog(kind);
  }
  function logout() {
    if (!confirm('Выйти из аккаунта?')) return;
    try { localStorage.removeItem('token'); localStorage.removeItem('email'); sessionStorage.removeItem('lifeos_isAdmin'); } catch (e) {}
    location.href = LOGIN_URL + '?logout=1';
  }
  function closeDialog() { if (dlg) { dlg.remove(); dlg = null; } }
  function showDialog(kind) {
    closeDialog();
    const e = userEmail();
    const title = kind === 'settings' ? 'Настройки' : 'Аккаунт';
    const body = kind === 'settings'
      ? '<p>Раздел в разработке: настройки интерфейса появятся здесь.</p>'
      : `<div class="lo-dh"><span class="lo-ava xl">${esc(initial(e))}</span><div><b>${esc(e || 'Гость')}</b><span>Один вход для всех модулей LifeOS</span></div></div>
         <p>Данные каждого пользователя хранятся отдельно: другие аккаунты их не видят.</p>
         <div class="lo-df"><button class="danger" data-m="logout">Выйти</button></div>`;
    dlg = document.createElement('div');
    dlg.className = 'lo-dlg';
    dlg.innerHTML = `<div class="lo-dbox" role="dialog" aria-label="${title}"><div class="lo-dtop"><b>${title}</b><button class="lo-ib" data-close aria-label="Закрыть">✕</button></div>${body}</div>`;
    dlg.addEventListener('click', (ev) => {
      if (ev.target === dlg || ev.target.closest('[data-close]')) return closeDialog();
      const m = ev.target.closest('[data-m]'); if (m) { closeDialog(); runItem(m.dataset.m); }
    });
    document.body.appendChild(dlg);
  }
  document.addEventListener('click', (ev) => {
    if (menuOpen() && !menu.contains(ev.target) && !ev.target.closest('[data-acct]')) closeMenu();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { closeMenu(); closeDialog(); } });

  function onClick(e) {
    const b = e.target.closest('button[data-act],button[data-back],button[data-switch],button[data-acct]');
    if (!b || !el.contains(b)) return;
    if (b.hasAttribute('data-acct')) { toggleMenu(); return; }
    if (b.hasAttribute('data-switch')) { closeMenu(); if (window.LifeNav) LifeNav.toggle(); return; }
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

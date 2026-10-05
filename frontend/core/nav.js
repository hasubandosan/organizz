// LifeOS — core/nav.js: плавающая кнопка-навигация между модулями.
// Модули остаются раздельными (разные index.html, разный код) — это только
// способ быстро перейти из одного в другой. Подключать ОДНОЙ строкой после
// core/db.js на любой странице модуля (кроме login — там это не нужно):
//   <script src="../core/nav.js"></script>
'use strict';

const LIFEOS_MODULES = [
  { slug: 'hub',       label: 'Хаб',      icon: '🏠', href: '../hub/' },
  { slug: 'projects',  label: 'Проекты',  icon: '📋', href: '../projects/' },
  { slug: 'meals',     label: 'Рецепты',  icon: '🍽', href: '../meals/' },
  { slug: 'purchases', label: 'Покупки',  icon: '🛒', href: '../purchases/' },
  { slug: 'cosplays',  label: 'Косплеи',  icon: '🎭', href: '../cosplays/' },
  { slug: 'admin',     label: 'Админка',  icon: '🛠', href: '../admin/' },
];

(function initLifeosNav() {
  // Текущий модуль — по сегменту пути (frontend/<module>/index.html -> .../<module>/)
  const currentSlug = (location.pathname.match(/\/([a-z0-9_-]+)\/[^/]*$/i) || [])[1] || '';

  const style = document.createElement('style');
  style.textContent = `
    #lifeos-nav-btn {
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--accent, #5b6ef5); color: #fff; border: none;
      font-size: 22px; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.35);
      display: flex; align-items: center; justify-content: center;
    }
    #lifeos-nav-panel {
      position: fixed; bottom: 84px; right: 20px; z-index: 9999;
      background: var(--bg3, #18181f); border: 1px solid var(--border, #252530);
      border-radius: 12px; padding: 8px; min-width: 180px;
      box-shadow: 0 8px 24px rgba(0,0,0,.4);
      display: none; flex-direction: column; gap: 2px;
    }
    #lifeos-nav-panel.open { display: flex; }
    #lifeos-nav-panel a {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 8px; text-decoration: none;
      color: var(--text, #e8e8f0); font-size: 14px;
    }
    #lifeos-nav-panel a:hover { background: var(--bg4, #1e1e28); }
    #lifeos-nav-panel a.current { color: var(--text3, #55556a); pointer-events: none; }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'lifeos-nav-btn';
  btn.textContent = '🧭';
  btn.setAttribute('aria-label', 'Переключить модуль');

  const panel = document.createElement('div');
  panel.id = 'lifeos-nav-panel';
  panel.innerHTML = LIFEOS_MODULES.map(m =>
    `<a href="${m.href}" class="${m.slug === currentSlug ? 'current' : ''}">${m.icon} ${m.label}${m.slug === currentSlug ? ' (здесь)' : ''}</a>`
  ).join('');

  btn.addEventListener('click', () => panel.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open');
  });

  document.body.appendChild(panel);
  document.body.appendChild(btn);
})();

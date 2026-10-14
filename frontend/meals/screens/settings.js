// Кухня — screens/settings.js: настройки модуля (помощники, режимы питания). Позже помощники переедут в модуль «Отношения».
'use strict';

const SettingsScreen = {
  async render(container) {
    const [people, diets] = await Promise.all([People.list().catch(() => []), Diets.list().catch(() => [])]);
    const row = (icon, title, desc, route) => `<div class="card st-row" data-go="${route}"><span class="st-i">${icon}</span><div class="st-b"><div class="st-t">${title}</div><div class="st-d">${esc(desc)}</div></div><span class="st-a">›</span></div>`;
    container.innerHTML = '<div class="lo-page st-page">'
      + row('👥', 'Помощники', people.length ? people.map(p => (p.emoji || '🙂') + ' ' + p.name).join(', ') : 'Для кого готовим — влияет на число порций в плане', 'people')
      + row('🎯', 'Режимы питания', `${diets.length} шт. · бюджет, свойства продуктов, минимум ккал`, 'diets')
      + '</div>';
    container.querySelector('.st-page').onclick = e => { const r = e.target.closest('[data-go]'); if (r) Router.go(r.dataset.go); };
    LifeShell.update({ title: 'Настройки питания' });
  },
};

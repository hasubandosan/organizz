// МенюПлан — screens/collections.js (DEMO)
'use strict';

const CollectionsScreen = {
  async render(container) {
    const collections = await Collections.list();
    let html = '<div class="screen"><div class="screen-title">Коллекции</div>';
    if (!collections.length) {
      html += '<div class="empty"><div class="empty-icon">📚</div><div class="empty-title">Нет коллекций</div></div>';
    } else {
      for (const c of collections) {
        html += `<div class="col-card"><div class="col-emoji">${c.emoji || '📚'}</div><div class="col-body"><div class="col-name">${c.name}</div>${c.description ? `<div class="col-desc">${c.description}</div>` : ''}</div></div>`;
      }
    }
    html += '</div>';
    container.innerHTML = html;
    document.getElementById('header-title').textContent = 'Коллекции';
    document.getElementById('header-icon').textContent = '📚';
  }
};

const CollectionViewScreen = { async render(c) { c.innerHTML = '<div class="screen"><div class="screen-title">Коллекция</div></div>'; } };
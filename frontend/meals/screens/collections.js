// МенюПлан — screens/collections.js: коллекции рецептов
'use strict';

const CollectionsScreen = {
  async render(container) {
    const cols = await Collections.list();
    const recipes = await Recipes.list();
    let h = '<div class="screen"><div class="screen-title">Коллекции</div>';
    h += '<div class="mp-actions"><button class="menu-action-btn" onclick="CollectionsScreen._form()">➕ Новая коллекция</button></div>';
    h += '<div id="col-form"></div>';
    if (!cols.length) h += '<div class="empty"><div class="empty-icon">📚</div><div class="empty-title">Нет коллекций</div></div>';
    for (const c of cols) {
      const n = recipes.filter(r => r.collectionId === c.id).length;
      h += `<div class="col-card" onclick="CollectionsScreen._open('${esc(c.id)}')"><div class="col-emoji">${esc(c.emoji || '📚')}</div>
        <div class="col-body"><div class="col-name">${esc(c.name)}</div><div class="col-desc">${n} рец.${c.description ? ' · ' + esc(c.description) : ''}</div></div>
        <button class="icon-btn" onclick="event.stopPropagation();CollectionsScreen._form('${esc(c.id)}')">✏️</button>
        <button class="icon-btn" onclick="event.stopPropagation();CollectionsScreen._del('${esc(c.id)}')">🗑</button></div>`;
    }
    container.innerHTML = h + '</div>';
    document.getElementById('header-title').textContent = 'Коллекции';
    document.getElementById('header-icon').textContent = '📚';
  },

  _open(id) { RecipesScreen._state.collectionId = id; Router.go('recipes', null, { reset: true }); },

  async _form(id) {
    const c = id ? await DB.getById(MEAL_COL.collections, id) : { name: '', emoji: '📚', description: '' };
    document.getElementById('col-form').innerHTML = `<div class="re-form" style="margin:8px 0">
      <div class="re-row re-row-group"><div style="flex:0 0 70px"><label>Эмодзи</label><input id="cf-emoji" maxlength="4" value="${esc(c.emoji)}"></div>
      <div><label>Название</label><input id="cf-name" value="${esc(c.name)}"></div></div>
      <div class="re-row"><label>Описание</label><input id="cf-desc" value="${esc(c.description)}"></div>
      <button class="re-add-btn" onclick="CollectionsScreen._save('${id ? esc(id) : ''}')">💾 Сохранить</button></div>`;
  },

  async _save(id) {
    const name = document.getElementById('cf-name').value.trim();
    if (!name) { toast('Введите название', 'err'); return; }
    try {
      await Collections.save({ id: id || null, name, emoji: document.getElementById('cf-emoji').value || '📚', description: document.getElementById('cf-desc').value.trim() });
      this.render(document.getElementById('app-content'));
    } catch (e) { toast('Ошибка: ' + e.message, 'err'); }
  },

  async _del(id) {
    if (!confirm('Удалить коллекцию? Рецепты останутся, просто без коллекции.')) return;
    try { await Collections.del(id); RecipesScreen._state.collectionId = ''; this.render(document.getElementById('app-content')); }
    catch (e) { toast('Ошибка: ' + e.message, 'err'); }
  },
};

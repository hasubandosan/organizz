// Кухня — screens/collections.js: «Книги рецептов» (бывшие коллекции; данные те же — meal_collections)
'use strict';

const CollectionsScreen = {
  async render(container) {
    const [cols, recipes] = await Promise.all([Collections.list(), Recipes.list()]);
    let h = '<div class="lo-page bk-page"><div class="lo-grid" style="--col:150px">';
    h += `<div class="bk-card enc" onclick="Router.go('products')"><div class="bk-cover"><span class="bk-emoji">🥕</span></div>
      <div class="bk-body"><div class="bk-name">Энциклопедия продуктов</div><div class="bk-cnt">справочник</div></div></div>`;
    for (const c of cols) {
      const n = recipes.filter(r => r.collectionId === c.id).length;
      const cover = c.imageId ? `<img data-img="${esc(c.imageId)}" alt="">` : `<span class="bk-emoji">${esc(c.emoji || '📚')}</span>`;
      h += `<div class="bk-card" onclick="CollectionsScreen._open('${esc(c.id)}')">
        <div class="bk-cover">${cover}</div>
        <button class="bk-edit" title="Изменить" aria-label="Изменить книгу" onclick="event.stopPropagation();CollectionsScreen._form('${esc(c.id)}')">✏️</button>
        <div class="bk-body"><div class="bk-name">${esc(c.name)}</div><div class="bk-cnt">${n} ${this._plural(n)}</div></div></div>`;
    }
    h += '<div class="bk-card add" onclick="CollectionsScreen._form()"><div class="bk-cover"><span class="bk-emoji">＋</span></div><div class="bk-body"><div class="bk-name">Новая книга</div></div></div>';
    container.innerHTML = h + '</div></div>';
    LifeShell.update({ title: 'Книги рецептов', actions: [{ icon: '＋', label: 'Новая книга', onClick: () => this._form() }] });
  },

  _plural(n) {
    const a = n % 100, b = n % 10;
    return (a > 10 && a < 20) ? 'рецептов' : b === 1 ? 'рецепт' : (b > 1 && b < 5) ? 'рецепта' : 'рецептов';
  },

  _open(id) { RecipesScreen._state.collectionId = id; Router.go('recipes'); },

  // Форма: название + эмодзи; фото обложки — необязательно
  async _form(id) {
    const c = id ? await DB.getById(MEAL_COL.collections, id) : { name: '', emoji: '📚', imageId: null };
    this._ed = { id: id || null, imageId: c.imageId || null, newImage: null, removeImage: false };
    document.getElementById('bk-modal')?.remove();
    const ov = document.createElement('div');
    ov.className = 'modal-overlay'; ov.id = 'bk-modal';
    ov.innerHTML = `<div class="modal"><div class="modal-header"><span class="modal-title">${id ? 'Книга' : 'Новая книга'}</span>
        <button class="modal-close" aria-label="Закрыть" onclick="CollectionsScreen._close()">×</button></div>
      <div class="modal-body"><div class="re-row re-row-group"><div style="flex:0 0 76px"><label>Эмодзи</label><input id="bk-emoji" maxlength="4" value="${esc(c.emoji || '📚')}"></div>
        <div><label>Название</label><input id="bk-name" value="${esc(c.name)}" placeholder="Например, Быстрые ужины"></div></div>
        <div class="bk-photo"><div id="bk-prev"></div><button class="re-add-btn" type="button" id="bk-pick">📷 Фото обложки</button>
        <button class="re-add-btn" type="button" id="bk-rm" style="display:none">Убрать фото</button>
        <input type="file" id="bk-file" accept="image/*" style="display:none"></div></div>
      <div class="modal-footer">${id ? '<button class="re-add-btn" id="bk-del" style="color:var(--red)">🗑</button>' : ''}<span style="flex:1"></span>
        <button class="kt-main" id="bk-save" style="margin:0;max-width:200px">Сохранить</button></div></div>`;
    ov.addEventListener('click', e => { if (e.target === ov) this._close(); });
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));
    const $ = i => document.getElementById(i);
    $('bk-pick').onclick = () => $('bk-file').click();
    $('bk-rm').onclick = () => { this._ed.newImage = null; this._ed.removeImage = true; this._prev(); };
    $('bk-file').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { this._ed.newImage = await fileToResizedDataUrl(f, 900); this._ed.removeImage = false; this._prev(); }
      catch (err) { toast(err.message, 'err'); }
    };
    $('bk-save').onclick = () => this._save();
    if ($('bk-del')) $('bk-del').onclick = () => this._del(id);
    this._prev();
    $('bk-name').focus();
  },

  _prev() {
    const ed = this._ed, box = document.getElementById('bk-prev');
    const has = ed.newImage || (ed.imageId && !ed.removeImage);
    box.innerHTML = ed.newImage ? `<img class="bk-prev" src="${ed.newImage}" alt="">` : (has ? `<img class="bk-prev" data-img="${esc(ed.imageId)}" alt="">` : '');
    if (window.loadImages) loadImages(box);
    document.getElementById('bk-rm').style.display = has ? '' : 'none';
  },

  _close() {
    const ov = document.getElementById('bk-modal'); if (ov) ov.remove();
    document.body.style.overflow = '';
  },

  async _save() {
    const ed = this._ed;
    const name = document.getElementById('bk-name').value.trim();
    if (!name) { toast('Введите название', 'err'); return; }
    const btn = document.getElementById('bk-save'); btn.disabled = true;
    try {
      let imageId = ed.imageId;
      if (ed.newImage) imageId = await DB.saveImage(ed.newImage, { kind: 'book' });
      else if (ed.removeImage) imageId = null;
      if (ed.imageId && ed.imageId !== imageId) await DB.deleteImage(ed.imageId).catch(() => {});
      await Collections.save({ id: ed.id, name, emoji: document.getElementById('bk-emoji').value.trim() || '📚', imageId });
      this._close();
      this.render(document.getElementById('app-content'));
      if (window.loadImages) loadImages(document.getElementById('app-content'));
    } catch (e) { btn.disabled = false; toast('Ошибка: ' + e.message, 'err'); }
  },

  async _del(id) {
    if (!confirm('Удалить книгу? Рецепты останутся, просто без книги.')) return;
    try {
      await Collections.del(id);
      RecipesScreen._state.collectionId = '';
      this._close();
      this.render(document.getElementById('app-content'));
      if (window.loadImages) loadImages(document.getElementById('app-content'));
    } catch (e) { toast('Ошибка: ' + e.message, 'err'); }
  },
};

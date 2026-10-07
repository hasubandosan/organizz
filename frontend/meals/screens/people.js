// Кухня — screens/people.js: помощники (люди, для которых готовим)
'use strict';

const PeopleScreen = {
  async render(container, data) {
    const people = await People.list();
    let h = '<div class="lo-page pp-page"><div class="lo-grid" style="--col:120px">';
    for (const p of people) {
      h += `<div class="pp-card" onclick="PeopleScreen._form('${esc(p.id)}')"><div class="pp-ava">${esc(p.emoji || '🙂')}</div><div class="pp-name">${esc(p.name)}</div></div>`;
    }
    h += '<div class="pp-card add" onclick="PeopleScreen._form()"><div class="pp-ava">＋</div><div class="pp-name">Добавить</div></div>';
    h += '</div>' + (people.length ? '' : '<div class="kt-empty" style="margin-top:12px">Добавьте тех, для кого готовите: себя, семью, друзей</div>') + '</div>';
    container.innerHTML = h;
    LifeShell.update({ title: 'Помощники', actions: [{ icon: '＋', label: 'Добавить', onClick: () => this._form() }] });
    if (data && data.add) this._form();
  },

  async _form(id) {
    const p = id ? await DB.getById(MEAL_COL.people, id) : { name: '', emoji: '🙂' };
    document.getElementById('pp-modal')?.remove();
    const ov = document.createElement('div');
    ov.className = 'modal-overlay'; ov.id = 'pp-modal';
    ov.innerHTML = `<div class="modal"><div class="modal-header"><span class="modal-title">${id ? 'Помощник' : 'Новый помощник'}</span>
        <button class="modal-close" aria-label="Закрыть" onclick="PeopleScreen._close()">×</button></div>
      <div class="modal-body"><div class="re-row re-row-group"><div style="flex:0 0 76px"><label>Эмодзи</label><input id="pp-emoji" maxlength="4" value="${esc(p.emoji || '🙂')}"></div>
        <div><label>Имя</label><input id="pp-name" value="${esc(p.name)}" placeholder="Например, Аня"></div></div></div>
      <div class="modal-footer">${id ? '<button class="re-add-btn" id="pp-del" style="color:var(--red)">🗑</button>' : ''}<span style="flex:1"></span>
        <button class="kt-main" id="pp-save" style="margin:0;max-width:200px">Сохранить</button></div></div>`;
    ov.addEventListener('click', e => { if (e.target === ov) this._close(); });
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));
    const $ = i => document.getElementById(i);
    $('pp-save').onclick = () => this._save(id);
    if ($('pp-del')) $('pp-del').onclick = () => this._del(id);
    $('pp-name').focus();
  },

  _close() { document.getElementById('pp-modal')?.remove(); document.body.style.overflow = ''; },

  async _save(id) {
    const name = document.getElementById('pp-name').value.trim();
    if (!name) { toast('Введите имя', 'err'); return; }
    const btn = document.getElementById('pp-save'); btn.disabled = true;
    try {
      await People.save({ id: id || null, name, emoji: document.getElementById('pp-emoji').value.trim() || '🙂' });
      this._close();
      this._back();
    } catch (e) { btn.disabled = false; toast('Ошибка: ' + e.message, 'err'); }
  },

  async _del(id) {
    if (!confirm('Удалить помощника?')) return;
    try { await People.del(id); this._close(); this._back(); }
    catch (e) { toast('Ошибка: ' + e.message, 'err'); }
  },

  _back() { Router.go('people', null, { replace: true }); },
};

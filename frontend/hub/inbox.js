// LifeOS — hub/inbox.js: «Входящее». Быстрая запись одной строкой + разбор в задачу/покупку/идею/рецепт.
// Данные: коллекция 'inbox' в модуле 'shared' (запись { id, text, createdAt }). Нужны DB и UI (core).
'use strict';

const Inbox = (function () {
  const COL = 'inbox', SLUG = 'shared';
  let items = [], overlay = null, mode = null, cur = null, busy = false;

  const E = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  const byNew = (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));

  // Куда можно превратить запись: коллекция для проверки дублей, модуль, создание
  const TARGETS = {
    task:     { icon: '✅', label: 'Задача',          col: 'tasks',        slug: undefined,
                make: (n) => ({ name: n, status: 'planned', priority: 'medium', tags: [] }) },
    purchase: { icon: '🛒', label: 'Покупка',         col: 'purchases',    slug: 'purchases',
                make: (n) => ({ name: n, status: 'wish', priority: 0, sourceType: 'manual', category: null }) },
    idea:     { icon: '💡', label: 'Идея (проект)',   col: 'projects',     slug: undefined,
                make: (n) => ({ name: n, status: 'idea', priority: 'medium', tags: [] }) },
    recipe:   { icon: '🍽', label: 'Рецепт',          col: 'meal_recipes', slug: 'meals',
                make: (n) => ({ name: n, emoji: '🍽️', description: '', imageId: null, portions: 4, cookTimeMin: 0, difficulty: 1,
                                tagIds: [], recommendedMeals: [], collectionId: null, sourceUrl: '', notes: '', ingredients: [], steps: [] }) },
  };

  async function load() {
    try { items = ((await DB.getAll(COL, SLUG)) || []).sort(byNew); }
    catch (e) { items = []; }
    render();
  }

  function render() {
    const box = document.getElementById('hub-inbox');
    if (!box) return;
    const rows = items.map((it) => `<div class="inbox-row" data-id="${E(it.id)}">
        <div class="inbox-text">${E(it.text)}</div>
        <button class="btn btn-ghost inbox-sort" data-sort="${E(it.id)}">Разобрать</button>
        <button class="modal-close" data-del="${E(it.id)}" title="Удалить" aria-label="Удалить">×</button>
      </div>`).join('');
    box.innerHTML = `<div class="section-header"><span class="section-title">Входящее${items.length ? ' · ' + items.length : ''}</span>
        <a href="#" class="section-action" data-add>＋ Записать</a></div>
      ${rows ? `<div class="inbox-list">${rows}</div>` : '<div style="font-size:13px;color:var(--text3);padding:0 2px 8px">Пусто. Нажми ✎ в шапке и запиши мысль одной строкой.</div>'}`;
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
  }
  function close() { if (overlay) overlay.classList.remove('open'); mode = cur = null; }
  function show(title, body, footer) {
    ensureOverlay();
    overlay.innerHTML = `<div class="modal"><div class="modal-header"><span class="modal-title">${title}</span>
      <button class="modal-close" data-close aria-label="Закрыть">×</button></div>
      <div class="modal-body">${body}</div>${footer ? `<div class="modal-footer">${footer}</div>` : ''}</div>`;
    requestAnimationFrame(() => overlay.classList.add('open'));
  }

  // ── Быстрая запись ──
  function openAdd() {
    mode = 'add';
    show('Входящее', `<input id="inbox-in" class="input" style="width:100%" maxlength="300" autocomplete="off" placeholder="Что в голове? Enter — сохранить">
      <div id="inbox-hint" style="font-size:12px;color:var(--text3);margin-top:8px"></div>`,
      `<button class="btn btn-ghost" data-close>Закрыть</button><button class="btn btn-primary" id="inbox-save" style="flex:1">Сохранить</button>`);
    setTimeout(() => { const i = document.getElementById('inbox-in'); if (i) i.focus(); }, 60);
  }
  async function saveNew() {
    const inp = document.getElementById('inbox-in');
    const text = (inp && inp.value || '').trim();
    if (!text || busy) return;
    busy = true;
    const btn = document.getElementById('inbox-save'); if (btn) btn.disabled = true;
    try {
      const rec = await DB.create(COL, { text }, SLUG);
      items.unshift(rec); render();
      inp.value = '';
      const h = document.getElementById('inbox-hint'); if (h) h.textContent = '✓ Записано: ' + text;
    } catch (e) { UI.toast('Не сохранилось: ' + e.message, 'err'); }
    busy = false; if (btn) btn.disabled = false; if (inp) inp.focus();
  }

  // ── Разбор ──
  function openSort(id, note) {
    cur = items.find((x) => x.id === id); if (!cur) return;
    mode = 'sort';
    const btns = Object.keys(TARGETS).map((k) => `<button class="btn btn-ghost" data-to="${k}" style="justify-content:flex-start">${TARGETS[k].icon} ${TARGETS[k].label}</button>`).join('');
    show('Во что превратить?', `<div class="form-group"><label class="form-label">Название</label>
        <input id="inbox-name" class="input" style="width:100%" maxlength="300" value="${E(cur.text)}"></div>
      ${note || ''}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${btns}</div>`,
      `<button class="btn btn-danger" data-del-cur>🗑 Удалить</button><button class="btn btn-ghost" data-close style="flex:1">Отмена</button>`);
  }
  async function convert(kind, force) {
    if (!cur || busy) return;
    const t = TARGETS[kind];
    const name = (document.getElementById('inbox-name').value || '').trim();
    if (!name) { UI.toast('Введи название', 'info'); return; }
    busy = true;
    try {
      if (!force) {
        const all = (await DB.getAll(t.col, t.slug).catch(() => [])) || [];
        const dup = all.find((x) => norm(x.name || x.title) === norm(name));
        if (dup) {
          busy = false;
          const note = `<div class="card compact" style="margin-bottom:12px;border-color:var(--accent)">${t.icon} Уже есть в разделе «${t.label}»: <b>${E(dup.name || dup.title)}</b>
            <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-primary" data-drop>Убрать из входящего</button>
            <button class="btn btn-ghost" data-force="${kind}">Создать всё равно</button></div></div>`;
          cur.text = name; openSort(cur.id, note); return;
        }
      }
      await DB.create(t.col, t.make(name), t.slug);
      await DB.delete(COL, cur.id, SLUG);
      items = items.filter((x) => x.id !== cur.id);
      UI.toast(`${t.icon} ${t.label}: «${name}»`, 'ok');
      close(); render();
      if (typeof window.hubRefresh === 'function') window.hubRefresh();
    } catch (e) { UI.toast('Ошибка: ' + e.message, 'err'); }
    busy = false;
  }
  async function remove(id) {
    try { await DB.delete(COL, id, SLUG); items = items.filter((x) => x.id !== id); render(); close(); }
    catch (e) { UI.toast('Не удалилось: ' + e.message, 'err'); }
  }

  function init() {
    document.addEventListener('click', (e) => {
      const q = (s) => e.target.closest(s);
      if (q('[data-add]')) { e.preventDefault(); return openAdd(); }
      if (q('[data-close]')) return close();
      if (q('#inbox-save')) return saveNew();
      let el;
      if ((el = q('[data-sort]'))) return openSort(el.dataset.sort);
      if ((el = q('[data-del]'))) return remove(el.dataset.del);
      if ((el = q('[data-to]'))) return convert(el.dataset.to, false);
      if ((el = q('[data-force]'))) return convert(el.dataset.force, true);
      if (q('[data-drop]')) return remove(cur && cur.id);
      if (q('[data-del-cur]')) return remove(cur && cur.id);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'inbox-in') { e.preventDefault(); saveNew(); }
      if (e.key === 'Escape' && mode) close();
    });
    return load();
  }
  return { init, openAdd, reload: load };
})();

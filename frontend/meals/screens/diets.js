// Кухня — screens/diets.js: режимы питания (системные от админов + один личный). Сейчас работает только бюджет.
'use strict';

const DietsScreen = {
  async render(container) {
    const diets = await Diets.list();
    const mine = diets.filter(d => !d.system);
    let h = '<div class="lo-page dt-page"><div class="lo-grid" style="--col:240px">';
    for (const d of diets) {
      h += `<div class="card dt-card" data-id="${esc(d.id)}"><div class="dt-e">${esc(d.emoji || '🎯')}</div><div class="dt-b"><div class="dt-n">${esc(d.name)}${d.system ? ' <i>системный</i>' : ''}</div>
        <div class="dt-s">${d.budgetDay ? `${esc(money(d.budgetDay))}/день · ≈ ${esc(money(d.budgetDay * 30))}/мес` : 'без бюджета'}</div></div></div>`;
    }
    h += '</div>';
    h += mine.length >= MAX_USER_DIETS
      ? '<div class="kt-empty" style="margin-top:12px">Личный режим уже создан (больше — по подписке, позже). Нажмите на него, чтобы изменить.</div>'
      : '<button class="kt-main" id="dt-new">＋ Свой режим</button>';
    container.innerHTML = h + '</div>';
    container.querySelectorAll('.dt-card').forEach(c => { c.onclick = () => this._form(c.dataset.id); });
    const nb = document.getElementById('dt-new'); if (nb) nb.onclick = () => this._form();
    LifeShell.update({ title: 'Режимы питания' });
  },

  async _form(id) {
    const d = id ? await Diets.get(id) : { name: '', emoji: '🎯', budgetDay: 0, minKcal: 0, allowProps: [], denyProps: [] };
    if (d.system) { toast('Системный режим меняют только админы (Админка → Режимы питания)', 'info'); return; }
    const state = {};
    PRODUCT_PROPS.forEach(p => { state[p.id] = (d.allowProps || []).includes(p.id) ? 1 : (d.denyProps || []).includes(p.id) ? 2 : 0; });
    document.getElementById('dt-modal')?.remove();
    const ov = document.createElement('div'); ov.className = 'modal-overlay'; ov.id = 'dt-modal';
    ov.innerHTML = `<div class="modal"><div class="modal-header"><span class="modal-title">${id ? 'Режим питания' : 'Новый режим'}</span><button class="modal-close" aria-label="Закрыть">×</button></div>
      <div class="modal-body"><div class="re-row re-row-group"><div style="flex:0 0 76px"><label>Эмодзи</label><input id="dt-emoji" maxlength="4" value="${esc(d.emoji || '🎯')}"></div>
        <div><label>Название</label><input id="dt-name" value="${esc(d.name)}" placeholder="Например, Экономный"></div></div>
        <div class="re-row"><label>Бюджет на день, руб. ПМР (в среднем, на всех)</label><input id="dt-budget" type="number" min="0" inputmode="decimal" value="${+d.budgetDay || ''}"><div class="pl-hint" id="dt-month"></div></div>
        <details class="dt-more"><summary>Свойства и калорийность</summary>
          <div class="re-row"><label>Минимум ккал в день</label><input id="dt-kcal" type="number" min="0" value="${+d.minKcal || ''}"></div>
          <div class="pl-hint">Свойство продукта: ✓ предпочитать, ✕ исключать рецепты с ним. Минимум ккал — предупреждение при составлении.</div>
          <div class="dt-props">${PRODUCT_PROPS.map(p => `<button type="button" class="dt-p" data-id="${p.id}"></button>`).join('')}</div></details></div>
      <div class="modal-footer">${id ? '<button class="re-add-btn" id="dt-del" style="color:var(--red)">🗑</button>' : ''}<span style="flex:1"></span><button class="kt-main" id="dt-save" style="margin:0;max-width:200px">Сохранить</button></div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));
    const $ = i => ov.querySelector('#' + i), close = () => ov.remove();
    const paintProps = () => ov.querySelectorAll('.dt-p').forEach(b => {
      const s = state[b.dataset.id], p = PRODUCT_PROPS.find(x => x.id === b.dataset.id);
      b.textContent = (s === 1 ? '✓ ' : s === 2 ? '✕ ' : '') + p.label; b.className = 'dt-p s' + s;
    });
    paintProps();
    ov.querySelectorAll('.dt-p').forEach(b => { b.onclick = () => { state[b.dataset.id] = (state[b.dataset.id] + 1) % 3; paintProps(); }; });
    const month = () => { const v = +$('dt-budget').value || 0; $('dt-month').textContent = v ? `≈ ${money(v * 30)} в месяц` : ''; };
    $('dt-budget').oninput = month; month();
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.modal-close')) close(); });
    if ($('dt-del')) $('dt-del').onclick = async () => {
      if (!confirm('Удалить режим?')) return;
      try { await Diets.del(id); close(); Router.go('diets', null, { replace: true }); } catch (e) { toast('Ошибка: ' + e.message, 'err'); }
    };
    $('dt-save').onclick = async () => {
      const btn = $('dt-save'); btn.disabled = true;
      try {
        await Diets.save({ id: id || null, name: $('dt-name').value, emoji: $('dt-emoji').value.trim() || '🎯', budgetDay: $('dt-budget').value, minKcal: $('dt-kcal').value,
          allowProps: PRODUCT_PROPS.filter(p => state[p.id] === 1).map(p => p.id), denyProps: PRODUCT_PROPS.filter(p => state[p.id] === 2).map(p => p.id) });
        close(); Router.go('diets', null, { replace: true });
      } catch (e) { btn.disabled = false; toast('Ошибка: ' + e.message, 'err'); }
    };
  },
};

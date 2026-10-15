// МенюПлан — screens/recipe-view.js
'use strict';

const RecipeViewScreen = {
  async render(container, data) {
    const r = data?.id ? await Recipes.get(data.id) : null;
    if (!r) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">😕</div><div class="empty-title">Рецепт не найден</div></div>';
      return;
    }
    const [tags, collections] = await Promise.all([mealTagOptions(), Collections.list()]);
    const tagName = id => tags.find(t => t.id === id)?.name;
    const col = collections.find(c => c.id === r.collectionId);

    let h = '<div class="screen recipe-view"><div class="rv-header">';
    h += '<button class="icon-btn" onclick="Router.back()">←</button><span style="flex:1"></span>';
    h += `<button class="icon-btn" onclick="Router.go('recipe.edit', { id: '${esc(r.id)}' })">✏️</button>`;
    h += `<button class="icon-btn" onclick="RecipeViewScreen._del('${esc(r.id)}')">🗑</button></div>`;

    h += r.imageId ? `<img class="rv-image" data-img="${esc(r.imageId)}" alt="">` : `<div class="rv-emoji">${esc(r.emoji || '🍽️')}</div>`;
    h += `<h2 class="rv-title">${esc(r.name)}</h2>`;
    if (r.description) h += `<p class="rv-desc">${esc(r.description)}</p>`;
    h += `<div class="rv-meta"><span>⏱ ${+r.cookTimeMin || 0} мин</span><span class="difficulty-stars">${MealComponents.stars(r.difficulty)}</span><span>👤 ${+r.portions || 4} порц.</span>`;
    if (r.isPrep) h += '<span>🥣 Заготовка</span>';
    if (col) h += `<span>${esc(col.emoji || '📚')} ${esc(col.name)}</span>`;
    let st = null; try { st = await Costing.recipeStats(r); } catch (e) { /* каталог недоступен — без цены */ }
    this._st = st;
    if (st && st.costPerPortion) h += '<span class="rv-cost" id="rv-cost"></span>';
    h += '</div>';
    if (st && st.unpricedNames.length) h += `<div class="rv-hint" style="font-size:12px;color:var(--text3);margin:4px 0">Нет цены: ${esc(st.unpricedNames.join(', '))}. Добавьте продукт в «Энциклопедию» или укажите цену.</div>`;
    if (st) {
      const pc = Object.entries(st.propCounts).map(([id, n]) => { const p = PRODUCT_PROPS.find(x => x.id === id); return p ? p.label + (n > 1 ? ' x' + n : '') : null; }).filter(Boolean);
      if (pc.length) h += '<div class="rv-tags">' + pc.map(n => `<span class="rv-tag">${esc(n)}</span>`).join('') + '</div>';
    }

    const names = (r.tagIds || []).map(tagName).filter(Boolean);
    if (names.length) h += '<div class="rv-tags">' + names.map(n => `<span class="rv-tag">${esc(n)}</span>`).join('') + '</div>';

    this._r = r; this._n = Math.max(1, +r.portions || 4);
    if ((r.ingredients || []).length) {
      h += '<div class="rv-section"><div class="rv-ing-head"><h3>🧂 Ингредиенты</h3>';
      h += '<div class="portion-stepper"><button class="icon-btn" onclick="RecipeViewScreen._step(-1)">−</button>';
      h += '<span id="rv-portions"></span><button class="icon-btn" onclick="RecipeViewScreen._step(1)">+</button></div></div>';
      h += '<ul class="rv-ingredients" id="rv-ing-list"></ul>';
      h += '<button class="kt-main rv-shopbtn" onclick="RecipeViewScreen._shop()">🛒 Собрать продукты</button></div>';
    }
    if ((r.steps || []).length) {
      h += '<div class="rv-section"><h3>📝 Приготовление</h3><ol class="rv-steps">';
      r.steps.forEach((s, n) => {
        h += `<li><span class="step-num">${n + 1}</span><span class="step-text">${esc(s.text)}</span>`;
        if (s.timerMin) h += `<span class="step-timer">⏱ ${+s.timerMin} мин</span>`;
        if (s.tip) h += `<span class="step-tip">💡 ${esc(s.tip)}</span>`;
        h += '</li>';
      });
      h += '</ol></div>';
    }
    if ((r.recommendedMeals || []).length) h += '<div class="rv-section"><h3>🍽️ Рекомендуется для</h3><div class="rv-tags">' + r.recommendedMeals.map(m => `<span class="rv-tag">${esc(m)}</span>`).join('') + '</div></div>';
    if (r.notes) h += `<div class="rv-section"><h3>📌 Заметки</h3><div class="rv-notes">${esc(r.notes)}</div></div>`;
    if (r.sourceUrl) h += `<div class="rv-section"><a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">🔗 Источник</a></div>`;
    h += '</div>';

    container.innerHTML = h;
    this._renderIngredients();
    LifeShell.update({ title: r.name });
  },

  // ── масштабирование порций (только просмотр, сам рецепт не меняется) ──
  _step(d) {
    this._n = Math.min(99, Math.max(1, this._n + d));
    this._renderIngredients();
  },

  _fmt(n) {
    const v = Math.round(n * 100) / 100;                  // до сотых
    return String(v).replace('.', ',');
  },

  _renderIngredients() {
    const list = document.getElementById('rv-ing-list');
    if (!list) return;
    const r = this._r, base = Math.max(1, +r.portions || 4), k = this._n / base;
    document.getElementById('rv-portions').textContent = this._n + ' порц.' + (this._n !== base ? ` (×${this._fmt(k)})` : '');
    this._renderCost();
    list.innerHTML = r.ingredients.map(i => {
      const q = i.qty ? `${esc(this._fmt(i.qty * k))} ${esc(i.unit || '')}` : '';
      return `<li><span class="ing-qty">${q}</span> <span class="ing-name">${i.recipeId ? `<a href="#" onclick="Router.go('recipe.view',{id:'${esc(i.recipeId)}'});return false">🥣 ${esc(i.name)}</a>` : esc(i.name)}</span>${i.note ? `<span class="ing-note-view">${esc(i.note)}</span>` : ''}</li>`;
    }).join('');
  },

  // себестоимость: за 1 порцию и на выбранное число порций
  _renderCost() {
    const el = document.getElementById('rv-cost'), st = this._st;
    if (!el || !st) return;
    el.textContent = `💰 ${st.unpriced ? '≈' : ''}${money(st.costPerPortion)}/порц. · ${money(st.costPerPortion * this._n)} на ${this._n} порц.` + (st.unpriced ? ` (без ${st.unpriced} ингр.)` : '');
  },

  // ── «собери всё для X»: список продуктов на выбранное число порций; отметьте, что уже есть дома → остальное в «Покупки» ──
  async _shop() {
    const r = this._r, n = this._n;
    let items;
    try { items = await Plans.recipeItems(r, n); }
    catch (e) { return toast('Не удалось собрать продукты: ' + (e.message || e), 'err'); }
    if (!items.length) return toast('В рецепте нет ингредиентов', 'info');
    items.forEach(i => { i.checked = false; });
    document.getElementById('rv-shop')?.remove();
    const ov = document.createElement('div'); ov.className = 'modal-overlay'; ov.id = 'rv-shop';
    const draw = () => {
      const need = items.filter(i => !i.checked), total = Math.round(need.reduce((s, i) => s + (i.cost || 0), 0) * 100) / 100;
      const noPrice = need.filter(i => i.cost == null).length;
      ov.innerHTML = `<div class="modal"><div class="modal-header"><span class="modal-title">🛒 ${esc(r.name)} · ${n} порц.</span><button class="modal-close" aria-label="Закрыть">×</button></div>
        <div class="modal-body"><div class="pl-shophint">Отметьте то, что уже есть дома — это не попадёт в «Покупки».</div>
        ${items.map((i, k) => `<div class="pl-item${i.checked ? ' done' : ''}" data-k="${k}"><span class="pl-box">${i.checked ? '✓' : ''}</span>
          <span class="pl-iname">${esc((i.emoji ? i.emoji + ' ' : '') + i.name)}${i.purchaseId ? ' 🛍' : ''}</span><span class="pl-iqty">${esc(i.qty)} ${esc(i.unit)}</span><span class="pl-icost">${i.cost == null ? '—' : esc(money(i.cost))}</span></div>`).join('')}
        <div class="pl-total"><span>Нужно купить: ${need.length}</span><b>${money(total)}</b></div>${noPrice ? `<div class="pl-hint">${noPrice} поз. без цены — не входят в сумму</div>` : ''}
        <button class="kt-main" id="rv-shop-go"${need.length ? '' : ' disabled'}>→ В покупки</button></div></div>`;
    };
    ov.addEventListener('click', async e => {
      if (e.target === ov || e.target.closest('.modal-close')) return ov.remove();
      const row = e.target.closest('.pl-item');
      if (row) { const it = items[+row.dataset.k]; it.checked = !it.checked; return draw(); }
      if (e.target.closest('#rv-shop-go')) {
        const btn = e.target.closest('#rv-shop-go'); btn.disabled = true;
        try {
          const res = await Plans._sendItems(items.filter(i => !i.checked), { sourceId: r.id, refBase: `meals:recipe:${r.id}`, label: `рецепта «${r.name}»` });
          const parts = [];
          if (res.added) parts.push(`добавлено ${res.added}`);
          if (res.updated) parts.push(`обновлено ${res.updated}`);
          if (res.already) parts.push(`уже в списке ${res.already}`);
          toast('Покупки: ' + (parts.join(', ') || 'без изменений'), 'ok', 4000);
          ov.remove();
        } catch (err) { toast('Не удалось отправить в Покупки: ' + (err.message || err), 'err'); btn.disabled = false; }
      }
    });
    draw(); document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));
  },

  async _del(id) {
    if (!confirm('Удалить рецепт?')) return;
    try { await Recipes.del(id); toast('Рецепт удалён'); Router.go('recipes', null, { reset: true }); }
    catch (e) { toast('Ошибка: ' + e.message, 'err'); }
  },
};

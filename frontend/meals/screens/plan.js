// Кухня — screens/plan.js: план питания (день / неделя), авто-составление, список продуктов плана
'use strict';

const PlanScreen = {
  _mode: 'week', _start: null, _day: 0, _plan: null, _box: null,

  async render(container) {
    this._box = container;
    const today = new Date();
    if (!this._start) { this._start = weekStartIso(today); this._day = (today.getDay() + 6) % 7; }
    const [plan, diets, recs] = await Promise.all([Plans.open(this._start), Diets.list(), Recipes.list()]);
    this._recipes = Object.fromEntries(recs.map(r => [r.id, r]));
    this._plan = plan;
    const diet = diets.find(d => d.id === plan.dietId) || diets[0];
    const T = plan.totals, b = diet.budgetDay || 0;
    const todayIso = isoDate(today);

    let h = '<div class="lo-page pl-page">';
    // панель: режим отображения, неделя, режим питания
    h += `<div class="pl-bar"><div class="pl-seg"><button data-act="mode" data-v="day" class="${this._mode === 'day' ? 'on' : ''}">День</button><button data-act="mode" data-v="week" class="${this._mode === 'week' ? 'on' : ''}">Неделя</button></div>
      <div class="pl-nav"><button data-act="shift" data-v="-7" aria-label="Назад">‹</button><span>${shortDate(this._start)} – ${shortDate(addDays(this._start, 6))}</span><button data-act="shift" data-v="7" aria-label="Вперёд">›</button></div>
      <select id="pl-diet" aria-label="Режим питания">${diets.map(d => `<option value="${esc(d.id)}"${d.id === plan.dietId ? ' selected' : ''}>${esc(d.emoji || '🎯')} ${esc(d.name)}</option>`).join('')}</select></div>`;

    // сводка по бюджету
    const di = this._day, dayT = T.days[di];
    let sum = '';
    if (this._mode === 'day') {
      sum = `<b>${esc(DAYS_RU[di])}:</b> ${money(dayT.cost)}` + (b ? ` из ${money(b)}` : '');
    } else {
      sum = `<b>Неделя:</b> ${money(T.cost)}` + (b ? ` из ${money(b * 7)} · ≈ ${money(b * 30)}/мес по бюджету` : '');
    }
    const cur = this._mode === 'day' ? dayT.cost : T.cost, lim = b * (this._mode === 'day' ? 1 : 7);
    h += `<div class="card pl-sum"><div>${sum}</div>`;
    if (lim) h += `<div class="pl-meter"><i class="${cur > lim ? 'over' : ''}" style="width:${Math.min(100, Math.round(cur / lim * 100))}%"></i></div>${cur > lim ? `<div class="pl-warn">Перерасход ${money(cur - lim)}</div>` : ''}`;
    else h += '<div class="pl-hint">Бюджет не задан — <a href="#" data-act="diets">настроить в режиме питания</a></div>';
    if (T.unpriced) h += `<div class="pl-hint">У ${T.unpriced} блюд(а) не у всех ингредиентов есть цена — сумма неполная</div>`;
    h += '</div>';

    h += `<button class="kt-main pl-gen" data-act="gen">✨ Составить на ${this._mode === 'day' ? 'день' : 'неделю'}</button>`;

    if (this._mode === 'day') {
      h += '<div class="kt-days pl-tabs">' + DAYS_RU.map((d, i) => `<button class="kt-day${i === di ? ' on' : ''}" data-act="pickday" data-v="${i}">${d}</button>`).join('') + '</div>';
      h += this._dayCard(plan, di, todayIso);
    } else {
      h += '<div class="lo-grid" style="--col:300px">' + plan.days.map((_, i) => this._dayCard(plan, i, todayIso)).join('') + '</div>';
    }

    // список продуктов плана
    h += `<section class="kt-sec pl-shop"><div class="kt-h"><h2>🛒 Продукты на неделю</h2><span class="sp"></span><span class="kt-n">${plan.shop.length} поз.</span></div>`;
    if (!plan.shop.length) h += '<div class="kt-empty">Добавьте блюда в план — список соберётся сам</div>';
    else {
      const groups = {};
      plan.shop.forEach(i => (groups[i.category] = groups[i.category] || []).push(i));
      for (const [cat, items] of Object.entries(groups)) {
        h += `<div class="pl-cat">${esc(cat)}</div>`;
        for (const i of items) {
          h += `<div class="pl-item${i.checked ? ' done' : ''}" data-act="chk" data-k="${esc(i.key)}"><span class="pl-box">${i.checked ? '✓' : ''}</span>
            <span class="pl-iname">${esc((i.emoji ? i.emoji + ' ' : '') + i.name)}</span><span class="pl-iqty">${esc(i.qty)} ${esc(i.unit)}</span>
            <span class="pl-icost">${i.cost == null ? '—' : esc(money(i.cost))}</span></div>`;
        }
      }
      h += `<div class="pl-total"><span>Итого</span><b>${money(plan.shopTotal)}</b></div>`;
      if (plan.shopUnpriced) h += `<div class="pl-hint">${plan.shopUnpriced} поз. без цены — не входят в сумму</div>`;
    }
    h += '</section></div>';

    container.innerHTML = h;
    loadImages(container);
    container.querySelector('.pl-page').onclick = e => this._click(e);
    document.getElementById('pl-diet').onchange = async e => {
      plan.dietId = e.target.value; await Plans.save(plan); this.render(container);
    };
    LifeShell.update({ title: 'План питания', actions: [{ icon: '⚙️', label: 'Режимы питания', onClick: () => Router.go('diets') }] });
  },

  _dayCard(plan, i, todayIso) {
    const d = plan.days[i], t = plan.totals.days[i], b = plan.totals.budgetDay;
    let h = `<div class="card pl-day${d.date === todayIso ? ' today' : ''}"><div class="pl-dh"><b>${DAYS_RU[i]}</b><span class="pl-date">${shortDate(d.date)}</span><span class="sp"></span>
      <span class="pl-ppl"><button data-act="ppl" data-i="${i}" data-v="-1" aria-label="Меньше">−</button><span>👤 ${t.people}${d.people == null ? ' <i>авто</i>' : ''}</span><button data-act="ppl" data-i="${i}" data-v="1" aria-label="Больше">+</button>${d.people != null ? `<button data-act="pauto" data-i="${i}" title="Как число помощников">↺</button>` : ''}</span></div>`;
    for (const type of GEN_TYPES) {
      h += `<div class="pl-slot"><div class="pl-st">${type}</div><div class="pl-chips">`;
      d.slots[type].forEach((rid, k) => {
        const r = this._recipeById(rid);
        h += `<span class="pl-chip"><span data-act="view" data-rid="${esc(rid)}">${esc(r ? (r.emoji || '🍽️') + ' ' + r.name : '…')}</span><button data-act="rm" data-i="${i}" data-t="${type}" data-k="${k}" aria-label="Убрать">✕</button></span>`;
      });
      h += `<button class="pl-add" data-act="add" data-i="${i}" data-t="${type}" aria-label="Добавить">＋</button></div></div>`;
    }
    h += `<div class="pl-df"><span>${money(t.cost)}${b ? ` / ${money(b)}` : ''}</span>${t.kcal ? `<span>≈ ${t.kcal} ккал/чел</span>` : ''}</div></div>`;
    return h;
  },

  _recipes: {},
  _recipeById(id) { return this._recipes[id]; },

  async _click(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    e.preventDefault();
    const a = el.dataset.act, plan = this._plan, rerender = () => this.render(this._box);
    const guard = async fn => { try { await fn(); await rerender(); } catch (err) { toast('Ошибка: ' + err.message, 'err'); } };
    if (a === 'mode') { this._mode = el.dataset.v; return rerender(); }
    if (a === 'pickday') { this._day = +el.dataset.v; return rerender(); }
    if (a === 'shift') { this._start = addDays(this._start, +el.dataset.v); return rerender(); }
    if (a === 'diets') return Router.go('diets');
    if (a === 'view') return Router.go('recipe.view', { id: el.dataset.rid });
    if (a === 'ppl') return guard(async () => {
      const d = plan.days[+el.dataset.i], cur = plan.totals.days[+el.dataset.i].people;
      d.people = Math.min(20, Math.max(1, cur + +el.dataset.v)); await Plans.save(plan);
    });
    if (a === 'pauto') return guard(async () => { plan.days[+el.dataset.i].people = null; await Plans.save(plan); });
    if (a === 'rm') return guard(async () => { plan.days[+el.dataset.i].slots[el.dataset.t].splice(+el.dataset.k, 1); await Plans.save(plan); });
    if (a === 'add') return this._picker(+el.dataset.i, el.dataset.t);
    if (a === 'chk') {
      const it = plan.shop.find(x => x.key === el.dataset.k); if (!it) return;
      it.checked = !it.checked; await Plans.saveShop(plan); return rerender();
    }
    if (a === 'gen') {
      const day = this._mode === 'day';
      const has = day ? Object.values(plan.days[this._day].slots).flat().length : plan.days.some(d => Object.values(d.slots).flat().length);
      if (has && !confirm(day ? 'Заменить блюда этого дня?' : 'Заменить блюда всей недели?')) return;
      el.disabled = true;
      try {
        const res = await Plans.generate(plan, day ? 'day' : 'week', this._day);
        if (res.error) toast(res.error, 'err');
        else {
          const w = [];
          if (res.over) w.push(`бюджет превышен: ${res.over} дн.`);
          if (res.noMatch) w.push(`нет подходящих рецептов для ${res.noMatch} приём(ов) пищи`);
          if (res.lowKcal) w.push(`меньше минимума ккал: ${res.lowKcal} дн.`);
          toast(w.length ? 'План составлен, но: ' + w.join('; ') : 'План составлен', w.length ? 'info' : 'ok', w.length ? 6000 : 3000);
        }
      } catch (err) { toast('Ошибка: ' + err.message, 'err'); }
      return rerender();
    }
  },

  async _picker(di, type) {
    const [recipes, pmap] = await Promise.all([Recipes.list(), Costing.products()]);
    const stats = {};
    for (const r of recipes) stats[r.id] = await Costing.recipeStats(r, pmap);
    recipes.sort((a, b) => ((b.recommendedMeals || []).includes(type) ? 1 : 0) - ((a.recommendedMeals || []).includes(type) ? 1 : 0));
    document.getElementById('pl-modal')?.remove();
    const ov = document.createElement('div');
    ov.className = 'modal-overlay'; ov.id = 'pl-modal';
    ov.innerHTML = `<div class="modal"><div class="modal-header"><span class="modal-title">${esc(DAYS_RU[di])} · ${esc(type)}</span><button class="modal-close" aria-label="Закрыть">×</button></div>
      <div class="modal-body"><input id="pl-q" class="pl-search" placeholder="Поиск рецепта…"><div id="pl-list">${recipes.length ? recipes.map(r => `<div class="pl-pick" data-id="${esc(r.id)}"><span>${esc((r.emoji || '🍽️') + ' ' + r.name)}</span><i>${stats[r.id].costPerPortion ? esc(money(stats[r.id].costPerPortion)) + '/порц.' : 'без цены'}</i></div>`).join('') : '<div class="kt-empty">Нет рецептов</div>'}</div></div></div>`;
    const close = () => ov.remove();
    ov.addEventListener('click', async e => {
      if (e.target === ov || e.target.closest('.modal-close')) return close();
      const row = e.target.closest('.pl-pick'); if (!row) return;
      close();
      try { this._plan.days[di].slots[type].push(row.dataset.id); await Plans.save(this._plan); await this.render(this._box); }
      catch (err) { toast('Ошибка: ' + err.message, 'err'); }
    });
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));
    ov.querySelector('#pl-q').oninput = e => {
      const q = e.target.value.toLowerCase();
      ov.querySelectorAll('.pl-pick').forEach(el => { el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    };
  },
};

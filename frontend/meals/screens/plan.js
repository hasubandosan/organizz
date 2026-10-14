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
    const T = plan.totals, b = diet.budgetDay || 0, day = this._mode === 'day';
    const todayIso = isoDate(today), di = this._day;

    let h = '<div class="pl-page">';
    // панель: режим отображения, неделя + календарь, режим питания
    h += `<div class="pl-bar"><div class="pl-seg"><button data-act="mode" data-v="day" class="${day ? 'on' : ''}">День</button><button data-act="mode" data-v="week" class="${day ? '' : 'on'}">Неделя</button></div>
      <div class="pl-nav"><button data-act="shift" data-v="-1" aria-label="Назад">‹</button><button class="pl-cal" data-act="cal" aria-label="Календарь">📅 ${day ? esc(DAYS_RU[di]) + ' ' + shortDate(plan.days[di].date) : shortDate(this._start) + ' – ' + shortDate(addDays(this._start, 6))}</button><button data-act="shift" data-v="1" aria-label="Вперёд">›</button></div>
      <select id="pl-diet" aria-label="Режим питания">${diets.map(d => `<option value="${esc(d.id)}"${d.id === plan.dietId ? ' selected' : ''}>${esc(d.emoji || '🎯')} ${esc(d.name)}</option>`).join('')}</select>
      <button class="pl-gear" data-act="diets" aria-label="Режимы питания" title="Режимы питания">⚙️</button></div>`;

    // сводка: стоимость и КБЖУ (на человека) — за день или за неделю в среднем на день
    const dT = T.days[di];
    const cur = day ? dT.cost : T.cost, lim = b * (day ? 1 : 7);
    const kb = day ? dT : this._avgDay(T.days);
    h += `<div class="card pl-sum"><div class="pl-sum1"><b>${day ? esc(DAYS_RU[di]) : 'Неделя'}:</b> ${money(cur)}${lim ? ` из ${money(lim)}` : ''}${!day && b ? ` · ≈ ${money(b * 30)}/мес по бюджету` : ''}</div>
      <div class="pl-kbzhu">${day ? 'На человека за день' : 'На человека, в среднем за день'}: <b>${kb.kcal}</b> ккал · Б <b>${kb.protein}</b> · Ж <b>${kb.fat}</b> · У <b>${kb.carbs}</b></div>`;
    if (lim) h += `<div class="pl-meter"><i class="${cur > lim ? 'over' : ''}" style="width:${Math.min(100, Math.round(cur / lim * 100))}%"></i></div>${cur > lim ? `<div class="pl-warn">Перерасход ${money(cur - lim)}</div>` : ''}`;
    else h += '<div class="pl-hint">Бюджет не задан — <a href="#" data-act="diets">задать в режиме питания</a></div>';
    if (diet.minKcal && kb.kcal && kb.kcal < diet.minKcal) h += `<div class="pl-warn">Меньше минимума ${diet.minKcal} ккал</div>`;
    if (T.unpriced) h += `<div class="pl-hint">У ${T.unpriced} блюд(а) не у всех ингредиентов есть цена — сумма неполная</div>`;
    h += '</div>';

    h += `<button class="kt-main pl-gen" data-act="gen">✨ Составить на ${day ? 'день' : 'неделю'}</button>`;

    // таблица: строки — дни, столбцы — приёмы пищи
    const rows = day ? [di] : plan.days.map((_, i) => i);
    h += `<div class="pl-table"><div class="pl-tr pl-th"><div class="pl-td pl-d0"></div>${GEN_TYPES.map(t => `<div class="pl-td">${t}</div>`).join('')}</div>`;
    for (const i of rows) h += this._row(plan, i, todayIso);
    h += '</div>';

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
    const page = container.querySelector('.pl-page');
    page.onclick = e => this._click(e);
    this._swipe(page);
    document.getElementById('pl-diet').onchange = async e => {
      plan.dietId = e.target.value; await Plans.save(plan); this.render(container);
    };
  },

  _avgDay(days) {
    const f = k => Math.round(days.reduce((s, d) => s + (d[k] || 0), 0) / Math.max(1, days.length));
    return { kcal: f('kcal'), protein: f('protein'), fat: f('fat'), carbs: f('carbs') };
  },

  // строка дня: слева день, дата, люди, итог; справа три приёма пищи с блюдами
  _row(plan, i, todayIso) {
    const d = plan.days[i], t = plan.totals.days[i], b = plan.totals.budgetDay;
    let h = `<div class="pl-tr pl-dayrow${d.date === todayIso ? ' today' : ''}"><div class="pl-td pl-d0"><b>${DAYS_RU[i]}</b><span class="pl-date">${shortDate(d.date)}</span>
      <span class="pl-ppl"><button data-act="ppl" data-i="${i}" data-v="-1" aria-label="Меньше">−</button><span>👤${t.people}${d.people == null ? '<i>авто</i>' : ''}</span><button data-act="ppl" data-i="${i}" data-v="1" aria-label="Больше">+</button>${d.people != null ? `<button data-act="pauto" data-i="${i}" title="Как число помощников">↺</button>` : ''}</span>
      <span class="pl-dsum${b && t.cost > b ? ' over' : ''}">${money(t.cost)}</span>${t.kcal ? `<span class="pl-dsum2">${t.kcal} ккал</span>` : ''}</div>`;
    for (const type of GEN_TYPES) {
      h += '<div class="pl-td pl-cell">';
      d.slots[type].forEach((rid, k) => {
        const r = this._recipeById(rid);
        h += `<span class="pl-chip"><span data-act="view" data-rid="${esc(rid)}">${esc(r ? (r.emoji || '🍽️') + ' ' + r.name : '…')}</span><button data-act="rm" data-i="${i}" data-t="${type}" data-k="${k}" aria-label="Убрать">✕</button></span>`;
      });
      h += `<button class="pl-add" data-act="add" data-i="${i}" data-t="${type}" aria-label="Добавить">＋</button></div>`;
    }
    return h + '</div>';
  },

  // перелистывание: в режиме недели ±неделя, в режиме дня ±день (через границу недели)
  _shift(n) {
    if (this._mode === 'week') { this._start = addDays(this._start, 7 * n); return; }
    let d = this._day + n;
    while (d < 0) { d += 7; this._start = addDays(this._start, -7); }
    while (d > 6) { d -= 7; this._start = addDays(this._start, 7); }
    this._day = d;
  },

  // свайп влево/вправо на телефоне
  _swipe(el) {
    let x0 = 0, y0 = 0, t0 = 0;
    el.addEventListener('touchstart', e => { const t = e.changedTouches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); }, { passive: true });
    el.addEventListener('touchend', e => {
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) < 70 || Math.abs(dy) > 45 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - t0 > 700) return;
      if (e.target.closest('input,select,textarea,.modal-overlay')) return;
      this._shift(dx < 0 ? 1 : -1); this.render(this._box);
    }, { passive: true });
  },

  // календарь: месяц, выбранная неделя выделена; тап по дню — выбрать его неделю
  async _calendar() {
    let have = new Set();
    try { (await DB.getAll(MEAL_COL.plans)).forEach(p => p.weekStart && have.add(p.weekStart)); } catch (e) { /* без отметок */ }
    const cur = parseIso(this._start); cur.setDate(cur.getDate() + (this._mode === 'day' ? this._day : 3));
    let y = cur.getFullYear(), m = cur.getMonth();
    document.getElementById('pl-cal')?.remove();
    const ov = document.createElement('div'); ov.className = 'modal-overlay'; ov.id = 'pl-cal';
    const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const draw = () => {
      const first = new Date(y, m, 1), gs = weekStartIso(first), todayIso = isoDate(new Date());
      let g = '';
      for (let w = 0; w < 6; w++) {
        const ws = addDays(gs, w * 7);
        if (w >= 4 && parseIso(ws).getMonth() !== m) break;
        g += `<div class="pl-cw${ws === this._start ? ' sel' : ''}">`;
        for (let k = 0; k < 7; k++) {
          const iso = addDays(ws, k), dd = parseIso(iso);
          g += `<button data-iso="${iso}" class="${dd.getMonth() !== m ? 'out' : ''}${iso === todayIso ? ' td' : ''}${have.has(ws) && k === 0 ? ' has' : ''}">${dd.getDate()}</button>`;
        }
        g += '</div>';
      }
      ov.innerHTML = `<div class="modal"><div class="modal-header"><span class="modal-title">Выбор недели</span><button class="modal-close" aria-label="Закрыть">×</button></div>
        <div class="modal-body"><div class="pl-cm"><button data-m="-1" aria-label="Месяц назад">‹</button><b>${MONTHS[m]} ${y}</b><button data-m="1" aria-label="Месяц вперёд">›</button></div>
        <div class="pl-cwd">${DAYS_RU.map(x => `<span>${x}</span>`).join('')}</div>${g}<div class="pl-hint">Точка у понедельника — на этой неделе уже есть план</div></div></div>`;
    };
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.closest('.modal-close')) return ov.remove();
      const mb = e.target.closest('[data-m]');
      if (mb) { m += +mb.dataset.m; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } return draw(); }
      const b = e.target.closest('[data-iso]'); if (!b) return;
      const d = parseIso(b.dataset.iso);
      this._start = weekStartIso(d); this._day = (d.getDay() + 6) % 7;
      ov.remove(); this.render(this._box);
    });
    draw(); document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));
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
    if (a === 'shift') { this._shift(+el.dataset.v); return rerender(); }
    if (a === 'cal') return this._calendar();
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

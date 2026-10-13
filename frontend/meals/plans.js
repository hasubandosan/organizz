/* plans.js — режимы питания (Diets) и план питания на неделю (Plans) со списком продуктов.
   Бюджет — руб. ПМР на день (в среднем, на всех). Список продуктов привязан к плану (meal_shopping, planId)
   и пересчитывается вместе с суммой при любом изменении плана, рецептов, числа людей. */
'use strict';

const GEN_TYPES = ['Завтрак', 'Обед', 'Ужин'];
const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MAX_USER_DIETS = 1;

function isoDate(d) { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
function parseIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function weekStartIso(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return isoDate(x); }
function addDays(iso, n) { const x = parseIso(iso); x.setDate(x.getDate() + n); return isoDate(x); }
function shortDate(iso) { const [, m, d] = iso.split('-'); return `${d}.${m}`; }
function money(n) { return Math.round(+n || 0).toLocaleString('ru-RU') + ' руб.'; }

// Системные режимы создают админы (позже — из БД через «Админку»). Пока один базовый.
const SYSTEM_DIETS = [
  { id: 'sys:none', name: 'Без режима', emoji: '🍽️', budgetDay: 0, minKcal: 0, allowProps: [], denyProps: [], system: true },
];

const Diets = {
  // системные (создают админы, общая схема catalog) + личный. Сбой сети не мешает: остаётся «Без режима».
  async list() {
    let sys = [];
    try {
      sys = (await DB.request('/catalog/diets')).map(r => ({
        id: 'sys:' + r.id, name: r.name, system: true, emoji: (r.data || {}).emoji || '🎯',
        budgetDay: +(r.data || {}).budgetDay || 0, minKcal: +(r.data || {}).minKcal || 0,
        allowProps: (r.data || {}).allowProps || [], denyProps: (r.data || {}).denyProps || [],
      }));
    } catch (e) { console.warn('[meals] системные режимы недоступны:', e.message); }
    return [...SYSTEM_DIETS, ...sys, ...(await DB.getAll(MEAL_COL.diets)).sort(_byName)];
  },
  async get(id) { return (await this.list()).find(d => d.id === id) || SYSTEM_DIETS[0]; },
  async save(d) {
    const row = {
      name: String(d.name || '').trim(), emoji: d.emoji || '🎯',
      budgetDay: Math.max(0, +d.budgetDay || 0),            // руб. ПМР в день (в среднем)
      minKcal: Math.max(0, +d.minKcal || 0),                // пока не используется в подборе
      allowProps: Array.isArray(d.allowProps) ? d.allowProps : [],   // пока не используется в подборе
      denyProps: Array.isArray(d.denyProps) ? d.denyProps : [],
    };
    if (!row.name) throw new Error('Введите название');
    if (d.id) return DB.update(MEAL_COL.diets, d.id, row);
    if ((await DB.getAll(MEAL_COL.diets)).length >= MAX_USER_DIETS) throw new Error('Личный режим можно создать только один');
    return DB.create(MEAL_COL.diets, row);
  },
  async del(id) { return DB.delete(MEAL_COL.diets, id); },
};

const Plans = {
  _blank(start, dietId) {
    return {
      weekStart: start, dietId,
      days: Array.from({ length: 7 }, (_, i) => ({ date: addDays(start, i), people: null, slots: Object.fromEntries(GEN_TYPES.map(t => [t, []])) })),
    };
  },
  _norm(p) {
    p.days = (p.days || []).slice(0, 7);
    for (const d of p.days) { d.slots = d.slots || {}; GEN_TYPES.forEach(t => { d.slots[t] = Array.isArray(d.slots[t]) ? d.slots[t] : []; }); }
    return p;
  },
  async peek(start) { const p = await DB.getById(MEAL_COL.plans, 'plan-' + start); return p ? this._norm(p) : null; },

  async _defaultDiet() {
    const all = (await DB.getAll(MEAL_COL.plans)).sort((a, b) => String(b.weekStart).localeCompare(String(a.weekStart)));
    if (all[0] && all[0].dietId) return all[0].dietId;
    const mine = await DB.getAll(MEAL_COL.diets);
    return mine[0] ? mine[0].id : 'sys:none';
  },

  // открыть план недели (если нет — пустой, в БД не пишется до первого изменения); пересчитать
  async open(start) {
    let p = await this.peek(start);
    const fresh = !p;
    if (fresh) p = this._blank(start, await this._defaultDiet());
    p.id = 'plan-' + start;
    const before = JSON.stringify(p.totals || null);
    await this.recalc(p);
    if (!fresh) {
      if (JSON.stringify(p.totals) !== before) await DB.update(MEAL_COL.plans, p.id, { totals: p.totals, days: p.days });
      await this._syncShop(p, true);
    } else await this._syncShop(p, false);
    return p;
  },

  async save(plan) {
    await this.recalc(plan);
    const data = { weekStart: plan.weekStart, dietId: plan.dietId, days: plan.days, totals: plan.totals };
    if (await DB.getById(MEAL_COL.plans, plan.id)) await DB.update(MEAL_COL.plans, plan.id, data);
    else await DB.create(MEAL_COL.plans, { id: plan.id, ...data });
    await this._syncShop(plan, true);
    return plan;
  },

  _peopleOf(day, helpers) { return day.people != null ? day.people : helpers; },

  // суммы по дням и недели + заготовка списка продуктов (plan.totals, plan._items)
  async recalc(plan) {
    const [pmap, recipes, people, diet] = await Promise.all([
      Costing.products(), Recipes.list(), People.list().catch(() => []), Diets.get(plan.dietId)]);
    const rmap = Object.fromEntries(recipes.map(r => [r.id, r]));
    const helpers = Math.max(1, people.length);
    const cache = {}, agg = {};
    const days = [];
    for (const day of plan.days) {
      const n = this._peopleOf(day, helpers);
      let cost = 0, kcal = 0, unpriced = 0, count = 0;
      for (const t of Object.keys(day.slots)) {
        day.slots[t] = day.slots[t].filter(id => rmap[id]);   // удалённые рецепты убираем
        for (const rid of day.slots[t]) {
          const r = rmap[rid];
          const st = cache[rid] || (cache[rid] = await Costing.recipeStats(r, pmap));
          count++; cost += st.costPerPortion * n; kcal += st.kcalPerPortion; if (st.unpriced) unpriced++;
          this._collect(agg, r, n, pmap);
        }
      }
      days.push({ people: n, cost: _r2(cost), kcal, unpriced, count });
    }
    plan.totals = {
      days, cost: _r2(days.reduce((s, d) => s + d.cost, 0)), unpriced: days.reduce((s, d) => s + d.unpriced, 0),
      budgetDay: diet.budgetDay || 0, helpers,
    };
    plan._items = Object.values(agg).map(e => this._finishItem(e)).sort((a, b) => (a.category + a.name).localeCompare(b.category + b.name, 'ru'));
  },

  _collect(agg, r, n, pmap) {
    const scale = n / Math.max(1, +r.portions || 1);
    for (const ing of r.ingredients || []) {
      const p = ing.productId ? pmap[ing.productId] : null;
      const amt = p ? Costing.toBase(ing, p) : null;
      if (p && amt != null) {
        const e = agg[p.id] || (agg[p.id] = { key: p.id, productId: p.id, name: p.name, emoji: p.emoji, category: p.category || 'Прочее', amt: 0, p });
        e.amt += amt * scale;
      } else {
        const unit = ing.unit || '', key = 'n:' + String(ing.name).toLowerCase() + '|' + unit;
        const e = agg[key] || (agg[key] = { key, productId: null, name: ing.name, emoji: '', category: p ? p.category : 'Без цены', qty: 0, unit });
        e.qty += (+ing.qty || 0) * scale;
      }
    }
  },

  _finishItem(e) {
    if (!e.p) return { key: e.key, productId: null, name: e.name, emoji: '', category: e.category, qty: Math.round(e.qty * 10) / 10, unit: e.unit, cost: null };
    const k = (Costing.unitKind(e.p.unit) || { k: 'g' }).k, up = Costing.unitPrice(e.p);
    let qty = e.amt, unit = k === 'pcs' ? 'шт' : (k === 'ml' ? 'мл' : 'г');
    if (k !== 'pcs' && qty >= 1000) { qty /= 1000; unit = k === 'ml' ? 'л' : 'кг'; }
    return { key: e.key, productId: e.productId, name: e.name, emoji: e.emoji, category: e.category,
      qty: Math.round(qty * 10) / 10, unit, cost: up ? _r2(e.amt * up) : null };
  },

  // список продуктов, привязанный к плану (meal_shopping, planId); отметки «куплено» сохраняются
  async _syncShop(plan, persist) {
    const sid = 'shop-' + plan.id;
    const existing = persist ? await DB.getById(MEAL_COL.shopping, sid) : null;
    const checked = {};
    (existing ? existing.items || [] : []).forEach(i => { if (i.checked) checked[i.key] = true; });
    plan.shop = plan._items.map(i => ({ ...i, checked: !!checked[i.key] }));
    plan.shopTotal = _r2(plan.shop.reduce((s, i) => s + (i.cost || 0), 0));
    plan.shopUnpriced = plan.shop.filter(i => i.cost == null).length;
    if (persist) await this.saveShop(plan, existing);
  },
  async saveShop(plan, existing) {
    const sid = 'shop-' + plan.id;
    if (existing === undefined) existing = await DB.getById(MEAL_COL.shopping, sid);
    const data = { planId: plan.id, weekStart: plan.weekStart, items: plan.shop, total: plan.shopTotal, unpricedCount: plan.shopUnpriced };
    if (existing) {
      if (JSON.stringify(existing.items) === JSON.stringify(data.items)) return;
      await DB.update(MEAL_COL.shopping, sid, data);
    } else if (data.items.length) await DB.create(MEAL_COL.shopping, { id: sid, ...data });
  },

  // авто-составление: только по бюджету (режим: budgetDay). scope 'day' (di — индекс дня) | 'week'
  async generate(plan, scope, di) {
    const [pmap, recipes, people, diet] = await Promise.all([
      Costing.products(), Recipes.list(), People.list().catch(() => []), Diets.get(plan.dietId)]);
    if (!recipes.length) return { error: 'Нет рецептов — сначала добавьте' };
    const stats = {};
    for (const r of recipes) stats[r.id] = await Costing.recipeStats(r, pmap);
    const helpers = Math.max(1, people.length), budget = diet.budgetDay || 0;
    const idxs = scope === 'day' ? [di] : plan.days.map((_, i) => i);
    const used = new Set();
    plan.days.forEach((d, i) => { if (!idxs.includes(i)) Object.values(d.slots).flat().forEach(id => used.add(id)); });
    const pick = a => a[Math.floor(Math.random() * a.length)];
    // свойства режима: запрещённые исключают рецепт, разрешённые — предпочтение, ккал — предупреждение
    const deny = diet.denyProps || [], allow = diet.allowProps || [];
    const okRecipe = r => !deny.some(id => (stats[r.id].propCounts || {})[id]);
    let over = 0, noMatch = 0, lowKcal = 0;
    for (const i of idxs) {
      const day = plan.days[i], n = this._peopleOf(day, helpers);
      let left = budget, kcalDay = 0;
      GEN_TYPES.forEach((t, k) => {
        const allowed = recipes.filter(okRecipe);
        let pool = allowed.filter(r => !(r.recommendedMeals || []).length || r.recommendedMeals.includes(t));
        if (!pool.length) pool = allowed;
        day.slots[t] = [];
        if (!pool.length) { noMatch++; return; }
        if (allow.length) {
          const liked = pool.filter(r => allow.some(id => (stats[r.id].propCounts || {})[id]));
          if (liked.length) pool = liked;
        }
        let choices = pool;
        if (budget) {
          const priced = pool.filter(r => stats[r.id].costPerPortion > 0);
          const allow = left / (GEN_TYPES.length - k);
          const fit = priced.filter(r => stats[r.id].costPerPortion * n <= allow);
          if (fit.length) choices = fit;
          else if (priced.length) choices = [priced.reduce((a, b) => stats[a.id].costPerPortion <= stats[b.id].costPerPortion ? a : b)];
        }
        const fresh = choices.filter(r => !used.has(r.id));
        const r = pick(fresh.length ? fresh : choices);
        day.slots[t] = [r.id]; used.add(r.id);
        left -= stats[r.id].costPerPortion * n; kcalDay += stats[r.id].kcalPerPortion;
      });
      if (budget && left < 0) over++;
      if (diet.minKcal && kcalDay < diet.minKcal) lowKcal++;
    }
    await this.save(plan);
    return { over, budget, noMatch, lowKcal };
  },
};
window.Plans = Plans; window.Diets = Diets;

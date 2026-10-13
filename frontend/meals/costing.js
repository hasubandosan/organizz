/* costing.js — себестоимость рецепта и свойства блюда (по каталогу продуктов).
   Цена продукта — руб. ПМР за упаковку (packageSize в единицах unit). g и ml считаем равными. */
'use strict';

const _r2 = n => Math.round((+n || 0) * 100) / 100;

const Costing = {
  _cache: null, _at: 0,

  async products() {
    if (this._cache && Date.now() - this._at < 60000) return this._cache;
    const rows = await DB.request('/catalog/products');
    const m = {};
    rows.forEach(r => { m[r.id] = normProduct(r); });
    this._cache = m; this._at = Date.now();
    return m;
  },
  reset() { this._cache = null; },

  // единица -> { k: 'g'|'ml'|'pcs', f: множитель к г/мл/шт } или null (непонятная единица)
  unitKind(u) {
    const s = String(u || '').toLowerCase().replace(/[.\s]/g, '');
    if (['г', 'гр', 'грамм', 'g'].includes(s)) return { k: 'g', f: 1 };
    if (['кг', 'kg'].includes(s)) return { k: 'g', f: 1000 };
    if (['мл', 'ml'].includes(s)) return { k: 'ml', f: 1 };
    if (['л', 'литр', 'l'].includes(s)) return { k: 'ml', f: 1000 };
    if (['шт', 'штук', 'штука', 'штуки', 'pcs'].includes(s)) return { k: 'pcs', f: 1 };
    if (['стл', 'столоваяложка'].includes(s)) return { k: 'g', f: 15 };
    if (['чл', 'чайнаяложка'].includes(s)) return { k: 'g', f: 5 };
    return null;
  },

  // количество ингредиента в базовых единицах продукта (г/мл или шт); null — не удалось перевести
  toBase(ing, p) {
    const pu = this.unitKind(p.unit) || { k: 'g', f: 1 };
    const iu = ing.unit ? this.unitKind(ing.unit) : pu;   // пустая единица = как у продукта
    if (!iu) return null;
    const q = (+ing.qty || 0) * iu.f;
    const pk = pu.k === 'pcs' ? 'pcs' : 'mass', ik = iu.k === 'pcs' ? 'pcs' : 'mass';
    if (pk === ik) return q;
    if (!p.unitWeight) return null;
    return ik === 'pcs' ? q * p.unitWeight : q / p.unitWeight;
  },

  // цена за 1 г/мл/шт; 0 — цены нет
  unitPrice(p) {
    const pu = this.unitKind(p.unit) || { k: 'g', f: 1 };
    const pkg = (+p.packageSize || 0) * pu.f;
    return p.price > 0 && pkg > 0 ? p.price / pkg : 0;
  },

  // { costPerPortion, unpriced, propCounts, kcalPerPortion }
  async recipeStats(r, pmap, _forSave) {
    pmap = pmap || await this.products();
    const portions = Math.max(1, +r.portions || 1);
    let total = 0, kcal = 0, unpriced = 0;
    const propCounts = {};
    for (const ing of r.ingredients || []) {
      const p = ing.productId ? pmap[ing.productId] : null;
      if (!p) { if (+ing.qty) unpriced++; continue; }
      (p.props || []).forEach(id => { propCounts[id] = (propCounts[id] || 0) + 1; });
      if (!(+ing.qty)) continue;
      const amt = this.toBase(ing, p), price = this.unitPrice(p);
      if (amt == null || !price) unpriced++; else total += amt * price;
      if (amt != null && p.kcal) {
        const g = (this.unitKind(p.unit) || {}).k === 'pcs' ? amt * (p.unitWeight || 0) : amt;
        kcal += p.kcal * g / 100;
      }
    }
    const out = { costPerPortion: _r2(total / portions), unpriced, propCounts, kcalPerPortion: Math.round(kcal / portions) };
    return _forSave ? { costPerPortion: out.costPerPortion, unpricedCount: unpriced, propCounts, kcalPerPortion: out.kcalPerPortion } : out;
  },
};
window.Costing = Costing;

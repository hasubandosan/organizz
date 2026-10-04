/* ══════════════════════════════════════════════
   db.js — хранилище модуля «Питание» (рецепты, коллекции, продукты)
   Всё идёт через общий DB.* (слаг модуля 'meals' задан в index.html).
   Старый db.js (Supabase + demo) сохранён как legacy-db.js, не подключается.
══════════════════════════════════════════════ */
'use strict';

const MEAL_COL = { recipes: 'meal_recipes', collections: 'meal_collections', products: 'meal_products' };
const MEAL_TYPES = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];
const _byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'ru');

const Recipes = {
  async list() { return (await DB.getAll(MEAL_COL.recipes)).sort(_byName); },
  async get(id) { return DB.getById(MEAL_COL.recipes, id); },

  async save(r) {
    const row = this._toRow(r);
    return r.id ? DB.update(MEAL_COL.recipes, r.id, row) : DB.create(MEAL_COL.recipes, row);
  },

  async del(id) {
    const r = await this.get(id);
    if (r?.imageId) await DB.deleteImage(r.imageId).catch(() => {});
    return DB.delete(MEAL_COL.recipes, id);
  },

  // Формат записи рецепта (entity_type 'meal_recipes'). Поля КБЖУ пока не хранятся.
  _toRow(r) {
    return {
      name:             String(r.name || '').trim(),
      emoji:            r.emoji || '🍽️',
      description:      r.description || '',
      imageId:          r.imageId || null,
      portions:         +r.portions || 4,
      cookTimeMin:      +r.cookTimeMin || 0,
      difficulty:       Math.min(3, Math.max(1, +r.difficulty || 1)),
      tagIds:           Array.isArray(r.tagIds) ? r.tagIds : [],
      recommendedMeals: Array.isArray(r.recommendedMeals) ? r.recommendedMeals : [],
      collectionId:     r.collectionId || null,
      sourceUrl:        r.sourceUrl || '',
      // ingredients: productId — необязательный, name — всегда (нужен и для ИИ-импорта)
      ingredients: (r.ingredients || []).map(i => ({
        productId: i.productId || null, name: String(i.name || '').trim(), qty: +i.qty || 0, unit: i.unit || '',
      })).filter(i => i.name),
      steps: (r.steps || []).map(s => typeof s === 'string' ? { text: s, timerMin: 0, tip: '' } : {
        text: String(s.text || '').trim(), timerMin: +s.timerMin || 0, tip: s.tip || '',
      }).filter(s => s.text),
    };
  },
};

const Collections = {
  async list() { return (await DB.getAll(MEAL_COL.collections)).sort(_byName); },
  async save(c) {
    const row = { name: String(c.name || '').trim(), emoji: c.emoji || '📚', description: c.description || '' };
    return c.id ? DB.update(MEAL_COL.collections, c.id, row) : DB.create(MEAL_COL.collections, row);
  },
  async del(id) {
    // рецепты удаляемой коллекции не удаляем — просто снимаем привязку
    for (const r of await DB.getAll(MEAL_COL.recipes)) {
      if (r.collectionId === id) await DB.update(MEAL_COL.recipes, r.id, { collectionId: null });
    }
    return DB.delete(MEAL_COL.collections, id);
  },
};

// Продукты — отдельные сущности. КБЖУ/цены сейчас не ведём; позже добавятся
// поля protein/fat/carbs/kcal/price прямо в запись (схема jsonb, миграции не нужны).
const Products = {
  async list(search = '') {
    let items = await DB.getAll(MEAL_COL.products);
    if (search) { const q = search.toLowerCase(); items = items.filter(p => (p.name || '').toLowerCase().includes(q)); }
    return items.sort(_byName);
  },
  async get(id) { return DB.getById(MEAL_COL.products, id); },
  async save(p) {
    const row = { name: String(p.name || '').trim(), emoji: p.emoji || '🥕', category: p.category || '', unit: p.unit || 'г' };
    return p.id ? DB.update(MEAL_COL.products, p.id, row) : DB.create(MEAL_COL.products, row);
  },
  async del(id) { return DB.delete(MEAL_COL.products, id); },
};

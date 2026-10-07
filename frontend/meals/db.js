/* ══════════════════════════════════════════════
   db.js — хранилище модуля «Питание» (рецепты, коллекции, продукты)
   Всё идёт через общий DB.* (слаг модуля 'meals' задан в index.html).
   Старый db.js (Supabase + demo) сохранён как legacy-db.js, не подключается.
══════════════════════════════════════════════ */
'use strict';

const MEAL_COL = { recipes: 'meal_recipes', collections: 'meal_collections', products: 'meal_products', people: 'meal_people' };
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
      notes:            String(r.notes || '').trim(),   // общие заметки к рецепту
      // ingredients: productId — необязательный, name — всегда (нужен и для ИИ-импорта)
      ingredients: (r.ingredients || []).map(i => ({
        productId: i.productId || null, name: String(i.name || '').trim(), qty: +i.qty || 0, unit: i.unit || '',
        note: String(i.note || '').trim(),   // уточнения/рекомендации: «от 46%», «комнатной температуры»
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
    const row = { name: String(c.name || '').trim(), emoji: c.emoji || '📚', description: c.description || '', imageId: c.imageId || null };
    return c.id ? DB.update(MEAL_COL.collections, c.id, row) : DB.create(MEAL_COL.collections, row);
  },
  async del(id) {
    // рецепты удаляемой коллекции не удаляем — просто снимаем привязку
    for (const r of await DB.getAll(MEAL_COL.recipes)) {
      if (r.collectionId === id) await DB.update(MEAL_COL.recipes, r.id, { collectionId: null });
    }
    const c = await DB.getById(MEAL_COL.collections, id);
    if (c?.imageId) await DB.deleteImage(c.imageId).catch(() => {});
    return DB.delete(MEAL_COL.collections, id);
  },
};

// Люди («помощники»): те, кто ест. dietId зарезервирован под будущую сущность «режим питания».
const People = {
  async list() { return (await DB.getAll(MEAL_COL.people)).sort(_byName); },
  async save(p) {
    const row = { name: String(p.name || '').trim(), emoji: p.emoji || '🙂', dietId: p.dietId || null };
    return p.id ? DB.update(MEAL_COL.people, p.id, row) : DB.create(MEAL_COL.people, row);
  },
  async del(id) { return DB.delete(MEAL_COL.people, id); },
};

// Продукты — ОБЩИЙ каталог (schema catalog на backend, не личные данные).
// Редактировать напрямую нельзя: только предложить новый продукт/правку
// через заявку на модерацию (admin одобряет/отклоняет, голоса — подсказка).
// MEAL_COL.products (личная коллекция) больше не используется для продуктов.
const Products = {
  async list(search = '') {
    let items = await DB.request('/catalog/products');
    if (search) { const q = search.toLowerCase(); items = items.filter(p => (p.name || '').toLowerCase().includes(q)); }
    return items.sort(_byName);
  },

  async get(id) {
    const items = await DB.request('/catalog/products');
    return items.find(p => p.id === id) || null;
  },

  // Предложить новый продукт. Уходит в catalog.suggestions со статусом pending.
  async suggestNew({ name, category = '', unit = 'г' }) {
    return DB.request('/catalog/suggestions', {
      method: 'POST',
      body: JSON.stringify({ type: 'new_product', payload: { name: String(name || '').trim(), category, unit } }),
    });
  },

  // Предложить правку существующего продукта
  async suggestEdit(productId, { name, category, unit }) {
    return DB.request('/catalog/suggestions', {
      method: 'POST',
      body: JSON.stringify({ type: 'edit_product', productId, payload: { name, category, unit } }),
    });
  },
};

// Предложка: список заявок с голосами + голосование. Отдельный объект,
// т.к. это не CRUD над одной сущностью, а модерационный поток.
const Suggestions = {
  // status: 'pending' (по умолчанию) | 'approved' | 'rejected' | 'all'
  async list(status = 'pending') {
    return DB.request(`/catalog/suggestions?status=${encodeURIComponent(status)}`);
  },
  async vote(suggestionId) {
    return DB.request(`/catalog/suggestions/${encodeURIComponent(suggestionId)}/vote`, { method: 'POST' });
  },
  async unvote(suggestionId) {
    return DB.request(`/catalog/suggestions/${encodeURIComponent(suggestionId)}/vote`, { method: 'DELETE' });
  },
};

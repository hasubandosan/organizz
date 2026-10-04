/* ══════════════════════════════════════════════════
   db.js — Supabase data layer + DEMO fallback через LifeOS DB
   Заменяет Dexie. Все операции через Supabase REST.
   В DEMO_MODE — через LifeOS core DB (localStorage).
══════════════════════════════════════════════════ */

// ─── КОНФИГ: вставь свои значения из Supabase Dashboard → Settings → API ───
const SUPABASE_URL = window.LIFEOS_SUPABASE_URL || '';
const SUPABASE_KEY = window.LIFEOS_SUPABASE_KEY || '';
// ────────────────────────────────────────────────────────────────────────────

// Флаг: работать ли в demo-режиме (без Supabase)
const DEMO_MODE = !SUPABASE_URL || SUPABASE_URL.includes('YOUR_PROJECT');

let sb;
if (!DEMO_MODE) {
  const { createClient } = supabase;
  sb = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  // Stub-клиент — только для auth, данные через LifeOS DB
  sb = {
    auth: {
      getSession:     async () => ({ data: { session: null }, error: null }),
      getUser:        async () => ({ data: { user: null },    error: null }),
      onAuthStateChange: (cb) => { setTimeout(() => cb('SIGNED_OUT', null), 50); return { data: { subscription: { unsubscribe: ()=>{} } } }; },
      signInWithOAuth: async () => { alert('Supabase не настроен.\nВставь URL и KEY в db.js'); return {}; },
      signOut:         async () => {},
    },
    from: () => ({
      select: ()=>({ order:()=>({ data:[], error:null }), single:()=>({ data:null, error:null }), eq:()=>({ data:[], error:null, single:()=>({ data:null, error:null }) }) }),
      insert: ()=>({ select:()=>({ single:()=>({ data:null, error:{message:'Demo mode'} }) }) }),
      update: ()=>({ eq:()=>({ select:()=>({ single:()=>({ data:null, error:null }) }) }) }),
      delete: ()=>({ eq:()=>({ error:null }) }),
      upsert: ()=>({ error:null }),
    }),
  };
  console.warn('[МенюПлан] DEMO MODE: данные хранятся в LifeOS DB (localStorage)');
}

/* ── Хелпер: использовать LifeOS DB если DEMO_MODE ── */
function useDemoDB() {
  return DEMO_MODE && typeof DB !== 'undefined';
}

/* ── Текущий пользователь ──────────────────── */
const Auth = {
  _user: null,

  async getUser() {
    if (this._user) return this._user;
    const { data } = await sb.auth.getUser();
    this._user = data?.user || null;
    return this._user;
  },

  uid() { return this._user?.id || (DEMO_MODE ? 'demo-user' : null); },

  async signInWithGoogle() {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
  },

  async signOut() {
    await sb.auth.signOut();
    this._user = null;
    location.reload();
  },

  onAuthChange(cb) {
    sb.auth.onAuthStateChange((event, session) => {
      this._user = session?.user || null;
      cb(event, session);
    });
  },
};

/* ── Хелпер: ошибка ────────────────────────── */
function check(error, context) {
  if (error) {
    console.error(`[DB] ${context}:`, error.message);
    throw new Error(error.message);
  }
}

/* ══════════════════════════════════════════════
   SETTINGS (в DEMO_MODE через LifeOS DB)
══════════════════════════════════════════════ */
const Settings = {
  _cache: null,

  async _row() {
    if (this._cache) return this._cache;
    if (useDemoDB()) {
      const all = await DB.getAll('meal_settings').catch(() => []);
      const row = all[0] || null;
      this._cache = row;
      return row;
    }
    const { data, error } = await sb.from('settings').select('*').single();
    check(error, 'settings.get');
    this._cache = data;
    return data;
  },

  async get(key, def) {
    const row = await this._row();
    const map = {
      mealTypes: 'meal_types', weekStart: 'week_start',
      activeDietId: 'active_diet_id', diets: 'diets',
      genFilters: 'gen_filters', geminiKey: 'gemini_key',
    };
    const col = map[key] || key;
    const val = row?.[col];
    return val !== undefined && val !== null ? val : def;
  },

  async set(key, value) {
    this._cache = null;
    const map = {
      mealTypes: 'meal_types', weekStart: 'week_start',
      activeDietId: 'active_diet_id', diets: 'diets',
      genFilters: 'gen_filters', geminiKey: 'gemini_key',
    };
    const col = map[key] || key;
    if (useDemoDB()) {
      const all = await DB.getAll('meal_settings').catch(() => []);
      let row = all[0];
      if (row) {
        await DB.update('meal_settings', row.id, { [col]: value });
      } else {
        await DB.create('meal_settings', { [col]: value });
      }
      return;
    }
    const uid = Auth.uid();
    const { error } = await sb.from('settings')
      .upsert({ user_id: uid, [col]: value }, { onConflict: 'user_id' });
    check(error, 'settings.set');
  },

  async getAll() {
    const row = await this._row();
    return {
      mealTypes:    row?.meal_types    || DEFAULT_MEAL_TYPES,
      weekStart:    row?.week_start    || 'mon',
      activeDietId: row?.active_diet_id|| 'none',
      diets:        row?.diets         || [],
      genFilters:   row?.gen_filters   || {},
      geminiKey:    row?.gemini_key    || '',
    };
  },

  invalidate() { this._cache = null; },
};

/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const DEFAULT_MEAL_TYPES = ['Завтрак','Обед','Ужин'];

/* ══════════════════════════════════════════════
   PRODUCTS
══════════════════════════════════════════════ */
const Products = {
  async list(search='', category='') {
    if (useDemoDB()) {
      let items = await DB.getAll('meal_products');
      if (search) items = items.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
      if (category) items = items.filter(p => p.category === category);
      return items.sort((a,b) => a.name.localeCompare(b.name));
    }
    let q = sb.from('products').select('*').order('name');
    if (search)   q = q.ilike('name', `%${search}%`);
    if (category) q = q.eq('category', category);
    const { data, error } = await q;
    check(error, 'products.list');
    return data || [];
  },

  async get(id) {
    if (useDemoDB()) {
      return DB.getById('meal_products', id);
    }
    const { data, error } = await sb.from('products').select('*').eq('id', id).single();
    check(error, 'products.get');
    return data;
  },

  async save(p) {
    if (useDemoDB()) {
      const row = this._toRow(p);
      if (p.id) {
        return DB.update('meal_products', p.id, row);
      } else {
        return DB.create('meal_products', row);
      }
    }
    const row = this._toRow(p);
    if (p.id) {
      const { data, error } = await sb.from('products').update(row).eq('id', p.id).select().single();
      check(error, 'products.update');
      return data;
    } else {
      const { data, error } = await sb.from('products')
        .insert({ ...row, user_id: Auth.uid() }).select().single();
      check(error, 'products.insert');
      return data;
    }
  },

  async del(id) {
    if (useDemoDB()) {
      return DB.delete('meal_products', id);
    }
    const { error } = await sb.from('products').delete().eq('id', id);
    check(error, 'products.delete');
  },

  _toRow(p) {
    return {
      name:         p.name        || '',
      emoji:        p.emoji       || '🛒',
      category:     p.category    || '',
      unit:         p.unit        || 'г',
      protein:      +p.protein    || 0,
      fat:          +p.fat        || 0,
      carbs:        +p.carbs      || 0,
      kcal:         +p.kcal       || 0,
      price:        +p.price      || 0,
      package_size: +p.packageSize || +p.package_size || 100,
      tags:         p.tags        || [],
      props:        p.props       || [],
    };
  },

  norm(row) {
    if (!row) return null;
    return {
      id:          row.id,
      name:        row.name,
      emoji:       row.emoji,
      category:    row.category,
      unit:        row.unit,
      protein:     +row.protein,
      fat:         +row.fat,
      carbs:       +row.carbs,
      kcal:        +row.kcal,
      price:       +row.price,
      packageSize: +row.package_size,
      tags:        row.tags || [],
      props:       row.props || [],
    };
  },
};

/* ══════════════════════════════════════════════
   RECIPES
══════════════════════════════════════════════ */
const Recipes = {
  async list(opts={}) {
    if (useDemoDB()) {
      let items = await DB.getAll('meal_recipes');
      if (opts.search) items = items.filter(r => r.name.toLowerCase().includes(opts.search.toLowerCase()));
      if (opts.isPrep !== undefined) items = items.filter(r => r.isPrep === opts.isPrep);
      if (opts.parentId) items = items.filter(r => r.parentId === opts.parentId);
      if (opts.collectionId) items = items.filter(r => r.collectionId === opts.collectionId);
      return items.sort((a,b) => a.name.localeCompare(b.name));
    }
    let q = sb.from('recipes').select('*').order('name');
    if (opts.search)   q = q.ilike('name', `%${opts.search}%`);
    if (opts.isPrep !== undefined) q = q.eq('is_prep', opts.isPrep);
    if (opts.parentId) q = q.eq('parent_id', opts.parentId);
    if (opts.collectionId) q = q.eq('collection_id', opts.collectionId);
    const { data, error } = await q;
    check(error, 'recipes.list');
    return (data || []).map(r=>this.norm(r));
  },

  async get(id) {
    if (useDemoDB()) {
      return this.norm(await DB.getById('meal_recipes', id));
    }
    const { data, error } = await sb.from('recipes').select('*').eq('id', id).single();
    check(error, 'recipes.get');
    return this.norm(data);
  },

  async save(r) {
    if (useDemoDB()) {
      const row = this._toRow(r);
      if (r.id) {
        return DB.update('meal_recipes', r.id, row);
      } else {
        return DB.create('meal_recipes', row);
      }
    }
    const row = this._toRow(r);
    if (r.id) {
      const { data, error } = await sb.from('recipes').update(row).eq('id', r.id).select().single();
      check(error, 'recipes.update');
      return this.norm(data);
    } else {
      const { data, error } = await sb.from('recipes')
        .insert({ ...row, user_id: Auth.uid() }).select().single();
      check(error, 'recipes.insert');
      return this.norm(data);
    }
  },

  async del(id) {
    if (useDemoDB()) {
      return DB.delete('meal_recipes', id);
    }
    const { error } = await sb.from('recipes').delete().eq('id', id);
    check(error, 'recipes.delete');
  },

  async variantCount(id) {
    if (useDemoDB()) {
      const all = await DB.getAll('meal_recipes');
      return all.filter(r => r.parentId === id).length;
    }
    const { count, error } = await sb.from('recipes')
      .select('id', { count:'exact', head:true }).eq('parent_id', id);
    check(error, 'recipes.variantCount');
    return count || 0;
  },

  _toRow(r) {
    return {
      name:              r.name              || '',
      description:       r.description       || '',
      image:             r.image             || null,
      portions:          +r.portions         || 4,
      is_prep:           !!r.isPrep || !!r.is_prep,
      tags:              r.tags              || [],
      parent_id:         r.parentId          || r.parent_id || null,
      collection_id:     r.collectionId      || r.collection_id || null,
      cook_time_min:     +r.cookTimeMin      || +r.cook_time_min || 0,
      difficulty:        +r.difficulty       || 1,
      recommended_meals: r.recommendedMeals  || r.recommended_meals || [],
      ingredients:       r.ingredients       || [],
      steps:             r.steps             || [],
    };
  },

  norm(row) {
    if (!row) return null;
    // Если это объект из LifeOS DB — поля уже плоские
    return {
      id:               row.id,
      name:             row.name,
      description:      row.description,
      image:            row.image,
      portions:         row.portions,
      isPrep:           row.is_prep || row.isPrep,
      tags:             row.tags || [],
      parentId:         row.parent_id || row.parentId,
      collectionId:     row.collection_id || row.collectionId,
      cookTimeMin:      row.cook_time_min || row.cookTimeMin,
      difficulty:       row.difficulty,
      recommendedMeals: row.recommended_meals || row.recommendedMeals || [],
      ingredients:      row.ingredients || [],
      steps:            row.steps || [],
      emoji:            row.emoji || '🍽️',
    };
  },
};

/* ══════════════════════════════════════════════
   COLLECTIONS
══════════════════════════════════════════════ */
const Collections = {
  async list() {
    if (useDemoDB()) {
      return DB.getAll('meal_collections').catch(() => []);
    }
    const { data, error } = await sb.from('collections').select('*').order('name');
    check(error, 'collections.list');
    return data || [];
  },
  async save(c) {
    if (useDemoDB()) {
      if (c.id) return DB.update('meal_collections', c.id, { name:c.name, emoji:c.emoji, description:c.description });
      return DB.create('meal_collections', { name:c.name, emoji:c.emoji||'📚', description:c.description||'' });
    }
    // ...
  },
  async del(id) {
    if (useDemoDB()) return DB.delete('meal_collections', id);
    const { error } = await sb.from('collections').delete().eq('id', id);
    check(error, 'collections.delete');
  },
};

/* ══════════════════════════════════════════════
   WEEKS
══════════════════════════════════════════════ */
const WeekDB = {
  currentKey() {
    const d = new Date();
    const jan4 = new Date(d.getFullYear(),0,4);
    const w = Math.ceil(((d-jan4)/86400000+jan4.getDay()+1)/7);
    return `${d.getFullYear()}-W${String(w).padStart(2,'0')}`;
  },
  label(key) {
    try {
      const [y,w] = key.split('-W');
      const jan4 = new Date(+y,0,4);
      const wd = jan4.getDay()||7;
      const mon = new Date(jan4); mon.setDate(jan4.getDate()-wd+1+(+w-1)*7);
      const sun = new Date(mon); sun.setDate(mon.getDate()+6);
      const fmt = d => {
        try { return d.toLocaleDateString('ru',{day:'numeric',month:'short'}); }
        catch(e) { return d.getDate()+'/'+(d.getMonth()+1); }
      };
      return `${fmt(mon)} – ${fmt(sun)}`;
    } catch(e) {
      return key || 'Неделя';
    }
  },
  shiftKey(key, delta) {
    const [y,w] = key.split('-W');
    let yn=+y, wn=+w+delta;
    if(wn<1){yn--;wn=52;} if(wn>52){yn++;wn=1;}
    return `${yn}-W${String(wn).padStart(2,'0')}`;
  },

  async get(key) {
    if (useDemoDB()) {
      const all = await DB.getAll('meal_weeks').catch(() => []);
      let week = all.find(w => w.weekKey === key);
      if (!week) {
        week = await DB.create('meal_weeks', { weekKey:key, days:{}, portions:{}, heavy_days:[] });
      }
      return week;
    }
    const { data } = await sb.from('weeks').select('*')
      .eq('week_key', key).single();
    if (data) return data;
    const { data: created, error } = await sb.from('weeks')
      .insert({ user_id:Auth.uid(), week_key:key, days:{}, portions:{}, heavy_days:[] })
      .select().single();
    check(error, 'weeks.create');
    return created;
  },

  async save(week) {
    if (useDemoDB()) {
      return DB.update('meal_weeks', week.id, week);
    }
    const { error } = await sb.from('weeks')
      .upsert(week, { onConflict: 'user_id,week_key' });
    check(error, 'weeks.save');
  },

  currentKeyFromDate(d) {
    if (!d || isNaN(d.getTime())) d = new Date();
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const w = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7);
    return d.getFullYear() + '-W' + String(Math.max(1, Math.min(52, w))).padStart(2, '0');
  },

  async getAllKeys() {
    if (useDemoDB()) {
      const all = await DB.getAll('meal_weeks').catch(() => []);
      const keys = all.map(w => w.weekKey);
      const cur = this.currentKey();
      if (!keys.includes(cur)) keys.push(cur);
      return keys.sort();
    }
    const { data } = await sb.from('weeks').select('week_key').order('week_key');
    const keys = (data||[]).map(r=>r.week_key);
    const cur = this.currentKey();
    if (!keys.includes(cur)) keys.push(cur);
    return keys.sort();
  },

  async addRecipe(key, day, mt, rId) {
    const w = await this.get(key);
    if (!w.days) w.days={};
    if (!w.days[day]) w.days[day]={};
    if (!w.days[day][mt]) w.days[day][mt]=[];
    w.days[day][mt].push(rId);
    await this.save(w);
  },

  async removeRecipe(key, day, mt, idx) {
    const w = await this.get(key);
    w.days[day][mt].splice(idx,1);
    await this.save(w);
  },

  async replaceRecipe(key, day, mt, idx, rId) {
    const w = await this.get(key);
    w.days[day][mt][idx] = rId;
    await this.save(w);
  },

  async applyTemplate(weekKey, template) {
    const w = await this.get(weekKey);
    w.days = JSON.parse(JSON.stringify(template.days||{}));
    await this.save(w);
  },
};

/* ══════════════════════════════════════════════
   MEAL PRESETS
══════════════════════════════════════════════ */
const MealPresets = {
  async list() {
    if (useDemoDB()) {
      return DB.getAll('meal_presets').catch(() => []);
    }
    const { data, error } = await sb.from('meal_presets').select('*').order('saved_at', {ascending:false});
    check(error, 'presets.list');
    return (data||[]).map(r=>({
      id: r.id, name: r.name, recipeIds: r.recipe_ids||[], mt: r.meal_type||'', savedAt: r.saved_at,
    }));
  },
  async save(p) {
    if (useDemoDB()) {
      return DB.create('meal_presets', { name:p.name, recipeIds:p.recipeIds||[], mt:p.mt||'' });
    }
    const { data, error } = await sb.from('meal_presets')
      .insert({ user_id:Auth.uid(), name:p.name, recipe_ids:p.recipeIds||[], meal_type:p.mt||'' })
      .select().single();
    check(error, 'presets.save');
    return data;
  },
  async del(id) {
    if (useDemoDB()) return DB.delete('meal_presets', id);
    const { error } = await sb.from('meal_presets').delete().eq('id', id);
    check(error, 'presets.delete');
  },
};

/* ══════════════════════════════════════════════
   TEMPLATES
══════════════════════════════════════════════ */
const Templates = {
  async list() {
    if (useDemoDB()) return DB.getAll('meal_templates').catch(() => []);
    const { data, error } = await sb.from('templates').select('*').order('created_at', {ascending:false});
    check(error, 'templates.list');
    return data||[];
  },
  async save(t) {
    if (useDemoDB()) return DB.create('meal_templates', { name:t.name, days:t.days||{} });
    const { data, error } = await sb.from('templates')
      .insert({ user_id:Auth.uid(), name:t.name, days:t.days||{} })
      .select().single();
    check(error, 'templates.save');
    return data;
  },
  async del(id) {
    if (useDemoDB()) return DB.delete('meal_templates', id);
    const { error } = await sb.from('templates').delete().eq('id', id);
    check(error, 'templates.delete');
  },
};

/* ══════════════════════════════════════════════
   SHOPPING
══════════════════════════════════════════════ */
const ShoppingDB = {
  async build(weekKey) {
    const mealTypes = await Settings.get('mealTypes', DEFAULT_MEAL_TYPES);
    const week = await WeekDB.get(weekKey);
    const agg  = {};

    const collectIngr = async (recipe, scale, visited={}) => {
      if (visited[recipe.id]) return;
      visited[recipe.id] = true;
      for (const ing of (recipe.ingredients||[])) {
        if (ing.recipeId) {
          const sub = await Recipes.get(ing.recipeId); if(!sub)continue;
          await collectIngr(sub,(ing.qty||1)*scale/(sub.portions||1),{...visited});
        } else if (ing.productId) {
          const prod = await Products.get(ing.productId); if(!prod)continue;
          const p = Products.norm(prod);
          const qty = ing.qty * scale;
          if (!agg[ing.productId]) agg[ing.productId]={
            productId:p.id, name:p.name, category:p.category||'Прочее',
            qty:0, unit:ing.unit||p.unit, cost:0, checked:false,
          };
          agg[ing.productId].qty  += qty;
          agg[ing.productId].cost += (p.price||0)*qty/(p.packageSize||100);
        }
      }
    };

    for (const day of DAYS)
      for (const mt of mealTypes)
        for (const rId of (week.days?.[day]?.[mt]||[])) {
          const r = await Recipes.get(rId); if(!r)continue;
          await collectIngr(r, 1/(r.portions||1));
        }

    // Сохраняем checked-статусы
    const existing = await this.get(weekKey);
    const checkedMap = {};
    if (existing) (existing.items||[]).forEach(it=>{if(it.checked)checkedMap[it.productId]=true;});

    const items = Object.values(agg).map(it=>({
      ...it,
      qty:     Math.round(it.qty*10)/10,
      cost:    Math.round(it.cost*100)/100,
      checked: !!checkedMap[it.productId],
    }));

    if (useDemoDB()) {
      const all = await DB.getAll('meal_weeks').catch(() => []);
      let w = all.find(x => x.weekKey === weekKey);
      if (w) {
        await DB.update('meal_weeks', w.id, { shoppingItems: items });
      }
    } else {
      const { error } = await sb.from('shopping_lists')
        .upsert({ user_id:Auth.uid(), week_key:weekKey, items, updated_at:new Date().toISOString() },
                 { onConflict:'user_id,week_key' });
      check(error, 'shopping.build');
    }

    // LifeOS bridge
    if (window.ShoppingBridge && window.DB) {
      ShoppingBridge.syncToLifeOS(weekKey, items).catch(e =>
        console.warn('[ShoppingBridge] sync error:', e)
      );
    }
    return items;
  },

  async get(weekKey) {
    if (useDemoDB()) {
      const all = await DB.getAll('meal_weeks').catch(() => []);
      const w = all.find(x => x.weekKey === weekKey);
      return w ? { items: w.shoppingItems || [] } : null;
    }
    const { data } = await sb.from('shopping_lists').select('*').eq('week_key', weekKey).single();
    return data;
  },

  async toggle(weekKey, productId) {
    const row = await this.get(weekKey); if(!row)return;
    const items = (row.items||[]).map(it =>
      it.productId===productId ? {...it, checked:!it.checked} : it
    );
    if (useDemoDB()) {
      const all = await DB.getAll('meal_weeks').catch(() => []);
      const w = all.find(x => x.weekKey === weekKey);
      if (w) await DB.update('meal_weeks', w.id, { shoppingItems: items });
    } else {
      const { error } = await sb.from('shopping_lists')
        .update({ items, updated_at:new Date().toISOString() }).eq('id', row.id);
      check(error, 'shopping.toggle');
    }

    if (window.ShoppingBridge && window.DB) {
      const toggled = items.find(it => it.productId === productId);
      if (toggled) {
        ShoppingBridge.toggleInLifeOS(weekKey, productId, toggled.checked).catch(()=>{});
      }
    }
  },
};

/* ══════════════════════════════════════════════
   NUTRITION
══════════════════════════════════════════════ */
const Nutrition = {
  async recipeNutrition(recipe, portions, _visited) {
    if(!portions) portions=1;
    if(!_visited) _visited=new Set();
    if(_visited.has(recipe.id)) return zero();
    _visited.add(recipe.id);
    let p=0,f=0,c=0,kcal=0,cost=0;
    const scale = portions/(recipe.portions||1);
    for(const ing of (recipe.ingredients||[])){
      if(ing.recipeId){
        const sub=await Recipes.get(ing.recipeId); if(!sub)continue;
        const vis=new Set(_visited);
        const sn=await this.recipeNutrition(sub,(ing.qty||1)*scale,vis);
        p+=sn.p;f+=sn.f;c+=sn.c;kcal+=sn.kcal;cost+=sn.cost;
      } else if(ing.productId){
        const raw=await Products.get(ing.productId); if(!raw)continue;
        const prod=Products.norm(raw);
        const qty=ing.qty*scale;
        const g=(ing.unit==='г'||ing.unit==='мл')?qty:qty*100;
        p+=prod.protein*g/100; f+=prod.fat*g/100;
        c+=prod.carbs*g/100;   kcal+=prod.kcal*g/100;
        cost+=(prod.price||0)*qty/(prod.packageSize||100);
      }
    }
    _visited.delete(recipe.id);
    return{p:Math.round(p),f:Math.round(f),c:Math.round(c),kcal:Math.round(kcal),cost:Math.round(cost*100)/100};
  },

  async dayNutrition(weekKey, day) {
    const week=await WeekDB.get(weekKey);
    if(!week?.days?.[day]) return zero();
    let total=zero();
    const mts=await Settings.get('mealTypes',DEFAULT_MEAL_TYPES);
    for(const mt of mts)
      for(const rId of (week.days[day][mt]||[])){
        const r=await Recipes.get(rId); if(!r)continue;
        const n=await this.recipeNutrition(r,1);
        total.p+=n.p;total.f+=n.f;total.c+=n.c;total.kcal+=n.kcal;total.cost+=n.cost;
      }
    total.cost=Math.round(total.cost*100)/100;
    return total;
  },

  async weekNutrition(weekKey) {
    let total=zero();
    for(const d of DAYS){
      const n=await this.dayNutrition(weekKey,d);
      total.p+=n.p;total.f+=n.f;total.c+=n.c;total.kcal+=n.kcal;total.cost+=n.cost;
    }
    total.cost=Math.round(total.cost*100)/100;
    return total;
  },
};
function zero(){return{p:0,f:0,c:0,kcal:0,cost:0};}

/* ══════════════════════════════════════════════
   EXPORT / IMPORT
══════════════════════════════════════════════ */
const DataIO = {
  async exportAll() {
    if (useDemoDB()) {
      const data = {
        products: await DB.getAll('meal_products'),
        recipes: await DB.getAll('meal_recipes'),
        collections: await DB.getAll('meal_collections'),
        weeks: await DB.getAll('meal_weeks'),
        templates: await DB.getAll('meal_templates'),
        mealPresets: await DB.getAll('meal_presets'),
        shopping: [],
        settings: await DB.getAll('meal_settings'),
      };
      const backup = {
        _meta: { format:'menuplan-backup', schemaVersion:1, exportedAt:new Date().toISOString() },
        ...data,
      };
      const blob = new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `menuplan_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      if (typeof toast === 'function') toast('📤 Экспорт завершён');
      return;
    }
    const [products, recipes, collections, weeks, templates, presets, shopping, settings] =
      await Promise.all([
        sb.from('products').select('*').then(r=>r.data||[]),
        sb.from('recipes').select('*').then(r=>r.data||[]),
        sb.from('collections').select('*').then(r=>r.data||[]),
        sb.from('weeks').select('*').then(r=>r.data||[]),
        sb.from('templates').select('*').then(r=>r.data||[]),
        sb.from('meal_presets').select('*').then(r=>r.data||[]),
        sb.from('shopping_lists').select('*').then(r=>r.data||[]),
        sb.from('settings').select('*').then(r=>r.data||[]),
      ]);
    const backup = {
      _meta: { format:'menuplan-backup', schemaVersion:1, exportedAt:new Date().toISOString() },
      products, recipes, collections, weeks, templates,
      mealPresets:presets, shopping, settings,
    };
    const blob = new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `menuplan_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    if (typeof toast === 'function') toast('📤 Экспорт завершён');
  },

  importAll() {
    const inp = document.createElement('input');
    inp.type='file'; inp.accept='.json';
    inp.onchange = async e => {
      const f=e.target.files[0]; if(!f)return;
      try {
        const data = JSON.parse(await f.text());
        await this._doImport(data);
      } catch(ex) { if (typeof toast === 'function') toast('❌ Ошибка: '+ex.message, 4000); console.error(ex); }
    };
    inp.click();
  },

  async _doImport(data) {
    if (useDemoDB()) {
      for (const [table, rows] of Object.entries(data)) {
        if (table === '_meta') continue;
        if (Array.isArray(rows)) {
          const colMap = {
            products:'meal_products', recipes:'meal_recipes',
            collections:'meal_collections', weeks:'meal_weeks',
            templates:'meal_templates', mealPresets:'meal_presets',
            meal_presets:'meal_presets', shopping:'meal_shopping',
            settings:'meal_settings',
          };
          const col = colMap[table] || table;
          for (const rec of rows) {
            await DB.create(col, rec).catch(() => {});
          }
        }
      }
      if (typeof toast === 'function') toast('✅ Импорт завершён');
      return;
    }
    const uid = Auth.uid();
    const addUid = (arr,norm) => (arr||[]).map(x=>({...norm(x), user_id:uid}));
    const normProd = p => ({ name:p.name||'Без названия', emoji:p.emoji||'🛒', category:p.category||'', unit:p.unit||'г', protein:+p.protein||0, fat:+p.fat||0, carbs:+p.carbs||0, kcal:+p.kcal||0, price:+p.price||0, package_size:+(p.package_size||p.packageSize)||100, tags:p.tags||[], props:p.props||[] });
    const normRecipe = r => ({ name:r.name||'Без названия', description:r.description||'', image:r.image||null, portions:+r.portions||4, is_prep:!!(r.is_prep||r.isPrep), tags:r.tags||[], parent_id:null, collection_id:null, cook_time_min:+(r.cook_time_min||r.cookTimeMin)||0, difficulty:+r.difficulty||1, recommended_meals:r.recommended_meals||r.recommendedMeals||[], ingredients:r.ingredients||[], steps:(r.steps||[]).map(s=>typeof s==='string'?{text:s,timerMin:0,tip:'',isPrep:false,image:null}:s) });
    const normWeek = w => ({ week_key: w.week_key||w.weekKey||'', days: w.days||{}, portions: w.portions||{}, heavy_days:w.heavy_days||w.heavyDays||[] });
    const normTemplate = t => ({ name:t.name||'Шаблон', days:t.days||{} });
    const normPreset = p => ({ name:p.name||'Пресет', recipe_ids:p.recipe_ids||p.recipeIds||[], meal_type:p.meal_type||p.mt||'' });
    const tables = [
      ['products', addUid(data.products, normProd)],
      ['recipes', addUid(data.recipes, normRecipe)],
      ['collections', addUid(data.collections, c=>({name:c.name||'',emoji:c.emoji||'📚',description:c.description||''}))],
      ['weeks', addUid(data.weeks, normWeek)],
      ['templates', addUid(data.templates, normTemplate)],
      ['meal_presets', addUid(data.mealPresets||data.meal_presets||[], normPreset)],
    ];
    for (const [table, rows] of tables) {
      await sb.from(table).delete().eq('user_id', uid);
      if (rows.length) {
        const { error } = await sb.from(table).insert(rows);
        if (error) console.warn(`Import ${table}:`, error.message);
      }
    }
    if (typeof toast === 'function') toast('✅ Импорт завершён. Обновляем…', 2000);
    setTimeout(()=>location.reload(), 2000);
  },
};
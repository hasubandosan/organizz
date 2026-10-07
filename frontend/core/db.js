/**
 * LifeOS — core/db.js
 * Universal Data Layer  ·  v1.1.0  ·  schema v1
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  STORAGE DRIVER: localStorage JSON                       ║
 * ║                                                          ║
 * ║  Чтобы переключить на IndexedDB — заменить блок _STORE   ║
 * ║  Чтобы переключить на Supabase  — заменить блок _STORE   ║
 * ║  Публичный API (DB.*) не меняется никогда.               ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * ПРАВИЛА ДЛЯ МОДУЛЕЙ:
 *   - Только DB.* — никогда не трогать хранилище напрямую
 *   - Никакого localStorage в коде модулей
 *   - Storage backend меняется только здесь
 */
'use strict';

const LIFEOS_VERSION  = '1.1.0';
const SCHEMA_VERSION  = 1;
const LS_PREFIX       = 'lifeos:';   // префикс всех ключей в localStorage

const COLLECTIONS = [
  'areas', 'projects', 'tasks', 'purchases', 'purchase_variants', 'tags', 'categories',
  'notes', 'people', 'events', 'health_records', 'cosplays', 'shops',
  // МенюПлан коллекции (синхронизируются через ShoppingBridge)
  'meal_products', 'meal_recipes', 'meal_weeks', 'meal_settings',
  // Новые глобальные коллекции
  'spaces', 'members', 'relations',
  // Модуль purchases
  'zones',
];
const META_STORE  = '_meta';
const IMAGE_STORE = '_images';

/* ════════════════════════════════════════════════════════════
   STORAGE DRIVER — remote API (db-connector)
   Публичный API DB.* не изменился ни на строчку — только этот блок.
   Контракт тот же: все методы async, возвращают plain объекты.
════════════════════════════════════════════════════════════ */

// Поменяйте на домен вашего задеплоенного db-connector
const API_BASE  = 'https://organizz.onrender.com';
// Слаг модуля задаётся на странице ДО подключения db.js:
//   <script>window.LIFEOS_APP_SLUG = 'purchases';</script>
// Без этого по умолчанию 'projects' (так работают projects и hub).
const APP_SLUG  = (typeof window !== 'undefined' && window.LIFEOS_APP_SLUG) || 'projects';
// Куда отправлять, если токена нет (страница логина из db-connector-frontend)
const LOGIN_URL = 'https://organizz-login.pages.dev/';

// Модули живут на РАЗНЫХ доменах (organizz-<module>.pages.dev), а localStorage у каждого домена свой.
// Страница входа возвращает пользователя на модуль с токеном в #fragment (на сервер он не уходит);
// здесь забираем его в localStorage ЭТОГО домена и чистим адресную строку.
(function adoptSessionFromHash() {
  try {
    const p = new URLSearchParams(location.hash.slice(1));
    const t = p.get('lifeos_token');
    if (!t) return;
    localStorage.setItem('token', t);
    const e = p.get('lifeos_email');
    if (e) localStorage.setItem('email', e);
    const h = p.get('h');                       // исходный hash модуля (например #/recipes)
    history.replaceState(null, '', location.pathname + location.search + (h ? '#' + h : ''));
  } catch { /* не критично */ }
})();

function _authHeaders() {
  const token = localStorage.getItem('token');
  if (!token) {
    // Без токена работать нельзя — отправляем на логин, возвращаемся сюда после входа
    window.location.href = `${LOGIN_URL}?redirect=${encodeURIComponent(location.href)}&app=${APP_SLUG}`;
    throw new Error('Нет токена — редирект на логин');
  }
  return { Authorization: `Bearer ${token}` };
}

async function _api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ..._authHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401 || res.status === 403) {
    // Токен истёк/невалиден/нет роли в этом модуле — на логин
    localStorage.removeItem('token');
    // expired=1: страница входа сотрёт и свой токен, иначе она отправит обратно с тем же протухшим
    window.location.href = `${LOGIN_URL}?expired=1&redirect=${encodeURIComponent(location.href)}&app=${APP_SLUG}`;
    throw new Error('Сессия истекла');
  }
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.error || `Ошибка запроса: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

const _imgUrlCache = new Map();
let _sysTagsCache = null;

const _STORE = {
  // appSlug — необязательный: по умолчанию свой модуль (APP_SLUG).
  // Нужен только hub для кросс-модульного чтения.
  async getAll(col, appSlug = APP_SLUG) {
    const rows = await _api(`/${appSlug}/${encodeURIComponent(col)}`);
    return rows || [];
  },

  async get(col, id, appSlug = APP_SLUG) {
    // 404 = «записи нет» — это нормальный ответ (как null в старом localStorage-драйвере)
    try {
      return await _api(`/${appSlug}/${encodeURIComponent(col)}/${encodeURIComponent(id)}`);
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  },

  async put(col, rec, appSlug = APP_SLUG) {
    await _api(`/${appSlug}/${encodeURIComponent(col)}/${encodeURIComponent(rec.id)}`, {
      method: 'PUT',
      body: JSON.stringify(rec),
    });
    return rec.id;
  },

  async delete(col, id, appSlug = APP_SLUG) {
    await _api(`/${appSlug}/${encodeURIComponent(col)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
  },

  // Локальных localStorage-утилит (bulk clear/export/import/sizeBytes) у
  // remote-драйвера нет — они были нужны только для localStorage-бэкенда.
  // exportAll()/importAll() в публичном DB.* продолжают работать поколлекционно
  // через getAll/put выше, так что бэкап всё ещё возможен, просто небыстрый.
  async clear() { console.warn('[LifeOS] clear() не поддерживается в remote-режиме'); },
  async clearAll() { console.warn('[LifeOS] clearAll() не поддерживается в remote-режиме'); },
  exportRaw() { console.warn('[LifeOS] exportRaw() недоступен в remote-режиме, используйте DB.exportAll()'); return {}; },
  importRaw() { console.warn('[LifeOS] importRaw() недоступен в remote-режиме, используйте DB.importAll()'); },
  sizeBytes() { return 0; }, // в remote-режиме лимит не localStorage, а Neon free tier
};
/* ════════════════════════════════════════════════════════════
   КОНЕЦ STORAGE DRIVER
════════════════════════════════════════════════════════════ */


/* ── MIGRATIONS ─────────────────────────────── */
const _Migrations = {
  async 1() {
    // Seed default tags
    const existing = await _STORE.getAll('tags');
    if (existing.length === 0) {
      const defaults = [
        'срочно', 'важно', 'ждать', 'делегировать',
        'ремонт', 'dev', 'здоровье', 'покупка',
      ];
      for (const name of defaults) {
        await _STORE.put('tags', {
          id: name, name,
          createdAt: new Date().toISOString(),
        });
      }
    }
    // Seed default purchase categories
    const cats = await _STORE.getAll('categories');
    if (cats.length === 0) {
      const defaults = [
        { name: 'Техника',  emoji: '💻' }, { name: 'Одежда',   emoji: '👗' },
        { name: 'Кухня',    emoji: '🍳' }, { name: 'Косплей',  emoji: '🎭' },
        { name: 'Красота',  emoji: '💅' }, { name: 'Дом',      emoji: '🏠' },
        { name: 'Спорт',    emoji: '🏋️' }, { name: 'Книги',    emoji: '📚' },
        { name: 'Питание',  emoji: '🥗' },
      ];
      for (const d of defaults) {
        const id = _uid();
        await _STORE.put('categories', {
          id, ...d, module: 'purchases',
          createdAt: new Date().toISOString(),
        });
      }
    }
    console.info('[LifeOS] Migration v1 complete');
  },
};

async function _runMigrations() {
  const rec     = await _STORE.get(META_STORE, 'schemaVersion');
  const current = rec ? rec.value : 0;
  if (current >= SCHEMA_VERSION) return;
  for (let v = current + 1; v <= SCHEMA_VERSION; v++) {
    if (_Migrations[v]) await _Migrations[v]();
  }
  await _STORE.put(META_STORE, { id: 'schemaVersion', value: SCHEMA_VERSION });
}


/* ── ENTITY FACTORY ─────────────────────────── */
/* Сжатие фото перед загрузкой (экономит место в B2 и трафик). Маленькие файлы, GIF/SVG и любые сбои — без изменений. */
async function _shrinkImage(dataUrl, maxSide = 1600, quality = 0.82, minBytes = 300000) {
  try {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(dataUrl || '');
    if (!m || dataUrl.length < minBytes * 1.34) return dataUrl;   // base64 ≈ ×1.34 от размера файла
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = dataUrl; });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);             // прозрачность PNG -> белый фон
    ctx.drawImage(img, 0, 0, w, h);
    const out = c.toDataURL('image/jpeg', quality);
    return out.length < dataUrl.length ? out : dataUrl;           // не делаем хуже
  } catch { return dataUrl; }
}

function _uid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function _makeEntity(col, data) {
  return {
    id:            _uid(),
    entityType:    col.replace(/s$/, ''),
    schemaVersion: SCHEMA_VERSION,
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
    spaceId:       data.spaceId || 'default-space',
    ownerId:       data.ownerId || 'default-user',
    tags:          [],
    imageIds:      [],
    metadata:      {},
    ...data,
  };
}


/* ── VALIDATORS ─────────────────────────────── */
const _V = {
  areas:      d => !d.name?.trim() ? 'Area name required'     : null,
  projects:   d => !d.name?.trim() ? 'Project name required'  : null,
  tasks:      d => !d.name?.trim() ? 'Task title required'    : null,
  purchases:  d => !d.name?.trim() ? 'Purchase name required' : null,
  purchase_variants: d => !d.purchaseId ? 'Variant must reference a purchaseId' : null,
  shops:      d => !d.name?.trim() ? 'Shop name required'     : null,
  tags:       d => !d.name?.trim() ? 'Tag name required'      : null,
  categories: d => !d.name?.trim() ? 'Category name required' : null,
};


  /* ════════════════════════════════════════════════════════════
   PUBLIC DB API
   Этот блок не меняется при смене хранилища.
 ════════════════════════════════════════════════════════════ */
  const DB = {

  /* ── CRUD ── */
  // appSlug — необязательный: писать в ДРУГОЙ модуль (например теги в 'shared'). По умолчанию свой.
  async create(col, data = {}, appSlug) {
    const err = _V[col] ? _V[col](data) : null;
    if (err) throw new Error(err);
    const entity = _makeEntity(col, data);
    await _STORE.put(col, entity, appSlug);
    return entity;
  },

  async update(col, id, patch = {}, appSlug) {
    const existing = await _STORE.get(col, id, appSlug);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...patch,
      // защищённые поля — не перезаписывать
      id:            existing.id,
      entityType:    existing.entityType,
      schemaVersion: existing.schemaVersion,
      createdAt:     existing.createdAt,
      updatedAt:     new Date().toISOString(),
    };
    await _STORE.put(col, updated, appSlug);
    return updated;
  },

  async delete(col, id, appSlug) {
    await _STORE.delete(col, id, appSlug);
    return true;
  },

  /* ── ТЕГИ И ЗОНЫ: один источник правды (см. docs/TAGS_AND_REFS.md) ──
     Системные (встроенные, общие для всех) — с backend, кэшируются.
     Личные — коллекция 'tags' в модуле 'shared' (поле kind: 'tag' | 'category'), у каждого свои.
     Категории и теги — одно и то же хранилище (tagIds), различие только в kind. */
  async getSystemTags(scope, kind) {
    if (!_sysTagsCache) {
      const r = await _api('/shared/system-tags');
      _sysTagsCache = r.items || [];
    }
    return _sysTagsCache.filter(t =>
      (!kind || t.kind === kind) &&
      (!scope || t.scope.includes('all') || t.scope.includes(scope)));
  },

  // Для выпадашек: системные + личные, отфильтрованные по модулю. system:true — нельзя редактировать.
  // kind: не задан — и категории, и теги; 'category' или 'tag' — только они.
  // POST к служебному маршруту backend (например /ai/recipe). Токен подставляется сам.
  async api(path, body) {
    return _api(path, { method: 'POST', body: JSON.stringify(body || {}) });
  },

  async getTagOptions(scope, kind) {
    const sys = (await DB.getSystemTags(scope, kind)).map(t => ({ ...t, system: true }));
    const mine = (await _STORE.getAll('tags', 'shared'))
      .filter(t => !kind || (t.kind || 'tag') === kind)
      .filter(t => !t.scope || t.scope.includes('all') || t.scope.includes(scope))
      .map(t => ({ ...t, kind: t.kind || 'tag', system: false }));
    return [...sys, ...mine];
  },

  async getById(col, id, appSlug) {
    return _STORE.get(col, id, appSlug);
  },

  async getAll(col, appSlug) {
    return _STORE.getAll(col, appSlug);
  },

  /* ── QUERY (простая фильтрация по полям) ── */
  async query(col, filter = {}, appSlug) {
    let items = await _STORE.getAll(col, appSlug);
    for (const [k, v] of Object.entries(filter)) {
      if (v == null || v === '') continue;
      items = Array.isArray(v)
        ? items.filter(e => v.includes(e[k]))
        : items.filter(e => e[k] === v);
    }
    return items;
  },

  /* ── FULL-TEXT SEARCH ── */
  async search(cols, term) {
    if (!term?.trim()) return [];
    const q = term.toLowerCase();
    const results = [];
    for (const col of (Array.isArray(cols) ? cols : [cols])) {
      const items = await _STORE.getAll(col);
      for (const e of items) {
        const hay = [e.name, e.title, e.description, e.notes, ...(e.tags || [])]
          .filter(Boolean).join(' ').toLowerCase();
        if (hay.includes(q)) results.push({ ...e, _col: col });
      }
    }
    return results;
  },

  /* ── PURCHASE VARIANTS ──
     Покупка (purchases) — абстрактная сущность ("хочу купить X").
     Вариант (purchase_variants) — конкретное предложение: бренд/имя, цена, магазин.
     Один вариант может быть отмечен isPrimary — он показывается в сетке/карточке. */
  async getVariants(purchaseId, appSlug) {
    return _STORE.getAll('purchase_variants', appSlug).then(all =>
      all.filter(v => v.purchaseId === purchaseId)
         .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || new Date(a.createdAt) - new Date(b.createdAt))
    );
  },

  async getPrimaryVariant(purchaseId, appSlug) {
    const vars = await this.getVariants(purchaseId, appSlug);
    return vars.find(v => v.isPrimary) || vars[0] || null;
  },

  // Снимает isPrimary со всех остальных вариантов покупки, ставит на variantId.
  async setPrimaryVariant(purchaseId, variantId) {
    const vars = await this.getVariants(purchaseId);
    for (const v of vars) {
      const shouldBePrimary = v.id === variantId;
      if (!!v.isPrimary !== shouldBePrimary) {
        await this.update('purchase_variants', v.id, { isPrimary: shouldBePrimary });
      }
    }
  },

  // Создаёт покупку + (опционально) один вариант за один вызов.
  // Используется модулями быстрого добавления (косплеи, проекты и т.д.).
  async quickAddPurchase({ name, variant = null, ...purchaseFields }) {
    const purchase = await this.create('purchases', { name, status: 'wish', priority: 0, ...purchaseFields });
    let createdVariant = null;
    if (variant && (variant.title || variant.price || variant.shopId || variant.url || variant.notes)) {
      createdVariant = await this.create('purchase_variants', {
        purchaseId: purchase.id,
        title:   variant.title   || null,
        price:   variant.price   != null && variant.price !== '' ? Number(variant.price) : null,
        shopId:  variant.shopId  || null,
        url:     variant.url     || null,
        notes:   variant.notes   || null,
        isPrimary: true,
      });
    }
    return { purchase, variant: createdVariant };
  },

  /* ── TAGS ── */
  async getTags() {
    return _STORE.getAll('tags');
  },

  async createTag(name) {
    const id = name.toLowerCase().trim().replace(/\s+/g, '-');
    const ex = await _STORE.get('tags', id);
    if (ex) return ex;
    const t = { id, name: name.trim(), createdAt: new Date().toISOString() };
    await _STORE.put('tags', t);
    return t;
  },

  async deleteTag(id) {
    return _STORE.delete('tags', id);
  },

  /* ── IMAGES ──
     Файл лежит в S3-совместимом хранилище (Backblaze B2), в базе — только
     запись {id, key, contentType}. Контракт прежний: saveImage(base64) -> id,
     getImage(id) -> { ..., data } где data пригоден для <img src>.
     Старые записи с base64 в поле data продолжают работать как есть. */
  async saveImage(base64, meta = {}, appSlug) {
    base64 = await _shrinkImage(base64);                        // большие фото сжимаем до ~1600 px, JPEG
    const id = _uid();
    const createdAt = new Date().toISOString();
    try {
      const blob = await (await fetch(base64)).blob();          // data:URL -> Blob
      const { key, uploadUrl } = await _api('/storage/upload-url', {
        method: 'POST', body: JSON.stringify({ contentType: blob.type }),
      });
      const up = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type } });
      if (!up.ok) throw new Error(`Загрузка в хранилище: ${up.status}`);
      await _STORE.put(IMAGE_STORE, { id, key, contentType: blob.type, createdAt, ...meta }, appSlug);
    } catch (e) {
      // Хранилище недоступно — не теряем картинку, кладём по-старому (base64 в базу)
      console.warn('[LifeOS] S3 недоступен, сохраняю base64:', e.message);
      await _STORE.put(IMAGE_STORE, { id, data: base64, createdAt, ...meta }, appSlug);
    }
    return id;
  },

  async getImage(id, appSlug) {
    const rec = await _STORE.get(IMAGE_STORE, id, appSlug);
    if (!rec || rec.data || !rec.key) return rec;               // старый формат или нет записи
    const hit = _imgUrlCache.get(rec.key);
    if (hit && hit.exp > Date.now()) return { ...rec, data: hit.url };
    const { url } = await _api('/storage/read-url', { method: 'POST', body: JSON.stringify({ key: rec.key }) });
    _imgUrlCache.set(rec.key, { url, exp: Date.now() + 50 * 60 * 1000 });  // ссылка живёт 1 ч, кэш 50 мин
    return { ...rec, data: url };
  },

  async deleteImage(id, appSlug) {
    const rec = await _STORE.get(IMAGE_STORE, id, appSlug);
    if (rec?.key) await _api('/storage', { method: 'DELETE', body: JSON.stringify({ key: rec.key }) }).catch(() => {});
    return _STORE.delete(IMAGE_STORE, id, appSlug);
  },


  /* ── STATS ── */
  async stats() {
    const [p, t, pu, a] = await Promise.all([
      _STORE.getAll('projects'),
      _STORE.getAll('tasks'),
      _STORE.getAll('purchases', 'purchases').catch(() => []),
      _STORE.getAll('areas'),
    ]);
    return {
      projects:  p.length,
      tasks:     t.length,
      purchases: pu.length,
      areas:     a.length,
      active:    p.filter(x => x.status === 'in_progress').length,
      completed: t.filter(x => x.status === 'completed').length,
    };
  },

  /* ── EXPORT / IMPORT ── */
  async exportAll() {
    const data = {};
    for (const col of [...COLLECTIONS, META_STORE]) {
      data[col] = await _STORE.getAll(col).catch(() => []);
    }
    // Изображения не включаем в основной экспорт — они огромные
    // Используй exportWithImages() если нужно полное резервное копирование
    return {
      app:           'LifeOS',
      version:       LIFEOS_VERSION,
      schemaVersion: SCHEMA_VERSION,
      exportedAt:    new Date().toISOString(),
      data,
    };
  },

  async exportWithImages() {
    const bundle = await this.exportAll();
    bundle.images = _STORE.exportRaw()[IMAGE_STORE] || {};
    return bundle;
  },

  async importAll(bundle) {
    if (!bundle?.data) throw new Error('Invalid bundle');
    for (const [col, records] of Object.entries(bundle.data)) {
      if (!Array.isArray(records)) continue;
      for (const rec of records) {
        await _STORE.put(col, rec).catch(() => {});
      }
    }
    // Если есть изображения в бандле
    if (bundle.images) {
      for (const [id, img] of Object.entries(bundle.images)) {
        await _STORE.put(IMAGE_STORE, img).catch(() => {});
      }
    }
  },

  async clearAll() {
    await _STORE.clearAll();
  },

  /* ── RAW REQUEST ──
     Для эндпоинтов, которые не укладываются в CRUD по entityType
     (например /catalog/suggestions/:id/vote, /catalog/suggestions/:id/approve).
     path — полный путь начиная с /<appSlug>/..., например '/catalog/products'. */
  async request(path, options = {}) {
    return _api(path, options);
  },

  /* ── STORAGE INFO ── */
  storageInfo() {
    const bytes = _STORE.sizeBytes();
    const kb    = Math.round(bytes / 1024);
    const mb    = (bytes / 1024 / 1024).toFixed(2);
    // localStorage лимит обычно ~5MB
    const pct   = Math.round(bytes / (5 * 1024 * 1024) * 100);
    return { bytes, kb, mb, pct, driver: 'remote-api' };
  },
};
/* ════════════════════════════════════════════════════════════
   КОНЕЦ PUBLIC DB API
════════════════════════════════════════════════════════════ */


/* ── COST ENGINE (рекурсивный бюджет задач) ── */
async function calcTaskTotalCost(taskId, allTasks) {
  const t = allTasks.find(x => x.id === taskId);
  if (!t) return 0;
  let total = t.selfBudget || t.cost || 0;
  for (const child of allTasks.filter(x => x.parentId === taskId))
    total += await calcTaskTotalCost(child.id, allTasks);
  return total;
}


/* ── INIT ── */
async function lifeosInit() {
  // Нет async open() как в IDB — localStorage синхронный
  // Просто запускаем миграции
  await _runMigrations();
  const info = DB.storageInfo();
  console.info(
    `[LifeOS] ready — schema v${SCHEMA_VERSION} — ` +
    `storage: ${info.mb}MB / ~5MB (${info.pct}%) — driver: ${info.driver}`
  );
}


/* ── GLOBALS ── */
window.DB                = DB;
window.lifeosInit        = lifeosInit;
window.calcTaskTotalCost = calcTaskTotalCost;
window.LIFEOS_VERSION    = LIFEOS_VERSION;
  window.SCHEMA_VERSION    = SCHEMA_VERSION;

  // ── SPACE, MEMBER, RELATION API ──
  const Space = {
    async create(data) { return DB.create('spaces', data); },
    async update(id, data) { return DB.update('spaces', id, data); },
    async delete(id) { return DB.delete('spaces', id); },
    async getAll() { return DB.getAll('spaces'); },
    async getById(id) { return DB.getById('spaces', id); },
    async query(filter) { return DB.query('spaces', filter); },
  };

  const Member = {
    async create(data) { return DB.create('members', data); },
    async update(id, data) { return DB.update('members', id, data); },
    async delete(id) { return DB.delete('members', id); },
    async getAll() { return DB.getAll('members'); },
    async getById(id) { return DB.getById('members', id); },
    async query(filter) { return DB.query('members', filter); },
  };

  const Relation = {
    async create(data) { return DB.create('relations', data); },
    async update(id, data) { return DB.update('relations', id, data); },
    async delete(id) { return DB.delete('relations', id); },
    async getAll() { return DB.getAll('relations'); },
    async getById(id) { return DB.getById('relations', id); },
    async query(filter) { return DB.query('relations', filter); },
  };

  // expose to global
  window.Space    = Space;
  window.Member   = Member;
  window.Relation = Relation;

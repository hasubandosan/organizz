# LifeOS — Интеграция МенюПлан (Nutrition модуль)

## Анализ текущего состояния

### МенюПлан — что есть
- **Backend**: Supabase (Auth + PostgreSQL + Storage)
- **Auth**: Google OAuth через Supabase Auth
- **Данные**: products, recipes, collections, weeks, meal_presets, templates, shopping_lists, settings
- **Архитектура**: multi-screen SPA, Router + отдельные screen-файлы
- **Зависимости**: SortableJS, Supabase JS SDK, Gemini AI (ai-import.js)
- **Уникальная логика**: Nutrition engine (БЖУ/ккал расчёт рекурсивный), Shopping auto-build из week

### LifeOS Core — что есть
- **db.js** — IndexedDB через _IDB, DB.* API
- **ui.js** — UI утилиты (toast, modal, badges, image grid)
- **styles.css** — дизайн-система (Syne + DM Mono, токены)
- **purchases/index.html** — уже мигрирован на core

---

## Ключевое решение: НЕ мигрировать МенюПлан на IndexedDB

МенюПлан **остаётся на Supabase** по следующим причинам:

| Причина | Объяснение |
|---|---|
| Объём данных | Продукты + рецепты с изображениями — тяжело для IndexedDB |
| Кросс-устройственность | Меню нужно видеть с телефона и с планшета одновременно |
| Google Auth | Supabase Auth уже работает, пользователь залогинен |
| Рекурсивная Nutrition | Сложная логика уже отлажена, переписывать рискованно |
| Shopping auto-build | Строится из weeks → recipes → products, нужен JOIN на сервере |

**Стратегия**: Bridge Pattern — МенюПлан живёт на своём Supabase,  
но **интегрируется с LifeOS** через общий слой покупок.

---

## Архитектура интеграции

```
LifeOS Hub
 ├── /purchases/     ← IndexedDB (core)
 │     ↑ получает позиции из МенюПлан через ShoppingBridge
 ├── /menuplan/      ← Supabase (своя БД, без изменений)
 │     └── ShoppingDB.build() → генерирует shopping list
 │           └── → ShoppingBridge.syncToLifeOS() → записывает в DB.purchases
 └── db.js (core)   ← общий IndexedDB для tasks, purchases, projects
```

### ShoppingBridge (новый файл)
```javascript
// /menuplan/shopping-bridge.js
const ShoppingBridge = {
  // Вызывается после ShoppingDB.build()
  async syncToLifeOS(weekKey, shoppingItems) {
    // Удаляем старые позиции из МенюПлан этой недели
    const existing = await DB.query('purchases', { sourceType: 'meal_plan', weekKey });
    for (const e of existing) await DB.delete('purchases', e.id);

    // Записываем новые
    for (const item of shoppingItems) {
      await DB.create('purchases', {
        name:       item.name,
        price:      item.cost || null,
        category:   item.category || null,
        status:     'wish',
        sourceType: 'meal_plan',
        sourceId:   weekKey,
        weekKey:    weekKey,
        unit:       item.unit,
        qty:        item.qty,
        metadata:   { productId: item.productId, fromMenuPlan: true },
      });
    }
  },

  // Синхронизировать checked-статус обратно
  async syncCheckbackToMenuPlan(weekKey) {
    const items = await DB.query('purchases', { sourceType: 'meal_plan', weekKey });
    return items.map(i => ({
      productId: i.metadata?.productId,
      checked:   i.status === 'in_stock',
    }));
  },
};
```

---

## Файловая структура (итоговая)

```
/lifeos/
  core/
    db.js            ← LifeOS IndexedDB core
    ui.js            ← shared UI
    styles.css       ← дизайн-система

  hub/
    index.html       ← лаунчер

  purchases/
    index.html       ← мигрирован ✓

  menuplan/          ← МенюПлан (минимальные изменения)
    index.html       ← подключает styles.css (шрифты + токены)
    db.js            ← Supabase layer (без изменений)
    app.js           ← + импортирует shopping-bridge.js
    shopping-bridge.js  ← NEW: мост в LifeOS purchases
    screens/
      shopping.js    ← + вызывает ShoppingBridge.syncToLifeOS()
    styles.css → ../core/styles.css (symlink или import)
    ... (остальные файлы без изменений)

  projects/
    index.html       ← будущий модуль
```

---

## Что менять в МенюПлан (минимум)

### 1. styles.css → подключить core

В `index.html` заменить:
```html
<!-- БЫЛО -->
<link rel="stylesheet" href="styles.css">

<!-- СТАНЕТ -->
<link rel="stylesheet" href="../core/styles.css">
<link rel="stylesheet" href="menuplan-local.css">
```

`menuplan-local.css` — только то, что уникально для МенюПлана  
(nav стили, recipe card, timer HUD и т.д.)

> ⚠️ Токены цветов в МенюПлане сейчас другие: `--accent: #7c6af7`, `bg: #0a0a12`  
> В core: `--accent: #5b6ef5`, `bg: #0a0a0f`  
> Нужно привести к одному — взять core-токены как master.

### 2. shopping.js → добавить вызов bridge

```javascript
// В screens/shopping.js, после ShoppingDB.build():
const items = await ShoppingDB.build(weekKey);
await ShoppingBridge.syncToLifeOS(weekKey, items);
```

### 3. index.html → добавить скрипт bridge

```html
<script src="../core/db.js"></script>       <!-- LifeOS DB -->
<script src="shopping-bridge.js"></script>  <!-- bridge -->
<script src="db.js"></script>               <!-- MenuPlan Supabase -->
```

> db.js от LifeOS и db.js от МенюПлана не конфликтуют:  
> LifeOS экспортирует `window.DB`, МенюПлан использует `sb`, `Products`, `Recipes` и т.д.

### 4. manifest.json → обновить

```json
{
  "name": "LifeOS — Питание",
  "short_name": "Питание",
  "start_url": "./menuplan/",
  "theme_color": "#0a0a0f"
}
```

---

## Дизайн-система: что унифицировать

| Параметр | МенюПлан сейчас | LifeOS Core | Решение |
|---|---|---|---|
| Шрифт body | Inter | Syne | → Syne |
| Шрифт заголовков | Playfair Display | Syne 800 | → Syne 800 |
| Шрифт моно | нет отдельного | DM Mono | → DM Mono |
| `--bg` | `#0a0a12` | `#0a0a0f` | → `#0a0a0f` |
| `--accent` | `#7c6af7` | `#5b6ef5` | → `#5b6ef5` |
| Радиус карточки | `12px` | `10px` | → `10px` (var(--r)) |
| Nav | bottom fixed | bottom fixed | совместимы |

МенюПлан имеет свой обширный `styles.css` — его **не удалять**, а:
1. Токены привести к core-значениям
2. Общие компоненты (card, badge, modal, toast, button) убрать — использовать из core
3. Специфичные (recipe-card, nutrition-bar, timer-hud, week-grid) оставить в `menuplan-local.css`

---

## Порядок работы (итерации)

### Итерация A — Bridge (быстрая, без риска)
1. Написать `shopping-bridge.js`
2. Добавить вызов в `screens/shopping.js`
3. Проверить что покупки из меню появляются в `/purchases/`

**Результат**: кросс-модульный shopping работает. МенюПлан не сломан.

### Итерация B — Дизайн-унификация
1. Обновить токены в МенюПлан → core-значения
2. Заменить шрифт Inter → Syne
3. Убрать дублирующиеся компоненты, подключить `core/styles.css`

**Результат**: единый визуальный язык.

### Итерация C — Hub
1. Hub знает о МенюПлан как модуле
2. Виджет "Питание сегодня" на дашборде — читает из Supabase через БД МенюПлана
3. Виджет "Список покупок" — читает из IndexedDB (purchases с sourceType:'meal_plan')

### Итерация D (долгосрочно) — опционально
Миграция МенюПлан на IndexedDB, если появится нужда в offline-first.  
Пока не приоритет — приложение без сети всё равно не нужно планировать меню.

---

## Риски

| Риск | Уровень | Митигация |
|---|---|---|
| Конфликт `window.DB` vs MenuPlan globals | Средний | LifeOS db.js уже пишет в window.DB; МенюПлан не использует это имя |
| Дублирование shopping items при повторном build | Низкий | Bridge удаляет старые перед вставкой (по sourceType+weekKey) |
| Шрифты — Playfair→Syne меняет верстку | Средний | Тестировать на recipe cards, длинные названия |
| Supabase URL/KEY не заданы | Высокий | МенюПлан не работает без них — это ок, отдельный конфиг |

---

## Что создать прямо сейчас

Приоритет 1: **`/menuplan/shopping-bridge.js`** — мост shopping

Приоритет 2: **Обновлённый `/menuplan/index.html`** — подключает core/styles.css, добавляет bridge script

Приоритет 3: **Патч `/menuplan/screens/shopping.js`** — вызов bridge после build

МенюПлан db.js, app.js, router.js, все screen-файлы — **не трогаем**.

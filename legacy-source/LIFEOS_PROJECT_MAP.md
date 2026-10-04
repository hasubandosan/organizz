# LifeOS — Карта проекта (handoff-документ)

Этот документ — полный контекст проекта для продолжения разработки.
Прочитай его целиком перед тем как писать любой код.

---

## Что такое LifeOS

Персональная операционная система — набор веб-приложений (PWA) для управления жизнью.
Каждый модуль — отдельная HTML-страница. Общий core. Никакого фреймворка, никакого сборщика.
Только vanilla JS + HTML + CSS. Работает как набор файлов открытых через браузер или простой HTTP-сервер.

---

## Changelog (что изменилось после этого хендоффа)

Ниже — журнал фактических изменений поверх статуса, описанного в разделах
ниже (некоторые пункты карты успели устареть: `/purchases/` был по факту
сломан, `/projects/` уже сделан). Новые записи сверху.

### Дерево задач: drag-n-drop, цветные чипы приоритета/статуса — `/projects/index.html`

- **Drag-n-drop дерева тасков.** Строки задач (`mkTaskRow`) теперь
  `draggable="true"`. Перетаскивание одной задачи на другую выставляет ей
  `parentId` цели (`ttDrop`) — так она становится подзадачей. Вверху
  списка задач и внутри проекта появилась пунктирная зона «перетащи сюда,
  чтобы отвязать от родителя» (`ttDropRoot`, снимает `parentId`). Есть
  защита от переноса задачи в саму себя или в собственного потомка
  (проверка через уже существующий `_collectDescendantIds`). При переносе
  `projectId` задачи синхронизируется с `projectId` цели, чтобы задача не
  «зависла» в чужом проекте.
  **Ограничение:** используется нативный HTML5 Drag and Drop API — это
  только мышь/трекпад, на тач-устройствах события не срабатывают.
  Тач-версии (drag через долгое нажатие и т.п.) пока нет.
- **Чипы приоритета.** Вместо `<select>` — три цветные кнопки (🔴 High /
  📅 Medium / ○ Low), такие же цвета, как у `UI.priorityBadge()` в
  режиме просмотра. Скрытый `<input>` (`p-pri`/`t-pri`) по-прежнему
  хранит значение, так что `saveProj()`/`saveTask()` не пришлось менять —
  чипы просто пишут в него (`wireChipPicker`/`syncChipPicker`).
- **Чипы статуса.** Тот же паттерн (`.stat-sel`/`.stat-opt`), но
  специально **без цвета** — только эмодзи (💡📋🔄⏸✅📦). Цвет закреплён
  за приоритетом, эмодзи — за статусом.

### Центрирование модалок на десктопе — `/projects/index.html`

- У `.modal-overlay` в общем `core/styles.css` нет `justify-content` —
  `align-items: flex-end` там есть, а по горизонтали не центрируется. Это
  было незаметно, пока `.modal` был на всю ширину. Как только в этом
  файле включился `max-width` для модалок на ПК (`@media
  (min-width:768px)`), баг проявился — окно прилипало к левому нижнему
  углу. Починено добавлением `justify-content: center; align-items:
  center;` в тот же media query + скругление всех 4 углов на десктопе
  (было — только верхних, под мобильный bottom-sheet).
  **Важно:** баг живёт в общем паттерне, а не в одном файле — если такой
  же `max-width` добавить в модалку `/purchases/` или другой модуль без
  такого же фикса `justify-content`, вылезет тот же баг. Стоит когда-нибудь
  поправить в самом `core/styles.css`.

### Проекты: варианты покупок, компактная галерея, модалка просмотра таска, единое поле саб-таска — `/projects/index.html`

- **Покупки внутри проекта теперь тоже на модели вариантов.** Модалка
  `#m-pur` была плоской (`pu-price`, один `pu-ig` для фото). Теперь в ней
  тот же редактор вариантов, что и в `/purchases/` (бренд/название, цена,
  магазин из `DB.getAll('shops')`, ссылка, заметка, **фото на каждый
  вариант**, звезда «основной»). `savePur()` пишет покупку и
  create/update/delete по `purchase_variants`.
  - Статусы покупки сокращены с 5 (`planned, wish, ordered, in_stock,
    cancelled`) до 3, как в `/purchases/`: `wish, ordered, in_stock`.
    `planned` остаётся у проектов и задач — только у покупок его убрали.
  - Добавлен хелпер `primaryVariantOfPurchase(pu)` — берёт основной
    вариант через `DB.getPrimaryVariant`, с фолбэком на старые плоские
    `price`/`imageIds` (для покупок, созданных до модели вариантов, в том
    числе демо-данные из `seed()`). Бюджет проекта (потрачено/план/
    осталось) и строки покупок теперь читают цену через этот хелпер, а не
    `pu.price` напрямую.
- **Компактная галерея фото.** Добавлен класс `.detail-img-gallery`
  (auto-fill сетка, `minmax(100px,1fr)`) для режима просмотра — заменил
  общий `.img-grid` (жёсткие 3 колонки), который на широком десктопном
  layout раздувал превью в огромные плитки. Общий `.img-grid` не
  трогали — он всё ещё используется в редактируемых пикерах фото внутри
  модалок. Заодно фото задачи впервые стали показываться (раньше их не
  было видно нигде, кроме мини-превью 30×30 в строке).
- **Клик по задаче открывает модалку просмотра, а не редактирование.**
  Новое окно `#m-task-view`: имя, статус/приоритет/теги, родитель/
  проект/срок/стоимость, заметки, фото, подзадачи, кнопки «отметить
  выполненным» и «удалить». Кнопка ✎ в шапке закрывает эту модалку и
  открывает настоящее редактирование (`editTaskFromView()`). Маленькая
  иконка ✎ на самой строке задачи не тронута — по-прежнему сразу ведёт в
  редактирование как быстрый шорткат. `showTask()` больше не переключает
  страницу (`showDetail`) — рендерит в `#task-view-body` и открывает
  `#m-task-view`.
- **Единое поле для подзадач.** Было два инпута (создать новую / найти
  существующую). Объединены в один (`sub-inp`): по мере ввода снизу
  показываются совпадающие задачи (клик — привязывает как подзадачу,
  уже привязанные и сама задача с потомками исключены из поиска); Enter
  или кнопка «＋ Add» всегда создают новую подзадачу с введённым текстом,
  независимо от того, были ли найдены совпадения.

### Покупки: полный рефакторинг — варианты, магазины, фильтры, группировка, компактная карточка

**Файлы:** `purchases/index.html` (переписан целиком), `core/db.js`,
`core/purchase-quickadd.js` (новый), `core/shopping-bridge.js`,
`hub/index.html`

Причина: несмотря на статус «✅ Готов» в карте выше, модуль был
фактически сломан — `resetForm()`/`openEdit()`/`saveItem()` ссылались на
несуществующие поля `#fPrice`/`#fUrl`/`#fStore`, из-за чего открытие
«Новая покупка» падало с ошибкой и ничего не сохранялось. Редактор
вариантов и шторка магазинов существовали в HTML/CSS, но без единой
строчки JS-логики.

**Модель данных:**
- Новая коллекция **`purchase_variants`**: `{ id, purchaseId, title,
  price, shopId, url, notes, isPrimary, imageIds, createdAt }`. У покупки
  может быть 0, 1 или несколько вариантов; максимум один — `isPrimary`
  (он показывается на карточках).
- Новая коллекция **`shops`**: `{ id, name, logo, url }`. Была
  зарезервирована в `COLLECTIONS`, но не использовалась — теперь полный
  CRUD через шторку «Магазины» (добавление/удаление — **редактирования
  пока нет**, см. ниже).
- Обе коллекции добавлены в `COLLECTIONS` в `db.js`, попадают в
  export/import/clear-all.
- **Фото переехало с покупки на вариант.** У самой покупки фото больше
  нет — показывается фото основного варианта. Старые покупки (фото/цена
  плоско на самой покупке) по-прежнему отображаются через фолбэк и
  мигрируют в настоящий вариант при первом редактировании.
- Новые хелперы в `db.js`: `DB.getVariants(purchaseId)`,
  `DB.getPrimaryVariant(purchaseId)`, `DB.setPrimaryVariant(purchaseId,
  variantId)`, `DB.quickAddPurchase({name, variant, ...})`.

**UI модуля покупок:**
- Сетка галереи — `repeat(auto-fill, minmax(var(--tile-min,150px),
  1fr))` вместо жёстких 2–4 колонок. Само по себе чинит «2 огромные
  колонки на ноутбуке» — широкий экран сам укладывает много компактных
  плиток. Кнопки ± меняют `--tile-min` (100–260px).
- Редактор вариантов — рабочий: добавление/удаление строк, фото на
  вариант, бренд, цена, магазин, ссылка, заметка, звезда «основной».
- Шторка «Магазины»: добавление/удаление.
- **Фильтры** собраны в одну шторку 🎚 (кнопка с бейджем количества)
  вместо вечно висящего ряда источников: мультивыбор по источнику,
  категории, тегам, магазину + диапазон цены + «сбросить всё». Статус
  остался быстрыми вкладками в шапке (самый частый фильтр).
- **Группировка**: без группировки / по категориям / по тегам — в обеих
  раскладках (галерея и список).
- **Компактная карточка покупки с выбором варианта.** Раньше — full-screen
  панель, съезжающая справа, на ноутбуке выглядела как пустая страница.
  Теперь та же система `.sheet`, что у форм (снизу на телефоне, по центру
  ~440px на десктопе). Если у покупки 2+ варианта — клик по варианту в
  карточке сразу вызывает `DB.setPrimaryVariant()` и обновляет карточку.
- Все шторки (форма/категории/магазины/карточка/аналитика/фильтры) теперь
  на одном общем `overlay` + `openSheet(name)`/`closeSheets()`.

**`core/purchase-quickadd.js` (новый файл):** самодостаточный виджет для
других модулей — вызывается без загрузки всего модуля покупок:
```js
PurchaseQuickAdd.open({
  sourceType: 'cosplay', projectId, cosplayId, category,
  onSaved: (purchase, variant) => { ... },
});
```
Обязательно только имя. Опционально: бренд, цена, комментарий, фото — всё
уходит в один вариант. Кнопки: «Отмена», «+ Ещё вариант» (сохраняет
черновик варианта, не создавая покупку), «Добавить» (создаёт покупку +
все накопленные варианты разом).
**Пока никуда не подключён** — ни `/projects/`, ни косплеи его не
вызывают (в проектах сделан свой инлайновый редактор вариантов).

**`core/shopping-bridge.js`:** `syncToLifeOS`/`clearWeek` теперь создают
запись в `purchase_variants` рядом с покупкой из МенюПлана вместо записи
`price`/`store` прямо в покупку, и чистят вариант при пересинхронизации.

**`hub/index.html`:** виджет покупок берёт цену через
`DB.getPrimaryVariant()` вместо `p.price`.

**Известные пробелы:**
- `PurchaseQuickAdd` не используется в `/projects/` (там свой дублирующий
  редактор вариантов).
- Магазины нельзя редактировать, только удалить и создать заново.
- Статус (`wish/ordered/in_stock`) — на покупке целиком, не на варианте:
  купил один из трёх вариантов — вся покупка помечается купленной.
- Нет проверки на дубли при создании магазина/категории.
- `/cosplays/` не трогали.

---

## Файловая структура (итоговая)

```
/lifeos/                        ← корень проекта
  /core/                        ← ОБЩИЙ CORE (не трогать без причины)
    db.js                       ✅ готов — Storage Driver (localStorage JSON)
    ui.js                       ✅ готов — UI утилиты (toast, modal, badges, images)
    styles.css                  ✅ готов — дизайн-система
    shopping-bridge.js          ✅ готов — мост МенюПлан → purchases

  /hub/                         ⬜ не начат — лаунчер/дашборд
    index.html

  /purchases/                   ✅ готов
    index.html                  ✅ полностью на core

   /meals/                       🔧 частично готов
     index.html                  ✅ обновлён (подключает core, Supabase, Sortable)
     db.js                       ✅ пофикшен (demo-режим, bridge-вызовы, Toggle)
     app.js                      ✅ пофикшен (нет бесконечной загрузки)
     menuplan-local.css          ✅ готов (стили модуля, дубликаты ядра удалены)
     manifest.json               ✅ обновлён
     sw.js                       ✅ обновлён
     LIFEOS_MENUPLAN_INTEGRATION.md  ✅ присутствует
     screens/
       menu.js                   ⬜ файлы SPA (не HTML!)
       recipes.js                ⬜ существуют у пользователя
       products.js               ⬜ существуют у пользователя
       shopping.js               🔧 нужно проверить совместимость с demo-режимом
       profile.js                ⬜ существуют у пользователя
       collections.js            ⬜ существуют у пользователя
       templates.js              ⬜ существуют у пользователя
       mealprep.js               ⬜ существуют у пользователя
     utils.js                    ⬜ существует у пользователя, не менялся
     router.js                   ⬜ существует у пользователя, не менялся
     components.js               ⬜ существует у пользователя, не менялся
     ai-import.js                ⬜ существует у пользователя, не менялся

  /projects/                    ⬜ не начат
    index.html

  /cosplays/                    ⬜ существует у пользователя (старое приложение)
    index.html                  — standalone, не на core (на Supabase + DEMO fallback)
                                — нужна миграция на core (низкий приоритет)
```

---

## Core — подробно

### core/db.js — Storage Driver

**Текущий драйвер: localStorage JSON**

Вся логика хранения изолирована в объекте `_STORE` (≈60 строк).
Чтобы сменить хранилище — заменить только `_STORE`. Публичный API не меняется.

**Публичный API (window.DB):**
```javascript
DB.create(col, data)          // → entity (с id, createdAt, updatedAt, tags[], imageIds[], metadata{})
DB.update(col, id, patch)     // → updated entity | null
DB.delete(col, id)            // → true
DB.getById(col, id)           // → entity | null
DB.getAll(col)                // → entity[]
DB.query(col, filter)         // → entity[]  (фильтр по полям, точное совпадение)
DB.search(cols, term)         // → entity[]  (полнотекстовый по name/title/description/notes/tags)
DB.getTags()                  // → tag[]
DB.createTag(name)            // → tag
DB.deleteTag(id)              // → true
DB.saveImage(base64, meta)    // → imageId (string)
DB.getImage(id)               // → {id, data, createdAt} | null
DB.deleteImage(id)            // → true
DB.stats()                    // → {projects, tasks, purchases, areas, active, completed}
DB.exportAll()                // → bundle JSON (без изображений)
DB.exportWithImages()         // → bundle JSON (с изображениями)
DB.importAll(bundle)          // → void
DB.clearAll()                 // → void
DB.storageInfo()              // → {bytes, kb, mb, pct, driver}
```

**Коллекции:**
```
areas, projects, tasks, purchases, tags, categories,
notes, people, events, health_records, cosplays,
meal_products, meal_recipes, meal_weeks, meal_settings
```

**Структура entity (базовая):**
```javascript
{
  id:            string (UUID),
  entityType:    string (имя коллекции без 's'),
  schemaVersion: number,
  createdAt:     ISO string,
  updatedAt:     ISO string,
  tags:          string[],
  imageIds:      string[],
  metadata:      object,
  // + любые поля модуля
}
```

**Глобальные переменные из db.js:**
- `window.DB` — публичный API
- `window.lifeosInit()` — async, вызвать при старте страницы
- `window.calcTaskTotalCost(taskId, allTasks)` — рекурсивный бюджет задач
- `window.LIFEOS_VERSION`, `window.SCHEMA_VERSION`

**Смена драйвера:** см. `core/STORAGE_DRIVERS.md`

---

### core/ui.js — UI утилиты

**Глобальные переменные:**
- `window.UI` — все утилиты
- `window.STATUS_LABEL` — маппинг статусов в читаемые строки

**API:**
```javascript
UI.statusBadge(status)                              // → HTML строка
UI.priorityBadge(priority)                          // → HTML строка
UI.tagBadge(tag)                                    // → HTML строка
UI.money(n, currency?)                              // → '1 234 ₽'
UI.date(d)                                          // → '12 янв'
UI.dateTime(d)                                      // → '12 янв, 14:30'
UI.relativeDate(d)                                  // → 'in 3d' / 'overdue'
UI.isOverdue(d, status)                             // → boolean
UI.toast(msg, type?, duration?)                     // type: 'ok'|'err'|'info'
UI.openModal(id)                                    // по id элемента
UI.closeModal(id)
UI.closeModalOnBackdrop(event, id)
UI.previewImage(src)                                // лайтбокс
UI.closeImagePreview()
UI.renderTagGrid(containerId, selectedTags, onToggle)  // async
UI.renderImageGrid(containerId, fileInputId, savedIds, buffer)  // async
UI.handleImageFiles(files, buffer, containerId, fileInputId, savedIds)
UI.flushImageBuffer(buffer, existingIds?)           // async → imageIds[]
UI.emptyState(icon, title, desc)                    // → HTML строка
UI.taskCostRow(task, allTasks)                      // async → HTML строка
```

---

### core/styles.css — дизайн-система

**Шрифты:** Syne (основной, 400/600/700/800) + DM Mono (цифры, коды, моно)

**CSS переменные:**
```css
/* Фон */
--bg:      #0a0a0f    /* основной */
--bg2:     #111118    /* карточки */
--bg3:     #16161f    /* инпуты, чипы */
--bg4:     #1c1c28    /* hover */

/* Текст */
--text:    #f0f0f8
--text2:   #9494b0
--text3:   #5a5a78

/* Границы */
--border:  #1e1e2e
--border2: #2a2a3e

/* Акценты */
--accent:  #5b6ef5    /* primary */
--accent2: #818cf8    /* lighter */

/* Статусы */
--green:   #3dd68c
--yellow:  #f0c040
--red:     #f05060
--purple:  #a78bfa

/* Safe areas */
--st: env(safe-area-inset-top)
--sb: env(safe-area-inset-bottom)

/* Типографика */
--f:  'Syne', sans-serif
--m:  'DM Mono', monospace
--r:  10px   /* border-radius карточек */
```

**Базовые классы:**
```
.badge .b-idea .b-planned .b-active .b-paused .b-done .b-archived
.b-high .b-med .b-tag
.btn .btn-danger .btn-ghost
.card
.modal-overlay .modal-sheet
.empty-state .empty-icon .empty-title .empty-desc
.toast .toast-ok .toast-err .toast-info
.tag-chip .tag-chip-add .selected
.img-thumb .img-add
```

---

### core/shopping-bridge.js

Мост между МенюПланом (Supabase/Demo) и LifeOS purchases (core DB).
Вызывается автоматически из `meals/db.js` — модулям подключать не нужно.

```javascript
ShoppingBridge.syncToLifeOS(weekKey, items)        // async — полная синхронизация недели
ShoppingBridge.toggleInLifeOS(weekKey, productId, checked)  // async — один toggle
ShoppingBridge.clearWeek(weekKey)                  // async — очистить неделю
```

---

## Модули — подробно

### /purchases/ — ✅ Готов

Список покупок. Полностью на `DB.*`.

**Поля entity (purchases):**
```javascript
{
  name:       string,        // обязательно
  price:      number|null,
  category:   string|null,   // из коллекции categories
  url:        string|null,
  store:      string|null,   // магазин (Wildberries, Ozon...)
  notes:      string|null,
  tags:       string[],
  priority:   0|1|2,         // 0=обычный, 1=плановый, 2=срочно
  status:     'wish'|'ordered'|'in_stock',
  sourceType: 'manual'|'task'|'cosplay'|'meal_plan'|'wishlist',
  sourceId:   string|null,   // id источника
  weekKey:    string|null,   // для meal_plan: '2025-W22'
  imageIds:   string[],
  metadata:   object,
}
```

**Функциональность:**
- Виды: галерея (2/3/4 колонки) + список (сгруппированный по категориям)
- Фильтры: по статусу (табы) + по источнику (пилюли) + поиск
- Сортировка: приоритет / цена↑ / цена↓ / дата
- Detail panel (слайд справа): мета-грид, ссылка, смена статуса одной кнопкой
- Аналитика: потрачено / запланировано / % выполнения / бары по категориям / по источникам
- Управление категориями (CRUD) через отдельный sheet
- Фото через `DB.saveImage()` / `DB.getImage()`

**Что НЕ реализовано (сделать позже):**
- Импорт из буфера обмена (ссылка → парсинг цены)
- Экспорт в CSV
- Напоминания (когда статус 'ordered' уже N дней)
- Бюджет на категорию/месяц

---

### /meals/ — 🔧 Частично готов

Планировщик питания. Основная логика на Supabase, подключён core для bridge.

**Режимы работы:**
- `DEMO_MODE = true` — Supabase не настроен, stub-клиент, данные не сохраняются между сессиями
- `DEMO_MODE = false` — нормальная работа через Supabase (нужен URL + KEY)

**Как настроить Supabase:**
В `meals/db.js` вверху:
```javascript
const SUPABASE_URL = window.LIFEOS_SUPABASE_URL || '';
const SUPABASE_KEY = window.LIFEOS_SUPABASE_KEY || '';
```
Создать `meals/config.js` (не коммитить!):
```javascript
window.LIFEOS_SUPABASE_URL = 'https://xxxx.supabase.co';
window.LIFEOS_SUPABASE_KEY = 'eyJ...';
```
Подключить перед `db.js` в `index.html`.

**Supabase таблицы** (SQL в `meals/supabase_migration.sql`):
`products`, `recipes`, `collections`, `weeks`, `meal_presets`, `templates`, `shopping_lists`, `settings`

**Интеграция с LifeOS:**
При `ShoppingDB.build(weekKey)` → автоматически вызывается `ShoppingBridge.syncToLifeOS()` → покупки появляются в `/purchases/` с `sourceType: 'meal_plan'`

**Что НЕ реализовано / нужно проверить:**
- `screens/*.js` не проверялись на совместимость с demo-режимом
- Файлы `utils.js`, `router.js`, `components.js`, `ai-import.js` не менялись

---

### /hub/ — ⬜ Не начат

Лаунчер и дашборд LifeOS. Точка входа в систему.

**Что должно быть:**
- Список модулей с иконками → переход по клику
- Виджеты: задачи на сегодня, покупки pending, меню на сегодня
- Глобальный поиск по всем коллекциям (`DB.search(allCols, term)`)
- Статистика (`DB.stats()`)
- Кнопка экспорта/импорта данных
- Кнопка просмотра storageInfo

**Связи:**
- Читает из `DB.getAll('tasks')`, `DB.getAll('purchases')`, `DB.stats()`
- Для виджета питания — читает `meal_weeks` из localStorage (если МенюПлан уже синхронизировал)

---

### /projects/ — ⬜ Не начат

Проекты и задачи. GTD-подобная система.

**Планируемые поля entity (projects):**
```javascript
{
  name:        string,
  description: string|null,
  status:      'idea'|'planned'|'in_progress'|'paused'|'completed'|'archived',
  priority:    0|1|2,
  areaId:      string|null,   // связь с areas
  dueDate:     ISO|null,
  tags:        string[],
  imageIds:    string[],
}
```

**Планируемые поля entity (tasks):**
```javascript
{
  name:        string,
  status:      'not_started'|'in_progress'|'completed'|'cancelled',
  priority:    0|1|2,
  projectId:   string|null,
  parentId:    string|null,   // вложенные задачи
  dueDate:     ISO|null,
  selfBudget:  number|null,   // бюджет задачи
  cost:        number|null,   // фактические затраты
  tags:        string[],
}
```

**Функции уже в core:**
- `calcTaskTotalCost(taskId, allTasks)` — рекурсивный бюджет с учётом подзадач

---

### /cosplays/ — ⬜ Требует миграции (низкий приоритет)

Существующее приложение пользователя. Работает на Supabase + DEMO fallback (in-memory массивы).

**Текущая структура данных:**
- `cosplay_characters` → `cosplay_looks` → `cosplay_items`
- `cosplay_items` уже синхронизирует в Supabase таблицу `purchases` через `syncItemToPurchases()`
- Поле `source_module: 'cosplay'` — зачаток relations

**Что нужно при миграции:**
- Заменить Supabase-вызовы на `DB.*`
- `cosplay_items` с `preferred variant` → `DB.purchases` с `sourceType: 'cosplay'`
- Фотографии из Supabase Storage → `DB.saveImage(base64)`
- DEMO in-memory массивы → `DB.*` (данные начнут сохраняться)

---

## Соглашения по коду

### Структура модуля (purchases как эталон)
```javascript
// 1. STATE — все переменные состояния вверху
let items = [], categories = [], filterStatus = 'all', ...

// 2. LOAD — функции загрузки данных из DB
async function loadItems() { items = await DB.getAll('purchases'); }

// 3. RENDER — функции отрисовки
function render() { ... }
async function renderGallery(list) { ... }

// 4. DETAIL / PANELS — открытие/закрытие панелей
async function openDetail(id) { ... }

// 5. FORM — логика формы добавления/редактирования
function resetForm() { ... }
async function openEdit(id) { ... }

// 6. CONTROLS — обработчики кнопок, фильтров, поиска
$('searchIn').addEventListener('input', ...)

// 7. UTILS
function esc(s) { return String(s||'').replace(/&/g,'&amp;')... }

// 8. BOOT
(async () => {
  await lifeosInit();
  await loadItems();
  render();
})();
```

### Правила
- `DB.*` — единственный способ работы с данными. Никакого прямого localStorage в модулях.
- `UI.*` — для toast, modal, badges. Не переопределять.
- `esc(s)` — всегда экранировать пользовательский текст перед вставкой в innerHTML.
- `async/await` везде — никаких .then() цепочек.
- Анимации через CSS `animation: fadeUp .2s ease both` + `animation-delay`.
- Изображения — только через `DB.saveImage()` / `DB.getImage()`. Не хранить base64 в entity напрямую.

### Подключение скриптов в HTML модуля
```html
<!-- ОБЯЗАТЕЛЬНЫЙ ПОРЯДОК -->
<script src="../core/db.js"></script>       <!-- 1. LifeOS DB (window.DB, lifeosInit) -->
<script src="../core/ui.js"></script>       <!-- 2. UI утилиты (window.UI) -->
<!-- Для МенюПлана дополнительно: -->
<script src="../core/shopping-bridge.js"></script>  <!-- после db.js, до menuplan/db.js -->
```

---

## Дизайн-система — ключевые паттерны

### Sheet (bottom drawer)
```html
<div class="overlay" id="overlay"></div>
<div class="sheet" id="mySheet">
  <div class="drag-handle"></div>
  <div class="sheet-hdr">...</div>
  <div class="sheet-body">...</div>
</div>
```
Открытие: `.overlay.classList.add('on')` + `.sheet.classList.add('on')`

### Detail panel (слайд справа)
```html
<div class="detail-panel" id="detailPanel">
  <div class="detail-panel-hdr">...</div>
  <div class="detail-panel-body">...</div>
  <div class="detail-actions">...</div>
</div>
```
Открытие: `.classList.add('open')`

### Карточки в галерее
```html
<div class="gal-card" data-prio="1" data-id="...">
  <div class="gal-img">...</div>
  <div class="gal-body">
    <div class="gal-name">...</div>
    <div class="gal-price">...</div>
  </div>
</div>
```

### Карточки в списке
```html
<div class="p-card" data-prio="1">
  <div class="p-thumb">...</div>
  <div class="p-body">
    <div class="p-name">...</div>
    <div class="p-meta-row">...</div>
  </div>
  <div class="p-right">...</div>
</div>
```

---

## Следующие шаги (приоритет)

### 1. Hub (/hub/index.html)
Дашборд — точка входа. Виджеты: задачи сегодня, топ покупок по приоритету, меню дня.
Глобальный поиск. Кнопки перехода в модули. Export/Import данных.

### 2. Projects (/projects/index.html)
Проекты + задачи. GTD. Иерархия задач (parentId). Бюджет через `calcTaskTotalCost`.
Связь с areas. Kanban или список с группировкой по статусу.

### 3. Проверка МенюПлана в demo-режиме
Открыть приложение без Supabase. Пройтись по всем screens/*.js.
Найти вызовы которые падают без Auth.uid() (возвращает null в demo).
Добавить guard: `if (!Auth.uid()) return DEMO_DATA;`

### 4. Миграция Cosplay
Заменить Supabase + in-memory на DB.*. Подключить core/styles.css.

---

## Важные детали которые легко упустить

1. **`shopping-bridge.js`** — только в `/core/shopping-bridge.js`. Старый дубль в `/meals/shopping-bridge.js` удалён.

2. **`screens/` старые standalone HTML** — удалены (menu.html, recipes.html, profile.html, shopping.html). Используются SPA `.js` файлы.

3. **Изображения и localStorage лимит** — при переполнении `_STORE` автоматически очищает `_images`. Предупредить пользователя через `DB.storageInfo()` в Hub когда `pct > 80`.

4. **`DB.query()` фильтрует точным совпадением** — для сложных фильтров (несколько полей) передавать объект: `DB.query('purchases', { sourceType: 'meal_plan', weekKey: '2025-W22' })`. Для фильтра по массиву значений передать массив: `DB.query('tasks', { status: ['in_progress', 'not_started'] })`.

5. **`lifeosInit()` не async open()** — в JSON-драйвере `localStorage` синхронный. `lifeosInit()` просто запускает миграции. Вызывать один раз при старте.

6. **Экранирование** — везде где пользовательский текст вставляется через innerHTML, использовать функцию `esc()`. Она должна быть в каждом модуле локально (или вынести в ui.js).

7. **Cosplay → purchases bridge** — в cosplay уже есть `syncItemToPurchases()` которая пишет в Supabase. После миграции на core — заменить на `DB.create('purchases', { ..., sourceType: 'cosplay' })`.

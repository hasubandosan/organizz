# Хендофф: миграция нового модуля LifeOS

Эту инструкцию получает бот, которому поручили перевести один модуль
(`meals` / `purchases` / `cosplays` / ...) с localStorage на общий backend.

**Сначала прочитай `docs/ARCHITECTURE.md`** — без этого контекста инструкция
ниже не будет понятна.

## Твои границы (не выходи за них без согласования)

**Можно создавать/менять:**
- `frontend/<module>/` — сам код модуля (копия из `legacy-source/<module>/`)
- `backend/src/db/schema/<module>.ts` — новый файл
- `backend/src/index.ts` — ОДНА новая строка с роутом
- `backend/drizzle/seed.sql` — ОДНА новая строка регистрации

**Нельзя трогать без согласования с человеком:**
- `backend/src/apps/entityRoutes.ts` (общая фабрика CRUD)
- `backend/src/middleware/auth.ts`, `backend/src/auth/*` (общая авторизация)
- `frontend/core/*` (общий db.js/ui.js/styles.css)
- любой код другого модуля

## Шаги

### 1. Backend: schema
Скопируй `backend/src/db/schema/projects.ts` в `backend/src/db/schema/<module>.ts`.
Поменяй `pgSchema('projects')` на `pgSchema('<module>')`. Больше ничего менять
не нужно — таблица `entities` универсальна для любого модуля.

Добавь экспорт в `backend/src/db/schema/index.ts`:
```ts
export * from './<module>.js';
```

Добавь путь в `backend/drizzle.config.ts` (оба места — `schema` и `schemaFilter`).

### 2. Backend: роут
В `backend/src/index.ts`:
```ts
import { entities as <module>Entities } from './db/schema/<module>.js';
// ...
app.use('/<module>', createEntityRouter('<module>', <module>Entities));
```

### 3. Backend: регистрация модуля
В `backend/drizzle/seed.sql`, в INSERT INTO registry.apps, добавь строку:
```sql
('<module>', 'LifeOS: <человекочитаемое имя>', '<module>', false, 'active'),
```

### 4. Backend: миграция
```bash
cd backend
npm run db:generate
npm run db:migrate
```
Применить новый `seed.sql`-insert в Neon SQL Editor вручную (только новую строку,
не весь файл повторно — он идемпотентный через `ON CONFLICT DO NOTHING`, но
проверь перед прогоном).

### 5. Frontend: копия + патч APP_SLUG
```bash
cp -r legacy-source/<module> frontend/<module>
```
В `frontend/<module>/*.html` замени ссылки на core (если они указывают не на
`../core/`, а на свой локальный `core/` — приведи к общему `../core/`, как
в `frontend/projects/`).

**НЕ копируй отдельный db.js в папку модуля** — модуль должен использовать
`frontend/core/db.js`. Единственное, что у этого общего `db.js` жёстко
захардкожено под один модуль — константа `APP_SLUG`. Если ты мигрируешь
модуль, у которого открыта вкладка браузера с другим модулем одновременно
(два разных APP_SLUG в одном глобальном db.js) — это конфликт, который
нужно решить ДО того как мигрируешь второй модуль. Скорее всего решение:
вынести `APP_SLUG` не константой в файле, а из `<script>`-атрибута страницы
или из URL — сообщи об этом человеку, не решай сам, это общий файл.

### 6. Проверка
1. `npm run dev` в `backend/`
2. Открыть `frontend/<module>/index.html` в браузере (или через `npx serve frontend`)
3. Должен сработать редирект на логин, если токена нет
4. После логина — проверить, что CRUD-операции модуля реально доходят до Neon
   (смотреть в Neon SQL Editor: `SELECT * FROM <module>.entities;`)

### 7. Что доложить человеку по итогу
- Какие коллекции модуля мигрированы (entity_type'ы)
- Были ли в модуле места, где код модуля обращался к `localStorage` НАПРЯМУЮ,
  а не через `DB.*` (значит, автор когда-то нарушил правило "только DB.*,
  никогда localStorage напрямую" — такие места ищи через `grep -rn localStorage frontend/<module>/`)
- Нужны ли этому модулю картинки/файлы (если да — они пока идут как base64,
  то есть реальная интеграция с R2 ещё не сделана нигде, не только в этом модуле)

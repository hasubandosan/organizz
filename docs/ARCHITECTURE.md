# Архитектура organizz / LifeOS

## Стек
- **БД:** один проект Neon (serverless Postgres, free tier), schema-per-module
- **ORM:** Drizzle
- **Backend:** Node.js + Express + TypeScript, запускается через `tsx`
  (не `tsc`-сборка — см. причину в `backend/README.md`)
- **Auth:** свой JWT (библиотека `jose`), один секрет на весь проект —
  токен, выданный в одном модуле, работает во всех остальных
- **Хостинг backend:** Fly.io, приложение `db-connector` (`https://db-connector.fly.dev`), регион `waw`
- **Хостинг frontend:** Netlify, ОДИН сайт `https://tranquil-halva-65395a.netlify.app`,
  публикуется папка `frontend/` целиком (`netlify.toml`), автодеплой при мерже в `main`.
  Модули — пути `/hub/`, `/projects/`, `/purchases/` ...; вход — `/login/`.
- **Файлы/медиа:** Backblaze B2 (S3-совместимое, бакет `organizz-files`, приватный).
  Браузер грузит/читает файлы по временным подписанным ссылкам от backend (`/storage/*`).
  Модулям ничего делать не нужно: просто `DB.saveImage()` / `DB.getImage()` (см. ниже).

## Модель данных

Три типа schema в одной Neon-базе:

- `registry` — реестр всех приложений/модулей (`registry.apps`)
- `auth` — общие пользователи и роли (`auth.users`, `auth.roles`, `auth.user_app_roles`)
- `<module>` (например `projects`, `meals`...) — данные конкретного модуля

Роли пользователя **контекстные**: один и тот же `user_id` может быть `admin`
в одном модуле и `user` в другом (`auth.user_app_roles(user_id, app_id, role_id)`).

## Паттерн данных модуля: generic entity-таблица

Вместо отдельной SQL-таблицы под каждую коллекцию (projects, tasks, areas...)
используется ОДНА таблица `<module>.entities`:

```sql
id          text not null      -- из клиента (crypto.randomUUID() или slug)
entity_type text not null      -- бывшее имя коллекции: 'projects' | 'tasks' | ...
owner_id    uuid not null references auth.users(id)
data        jsonb not null     -- вся запись целиком
created_at, updated_at
PRIMARY KEY (owner_id, entity_type, id)   -- id уникален только в рамках пользователя и типа
```

**Многопользовательность:** каждый пользователь видит и меняет только свои записи
(backend везде фильтрует по `owner_id`). Поэтому фиксированные id (слаги тегов,
служебные записи) у разных пользователей не конфликтуют. Общих между пользователями
данных пока нет.

Это сознательный компромисс: быстрее мигрировать, нет FK-проверок на уровне
БД (как и не было в исходном localStorage-варианте). Если конкретному модулю
нужна строгая реляционная модель — это обсуждается отдельно, паттерн не обязателен.

## Паттерн backend-роутов модуля

`backend/src/apps/entityRoutes.ts` — фабрика `createEntityRouter(appSlug, entitiesTable)`,
даёт готовый CRUD (`GET/:type`, `GET/:type/:id`, `PUT/:type/:id` upsert, `DELETE/:type/:id`)
с уже встроенной проверкой JWT и роли. Новому модулю почти всегда достаточно:

1. `backend/src/db/schema/<module>.ts` — своя `pgSchema('<module>')` + `entities`-таблица
   (копия `projects.ts`, поменять только имя schema)
2. Одна строка в `backend/src/index.ts`:
   `app.use('/<module>', createEntityRouter('<module>', <module>Entities))`
3. Одна строка в `backend/drizzle/seed.sql` — регистрация модуля в `registry.apps`
4. `npm run db:generate && npm run db:migrate`

## Паттерн frontend-клиента модуля

Оригинальный LifeOS-код (vanilla JS) не менялся — только `core/db.js`:
публичный API `DB.create/update/getById/getAll/query/...` остался тем же,
заменён только внутренний `_STORE`-блок (раньше — `localStorage`, теперь —
`fetch()` к backend). Экраны модулей (`screens/*.js`) ничего не знают про сеть.

Если мигрируешь новый модуль (`meals`, `purchases`, `cosplays`) — **НЕ** пиши
новый `db.js` с нуля, скопируй уже патченный `frontend/core/db.js`, поменяй
только константу `APP_SLUG` под свой модуль.

## Слаг модуля и кросс-модульное чтение

`frontend/core/db.js` — ОДИН общий файл для всех модулей. Какому модулю принадлежит
страница, определяет `window.LIFEOS_APP_SLUG`, который страница задаёт ДО подключения
`db.js` (`<script>window.LIFEOS_APP_SLUG='purchases';</script>`). Без него — `'projects'`.

Чтение чужого модуля (нужно только `hub`): `DB.getAll(col, appSlug)`,
`DB.getById(col, id, appSlug)`, `DB.query(col, filter, appSlug)` — необязательный
последний параметр. Запись всегда идёт только в свой модуль.

## Картинки

`DB.saveImage(base64, meta) -> id` и `DB.getImage(id) -> { ..., data }` (`data` годится
для `<img src>`; это временная ссылка на B2, обновляется автоматически). Хранить в
записях модуля нужно только `id` картинки. Никогда не клади base64 внутрь `data jsonb`.
Если хранилище недоступно, `saveImage` откатывается на base64 в базу (запасной путь,
в норме не срабатывает).

## Доступ без повторного логина

`POST /auth/join { appSlug }` (с уже валидным токеном) — выдаёт роль `user`
в новом модуле. Фронт логина (`frontend/login/`) делает это автоматически,
если на него попали с `?app=<module>&redirect=<url>` — так происходит,
когда `db.js` модуля обнаруживает отсутствие токена/роли и редиректит на логин.

## Известные ограничения (осознанный долг)

- Регистрация открыта для всех (лимиты Neon/B2 бесплатные) — инвайт-код запланирован.
- Картинки не сжимаются/не обрезаются перед загрузкой — будет отдельный шаг до выхода к людям.
- CORS backend: `ALLOWED_ORIGIN` — один домен (сейчас он один, Netlify-сайт общий).
- `meals` — самый крупный и самостоятельный модуль (свой router/db/screens, PWA), миграция
  потребует аккуратного маппинга его хранилища на `DB.*`.

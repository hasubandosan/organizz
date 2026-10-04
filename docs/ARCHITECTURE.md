# Архитектура organizz / LifeOS

## Стек
- **БД:** один проект Neon (serverless Postgres, free tier), schema-per-module
- **ORM:** Drizzle
- **Backend:** Node.js + Express + TypeScript, запускается через `tsx`
  (не `tsc`-сборка — см. причину в `backend/README.md`)
- **Auth:** свой JWT (библиотека `jose`), один секрет на весь проект —
  токен, выданный в одном модуле, работает во всех остальных
- **Хостинг backend:** Fly.io (free allowance), регион Frankfurt
- **Хостинг frontend:** Netlify (free), каждый модуль — отдельный статический сайт
  (или один сайт с несколькими путями — пока не решено на масштаб 7-9 модулей)
- **Файлы/медиа:** Cloudflare R2 (ещё не подключено к модулю projects — todo)

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
id          text primary key   -- из клиента (crypto.randomUUID() или slug)
entity_type text not null      -- бывшее имя коллекции: 'projects' | 'tasks' | ...
owner_id    uuid not null references auth.users(id)
data        jsonb not null     -- вся запись целиком
created_at, updated_at
```

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

## Доступ без повторного логина

`POST /auth/join { appSlug }` (с уже валидным токеном) — выдаёт роль `user`
в новом модуле. Фронт логина (`frontend/login/`) делает это автоматически,
если на него попали с `?app=<module>&redirect=<url>` — так происходит,
когда `db.js` модуля обнаруживает отсутствие токена/роли и редиректит на логин.

## Известные ограничения (не баги, осознанный долг)

- Картинки (`imageIds`) пока идут как base64 внутри `data jsonb` — работает,
  но быстро съест лимит Neon free tier. Нужно переключить на R2 до реального
  использования с фото (см. `legacy-source/` модули — там этого больше всего).
- CORS на backend настраивается через `ALLOWED_ORIGIN` — один домен.
  При нескольких Netlify-сайтах под разные модули нужно будет либо завести
  один общий домен фронта, либо разрешить список доменов (сейчас не сделано).

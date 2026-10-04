# db-connector

## Что это
Подключатор (DB Manager) + Auth для ваших приложений поверх одного Neon Postgres.
Схема: `registry` (реестр приложений), `auth` (пользователи и роли), `app_1..app_9` (данные каждого приложения).

Медиафайлы — **в Cloudflare R2, не в Neon** (Neon Object Storage в приватном preview и делит 0.5GB free-лимита с данными БД — см. обсуждение в чате).

## Установка
```bash
npm install
cp .env.example .env
# впишите DATABASE_URL из Neon Console и сгенерируйте JWT_SECRET
```

## Применить миграции и сиды
```bash
npm run db:migrate
# затем выполните drizzle/seed.sql в Neon SQL Editor (roles + регистрация app_1)
```

## Запуск
```bash
npm run dev
```

## Проверка (curl)
```bash
# регистрация
curl -X POST localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"password123","appSlug":"app_1"}'

# ответ содержит token — используем его дальше
curl -X POST localhost:3000/app_1/items \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Моя первая запись"}'

curl localhost:3000/app_1/items -H "Authorization: Bearer <TOKEN>"
```

## Добавить новое приложение (app_2, app_3...)
1. Скопируйте `src/db/schema/app_1.ts` → `app_2.ts`, поменяйте `pgSchema('app_1')` на `'app_2'`, таблицы под свои данные.
2. Добавьте экспорт в `src/db/schema/index.ts`.
3. Добавьте путь в `drizzle.config.ts` (schema + schemaFilter).
4. `npm run db:generate && npm run db:migrate`.
5. Добавьте запись в `registry.apps` (аналогично app_1 в seed.sql).
6. Скопируйте `src/apps/app1Routes.ts` → `app2Routes.ts`, подключите в `src/index.ts`.

## Хранилище картинок (S3-совместимое: Backblaze B2 / R2)
Env-переменные (на Fly.io: `fly secrets set ...`): `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_KEY_ID`, `S3_APP_KEY`.
Маршруты: `POST /storage/upload-url`, `POST /storage/read-url`, `DELETE /storage` (только с JWT).
Для загрузки из браузера у бакета должны быть настроены CORS-правила (PUT/GET с домена фронтенда).

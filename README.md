# organizz (LifeOS)

Мультимодульная система: один backend (`db-connector`) + несколько независимых
frontend-модулей (projects, meals, purchases, cosplays...), один Postgres (Neon)
со schema на модуль.

## Структура репозитория

```
backend/              — Express API (auth + db manager), деплоится на Fly.io
frontend/login/        — страница входа/регистрации, общая для всех модулей
frontend/core/         — общий core/db.js, ui.js, styles.css для LifeOS-модулей
frontend/projects/      — модуль "Проекты и задачи" (уже мигрирован)
frontend/hub/           — дашборд, агрегирует данные из других модулей
legacy-source/          — НЕмигрированные модули (meals, purchases, cosplays) —
                            всё ещё на localStorage, ждут своего бота
docs/                   — архитектура + инструкция для новых ботов
```

## Прежде чем начать работать здесь — прочитай

- `docs/ARCHITECTURE.md` — как устроена вся система целиком
- `docs/NEW_MODULE_HANDOFF.md` — пошаговая инструкция, если тебе поручили мигрировать новый модуль

## Правила параллельной работы (важно!)

Несколько ботов/сессий могут работать одновременно, если каждый:

1. **Работает в своей ветке**: `module/<имя-модуля>`, например `module/meals`.
2. **Не трогает чужие папки.** Модуль `meals` — это `frontend/meals/` +
   `backend/src/db/schema/meals.ts` + одна строка в `backend/src/index.ts`
   (роут) + одна строка в `backend/drizzle/seed.sql` (регистрация в реестре).
   Больше backend-файлов менять не нужно — всё остальное переиспользуется
   из уже готовой инфраструктуры (`entityRoutes.ts`, `auth/*`, `middleware/*`).
3. **Общие файлы — только по согласованию:** `backend/src/apps/entityRoutes.ts`,
   `backend/src/middleware/auth.ts`, `frontend/core/*` — если бот считает, что
   их надо менять, это отдельный разговор с человеком, не самостоятельное решение.
4. **Мержится через Pull Request**, не прямой push в `main`.

Если следовать этим границам — боты физически не могут сломать работу друг друга,
даже работая в одно и то же время.

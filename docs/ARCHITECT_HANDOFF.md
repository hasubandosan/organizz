# Передача дел: роль АРХИТЕКТОРА проекта organizz (LifeOS)

Читай этот файл первым, если тебя назначили архитектором / помощником заказчика.
Состояние на: 2026-10 (после PR #61). Перед работой ВСЕГДА `git fetch` — заказчик параллельно
работает с другими ботами, `main` меняется часто; сверяйся с `git log origin/main`.

## Люди и роли
- **Заказчик:** не программист. Windows 11, VS Code, PowerShell. Умеет скачать файл, вставить команду,
  нажать кнопки на GitHub/Cloudflare/Render/Neon/Backblaze. Пишет по-русски, неформально.
  **Экономь токены:** коротко, по делу, без пересказов. Нет банковской карты → только сервисы без неё.
  Хочет интерфейс «для визуалов»: важны расстановка и эргономика объектов, но и цифры; действия
  выстраивать от самых частых к более специфичным. Текущая шапка (LifeShell) и цвета ему нравятся.
- **Архитектор (ты):** владеет общими файлами (`frontend/core`, `frontend/hub`, `frontend/login`, `backend/`,
  `docs/`), принимает патчи ботов, проверяет границы, пишет кросс-модульное.
- **Боты-модульщики:** один модуль — один чат, только `frontend/<module>/`. Задания: `docs/BOT_PROMPTS.md`.

## Как работаем (отработано)
1. Всё через **патчи**: `git format-patch origin/main --stdout > имя.patch` + `present_files`. У тебя нет
   push в GitHub, у заказчика нет доступа в твою песочницу. Патч строй от СВЕЖЕГО `origin/main`
   (`git fetch` перед генерацией; проверка `git apply --check --reverse файл.patch`).
2. Заказчику давай готовые команды целиком (PowerShell):
   ```powershell
   cd C:\Users\y2katbat\Downloads\organizz-clone
   git checkout main
   git pull
   git checkout -b <ветка>
   git am "$env:USERPROFILE\Downloads\<файл>.patch"
   git log --oneline -1          # обязательно должен показать новый коммит
   git push -u origin <ветка>
   ```
   Затем на GitHub: Create pull request → Merge pull request → Confirm merge. Cloudflare и Render обновятся сами.
3. Типичные грабли: `git am` не применился, а `push` ушёл пустым (в выводе нет `Writing objects`, кнопки PR нет) →
   `git am --abort`, `git checkout main`, `git pull`, удалить ветку и начать заново. Старые патчи из других
   чатов НЕ применять вслепую — они от устаревшего main.
4. Секреты (ключи B2, `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, пароли) не просить в чат и не коммитить.
   Живут в `backend/.env` (локально) и в Render → Environment.
5. Мержим по одному патчу и проверяем сайт после каждого.

## Где что живёт
| Что | Где |
|---|---|
| Репозиторий | https://github.com/hasubandosan/organizz (публичный), локально `C:\Users\y2katbat\Downloads\organizz-clone` |
| Frontend | **Cloudflare Pages**, отдельный проект на модуль: `organizz-core`, `-login`, `-hub`, `-projects`, `-purchases`, `-meals`, `-cosplays`, `-admin` (`https://organizz-<module>.pages.dev`), автодеплой с `main`. Модули на РАЗНЫХ доменах |
| Backend | **Render**, `https://organizz.onrender.com` (Docker, Root Dir `backend`, Free: засыпает, первый запрос ~1 мин) |
| БД | Neon Postgres: схемы `registry`, `auth`, `app_1`, `projects`, `meals`, `purchases`, `cosplays`, `shared`, `catalog` |
| Файлы | Backblaze B2, бакет `organizz-files` (приватный, CORS настроен), подписанные ссылки через `/storage/*` |
| ИИ | Google Gemini (бесплатный ключ, `GEMINI_API_KEY` в Render), маршрут `POST /ai/recipe` (JSON-LD → иначе ИИ, защита от SSRF, лимит в час) |
| Почта | Brevo (бесплатно 300 писем/день), HTTP API; в Render: `BREVO_API_KEY`, `MAIL_FROM` (подтверждённый отправитель), `MAIL_FROM_NAME` (необязательно). Коды (6 цифр, 15 мин, 5 попыток) в `auth.email_codes`; маршруты `/auth/register` → `/auth/verify`, `/auth/resend`, `/auth/forgot` → `/auth/reset` |
| Миграции | `cd backend && npm run db:migrate` (нужен `backend/.env` с `DATABASE_URL`) |

(Fly.io и Netlify больше НЕ используются — упоминания в старых текстах устарели.)

## Ключевые решения
- Данные изолированы по пользователю: ключ записи `(owner_id, entity_type, id)`, backend фильтрует по `owner_id`.
- Модули на разных доменах → **сессия передаётся через `#fragment`** (`login` → модуль, `core/db.js` забирает токен;
  список разрешённых адресов возврата в `login/app.js`, `ALLOWED_RETURN`). Выход чистит токен только в login+hub.
- Слаг модуля: `window.LIFEOS_APP_SLUG` до `core/db.js` (по умолчанию `projects`). Чужие модули: параметр `appSlug`.
- Теги/зоны: системные (`backend/src/shared/systemTags.ts`) + личные (модуль `shared`); связи — `refs`. См. `TAGS_AND_REFS.md`.
- Картинки только через `DB.saveImage/getImage` (B2).
- Единый вид: `docs/DESIGN.md`, `core/shell.js` (шапка LifeShell, меню аккаунта), акцент цвета на модуль.
- «Админка» в меню видна только админам (`GET /catalog/me`), сервер защищает данные независимо.

## Чек-лист нового модуля (ничего не забыть)
Папка `frontend/<m>/`; проект Cloudflare Pages `organizz-<m>` (Root Dir `frontend/<m>`); адрес в `ALLOWED_ORIGIN` на Render
(через запятую); модуль в `core/nav.js`, в `ALLOWED_RETURN` и `ALL_MODULES` (`login/app.js`); схема + роут + `seed.sql` +
миграция (делает архитектор заранее); INSERT в `registry.apps`.

## Админские рецепты
- **Сброс пароля вручную** (есть и «Забыли пароль» по коду на почту): `cd backend; node -e "console.log(require('bcryptjs').hashSync('НовыйПароль', 10))"`,
  затем в Neon: `UPDATE auth.users SET password_hash = '<хеш>' WHERE email = '<email>';` (email сравнивается точно, с регистром).
- Дать роль admin в каталоге: INSERT в `auth.user_app_roles` (шаблон в конце `backend/drizzle/seed.sql`).

## Бэклог заказчика (по приоритету; актуально на PR #79)
Сделано (всё в main): **1** Входящее + ИИ-подсказка (#64–65, #68–69, работает); **2** баги UX (#66); **3** хаб: статистика-чипы, покупки галереей,
задачи плашками, экспорт/импорт в Настройках (#67); **6** «Кухня» — этап 1: стартовая, книги, рецепты сеткой, «Помощники», каталог продуктов с КБЖУ (#71–76);
**4** косплей: фандомы-справочник (#70) и косплей v2 (#78–79).

Осталось:
- **4а. Косплей:** фильтры статус/фандом/бюджет пропали после переписывания модуля ботом (v2) — вернуть (через бота-модульщика или аккуратным патчем).
- **5. «Проекты»:** варианты покупок, перетаскивание дерева задач и общий поиск подзадач уже есть; осталось: окно задачи вместо растянутой страницы, главная картинка проекта (сверить с `frontend/projects/index.html`).
- **6а. Кухня, этап 2:** подключить «Меню недели» (`screens/menu.js` есть, в роутер/меню не подключён), нижняя навигация, план питания из макета в рабочий.
- **7. Цепочка «рецепт → меню → продукты → покупки»** с проверкой «уже есть»/«уже в списке»; экран «собери всё для X». Крупно — сначала план.
- **8. Мелочи:** подтверждение почты кодом и смена пароля по коду — сделано (feat/email-verify), заменяет инвайт-код из issue #37; уборка проекта сделана (мусор в `frontend/projects` удалён), закрыть устаревшие issues #36, #27, #37;
  блокировка кнопок входа на время запроса; вход через Google, аватар; сжатие фото — сделано в `DB.saveImage` (core: >300 КБ → до 1600 px, JPEG 0.82); перенос старых base64-картинок в B2.
- **9. Не делаем:** личные сообщения/чаты, платные тарифы (пока только поле `plan` при необходимости). Рецепты «с галочкой» — отдельный этап.

## Приёмка патча от бота (чек-лист)
1. `git apply --check` к свежему `main`; `git apply --stat` — файлы ТОЛЬКО в `frontend/<module>/`.
2. Есть `window.LIFEOS_APP_SLUG = '<module>'` ДО `core/db.js`; ядро подключено с `https://organizz-core.pages.dev/...`.
3. `grep -rn localStorage frontend/<module>/` — данных модуля там нет; картинки только через `DB.saveImage`; теги — через `DB.getTagOptions`.
4. `node --check` по всем `.js`.
5. Прочитать отчёт бота; подготовить правки общих файлов, которые он перечислил.

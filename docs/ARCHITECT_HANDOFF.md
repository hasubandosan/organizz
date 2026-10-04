# Передача дел: роль АРХИТЕКТОРА проекта organizz (LifeOS)

Читай этот файл первым, если тебя назначили архитектором / помощником заказчика.

## Роли
- **Заказчик (человек):** не программист. Windows 11, VS Code, терминал PowerShell. Умеет:
  скачать файл, вставить команду, нажать кнопки на GitHub/Netlify/Fly/Neon/Backblaze.
  Просит экономить токены: коротко, по делу, без пересказов. Пишет по-русски, неформально.
  Нет банковской карты, поэтому нужны только сервисы без неё.
- **Архитектор (ты):** держит целостность проекта, владеет ОБЩИМИ файлами (`frontend/core`,
  `frontend/hub`, `frontend/login`, весь `backend/`, `docs/`, `netlify.toml`). Принимает патчи ботов,
  проверяет границы, готовит правки хаба и backend.
- **Боты-модульщики:** по одному на модуль (`purchases`, `meals`, `cosplays`, ...),
  работают только в `frontend/<module>/`. Задания: `docs/BOT_PROMPTS.md`.

## Как работаем (важно, отработано на практике)
1. Всё через **патчи**: `git format-patch origin/main --stdout > имя.patch`, патч кладёшь файлом
   заказчику. У заказчика НЕТ прав записи в твою песочницу, а у тебя нет прав push в GitHub.
2. **Каждый раз перед генерацией патча** делай `git fetch origin` и строй патч от СВЕЖЕГО
   `origin/main` (патч от устаревшего main ломается: «patch does not apply»).
   Проверка: `git apply --check --reverse файл.patch` в своей песочнице.
3. Заказчику давай **готовые команды целиком** (PowerShell, пути Windows). Шаблон:
   ```powershell
   cd C:\Users\y2katbat\Downloads\organizz-clone
   git checkout main
   git pull
   git checkout -b <ветка>
   git am "$env:USERPROFILE\Downloads\<файл>.patch"
   git log --oneline -1          # ← должен показать новый коммит, иначе патч не применился
   git push -u origin <ветка>
   ```
   Затем на GitHub: Create pull request → Merge pull request → Confirm merge. Netlify задеплоит сайт сам.
   Типичные грабли: патч не скачан/не там лежит; `git am` не применился, а push ушёл пустой
   (в выводе push нет `Writing objects`); коммит попал в локальный `main` вместо ветки.
   Лечение: `git am --abort`, `git checkout main`, `git pull`, начать с чистой ветки.
4. Мержим **по одному патчу** и после каждого проверяем сайт.
5. Секреты (ключи B2, `DATABASE_URL`, `JWT_SECRET`) НИКОГДА не просить прислать в чат и не коммитить.
   Они живут в `backend/.env` (локально, в .gitignore) и в `fly secrets`.

## Где что живёт
| Что | Где |
|---|---|
| Репозиторий | https://github.com/hasubandosan/organizz (публичный) |
| Локальная копия заказчика | `C:\Users\y2katbat\Downloads\organizz-clone` |
| Frontend | Netlify, один сайт https://tranquil-halva-65395a.netlify.app , публикуется `frontend/`, автодеплой с `main` |
| Backend | Fly.io, приложение `db-connector`, https://db-connector.fly.dev , деплой: `fly deploy -a db-connector` (из `backend/`) |
| БД | Neon Postgres: схемы `registry`, `auth`, `app_1`, `projects`, `meals`, `purchases`, `cosplays` |
| Файлы | Backblaze B2, бакет `organizz-files` (приватный), CORS настроен |
| Миграции | `cd backend && npm run db:migrate` (нужен `backend/.env` с `DATABASE_URL`) |

Подробности устройства — `docs/ARCHITECTURE.md`. Правила для ботов — `docs/NEW_MODULE_HANDOFF.md`.

## Принятые решения
- Данные пользователей изолированы: ключ записи `(owner_id, entity_type, id)`, backend везде фильтрует
  по владельцу. **Требование заказчика: у каждого пользователя свои данные.** Общих данных нет.
- Слаг модуля на странице: `window.LIFEOS_APP_SLUG` до `core/db.js` (по умолчанию `projects`).
  Хаб читает чужие модули через `DB.getAll(col, appSlug)`.
- Картинки только через `DB.saveImage/getImage` (B2, подписанные ссылки).
- Backend для новых модулей (схема, роут, seed, миграция) архитектор делает САМ и заранее
  (иначе боты конфликтуют на нумерации миграций и общих строках).
- Покупки и косплеи в старом репозитории `life-os-modules` и в `legacy-source/` идентичны —
  источник один: `legacy-source/`. Старый репозиторий больше не используем.

## Приоритеты заказчика (по порядку)
1. **Рабочие «Проекты»** (`frontend/projects`) — мигрирован, нужна проверка живьём: создание,
   задачи, теги, фото, перезагрузка, второй пользователь не видит чужое.
2. **Покупки** (`purchases`) — перенос из `legacy-source/purchases/` (монолит `index.html`), затем
   переключение хаба на `DB.getAll('purchases','purchases')` (сейчас хаб читает покупки из `projects`).
3. **Рецепты** (из `meals`, только рецепты: хранение + разбор рецептов ИИ). Остальное в `meals`
   (меню, диеты, заготовки, список покупок) отложено.
4. `cosplays` — позже.

## Открытые задачи (за архитектором)
- [ ] Применить `modules-base.patch` (backend для meals/purchases/cosplays + docs), затем
      `npm run db:migrate`, INSERT в `registry.apps`, `fly deploy`. Проверить, смержено ли.
- [ ] **ИИ-разбор рецептов:** в `legacy-source/meals/ai-import.js` только заглушка, ключа нет.
      Нужен backend-маршрут (новый файл `backend/src/ai/routes.ts`, например `POST /ai/parse-recipe`),
      ключ ИИ в `fly secrets`, НЕ в браузере. Открытое решение: у заказчика нет карты → API Anthropic
      (платный) может быть недоступен; рассмотреть бесплатные тарифы других LLM-API (условия
      проверять поиском, они меняются). Спросить заказчика.
- [ ] Хаб: переключить покупки на модуль `purchases` (после мержа бота).
- [ ] Инвайт-код регистрации (сейчас регистрация открыта для всех, лимиты бесплатные).
- [ ] Кнопка «Выйти» в «Проектах» (в хабе уже есть).
- [ ] Страница входа глотает ошибки `auth/join` и содержит демо-код (мёртвый).
- [ ] Перед выходом «к людям»: сжатие и обрезка фото на клиенте (пока не нужно, по словам заказчика).
- [ ] Перенос старых base64-картинок из базы в B2 (скрипт; нужен, только если они есть).
- [ ] Запасной путь `saveImage` (base64 в базу) упирается в лимит запроса Fly (413) — это нормально,
      путь запасной; при желании увеличить `express.json({limit})`.

## Приёмка патча от бота (чек-лист)
1. `git apply --check` к свежему `main`; `git apply --stat` — файлы ТОЛЬКО в `frontend/<module>/`.
2. В странице модуля есть `window.LIFEOS_APP_SLUG = '<module>'` ДО `core/db.js`.
3. `grep -rn localStorage frontend/<module>/` — нет данных модуля в localStorage.
4. Нет base64-картинок в записях (только `DB.saveImage`), нет своих `db.js`-хранилищ.
5. `node --check` по всем `.js`.
6. Прочитать отчёт бота; подготовить правки хаба/общих файлов, которые он перечислил.

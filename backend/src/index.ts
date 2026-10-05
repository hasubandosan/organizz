import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './auth/routes.js';
import { app1Router } from './apps/app1Routes.js';
import { createEntityRouter } from './apps/entityRoutes.js';
import { storageRouter } from './storage/routes.js';
import { systemTagsRouter } from './shared/routes.js';
import { sharedEntities } from './db/schema/shared.js';
import { entities as projectsEntities } from './db/schema/projects.js';
import { catalogRouter } from './catalog/routes.js';
import { mealsEntities } from './db/schema/meals.js';
import { purchasesEntities } from './db/schema/purchases.js';
import { cosplaysEntities } from './db/schema/cosplays.js';
import { aiRouter } from './ai/routes.js';

const app = express();

// ALLOWED_ORIGIN не задан -> разрешаем всё (удобно для локальной разработки).
// Задан -> список доменов через запятую (несколько фронтов — по одному на модуль
// на Cloudflare Pages), пускаем запросы только с них.
const allowedOrigins = process.env.ALLOWED_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(allowedOrigins ? { origin: allowedOrigins } : {}));

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRouter);       // /auth/register, /auth/login
app.use('/app_1', app1Router);      // пример реальных данных: /app_1/items
app.use('/storage', storageRouter);   // файлы: подписанные ссылки на S3-совместимое хранилище
app.use('/projects', createEntityRouter('projects', projectsEntities)); // LifeOS: areas/projects/tasks/tags...
app.use('/meals', createEntityRouter('meals', mealsEntities));
app.use('/shared/system-tags', systemTagsRouter);   // системные теги/зоны (только чтение)
app.use('/shared', createEntityRouter('shared', sharedEntities));   // личные теги/зоны пользователя
app.use('/purchases', createEntityRouter('purchases', purchasesEntities));
app.use('/cosplays', createEntityRouter('cosplays', cosplaysEntities));
app.use('/ai', aiRouter);           // ИИ-разбор рецептов (Gemini, ключ только на сервере)
app.use('/catalog', catalogRouter); // общий каталог продуктов: чтение всем, модерация — admin

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`DB Manager слушает на http://localhost:${port}`);
});

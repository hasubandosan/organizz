import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './auth/routes.js';
import { app1Router } from './apps/app1Routes.js';
import { createEntityRouter } from './apps/entityRoutes.js';
import { storageRouter } from './storage/routes.js';
import { entities as projectsEntities } from './db/schema/projects.js';

const app = express();

// ALLOWED_ORIGIN не задан -> разрешаем всё (удобно для локальной разработки).
// Задан -> пускаем запросы только с этого домена (нужно для продакшена).
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}));

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRouter);       // /auth/register, /auth/login
app.use('/app_1', app1Router);      // пример реальных данных: /app_1/items
app.use('/storage', storageRouter);   // файлы: подписанные ссылки на S3-совместимое хранилище
app.use('/projects', createEntityRouter('projects', projectsEntities)); // LifeOS: areas/projects/tasks/tags...

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`DB Manager слушает на http://localhost:${port}`);
});

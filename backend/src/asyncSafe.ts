// Express 4 не ловит ошибки в async-обработчиках: упавший запрос к БД (например, таблицы ещё нет из-за непримёненной миграции)
// ронял весь процесс -> Render отдавал 502 без CORS-заголовков для ВСЕХ запросов. Здесь ошибки async-маршрутов идут в next(err).
import { createRequire } from 'node:module';
import type { Request, Response, NextFunction } from 'express';

const require = createRequire(import.meta.url);
const Layer = require('express/lib/router/layer');

Layer.prototype.handle_request = function (req: Request, res: Response, next: NextFunction) {
  const fn = this.handle;
  if (fn.length > 3) return next();   // обработчик ошибок — не вызываем как обычный
  try {
    const p = fn(req, res, next);
    if (p && typeof p.catch === 'function') p.catch(next);
  } catch (err) { next(err); }
};

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err?.message || err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Ошибка сервера' + (process.env.NODE_ENV === 'production' ? '' : ': ' + (err?.message || '')) });
}

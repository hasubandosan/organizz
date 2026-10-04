import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt.js';
import { hasAccess } from '../db/roleCheck.js';

export interface AuthedRequest extends Request {
  userId?: string;
  email?: string;
}

/** Проверяет JWT из заголовка Authorization: Bearer <token>. */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Токен не передан' });

  const payload = await verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Токен невалиден или истёк' });

  req.userId = payload.userId;
  req.email = payload.email;
  next();
}

/** Фабрика: требует конкретную роль в приложении appSlug. Ставить после requireAuth. */
export function requireRole(appSlug: string, role: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Не авторизован' });
    const ok = await hasAccess(req.userId, appSlug, role);
    if (!ok) return res.status(403).json({ error: 'Недостаточно прав' });
    next();
  };
}

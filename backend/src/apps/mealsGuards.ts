import type { NextFunction, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { mealsEntities } from '../db/schema/meals.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

/** Максимум личных режимов питания на пользователя (потом — по подписке, поле plan). */
export const MAX_USER_DIETS = 1;

/** PUT /meals/meal_diets/:id — новый режим сверх лимита не создаём (правку существующего — можно). */
export async function limitUserDiets(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.method !== 'PUT' || !/^\/meal_diets\/[^/]+$/.test(req.path)) return next();
  const rows = await db.select({ id: mealsEntities.id }).from(mealsEntities)
    .where(and(eq(mealsEntities.ownerId, req.userId!), eq(mealsEntities.entityType, 'meal_diets')));
  const id = decodeURIComponent(req.path.split('/')[2]);
  if (rows.length >= MAX_USER_DIETS && !rows.some((r) => r.id === id)) {
    return res.status(403).json({ error: 'Личный режим питания можно создать только один' });
  }
  next();
}

export const mealsGuards = [requireAuth, limitUserDiets] as const;

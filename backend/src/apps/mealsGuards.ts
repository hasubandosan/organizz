import type { NextFunction, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { mealsEntities } from '../db/schema/meals.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { getUserPlan } from '../subscription.js';

/** PUT /meals/meal_diets/:id — новый режим сверх лимита не создаём (правку существующего — можно). */
export async function limitUserDiets(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.method !== 'PUT' || !/^\/meal_diets\/[^/]+$/.test(req.path)) return next();
  const rows = await db.select({ id: mealsEntities.id }).from(mealsEntities)
    .where(and(eq(mealsEntities.ownerId, req.userId!), eq(mealsEntities.entityType, 'meal_diets')));
  const id = decodeURIComponent(req.path.split('/')[2]);
  const { limits } = await getUserPlan(req.userId!);   // лимит зависит от тарифа (выдаёт админ)
  if (rows.length >= limits.personalDiets && !rows.some((r) => r.id === id)) {
    return res.status(409).json({ error: limits.personalDiets === 1 ? 'Личный режим питания можно создать только один' : `Лимит личных режимов питания: ${limits.personalDiets}` });
  }
  next();
}

export const mealsGuards = [requireAuth, limitUserDiets] as const;

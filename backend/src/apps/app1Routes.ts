import { Router } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { items } from '../db/schema/app_1.js';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js';

export const app1Router = Router();

const APP_SLUG = 'app_1';

// requireAuth -> проверяет JWT. requireRole -> проверяет, что пользователь
// зарегистрирован именно в app_1 и имеет роль 'user' (или admin).
app1Router.use(requireAuth, requireRole(APP_SLUG, 'user'));

app1Router.get('/items', async (req: AuthedRequest, res) => {
  const rows = await db.select().from(items).where(eq(items.ownerId, req.userId!));
  res.json(rows);
});

const createSchema = z.object({ title: z.string().min(1) });

app1Router.post('/items', async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [row] = await db
    .insert(items)
    .values({ ownerId: req.userId!, title: parsed.data.title })
    .returning();
  res.status(201).json(row);
});

app1Router.delete('/items/:id', async (req: AuthedRequest, res) => {
  const [deleted] = await db
    .delete(items)
    .where(and(eq(items.id, req.params.id), eq(items.ownerId, req.userId!)))
    .returning({ id: items.id });

  if (!deleted) return res.status(404).json({ error: 'Не найдено или не ваше' });
  res.status(204).send();
});

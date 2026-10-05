import { Router } from 'express';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { products, suggestions, votes } from '../db/schema/catalog.js';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js';
import { getUserRole } from '../db/roleCheck.js';

export const catalogRouter = Router();

const APP_SLUG = 'catalog';
const asUser = [requireAuth, requireRole(APP_SLUG, 'user')] as const;
const asAdmin = [requireAuth, requireRole(APP_SLUG, 'admin')] as const;

// GET /catalog/me — роль текущего пользователя в каталоге (фронтенд прячет «Админку» от обычных юзеров).
// Это только про отображение: все admin-маршруты всё равно защищены requireRole на сервере.
catalogRouter.get('/me', ...asUser, async (req: AuthedRequest, res) => {
  const role = await getUserRole(req.userId!, APP_SLUG);
  res.json({ role, isAdmin: role === 'admin' });
});

// ───────── Продукты (чтение — всем, запись — только admin) ─────────

catalogRouter.get('/products', ...asUser, async (_req, res) => {
  const rows = await db.select().from(products).orderBy(products.name);
  res.json(rows);
});

const productSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  unit: z.string().optional(),
  data: z.record(z.any()).optional(),
});

// Прямое создание продукта админом — в обход модерации (для сидирования/быстрых правок)
catalogRouter.post('/products', ...asAdmin, async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(products).values(parsed.data).returning();
  res.status(201).json(row);
});

catalogRouter.patch('/products/:id', ...asAdmin, async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db
    .update(products)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(products.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: 'Продукт не найден' });
  res.json(row);
});

catalogRouter.delete('/products/:id', ...asAdmin, async (req, res) => {
  await db.delete(products).where(eq(products.id, req.params.id));
  res.status(204).send();
});

// ───────── Заявки на модерацию (создать/читать — юзер, одобрить/отклонить — admin) ─────────

const suggestionSchema = z.object({
  type: z.enum(['new_product', 'edit_product']),
  productId: z.string().uuid().optional(), // обязателен для edit_product, проверяем ниже
  payload: productSchema,
});

catalogRouter.post('/suggestions', ...asUser, async (req: AuthedRequest, res) => {
  const parsed = suggestionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { type, productId, payload } = parsed.data;

  if (type === 'edit_product' && !productId) {
    return res.status(400).json({ error: 'Для edit_product нужен productId' });
  }

  const [row] = await db
    .insert(suggestions)
    .values({ type, productId, payload, createdBy: req.userId! })
    .returning();
  res.status(201).json(row);
});

// Список заявок с числом голосов — видно всем, чтобы голосовать осознанно
catalogRouter.get('/suggestions', ...asUser, async (req: AuthedRequest, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';

  const rows = await db
    .select({
      id: suggestions.id,
      type: suggestions.type,
      productId: suggestions.productId,
      payload: suggestions.payload,
      status: suggestions.status,
      createdBy: suggestions.createdBy,
      createdAt: suggestions.createdAt,
      voteCount: sql<number>`count(${votes.userId})::int`,
      myVote: sql<boolean>`bool_or(${votes.userId} = ${req.userId})`,
    })
    .from(suggestions)
    .leftJoin(votes, eq(votes.suggestionId, suggestions.id))
    .where(status === 'all' ? undefined : eq(suggestions.status, status))
    .groupBy(suggestions.id)
    .orderBy(sql`count(${votes.userId}) desc`, suggestions.createdAt);

  res.json(rows);
});

catalogRouter.post('/suggestions/:id/vote', ...asUser, async (req: AuthedRequest, res) => {
  await db
    .insert(votes)
    .values({ suggestionId: req.params.id, userId: req.userId! })
    .onConflictDoNothing(); // один голос на пользователя — повторный вызов ничего не делает
  res.status(204).send();
});

catalogRouter.delete('/suggestions/:id/vote', ...asUser, async (req: AuthedRequest, res) => {
  await db
    .delete(votes)
    .where(and(eq(votes.suggestionId, req.params.id), eq(votes.userId, req.userId!)));
  res.status(204).send();
});

// ───────── Модерация (только admin) ─────────

catalogRouter.post('/suggestions/:id/approve', ...asAdmin, async (req, res) => {
  const [sug] = await db.select().from(suggestions).where(eq(suggestions.id, req.params.id)).limit(1);
  if (!sug) return res.status(404).json({ error: 'Заявка не найдена' });
  if (sug.status !== 'pending') return res.status(409).json({ error: 'Заявка уже обработана' });

  const payload = sug.payload as z.infer<typeof productSchema>;

  if (sug.type === 'new_product') {
    await db.insert(products).values(payload);
  } else {
    if (!sug.productId) return res.status(400).json({ error: 'У заявки нет productId' });
    await db.update(products).set({ ...payload, updatedAt: new Date() }).where(eq(products.id, sug.productId));
  }

  const [updated] = await db
    .update(suggestions)
    .set({ status: 'approved', updatedAt: new Date() })
    .where(eq(suggestions.id, req.params.id))
    .returning();
  res.json(updated);
});

catalogRouter.post('/suggestions/:id/reject', ...asAdmin, async (req, res) => {
  const [updated] = await db
    .update(suggestions)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(suggestions.id, req.params.id))
    .returning();
  if (!updated) return res.status(404).json({ error: 'Заявка не найдена' });
  res.json(updated);
});

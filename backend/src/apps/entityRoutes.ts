import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import type { PgTableWithColumns } from 'drizzle-orm/pg-core';
import { db } from '../db/client.js';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js';

/**
 * Генерирует CRUD-роуты для generic entity-таблицы одного модуля LifeOS.
 * Повторяет семантику core/db.js: getAll/get/put(upsert)/delete по entityType.
 */
export function createEntityRouter(appSlug: string, entities: PgTableWithColumns<any>) {
  const router = Router();
  router.use(requireAuth, requireRole(appSlug, 'user'));

  // GET /:entityType — все записи этого типа, принадлежащие пользователю
  router.get('/:entityType', async (req: AuthedRequest, res) => {
    const rows = await db
      .select()
      .from(entities)
      .where(and(eq(entities.ownerId, req.userId!), eq(entities.entityType, req.params.entityType)));
    res.json(rows.map((r: any) => r.data));
  });

  // GET /:entityType/:id
  router.get('/:entityType/:id', async (req: AuthedRequest, res) => {
    const [row] = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.ownerId, req.userId!),
        eq(entities.entityType, req.params.entityType),
        eq(entities.id, req.params.id),
      ))
      .limit(1);
    if (!row) return res.status(404).json(null);
    res.json(row.data);
  });

  // PUT /:entityType/:id — upsert, как _STORE.put в оригинальном db.js
  router.put('/:entityType/:id', async (req: AuthedRequest, res) => {
    const record = req.body;
    if (!record || typeof record !== 'object') {
      return res.status(400).json({ error: 'Тело запроса должно быть объектом записи' });
    }

    await db
      .insert(entities)
      .values({
        id: req.params.id,
        entityType: req.params.entityType,
        ownerId: req.userId!,
        data: record,
      })
      .onConflictDoUpdate({
        target: [entities.ownerId, entities.entityType, entities.id],
        set: { data: record, updatedAt: new Date() },
      });

    res.json(record);
  });

  // DELETE /:entityType/:id
  router.delete('/:entityType/:id', async (req: AuthedRequest, res) => {
    await db
      .delete(entities)
      .where(and(
        eq(entities.ownerId, req.userId!),
        eq(entities.entityType, req.params.entityType),
        eq(entities.id, req.params.id),
      ));
    res.status(204).send();
  });

  return router;
}

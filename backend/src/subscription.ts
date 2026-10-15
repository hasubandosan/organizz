import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from './db/client.js';
import { users, subscriptions } from './db/schema/auth.js';
import { requireAuth, requireRole, type AuthedRequest } from './middleware/auth.js';
import { logAdmin } from './adminLog.js';

/**
 * Тарифы и лимиты. Оплаты нет: тариф выдаёт админ (Админка → «Подписки»).
 * Новый тариф/лимит добавляется здесь — база и интерфейс менять не нужно.
 */
export const PLANS: Record<string, { name: string; personalDiets: number }> = {
  free: { name: 'Бесплатный', personalDiets: 1 },
  premium: { name: 'Premium', personalDiets: 10 },
};

export interface UserPlan { plan: string; name: string; expiresAt: string | null; limits: { personalDiets: number } }

/** Текущий тариф пользователя: нет подписки, неизвестный код или срок вышел — 'free'. */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  const active = row && PLANS[row.plan] && (!row.expiresAt || row.expiresAt.getTime() > Date.now());
  const code = active ? row.plan : 'free';
  return { plan: code, name: PLANS[code].name, expiresAt: active && row.expiresAt ? row.expiresAt.toISOString() : null, limits: { personalDiets: PLANS[code].personalDiets } };
}

export const subscriptionRouter = Router();

// GET /subscription/me — тариф и лимиты текущего пользователя
subscriptionRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  res.json(await getUserPlan(req.userId!));
});

const asAdmin = [requireAuth, requireRole('catalog', 'admin')] as const;

// GET /subscription — список выданных подписок (админ) + доступные тарифы
subscriptionRouter.get('/', ...asAdmin, async (_req, res) => {
  const rows = await db.select({ email: users.email, plan: subscriptions.plan, expiresAt: subscriptions.expiresAt, createdAt: subscriptions.createdAt })
    .from(subscriptions).innerJoin(users, eq(users.id, subscriptions.userId));
  const now = Date.now();
  res.json({
    plans: Object.entries(PLANS).filter(([c]) => c !== 'free').map(([code, p]) => ({ code, name: p.name, personalDiets: p.personalDiets })),
    items: rows.map((r) => ({ email: r.email, plan: r.plan, expiresAt: r.expiresAt, active: !r.expiresAt || r.expiresAt.getTime() > now }))
      .sort((a, b) => a.email.localeCompare(b.email)),
  });
});

// PUT /subscription — выдать/изменить: { email, plan, expiresAt? (ISO-дата или null = бессрочно) }
subscriptionRouter.put('/', ...asAdmin, async (req: AuthedRequest, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const plan = String(req.body?.plan ?? 'premium');
  if (!email) return res.status(400).json({ error: 'Нужна почта пользователя' });
  if (!PLANS[plan] || plan === 'free') return res.status(400).json({ error: 'Неизвестный тариф' });
  let expiresAt: Date | null = null;
  if (req.body?.expiresAt) {
    expiresAt = new Date(req.body.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return res.status(400).json({ error: 'Дата окончания должна быть в будущем' });
  }
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!u) return res.status(404).json({ error: 'Пользователь с такой почтой не найден' });
  const vals = { plan, expiresAt, grantedBy: req.userId!, updatedAt: new Date() };
  await db.insert(subscriptions).values({ userId: u.id, ...vals }).onConflictDoUpdate({ target: subscriptions.userId, set: vals });
  await logAdmin(req, 'subscription.grant', email, { plan, expiresAt });
  res.json({ ok: true });
});

// DELETE /subscription/:email — забрать подписку (вернётся тариф free)
subscriptionRouter.delete('/:email', ...asAdmin, async (req: AuthedRequest, res) => {
  const email = decodeURIComponent(req.params.email).trim().toLowerCase();
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
  await db.delete(subscriptions).where(eq(subscriptions.userId, u.id));
  await logAdmin(req, 'subscription.revoke', email);
  res.json({ ok: true });
});

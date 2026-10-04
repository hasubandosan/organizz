import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema/auth.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken } from './jwt.js';
import { grantRole } from '../db/roleCheck.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Минимум 8 символов'),
  appSlug: z.string().min(1), // в каком приложении регистрируется пользователь
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password, appSlug } = parsed.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ email, passwordHash }).returning({ id: users.id, email: users.email });

  // Базовая роль 'user' в приложении, где произошла регистрация
  await grantRole(user.id, appSlug, 'user');

  const token = await signToken({ userId: user.id, email: user.email });
  res.status(201).json({ token, user: { id: user.id, email: user.email } });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });

  const token = await signToken({ userId: user.id, email: user.email });
  res.json({ token, user: { id: user.id, email: user.email } });
});

// Уже залогинен (в любом модуле) -> выдать роль 'user' ещё и в новом appSlug.
// Так один логин работает сразу во всех модулях, без повторной регистрации.
const joinSchema = z.object({ appSlug: z.string().min(1) });

authRouter.post('/join', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    await grantRole(req.userId!, parsed.data.appSlug, 'user');
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: e instanceof Error ? e.message : 'Ошибка' });
  }
});

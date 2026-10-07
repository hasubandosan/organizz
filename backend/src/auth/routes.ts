import { Router, type Response } from 'express';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, emailCodes } from '../db/schema/auth.js';
import { sendCodeMail, MailNotConfigured } from './mail.js';
import { cooldownLeft, issueCode, checkCode, ipAllowed, normEmail, type CodePurpose } from './codes.js';
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

const emailEq = (email: string) => sql`lower(${users.email}) = ${email}`;

async function mailCode(res: Response, email: string, purpose: CodePurpose, code: string): Promise<boolean> {
  try {
    await sendCodeMail(email, code, purpose);
    return true;
  } catch (e) {
    if (e instanceof MailNotConfigured) res.status(503).json({ error: 'Отправка почты не настроена на сервере' });
    else res.status(502).json({ error: 'Не удалось отправить письмо. Проверьте адрес и попробуйте позже' });
    return false;
  }
}

// Шаг 1 регистрации: аккаунт ещё НЕ создаётся — на почту уходит код, пароль (хеш) ждёт в auth.email_codes.
authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const email = normEmail(parsed.data.email);
  const { password, appSlug } = parsed.data;

  if (!ipAllowed(req.ip ?? 'x')) return res.status(429).json({ error: 'Слишком много запросов, попробуйте позже' });

  const existing = await db.select({ id: users.id }).from(users).where(emailEq(email)).limit(1);
  if (existing[0]) {
    return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
  }
  const wait = await cooldownLeft(email, 'register');
  if (wait) return res.status(429).json({ error: `Код уже отправлен. Повторить можно через ${wait} с` });

  const code = await issueCode(email, 'register', { passwordHash: await hashPassword(password), appSlug });
  if (!(await mailCode(res, email, 'register', code))) return;
  res.status(202).json({ needsVerification: true, email });
});

const verifySchema = z.object({ email: z.string().email(), code: z.string().min(4).max(10) });

// Шаг 2 регистрации: верный код -> создаём аккаунт и сразу входим.
authRouter.post('/verify', async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Введите код из письма' });
  const email = normEmail(parsed.data.email);

  const r = await checkCode(email, 'register', parsed.data.code);
  if (!r.ok) return res.status(r.status).json({ error: r.error });
  const { passwordHash, appSlug } = r.data as { passwordHash: string; appSlug: string };

  const existing = await db.select({ id: users.id }).from(users).where(emailEq(email)).limit(1);
  if (existing[0]) return res.status(409).json({ error: 'Пользователь с таким email уже существует' });

  const [user] = await db.insert(users).values({ email, passwordHash }).returning({ id: users.id, email: users.email });
  // Базовая роль 'user' в приложении, где произошла регистрация
  await grantRole(user.id, appSlug, 'user');
  // Каталог продуктов общий для всех модулей — роль выдаётся сразу всем,
  // не нужно отдельно "вступать" в него через /auth/join
  await grantRole(user.id, 'catalog', 'user');

  const token = await signToken({ userId: user.id, email: user.email });
  res.status(201).json({ token, user: { id: user.id, email: user.email } });
});

// Повторно выслать код регистрации (не чаще раза в минуту).
authRouter.post('/resend', async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректный email' });
  const email = normEmail(parsed.data.email);
  if (!ipAllowed(req.ip ?? 'x')) return res.status(429).json({ error: 'Слишком много запросов, попробуйте позже' });

  const [row] = await db.select().from(emailCodes).where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, 'register'))).limit(1);
  if (!row) return res.status(400).json({ error: 'Начните регистрацию заново' });
  const wait = await cooldownLeft(email, 'register');
  if (wait) return res.status(429).json({ error: `Повторить можно через ${wait} с` });

  const code = await issueCode(email, 'register', row.data);
  if (!(await mailCode(res, email, 'register', code))) return;
  res.json({ ok: true });
});

// Забыли пароль: всегда отвечаем «ок» (не раскрываем, есть ли такая почта).
authRouter.post('/forgot', async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректный email' });
  const email = normEmail(parsed.data.email);
  if (!ipAllowed(req.ip ?? 'x')) return res.status(429).json({ error: 'Слишком много запросов, попробуйте позже' });

  const [user] = await db.select({ id: users.id }).from(users).where(emailEq(email)).limit(1);
  if (user && !(await cooldownLeft(email, 'reset'))) {
    const code = await issueCode(email, 'reset');
    if (!(await mailCode(res, email, 'reset', code))) return;
  }
  res.json({ ok: true });
});

const resetSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(10),
  password: z.string().min(8, 'Минимум 8 символов'),
});

authRouter.post('/reset', async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const email = normEmail(parsed.data.email);

  const r = await checkCode(email, 'reset', parsed.data.code);
  if (!r.ok) return res.status(r.status).json({ error: r.error });

  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(emailEq(email));
  res.json({ ok: true });
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
  const { password } = parsed.data;
  const email = normEmail(parsed.data.email);

  const [user] = await db.select().from(users).where(emailEq(email)).limit(1);
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
    await grantRole(req.userId!, 'catalog', 'user'); // подчищаем для пользователей, заведённых до каталога
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: e instanceof Error ? e.message : 'Ошибка' });
  }
});

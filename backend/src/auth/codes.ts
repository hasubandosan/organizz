import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { emailCodes } from '../db/schema/auth.js';

export type CodePurpose = 'register' | 'reset';
export const CODE_TTL_MS = 15 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashCode = (email: string, purpose: string, code: string) =>
  createHash('sha256').update(`${email}:${purpose}:${code}`).digest('hex');

export const normEmail = (e: string) => e.trim().toLowerCase();

/** Слишком частая повторная отправка на ту же почту? Возвращает сколько секунд ждать (0 — можно). */
export async function cooldownLeft(email: string, purpose: CodePurpose): Promise<number> {
  const [row] = await db.select({ t: emailCodes.lastSentAt }).from(emailCodes)
    .where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, purpose))).limit(1);
  if (!row) return 0;
  const left = RESEND_COOLDOWN_MS - (Date.now() - row.t.getTime());
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

/** Создаёт (или заменяет) код для пары email+purpose, возвращает открытый код для письма. */
export async function issueCode(email: string, purpose: CodePurpose, data?: unknown): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const now = new Date();
  const values = {
    email, purpose, codeHash: hashCode(email, purpose, code), data: data ?? null,
    attempts: 0, expiresAt: new Date(now.getTime() + CODE_TTL_MS), lastSentAt: now,
  };
  await db.insert(emailCodes).values(values).onConflictDoUpdate({
    target: [emailCodes.email, emailCodes.purpose],
    set: { codeHash: values.codeHash, data: values.data, attempts: 0, expiresAt: values.expiresAt, lastSentAt: now },
  });
  return code;
}

export type CheckResult =
  | { ok: true; data: any }
  | { ok: false; status: number; error: string };

/** Проверяет код; при успехе строку удаляет (код одноразовый). После 5 неверных попыток код сгорает. */
export async function checkCode(email: string, purpose: CodePurpose, code: string): Promise<CheckResult> {
  const [row] = await db.select().from(emailCodes)
    .where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, purpose))).limit(1);
  if (!row) return { ok: false, status: 400, error: 'Код не найден — запросите новый' };
  const drop = () => db.delete(emailCodes).where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, purpose)));
  if (row.expiresAt.getTime() < Date.now()) { await drop(); return { ok: false, status: 400, error: 'Код истёк — запросите новый' }; }
  if (row.attempts >= MAX_ATTEMPTS) { await drop(); return { ok: false, status: 429, error: 'Слишком много попыток — запросите новый код' }; }

  const a = Buffer.from(row.codeHash, 'hex');
  const b = Buffer.from(hashCode(email, purpose, code.trim()), 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.update(emailCodes).set({ attempts: row.attempts + 1 })
      .where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, purpose)));
    return { ok: false, status: 400, error: 'Неверный код' };
  }
  await drop();
  return { ok: true, data: row.data };
}

// Простейший лимит отправок писем с одного IP (в памяти; защита от рассылки спама по чужим адресам)
const sends = new Map<string, number[]>();
export function ipAllowed(ip: string, max = 15, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const arr = (sends.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { sends.set(ip, arr); return false; }
  arr.push(now); sends.set(ip, arr);
  return true;
}

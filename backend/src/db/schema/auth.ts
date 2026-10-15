import { pgSchema, uuid, text, timestamp, serial, primaryKey, integer, jsonb } from 'drizzle-orm/pg-core';
import { apps } from './registry';

export const auth = pgSchema('auth');

export const users = auth.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roles = auth.table('roles', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // 'admin' | 'moderator' | 'user'
});

export const userAppRoles = auth.table('user_app_roles', {
  userId: uuid('user_id').notNull().references(() => users.id),
  appId: uuid('app_id').notNull().references(() => apps.id),
  roleId: integer('role_id').notNull().references(() => roles.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.appId, t.roleId] }),
}));

// Одноразовые коды из писем: подтверждение почты при регистрации ('register', в data — хеш пароля и appSlug)
// и сброс пароля ('reset'). Одна строка на пару (email, purpose); код хранится только в виде хеша.
export const emailCodes = auth.table('email_codes', {
  email: text('email').notNull(),
  purpose: text('purpose').notNull(), // 'register' | 'reset'
  codeHash: text('code_hash').notNull(),
  data: jsonb('data'),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.email, t.purpose] }),
}));

// Подписки: пока без оплаты — тариф выдаёт админ (по почте), опционально до даты. Нет строки / срок вышел = тариф 'free'.
// Список тарифов и их лимиты — в src/subscription.ts (PLANS).
export const subscriptions = auth.table('subscriptions', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  plan: text('plan').notNull().default('premium'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  grantedBy: uuid('granted_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

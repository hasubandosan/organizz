import { pgSchema, uuid, text, timestamp, serial, primaryKey, integer } from 'drizzle-orm/pg-core';
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

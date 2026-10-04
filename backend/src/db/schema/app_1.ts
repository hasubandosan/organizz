import { pgSchema, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './auth';

// Шаблон: копируйте этот файл под новое приложение (app_2.ts, app_3.ts...),
// меняя pgSchema('app_1') на нужный slug и поля таблиц под свои данные.
export const app1 = pgSchema('app_1');

export const items = app1.table('items', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

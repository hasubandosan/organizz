import { pgSchema, text, uuid, jsonb, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

// Общий каталог продуктов — НЕ owner-scoped (единственная такая схема в проекте,
// см. docs/ARCHITECTURE.md раздел "catalog"). Видят и читают все пользователи,
// пишут только через модерацию (suggestions) или напрямую — только admin.
export const catalogSchema = pgSchema('catalog');

export const products = catalogSchema.table('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  category: text('category'), // 'meat' | 'dairy' | 'vegetables' | ... свободная строка, не enum
  unit: text('unit'),         // 'g' | 'ml' | 'pcs' ...
  data: jsonb('data').notNull().default({}), // резерв под КБЖУ и прочее, добавляется позже без миграции
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  nameIdx: index('catalog_products_name_idx').on(t.name),
}));

export const suggestions = catalogSchema.table('suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // 'new_product' | 'edit_product'
  productId: uuid('product_id').references(() => products.id), // заполнено только для edit_product
  payload: jsonb('payload').notNull(), // предлагаемые name/category/unit/data
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index('catalog_suggestions_status_idx').on(t.status),
}));

export const votes = catalogSchema.table('votes', {
  suggestionId: uuid('suggestion_id').notNull().references(() => suggestions.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.suggestionId, t.userId] }), // один голос на заявку от пользователя
}));

import { pgSchema, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const registry = pgSchema('registry');

export const apps = registry.table('apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  dbSchema: text('db_schema').notNull(),
  isGuest: boolean('is_guest').notNull().default(false),
  neonProject: text('neon_project'),
  r2Bucket: text('r2_bucket'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const appHealth = registry.table('app_health', {
  appId: uuid('app_id').notNull().references(() => apps.id),
  lastPingAt: timestamp('last_ping_at', { withTimezone: true }),
  status: text('status'),
});

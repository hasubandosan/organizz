import { pgSchema, text, uuid, jsonb, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './auth';

// Модуль cosplays: та же универсальная entity-таблица, что и в projects.
export const cosplaysSchema = pgSchema('cosplays');

export const cosplaysEntities = cosplaysSchema.table('entities', {
  id: text('id').notNull(), // из клиента (crypto.randomUUID() или slug для тегов); уникален только в рамках (owner_id, entity_type)
  entityType: text('entity_type').notNull(), // 'projects' | 'tasks' | 'areas' | 'tags' ...
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  data: jsonb('data').notNull(), // весь объект записи целиком (как раньше в localStorage)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Составной ключ: у разных пользователей могут совпадать id (теги-слаги, 'schemaVersion')
  pk: primaryKey({ columns: [t.ownerId, t.entityType, t.id] }),
  ownerTypeIdx: index('entities_owner_type_idx').on(t.ownerId, t.entityType),
}));

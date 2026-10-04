import { pgSchema, text, uuid, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

// Единая таблица под все коллекции модуля (areas, projects, tasks, tags...).
// entityType = бывшее имя коллекции в LifeOS (col). Гибкая схема вместо
// отдельной таблицы на каждую коллекцию — экономит время на миграции
// существующего vanilla-JS кода, который и так работает с record'ами как
// с произвольными объектами.
export const projectsSchema = pgSchema('projects');

export const entities = projectsSchema.table('entities', {
  id: text('id').primaryKey(), // из клиента (crypto.randomUUID() или slug для тегов)
  entityType: text('entity_type').notNull(), // 'projects' | 'tasks' | 'areas' | 'tags' ...
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  data: jsonb('data').notNull(), // весь объект записи целиком (как раньше в localStorage)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ownerTypeIdx: index('entities_owner_type_idx').on(t.ownerId, t.entityType),
}));

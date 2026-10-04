-- Было: PRIMARY KEY (id) — id глобально уникален, у разных пользователей конфликтовал.
-- Стало: PRIMARY KEY (owner_id, entity_type, id).
ALTER TABLE "projects"."entities" DROP CONSTRAINT IF EXISTS "entities_pkey";--> statement-breakpoint
ALTER TABLE "projects"."entities" ADD CONSTRAINT "entities_owner_id_entity_type_id_pk" PRIMARY KEY("owner_id","entity_type","id");

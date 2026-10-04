CREATE SCHEMA "projects";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects"."entities" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects"."entities" ADD CONSTRAINT "entities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_owner_type_idx" ON "projects"."entities" USING btree ("owner_id","entity_type");
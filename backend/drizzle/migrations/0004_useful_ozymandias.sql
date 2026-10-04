CREATE SCHEMA "shared";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shared"."entities" (
	"id" text NOT NULL,
	"entity_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_owner_id_entity_type_id_pk" PRIMARY KEY("owner_id","entity_type","id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared"."entities" ADD CONSTRAINT "entities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_owner_type_idx" ON "shared"."entities" USING btree ("owner_id","entity_type");
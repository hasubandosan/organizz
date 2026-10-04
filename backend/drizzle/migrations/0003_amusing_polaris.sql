CREATE SCHEMA "meals";
--> statement-breakpoint
CREATE SCHEMA "purchases";
--> statement-breakpoint
CREATE SCHEMA "cosplays";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meals"."entities" (
	"id" text NOT NULL,
	"entity_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_owner_id_entity_type_id_pk" PRIMARY KEY("owner_id","entity_type","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchases"."entities" (
	"id" text NOT NULL,
	"entity_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_owner_id_entity_type_id_pk" PRIMARY KEY("owner_id","entity_type","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cosplays"."entities" (
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
 ALTER TABLE "meals"."entities" ADD CONSTRAINT "entities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchases"."entities" ADD CONSTRAINT "entities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cosplays"."entities" ADD CONSTRAINT "entities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_owner_type_idx" ON "meals"."entities" USING btree ("owner_id","entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_owner_type_idx" ON "purchases"."entities" USING btree ("owner_id","entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_owner_type_idx" ON "cosplays"."entities" USING btree ("owner_id","entity_type");
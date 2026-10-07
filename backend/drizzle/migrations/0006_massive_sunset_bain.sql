CREATE TABLE IF NOT EXISTS "auth"."email_codes" (
	"email" text NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"data" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_codes_email_purpose_pk" PRIMARY KEY("email","purpose")
);

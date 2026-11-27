CREATE TABLE "reader_log_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reader_id" text NOT NULL,
	"read_on" date NOT NULL,
	"place" text NOT NULL,
	"name" text NOT NULL,
	"question" text,
	"notes" text,
	"consent" boolean NOT NULL,
	"spread" text NOT NULL,
	"cards" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reader_log_entry_place_check" CHECK ("reader_log_entry"."place" in ('in_person', 'online', 'event')),
	CONSTRAINT "reader_log_entry_spread_check" CHECK ("reader_log_entry"."spread" in ('one', 'three_any', 'three_pairs')),
	CONSTRAINT "reader_log_entry_name_check" CHECK (char_length("reader_log_entry"."name") between 1 and 60),
	CONSTRAINT "reader_log_entry_question_check" CHECK (char_length("reader_log_entry"."question") <= 280),
	CONSTRAINT "reader_log_entry_notes_check" CHECK (char_length("reader_log_entry"."notes") <= 4000)
);
--> statement-breakpoint
ALTER TABLE "reader_log_entry" ADD CONSTRAINT "reader_log_entry_reader_id_user_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reader_log_entry_reader_idx" ON "reader_log_entry" USING btree ("reader_id","read_on" desc);--> statement-breakpoint
-- Only the app reaches readers' logs (each query filtered by the signed-in reader); the portal has no access at all.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astro_web') THEN
    REVOKE ALL ON reader_log_entry FROM astro_web;
    GRANT SELECT, INSERT, UPDATE, DELETE ON reader_log_entry TO astro_web;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astro_admin') THEN
    REVOKE ALL ON reader_log_entry FROM astro_admin;
  END IF;
END
$$;

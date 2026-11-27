CREATE TABLE "text_override" (
	"key" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "text_override_kind_check" CHECK ("text_override"."kind" in ('landing', 'app', 'meanings'))
);
--> statement-breakpoint
CREATE TABLE "text_preview" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "text_preview_kind_check" CHECK ("text_preview"."kind" in ('landing', 'app', 'meanings'))
);
--> statement-breakpoint
CREATE TABLE "text_version" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_by" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	CONSTRAINT "text_version_kind_check" CHECK ("text_version"."kind" in ('landing', 'app', 'meanings'))
);
--> statement-breakpoint
ALTER TABLE "text_override" ADD CONSTRAINT "text_override_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_version" ADD CONSTRAINT "text_version_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "text_version_kind_idx" ON "text_version" USING btree ("kind","id");--> statement-breakpoint
-- The app reads published wording and previews; it never writes them. 0001's default privileges gave it full
-- access to new tables, so narrow that here. The portal reads and writes all three.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astro_web') THEN
    REVOKE ALL ON text_override, text_version, text_preview FROM astro_web;
    REVOKE ALL ON SEQUENCE text_version_id_seq FROM astro_web;
    GRANT SELECT ON text_version, text_preview TO astro_web;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astro_admin') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON text_override, text_preview TO astro_admin;
    GRANT SELECT, INSERT ON text_version TO astro_admin;  -- history is never edited; restore publishes a new version
    GRANT USAGE ON SEQUENCE text_version_id_seq TO astro_admin;
  END IF;
END
$$;

CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_in" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"outcome" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_in_outcome_check" CHECK ("check_in"."outcome" in ('fit', 'partly', 'not', 'skipped')),
	CONSTRAINT "check_in_note_length" CHECK ("check_in"."note" is null or char_length("check_in"."note") <= 500)
);
--> statement-breakpoint
CREATE TABLE "draw_deck" (
	"session_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"order" text[] NOT NULL,
	"orientations" text[] NOT NULL,
	"salt" text NOT NULL,
	"fingerprint" char(32) NOT NULL,
	"picks" integer[] DEFAULT '{}'::integer[] NOT NULL,
	CONSTRAINT "draw_deck_session_id_stage_pk" PRIMARY KEY("session_id","stage"),
	CONSTRAINT "draw_deck_stage_check" CHECK ("draw_deck"."stage" in ('single', 'majors', 'minors'))
);
--> statement-breakpoint
CREATE TABLE "draw_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"guest_hash" text,
	"spread" text NOT NULL,
	"local_day" date NOT NULL,
	"time_zone" text NOT NULL,
	"status" text DEFAULT 'picking' NOT NULL,
	"private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "draw_session_spread_check" CHECK ("draw_session"."spread" in ('one', 'three')),
	CONSTRAINT "draw_session_status_check" CHECK ("draw_session"."status" in ('picking', 'complete')),
	CONSTRAINT "draw_session_actor_check" CHECK (("draw_session"."user_id" is null) <> ("draw_session"."guest_hash" is null))
);
--> statement-breakpoint
CREATE TABLE "guest_day_cap" (
	"ip_hash" text NOT NULL,
	"local_day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "guest_day_cap_ip_hash_local_day_pk" PRIMARY KEY("ip_hash","local_day")
);
--> statement-breakpoint
CREATE TABLE "mail_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "reading_note" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_note_body_length" CHECK (char_length("reading_note"."body") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"time_zone_changed_at" timestamp with time zone,
	"check_ins_enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_session_id_draw_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."draw_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_deck" ADD CONSTRAINT "draw_deck_session_id_draw_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."draw_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_session" ADD CONSTRAINT "draw_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_note" ADD CONSTRAINT "reading_note_session_id_draw_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."draw_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "draw_session_user_day_uq" ON "draw_session" USING btree ("user_id","spread","local_day") WHERE "draw_session"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "draw_session_guest_day_uq" ON "draw_session" USING btree ("guest_hash","local_day") WHERE "draw_session"."guest_hash" is not null;--> statement-breakpoint
CREATE INDEX "draw_session_user_completed_idx" ON "draw_session" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX "draw_session_guest_created_idx" ON "draw_session" USING btree ("created_at") WHERE "draw_session"."guest_hash" is not null;--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_user_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
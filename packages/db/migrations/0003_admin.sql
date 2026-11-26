CREATE TABLE "ai_role_slot" (
	"role" text NOT NULL,
	"position" smallint NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "ai_role_slot_role_position_pk" PRIMARY KEY("role","position"),
	CONSTRAINT "ai_role_slot_role_check" CHECK ("ai_role_slot"."role" in ('writer', 'checker_1', 'checker_2'))
);
--> statement-breakpoint
CREATE TABLE "ai_service" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"company" text NOT NULL,
	"base_url" text,
	"model" text NOT NULL,
	"key_ciphertext" "bytea",
	"key_iv" "bytea",
	"key_last4" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"max_tokens" integer DEFAULT 1200 NOT NULL,
	"temperature" real DEFAULT 0.7 NOT NULL,
	"timeout_ms" integer DEFAULT 30000 NOT NULL,
	"last_test_at" timestamp with time zone,
	"last_test_ok" boolean,
	"last_error" text,
	"cooldown_until" timestamp with time zone,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_service_provider_check" CHECK ("ai_service"."provider" in ('anthropic', 'openai', 'gemini', 'openai_compatible')),
	CONSTRAINT "ai_service_base_url_check" CHECK (("ai_service"."provider" = 'openai_compatible') = ("ai_service"."base_url" is not null))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"invited_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invite_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invite_role_check" CHECK ("invite"."role" in ('admin', 'moderator', 'reader'))
);
--> statement-breakpoint
CREATE TABLE "staff_role" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"granted_by" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "staff_role_role_check" CHECK ("staff_role"."role" in ('owner', 'admin', 'moderator', 'reader'))
);
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "surface" text DEFAULT 'app' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_role_slot" ADD CONSTRAINT "ai_role_slot_service_id_ai_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."ai_service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_service" ADD CONSTRAINT "ai_service_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role" ADD CONSTRAINT "staff_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role" ADD CONSTRAINT "staff_role_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id","at");--> statement-breakpoint
CREATE INDEX "invite_email_idx" ON "invite" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "staff_role_one_owner_uq" ON "staff_role" USING btree ((true)) WHERE "staff_role"."role" = 'owner' and "staff_role"."revoked_at" is null;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_surface_check" CHECK ("session"."surface" in ('app', 'admin'));--> statement-breakpoint
-- The audit log is append-only for everyone, including the migrator.
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END
$$;
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();
--> statement-breakpoint
-- Accepting an invite, as one checked step. The app calls this instead of writing staff_role or invite itself, so
-- even a compromised app user can't grant a role: it would need an unused invite token for its own email, with
-- 2-step sign-in on. SECURITY DEFINER with a fixed search_path; owned by the migrating role.
CREATE OR REPLACE FUNCTION accept_invite(p_token_hash bytea, p_user_id text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  inv invite%ROWTYPE;
  u record;
BEGIN
  SELECT * INTO inv FROM invite WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR inv.accepted_at IS NOT NULL OR inv.revoked_at IS NOT NULL THEN RETURN 'invalid'; END IF;
  IF inv.expires_at <= now() THEN RETURN 'expired'; END IF;
  SELECT email, two_factor_enabled, disabled_at INTO u FROM "user" WHERE id = p_user_id;
  IF NOT FOUND OR u.disabled_at IS NOT NULL THEN RETURN 'invalid'; END IF;
  IF lower(u.email) <> lower(inv.email) THEN RETURN 'wrong_email'; END IF;
  IF NOT u.two_factor_enabled THEN RETURN 'two_step_required'; END IF;
  INSERT INTO staff_role (user_id, role, granted_by) VALUES (p_user_id, inv.role, inv.invited_by) ON CONFLICT (user_id) DO NOTHING;
  IF NOT FOUND THEN RETURN 'has_role'; END IF;
  UPDATE invite SET accepted_at = now() WHERE id = inv.id;
  RETURN 'ok:' || inv.role;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION accept_invite(bytea, text) FROM PUBLIC;
--> statement-breakpoint
-- astro_web (the app) got full access to these tables through 0001's default privileges. Narrow it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astro_web') THEN
    REVOKE ALL ON staff_role, invite, audit_log, ai_service, ai_role_slot FROM astro_web;
    GRANT SELECT ON staff_role TO astro_web;                  -- the app knows who is a reader; it never grants roles
    GRANT EXECUTE ON FUNCTION accept_invite(bytea, text) TO astro_web;  -- the only way to accept an invite
    GRANT INSERT ON audit_log TO astro_web;
    GRANT SELECT ON ai_service, ai_role_slot TO astro_web;    -- AI readings (plan 4) read settings, never change them
  END IF;
END
$$;
--> statement-breakpoint
-- astro_admin (the portal): what it needs to sign staff in and run the portal, nothing more. No DDL.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astro_admin') THEN
    GRANT USAGE ON SCHEMA public TO astro_admin;
    GRANT SELECT, INSERT, UPDATE, DELETE ON staff_role, invite, ai_service, ai_role_slot, app_setting TO astro_admin;
    GRANT SELECT ON "user", account TO astro_admin;              -- sign-in reads them; no sign-up, no password resets
    GRANT UPDATE (name, email_verified, two_factor_enabled, disabled_at, updated_at) ON "user" TO astro_admin;
    GRANT SELECT, INSERT, UPDATE, DELETE ON session, verification, two_factor TO astro_admin;
    GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit TO astro_admin;
    GRANT INSERT ON audit_log, mail_outbox TO astro_admin;
    GRANT SELECT ON audit_log TO astro_admin;
    GRANT USAGE ON SEQUENCE audit_log_id_seq TO astro_admin;
    GRANT SELECT (user_id, spread, status, created_at, completed_at) ON draw_session TO astro_admin;  -- counts, never the cards
    GRANT SELECT (session_id, outcome, created_at) ON check_in TO astro_admin;  -- counts, never notes
  END IF;
END
$$;
--> statement-breakpoint
INSERT INTO app_setting (key, value) VALUES
  ('ai_daily_cap_usd', '20'::jsonb),
  ('ai_per_person_per_day', '5'::jsonb),
  ('maintenance_mode', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

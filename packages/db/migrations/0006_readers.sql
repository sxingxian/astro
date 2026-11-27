CREATE TABLE "guideline_acceptance" (
	"user_id" text NOT NULL,
	"version" bigint NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guideline_acceptance_user_id_version_pk" PRIMARY KEY("user_id","version")
);
--> statement-breakpoint
CREATE TABLE "reader_role" (
	"user_id" text PRIMARY KEY NOT NULL,
	"granted_by" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "role_offer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"reader" boolean NOT NULL,
	"portal_role" text,
	"offered_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "role_offer_portal_role_check" CHECK ("role_offer"."portal_role" in ('admin', 'moderator')),
	CONSTRAINT "role_offer_something_check" CHECK ("role_offer"."reader" or "role_offer"."portal_role" is not null)
);
--> statement-breakpoint
ALTER TABLE "staff_role" DROP CONSTRAINT "staff_role_role_check";--> statement-breakpoint
ALTER TABLE "guideline_acceptance" ADD CONSTRAINT "guideline_acceptance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_role" ADD CONSTRAINT "reader_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_role" ADD CONSTRAINT "reader_role_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_offer" ADD CONSTRAINT "role_offer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_offer" ADD CONSTRAINT "role_offer_offered_by_user_id_fk" FOREIGN KEY ("offered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "role_offer_user_idx" ON "role_offer" USING btree ("user_id");--> statement-breakpoint
-- Readers move out of staff_role, keeping who granted them, when, and whether they were removed.
INSERT INTO "reader_role" ("user_id", "granted_by", "granted_at", "revoked_at")
  SELECT "user_id", "granted_by", "granted_at", "revoked_at" FROM "staff_role" WHERE "role" = 'reader'
  ON CONFLICT ("user_id") DO NOTHING;--> statement-breakpoint
DELETE FROM "staff_role" WHERE "role" = 'reader';--> statement-breakpoint
ALTER TABLE "staff_role" ADD CONSTRAINT "staff_role_role_check" CHECK ("staff_role"."role" in ('owner', 'admin', 'moderator'));--> statement-breakpoint
-- The newest published reader guidelines version (0 when only the built-in default exists).
CREATE OR REPLACE FUNCTION current_guidelines_version() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(max(id), 0) FROM text_version WHERE kind = 'guidelines'
$$;
--> statement-breakpoint
-- Gives p_user_id the reader role (re-activating a removed one) and records the guidelines version they accepted.
-- Internal: only called by the accept functions below, after their checks. Returns false if already a reader.
CREATE OR REPLACE FUNCTION grant_reader_role(p_user_id text, p_granted_by text, p_guidelines bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO reader_role (user_id, granted_by) VALUES (p_user_id, p_granted_by)
    ON CONFLICT (user_id) DO UPDATE SET granted_by = excluded.granted_by, granted_at = now(), revoked_at = NULL
    WHERE reader_role.revoked_at IS NOT NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO guideline_acceptance (user_id, version) VALUES (p_user_id, p_guidelines) ON CONFLICT DO NOTHING;
  RETURN true;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION current_guidelines_version() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION grant_reader_role(text, text, bigint) FROM PUBLIC;--> statement-breakpoint
DROP FUNCTION accept_invite(bytea, text);--> statement-breakpoint
-- Accepting an invite, as one checked step (replaces 0003's version). A reader invite now writes reader_role, so the
-- role can sit beside a portal role; only an invite sent by the owner may make staff a reader; and the person must
-- have read the newest reader guidelines (p_guidelines is the version their page showed).
CREATE OR REPLACE FUNCTION accept_invite(p_token_hash bytea, p_user_id text, p_guidelines bigint) RETURNS text
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
  IF inv.role = 'reader' THEN
    IF EXISTS (SELECT 1 FROM staff_role WHERE user_id = p_user_id AND revoked_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM staff_role WHERE user_id = inv.invited_by AND role = 'owner' AND revoked_at IS NULL) THEN
      RETURN 'staff_reader_owner_only';
    END IF;
    IF p_guidelines IS DISTINCT FROM current_guidelines_version() THEN RETURN 'guidelines_changed'; END IF;
    IF NOT grant_reader_role(p_user_id, inv.invited_by, p_guidelines) THEN RETURN 'has_role'; END IF;
  ELSE
    INSERT INTO staff_role (user_id, role, granted_by) VALUES (p_user_id, inv.role, inv.invited_by) ON CONFLICT (user_id) DO NOTHING;
    IF NOT FOUND THEN RETURN 'has_role'; END IF;
  END IF;
  UPDATE invite SET accepted_at = now() WHERE id = inv.id;
  RETURN 'ok:' || inv.role;
END
$$;
--> statement-breakpoint
-- Accepting a role offer made to this account: the reader role, a portal role, or both, under the same checks.
CREATE OR REPLACE FUNCTION accept_role_offer(p_offer_id uuid, p_user_id text, p_guidelines bigint) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  o role_offer%ROWTYPE;
  u record;
  is_staff boolean;
BEGIN
  SELECT * INTO o FROM role_offer WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR o.user_id <> p_user_id OR o.accepted_at IS NOT NULL OR o.revoked_at IS NOT NULL THEN RETURN 'invalid'; END IF;
  IF o.expires_at <= now() THEN RETURN 'expired'; END IF;
  SELECT two_factor_enabled, disabled_at INTO u FROM "user" WHERE id = p_user_id;
  IF NOT FOUND OR u.disabled_at IS NOT NULL THEN RETURN 'invalid'; END IF;
  IF NOT u.two_factor_enabled THEN RETURN 'two_step_required'; END IF;
  is_staff := o.portal_role IS NOT NULL OR EXISTS (SELECT 1 FROM staff_role WHERE user_id = p_user_id AND revoked_at IS NULL);
  IF o.reader THEN
    IF is_staff AND NOT EXISTS (SELECT 1 FROM staff_role WHERE user_id = o.offered_by AND role = 'owner' AND revoked_at IS NULL) THEN
      RETURN 'staff_reader_owner_only';
    END IF;
    IF p_guidelines IS DISTINCT FROM current_guidelines_version() THEN RETURN 'guidelines_changed'; END IF;
    IF EXISTS (SELECT 1 FROM reader_role WHERE user_id = p_user_id AND revoked_at IS NULL) THEN RETURN 'has_role'; END IF;
  END IF;
  IF o.portal_role IS NOT NULL THEN
    INSERT INTO staff_role (user_id, role, granted_by) VALUES (p_user_id, o.portal_role, o.offered_by) ON CONFLICT (user_id) DO NOTHING;
    IF NOT FOUND THEN RETURN 'has_role'; END IF;
  END IF;
  IF o.reader THEN PERFORM grant_reader_role(p_user_id, o.offered_by, p_guidelines); END IF;
  UPDATE role_offer SET accepted_at = now() WHERE id = o.id;
  RETURN 'ok:' || concat_ws('+', o.portal_role, CASE WHEN o.reader THEN 'reader' END);
END
$$;
--> statement-breakpoint
-- A reader giving up their own role (from Account). Only ever removes a role.
CREATE OR REPLACE FUNCTION give_up_reader_role(p_user_id text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE reader_role SET revoked_at = now() WHERE user_id = p_user_id AND revoked_at IS NULL
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION accept_invite(bytea, text, bigint) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION accept_role_offer(uuid, text, bigint) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION give_up_reader_role(text) FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astro_web') THEN
    REVOKE ALL ON reader_role, role_offer, guideline_acceptance FROM astro_web;
    GRANT SELECT ON reader_role, role_offer TO astro_web;               -- the app knows who is a reader; it never grants
    GRANT SELECT, INSERT ON guideline_acceptance TO astro_web;          -- readers accept republished guidelines
    GRANT EXECUTE ON FUNCTION accept_invite(bytea, text, bigint), accept_role_offer(uuid, text, bigint), give_up_reader_role(text) TO astro_web;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astro_admin') THEN
    GRANT SELECT, INSERT, UPDATE ON reader_role, role_offer TO astro_admin;  -- removal sets revoked_at; rows stay
    GRANT SELECT ON guideline_acceptance TO astro_admin;
  END IF;
END
$$;

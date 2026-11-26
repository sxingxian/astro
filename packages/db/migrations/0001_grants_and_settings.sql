-- Least-privilege runtime access. Roles are created in Neon (see docs/DEPLOYMENT.md);
-- the grants are skipped on databases where a role does not exist, such as a fresh local one.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astro_web') THEN
    GRANT USAGE ON SCHEMA public TO astro_web;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO astro_web;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO astro_web;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO astro_web;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO astro_web;
  END IF;
END
$$;
--> statement-breakpoint
INSERT INTO app_setting (key, value) VALUES ('reversal_rate', '0.3'::jsonb) ON CONFLICT (key) DO NOTHING;

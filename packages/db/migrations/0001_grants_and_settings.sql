-- Least-privilege runtime access. Roles are created in Neon (see docs/DEPLOYMENT.md);
-- the grants are skipped on databases where a role does not exist, such as a fresh local one.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
DO $$
DECLARE
  obj record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astro_web') THEN
    GRANT USAGE ON SCHEMA public TO astro_web;
    -- Only the objects this role owns. "ON ALL TABLES IN SCHEMA public" would also try tables other people
    -- created there (Neon's sample table, for example) and fail the whole migration with "permission denied".
    FOR obj IN SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'S') AND pg_get_userbyid(c.relowner) = current_user
    LOOP
      IF obj.relkind = 'S' THEN
        EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO astro_web', obj.relname);
      ELSE
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO astro_web', obj.relname);
      END IF;
    END LOOP;
    -- Tables and sequences this role creates in later migrations.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO astro_web;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO astro_web;
  END IF;
END
$$;
--> statement-breakpoint
INSERT INTO app_setting (key, value) VALUES ('reversal_rate', '0.3'::jsonb) ON CONFLICT (key) DO NOTHING;

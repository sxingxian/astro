-- Starts (or returns) today's reading in one call, so the app can do it over Neon's HTTPS endpoint instead of an
-- interactive transaction on a WebSocket (which used more processing time than Workers Free allows).
-- Same steps as before: a per-person lock, today's reading if there is one, the guest cap, then the new reading
-- and its shuffled decks (shuffled by the app: p_decks). Runs with the caller's rights (SECURITY INVOKER).
-- Returns {"session": <draw_session row>, "decks": [<draw_deck rows>]}. Raises AS429 when a guest network is over
-- its daily cap and AS404 if the day's reading can't be found; both roll back.
CREATE OR REPLACE FUNCTION start_draw(
  p_user text, p_guest text, p_ip_hash text, p_spread text, p_day date, p_tz text, p_now timestamptz,
  p_utc_day date, p_cutoff timestamptz, p_guest_cap integer, p_decks jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  s draw_session;
  n integer;
BEGIN
  IF (p_user IS NULL) = (p_guest IS NULL) THEN RAISE EXCEPTION 'one of user or guest' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(CASE WHEN p_user IS NOT NULL THEN 'draw:u:' || p_user || ':' || p_spread ELSE 'draw:g:' || p_guest END));

  -- Today's reading: the person's latest (for this spread, for members) if it's still its own local day.
  SELECT * INTO s FROM draw_session d
   WHERE CASE WHEN p_user IS NOT NULL THEN d.user_id = p_user AND d.spread = p_spread ELSE d.guest_hash = p_guest END
   ORDER BY d.created_at DESC LIMIT 1;
  IF FOUND AND (p_now AT TIME ZONE s.time_zone)::date = s.local_day THEN
    RETURN jsonb_build_object('session', to_jsonb(s), 'decks', (SELECT coalesce(jsonb_agg(to_jsonb(k)), '[]'::jsonb) FROM draw_deck k WHERE k.session_id = s.id));
  END IF;

  IF p_guest IS NOT NULL THEN
    DELETE FROM draw_session WHERE id IN (SELECT id FROM draw_session WHERE guest_hash IS NOT NULL AND created_at < p_cutoff LIMIT 200);
    INSERT INTO guest_day_cap (ip_hash, local_day, count) VALUES (p_ip_hash, p_utc_day, 1)
      ON CONFLICT (ip_hash, local_day) DO UPDATE SET count = guest_day_cap.count + 1
      RETURNING count INTO n;
    IF n > p_guest_cap THEN RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'AS429'; END IF;
  END IF;

  INSERT INTO draw_session (user_id, guest_hash, spread, local_day, time_zone, status, created_at)
    VALUES (p_user, p_guest, p_spread, p_day, p_tz, 'picking', p_now)
    ON CONFLICT DO NOTHING
    RETURNING * INTO s;
  IF s.id IS NOT NULL THEN
    INSERT INTO draw_deck (session_id, stage, "order", orientations, salt, fingerprint)
      SELECT s.id, x.stage, x."order", x.orientations, x.salt, x.fingerprint
      FROM jsonb_to_recordset(p_decks) AS x(stage text, "order" text[], orientations text[], salt text, fingerprint text);
  ELSE
    -- A reading already holds this calendar day in the person's current timezone (for example after a move west):
    -- that one is today's.
    SELECT * INTO s FROM draw_session d
     WHERE (CASE WHEN p_user IS NOT NULL THEN d.user_id = p_user AND d.spread = p_spread ELSE d.guest_hash = p_guest END)
       AND d.local_day = p_day
     LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'AS404'; END IF;
  END IF;
  RETURN jsonb_build_object('session', to_jsonb(s), 'decks', (SELECT coalesce(jsonb_agg(to_jsonb(k)), '[]'::jsonb) FROM draw_deck k WHERE k.session_id = s.id));
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION start_draw(text, text, text, text, date, text, timestamptz, date, timestamptz, integer, jsonb) FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astro_web') THEN
    GRANT EXECUTE ON FUNCTION start_draw(text, text, text, text, date, text, timestamptz, date, timestamptz, integer, jsonb) TO astro_web;
  END IF;
END
$$;

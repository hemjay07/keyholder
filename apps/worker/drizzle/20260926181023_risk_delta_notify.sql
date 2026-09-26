-- Phase 4 (web layer, arch/D-web.md §feed/stream): the SSE feed relays live
-- risk_deltas over Postgres LISTEN/NOTIFY. No code path currently inserts a
-- risk_delta outside of replay/tests, so a DB-level trigger is the one place
-- that is guaranteed to fire regardless of which future worker job performs
-- the insert (live ingest, backfill, or replay). Fires AFTER INSERT and
-- ships the full new row as JSON on channel 'risk_delta_created'.
CREATE OR REPLACE FUNCTION notify_risk_delta_created() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('risk_delta_created', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS risk_delta_created_trigger ON risk_deltas;
CREATE TRIGGER risk_delta_created_trigger
  AFTER INSERT ON risk_deltas
  FOR EACH ROW
  EXECUTE FUNCTION notify_risk_delta_created();

-- ===========================================================================
-- ClinicFlow - destructive local reset
-- ---------------------------------------------------------------------------
-- Drops every application object. This is ONLY used by:
--   * `npm run db:reset`
--   * the automated test suite (for a deterministic database)
--
-- Never run this against a database that contains data you care about.
-- ===========================================================================

DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS appointment_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

DROP FUNCTION IF EXISTS set_appointment_confirmed_slot() CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

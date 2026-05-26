-- ── Behavioral Fingerprint table ─────────────────────────────────────────────
-- One row per user, upserted every message. History is preserved via EMA —
-- individual observations are never stored, only the rolling averages.
CREATE TABLE IF NOT EXISTS behavioral_patterns (
  user_id               text        PRIMARY KEY,
  avg_message_length    numeric,                          -- EMA of user message char length
  active_hour           integer     CHECK (active_hour BETWEEN 0 AND 23),  -- last observed UTC hour
  days_between_sessions numeric,                          -- EMA of gap between sessions (days)
  crisis_recovery_days  numeric,                          -- EMA of days to recover after crisis event
  total_sessions_count  integer     NOT NULL DEFAULT 0,  -- lifetime session counter
  last_updated          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE behavioral_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON behavioral_patterns
  FOR ALL USING (auth.role() = 'service_role');

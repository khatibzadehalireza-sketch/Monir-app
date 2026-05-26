-- ── Safety Risk Events table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_risk_events (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      text        NOT NULL,
  session_id   text        NOT NULL,
  risk_level   text        NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  trigger_type text                 CHECK (trigger_type IN ('self_harm', 'panic', 'isolation', 'grief')),
  detected_at  timestamptz NOT NULL DEFAULT now(),
  action_taken text
);

CREATE INDEX IF NOT EXISTS idx_safety_user    ON safety_risk_events(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_session ON safety_risk_events(session_id);
CREATE INDEX IF NOT EXISTS idx_safety_level   ON safety_risk_events(risk_level);

ALTER TABLE safety_risk_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON safety_risk_events
  FOR ALL USING (auth.role() = 'service_role');

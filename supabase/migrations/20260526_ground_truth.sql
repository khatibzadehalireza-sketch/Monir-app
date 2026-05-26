-- ── Ground Truth feedback table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_feedback_validation (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id        text        NOT NULL,
  user_id           text        NOT NULL,
  helpfulness_score integer     NOT NULL CHECK (helpfulness_score BETWEEN 1 AND 5),
  created_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_user    ON user_feedback_validation(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_session ON user_feedback_validation(session_id);

ALTER TABLE user_feedback_validation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON user_feedback_validation
  FOR ALL USING (auth.role() = 'service_role');

-- ── Return-rate columns on user_identity ─────────────────────────────────────
ALTER TABLE user_identity
  ADD COLUMN IF NOT EXISTS total_sessions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS day7_return    boolean,
  ADD COLUMN IF NOT EXISTS day30_return   boolean;

-- ============================================================
-- Migration: add daily-visit streak columns to user_identity
-- Date: 2026-05-27  |  ADDITIVE ONLY
-- ============================================================

ALTER TABLE user_identity
  ADD COLUMN IF NOT EXISTS streak_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_visit_date DATE,
  ADD COLUMN IF NOT EXISTS longest_streak  INTEGER NOT NULL DEFAULT 0;

-- Fast lookup when updating streak on every page load
CREATE INDEX IF NOT EXISTS idx_ui_streak
    ON user_identity (user_id, last_visit_date);

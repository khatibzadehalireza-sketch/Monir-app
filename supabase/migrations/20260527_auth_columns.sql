-- ============================================================
-- Migration: add auth columns to user_identity
-- Date: 2026-05-27
-- ADDITIVE ONLY — no existing columns or data are changed.
-- ============================================================

-- 1. auth_user_id  : Supabase auth UUID (same as user_id for signed-up users)
-- 2. email_hash    : SHA-256 hex of the normalised email — never plain email
-- 3. created_at    : row creation timestamp (backfill to updated_at if already present)

ALTER TABLE user_identity
  ADD COLUMN IF NOT EXISTS auth_user_id UUID    UNIQUE,
  ADD COLUMN IF NOT EXISTS email_hash   TEXT    UNIQUE,
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT NOW();

-- Backfill created_at for rows that already exist
UPDATE user_identity
   SET created_at = COALESCE(updated_at, NOW())
 WHERE created_at IS NULL;

-- Index for fast email-hash lookup (e.g. login dedup, audit)
CREATE INDEX IF NOT EXISTS idx_user_identity_email_hash
    ON user_identity (email_hash)
 WHERE email_hash IS NOT NULL;

-- Index for Supabase auth UUID lookups
CREATE INDEX IF NOT EXISTS idx_user_identity_auth_user_id
    ON user_identity (auth_user_id)
 WHERE auth_user_id IS NOT NULL;

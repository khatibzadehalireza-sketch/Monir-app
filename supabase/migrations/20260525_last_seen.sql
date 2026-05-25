-- Track last visit for 30-day fresh-start logic
ALTER TABLE public.user_identity
  ADD COLUMN IF NOT EXISTS last_seen timestamptz;

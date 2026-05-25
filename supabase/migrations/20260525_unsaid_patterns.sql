-- "The Unsaid" detection: patterns of avoidance/deflection stored per user
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS unsaid_patterns jsonb;

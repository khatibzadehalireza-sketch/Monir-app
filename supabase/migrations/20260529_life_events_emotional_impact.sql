-- Add emotional_impact score to life_events
-- Scale: 1 (minor) to 10 (extremely impactful)
ALTER TABLE public.life_events
  ADD COLUMN IF NOT EXISTS emotional_impact integer CHECK (emotional_impact BETWEEN 1 AND 10);

-- Feature 3: emotion scores per session in conversation_metadata
ALTER TABLE public.conversation_metadata
  ADD COLUMN IF NOT EXISTS anxiety_score    integer,
  ADD COLUMN IF NOT EXISTS loneliness_score integer,
  ADD COLUMN IF NOT EXISTS hope_score       integer,
  ADD COLUMN IF NOT EXISTS guilt_score      integer,
  ADD COLUMN IF NOT EXISTS dominant_emotion text,
  ADD COLUMN IF NOT EXISTS spiritual_state  text,
  ADD COLUMN IF NOT EXISTS session_summary  text;

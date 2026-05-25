-- Enable pgvector (no-op if already active)
CREATE EXTENSION IF NOT EXISTS vector;

-- 384-dim embedding for emotion state (e.g. all-MiniLM-L6-v2 / Gemini text-embedding-004)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS emotion_embedding vector(384);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_user_profiles_emotion_embedding
  ON public.user_profiles
  USING hnsw (emotion_embedding vector_cosine_ops);

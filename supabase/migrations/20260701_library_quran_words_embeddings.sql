CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.library_quran_words_embeddings (
  id            bigserial PRIMARY KEY,
  surah_number  integer NOT NULL,
  verse_number  integer NOT NULL,
  word_position integer NOT NULL,
  embedding     vector(384) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (surah_number, verse_number, word_position)
);

CREATE INDEX IF NOT EXISTS idx_library_quran_words_embeddings_hnsw
  ON public.library_quran_words_embeddings
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.library_quran_words_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON public.library_quran_words_embeddings
  FOR SELECT
  USING (true);

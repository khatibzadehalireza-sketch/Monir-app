CREATE TABLE IF NOT EXISTS public.library_tafsir (
  id             bigserial PRIMARY KEY,
  surah_number   integer NOT NULL,
  verse_number   integer NOT NULL,
  language_code  text    NOT NULL,
  tafsir_text    text    NOT NULL DEFAULT '',
  author_name    text    NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (surah_number, verse_number, language_code)
);

CREATE INDEX IF NOT EXISTS idx_library_tafsir_surah_verse
  ON public.library_tafsir (surah_number, verse_number);

ALTER TABLE public.library_tafsir ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON public.library_tafsir
  FOR SELECT
  USING (true);

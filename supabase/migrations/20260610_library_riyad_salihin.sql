CREATE TABLE IF NOT EXISTS public.library_riyad_salihin (
  id             bigserial PRIMARY KEY,
  hadith_number  integer   NOT NULL UNIQUE,
  arabic_text    text      NOT NULL DEFAULT '',
  english_text   text      NOT NULL DEFAULT '',
  turkish_text   text               DEFAULT '',
  urdu_text      text               DEFAULT '',
  french_text    text               DEFAULT '',
  bengali_text   text               DEFAULT '',
  grade          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_riyad_salihin_hadith_number
  ON public.library_riyad_salihin (hadith_number);

ALTER TABLE public.library_riyad_salihin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON public.library_riyad_salihin
  FOR SELECT
  USING (true);

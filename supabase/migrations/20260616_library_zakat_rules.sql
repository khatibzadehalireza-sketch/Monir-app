CREATE TABLE IF NOT EXISTS public.library_zakat_rules (
  id                          bigserial PRIMARY KEY,
  category_key                text    NOT NULL,
  subcategory_key             text    NOT NULL DEFAULT '',
  category_name_ar            text    NOT NULL,
  category_name_en            text    NOT NULL,
  nisab_value                 numeric,
  nisab_unit                  text,
  nisab_description_ar        text    NOT NULL DEFAULT '',
  nisab_description_en        text    NOT NULL DEFAULT '',
  zakat_rate                  numeric,
  rate_description_ar         text    NOT NULL DEFAULT '',
  rate_description_en         text    NOT NULL DEFAULT '',
  hawl_required                boolean,
  hawl_notes_ar                 text    DEFAULT '',
  hawl_notes_en                 text    DEFAULT '',
  debt_deduction_applicable     boolean,
  debt_deduction_notes_ar       text    DEFAULT '',
  debt_deduction_notes_en       text    DEFAULT '',
  madhhab_scope                text    NOT NULL DEFAULT 'consensus',
  hanafi_difference_ar         text    DEFAULT '',
  hanafi_difference_en         text    DEFAULT '',
  source_reference             text    NOT NULL DEFAULT '',
  sort_order                   integer NOT NULL DEFAULT 0,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_key, subcategory_key)
);

CREATE INDEX IF NOT EXISTS idx_library_zakat_rules_category
  ON public.library_zakat_rules (category_key);

ALTER TABLE public.library_zakat_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON public.library_zakat_rules
  FOR SELECT
  USING (true);

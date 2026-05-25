-- Consent layer: track if user agreed to data storage
ALTER TABLE public.user_identity
  ADD COLUMN IF NOT EXISTS consent_given boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_date  timestamptz;

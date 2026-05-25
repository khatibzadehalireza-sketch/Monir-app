-- ============================================
-- MONIR DATA MIGRATION — 9 LAYERS
-- Date: 2026-05-24
-- ============================================

-- LAYER 1+2: Add missing columns to user_identity
ALTER TABLE public.user_identity
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS education_level text,
  ADD COLUMN IF NOT EXISTS family_status text,
  ADD COLUMN IF NOT EXISTS years_in_west text,
  ADD COLUMN IF NOT EXISTS origin_country text,
  ADD COLUMN IF NOT EXISTS diaspora boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS generation_in_country text,
  ADD COLUMN IF NOT EXISTS years_abroad integer,
  ADD COLUMN IF NOT EXISTS muslim_context text,
  ADD COLUMN IF NOT EXISTS community_size text,
  ADD COLUMN IF NOT EXISTS nearest_mosque_km numeric,
  ADD COLUMN IF NOT EXISTS ip_country text,
  ADD COLUMN IF NOT EXISTS ip_city text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'unknown';

-- LAYER 2+3: Add missing columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS prayer_status text,
  ADD COLUMN IF NOT EXISTS quran_relationship text,
  ADD COLUMN IF NOT EXISTS mosque_attendance text,
  ADD COLUMN IF NOT EXISTS spiritual_stage text,
  ADD COLUMN IF NOT EXISTS doubt_level integer,
  ADD COLUMN IF NOT EXISTS guilt_score integer,
  ADD COLUMN IF NOT EXISTS hope_score integer,
  ADD COLUMN IF NOT EXISTS ramadan_engagement text,
  ADD COLUMN IF NOT EXISTS anxiety_score integer,
  ADD COLUMN IF NOT EXISTS loneliness_score integer,
  ADD COLUMN IF NOT EXISTS depression_indicators boolean,
  ADD COLUMN IF NOT EXISTS identity_conflict text,
  ADD COLUMN IF NOT EXISTS family_pressure text,
  ADD COLUMN IF NOT EXISTS trauma_indicators boolean,
  ADD COLUMN IF NOT EXISTS coping_style text,
  ADD COLUMN IF NOT EXISTS help_seeking_behavior text,
  ADD COLUMN IF NOT EXISTS stigma_mental_health boolean,
  ADD COLUMN IF NOT EXISTS self_worth_level integer,
  ADD COLUMN IF NOT EXISTS belonging_need text,
  ADD COLUMN IF NOT EXISTS session_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peak_usage_time text,
  ADD COLUMN IF NOT EXISTS churn_risk text,
  ADD COLUMN IF NOT EXISTS engagement_depth integer,
  ADD COLUMN IF NOT EXISTS fiqh_school text,
  ADD COLUMN IF NOT EXISTS knowledge_level text,
  ADD COLUMN IF NOT EXISTS islamic_identity_strength integer;

-- LAYER 6+7: conversation_metadata (emotional + outcomes)
CREATE TABLE IF NOT EXISTS public.conversation_metadata (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  session_id text,
  created_at timestamptz DEFAULT now(),

  -- Layer 6: Emotional Embeddings
  dominant_emotions text[],
  emotion_intensity jsonb,
  emotional_volatility text,
  semantic_topics text[],
  self_blame_frequency numeric,
  future_orientation numeric,
  religious_vocabulary numeric,

  -- Layer 7: Intervention Outcomes
  before_hope integer,
  before_anxiety integer,
  before_connection integer,
  after_hope integer,
  after_anxiety integer,
  after_connection integer,
  hope_delta integer,
  anxiety_delta integer,
  connection_delta integer,
  returned_after_7_days boolean,
  reported_feeling_better boolean,
  what_worked text,
  what_failed text,

  -- Session metadata
  main_topic text,
  sub_topic text,
  urgency text,
  session_depth integer,
  message_count integer,
  session_length_min integer
);

-- LAYER 8: life_events
CREATE TABLE IF NOT EXISTS public.life_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  event_type text NOT NULL,
  event_year integer,
  impact_on_faith integer,
  description text,
  current_life_pressure text,
  support_network text
);

-- LAYER 4: trajectory (monthly changes)
CREATE TABLE IF NOT EXISTS public.trajectory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  month text NOT NULL,
  hope_score integer,
  anxiety_score integer,
  loneliness_score integer,
  prayer_status text,
  religiosity_level integer,
  transformation_score numeric,
  created_at timestamptz DEFAULT now()
);

-- INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_conversation_metadata_user_id
  ON public.conversation_metadata(user_id);

CREATE INDEX IF NOT EXISTS idx_life_events_user_id
  ON public.life_events(user_id);

CREATE INDEX IF NOT EXISTS idx_trajectory_user_id
  ON public.trajectory(user_id);

CREATE INDEX IF NOT EXISTS idx_trajectory_month
  ON public.trajectory(user_id, month);

-- RLS (Row Level Security)
ALTER TABLE public.conversation_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trajectory ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PRIVACY RULE: name never joins psychological data
-- auth table: UUID + email only
-- all other tables: UUID only, no name
-- ============================================

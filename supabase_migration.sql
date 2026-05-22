-- ══════════════════════════════════════════════
-- Migration: ایجاد user_profiles و ایمن‌سازی RLS
-- باید در Supabase → SQL Editor اجرا بشه
-- ══════════════════════════════════════════════

-- 1. جدول user_profiles
create table if not exists public.user_profiles (
  user_id           text primary key,
  name              text,
  gender            text,
  emotional_state   text,
  topic_tags        text[],
  religiosity_level text,
  summary           text,
  updated_at        timestamptz default now()
);

-- 2. RLS: فقط service_role دسترسی داره
alter table public.user_profiles enable row level security;

drop policy if exists "service_role_full_access" on public.user_profiles;
create policy "service_role_full_access"
  on public.user_profiles
  to service_role
  using (true)
  with check (true);

-- 3. RLS مشابه برای conversations و message_counts
alter table public.conversations enable row level security;

drop policy if exists "service_role_full_access" on public.conversations;
create policy "service_role_full_access"
  on public.conversations
  to service_role
  using (true)
  with check (true);

alter table public.message_counts enable row level security;

drop policy if exists "service_role_full_access" on public.message_counts;
create policy "service_role_full_access"
  on public.message_counts
  to service_role
  using (true)
  with check (true);

-- 4. فیلدهای جدید user_profiles
alter table public.user_profiles
  add column if not exists spiritual_journey_stage text,
  add column if not exists recurring_struggles      text[],
  add column if not exists breakthrough_moments     text[],
  add column if not exists last_checkin             timestamptz;

-- 5. جدول آرشیو R2 — index سبک در Supabase
create table if not exists public.conversation_archives (
  id           bigserial primary key,
  user_id      text      not null,
  date         text      not null,           -- YYYY-MM-DD
  r2_key       text      not null,           -- مسیر کامل در R2
  created_at   timestamptz default now(),
  unique (user_id, date)
);

create index if not exists idx_conv_archives_user
  on public.conversation_archives(user_id, date desc);

alter table public.conversation_archives enable row level security;
drop policy if exists "service_role_full_access" on public.conversation_archives;
create policy "service_role_full_access"
  on public.conversation_archives
  to service_role
  using (true)
  with check (true);

-- 6. تابع پاک‌سازی: فقط p_keep پیام آخر در Supabase نگه دار
create or replace function public.prune_conversations(p_user_id text, p_keep int default 40)
returns void language sql security definer as $$
  delete from public.conversations
  where user_id = p_user_id
    and id not in (
      select id from public.conversations
      where user_id = p_user_id
      order by created_at desc
      limit p_keep
    );
$$;

-- 7. جدول conversation_metadata — اسکور کمّی هر تبادل
create table if not exists public.conversation_metadata (
  id                 bigserial    primary key,
  user_id            text         not null,
  session_id         text         not null,
  topic              text,
  subtopic           text,
  emotional_state    text,
  anxiety_score      smallint     check (anxiety_score     between 0 and 10),
  loneliness_score   smallint     check (loneliness_score  between 0 and 10),
  guilt_score        smallint     check (guilt_score       between 0 and 10),
  hope_score         smallint     check (hope_score        between 0 and 10),
  urgency            text,
  conversation_depth smallint     check (conversation_depth between 1 and 5),
  created_at         timestamptz  default now()
);

-- ایندکس‌ها برای analytics و هشدار بحران
create index if not exists idx_conv_meta_user
  on public.conversation_metadata(user_id, created_at desc);
create index if not exists idx_conv_meta_session
  on public.conversation_metadata(session_id);
create index if not exists idx_conv_meta_urgency
  on public.conversation_metadata(urgency, created_at desc)
  where urgency in ('high', 'critical');

alter table public.conversation_metadata enable row level security;
drop policy if exists "service_role_full_access" on public.conversation_metadata;
create policy "service_role_full_access"
  on public.conversation_metadata to service_role using (true) with check (true);

-- 8. جدول user_identity — اطلاعات دموگرافیک (هرگز به اطلاعات شخصی وصل نیست)
-- user_id یک رشته تصادفی از localStorage است، نه ایمیل/نام/شماره
create table if not exists public.user_identity (
  user_id             text         primary key,
  language            text,                         -- fa / en / ar / tr …
  country             text,                         -- اگه کاربر ذکر کرده
  age_range           text,                         -- under_18 / 18-25 / 26-35 / 36-50 / over_50
  gender              text,                         -- برادر / خواهر / نامشخص
  convert_status      text,                         -- born_muslim / convert / exploring / unknown
  generation          text,                         -- Z / millennial / X / boomer / unknown
  timezone            text,                         -- مثلاً Asia/Tehran
  communication_style text,                         -- formal / informal / mixed
  created_at          timestamptz  default now(),
  updated_at          timestamptz  default now()
);

alter table public.user_identity enable row level security;
drop policy if exists "service_role_full_access" on public.user_identity;
create policy "service_role_full_access"
  on public.user_identity to service_role using (true) with check (true);

-- 9. تأیید
select 'migration complete ✓' as status;
select count(*) as conversation_rows from public.conversations;

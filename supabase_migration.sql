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

-- 4. تأیید
select 'user_profiles created ✓' as status;
select count(*) as conversation_rows from public.conversations;

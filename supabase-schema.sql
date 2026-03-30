-- ============================================
-- KCAL TRACKER - Supabase Schema
-- Execute this in the Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query)
-- ============================================

-- Profiles table (linked to auth.users)
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  first_name text not null,
  basal_metabolism int not null,
  target_weight_loss numeric(5,2) not null,
  target_date date not null,
  api_key text,
  occasion text default '',
  created_at timestamp with time zone default now()
);

-- Daily entries (meals + activities)
create table if not exists daily_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  entry_date date not null,
  type text not null check (type in ('meal', 'activity')),
  description text not null,
  kcal int not null,
  detail text default '',
  entry_time text default '',
  created_at timestamp with time zone default now()
);

-- Index for fast lookups by profile + date
create index if not exists idx_entries_profile_date
  on daily_entries(profile_id, entry_date);

-- Enable RLS
alter table profiles enable row level security;
alter table daily_entries enable row level security;

-- Profiles: users can only access their own profile
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = user_id);

create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = user_id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = user_id);

create policy "Users can delete own profile" on profiles
  for delete using (auth.uid() = user_id);

-- Daily entries: users can only access entries linked to their profile
create policy "Users can view own entries" on daily_entries
  for select using (
    profile_id in (select id from profiles where user_id = auth.uid())
  );

create policy "Users can insert own entries" on daily_entries
  for insert with check (
    profile_id in (select id from profiles where user_id = auth.uid())
  );

create policy "Users can update own entries" on daily_entries
  for update using (
    profile_id in (select id from profiles where user_id = auth.uid())
  );

create policy "Users can delete own entries" on daily_entries
  for delete using (
    profile_id in (select id from profiles where user_id = auth.uid())
  );

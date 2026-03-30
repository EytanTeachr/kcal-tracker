-- ============================================
-- KCAL TRACKER - Supabase Schema
-- Execute this in the Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query)
-- ============================================

-- Profiles table
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
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

-- Disable RLS (personal app, simple setup)
alter table profiles enable row level security;
alter table daily_entries enable row level security;

-- Allow all operations with anon key (personal app)
create policy "Allow all on profiles" on profiles
  for all using (true) with check (true);

create policy "Allow all on daily_entries" on daily_entries
  for all using (true) with check (true);

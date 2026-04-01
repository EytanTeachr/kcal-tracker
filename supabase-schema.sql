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

-- Favorite meals
create table if not exists favorite_meals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  items jsonb not null,
  created_at timestamp with time zone default now()
);

alter table favorite_meals enable row level security;

create policy "Users manage own favorites" on favorite_meals
  for all using (profile_id in (select id from profiles where user_id = auth.uid()));

-- ============================================
-- FRIENDS SYSTEM
-- ============================================

-- Add friend_pin and email to profiles
alter table profiles add column if not exists friend_pin text default '';
alter table profiles add column if not exists email text default '';

-- Friendships table
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references profiles(id) on delete cascade not null,
  addressee_id uuid references profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  permission text not null default 'read' check (permission in ('read', 'write')),
  created_at timestamp with time zone default now(),
  unique(requester_id, addressee_id)
);
alter table friendships enable row level security;
create policy "Users view own friendships" on friendships for select using (
  requester_id in (select id from profiles where user_id = auth.uid())
  or addressee_id in (select id from profiles where user_id = auth.uid())
);
create policy "Users send requests" on friendships for insert with check (
  requester_id in (select id from profiles where user_id = auth.uid())
);
create policy "Users update friendships" on friendships for update using (
  requester_id in (select id from profiles where user_id = auth.uid())
  or addressee_id in (select id from profiles where user_id = auth.uid())
);
create policy "Users delete friendships" on friendships for delete using (
  requester_id in (select id from profiles where user_id = auth.uid())
  or addressee_id in (select id from profiles where user_id = auth.uid())
);

-- Encouragements table
create table if not exists encouragements (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete cascade not null,
  receiver_id uuid references profiles(id) on delete cascade not null,
  message text not null,
  created_at timestamp with time zone default now()
);
alter table encouragements enable row level security;
create policy "Users view own encouragements" on encouragements for select using (
  receiver_id in (select id from profiles where user_id = auth.uid())
  or sender_id in (select id from profiles where user_id = auth.uid())
);
create policy "Users send encouragements" on encouragements for insert with check (
  sender_id in (select id from profiles where user_id = auth.uid())
);

-- ============================================
-- Allow viewing profiles of users linked by friendships (pending or accepted)
-- ============================================
create policy "Users can view friend profiles" on profiles
  for select using (
    id in (
      select requester_id from friendships
      where addressee_id in (select id from profiles p2 where p2.user_id = auth.uid())
      union
      select addressee_id from friendships
      where requester_id in (select id from profiles p2 where p2.user_id = auth.uid())
    )
  );

-- ============================================
-- RPC FUNCTION: Find friend by email + PIN (bypasses RLS)
-- ============================================
create or replace function find_friend_by_email_and_pin(search_email text, search_pin text)
returns table(id uuid, first_name text, email text)
language sql
security definer
as $$
  select id, first_name, email
  from profiles
  where email = search_email
    and friend_pin = search_pin
    and friend_pin != ''
  limit 1;
$$;

-- ============================================
-- RLS: Friends can view each other's entries
-- ============================================
create policy "Friends can view entries" on daily_entries
  for select using (
    profile_id in (
      select case
        when f.requester_id in (select id from profiles where user_id = auth.uid())
        then f.addressee_id
        else f.requester_id
      end
      from friendships f
      where f.status = 'accepted'
      and (
        f.requester_id in (select id from profiles where user_id = auth.uid())
        or f.addressee_id in (select id from profiles where user_id = auth.uid())
      )
    )
  );

-- Friends with write permission can insert entries
create policy "Friends can add entries" on daily_entries
  for insert with check (
    profile_id in (
      select case
        when f.requester_id in (select id from profiles where user_id = auth.uid())
        then f.addressee_id
        else f.requester_id
      end
      from friendships f
      where f.status = 'accepted'
      and f.permission = 'write'
      and (
        f.requester_id in (select id from profiles where user_id = auth.uid())
        or f.addressee_id in (select id from profiles where user_id = auth.uid())
      )
    )
  );

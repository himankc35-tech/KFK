-- ============================================================================
-- FIGHTER XP: COMPLETE SUPABASE SCHEMA + RELATIONSHIPS + RLS POLICIES
-- Run this script once in your Supabase Dashboard -> SQL Editor.
-- Safe to re-run (idempotent).
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. PLAYER PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  player_id text unique not null,
  username text unique not null,
  avatar_url text not null default '/assets/oggy/oggy_portrait.png',
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  xp integer not null default 0 check (xp >= 0),
  v_coins integer not null default 0 check (v_coins >= 0),
  is_online boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_player_id on public.profiles (player_id);
create index if not exists idx_profiles_username_lower on public.profiles (lower(username));
create index if not exists idx_profiles_leaderboard on public.profiles (wins desc, xp desc);

-- 2. FRIENDSHIPS (Requests, Accepted Friends, Rejections)
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_unique_pair unique (requester_id, addressee_id)
);

create index if not exists idx_friendships_requester on public.friendships (requester_id, status);
create index if not exists idx_friendships_addressee on public.friendships (addressee_id, status);

-- 3. ONLINE MULTIPLAYER ROOMS (Public Lobby & Private Room Codes)
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status text not null default 'waiting' check (status in ('waiting', 'ready', 'playing', 'finished')),
  host_id uuid not null references public.profiles(id) on delete cascade,
  guest_id uuid references public.profiles(id) on delete set null,
  arena_id text not null default 'jungle_temple',
  host_char text not null default 'oggy',
  guest_char text not null default 'buster',
  host_ready boolean not null default false,
  guest_ready boolean not null default false,
  winner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rooms_code on public.rooms (code);
create index if not exists idx_rooms_public_waiting on public.rooms (visibility, status, created_at desc);

-- 4. FRIEND MATCH INVITES
create table if not exists public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  room_code text not null,
  room_name text not null default 'Private Arena',
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now()
);

create index if not exists idx_room_invites_receiver on public.room_invites (receiver_id, status, created_at desc);

-- 5. MATCH HISTORY
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  room_code text,
  p1_id uuid not null references public.profiles(id) on delete cascade,
  p2_id uuid not null references public.profiles(id) on delete cascade,
  p1_char text not null,
  p2_char text not null,
  arena_id text not null,
  winner_id uuid not null references public.profiles(id) on delete cascade,
  p1_wins integer not null default 0,
  p2_wins integer not null default 0,
  xp_awarded integer not null default 100,
  created_at timestamptz not null default now()
);

create index if not exists idx_matches_p1 on public.matches (p1_id, created_at desc);
create index if not exists idx_matches_p2 on public.matches (p2_id, created_at desc);

-- 6. LEADERBOARD VIEW
create or replace view public.leaderboard as
select
  id,
  player_id,
  username,
  avatar_url,
  wins,
  losses,
  xp,
  is_online,
  case
    when (wins + losses) = 0 then 0
    else round((wins::numeric / (wins + losses)::numeric) * 100, 1)
  end as win_rate
from public.profiles
order by wins desc, xp desc, created_at asc;

-- 7. UPDATED_AT HELPER TRIGGER
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_friendships_updated on public.friendships;
create trigger trg_friendships_updated
  before update on public.friendships
  for each row execute function public.set_updated_at();

drop trigger if exists trg_rooms_updated on public.rooms;
create trigger trg_rooms_updated
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- 8. AUTO-CREATE PROFILE ON SUPABASE AUTH SIGNUP
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_name text;
  generated_code text;
begin
  desired_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    'Fighter_' || substr(replace(new.id::text, '-', ''), 1, 6)
  );
  generated_code := 'FXP-' || upper(substr(replace(new.id::text, '-', ''), 1, 6));

  insert into public.profiles (id, player_id, username, avatar_url, is_online, last_seen)
  values (
    new.id,
    generated_code,
    desired_name,
    coalesce(nullif(new.raw_user_meta_data ->> 'avatar_url', ''), '/assets/oggy/oggy_portrait.png'),
    true,
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 9. ATOMIC MATCH RESULT + STATS RECORDING RPC
create or replace function public.record_online_match_result(
  p_room_code text,
  p_p1_id uuid,
  p_p2_id uuid,
  p_p1_char text,
  p_p2_char text,
  p_arena_id text,
  p_winner_id uuid,
  p_p1_wins integer,
  p_p2_wins integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_match_id uuid;
  loser_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if auth.uid() <> p_p1_id and auth.uid() <> p_p2_id then
    raise exception 'Only match participants can record results';
  end if;
  if p_winner_id <> p_p1_id and p_winner_id <> p_p2_id then
    raise exception 'Winner must be one of the two fighters';
  end if;

  loser_id := case when p_winner_id = p_p1_id then p_p2_id else p_p1_id end;

  insert into public.matches (
    room_code, p1_id, p2_id, p1_char, p2_char, arena_id, winner_id, p1_wins, p2_wins, xp_awarded
  )
  values (
    p_room_code, p_p1_id, p_p2_id, p_p1_char, p_p2_char, p_arena_id, p_winner_id, p_p1_wins, p_p2_wins, 100
  )
  returning id into new_match_id;

  update public.profiles
  set wins = wins + 1,
      xp = xp + 100,
      v_coins = v_coins + 25,
      updated_at = now()
  where id = p_winner_id;

  update public.profiles
  set losses = losses + 1,
      xp = xp + 35,
      v_coins = v_coins + 10,
      updated_at = now()
  where id = loser_id;

  return new_match_id;
end;
$$;

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.rooms enable row level security;
alter table public.room_invites enable row level security;
alter table public.matches enable row level security;

-- Profiles RLS
drop policy if exists "Profiles readable by authenticated or public" on public.profiles;
create policy "Profiles readable by authenticated or public"
  on public.profiles for select
  using (true);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Friendships RLS
drop policy if exists "Users view own friendships" on public.friendships;
create policy "Users view own friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users send friend requests" on public.friendships;
create policy "Users send friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id and requester_id <> addressee_id);

drop policy if exists "Users update incoming/participating friendships" on public.friendships;
create policy "Users update incoming/participating friendships"
  on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users remove own friendships" on public.friendships;
create policy "Users remove own friendships"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Rooms RLS
drop policy if exists "Public or joined rooms visible" on public.rooms;
create policy "Public or joined rooms visible"
  on public.rooms for select
  using (visibility = 'public' or auth.uid() = host_id or auth.uid() = guest_id);

drop policy if exists "Authenticated users create rooms" on public.rooms;
create policy "Authenticated users create rooms"
  on public.rooms for insert
  with check (auth.uid() = host_id);

drop policy if exists "Host or guest or joining user updates room" on public.rooms;
create policy "Host or guest or joining user updates room"
  on public.rooms for update
  using (auth.uid() = host_id or auth.uid() = guest_id or (guest_id is null and status = 'waiting'))
  with check (auth.uid() = host_id or auth.uid() = guest_id);

drop policy if exists "Host deletes room" on public.rooms;
create policy "Host deletes room"
  on public.rooms for delete
  using (auth.uid() = host_id);

-- Room Invites RLS
drop policy if exists "Users view own invites" on public.room_invites;
create policy "Users view own invites"
  on public.room_invites for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users send invites" on public.room_invites;
create policy "Users send invites"
  on public.room_invites for insert
  with check (auth.uid() = sender_id);

drop policy if exists "Participants update invites" on public.room_invites;
create policy "Participants update invites"
  on public.room_invites for update
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Matches RLS
drop policy if exists "Match history readable" on public.matches;
create policy "Match history readable"
  on public.matches for select
  using (true);

drop policy if exists "Participants insert match" on public.matches;
create policy "Participants insert match"
  on public.matches for insert
  with check (auth.uid() = p1_id or auth.uid() = p2_id);

-- 11. ENABLE REALTIME PUBLICATION
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships') then
    alter publication supabase_realtime add table public.friendships;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms') then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_invites') then
    alter publication supabase_realtime add table public.room_invites;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches') then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;

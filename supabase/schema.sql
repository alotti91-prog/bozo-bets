-- =====================================================================
-- Bozo Bets: database setup
-- Paste this whole file into Supabase > SQL Editor > New query, then Run.
-- Run it once on a fresh project. It creates the tables, the security
-- rules (who can read/write what), the server functions the app calls,
-- and turns on live updates.
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table if not exists public.leagues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  stake       numeric(10,2) not null default 10 check (stake > 0),
  invite_code text not null unique,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.leagues(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 24),
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  unique (league_id, name)
);

create table if not exists public.members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','admin','member')),
  player_id uuid references public.players(id) on delete set null,
  email     text,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
-- One login per player name.
create unique index if not exists members_one_user_per_player
  on public.members (league_id, player_id) where player_id is not null;

create table if not exists public.weeks (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.leagues(id) on delete cascade,
  n             int not null check (n > 0),
  start_date    date not null default current_date,
  stake         numeric(10,2) not null check (stake > 0),
  payer_id      uuid references public.players(id) on delete set null,
  actual_payout numeric(12,2) check (actual_payout >= 0),
  created_at    timestamptz not null default now(),
  unique (league_id, n)
);

create table if not exists public.legs (
  id         uuid primary key default gen_random_uuid(),
  week_id    uuid not null references public.weeks(id) on delete cascade,
  league_id  uuid not null references public.leagues(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  pick       text not null check (char_length(pick) between 1 and 80),
  odds       int not null check (abs(odds) between 100 and 100000),
  sport      text not null default 'NFL' check (char_length(sport) between 1 and 16),
  result     text check (result in ('W','L','P')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, player_id)
);

create table if not exists public.spins (
  id         uuid primary key default gen_random_uuid(),
  week_id    uuid not null references public.weeks(id) on delete cascade,
  league_id  uuid not null references public.leagues(id) on delete cascade,
  pool       uuid[] not null,
  landed_id  uuid not null references public.players(id) on delete cascade,
  spun_by    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
-- Elimination wheel: the names knocked out, in order. The last name left is
-- landed_id, the bozo. Null on spins from before elimination (one spin, landed_id = bozo).
alter table public.spins add column if not exists eliminated uuid[];

create index if not exists players_league_idx on public.players (league_id);
create index if not exists weeks_league_idx   on public.weeks (league_id, n);
create index if not exists legs_league_idx    on public.legs (league_id);
create index if not exists legs_week_idx      on public.legs (week_id);
create index if not exists spins_league_idx   on public.spins (league_id, created_at);

-- Reactions on picks. One of each emoji per person per pick.
create table if not exists public.reactions (
  leg_id     uuid not null references public.legs(id) on delete cascade,
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null check (emoji in ('🔥','🙏','🤡','💀')),
  created_at timestamptz not null default now(),
  primary key (leg_id, user_id, emoji)
);
create index if not exists reactions_league_idx on public.reactions (league_id);

-- Comments on picks (trash talk that stays with the pick).
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  leg_id     uuid not null references public.legs(id) on delete cascade,
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists comments_league_idx on public.comments (league_id);
create index if not exists comments_leg_idx on public.comments (leg_id, created_at);

-- Who has watched each spin. Until you watch the latest one (live or as a
-- replay), the app hides who it landed on.
create table if not exists public.spin_views (
  spin_id    uuid not null references public.spins(id) on delete cascade,
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  seen_at    timestamptz not null default now(),
  primary key (spin_id, user_id)
);
create index if not exists spin_views_league_idx on public.spin_views (league_id, user_id);

-- "Bet placed": whoever's on the hook marks the slip placed, with an optional
-- screenshot stored in the private "slips" storage bucket (set up below).
alter table public.weeks add column if not exists placed_at timestamptz;
alter table public.weeks add column if not exists placed_by uuid references auth.users(id) on delete set null;
-- A leg picked from a game: which game, bet type, side, line, player and stat
-- (see src/lib/bets.js). Free-text legs leave it empty. Used for live tracking.
alter table public.legs add column if not exists bet jsonb
  check (bet is null or (jsonb_typeof(bet) = 'object' and length(bet::text) < 4000));
-- How far a graded leg finished from its line, in the bet's own units (points,
-- goals, runs, yards): positive = won by, negative = missed by. The app saves it
-- with the grade when the final score is in; free-text legs leave it empty. The
-- weekly recap uses it to pick a face (a close miss gets off lighter than a blowout).
alter table public.legs add column if not exists margin numeric
  check (margin is null or abs(margin) < 100000);
-- How bad a lost leg was when the app can't measure it from the score (a typed
-- leg, or one graded without a final score): 'close' or 'blowout', picked by
-- the commish. Empty means a regular miss. For typed legs, margin can hold how
-- much it lost by, as the commish entered it (shown in the recap).
alter table public.legs add column if not exists miss text
  check (miss is null or miss in ('close', 'blowout'));

-- Several screenshots per slip (a long parlay rarely fits in one). slip_path is
-- the first one, kept for older copies of the app.
alter table public.weeks add column if not exists slip_paths text[] not null default '{}';
alter table public.weeks add column if not exists slip_path text;

-- Pick deadline. The league sets a weekly rule (day, time, time zone); each
-- week gets its own lock_at, filled in when the week opens and editable by
-- the commish for one-off weeks. lock_at null = no deadline that week.
alter table public.leagues add column if not exists lock_dow int check (lock_dow between 0 and 6);
alter table public.leagues add column if not exists lock_time time;
alter table public.leagues add column if not exists lock_tz text not null default 'America/New_York';
alter table public.weeks add column if not exists lock_at timestamptz;

-- ---------- Helper functions used by the security rules -------------

create or replace function public.is_member(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where league_id = lid and user_id = auth.uid());
$$;

create or replace function public.is_admin(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members
                 where league_id = lid and user_id = auth.uid() and role in ('owner','admin'));
$$;

create or replace function public.is_owner(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members
                 where league_id = lid and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.my_player(lid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select player_id from public.members where league_id = lid and user_id = auth.uid();
$$;

create or replace function public.latest_week_id(lid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.weeks where league_id = lid order by n desc limit 1;
$$;

-- True until a week's pick deadline passes (always true with no deadline).
create or replace function public.week_open(wid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select lock_at is null or now() < lock_at from public.weeks where id = wid), true);
$$;

-- The league's next deadline on or after a date, never in the past.
create or replace function public.next_lock(lid uuid, from_date date) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare
  l public.leagues;
  d date;
  t timestamptz;
begin
  select * into l from public.leagues where id = lid;
  if l.id is null or l.lock_dow is null or l.lock_time is null then return null; end if;
  d := from_date + ((l.lock_dow - extract(dow from from_date)::int + 7) % 7);
  t := (d + l.lock_time) at time zone coalesce(nullif(l.lock_tz, ''), 'America/New_York');
  while t <= now() loop
    t := t + interval '7 days';
  end loop;
  return t;
end $$;

-- Six-character invite code, no look-alike characters (no 0/O, 1/I/L).
create or replace function public.new_invite_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  b bytea;
  i int;
begin
  loop
    b := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.leagues where invite_code = code);
  end loop;
  return code;
end $$;

-- ---------- Leg guard: grading is commish-only, past weeks are locked --

create or replace function public.legs_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  w_league uuid;
  w_n int;
  latest int;
begin
  select league_id, n into w_league, w_n from public.weeks where id = new.week_id;
  if w_league is null then
    raise exception 'That week does not exist';
  end if;
  new.league_id := w_league;
  if not exists (select 1 from public.players where id = new.player_id and league_id = w_league) then
    raise exception 'That player is not in this league';
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  if new.result is null then
    new.margin := null; -- un-graded: how far it missed no longer applies
  end if;
  if new.result is distinct from 'L' then
    new.miss := null; -- only a lost leg can be a close call or a blowout
  end if;

  if not public.is_admin(w_league) then
    if tg_op = 'INSERT' then
      new.result := null;
      new.margin := null;
      new.miss := null;
    else
      if new.result is distinct from old.result or new.margin is distinct from old.margin or new.miss is distinct from old.miss then
        raise exception 'Only the commish can grade legs';
      end if;
      if new.player_id <> old.player_id or new.week_id <> old.week_id then
        raise exception 'You can only edit your own pick';
      end if;
    end if;
    select max(n) into latest from public.weeks where league_id = w_league;
    if w_n <> latest then
      raise exception 'That week is closed';
    end if;
    if not public.week_open(new.week_id) then
      raise exception 'Picks are locked for this week. Ask the commish if you need a change.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists legs_guard on public.legs;
create trigger legs_guard before insert or update on public.legs
  for each row execute function public.legs_guard();

-- ---------- Row-level security ---------------------------------------

alter table public.leagues enable row level security;
alter table public.players enable row level security;
alter table public.members enable row level security;
alter table public.weeks   enable row level security;
alter table public.legs    enable row level security;
alter table public.spins   enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.spin_views enable row level security;

-- Leagues: members read; commish edits name/stake. Created via create_league().
drop policy if exists "league read" on public.leagues;
create policy "league read" on public.leagues for select to authenticated using (public.is_member(id));
drop policy if exists "league update" on public.leagues;
create policy "league update" on public.leagues for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

-- Players: members read; commish adds, renames, benches.
drop policy if exists "player read" on public.players;
create policy "player read" on public.players for select to authenticated using (public.is_member(league_id));
drop policy if exists "player insert" on public.players;
create policy "player insert" on public.players for insert to authenticated with check (public.is_admin(league_id));
drop policy if exists "player update" on public.players;
create policy "player update" on public.players for update to authenticated
  using (public.is_admin(league_id)) with check (public.is_admin(league_id));

-- Members: members see who else is in. Changes go through functions below.
drop policy if exists "member read" on public.members;
create policy "member read" on public.members for select to authenticated using (public.is_member(league_id));

-- Weeks: members read; commish sets payer, payout, stake. Created by functions.
drop policy if exists "week read" on public.weeks;
create policy "week read" on public.weeks for select to authenticated using (public.is_member(league_id));
drop policy if exists "week update" on public.weeks;
create policy "week update" on public.weeks for update to authenticated
  using (public.is_admin(league_id)) with check (public.is_admin(league_id));

-- Legs: members read all; you add/edit/remove your own ungraded pick in the
-- current week; the commish can do anything.
drop policy if exists "leg read" on public.legs;
create policy "leg read" on public.legs for select to authenticated using (public.is_member(league_id));
drop policy if exists "leg insert" on public.legs;
create policy "leg insert" on public.legs for insert to authenticated with check (
  public.is_member(league_id)
  and (public.is_admin(league_id) or player_id = public.my_player(league_id))
);
drop policy if exists "leg update" on public.legs;
create policy "leg update" on public.legs for update to authenticated
  using (public.is_admin(league_id) or (player_id = public.my_player(league_id) and result is null))
  with check (public.is_admin(league_id) or player_id = public.my_player(league_id));
drop policy if exists "leg delete" on public.legs;
create policy "leg delete" on public.legs for delete to authenticated using (
  public.is_admin(league_id)
  or (player_id = public.my_player(league_id) and result is null and week_id = public.latest_week_id(league_id)
      and public.week_open(week_id))
);

-- Spins: members read. Only spin_wheel() writes them.
drop policy if exists "spin read" on public.spins;
create policy "spin read" on public.spins for select to authenticated using (public.is_member(league_id));

-- Reactions: members read all; you add and remove only your own.
create or replace function public.reactions_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select league_id into new.league_id from public.legs where id = new.leg_id;
  if new.league_id is null then raise exception 'That pick does not exist'; end if;
  new.user_id := auth.uid();
  return new;
end $$;
drop trigger if exists reactions_fill on public.reactions;
create trigger reactions_fill before insert on public.reactions
  for each row execute function public.reactions_fill();

drop policy if exists "reaction read" on public.reactions;
create policy "reaction read" on public.reactions for select to authenticated using (public.is_member(league_id));
drop policy if exists "reaction add" on public.reactions;
create policy "reaction add" on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(league_id));
drop policy if exists "reaction remove" on public.reactions;
create policy "reaction remove" on public.reactions for delete to authenticated using (user_id = auth.uid());

-- Spin views: you record and read only your own.
create or replace function public.spin_views_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select league_id into new.league_id from public.spins where id = new.spin_id;
  if new.league_id is null then raise exception 'That spin does not exist'; end if;
  new.user_id := auth.uid();
  return new;
end $$;
drop trigger if exists spin_views_fill on public.spin_views;
create trigger spin_views_fill before insert on public.spin_views
  for each row execute function public.spin_views_fill();

drop policy if exists "view read" on public.spin_views;
create policy "view read" on public.spin_views for select to authenticated using (user_id = auth.uid());
drop policy if exists "view add" on public.spin_views;
create policy "view add" on public.spin_views for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(league_id));

-- Comments: members read all and post as themselves. You delete your own; the
-- commish can delete anyone's. No editing, so what was said stays said.
create or replace function public.comments_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select league_id into new.league_id from public.legs where id = new.leg_id;
  if new.league_id is null then raise exception 'That pick does not exist'; end if;
  new.user_id := auth.uid();
  new.body := btrim(coalesce(new.body, ''));
  if new.body = '' then raise exception 'Write something first'; end if;
  if char_length(new.body) > 280 then raise exception 'Keep it under 280 characters'; end if;
  return new;
end $$;
drop trigger if exists comments_fill on public.comments;
create trigger comments_fill before insert on public.comments
  for each row execute function public.comments_fill();

drop policy if exists "comment read" on public.comments;
create policy "comment read" on public.comments for select to authenticated using (public.is_member(league_id));
drop policy if exists "comment add" on public.comments;
create policy "comment add" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(league_id));
drop policy if exists "comment remove" on public.comments;
create policy "comment remove" on public.comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin(league_id));

-- ---------- Functions the app calls ----------------------------------

-- Start a league: you become the owner, players are created, and the first
-- week opens. p_first_week lets a league start mid-season (the app suggests
-- the current NFL week).
drop function if exists public.create_league(text, numeric, text[], text);
create or replace function public.create_league(p_name text, p_stake numeric, p_players text[], p_my_name text default null, p_first_week int default 1)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  lid uuid;
  nm text;
  i int := 0;
  mine uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Give the league a name'; end if;
  if p_stake is null or p_stake <= 0 then raise exception 'Stake must be more than $0'; end if;
  if coalesce(array_length(p_players, 1), 0) < 2 then raise exception 'Add at least two players'; end if;
  if p_first_week is null or p_first_week < 1 or p_first_week > 30 then raise exception 'Starting week must be between 1 and 30'; end if;

  insert into public.leagues (name, stake, invite_code, created_by)
  values (left(trim(p_name), 40), p_stake, public.new_invite_code(), uid)
  returning id into lid;

  insert into public.members (league_id, user_id, role, email)
  values (lid, uid, 'owner', auth.jwt() ->> 'email');

  foreach nm in array p_players loop
    nm := left(trim(nm), 24);
    if nm <> '' then
      insert into public.players (league_id, name, sort) values (lid, nm, i)
      on conflict (league_id, name) do nothing;
      i := i + 1;
    end if;
  end loop;

  if p_my_name is not null then
    select id into mine from public.players where league_id = lid and lower(name) = lower(trim(p_my_name));
    if mine is not null then
      update public.members set player_id = mine where league_id = lid and user_id = uid;
    end if;
  end if;

  insert into public.weeks (league_id, n, stake) values (lid, p_first_week, p_stake);
  return lid;
end $$;

-- Join with an invite code.
create or replace function public.join_league(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  lid uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select id into lid from public.leagues where invite_code = upper(trim(p_code));
  if lid is null then raise exception 'That invite code didn''t match a league'; end if;
  insert into public.members (league_id, user_id, role, email)
  values (lid, uid, 'member', auth.jwt() ->> 'email')
  on conflict (league_id, user_id) do nothing;
  return lid;
end $$;

-- Say which player you are (or pass null to un-claim).
create or replace function public.claim_player(p_league uuid, p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_league) then raise exception 'You are not in this league'; end if;
  if p_player is not null then
    if not exists (select 1 from public.players where id = p_player and league_id = p_league) then
      raise exception 'That player is not in this league';
    end if;
    if exists (select 1 from public.members where league_id = p_league and player_id = p_player and user_id <> auth.uid()) then
      raise exception 'Someone already claimed that name. Ask the commish to sort it out.';
    end if;
  end if;
  update public.members set player_id = p_player where league_id = p_league and user_id = auth.uid();
end $$;

-- Commish tool: link (or unlink) any member to a player.
create or replace function public.assign_player(p_league uuid, p_user uuid, p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_league) then raise exception 'Only the commish can do that'; end if;
  if p_player is not null then
    if not exists (select 1 from public.players where id = p_player and league_id = p_league) then
      raise exception 'That player is not in this league';
    end if;
    update public.members set player_id = null where league_id = p_league and player_id = p_player;
  end if;
  update public.members set player_id = p_player where league_id = p_league and user_id = p_user;
end $$;

-- Owner tool: make someone a commish (admin) or a regular member.
create or replace function public.set_member_role(p_league uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_league) then raise exception 'Only the league owner can change roles'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Role must be admin or member'; end if;
  if exists (select 1 from public.members where league_id = p_league and user_id = p_user and role = 'owner') then
    raise exception 'The owner''s role can''t be changed';
  end if;
  update public.members set role = p_role where league_id = p_league and user_id = p_user;
end $$;

-- Owner tool: remove someone's login from the league (their player history stays).
create or replace function public.remove_member(p_league uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_league) then raise exception 'Only the league owner can remove people'; end if;
  delete from public.members where league_id = p_league and user_id = p_user and role <> 'owner';
end $$;

-- Owner tool: new invite code (old links stop working).
create or replace function public.regenerate_invite(p_league uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not public.is_owner(p_league) then raise exception 'Only the league owner can do that'; end if;
  code := public.new_invite_code();
  update public.leagues set invite_code = code where id = p_league;
  return code;
end $$;

-- Spin the Bozo Wheel. The database decides the result (not the spinner's
-- phone): it knocks names out one at a time, each picked at random from the
-- names left, until one remains. That last name is the bozo. Every name still
-- has the same 1-in-N chance; elimination only adds suspense. It logs the spin
-- (with the knock-out order, so every phone plays the same sequence) and sets
-- next week's payer. Spinning the previous week again counts as a logged re-spin.
create or replace function public.spin_wheel(p_week uuid, p_pool uuid[])
returns public.spins language plpgsql security definer set search_path = public as $$
declare
  w public.weeks;
  latest int;
  pool uuid[];
  remaining uuid[];
  knocked uuid[] := '{}';
  bozo uuid;
  cnt int;
  b bytea;
  k int;
  s public.spins;
  next_id uuid;
  prev_n int;
begin
  select * into w from public.weeks where id = p_week;
  if w.id is null then raise exception 'That week does not exist'; end if;
  if not public.is_admin(w.league_id) then raise exception 'Only the commish can spin the wheel'; end if;

  -- Week numbers can have gaps (a league that started mid-season, past weeks
  -- added later), so "last week" means the closest week before the current one.
  select max(n) into latest from public.weeks where league_id = w.league_id;
  select max(n) into prev_n from public.weeks where league_id = w.league_id and n < latest;
  if w.n <> latest and (prev_n is null or w.n <> prev_n) then
    raise exception 'Only this week or last week can be spun';
  end if;
  -- The wheel spins on a settled week: this week once it's graded, or last
  -- week (a first spin if it was never spun, or a re-spin).
  if not exists (select 1 from public.legs where week_id = w.id) then
    raise exception 'No legs that week yet';
  end if;
  if exists (select 1 from public.legs where week_id = w.id and result is null) then
    raise exception 'Grade every leg before spinning';
  end if;

  -- Keep the order the app sent (it draws the wheel in that order), drop
  -- duplicates and anyone not in this league.
  select array_agg(x order by first_ord) into pool
  from (
    select x, min(ord) as first_ord
    from unnest(p_pool) with ordinality as t(x, ord)
    group by x
  ) q
  where exists (select 1 from public.players p where p.id = q.x and p.league_id = w.league_id);

  if coalesce(array_length(pool, 1), 0) = 0 then raise exception 'Put at least one name in the wheel'; end if;

  -- Knock out a random name (secure random bytes from gen_random_uuid) until one is left.
  remaining := pool;
  loop
    cnt := array_length(remaining, 1);
    exit when cnt = 1;
    b := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    k := ((get_byte(b, 0) * 16777216::bigint + get_byte(b, 1) * 65536 + get_byte(b, 2) * 256 + get_byte(b, 3)) % cnt)::int + 1;
    knocked := knocked || remaining[k];
    remaining := remaining[1:k - 1] || remaining[k + 1:cnt];
  end loop;
  bozo := remaining[1];

  insert into public.spins (week_id, league_id, pool, landed_id, eliminated, spun_by)
  values (w.id, w.league_id, pool, bozo, knocked, auth.uid())
  returning * into s;

  select id into next_id from public.weeks where league_id = w.league_id and n > w.n order by n limit 1;
  if next_id is null then
    insert into public.weeks (league_id, n, stake, payer_id)
    select w.league_id, w.n + 1, l.stake, bozo from public.leagues l where l.id = w.league_id;
  else
    update public.weeks set payer_id = bozo where id = next_id;
  end if;
  return s;
end $$;

-- Commish tool: open next week without spinning (payer picked by hand).
create or replace function public.start_next_week(p_league uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  latest int;
  wid uuid;
begin
  if not public.is_admin(p_league) then raise exception 'Only the commish can do that'; end if;
  select coalesce(max(n), 0) into latest from public.weeks where league_id = p_league;
  insert into public.weeks (league_id, n, stake)
  select p_league, latest + 1, stake from public.leagues where id = p_league
  returning id into wid;
  return wid;
end $$;

-- Owner tool: wipe every week and start over. Players stay.
drop function if exists public.new_season(uuid);
create or replace function public.new_season(p_league uuid, p_first_week int default 1)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_league) then raise exception 'Only the league owner can start a new season'; end if;
  if p_first_week is null or p_first_week < 1 or p_first_week > 30 then raise exception 'Starting week must be between 1 and 30'; end if;
  delete from public.weeks where league_id = p_league;
  insert into public.weeks (league_id, n, stake) select p_league, p_first_week, stake from public.leagues where id = p_league;
end $$;

-- Commish tool: change the current week's number (say Week 1 -> Week 7 for a
-- league that started late). It has to stay after every past week.
create or replace function public.set_week_number(p_league uuid, p_n int)
returns void language plpgsql security definer set search_path = public as $$
declare
  cur_id uuid;
  other_max int;
begin
  if not public.is_admin(p_league) then raise exception 'Only the commish can do that'; end if;
  if p_n is null or p_n < 1 or p_n > 30 then raise exception 'Week number must be between 1 and 30'; end if;
  select id into cur_id from public.weeks where league_id = p_league order by n desc limit 1;
  if cur_id is null then raise exception 'There''s no week to renumber'; end if;
  select max(n) into other_max from public.weeks where league_id = p_league and id <> cur_id;
  if other_max is not null and p_n <= other_max then
    raise exception 'This week has to come after Week %, your latest past week', other_max;
  end if;
  update public.weeks set n = p_n where id = cur_id;
end $$;

-- Commish tool: add or edit a past week in one go. p_week null = new week
-- numbered p_n (must come before the current week). Editing makes that week's
-- picks match p_legs: [{player_id, pick, odds, sport, result}]. Each leg is
-- edited in place, so its game link, how far it missed, reactions, and trash
-- talk stay unless the part they depend on changed. Players left out lose their pick.
create or replace function public.save_past_week(p_league uuid, p_week uuid, p_n int, p_start date, p_payer uuid, p_legs jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  cur_id uuid;
  cur_n int;
  wid uuid;
  w public.weeks;
  leg jsonb;
  lstake numeric;
begin
  if not public.is_admin(p_league) then raise exception 'Only the commish can add past weeks'; end if;
  select id, n into cur_id, cur_n from public.weeks where league_id = p_league order by n desc limit 1;
  if cur_id is null then raise exception 'Start the league first'; end if;
  if p_payer is not null and not exists (select 1 from public.players where id = p_payer and league_id = p_league) then
    raise exception 'That player is not in this league';
  end if;
  if jsonb_typeof(p_legs) is distinct from 'array' then raise exception 'No picks were sent'; end if;

  if p_week is null then
    if p_n is null or p_n < 1 or p_n >= cur_n then
      raise exception 'Past weeks have to come before this week (Week %)', cur_n;
    end if;
    if exists (select 1 from public.weeks where league_id = p_league and n = p_n) then
      raise exception 'Week % is already in the league. Edit it from History instead.', p_n;
    end if;
    select stake into lstake from public.leagues where id = p_league;
    insert into public.weeks (league_id, n, start_date, stake, payer_id)
    values (p_league, p_n, coalesce(p_start, current_date), lstake, p_payer)
    returning id into wid;
  else
    select * into w from public.weeks where id = p_week and league_id = p_league;
    if w.id is null then raise exception 'That week isn''t in this league'; end if;
    if w.id = cur_id then raise exception 'Change the current week from This week, not here'; end if;
    update public.weeks set payer_id = p_payer where id = w.id;
    delete from public.legs where week_id = w.id
      and player_id not in (select (x->>'player_id')::uuid from jsonb_array_elements(p_legs) as t(x));
    wid := w.id;
  end if;

  for leg in select value from jsonb_array_elements(p_legs) loop
    if coalesce(leg->>'result', '') not in ('W', 'L', 'P') then
      raise exception 'Every pick in a past week needs a result: W, L or P';
    end if;
    insert into public.legs as l (week_id, league_id, player_id, pick, odds, sport, result)
    values (wid, p_league, (leg->>'player_id')::uuid, left(trim(leg->>'pick'), 80), (leg->>'odds')::int,
            coalesce(nullif(leg->>'sport', ''), 'NFL'), leg->>'result')
    on conflict (week_id, player_id) do update set
      pick = excluded.pick, odds = excluded.odds, sport = excluded.sport, result = excluded.result,
      -- A new pick no longer matches its game; a new result no longer matches how far it missed.
      bet = case when l.pick = excluded.pick then l.bet end,
      margin = case when l.pick = excluded.pick and l.result is not distinct from excluded.result then l.margin end,
      miss = case when l.result is not distinct from excluded.result then l.miss end;
  end loop;
  return wid;
end $$;

-- Commish tool: delete a past week and its picks. The current week can't be deleted.
create or replace function public.delete_past_week(p_week uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  w public.weeks;
  cur_id uuid;
begin
  select * into w from public.weeks where id = p_week;
  if w.id is null then raise exception 'That week does not exist'; end if;
  if not public.is_admin(w.league_id) then raise exception 'Only the commish can delete weeks'; end if;
  select id into cur_id from public.weeks where league_id = w.league_id order by n desc limit 1;
  if w.id = cur_id then raise exception 'You can''t delete the current week'; end if;
  delete from public.weeks where id = w.id;
end $$;

-- Commish tool: go back to an earlier week (say, after a test spin). Every week
-- after it is deleted, with its picks, spins, and trash talk. That week's spins
-- are undone, so its wheel can spin again, and its grades can be cleared too.
-- Slip photos for the deleted weeks are removed by the app (Storage API).
create or replace function public.reset_to_week(p_week uuid, p_clear_grades boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  w public.weeks;
  latest int;
begin
  select * into w from public.weeks where id = p_week;
  if w.id is null then raise exception 'That week does not exist'; end if;
  if not public.is_admin(w.league_id) then raise exception 'Only the commish can reset weeks'; end if;
  select max(n) into latest from public.weeks where league_id = w.league_id;
  if w.n = latest then raise exception 'Week % is already this week', w.n; end if;
  delete from public.weeks where league_id = w.league_id and n > w.n;
  delete from public.spins where week_id = w.id;
  if p_clear_grades then
    update public.legs set result = null where week_id = w.id; -- the leg guard clears margin with it
  end if;
end $$;

-- Mark this week's bet as placed (or not). Whoever's on the hook or the
-- commish can do it. p_slip_path is the screenshot's path in the "slips"
-- bucket, which must sit under this league's folder.
create or replace function public.mark_placed(p_week uuid, p_placed boolean, p_slip_path text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  w public.weeks;
begin
  select * into w from public.weeks where id = p_week;
  if w.id is null then raise exception 'That week does not exist'; end if;
  if not (public.is_admin(w.league_id) or (w.payer_id is not null and w.payer_id = public.my_player(w.league_id))) then
    raise exception 'Only whoever is on the hook, or the commish, can mark the bet placed';
  end if;
  if p_slip_path is not null and p_slip_path not like w.league_id::text || '/%' then
    raise exception 'That screenshot isn''t in this league';
  end if;
  if p_placed then
    update public.weeks
    set placed_at = coalesce(placed_at, now()), placed_by = auth.uid(), slip_path = coalesce(slip_path, p_slip_path),
        slip_paths = case when p_slip_path is null or p_slip_path = any(slip_paths) then slip_paths else slip_paths || p_slip_path end
    where id = w.id;
  else
    update public.weeks set placed_at = null, placed_by = null, slip_path = null, slip_paths = '{}' where id = w.id;
  end if;
end $$;

update public.weeks set slip_paths = array[slip_path] where slip_path is not null and cardinality(slip_paths) = 0;

-- Who may attach or remove slip screenshots: whoever's on the hook, or the commish.
create or replace function public.can_mark_placed(w public.weeks) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin(w.league_id) or (w.payer_id is not null and w.payer_id = public.my_player(w.league_id))
$$;

-- Attach screenshots (uploaded to <league id>/<week id>/...). The first one marks the bet placed.
create or replace function public.add_slips(p_week uuid, p_paths text[])
returns void language plpgsql security definer set search_path = public as $$
declare
  w public.weeks;
  p text;
  merged text[];
begin
  select * into w from public.weeks where id = p_week;
  if w.id is null then raise exception 'That week does not exist'; end if;
  if not public.can_mark_placed(w) then
    raise exception 'Only whoever is on the hook, or the commish, can add the slip';
  end if;
  if coalesce(cardinality(p_paths), 0) = 0 then raise exception 'Pick at least one screenshot'; end if;
  foreach p in array p_paths loop
    if p not like w.league_id::text || '/' || w.id::text || '/%' then
      raise exception 'That screenshot isn''t for this week';
    end if;
  end loop;
  select coalesce(array_agg(x order by ord), '{}') into merged
  from (select x, min(ord) ord from unnest(w.slip_paths || p_paths) with ordinality t(x, ord) group by x) q;
  if cardinality(merged) > 10 then raise exception 'That''s more than 10 screenshots. Remove some first.'; end if;
  update public.weeks
  set slip_paths = merged, slip_path = merged[1],
      placed_at = coalesce(placed_at, now()), placed_by = coalesce(placed_by, auth.uid())
  where id = w.id;
end $$;

-- Remove one screenshot. Removing the last one means the bet isn't marked placed anymore.
create or replace function public.remove_slip(p_week uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  w public.weeks;
  rest text[];
begin
  select * into w from public.weeks where id = p_week;
  if w.id is null then raise exception 'That week does not exist'; end if;
  if not public.can_mark_placed(w) then
    raise exception 'Only whoever is on the hook, or the commish, can change the slip';
  end if;
  rest := array_remove(w.slip_paths, p_path);
  if cardinality(rest) = 0 then
    update public.weeks set slip_paths = '{}', slip_path = null, placed_at = null, placed_by = null where id = w.id;
  else
    update public.weeks set slip_paths = rest, slip_path = rest[1] where id = w.id;
  end if;
end $$;

-- Turns text into a uuid, or null if it isn't one. Used by the storage rules.
create or replace function public.uuid_or_null(t text) returns uuid
language sql immutable as $$
  select case when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid end
$$;

-- Slip screenshots: a private bucket. Files live at <league id>/<week id>/...
-- Members of that league can view and upload; nobody else can see them.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('slips', 'slips', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
    on conflict (id) do nothing;
    execute 'drop policy if exists "slips read" on storage.objects';
    execute $p$create policy "slips read" on storage.objects for select to authenticated
      using (bucket_id = 'slips' and public.is_member(public.uuid_or_null((storage.foldername(name))[1])))$p$;
    execute 'drop policy if exists "slips upload" on storage.objects';
    execute $p$create policy "slips upload" on storage.objects for insert to authenticated
      with check (bucket_id = 'slips' and public.is_member(public.uuid_or_null((storage.foldername(name))[1])))$p$;
    -- Removing a screenshot deletes the file: whoever's on the hook that week, or the commish.
    execute 'drop policy if exists "slips delete" on storage.objects';
    execute $p$create policy "slips delete" on storage.objects for delete to authenticated
      using (bucket_id = 'slips' and exists (
        select 1 from public.weeks w
        where w.id = public.uuid_or_null((storage.foldername(name))[2])
          and w.league_id = public.uuid_or_null((storage.foldername(name))[1])
          and public.can_mark_placed(w)))$p$;
  end if;
end $$;

-- New current weeks pick up the league's deadline automatically.
create or replace function public.weeks_fill_lock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lock_at is null
     and not exists (select 1 from public.weeks where league_id = new.league_id and n > new.n) then
    new.lock_at := public.next_lock(new.league_id, new.start_date);
  end if;
  return new;
end $$;
drop trigger if exists weeks_fill_lock on public.weeks;
create trigger weeks_fill_lock before insert on public.weeks
  for each row execute function public.weeks_fill_lock();

-- Commish tool: set (or turn off, with p_dow null) the weekly pick deadline.
-- Also re-times the current week.
create or replace function public.set_deadline(p_league uuid, p_dow int, p_time time, p_tz text)
returns void language plpgsql security definer set search_path = public as $$
declare
  cur_id uuid;
  cur_start date;
begin
  if not public.is_admin(p_league) then raise exception 'Only the commish can set the deadline'; end if;
  if p_dow is null then
    update public.leagues set lock_dow = null, lock_time = null where id = p_league;
  else
    if p_dow < 0 or p_dow > 6 or p_time is null then raise exception 'Pick a day and a time'; end if;
    begin
      perform now() at time zone p_tz;
    exception when others then
      raise exception 'Unknown time zone: %', p_tz;
    end;
    update public.leagues set lock_dow = p_dow, lock_time = p_time, lock_tz = p_tz where id = p_league;
  end if;
  select id, start_date into cur_id, cur_start from public.weeks where league_id = p_league order by n desc limit 1;
  if cur_id is not null then
    update public.weeks set lock_at = public.next_lock(p_league, cur_start) where id = cur_id;
  end if;
end $$;

-- Commish tool: delete a spin that a re-spin replaced. The latest spin for a
-- week is the one that decided who pays, so it can't be deleted.
create or replace function public.delete_spin(p_spin uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.spins;
begin
  select * into s from public.spins where id = p_spin;
  if s.id is null then raise exception 'That spin does not exist'; end if;
  if not public.is_admin(s.league_id) then raise exception 'Only the commish can delete spins'; end if;
  if not exists (select 1 from public.spins where week_id = s.week_id and created_at > s.created_at) then
    raise exception 'That''s the spin that counts. Only spins replaced by a re-spin can be deleted.';
  end if;
  delete from public.spins where id = s.id;
end $$;

-- Commish tool: change one week's deadline (null = no deadline that week).
create or replace function public.set_week_lock(p_week uuid, p_lock_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  w public.weeks;
begin
  select * into w from public.weeks where id = p_week;
  if w.id is null then raise exception 'That week does not exist'; end if;
  if not public.is_admin(w.league_id) then raise exception 'Only the commish can change the deadline'; end if;
  update public.weeks set lock_at = p_lock_at where id = w.id;
end $$;

-- ---------- Permissions on functions ---------------------------------

revoke execute on function
  public.create_league(text, numeric, text[], text, int),
  public.join_league(text),
  public.claim_player(uuid, uuid),
  public.assign_player(uuid, uuid, uuid),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.regenerate_invite(uuid),
  public.spin_wheel(uuid, uuid[]),
  public.start_next_week(uuid),
  public.new_season(uuid, int),
  public.set_week_number(uuid, int),
  public.save_past_week(uuid, uuid, int, date, uuid, jsonb),
  public.delete_past_week(uuid),
  public.reset_to_week(uuid, boolean),
  public.mark_placed(uuid, boolean, text),
  public.set_deadline(uuid, int, time, text),
  public.set_week_lock(uuid, timestamptz),
  public.delete_spin(uuid),
  public.add_slips(uuid, text[]),
  public.remove_slip(uuid, text),
  public.can_mark_placed(public.weeks),
  public.new_invite_code()
from public, anon;

grant execute on function
  public.create_league(text, numeric, text[], text, int),
  public.join_league(text),
  public.claim_player(uuid, uuid),
  public.assign_player(uuid, uuid, uuid),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.regenerate_invite(uuid),
  public.spin_wheel(uuid, uuid[]),
  public.start_next_week(uuid),
  public.new_season(uuid, int),
  public.set_week_number(uuid, int),
  public.save_past_week(uuid, uuid, int, date, uuid, jsonb),
  public.delete_past_week(uuid),
  public.reset_to_week(uuid, boolean),
  public.mark_placed(uuid, boolean, text),
  public.set_deadline(uuid, int, time, text),
  public.set_week_lock(uuid, timestamptz),
  public.delete_spin(uuid),
  public.add_slips(uuid, text[]),
  public.remove_slip(uuid, text),
  public.can_mark_placed(public.weeks)
to authenticated;

-- ---------- Live updates ---------------------------------------------
-- Lets every open phone update the moment someone adds a pick or spins.

do $$
declare t text;
begin
  foreach t in array array['leagues','players','members','weeks','legs','spins','reactions','comments'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

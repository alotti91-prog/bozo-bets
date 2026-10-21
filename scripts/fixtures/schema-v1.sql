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

create index if not exists players_league_idx on public.players (league_id);
create index if not exists weeks_league_idx   on public.weeks (league_id, n);
create index if not exists legs_league_idx    on public.legs (league_id);
create index if not exists legs_week_idx      on public.legs (week_id);
create index if not exists spins_league_idx   on public.spins (league_id, created_at);

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

  if not public.is_admin(w_league) then
    if tg_op = 'INSERT' then
      new.result := null;
    else
      if new.result is distinct from old.result then
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
  or (player_id = public.my_player(league_id) and result is null and week_id = public.latest_week_id(league_id))
);

-- Spins: members read. Only spin_wheel() writes them.
drop policy if exists "spin read" on public.spins;
create policy "spin read" on public.spins for select to authenticated using (public.is_member(league_id));

-- ---------- Functions the app calls ----------------------------------

-- Start a league: you become the owner, players are created, Week 1 opens.
create or replace function public.create_league(p_name text, p_stake numeric, p_players text[], p_my_name text default null)
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

  insert into public.weeks (league_id, n, stake) values (lid, 1, p_stake);
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

-- Spin the Bozo Wheel. The database picks the winner (not the spinner's
-- phone), logs the spin, and sets next week's payer. Spinning the previous
-- week again counts as a logged re-spin.
create or replace function public.spin_wheel(p_week uuid, p_pool uuid[])
returns public.spins language plpgsql security definer set search_path = public as $$
declare
  w public.weeks;
  latest int;
  pool uuid[];
  cnt int;
  b bytea;
  k int;
  s public.spins;
  next_id uuid;
begin
  select * into w from public.weeks where id = p_week;
  if w.id is null then raise exception 'That week does not exist'; end if;
  if not public.is_admin(w.league_id) then raise exception 'Only the commish can spin the wheel'; end if;

  select max(n) into latest from public.weeks where league_id = w.league_id;
  if w.n < latest - 1 then raise exception 'Only this week or last week can be spun'; end if;
  if w.n = latest then
    if not exists (select 1 from public.legs where week_id = w.id) then
      raise exception 'No legs this week yet';
    end if;
    if exists (select 1 from public.legs where week_id = w.id and result is null) then
      raise exception 'Grade every leg before spinning';
    end if;
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

  cnt := coalesce(array_length(pool, 1), 0);
  if cnt = 0 then raise exception 'Put at least one name in the wheel'; end if;

  b := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  k := ((get_byte(b, 0) * 16777216::bigint + get_byte(b, 1) * 65536 + get_byte(b, 2) * 256 + get_byte(b, 3)) % cnt)::int + 1;

  insert into public.spins (week_id, league_id, pool, landed_id, spun_by)
  values (w.id, w.league_id, pool, pool[k], auth.uid())
  returning * into s;

  select id into next_id from public.weeks where league_id = w.league_id and n = w.n + 1;
  if next_id is null then
    insert into public.weeks (league_id, n, stake, payer_id)
    select w.league_id, w.n + 1, l.stake, pool[k] from public.leagues l where l.id = w.league_id;
  else
    update public.weeks set payer_id = pool[k] where id = next_id;
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

-- Owner tool: wipe every week and start over at Week 1. Players stay.
create or replace function public.new_season(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_league) then raise exception 'Only the league owner can start a new season'; end if;
  delete from public.weeks where league_id = p_league;
  insert into public.weeks (league_id, n, stake) select p_league, 1, stake from public.leagues where id = p_league;
end $$;

-- ---------- Permissions on functions ---------------------------------

revoke execute on function
  public.create_league(text, numeric, text[], text),
  public.join_league(text),
  public.claim_player(uuid, uuid),
  public.assign_player(uuid, uuid, uuid),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.regenerate_invite(uuid),
  public.spin_wheel(uuid, uuid[]),
  public.start_next_week(uuid),
  public.new_season(uuid),
  public.new_invite_code()
from public, anon;

grant execute on function
  public.create_league(text, numeric, text[], text),
  public.join_league(text),
  public.claim_player(uuid, uuid),
  public.assign_player(uuid, uuid, uuid),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.regenerate_invite(uuid),
  public.spin_wheel(uuid, uuid[]),
  public.start_next_week(uuid),
  public.new_season(uuid)
to authenticated;

-- ---------- Live updates ---------------------------------------------
-- Lets every open phone update the moment someone adds a pick or spins.

do $$
declare t text;
begin
  foreach t in array array['leagues','players','members','weeks','legs','spins'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

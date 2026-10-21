-- =====================================================================
-- Bozo Bets: import 2026 Weeks 1-3 from the old Google Sheet
-- Paste this whole file into Supabase > SQL Editor and click Run.
--
-- What it does:
--   * matches the sheet's names to your league's players. If any don't match,
--     it stops and lists them so you don't end up with duplicates (see step 2)
--   * adds Weeks 1, 2 and 3 with every pick, odds and result
--   * renumbers the week you're on now so it comes after them (Week 7)
-- Everything happens together: if anything goes wrong, nothing changes.
-- Running it a second time stops with a message instead of doubling up.
-- Not in the sheet, so not imported: who paid each week and wheel spins.
-- =====================================================================

drop table if exists pg_temp.import_names, pg_temp.import_settings, pg_temp.import_picks, pg_temp.import_report;

-- 1) If a name in your league is spelled differently than in the sheet,
--    change the right-hand side to match your league. (Left = sheet.)
create temp table import_names (sheet_name text primary key, league_name text not null);
insert into import_names values
  ('Mori','Mori'), ('JB','JB'), ('Ted','Ted'), ('Ben','Ben'), ('Chris','Chris'),
  ('Lotti','Lotti'), ('Tim','Tim'), ('Alec','Alec'), ('Sexton','Sexton'), ('Disco','Disco');

-- 2) current_week: the number your league's open week should become.
--    add_missing: leave false the first time. If the run stops and lists names
--    that really are new players, change it to true and run again.
create temp table import_settings (current_week int not null, add_missing boolean not null);
insert into import_settings values (7, false);

-- 3) The picks, straight from the sheet. "P" = the gray void (Puka 70+);
--    its real odds weren't in the sheet, and voids don't count toward odds or records.
create temp table import_picks (week int, sheet_name text, pick text, odds int, result text);
insert into import_picks values
  (1,'Mori','Loveland 50+ Rec Yds',-137,'L'),
  (1,'JB','Giants +3',-108,'W'),
  (1,'Ted','Lamar o37.5 Rush Yds',-113,'W'),
  (1,'Ben','D. Watson u176.5 Pass Yds',-111,'L'),
  (1,'Chris','J. Chase 70+ Rec Yds',-228,'L'),
  (1,'Lotti','J. Cook Anytime TD',105,'L'),
  (1,'Alec','Achane 4+ Recs',-176,'W'),
  (1,'Disco','McBride 6+ Recs',-165,'W'),
  (2,'Mori','Saquon 70+ Rush Yds',-157,'L'),
  (2,'JB','B. Hall Anytime TD',-110,'L'),
  (2,'Ted','Henry o17.5 Longest Rush',-122,'L'),
  (2,'Ben','Deebo 40+ Rush/Rec Yds',-138,'L'),
  (2,'Chris','Puka 70+ (void)',-110,'P'),
  (2,'Lotti','Bengals +2.5',-102,'W'),
  (2,'Tim','Mayfield 200+ Pass Yds',-168,'L'),
  (2,'Alec','B. Hall 15+ Rec Yds',-174,'W'),
  (2,'Sexton','D. Metcalf 50+ Rec Yds',-154,'L'),
  (2,'Disco','Loveland 50+ Rec Yds',-135,'L'),
  (3,'Mori','J. Taylor Anytime TD',-165,'L'),
  (3,'JB','Giants/Titans u37.5',-103,'W'),
  (3,'Ted','Kincaid 50+ Rec Yds',-166,'L'),
  (3,'Ben','K. Walker 100+ Rush/Rec Yds',-200,'L'),
  (3,'Chris','G. Pickens 50+ Rec Yds',-150,'W'),
  (3,'Lotti','Browns +2.5',-102,'W'),
  (3,'Tim','Mahomes o1.5 Pass TDs',-205,'W'),
  (3,'Alec','R. Rice 40+ Rec Yds',-192,'W'),
  (3,'Sexton','J. Gibbs o35 Rec Yds',-113,'W'),
  (3,'Disco','B. Young 200+ Pass Yds',-191,'W');

create temp table import_report (player text, status text, picks int);

do $$
declare
  lid uuid;
  lstake numeric;
  n_leagues int;
  cur int;
  max_n int;
  min_n int;
  shift int;
  nm record;
  pid uuid;
  next_sort int;
  wk int;
  wid uuid;
  missing text;
  allow_new boolean;
  starts date[] := array['2026-09-09','2026-09-17','2026-09-24']::date[];
begin
  -- The picks go in directly, so pause the rule that stops members editing past
  -- weeks. It's switched back on at the end of this block; if anything fails,
  -- the whole block is undone, including this.
  execute 'alter table public.legs disable trigger legs_guard';

  select count(*) into n_leagues from public.leagues;
  if n_leagues <> 1 then
    raise exception 'Found % leagues. This import expects exactly one. Ask Claude to point it at the right league.', n_leagues;
  end if;
  select id, stake into lid, lstake from public.leagues limit 1;

  if exists (select 1 from public.weeks where league_id = lid and start_date < '2026-10-01') then
    raise exception 'Weeks from September 2026 are already in this league, so this import has already run. Nothing was changed.';
  end if;

  -- Stop before changing anything if some sheet names aren't in the league.
  select string_agg(trim(m.league_name), ', ' order by m.league_name) into missing
  from import_names m
  where m.sheet_name in (select distinct sheet_name from import_picks)
    and not exists (select 1 from public.players p where p.league_id = lid and lower(p.name) = lower(trim(m.league_name)));
  select add_missing into allow_new from import_settings;
  if missing is not null and not allow_new then
    raise exception 'These names from the sheet aren''t in your league: %. If someone is spelled differently in your league (say Tim vs Time), fix it in step 1. If they''re all new players, change false to true in step 2. Then run again. Nothing was changed.', missing;
  end if;

  -- Move the existing weeks so the latest one becomes the current week number.
  select current_week into cur from import_settings;
  select max(n), min(n) into max_n, min_n from public.weeks where league_id = lid;
  if max_n is not null then
    shift := cur - max_n;
    if min_n + shift <= 3 then
      raise exception 'Your league already has % weeks, so they can''t all fit after Week 3 with the current week as Week %. Nothing was changed.', (max_n - min_n + 1), cur;
    end if;
    update public.weeks set n = n + 1000 where league_id = lid;
    update public.weeks set n = n - 1000 + shift where league_id = lid;
  end if;

  -- Match or add players.
  select coalesce(max(sort), -1) + 1 into next_sort from public.players where league_id = lid;
  for nm in select m.sheet_name, m.league_name from import_names m
            where m.sheet_name in (select distinct sheet_name from import_picks) loop
    select id into pid from public.players where league_id = lid and lower(name) = lower(trim(nm.league_name));
    if pid is null then
      insert into public.players (league_id, name, sort) values (lid, trim(nm.league_name), next_sort) returning id into pid;
      next_sort := next_sort + 1;
      insert into import_report values (trim(nm.league_name), 'added to league', 0);
    else
      insert into import_report values (trim(nm.league_name), 'matched', 0);
    end if;
  end loop;

  -- Add the three weeks and their picks.
  for wk in 1..3 loop
    insert into public.weeks (league_id, n, start_date, stake)
    values (lid, wk, starts[wk], lstake) returning id into wid;

    insert into public.legs (week_id, league_id, player_id, pick, odds, sport, result)
    select wid, lid, p.id, ip.pick, ip.odds, 'NFL', ip.result
    from import_picks ip
    join import_names m on m.sheet_name = ip.sheet_name
    join public.players p on p.league_id = lid and lower(p.name) = lower(trim(m.league_name))
    where ip.week = wk;
  end loop;

  update import_report r set picks = (
    select count(*) from import_picks ip join import_names m on m.sheet_name = ip.sheet_name
    where lower(trim(m.league_name)) = lower(r.player));

  execute 'alter table public.legs enable trigger legs_guard';
end $$;

-- What happened. "added to league" means that name wasn't in your league yet.
select player, status, picks from import_report order by status desc, player;

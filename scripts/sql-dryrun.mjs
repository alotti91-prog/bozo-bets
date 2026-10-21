// Runs supabase/schema.sql against an in-memory Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema, then checks the security
// rules and the wheel function behave. Usage: npm run test:sql
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const db = new PGlite();

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to authenticated, anon;
  create publication supabase_realtime;
`);

await db.exec(schema);
await db.exec(`
  grant usage on schema public to authenticated, anon;
  grant select, insert, update, delete on all tables in schema public to authenticated;
`);

const A = '00000000-0000-4000-8000-00000000000a'; // owner
const B = '00000000-0000-4000-8000-00000000000b'; // friend
const C = '00000000-0000-4000-8000-00000000000c'; // stranger
await db.exec(`insert into auth.users values ('${A}','a@x.com'),('${B}','b@x.com'),('${C}','c@x.com')`);

async function as(uid, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`,
      [uid, JSON.stringify({ sub: uid, email: uid.slice(-1) + '@x.com' })]);
    await tx.exec('set local role authenticated');
    return tx.query(sql, params);
  });
}
async function fails(uid, sql, params, pattern) {
  let err = null;
  try { await as(uid, sql, params); } catch (e) { err = e; }
  assert.ok(err, `expected failure: ${sql}`);
  if (pattern) assert.match(err.message, pattern, err.message);
}

let passed = 0;
const ok = (label) => { passed++; console.log('  ✓ ' + label); };

// Owner creates a league
const lid = (await as(A, `select public.create_league('Bozo Bets', 10, array['Lotti','Sully','Mikey'], 'Lotti') as id`)).rows[0].id;
assert.ok(lid); ok('owner creates a league');
const code = (await as(A, `select invite_code from public.leagues where id = $1`, [lid])).rows[0].invite_code;
assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/); ok('invite code is 6 clean characters');

const players = Object.fromEntries((await as(A, `select id, name from public.players where league_id = $1`, [lid])).rows.map((r) => [r.name, r.id]));
const week1 = (await as(A, `select id from public.weeks where league_id = $1 and n = 1`, [lid])).rows[0].id;
assert.equal((await as(A, `select player_id from public.members where user_id = $1`, [A])).rows[0].player_id, players.Lotti);
ok('owner is linked to their player and Week 1 exists');

// Stranger sees nothing
assert.equal((await as(C, `select * from public.leagues`)).rows.length, 0);
assert.equal((await as(C, `select * from public.legs`)).rows.length, 0);
await fails(C, `insert into public.legs (week_id, league_id, player_id, pick, odds) values ($1,$2,$3,'x',-110)`, [week1, lid, players.Mikey]);
ok('non-members can’t read or write');

// Friend joins and claims a name
await fails(B, `select public.join_league('ZZZZZZ')`, [], /didn't match/);
assert.equal((await as(B, `select public.join_league($1) as id`, [code.toLowerCase()])).rows[0].id, lid);
await fails(B, `select public.claim_player($1, $2)`, [lid, players.Lotti], /already claimed/);
await as(B, `select public.claim_player($1, $2)`, [lid, players.Sully]);
ok('friend joins with code (any case) and claims an unclaimed name');

// Friend adds own leg, can't add for others, can't grade
await as(B, `insert into public.legs (week_id, league_id, player_id, pick, odds, sport) values ($1,$2,$3,'Lions -3.5',-110,'NFL')`, [week1, lid, players.Sully]);
await fails(B, `insert into public.legs (week_id, league_id, player_id, pick, odds) values ($1,$2,$3,'Bills ML',-180)`, [week1, lid, players.Mikey]);
await fails(B, `update public.legs set result = 'W' where player_id = $1`, [players.Sully], /commish/);
await as(B, `update public.legs set pick = 'Lions -2.5' where player_id = $1`, [players.Sully]);
ok('friend adds and edits only their own pick, can’t grade');

// Owner adds legs for others and grades
await as(A, `insert into public.legs (week_id, league_id, player_id, pick, odds) values ($1,$2,$3,'Bills ML',-180),($1,$2,$4,'Over 44.5',-110)`, [week1, lid, players.Mikey, players.Lotti]);
await fails(B, `select public.spin_wheel($1, array[$2]::uuid[])`, [week1, players.Mikey], /commish/);
await fails(A, `select public.spin_wheel($1, array[$2]::uuid[])`, [week1, players.Mikey], /Grade every leg/);
await as(A, `update public.legs set result = 'W' where week_id = $1`, [week1]);
await as(A, `update public.legs set result = 'L' where week_id = $1 and player_id in ($2, $3)`, [week1, players.Mikey, players.Lotti]);
ok('commish adds legs for anyone and grades; spin waits for grading');

// Graded leg is locked for the friend
await as(B, `delete from public.legs where player_id = $1`, [players.Sully]); // RLS silently matches 0 rows
const stillThere = (await as(A, `select count(*)::int as c from public.legs where player_id = $1`, [players.Sully])).rows[0].c;
assert.equal(stillThere, 1); ok('graded picks are locked for regular members');

// Spin: database picks a name from the pool, opens Week 2 with that payer
const pool = [players.Mikey, players.Lotti];
const spin = (await as(A, `select * from public.spin_wheel($1, $2::uuid[])`, [week1, pool])).rows[0];
assert.ok(pool.includes(spin.landed_id));
const w2 = (await as(A, `select id, payer_id from public.weeks where league_id = $1 and n = 2`, [lid])).rows[0];
assert.equal(w2.payer_id, spin.landed_id); ok('spin picks from the pool and sets Week 2’s payer');

// Friend can't add to the closed week, can add to Week 2
await fails(B, `insert into public.legs (week_id, league_id, player_id, pick, odds) values ($1,$2,$3,'Late pick',-110)`, [week1, lid, players.Sully]);
await as(B, `insert into public.legs (week_id, league_id, player_id, pick, odds) values ($1,$2,$3,'Packers +3',-105)`, [w2.id, lid, players.Sully]);
ok('last week is closed to members; this week is open');

// Re-spin of last week is logged and updates the payer
const spin2 = (await as(A, `select * from public.spin_wheel($1, $2::uuid[])`, [week1, pool])).rows[0];
const spins = (await as(B, `select count(*)::int as c from public.spins where week_id = $1`, [week1])).rows[0].c;
assert.equal(spins, 2);
assert.equal((await as(A, `select payer_id from public.weeks where id = $1`, [w2.id])).rows[0].payer_id, spin2.landed_id);
ok('re-spins are logged and update the payer');

// Wheel fairness smoke test: 600 spins over 3 names, each lands a fair share
const pool3 = [players.Lotti, players.Sully, players.Mikey];
const counts = { [players.Lotti]: 0, [players.Sully]: 0, [players.Mikey]: 0 };
for (let i = 0; i < 600; i++) {
  const r = (await as(A, `select landed_id from public.spin_wheel($1, $2::uuid[])`, [week1, pool3])).rows[0];
  counts[r.landed_id]++;
}
Object.values(counts).forEach((c) => assert.ok(c > 140 && c < 260, 'uneven wheel: ' + JSON.stringify(counts)));
ok('wheel lands evenly (600 test spins: ' + Object.values(counts).join(' / ') + ')');

// Roles: only owner changes roles; promoted admin can grade
await fails(B, `select public.set_member_role($1, $2, 'admin')`, [lid, B], /owner/);
await as(A, `select public.set_member_role($1, $2, 'admin')`, [lid, B]);
await as(B, `update public.legs set result = 'W' where week_id = $1`, [w2.id]);
await fails(A, `select public.set_member_role($1, $2, 'member')`, [lid, A], /owner/);
ok('owner promotes a co-commish; owner role is protected');

// ---- Starting mid-season, renumbering, and past weeks -------------------
const lid2 = (await as(A, `select public.create_league('Late Start', 10, array['Lotti','Sully','Mikey'], 'Lotti', 7) as id`)).rows[0].id;
const p2 = Object.fromEntries((await as(A, `select id, name from public.players where league_id = $1`, [lid2])).rows.map((r) => [r.name, r.id]));
assert.deepEqual((await as(A, `select n from public.weeks where league_id = $1`, [lid2])).rows.map((r) => r.n), [7]);
ok('a league can start at Week 7');
await fails(A, `select public.create_league('Bad', 10, array['a','b'], null, 0)`, [], /between 1 and 30/);

const code2 = (await as(A, `select invite_code from public.leagues where id = $1`, [lid2])).rows[0].invite_code;
await as(B, `select public.join_league($1)`, [code2]);
await as(B, `select public.claim_player($1, $2)`, [lid2, p2.Sully]);
const legs3 = JSON.stringify([
  { player_id: p2.Lotti, pick: 'Bills -3', odds: -110, result: 'W' },
  { player_id: p2.Sully, pick: 'Lions ML', odds: -150, result: 'L' },
]);
await fails(B, `select public.save_past_week($1, null, 3, '2026-09-24', null, $2::jsonb)`, [lid2, legs3], /commish/);
await fails(A, `select public.save_past_week($1, null, 7, '2026-09-24', null, $2::jsonb)`, [lid2, legs3], /before this week/);
await fails(A, `select public.save_past_week($1, null, 3, null, null, $2::jsonb)`, [lid2, JSON.stringify([{ player_id: p2.Lotti, pick: 'x', odds: -110 }])], /needs a result/);
const w3 = (await as(A, `select public.save_past_week($1, null, 3, '2026-09-24', $2, $3::jsonb) as id`, [lid2, p2.Mikey, legs3])).rows[0].id;
const got = (await as(B, `select pick, result from public.legs where week_id = $1 order by pick`, [w3])).rows;
assert.deepEqual(got, [{ pick: 'Bills -3', result: 'W' }, { pick: 'Lions ML', result: 'L' }]);
assert.equal((await as(B, `select payer_id from public.weeks where id = $1`, [w3])).rows[0].payer_id, p2.Mikey);
ok('commish adds a past week with graded picks and a payer; members can read it');
await fails(A, `select public.save_past_week($1, null, 3, null, null, '[]'::jsonb)`, [lid2], /already in the league/);

const legs3b = JSON.stringify([{ player_id: p2.Mikey, pick: 'Over 44', odds: 120, result: 'W' }]);
await as(A, `select public.save_past_week($1, $2, null, null, null, $3::jsonb)`, [lid2, w3, legs3b]);
const got2 = (await as(A, `select pick from public.legs where week_id = $1`, [w3])).rows.map((r) => r.pick);
assert.deepEqual(got2, ['Over 44']);
ok('editing a past week replaces its picks');

await as(B, `update public.legs set result = 'L' where week_id = $1`, [w3]); // row-level security matches 0 rows
assert.equal((await as(A, `select result from public.legs where week_id = $1`, [w3])).rows[0].result, 'W');
ok('members still can\u2019t change past-week results');

await fails(A, `select public.set_week_number($1, 3)`, [lid2], /after Week 3/);
await as(A, `select public.set_week_number($1, 8)`, [lid2]);
assert.deepEqual((await as(A, `select n from public.weeks where league_id = $1 order by n`, [lid2])).rows.map((r) => r.n), [3, 8]);
await fails(B, `select public.set_week_number($1, 9)`, [lid2], /commish/);
ok('commish renumbers the current week; it must stay after past weeks');

// Wheel with a gap: spin Week 8, then re-spin it. Re-spin must not invent the week in between.
const cur8 = (await as(A, `select id from public.weeks where league_id = $1 and n = 8`, [lid2])).rows[0].id;
await as(A, `insert into public.legs (week_id, league_id, player_id, pick, odds, result) values ($1,$2,$3,'a',-110,'L')`, [cur8, lid2, p2.Lotti]);
await as(A, `select public.spin_wheel($1, $2::uuid[])`, [cur8, [p2.Lotti]]);
await as(A, `select public.spin_wheel($1, $2::uuid[])`, [cur8, [p2.Lotti]]);
assert.deepEqual((await as(A, `select n from public.weeks where league_id = $1 order by n`, [lid2])).rows.map((r) => r.n), [3, 8, 9]);
await fails(A, `select public.spin_wheel($1, $2::uuid[])`, [w3, [p2.Lotti]], /this week or last week/);
ok('wheel works across week-number gaps');

await fails(A, `select public.delete_past_week((select id from public.weeks where league_id = $1 and n = 9))`, [lid2], /current week/);
await fails(B, `select public.delete_past_week($1)`, [w3], /commish/);
await as(A, `select public.delete_past_week($1)`, [w3]);
assert.deepEqual((await as(A, `select n from public.weeks where league_id = $1 order by n`, [lid2])).rows.map((r) => r.n), [8, 9]);
ok('commish deletes a past week; the current week is protected');

await as(A, `select public.new_season($1, 1)`, [lid2]);
assert.deepEqual((await as(A, `select n from public.weeks where league_id = $1`, [lid2])).rows.map((r) => r.n), [1]);
ok('new season can start at any week');

// ---- Reactions and "bet placed" -----------------------------------------
const C2 = '00000000-0000-4000-8000-0000000000c2';
await db.exec(`insert into auth.users values ('${C2}','c2@x.com')`);
const lid3 = (await as(A, `select public.create_league('Reacts', 10, array['Lotti','Sully','Mikey'], 'Lotti', 7) as id`)).rows[0].id;
const p3 = Object.fromEntries((await as(A, `select id, name from public.players where league_id = $1`, [lid3])).rows.map((r) => [r.name, r.id]));
const code3 = (await as(A, `select invite_code from public.leagues where id = $1`, [lid3])).rows[0].invite_code;
await as(B, `select public.join_league($1)`, [code3]);
await as(B, `select public.claim_player($1, $2)`, [lid3, p3.Sully]);
const wk7 = (await as(A, `select id from public.weeks where league_id = $1`, [lid3])).rows[0].id;
const legL = (await as(A, `insert into public.legs (week_id, league_id, player_id, pick, odds) values ($1,$2,$3,'Bills -3',-110) returning id`, [wk7, lid3, p3.Lotti])).rows[0].id;

await as(B, `insert into public.reactions (leg_id, emoji) values ($1, '🤡')`, [legL]);
await as(A, `insert into public.reactions (leg_id, emoji) values ($1, '🔥')`, [legL]);
const rx = (await as(A, `select emoji, user_id, league_id from public.reactions where leg_id = $1 order by emoji`, [legL])).rows;
assert.equal(rx.length, 2);
assert.ok(rx.every((r) => r.league_id === lid3));
assert.equal(rx.find((r) => r.emoji === '🤡').user_id, B);
await fails(B, `insert into public.reactions (leg_id, emoji) values ($1, '🤡')`, [legL], /duplicate/);
await fails(B, `insert into public.reactions (leg_id, emoji) values ($1, '🍕')`, [legL]);
await fails(C2, `insert into public.reactions (leg_id, emoji) values ($1, '💀')`, [legL]);
assert.equal((await as(C2, `select count(*)::int c from public.reactions`)).rows[0].c, 0);
await as(B, `delete from public.reactions where leg_id = $1`, [legL]); // only removes B's own
assert.deepEqual((await as(A, `select emoji from public.reactions where leg_id = $1`, [legL])).rows.map((r) => r.emoji), ['🔥']);
ok('reactions: members react and un-react with their own, strangers can’t see or add');

await fails(B, `select public.mark_placed($1, true, null)`, [wk7], /on the hook/);
await as(A, `update public.weeks set payer_id = $2 where id = $1`, [wk7, p3.Sully]);
await fails(B, `select public.mark_placed($1, true, 'some-other-league/x.jpg')`, [wk7], /isn't in this league/);
await as(B, `select public.mark_placed($1, true, $2)`, [wk7, `${lid3}/${wk7}/slip.jpg`]);
let pw = (await as(A, `select placed_at, placed_by, slip_path from public.weeks where id = $1`, [wk7])).rows[0];
assert.ok(pw.placed_at); assert.equal(pw.placed_by, B); assert.equal(pw.slip_path, `${lid3}/${wk7}/slip.jpg`);
await as(A, `select public.mark_placed($1, false, null)`, [wk7]);
pw = (await as(A, `select placed_at, slip_path from public.weeks where id = $1`, [wk7])).rows[0];
assert.equal(pw.placed_at, null); assert.equal(pw.slip_path, null);
ok('bet placed: the payer or commish marks it (with a screenshot path in their league); others can’t');

// ---- Pick deadline ---------------------------------------------------------
const lid4 = (await as(A, `select public.create_league('Deadline', 10, array['Lotti','Sully','Mikey'], 'Lotti', 7) as id`)).rows[0].id;
const p4 = Object.fromEntries((await as(A, `select id, name from public.players where league_id = $1`, [lid4])).rows.map((r) => [r.name, r.id]));
const code4 = (await as(A, `select invite_code from public.leagues where id = $1`, [lid4])).rows[0].invite_code;
await as(B, `select public.join_league($1)`, [code4]);
await as(B, `select public.claim_player($1, $2)`, [lid4, p4.Sully]);
const w7 = (await as(A, `select id from public.weeks where league_id = $1`, [lid4])).rows[0].id;
assert.equal((await as(A, `select lock_at from public.weeks where id = $1`, [w7])).rows[0].lock_at, null);

await fails(B, `select public.set_deadline($1, 0, '12:55', 'America/New_York')`, [lid4], /commish/);
await fails(A, `select public.set_deadline($1, 0, '12:55', 'Mars/Olympus')`, [lid4], /time zone/);
await as(A, `select public.set_deadline($1, 0, '12:55', 'America/New_York')`, [lid4]);
const lk = (await as(A, `select lock_at, extract(dow from lock_at at time zone 'America/New_York')::int dow,
  to_char(lock_at at time zone 'America/New_York', 'HH24:MI') hm, lock_at > now() future, lock_at <= now() + interval '7 days' soon
  from public.weeks where id = $1`, [w7])).rows[0];
assert.equal(lk.dow, 0); assert.equal(lk.hm, '12:55'); assert.ok(lk.future); assert.ok(lk.soon);
ok('commish sets a weekly deadline; this week locks on the next Sunday 12:55 PM Eastern');

await as(B, `insert into public.legs (week_id, league_id, player_id, pick, odds) values ($1,$2,$3,'Lions ML',-150)`, [w7, lid4, p4.Sully]);
ok('members can add picks before the deadline');

await as(A, `select public.set_week_lock($1, now() - interval '1 minute')`, [w7]);
await fails(B, `update public.legs set pick = 'Lions -3' where player_id = $1`, [p4.Sully], /locked/);
await fails(B, `insert into public.legs (week_id, league_id, player_id, pick, odds) values ($1,$2,$3,'Late',-110)`, [w7, lid4, p4.Mikey]);
await as(B, `delete from public.legs where player_id = $1`, [p4.Sully]); // blocked by the rules: 0 rows
assert.equal((await as(A, `select count(*)::int c from public.legs where week_id = $1`, [w7])).rows[0].c, 1);
await as(A, `insert into public.legs (week_id, league_id, player_id, pick, odds) values ($1,$2,$3,'Commish add',-110)`, [w7, lid4, p4.Mikey]);
ok('after the deadline members can’t add, edit, or remove; the commish still can');

await fails(B, `select public.set_week_lock($1, null)`, [w7], /commish/);
await as(A, `select public.set_week_lock($1, null)`, [w7]);
await as(B, `update public.legs set pick = 'Lions -3' where player_id = $1`, [p4.Sully]);
ok('commish can turn off one week’s deadline');

// Next week opened by a spin picks up the rule automatically, in the future.
await as(A, `update public.legs set result = 'L' where week_id = $1`, [w7]);
await as(A, `select public.spin_wheel($1, $2::uuid[])`, [w7, [p4.Sully]]);
const w8 = (await as(A, `select lock_at, lock_at > now() future, extract(dow from lock_at at time zone 'America/New_York')::int dow from public.weeks where league_id = $1 and n = 8`, [lid4])).rows[0];
assert.ok(w8.lock_at && w8.future); assert.equal(w8.dow, 0);
ok('a week opened by the wheel gets the next deadline on its own');

await as(A, `select public.set_deadline($1, null, null, null)`, [lid4]);
assert.equal((await as(A, `select lock_at from public.weeks where league_id = $1 and n = 8`, [lid4])).rows[0].lock_at, null);
ok('turning the deadline off clears it for the current week');

// ---- Re-running the setup file, and upgrading from the first version ----
const before = (await db.query(`select (select count(*) from public.legs)::int legs, (select count(*) from public.weeks)::int weeks`)).rows[0];
await db.exec(schema);
const afterRun = (await db.query(`select (select count(*) from public.legs)::int legs, (select count(*) from public.weeks)::int weeks`)).rows[0];
assert.deepEqual(afterRun, before);
ok('running the setup file again keeps all data');

const v1 = readFileSync(new URL('./fixtures/schema-v1.sql', import.meta.url), 'utf8');
const old = new PGlite();
await old.exec(`
  create role anon nologin; create role authenticated nologin; create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to authenticated, anon; create publication supabase_realtime;`);
await old.exec(v1);
await old.exec(`grant usage on schema public to authenticated, anon; grant select, insert, update, delete on all tables in schema public to authenticated; insert into auth.users values ('${A}','a@x.com');`);
const asOld = (uid, sql, params = []) => old.transaction(async (tx) => {
  await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
  await tx.exec('set local role authenticated');
  return tx.query(sql, params);
});
const oldLid = (await asOld(A, `select public.create_league('Old', 10, array['Lotti','Sully'], 'Lotti') as id`)).rows[0].id;
await old.exec(schema);
await asOld(A, `select public.set_week_number($1, 7)`, [oldLid]);
assert.deepEqual((await asOld(A, `select n from public.weeks where league_id = $1`, [oldLid])).rows.map((r) => r.n), [7]);
const fns = (await old.query(`select count(*)::int c from pg_proc where proname = 'create_league'`)).rows[0].c;
assert.equal(fns, 1);
ok('upgrading a database set up with the first version works, with no duplicate functions');

// ---- Slip screenshot storage rules, against a stand-in for Supabase Storage ----
const st = new PGlite();
await st.exec(`
  create role anon nologin; create role authenticated nologin; create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to authenticated, anon; create publication supabase_realtime;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language plpgsql as $$
    declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts,1)-1]; end $$;
  grant usage on schema storage to authenticated; grant select, insert on storage.objects to authenticated;`);
await st.exec(schema);
await st.exec(schema); // re-runnable, including the storage block
await st.exec(`grant usage on schema public to authenticated, anon; grant select, insert, update, delete on all tables in schema public to authenticated;
  insert into auth.users values ('${A}','a@x.com'), ('${C2}','c2@x.com');`);
const asSt = (uid, sql, params = []) => st.transaction(async (tx) => {
  await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
  await tx.exec('set local role authenticated');
  return tx.query(sql, params);
});
const bucket = (await st.query(`select public, file_size_limit from storage.buckets where id = 'slips'`)).rows[0];
assert.equal(bucket.public, false);
const sl = (await asSt(A, `select public.create_league('S', 10, array['a','b'], 'a') as id`)).rows[0].id;
await asSt(A, `insert into storage.objects (bucket_id, name) values ('slips', $1)`, [`${sl}/w/slip.jpg`]);
let stErr = null; try { await asSt(C2, `insert into storage.objects (bucket_id, name) values ('slips', $1)`, [`${sl}/w/evil.jpg`]); } catch (e) { stErr = e; }
assert.ok(stErr, 'stranger upload should be refused');
stErr = null; try { await asSt(A, `insert into storage.objects (bucket_id, name) values ('slips', 'not-a-uuid/x.jpg')`); } catch (e) { stErr = e; }
assert.ok(stErr, 'upload outside a league folder should be refused');
assert.equal((await asSt(A, `select count(*)::int c from storage.objects`)).rows[0].c, 1);
assert.equal((await asSt(C2, `select count(*)::int c from storage.objects`)).rows[0].c, 0);
ok('slip screenshots: private bucket; only league members can upload or view, and only in their league’s folder');

console.log(`\n${passed} checks passed.`);

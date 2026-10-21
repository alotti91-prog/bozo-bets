// Runs supabase/schema.sql, makes a league the way the app would, then runs
// the 2026 Weeks 1-3 import and checks the result. Usage: node scripts/import-dryrun.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const imp = readFileSync(new URL('../supabase/imports/2026-weeks-1-3.sql', import.meta.url), 'utf8');
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to authenticated, anon; create publication supabase_realtime;`);
await db.exec(schema);
await db.exec(`grant usage on schema public to authenticated, anon; grant select, insert, update, delete on all tables in schema public to authenticated;`);
const A = '00000000-0000-4000-8000-00000000000a';
await db.exec(`insert into auth.users values ('${A}','a@x.com')`);
async function as(uid, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [uid, JSON.stringify({ sub: uid })]);
    await tx.exec('set local role authenticated');
    return tx.query(sql, params);
  });
}
let passed = 0; const ok = (m) => { passed++; console.log('  ✓ ' + m); };

// League as it might exist now: some sheet names, one typo, and a pick already in the current week.
const lid = (await as(A, `select public.create_league('Bozo Bets', 10, array['Lotti','Stoosk','Mori','Alec','Time','JB'], 'Lotti') as id`)).rows[0].id;
const wk1 = (await as(A, `select id from public.weeks where league_id = $1`, [lid])).rows[0].id;
const lotti = (await as(A, `select id from public.players where name = 'Lotti'`)).rows[0].id;
await as(A, `insert into public.legs (week_id, league_id, player_id, pick, odds) values ($1,$2,$3,'Bills -3',-110)`, [wk1, lid, lotti]);

// First run: stops and lists the names that aren't in the league, changing nothing.
let first = null; try { await db.exec(imp); } catch (e) { first = e; }
assert.ok(first && /Ben, Chris, Disco, Sexton, Ted, Tim/.test(first.message), String(first && first.message));
assert.equal((await db.query(`select count(*)::int c from public.weeks`)).rows[0].c, 1);
assert.equal((await db.query(`select count(*)::int c from public.players`)).rows[0].c, 6);
assert.equal((await db.query(`select tgenabled from pg_trigger where tgname = 'legs_guard'`)).rows[0].tgenabled, 'O');
ok('first run lists unmatched names and changes nothing');

// Second run with add_missing switched on, the way the user would edit it.
const imp2 = imp.replace('values (7, false)', 'values (7, true)');
assert.notEqual(imp2, imp);
const res = await db.exec(imp2);
const report = res[res.length - 1].rows;
console.log(report.map((r) => `    ${r.player}: ${r.status} (${r.picks})`).join('\n'));
const added = report.filter((r) => r.status === 'added to league').map((r) => r.player).sort();
assert.deepEqual(added, ['Ben', 'Chris', 'Disco', 'Sexton', 'Ted', 'Tim']);
ok('adds missing players and matches existing ones');

const weeks = (await db.query(`select n, start_date::text d, (select count(*)::int from public.legs l where l.week_id = w.id) c from public.weeks w where league_id = $1 order by n`, [lid])).rows;
assert.deepEqual(weeks.map((w) => w.n), [1, 2, 3, 7]);
assert.deepEqual(weeks.map((w) => w.c), [8, 10, 10, 1]);
assert.equal(weeks[0].d, '2026-09-09');
ok('weeks 1-3 imported with 8/10/10 picks; current week is now Week 7 with its pick intact');

const graded = (await db.query(`select count(*)::int c from public.legs where result is not null`)).rows[0].c;
assert.equal(graded, 28); ok('all 28 imported results kept (the guard trigger was paused)');

const trig = (await db.query(`select tgenabled from pg_trigger where tgname = 'legs_guard'`)).rows[0].tgenabled;
assert.equal(trig, 'O'); ok('guard trigger is back on');

let err = null; try { await db.exec(imp2); } catch (e) { err = e; }
assert.ok(err && /already run/.test(err.message), String(err && err.message));
const after = (await db.query(`select count(*)::int c from public.legs`)).rows[0].c;
assert.equal(after, 29);
const trig2 = (await db.query(`select tgenabled from pg_trigger where tgname = 'legs_guard'`)).rows[0].tgenabled;
assert.equal(trig2, 'O'); ok('running it twice stops with a message and changes nothing');

console.log(`\n${passed} checks passed.`);

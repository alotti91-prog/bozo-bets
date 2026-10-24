// Vercel serverless function: GET /api/health
// Checks the app's outside connections and says which one is broken. An uptime
// monitor (UptimeRobot) opens this every few minutes and emails the commish
// when it stops returning 200. Read-only: it never writes anything. Prop lines
// are reported but never fail it (see below).
import { espnUrl, normalizeScoreboard } from '../src/lib/espn.js';
import { SLEEPER_STATE } from '../src/lib/depth.js';

const env = (...names) => names.map((n) => process.env[n]).find(Boolean) || '';

async function check(fn) {
  try { return (await fn()) || 'ok'; } catch (e) { return e.message || 'failed'; }
}

const timeout = () => AbortSignal.timeout(8000);

export async function runChecks(now = new Date()) {
  const supabase = check(async () => {
    const url = env('VITE_SUPABASE_URL', 'SUPABASE_URL');
    const key = env('VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
    if (!url || !key) throw new Error('Supabase settings are missing in Vercel');
    // A real database read. With the public key, row-level security returns no rows, but a 200 proves the database answered.
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/leagues?select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: timeout() });
    if (!r.ok) throw new Error(`Supabase answered ${r.status}${r.status === 540 || r.status === 503 ? ' (project may be paused)' : ''}`);
    return 'ok';
  });
  const espn = check(async () => {
    const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const r = await fetch(espnUrl({ kind: 'scoreboard', sport: 'nfl', dates: d }), { headers: { accept: 'application/json' }, signal: timeout() });
    if (!r.ok) throw new Error(`ESPN answered ${r.status}`);
    const json = await r.json();
    if (!Array.isArray(json?.events)) throw new Error('ESPN’s scoreboard changed shape');
    if (json.events.length && !normalizeScoreboard(json, 'nfl').length) throw new Error('Couldn’t read teams from ESPN’s scoreboard');
    return 'ok';
  });
  // Sleeper (depth charts for player props). Its tiny "state" call, never the 5MB player list.
  const sleeper = check(async () => {
    const r = await fetch(SLEEPER_STATE, { headers: { accept: 'application/json' }, signal: timeout() });
    if (!r.ok) throw new Error(`Sleeper answered ${r.status}`);
    const json = await r.json();
    if (!json?.season) throw new Error('Sleeper’s state changed shape');
    return 'ok';
  });
  const checks = { supabase: await supabase, espn: await espn, sleeper: await sleeper };
  const ok = Object.values(checks).every((v) => v === 'ok');
  // Prop lines (SportsGameOdds): only whether the key is set. Calling them would use up the
  // free plan's monthly allowance every few minutes, and the app works without them anyway.
  checks.props = (process.env.SPORTSGAMEODDS_KEY || '').trim() ? 'ok' : 'not set up';
  return { ok, checks, at: now.toISOString() };
}

export default async function handler(req, res) {
  const result = await runChecks();
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
  return res.status(result.ok ? 200 : 503).json(result);
}

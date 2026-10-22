// Live scores for the app. Goes through our /api/espn function (cached on
// Vercel), or fake games in demo mode. In `npm run dev` there's no /api, so it
// asks ESPN directly.
import { espnUrls, mergeEvents, weekDates, normalizeScoreboard, normalizeSummary, normalizeRoster } from './espn.js';
import { demoScores } from './demo-supabase.js';

async function direct(params) {
  const urls = espnUrls(params);
  const jsons = await Promise.all(urls.map((u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
  const json = urls.length > 1 ? mergeEvents(jsons) : jsons[0];
  if (params.kind === 'scoreboard') return { games: normalizeScoreboard(json, params.sport) };
  if (params.kind === 'summary') return normalizeSummary(json, params.sport, params.event);
  return { players: normalizeRoster(json) };
}

async function get(params) {
  if (demoScores) return demoScores(params);
  let r;
  try { r = await fetch(`/api/espn?${new URLSearchParams(params)}`); } catch { throw new Error('Can’t reach the scores right now.'); }
  if (r.ok && (r.headers.get('content-type') || '').includes('json')) return r.json();
  if (import.meta.env.DEV) return direct(params);
  const b = await r.json().catch(() => null);
  throw new Error(b?.error || 'Scores aren’t available right now.');
}

/** This betting week's games for a sport, by kickoff. */
export const getGames = (sport, dates = weekDates()) =>
  get({ kind: 'scoreboard', sport, dates }).then((b) => [...b.games].sort((a, c) => String(a.start).localeCompare(String(c.start))));

/** One game, with player stats once it's started. */
export const getGame = (sport, event) => get({ kind: 'summary', sport, event });

const rosters = new Map();
/** A team's skill players, remembered for the session. */
export function getRoster(sport, team) {
  const k = `${sport}:${team}`;
  if (!rosters.has(k)) rosters.set(k, get({ kind: 'roster', sport, team }).then((b) => b.players).catch((e) => { rosters.delete(k); throw e; }));
  return rosters.get(k);
}

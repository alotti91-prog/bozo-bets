// Live scores for the app. Goes through our /api/espn function (cached on
// Vercel), or fake games in demo mode. In `npm run dev` there's no /api, so it
// asks ESPN directly.
import { espnUrls, mergeEvents, weekDates, normalizeScoreboard, normalizeSummary, normalizeRoster } from './espn.js';
import { demoScores, demoDepth } from './demo-supabase.js';

async function direct(params) {
  const urls = espnUrls(params);
  const jsons = await Promise.all(urls.map((u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
  const json = urls.length > 1 ? mergeEvents(jsons) : jsons[0];
  if (params.kind === 'scoreboard') return { games: normalizeScoreboard(json, params.sport) };
  if (params.kind === 'summary') return normalizeSummary(json, params.sport, params.event);
  return { players: normalizeRoster(json) };
}

// Whether the live feed is answering. Two failures in a row with no success
// counts as down (one blip doesn't). The app listens for 'bz-feed' to warn admins.
let fails = 0;
export const feedDown = () => fails >= 2;
function note(ok) {
  const was = feedDown();
  fails = ok ? 0 : fails + 1;
  if (was !== feedDown()) window.dispatchEvent(new Event('bz-feed'));
}

async function get(params) {
  try {
    const out = await fetchScores(params);
    note(true);
    return out;
  } catch (e) {
    note(false);
    throw e;
  }
}

async function fetchScores(params) {
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

let depth = null;
/**
 * NFL depth charts and injuries ({ espnId: { o, s } }, from Sleeper via /api/depth),
 * fetched once per session. Resolves to null for other sports, in `npm run dev`
 * (no /api), or if Sleeper's down: the prop picker then lists everyone, A–Z.
 */
export function getDepth(sport) {
  if (sport !== 'nfl') return Promise.resolve(null);
  if (!depth) {
    depth = (demoDepth ? Promise.resolve(demoDepth()) : fetch('/api/depth').then((r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : null)))
      .then((b) => b?.players || null)
      .catch(() => null)
      .then((d) => { if (!d) depth = null; return d; }); // try again next time if it failed
  }
  return depth;
}

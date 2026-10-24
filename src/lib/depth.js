// NFL depth charts and injuries from Sleeper's free public API (no key; free for
// non-commercial use: https://docs.sleeper.com). Its player list is about 5MB and
// Sleeper asks that it be pulled once a day at most, so our /api/depth function
// fetches it, keeps only what the prop picker needs, and lets Vercel cache it for
// a day. Pure functions, covered by logic.test.js.

export const SLEEPER_PLAYERS = 'https://api.sleeper.app/v1/players/nfl';
export const SLEEPER_STATE = 'https://api.sleeper.app/v1/state/nfl'; // tiny: used by the health check

const SKILL = ['QB', 'RB', 'WR', 'TE', 'FB'];

/**
 * Sleeper's player map → { [espnId]: { o, s } } for skill players on a team:
 * o = depth chart order (1 = starter, null if unknown), s = injury status
 * ("Questionable", "Out", ...) or null. Keyed by ESPN id so it lines up with the
 * ESPN rosters and live stats the app already uses.
 */
export function normalizeDepth(json) {
  const out = {};
  if (!json || typeof json !== 'object') return out;
  for (const p of Object.values(json)) {
    const pos = p?.position || p?.fantasy_positions?.[0];
    const espn = p?.espn_id == null ? '' : String(p.espn_id).trim();
    if (!espn || !p.team || !SKILL.includes(pos)) continue;
    const o = Number(p.depth_chart_order);
    out[espn] = { o: Number.isInteger(o) && o > 0 ? o : null, s: p.injury_status || null };
  }
  return out;
}

const TAGS = { Questionable: 'Q', Doubtful: 'D', Out: 'Out', IR: 'IR', PUP: 'PUP', Sus: 'Susp' };

/** A short tag for an injury status, like DraftKings shows: "Q", "D", "Out", "IR". '' when healthy. */
export function injuryTag(s) {
  if (!s || s === 'NA' || s === 'Active') return '';
  return TAGS[s] || String(s).slice(0, 4);
}

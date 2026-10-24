// NFL depth charts and injuries from Sleeper's free public API (no key; free for
// non-commercial use: https://docs.sleeper.com). Its player list is about 5MB and
// Sleeper asks that it be pulled once a day at most, so our /api/depth function
// fetches it, keeps only what the prop picker needs, and lets Vercel cache it for
// a day. Pure functions, covered by logic.test.js.

export const SLEEPER_PLAYERS = 'https://api.sleeper.app/v1/players/nfl';
export const SLEEPER_STATE = 'https://api.sleeper.app/v1/state/nfl'; // tiny: used by the health check

const SKILL = ['QB', 'RB', 'WR', 'TE', 'FB'];

/**
 * A name made comparable across ESPN and Sleeper: "A.J. Brown", "Marvin Harrison
 * Jr." and "D'Andre Swift" → "aj brown", "marvin harrison", "dandre swift".
 */
export function nameKey(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[.'’`-]/g, '').replace(/[^a-z ]/g, ' ')
    .split(/\s+/).filter((w) => w && !['jr', 'sr', 'ii', 'iii', 'iv', 'v'].includes(w)).join(' ');
}

/**
 * Sleeper's player map → { [key]: { o, s } } for skill players on a team:
 * o = depth chart order (1 = starter, null if unknown), s = injury status
 * ("Questionable", "Out", ...) or null. Each player is keyed by ESPN id (when
 * Sleeper has it) and by "n:" + nameKey, since Sleeper only has ESPN ids for
 * some players. A name two players share is left out rather than guessed.
 */
export function normalizeDepth(json) {
  const out = {};
  if (!json || typeof json !== 'object') return out;
  const shared = new Set();
  for (const p of Object.values(json)) {
    const pos = p?.position || p?.fantasy_positions?.[0];
    if (!p?.team || !SKILL.includes(pos)) continue;
    const o = Number(p.depth_chart_order);
    const info = { o: Number.isInteger(o) && o > 0 ? o : null, s: p.injury_status || null };
    const espn = p.espn_id == null ? '' : String(p.espn_id).trim();
    if (espn) out[espn] = info;
    const n = nameKey(p.full_name || `${p.first_name || ''} ${p.last_name || ''}`);
    if (!n || shared.has(n)) continue;
    if (out[`n:${n}`]) { delete out[`n:${n}`]; shared.add(n); continue; }
    out[`n:${n}`] = info;
  }
  return out;
}

/** Depth info for an ESPN roster player ({ id, name }): by ESPN id, else by name. */
export function depthOf(depth, p) {
  if (!depth || !p) return null;
  return depth[p.id] || depth[`n:${nameKey(p.name)}`] || null;
}

/**
 * The injury status to show on a slip leg ("Questionable", "Out", ...), or null.
 * Only NFL player props, only ungraded legs, only until the game kicks off
 * (after that the injury report is old news), and only statuses with a tag.
 *   st  the leg's live status from liveStatus(), or null when the feed has nothing
 */
export function legInjury(leg, st, depth, now = Date.now()) {
  const b = leg?.bet;
  if (!b?.player || b.sport !== 'nfl' || leg.result || !depth) return null;
  const started = st ? st.tone !== 'pre' : !!b.game?.start && Date.parse(b.game.start) <= now;
  if (started) return null;
  const s = depthOf(depth, b.player)?.s;
  return injuryTag(s) ? s : null;
}

const TAGS = { Questionable: 'Q', Doubtful: 'D', Out: 'Out', IR: 'IR', PUP: 'PUP', Sus: 'Susp' };

/** A short tag for an injury status, like DraftKings shows: "Q", "D", "Out", "IR". '' when healthy. */
export function injuryTag(s) {
  if (!s || s === 'NA' || s === 'Active') return '';
  return TAGS[s] || String(s).slice(0, 4);
}

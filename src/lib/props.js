// DraftKings player prop lines, from SportsGameOdds (sportsgameodds.com), free
// "Amateur" plan: 2,500 games' worth of odds a month, 10 requests a minute, and
// every response counts as at least one game, even an empty one. So /api/props
// asks for one game at a time, only the stats our picker offers, and the CDN
// keeps each game's lines for 30 minutes. Pure functions, covered by props.test.js.
import { nameKey } from './depth.js';
import { STATS } from './bets.js';

export const SGO_EVENTS = 'https://api.sportsgameodds.com/v2/events';
export const BOOK = 'draftkings';

// ESPN's NFL abbreviations → full team names (SportsGameOdds team ids are built from these).
export const NFL_TEAMS = {
  ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens', BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers', CHI: 'Chicago Bears', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys', DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers',
  HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars', KC: 'Kansas City Chiefs',
  LAC: 'Los Angeles Chargers', LAR: 'Los Angeles Rams', LV: 'Las Vegas Raiders', MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings', NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants',
  NYJ: 'New York Jets', PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers', SEA: 'Seattle Seahawks',
  SF: 'San Francisco 49ers', TB: 'Tampa Bay Buccaneers', TEN: 'Tennessee Titans', WSH: 'Washington Commanders',
};

// Our prop stats (bets.js STATS) → SportsGameOdds stat ids. Anytime TD is a yes/no market.
export const SGO_STAT = {
  passYds: 'passing_yards', passTd: 'passing_touchdowns', passCmp: 'passing_completions', int: 'passing_interceptions',
  rushYds: 'rushing_yards', rushAtt: 'rushing_attempts', rushRecYds: 'rushing+receiving_yards',
  recYds: 'receiving_yards', rec: 'receiving_receptions', td: 'touchdowns',
};
const FROM_SGO = Object.fromEntries(Object.entries(SGO_STAT).map(([k, v]) => [v, k]));

/** "Chicago Bears" → "CHICAGO_BEARS_NFL", SportsGameOdds' team id style (a guess; findEvent falls back to names). */
export const sgoTeamID = (abbr) => (NFL_TEAMS[abbr] ? `${NFL_TEAMS[abbr].toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_NFL` : null);

/** Kickoff rounded down to the hour, as the app sends it (so every phone asks for the same, cacheable URL). */
export function hourOf(start) {
  const t = Date.parse(start);
  if (!Number.isFinite(t)) return null;
  return new Date(Math.floor(t / 3600000) * 3600000).toISOString().replace('.000Z', 'Z');
}

/**
 * Checks /api/props?home=CHI&away=NE&start=2026-10-26T00:00Z. Anything else is
 * refused, so nobody can run up our monthly allowance with made-up URLs.
 * Returns { home, away, start (ms) } or { error }.
 */
export function parsePropsQuery(query = {}, now = Date.now()) {
  const keys = Object.keys(query);
  if (keys.some((k) => !['home', 'away', 'start'].includes(k))) return { error: 'Unknown setting in the address.' };
  const { home, away, start } = query;
  if (!NFL_TEAMS[home] || !NFL_TEAMS[away] || home === away) return { error: 'Pick an NFL game.' };
  const t = Date.parse(start);
  if (!/^\d{4}-\d\d-\d\dT\d\d:00(:00)?Z$/.test(String(start)) || !Number.isFinite(t)) return { error: 'Kickoff time should be on the hour, in UTC.' };
  if (t < now - 12 * 3600000 || t > now + 10 * 86400000) return { error: 'That game isn’t coming up.' };
  return { home, away, start: t };
}

/** Every oddID our picker can use, for any player (PLAYER_ID is SportsGameOdds' wildcard). */
export function propOddIDs() {
  return Object.entries(SGO_STAT).flatMap(([stat, id]) => (STATS[stat].yesNo
    ? [`${id}-PLAYER_ID-game-yn-yes`]
    : [`${id}-PLAYER_ID-game-ou-over`, `${id}-PLAYER_ID-game-ou-under`]));
}

/**
 * The SportsGameOdds request for one game. 'team' asks by the home team's id
 * (one game back, the cheapest); 'window' asks for every NFL game kicking off
 * around then (used only if the team id guess finds nothing).
 */
export function propsUrl(q, mode = 'team') {
  const p = new URLSearchParams({
    leagueID: 'NFL',
    bookmakerID: BOOK,
    oddID: propOddIDs().join(','),
    startsAfter: new Date(q.start - 3 * 3600000).toISOString(),
    startsBefore: new Date(q.start + 4 * 3600000).toISOString(),
    limit: mode === 'team' ? '3' : '20',
  });
  if (mode === 'team') p.set('teamID', sgoTeamID(q.home));
  return `${SGO_EVENTS}?${p}`;
}

const low = (s) => String(s || '').toLowerCase();
function sameTeam(t, abbr) {
  if (!t) return false;
  const full = low(NFL_TEAMS[abbr]);
  const nick = full.split(' ').pop();
  const names = [t.teamID, t.names?.long, t.names?.medium, t.names?.short].map(low);
  return low(t.teamID) === low(sgoTeamID(abbr)) || names.includes(full) || names.includes(nick) || names.includes(low(abbr));
}

/** The event for this game (home and away both match) from a SportsGameOdds response, or null. */
export function findEvent(json, q) {
  const list = Array.isArray(json?.data) ? json.data : [];
  return list.find((e) => sameTeam(e?.teams?.home, q.home) && sameTeam(e?.teams?.away, q.away)) || null;
}

const amer = (v) => { // "-115", "+120", "even", 120 → -115, 120, 100, 120
  if (v == null || v === '') return null;
  const s = String(v).trim().toLowerCase().replace('−', '-');
  if (s === 'even' || s === 'ev') return 100;
  const n = Number(s.replace(/^\+/, ''));
  return Number.isFinite(n) && Math.abs(n) >= 100 ? Math.round(n) : null;
};
const num = (v) => { const n = Number(v); return v == null || v === '' || !Number.isFinite(n) ? null : n; };

/**
 * One game's DraftKings prop lines, keyed by player name (nameKey, so it lines up
 * with ESPN's rosters): { 'dj moore': { recYds: { l: 62.5, o: -115, u: -105 }, td: { y: 165 } } }.
 * Skips markets DraftKings has closed, and anything without a price.
 */
export function normalizeProps(event, book = BOOK) {
  const out = {};
  const players = event?.players || {};
  for (const o of Object.values(event?.odds || {})) {
    const stat = FROM_SGO[o?.statID];
    if (!stat || (o.periodID && o.periodID !== 'game')) continue;
    const p = players[o.playerID] || players[o.statEntityID];
    const name = p?.name || [p?.firstName, p?.lastName].filter(Boolean).join(' ');
    const bk = o.byBookmaker?.[book];
    const price = amer(bk?.odds);
    if (!name || !bk || bk.available === false || price == null) continue;
    const e = (out[nameKey(name)] ||= {});
    if (STATS[stat].yesNo) {
      if (o.betTypeID === 'yn' && o.sideID === 'yes') e[stat] = { y: price };
      continue;
    }
    const line = num(bk.overUnder ?? o.bookOverUnder);
    if (o.betTypeID !== 'ou' || line == null) continue;
    const cur = e[stat];
    if (o.sideID === 'over') e[stat] = { ...(cur?.l === line ? cur : {}), l: line, o: price };
    else if (o.sideID === 'under' && (!cur || cur.l === line)) e[stat] = { ...(cur || { l: line }), u: price };
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => Object.keys(v).length));
}

/** DraftKings' line for a player and stat, or null. lines: normalizeProps() output. */
export const lineFor = (lines, player, stat) => (lines && player && stat ? lines[nameKey(player.name)]?.[stat] || null : null);

/**
 * DraftKings' price for a prop built in the picker: the anytime TD price, or the
 * over/under price when the number matches DraftKings' line. null otherwise.
 */
export function propPrice(b, lines) {
  if (b?.type !== 'prop') return null;
  const e = lineFor(lines, b.player, b.stat);
  if (!e) return null;
  if (STATS[b.stat].yesNo) return e.y ?? null;
  if (Number(b.lineText) !== e.l || !b.lineText) return null;
  return (b.side === 'over' ? e.o : b.side === 'under' ? e.u : null) ?? null;
}

/** "62.5" for a line, "+165" for an anytime TD: what the player list shows next to a name. */
export function lineLabel(e) {
  if (!e) return '';
  if (e.l != null) return String(e.l);
  return e.y != null ? (e.y > 0 ? `+${e.y}` : `−${Math.abs(e.y)}`) : '';
}

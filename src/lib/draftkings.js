// Bet it on DraftKings: put the week's legs on a DraftKings betslip with one
// tap. ESPN's DraftKings board carries DraftKings' own id for each main-line
// pick (oddsBoard().dk in espn.js), and SportsGameOdds does for some props when
// DraftKings gives it a link (normalizeProps() in props.js). One link with
// several ids joined by "+" puts them all on the slip (tested on a phone,
// 2026-10-24: three games). Pure functions, covered by draftkings.test.js; the
// sheet is screens/week/DraftKingsSheet.jsx.
import { STATS } from './bets.js';
import { lineFor } from './props.js';

export const DK_HOME = 'https://sportsbook.draftkings.com/';

/** Why a leg has to be added by hand, for the sheet. */
export const DK_WHY = {
  typed: 'Typed in, so add it by hand',
  started: 'Game has started',
  moved: 'Line moved',
  missing: 'Not on DraftKings’ board here',
};

/**
 * Where one leg stands for DraftKings:
 *   { id, price }        ready: DraftKings' id at the leg's line, and its current price (null if unknown)
 *   { why, line? }       add it by hand (DK_WHY key; for 'moved', DraftKings' line now)
 * game: the leg's game from the scoreboard (with odds.board), if found; lines: that game's prop lines, if any.
 */
export function dkLeg(leg, game, lines) {
  const b = leg.bet;
  if (!b?.game) return { why: 'typed' };
  if (!game) return { why: 'missing' };
  if (game.state && game.state !== 'pre') return { why: 'started' };
  if (b.type === 'prop') {
    const e = lineFor(lines, b.player, b.stat);
    if (!e) return { why: 'missing' };
    if (STATS[b.stat]?.yesNo) return e.yi ? { id: e.yi, price: e.y ?? null } : { why: 'missing' };
    if (e.l !== b.line) return { why: 'moved', line: e.l };
    const id = b.side === 'over' ? e.oi : b.side === 'under' ? e.ui : null;
    return id ? { id, price: (b.side === 'over' ? e.o : e.u) ?? null } : { why: 'missing' };
  }
  const bd = game.odds?.board;
  if (!bd) return { why: 'missing' };
  const dk = bd.dk || {};
  if (b.type === 'ml') {
    const id = dk.ml?.[b.side];
    return id ? { id, price: bd.ml?.[b.side] ?? null } : { why: 'missing' };
  }
  if (b.type === 'spread') {
    const s = bd.spread?.[b.side];
    if (!s) return { why: 'missing' };
    if (s.line !== b.line) return { why: 'moved', line: s.line };
    const id = dk.spread?.[b.side];
    return id ? { id, price: s.price ?? null } : { why: 'missing' };
  }
  if (b.type === 'total') {
    const t = bd.total;
    if (!t) return { why: 'missing' };
    if (t.line !== b.line) return { why: 'moved', line: t.line };
    const id = b.side === 'over' ? dk.over : b.side === 'under' ? dk.under : null;
    return id ? { id, price: t[b.side] ?? null } : { why: 'missing' };
  }
  return { why: 'missing' };
}

/** The link that opens DraftKings with these picks on the slip (the app, when it's installed). */
export const dkUrl = (ids) => `${DK_HOME}?outcomes=${[...new Set(ids)].map(encodeURIComponent).join('+')}`;

/**
 * The whole slip for DraftKings, in the slip's order.
 *   gameOf(leg)   the leg's scoreboard game, or undefined
 *   linesOf(leg)  its game's prop lines, or null
 * Returns {
 *   ready:   [{ leg, id, price, was }]   was = the app's odds when DraftKings' price differs, else null
 *   manual:  [{ leg, why, line }]
 *   url:     the link, or null when nothing can go over
 *   sameGame: whether two or more legs share a game (DraftKings prices those together, so its total won't match ours)
 * }
 */
export function dkSlip(legs, gameOf, linesOf = () => null) {
  const ready = [];
  const manual = [];
  for (const leg of legs) {
    if (leg.result) continue; // already settled
    const r = dkLeg(leg, gameOf(leg), linesOf(leg));
    if (r.id) ready.push({ leg, id: r.id, price: r.price, was: r.price != null && r.price !== leg.odds ? leg.odds : null });
    else manual.push({ leg, why: r.why, line: r.line ?? null });
  }
  const games = legs.filter((l) => !l.result && l.bet?.game?.id).map((l) => `${l.bet.sport}:${l.bet.game.id}`);
  return { ready, manual, url: ready.length ? dkUrl(ready.map((r) => r.id)) : null, sameGame: new Set(games).size < games.length };
}

/** Odds to save before placing: [{ id, odds }] for ready legs whose DraftKings price differs from the app's. */
export const dkPriceChanges = (slip) => slip.ready.filter((r) => r.was != null).map((r) => ({ id: r.leg.id, odds: r.price }));

// The weekly recap: how a settled week went, with a clown face for each person.
// Pure functions, covered by recap.test.js.
import { weekInfo, money, dollars } from './odds.js';

/** What each face is called, best to worst. */
export const FACES = { clean: 'Clean', paint: 'Face paint', makeup: 'Makeup’s on', wig: 'Wig’s on', full: 'Full bozo' };
const RANK = { full: 0, wig: 1, makeup: 2, paint: 3, clean: 4 };
const RESULT = { W: 'won', L: 'lost', P: 'pushed' };
const EMOJI = { full: '🤡', wig: '🌈', makeup: '💄', paint: '🎨', clean: '😎' };
const TIER_FACE = { close: 'paint', normal: 'makeup', blowout: 'wig' };

// How far off a lost leg has to be, in the bet's own units. Missing by at most
// `close` is a close call; by at least `blowout` is a blowout.
//   Football: a hook (1 point), a field goal on a moneyline (3), two touchdowns (14)
//   NBA: 2 points, 3 on a moneyline, 15
//   NHL: one goal, 3 goals.  MLB: one run, 5 runs.
const CUTOFFS = {
  nfl: { close: 1, closeMl: 3, blowout: 14 },
  ncaaf: { close: 1, closeMl: 3, blowout: 14 },
  nba: { close: 2, closeMl: 3, blowout: 15 },
  nhl: { close: 1, closeMl: 1, blowout: 3 },
  mlb: { close: 1, closeMl: 1, blowout: 5 },
};

/**
 * The cutoffs for one bet, or null when a miss is just a miss. Player props
 * scale with the line: within 10% (at least 1) is close, half the line or more
 * is a blowout. Small lines (TDs, a few catches) have no close call.
 */
export function cutoffs(bet) {
  if (!bet) return null;
  if (bet.type === 'prop') {
    const line = Math.abs(Number(bet.line));
    return line >= 5 ? { close: Math.max(1, line * 0.1), blowout: line * 0.5 } : null;
  }
  const c = CUTOFFS[bet.sport];
  return c ? { close: bet.type === 'ml' ? c.closeMl : c.close, blowout: c.blowout } : null;
}

/**
 * How bad a lost leg was: 'close' | 'normal' | 'blowout'. The commish's pick
 * (legs.miss, for legs the app can't measure) comes first; otherwise legs.margin
 * (saved with the grade, negative = missed by) against the cutoffs. Anything
 * else counts as 'normal'.
 */
export function lossTier(leg) {
  if (leg.miss === 'close' || leg.miss === 'blowout') return leg.miss;
  const c = cutoffs(leg.bet);
  const missed = leg.margin == null ? NaN : -Number(leg.margin);
  if (!c || !(missed > 0)) return 'normal';
  if (missed <= c.close) return 'close';
  if (missed >= c.blowout) return 'blowout';
  return 'normal';
}

/**
 * Whether the commish picks how bad a lost leg was by hand: a typed leg, or a
 * picked leg that was graded without a final score (no margin saved).
 */
export function needsMissPick(leg) {
  return leg.result === 'L' && (!leg.bet || leg.margin == null);
}

/**
 * What the commish typed for "lost by" → the margin to save (negative), null
 * when it's empty, or undefined when it isn't a sensible number.
 */
export function marginFromLostBy(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  if (!t) return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return undefined;
  const n = Number(t);
  return n > 0 ? -n : undefined;
}

/**
 * Everything the recap shows for one week, or null if it can't show yet: the
 * week isn't fully graded, or its spin hasn't been watched (spin.hidden).
 * Faces:
 *   full    the wheel's pick, in a week that busted
 *   wig     your leg lost in a blowout
 *   makeup  your leg lost, or you had no leg and were in the wheel
 *   paint   your leg lost, but only just (a close call)
 *   clean   your leg won or pushed
 * people is sorted worst face first, then in player order.
 */
export function weekRecap({ weeks, legs, spins, players }, weekId) {
  const week = weeks.find((w) => w.id === weekId);
  if (!week) return null;
  const wl = legs.filter((l) => l.week_id === week.id);
  const info = weekInfo(week, wl);
  if (!info.settled || !info.graded) return null;
  const ws = spins.filter((s) => s.week_id === week.id);
  const spin = ws[ws.length - 1] || null; // a re-spin replaces earlier ones
  if (spin?.hidden) return null;
  const bozo = spin ? spin.landed_id : null;
  const next = weeks.filter((w) => w.n > week.n).sort((a, b) => a.n - b.n)[0] || null;

  const order = new Map(players.map((p, i) => [p.id, i]));
  const ids = [...new Set([...wl.map((l) => l.player_id), ...(spin ? spin.pool : [])])];
  const people = ids.map((id) => {
    const mine = wl.filter((l) => l.player_id === id);
    const lost = mine.filter((l) => l.result === 'L').map((l) => TIER_FACE[lossTier(l)]);
    const worst = lost.sort((a, b) => RANK[a] - RANK[b])[0];
    const face = id === bozo && info.status === 'busted' ? 'full' : worst || (!mine.length ? 'makeup' : 'clean');
    return { id, legs: mine, face };
  }).sort((a, b) => RANK[a.face] - RANK[b.face] || (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));

  const ways = new Set(wl.map((l) => l.player_id)).size;
  return {
    week, info, spin, bozo, people,
    hits: wl.filter((l) => l.result === 'W').length,
    total: wl.length,
    each: info.status === 'hit' && ways ? info.payout / ways : 0,
    nextN: next ? next.n : week.n + 1,
    stake: Number(next ? next.stake : week.stake),
  };
}

const num = (n) => String(Math.round(Math.abs(n) * 10) / 10);

/** One line about a person's week: "Bills −6.5 · missed by 0.5", "Steelers ML · lost", or "Didn’t pick". */
export function personLine(p) {
  if (!p.legs.length) return 'Didn’t pick';
  return p.legs.map((l) => {
    if (l.result === 'L' && l.margin != null && Number(l.margin) < 0) {
      return `${l.pick} · ${l.bet?.type === 'ml' ? 'lost' : 'missed'} by ${num(l.margin)}`;
    }
    return `${l.pick} · ${RESULT[l.result] || 'pending'}`;
  }).join(', ');
}

/** The recap as text for the group chat. */
export function recapText(r, pname, leagueName = 'Bozo Bets') {
  const lines = [`${leagueName.toUpperCase()} · Week ${r.week.n} recap`];
  if (r.info.status === 'hit') lines.push(`It hit! ${dollars(r.info.stake)} paid ${money(r.info.payout)} (${money(r.each)} each).`);
  else lines.push(`Busted. ${r.hits} of ${r.total} legs hit. Would’ve paid ${money(r.info.projected)}.`);
  if (r.bozo) lines.push(`${pname(r.bozo)} is the bozo. Puts in Week ${r.nextN}’s ${dollars(r.stake)}.`);
  lines.push('');
  r.people.forEach((p) => lines.push(`${EMOJI[p.face]} ${pname(p.id)}: ${personLine(p)}`));
  return lines.join('\n');
}

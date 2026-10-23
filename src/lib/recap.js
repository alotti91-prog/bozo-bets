// The weekly recap: how a settled week went, with a clown face for each person.
// Pure functions, covered by recap.test.js.
import { weekInfo, money, dollars } from './odds.js';

/** What each face is called. */
export const FACES = { clean: 'Clean', makeup: 'Makeup’s on', full: 'Full bozo' };
const RANK = { full: 0, makeup: 1, clean: 2 };
const RESULT = { W: 'won', L: 'lost', P: 'pushed' };
const EMOJI = { full: '🤡', makeup: '💄', clean: '😎' };

/**
 * Everything the recap shows for one week, or null if it can't show yet: the
 * week isn't fully graded, or its spin hasn't been watched (spin.hidden).
 * Faces:
 *   full    the wheel's pick, in a week that busted
 *   makeup  your leg lost, or you had no leg and were in the wheel
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
    const lost = mine.some((l) => l.result === 'L');
    const face = id === bozo && info.status === 'busted' ? 'full' : lost || !mine.length ? 'makeup' : 'clean';
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

/** One line about a person's week: "Steelers ML · lost", or "Didn’t pick". */
export function personLine(p) {
  if (!p.legs.length) return 'Didn’t pick';
  return p.legs.map((l) => `${l.pick} · ${RESULT[l.result] || 'pending'}`).join(', ');
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

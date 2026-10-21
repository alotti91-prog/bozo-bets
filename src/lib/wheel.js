// Which state the wheel is in, and the angle math. Pure, covered by wheel.test.js.
import { weekInfo } from './odds.js';

export const TAU = Math.PI * 2;

/**
 * What the Wheel tab shows.
 *   'none'    no weeks yet
 *   'ready'   a settled week is waiting to be spun (target). Usually this week,
 *             once every leg is graded; its spin opens next week. If last week
 *             settled but was never spun (a league that started mid-season, or a
 *             week opened without spinning), that's the target instead, and its
 *             spin decides who pays for this week.
 *   'waiting' nothing to spin yet; shows last week's result (last) if there is one
 * nextN is the week the person the wheel lands on pays for.
 */
export function wheelContext({ weeks, legs, spins, players = [] }) {
  const cur = weeks[weeks.length - 1];
  if (!cur) return { mode: 'none' };
  const prev = weeks[weeks.length - 2] || null;
  const legsOf = (w) => legs.filter((l) => l.week_id === w.id);
  const spinsOf = (w) => spins.filter((s) => s.week_id === w.id);
  const settled = (w) => { const ls = legsOf(w); return ls.length > 0 && ls.every((l) => l.result); };

  const curLegs = legsOf(cur);
  const curInfo = weekInfo(cur, curLegs);
  const prevSpins = prev ? spinsOf(prev) : [];
  const last = prevSpins.length ? { week: prev, spin: prevSpins[prevSpins.length - 1], count: prevSpins.length } : null;

  let target = null;
  let nextN = null;
  if (settled(cur) && !spinsOf(cur).length) { target = cur; nextN = cur.n + 1; }
  else if (prev && !prevSpins.length && settled(prev)) { target = prev; nextN = cur.n; }

  if (!target) return { mode: 'waiting', week: cur, info: curInfo, legs: curLegs, losers: [], noShows: [], last };

  const legsT = target === cur ? curLegs : legsOf(target);
  const info = target === cur ? curInfo : weekInfo(target, legsT);
  const losers = [...new Set(info.losers.map((l) => l.player_id))];
  // Active players with no leg that week. They go in the wheel by default too.
  const noShows = players.filter((p) => p.active && !legsT.some((l) => l.player_id === p.id)).map((p) => p.id);
  return { mode: 'ready', week: cur, target, nextN, info, legs: legsT, losers, noShows, last };
}

/**
 * The spin this person hasn't seen: the latest one, if it was for last week
 * (so it decided this week's bozo) and they didn't spin it or watch it.
 * views is the list of spin ids they've watched, or null if that isn't set up
 * (then nothing is hidden). watched holds spins watched since the last load.
 */
export function unwatchedSpin({ weeks, spins, views }, userId, watched = new Set()) {
  if (!views) return null;
  const last = spins[spins.length - 1];
  const prev = weeks[weeks.length - 2];
  if (!last || !prev || last.week_id !== prev.id) return null;
  if (last.spun_by === userId || views.includes(last.id) || watched.has(last.id)) return null;
  return last;
}

/**
 * League data with that spin's result hidden: that week's spins are flagged
 * (replaced ones too, so you can't work it out by elimination) and the payer
 * it set is blanked.
 */
export function hideSpin(data, spin) {
  const w = data.weeks.find((x) => x.id === spin.week_id);
  const next = w && data.weeks.filter((x) => x.n > w.n).sort((a, b) => a.n - b.n)[0];
  return {
    ...data,
    spins: data.spins.map((s) => (s.week_id === spin.week_id ? { ...s, hidden: true } : s)),
    weeks: data.weeks.map((x) => (x === next && x.payer_id === spin.landed_id ? { ...x, payer_id: null, payer_hidden: true } : x)),
  };
}

/** Which segment sits under the pointer (top) at rotation r. */
export function indexAt(r, n) {
  const a = (((-r) % TAU) + TAU) % TAU;
  return Math.floor(a / (TAU / n)) % n;
}

/** Final rotation that lands segment k under the pointer, offset f (0..1) into it, after `turns` full turns. */
export function targetRotation(start, n, k, f, turns) {
  const seg = TAU / n;
  const a = (k + f) * seg;
  const now = ((start % TAU) + TAU) % TAU;
  const target = (((TAU - a) % TAU) + TAU) % TAU;
  const delta = (((target - now) % TAU) + TAU) % TAU;
  return start + turns * TAU + delta;
}

/** Rotation that centres segment k under the pointer. */
export function restRotation(n, k) {
  return -(k + 0.5) * (TAU / n);
}

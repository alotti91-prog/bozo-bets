// Which state the wheel is in, and the angle math. Pure, covered by wheel.test.js.
import { weekInfo } from './odds.js';

export const TAU = Math.PI * 2;

/**
 * 'none'    no weeks yet
 * 'ready'   the current week is fully graded and can be spun
 * 'waiting' the current week isn't graded yet; shows last week's result if any
 */
export function wheelContext({ weeks, legs, spins }) {
  const c = weeks[weeks.length - 1];
  if (!c) return { mode: 'none' };
  const cl = legs.filter((l) => l.week_id === c.id);
  const info = weekInfo(c, cl);
  const prev = weeks[weeks.length - 2];
  const prevSpins = prev ? spins.filter((s) => s.week_id === prev.id) : [];
  const last = prevSpins.length ? { week: prev, spin: prevSpins[prevSpins.length - 1], count: prevSpins.length } : null;
  const losers = [...new Set(info.losers.map((l) => l.player_id))];
  return { mode: info.graded ? 'ready' : 'waiting', week: c, info, losers, last, legs: cl };
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

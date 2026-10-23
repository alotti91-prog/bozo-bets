// Swipe left/right to change tabs. Pure, covered by logic.test.js.

/**
 * Which way a finished touch moved: 'next' (finger went left), 'prev' (went
 * right), or null when it wasn't a clear, quick sideways swipe. Starts near the
 * screen edge are left alone, because Safari uses those for "back".
 */
export function swipeDirection({ dx, dy, dt, startX, width }) {
  const EDGE = 24;
  if (startX < EDGE || startX > width - EDGE) return null;
  if (dt > 600) return null; // slow drags are usually reading or selecting
  if (Math.abs(dx) < 70) return null;
  if (Math.abs(dx) < 2 * Math.abs(dy)) return null; // mostly vertical: scrolling
  return dx < 0 ? 'next' : 'prev';
}

/** The tab a swipe lands on, or null at either end (no wrapping). */
export function swipeTarget(tabs, current, dir) {
  const i = tabs.indexOf(current);
  const j = dir === 'next' ? i + 1 : dir === 'prev' ? i - 1 : i;
  return i < 0 || j < 0 || j >= tabs.length || j === i ? null : tabs[j];
}

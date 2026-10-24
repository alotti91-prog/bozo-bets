// Auto-grading: the commish's app grades picked legs on its own once their game
// is final, saving the margin like a hand grade. Typed legs never auto-grade,
// and a few finals wait for a person (see autoCheck). Pure functions, covered by
// sweat.test.js; the app side is in screens/WeekTab.jsx.
import { STATS, suggestedGrade, gradeMargin } from './bets.js';

/** Why a final leg waits for the commish, in a few words (for the slip) and in full (for the leg's panel). */
export const WHY = {
  absent: ['not in the box score', 'isn’t in the box score. DraftKings voids props for players who don’t play, so grade it a push if he sat.'],
  close: ['within a yard of the line', 'Finished within a yard of the line, and official stats can differ by a yard. Check DraftKings before grading.'],
};

/**
 * What auto-grading would do with one leg, given its live status:
 *   { result, margin }  grade it (the game is Final and decided)
 *   { why }             it's final, but a person should look (WHY key)
 *   null                not ours to grade: typed, already graded, or not Final
 *                       (still going, postponed, suspended, canceled)
 */
export function autoCheck(leg, s) {
  if (leg.result || !leg.bet?.game || !s?.done || !/^final/i.test(String(s.clock || ''))) return null;
  const result = suggestedGrade(s);
  if (!result) return null;
  const b = leg.bet;
  if (b.type === 'prop' && s.found === false) return { why: 'absent' };
  if (b.type === 'prop' && STATS[b.stat]?.canDrop && s.margin != null && Math.abs(s.margin) < 1) return { why: 'close' };
  return { result, margin: gradeMargin(s, result) };
}

/**
 * Every leg auto-grading should grade now, and every final leg that needs a look.
 *   handled  ids of legs the commish graded or cleared by hand (never auto-graded again)
 * Returns { grade: [{ leg, result, margin }], check: [{ leg, why }] }.
 */
export function autoGrades(legs, statusOf, handled = new Set()) {
  const grade = [];
  const check = [];
  for (const leg of legs) {
    if (handled.has(leg.id)) continue;
    const a = autoCheck(leg, statusOf(leg));
    if (a?.why) check.push({ leg, why: a.why });
    else if (a) grade.push({ leg, ...a });
  }
  return { grade, check };
}

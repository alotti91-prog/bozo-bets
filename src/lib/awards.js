// Weekly awards for the recap: the closest miss, the biggest hit, and streaks
// (ice cold, on fire). Each one shows only when it applies. Pure functions,
// covered by recap.test.js.
import { lossTier, cutoffs } from './recap.js';
import { fmtOdds } from './odds.js';

const num = (n) => String(Math.round(Math.abs(n) * 10) / 10);
const STREAK = 3; // weeks in a row before a streak gets an award

/** "lost by 1" (moneyline), "missed by 0.5", or "a close call" (the commish's pick, no number). */
export function missText(leg) {
  if (leg.margin != null && Number(leg.margin) < 0) return `${leg.bet?.type === 'ml' ? 'lost' : 'missed'} by ${num(leg.margin)}`;
  return leg.miss === 'close' ? 'a close call' : 'lost';
}

/** How a person's week went: 'W' (every leg won or pushed, at least one won), 'L' (any leg lost), 'P' (only pushes), or null (no leg, or not graded). */
function weekResult(legs) {
  if (!legs.length || legs.some((l) => !l.result)) return null;
  if (legs.some((l) => l.result === 'L')) return 'L';
  return legs.some((l) => l.result === 'W') ? 'W' : 'P';
}

/**
 * A person's streak going into and including this week: { kind: 'W' | 'L', n }.
 * Weeks they sat out don't break it; a push or an ungraded week does.
 */
export function streak(playerId, weeks, legs, uptoN) {
  const ordered = weeks.filter((w) => w.n <= uptoN).sort((a, b) => b.n - a.n);
  let kind = null;
  let n = 0;
  for (const w of ordered) {
    const mine = legs.filter((l) => l.week_id === w.id && l.player_id === playerId);
    if (!mine.length) continue;
    const r = weekResult(mine);
    if (r !== 'W' && r !== 'L') break;
    if (kind && r !== kind) break;
    kind = r;
    n++;
  }
  return kind ? { kind, n } : { kind: null, n: 0 };
}

/**
 * The week's awards, for people with a leg that week:
 *   close  Closest miss: the lost leg nearest its line, as a share of its sport's
 *          blowout margin (close calls first; blowouts and unmeasured misses never win)
 *   big    Biggest hit: the longest odds that cashed, plus money only
 *   cold   Ice cold: the longest losing streak, 3+ weeks
 *   hot    On fire: the longest winning streak, 3+ weeks
 * Returns [{ key, icon, title, who (player id), note }], in that order. Ties go to player order.
 */
export function weekAwards({ weeks, legs, players }, weekId) {
  const week = weeks.find((w) => w.id === weekId);
  if (!week) return [];
  const order = new Map(players.map((p, i) => [p.id, i]));
  const byOrder = (a, b) => (order.get(a.player_id) ?? 99) - (order.get(b.player_id) ?? 99);
  const wl = legs.filter((l) => l.week_id === week.id).sort(byOrder);
  const out = [];

  const tierRank = { close: 0, normal: 1 };
  const misses = wl.filter((l) => l.result === 'L')
    .map((l) => {
      const tier = lossTier(l);
      const c = cutoffs(l.bet);
      const known = l.margin != null && Number(l.margin) < 0;
      const share = known && c ? -Number(l.margin) / c.blowout : known ? -Number(l.margin) : 1;
      return { l, tier, share, measured: known || l.miss === 'close' };
    })
    .filter((m) => m.measured && m.tier in tierRank);
  misses.sort((a, b) => tierRank[a.tier] - tierRank[b.tier] || a.share - b.share);
  if (misses.length) {
    const { l } = misses[0];
    out.push({ key: 'close', icon: '😬', title: 'Closest miss', who: l.player_id, note: `${l.pick} · ${missText(l)}` });
  }

  const hits = wl.filter((l) => l.result === 'W' && Number(l.odds) >= 100).sort((a, b) => Number(b.odds) - Number(a.odds));
  if (hits.length) out.push({ key: 'big', icon: '💰', title: 'Biggest hit', who: hits[0].player_id, note: `${hits[0].pick} · ${fmtOdds(Number(hits[0].odds))}` });

  const ids = [...new Set(wl.map((l) => l.player_id))];
  const streaks = ids.map((id) => ({ id, ...streak(id, weeks, legs, week.n) }));
  const best = (kind) => streaks.filter((s) => s.kind === kind && s.n >= STREAK).sort((a, b) => b.n - a.n)[0];
  const cold = best('L');
  if (cold) out.push({ key: 'cold', icon: '🧊', title: 'Ice cold', who: cold.id, note: `${cold.n} straight losses` });
  const hot = best('W');
  if (hot) out.push({ key: 'hot', icon: '🔥', title: 'On fire', who: hot.id, note: `${hot.n} straight wins` });
  return out;
}

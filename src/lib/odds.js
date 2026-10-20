// Odds and money math. Pure functions, covered by odds.test.js.

/** American odds -> decimal multiplier. -110 -> 1.909, +150 -> 2.5 */
export function dec(odds) {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

/** Decimal multiplier -> American odds string. Pass plain=true for an ASCII minus. */
export function amerFmt(d, plain = false) {
  if (!(d > 1.0000001)) return 'EVEN';
  if (d >= 2) return '+' + Math.round((d - 1) * 100);
  return (plain ? '-' : '−') + Math.round(100 / (d - 1));
}

export function fmtOdds(odds, plain = false) {
  return odds > 0 ? '+' + odds : (plain ? '-' : '−') + Math.abs(odds);
}

export function money(n) {
  return '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dollars(n) {
  const r = Math.round(n);
  return (r < 0 ? '−$' : '$') + Math.abs(r).toLocaleString('en-US');
}

export function signed(n) {
  const r = Math.round(n);
  if (r === 0) return '$0';
  return (r > 0 ? '+$' : '−$') + Math.abs(r).toLocaleString('en-US');
}

/**
 * Parse what someone typed in the odds box. `sign` is the +/- toggle.
 * Typing "-110" or "+150" overrides the toggle.
 */
export function parseOdds(raw, sign = '-') {
  let s = String(raw ?? '').replace(/\s/g, '');
  let mult = sign === '+' ? 1 : -1;
  if (s.startsWith('+')) { mult = 1; s = s.slice(1); }
  else if (/^[-−–]/.test(s)) { mult = -1; s = s.slice(1); }
  if (!/^\d+$/.test(s)) return { error: 'Odds need to be a number, like −110 or +150.' };
  const n = parseInt(s, 10);
  if (n < 100) return { error: 'Odds need to be 100 or higher, like −110 or +150.' };
  if (n > 100000) return { error: 'Those odds are too long. Double-check the number.' };
  return { odds: mult * n };
}

/**
 * Everything the slip needs for one week.
 * week: { stake, actual_payout }, legs: that week's legs ({ odds, result: 'W'|'L'|'P'|null })
 */
export function weekInfo(week, legs) {
  const losers = legs.filter((l) => l.result === 'L');
  const pending = legs.filter((l) => !l.result);
  const live = legs.filter((l) => l.result !== 'P');
  const d = live.reduce((a, l) => a * dec(l.odds), 1);
  let status = 'empty';
  if (legs.length) status = losers.length ? 'busted' : pending.length ? 'live' : 'hit';
  const stake = Number(week.stake);
  const projected = stake * d;
  const actual = week.actual_payout == null ? null : Number(week.actual_payout);
  const payout = status === 'hit' ? (actual ?? projected) : 0;
  return {
    losers, pending, d, status, stake, projected, payout,
    settled: status === 'hit' || status === 'busted',
    graded: legs.length > 0 && pending.length === 0,
  };
}

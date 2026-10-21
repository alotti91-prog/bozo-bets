// Standings math. Pure function, covered by stats.test.js.
import { dec, weekInfo } from './odds.js';

export function hitPct(r) {
  const d = r.W + r.L;
  return d ? r.W / d : -1;
}

/**
 * players: [{id, name, active}], weeks: sorted by n, legs: [{week_id, player_id, odds, result, pick, sport}],
 * spins: [{week_id, landed_id, created_at}] sorted by created_at.
 * Money only counts settled weeks (hit or busted).
 */
export function standings({ players, weeks, legs, spins }) {
  const rows = {};
  players.forEach((p) => {
    // decSum/nOdds: average odds of decided legs (pushes are voids, so their odds don't count).
    // solo: profit if you'd bet $100 on just your own leg each week (the group's old spreadsheet stat).
    rows[p.id] = { p, W: 0, L: 0, P: 0, decSum: 0, nOdds: 0, n: 0, solo: 0, paid: 0, share: 0, landed: 0, best: null, streak: 0, streakType: null };
  });
  const sport = {};
  let hits = 0, settled = 0, totalIn = 0, totalWon = 0;

  for (const w of weeks) {
    const wl = legs.filter((l) => l.week_id === w.id);
    const info = weekInfo(w, wl);
    for (const l of wl) {
      const r = rows[l.player_id];
      if (!r || !l.result) continue;
      r[l.result]++;
      r.n++;
      if (l.result === 'W') r.solo += (dec(l.odds) - 1) * 100;
      if (l.result === 'L') r.solo -= 100;
      if (l.result === 'W' && (!r.best || l.odds > r.best.odds)) r.best = { odds: l.odds, pick: l.pick, n: w.n };
      if (l.result !== 'P') {
        r.decSum += dec(l.odds);
        r.nOdds++;
        const k = l.sport || 'Other';
        sport[k] = sport[k] || { W: 0, L: 0 };
        sport[k][l.result]++;
        if (r.streakType === l.result) r.streak++;
        else { r.streakType = l.result; r.streak = 1; }
      }
    }
    if (info.settled) {
      settled++;
      totalIn += info.stake;
      if (w.payer_id && rows[w.payer_id]) rows[w.payer_id].paid += info.stake;
      if (info.status === 'hit') {
        hits++;
        totalWon += info.payout;
        const ps = [...new Set(wl.map((l) => l.player_id))];
        ps.forEach((id) => { if (rows[id]) rows[id].share += info.payout / ps.length; });
      }
    }
    const ws = spins.filter((s) => s.week_id === w.id);
    if (ws.length) {
      const last = ws[ws.length - 1];
      if (rows[last.landed_id]) rows[last.landed_id].landed++;
    }
  }
  return { rows, sport, hits, settled, totalIn, totalWon };
}

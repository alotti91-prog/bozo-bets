import { describe, it, expect } from 'vitest';
import { dec, amerFmt, fmtOdds, parseOdds, weekInfo, money, signed } from './odds.js';
import { standings, hitPct } from './stats.js';
import { indexAt, targetRotation, restRotation, wheelContext, TAU } from './wheel.js';

describe('odds', () => {
  it('converts American odds to decimal', () => {
    expect(dec(-110)).toBeCloseTo(1.9091, 4);
    expect(dec(150)).toBe(2.5);
    expect(dec(-200)).toBe(1.5);
    expect(dec(100)).toBe(2);
  });
  it('formats combined odds', () => {
    expect(amerFmt(23.78)).toBe('+2278');
    expect(amerFmt(1.5)).toBe('−200');
    expect(amerFmt(1.5, true)).toBe('-200');
    expect(amerFmt(1)).toBe('EVEN');
    expect(fmtOdds(-110, true)).toBe('-110');
    expect(fmtOdds(135)).toBe('+135');
  });
  it('parses what people type', () => {
    expect(parseOdds('110', '-')).toEqual({ odds: -110 });
    expect(parseOdds('150', '+')).toEqual({ odds: 150 });
    expect(parseOdds('+150', '-')).toEqual({ odds: 150 });
    expect(parseOdds(' -120 ', '+')).toEqual({ odds: -120 });
    expect(parseOdds('99', '-').error).toBeTruthy();
    expect(parseOdds('abc', '-').error).toBeTruthy();
  });
  it('formats money', () => {
    expect(money(237.8)).toBe('$237.80');
    expect(signed(-10)).toBe('−$10');
    expect(signed(29.6)).toBe('+$30');
  });
});

const W = (id, n, extra = {}) => ({ id, n, stake: 10, actual_payout: null, payer_id: null, ...extra });
const L = (week_id, player_id, odds, result, extra = {}) => ({ week_id, player_id, odds, result, pick: 'x', sport: 'NFL', ...extra });

describe('weekInfo', () => {
  it('six-leg hit pays the product of the legs', () => {
    const legs = [-115, -250, -160, -105, -110, -200].map((o, i) => L('w', 'p' + i, o, 'W'));
    const info = weekInfo(W('w', 1), legs);
    expect(info.status).toBe('hit');
    expect(info.payout).toBeCloseTo(237.8, 1);
  });
  it('a push drops out of the odds', () => {
    const info = weekInfo(W('w', 1), [L('w', 'a', -110, 'W'), L('w', 'b', 150, 'P')]);
    expect(info.status).toBe('hit');
    expect(info.payout).toBeCloseTo(19.09, 2);
  });
  it('one miss busts it, pending legs keep it live', () => {
    expect(weekInfo(W('w', 1), [L('w', 'a', -110, 'L'), L('w', 'b', 150, null)]).status).toBe('busted');
    expect(weekInfo(W('w', 1), [L('w', 'a', -110, 'W'), L('w', 'b', 150, null)]).status).toBe('live');
    expect(weekInfo(W('w', 1), []).status).toBe('empty');
  });
  it('uses the actual payout when the commish enters one', () => {
    const legs = [L('w', 'a', 100, 'W')];
    expect(weekInfo(W('w', 1, { actual_payout: '19.50' }), legs).payout).toBe(19.5);
  });
});

describe('standings', () => {
  const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const weeks = [W('w1', 1, { payer_id: 'a' }), W('w2', 2, { payer_id: 'b' })];
  const legs = [L('w1', 'a', 100, 'W'), L('w1', 'b', 100, 'W'), L('w2', 'a', -110, 'L'), L('w2', 'b', -110, 'W')];
  const spins = [{ week_id: 'w1', landed_id: 'b' }];
  const s = standings({ players, weeks, legs, spins });
  it('counts records, money and wheel landings', () => {
    expect(s.hits).toBe(1);
    expect(s.settled).toBe(2);
    expect(s.totalIn).toBe(20);
    expect(s.totalWon).toBe(40);
    expect(s.rows.a.W).toBe(1);
    expect(s.rows.a.L).toBe(1);
    expect(hitPct(s.rows.b)).toBe(1);
    expect(s.rows.a.share - s.rows.a.paid).toBe(10);
    expect(s.rows.b.landed).toBe(1);
    expect(s.rows.b.streakType).toBe('W');
    expect(s.rows.b.streak).toBe(2);
  });
});

describe('wheel', () => {
  it('lands on the chosen segment for any start angle', () => {
    for (const n of [1, 2, 3, 6, 9]) {
      for (let k = 0; k < n; k++) {
        const start = (k * 1.7) - 5;
        const end = targetRotation(start, n, k, 0.3, 6);
        expect(indexAt(end, n)).toBe(k);
        expect(end - start).toBeGreaterThanOrEqual(6 * TAU);
      }
    }
  });
  it('rest rotation centres the segment', () => {
    expect(indexAt(restRotation(5, 3), 5)).toBe(3);
  });
  it('knows when it can spin', () => {
    const weeks = [W('w1', 1), W('w2', 2)];
    const spins = [{ week_id: 'w1', landed_id: 'a', pool: ['a', 'b'] }];
    const waiting = wheelContext({ weeks, legs: [L('w2', 'a', -110, null)], spins });
    expect(waiting.mode).toBe('waiting');
    expect(waiting.last.spin.landed_id).toBe('a');
    const ready = wheelContext({ weeks, legs: [L('w2', 'a', -110, 'L'), L('w2', 'b', -110, 'W')], spins });
    expect(ready.mode).toBe('ready');
    expect(ready.losers).toEqual(['a']);
  });
});

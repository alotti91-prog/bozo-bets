import { describe, it, expect } from 'vitest';
import { dec, amerFmt, fmtOdds, parseOdds, weekInfo, money, signed } from './odds.js';
import { standings, hitPct, bozoBelt } from './stats.js';
import { indexAt, targetRotation, restRotation, wheelContext, unwatchedSpin, hideSpin, TAU } from './wheel.js';
import { nflWeek, nflWeekDate, seasonOf } from './nfl.js';
import { countdown, lockState, toLocalInput, ago } from './deadline.js';
import { isPrivateAddress } from './site.js';
import { RELEASES, unseenReleases } from './releases.js';

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

describe('solo $100 stat matches the old spreadsheet', () => {
  // 2026 Weeks 1-3 from the group's Google Sheet (gray "Puka 70+" = void, stored as a push).
  const H = [
    [1, 'Mori', -137, 'L'], [1, 'JB', -108, 'W'], [1, 'Ted', -113, 'W'], [1, 'Ben', -111, 'L'], [1, 'Chris', -228, 'L'],
    [1, 'Lotti', 105, 'L'], [1, 'Alec', -176, 'W'], [1, 'Disco', -165, 'W'],
    [2, 'Mori', -157, 'L'], [2, 'JB', -110, 'L'], [2, 'Ted', -122, 'L'], [2, 'Ben', -138, 'L'], [2, 'Chris', -110, 'P'],
    [2, 'Lotti', -102, 'W'], [2, 'Tim', -168, 'L'], [2, 'Alec', -174, 'W'], [2, 'Sexton', -154, 'L'], [2, 'Disco', -135, 'L'],
    [3, 'Mori', -165, 'L'], [3, 'JB', -103, 'W'], [3, 'Ted', -166, 'L'], [3, 'Ben', -200, 'L'], [3, 'Chris', -150, 'W'],
    [3, 'Lotti', -102, 'W'], [3, 'Tim', -205, 'W'], [3, 'Alec', -192, 'W'], [3, 'Sexton', -113, 'W'], [3, 'Disco', -191, 'W'],
  ];
  const names = [...new Set(H.map((h) => h[1]))];
  const players = names.map((n) => ({ id: n, name: n }));
  const weeks = [W('w1', 1), W('w2', 2), W('w3', 3)];
  const legs = H.map(([wk, p, odds, r]) => L('w' + wk, p, odds, r));
  const s = standings({ players, weeks, legs, spins: [] });
  // Running totals from the sheet's last filled row.
  const sheet = { Mori: -300, JB: 90, Ted: -112, Ben: -300, Chris: -33.3, Lotti: 96.1, Tim: -51.2, Alec: 166, Sexton: -11.5, Disco: 13 };
  it.each(Object.entries(sheet))('%s', (name, total) => {
    expect(Math.abs(s.rows[name].solo - total)).toBeLessThan(1);
  });
  it('win % matches the sheet and the void is ignored', () => {
    expect(hitPct(s.rows.Chris)).toBe(0.5);
    expect(hitPct(s.rows.Alec)).toBe(1);
    expect(s.rows.Chris.nOdds).toBe(2);
    expect(s.settled).toBe(3);
    expect(s.hits).toBe(0);
  });
});

describe('Bozo Belt', () => {
  const weeks = [W('w1', 1), W('w2', 2), W('w3', 3)];
  it('goes to the most misses', () => {
    const legs = [L('w1', 'a', -110, 'L'), L('w2', 'a', -110, 'L'), L('w3', 'b', -110, 'L'), L('w3', 'c', -110, 'W')];
    expect(bozoBelt({ weeks, legs })).toEqual({ id: 'a', misses: 2 });
  });
  it('breaks ties by the most recent miss', () => {
    const legs = [L('w1', 'a', -110, 'L'), L('w3', 'b', -110, 'L')];
    expect(bozoBelt({ weeks, legs }).id).toBe('b');
  });
  it('nobody holds it before the first miss', () => {
    expect(bozoBelt({ weeks, legs: [L('w1', 'a', -110, 'W'), L('w1', 'b', -110, null)] })).toBe(null);
  });
});

describe('deadline', () => {
  const H = 3600e3;
  it('formats the countdown', () => {
    expect(countdown(2 * 24 * H + 4 * H + 5e3)).toBe('2d 4h');
    expect(countdown(3 * H + 12 * 60e3)).toBe('3h 12m');
    expect(countdown(12 * 60e3)).toBe('12m');
    expect(countdown(20e3)).toBe('under a minute');
  });
  it('knows when a week is locked', () => {
    const now = Date.UTC(2026, 9, 21, 16, 0);
    expect(lockState(null, now)).toBe(null);
    const open = lockState(new Date(now + 90 * 60e3).toISOString(), now);
    expect(open.locked).toBe(false);
    expect(open.soon).toBe(true);
    expect(open.countdown).toBe('1h 30m');
    expect(lockState(new Date(now - 1000).toISOString(), now).locked).toBe(true);
  });
  it('says how long ago a comment was posted', () => {
    const now = Date.UTC(2026, 9, 21, 16, 0);
    const at = (ms) => new Date(now - ms).toISOString();
    expect(ago(at(20e3), now)).toBe('now');
    expect(ago(at(5 * 60e3), now)).toBe('5m');
    expect(ago(at(3 * 3600e3), now)).toBe('3h');
    expect(ago(at(2 * 86400e3), now)).toBe('2d');
    expect(ago(at(10 * 86400e3), now)).toBe('Oct 11');
  });
  it('round-trips a datetime-local value', () => {
    const d = new Date(2026, 9, 25, 12, 55);
    expect(toLocalInput(d)).toBe('2026-10-25T12:55');
    expect(new Date(toLocalInput(d)).getTime()).toBe(d.getTime());
  });
});

describe('release notes', () => {
  it('are newest first with unique ids', () => {
    const ids = RELEASES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const dates = RELEASES.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    RELEASES.forEach((r) => { expect(r.title).toBeTruthy(); expect(r.items.length).toBeGreaterThan(0); });
  });
  it('know which ones you haven’t seen', () => {
    const rs = [{ id: 'c' }, { id: 'b' }, { id: 'a' }];
    expect(unseenReleases('a', rs).map((r) => r.id)).toEqual(['c', 'b']);
    expect(unseenReleases('c', rs)).toEqual([]);
    expect(unseenReleases(null, rs).map((r) => r.id)).toEqual(['c']);
    expect(unseenReleases('gone', rs).map((r) => r.id)).toEqual(['c']);
  });
});

describe('public address', () => {
  it('flags Vercel’s private deployment addresses', () => {
    const pub = 'https://bozo-bets-psi.vercel.app';
    expect(isPrivateAddress(pub, 'bozo-bets-psi.vercel.app')).toBe(false);
    expect(isPrivateAddress(pub, 'bozo-bets-k3j2h1g9f-lotti.vercel.app')).toBe(true);
    expect(isPrivateAddress(pub, 'bozo-bets-git-main-lotti.vercel.app')).toBe(true);
    expect(isPrivateAddress('', 'localhost:5173')).toBe(false);
  });
});

describe('NFL week', () => {
  const at = (y, m, d) => nflWeek(new Date(y, m - 1, d));
  it('finds the current week of the 2026 season', () => {
    expect(at(2026, 9, 8)).toEqual({ season: 2026, week: 1 }); // Tuesday after Labor Day
    expect(at(2026, 9, 9)).toEqual({ season: 2026, week: 1 }); // kickoff
    expect(at(2026, 9, 14)).toEqual({ season: 2026, week: 1 }); // Monday night
    expect(at(2026, 9, 15)).toEqual({ season: 2026, week: 2 });
    expect(at(2026, 10, 21)).toEqual({ season: 2026, week: 7 });
    expect(at(2027, 1, 10)).toEqual({ season: 2026, week: 18 });
  });
  it('treats the offseason as Week 1 of the next season', () => {
    expect(at(2027, 7, 4)).toEqual({ season: 2027, week: 1 });
    expect(at(2026, 8, 20)).toEqual({ season: 2026, week: 1 });
  });
  it('dates a week by its Thursday', () => {
    expect(nflWeekDate(2026, 1)).toBe('2026-09-10');
    expect(nflWeekDate(2026, 7)).toBe('2026-10-22');
    expect(seasonOf('2026-10-21')).toBe(2026);
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
    const players = [{ id: 'a', active: true }, { id: 'b', active: true }, { id: 'c', active: true }, { id: 'd', active: false }];
    const withShows = wheelContext({ weeks, legs: [L('w2', 'a', -110, 'L'), L('w2', 'b', -110, 'W')], spins, players });
    expect(withShows.noShows).toEqual(['c']);
    expect(ready.target.id).toBe('w2');
    expect(ready.nextN).toBe(3);
  });
  it('hides the latest bozo until you watch it', () => {
    const weeks = [W('w6', 6), W('w7', 7, { payer_id: 'b' })];
    const spins = [
      { id: 's1', week_id: 'w6', landed_id: 'a', pool: ['a', 'b'], spun_by: 'admin' },
      { id: 's2', week_id: 'w6', landed_id: 'b', pool: ['a', 'b'], spun_by: 'admin' }, // re-spin, counts
    ];
    const data = { weeks, spins, legs: [], views: ['s1'] };
    expect(unwatchedSpin(data, 'me')?.id).toBe('s2');
    expect(unwatchedSpin(data, 'admin')).toBe(null); // the spinner saw it
    expect(unwatchedSpin({ ...data, views: ['s2'] }, 'me')).toBe(null);
    expect(unwatchedSpin(data, 'me', new Set(['s2']))).toBe(null);
    expect(unwatchedSpin({ ...data, views: null }, 'me')).toBe(null); // not set up yet
    const masked = hideSpin(data, spins[1]);
    expect(masked.weeks[1].payer_id).toBe(null);
    expect(masked.weeks[1].payer_hidden).toBe(true);
    expect(masked.spins[1].hidden).toBe(true);
    expect(masked.spins[0].hidden).toBe(true); // the replaced spin too, no working it out by elimination
    const s = standings({ players: [{ id: 'a' }, { id: 'b' }], weeks: masked.weeks, legs: [], spins: masked.spins });
    expect(s.rows.b.landed).toBe(0);
  });
  it('spins last week when it settled but was never spun', () => {
    const weeks = [W('w6', 6), W('w7', 7)];
    const legs = [L('w6', 'a', -110, 'L'), L('w6', 'b', -110, 'W'), L('w7', 'a', -110, null)];
    const ctx = wheelContext({ weeks, legs, spins: [] });
    expect(ctx.mode).toBe('ready');
    expect(ctx.target.id).toBe('w6');
    expect(ctx.nextN).toBe(7);
    expect(ctx.losers).toEqual(['a']);
    // Once it's spun, the result stays up until this week settles.
    const after = wheelContext({ weeks, legs, spins: [{ week_id: 'w6', landed_id: 'a', pool: ['a'] }] });
    expect(after.mode).toBe('waiting');
    expect(after.last.week.id).toBe('w6');
    // A past week with an ungraded leg can't be spun.
    const open = wheelContext({ weeks, legs: [L('w6', 'a', -110, null), L('w7', 'a', -110, null)], spins: [] });
    expect(open.mode).toBe('waiting');
    expect(open.last).toBe(null);
  });
});

import { describe, it, expect } from 'vitest';
import { weekRecap, personLine, recapText, FACES } from './recap.js';

const players = ['Lotti', 'Sully', 'Mikey', 'Danny B', 'Big Chris'].map((name, i) => ({ id: 'p' + (i + 1), name, active: true }));
const pname = (id) => players.find((p) => p.id === id)?.name;
const weeks = [
  { id: 'w7', n: 7, stake: 10, actual_payout: null },
  { id: 'w8', n: 8, stake: 10, actual_payout: null },
];
const leg = (p, pick, odds, result, week = 'w7') => ({ id: p + week, week_id: week, player_id: p, pick, odds, result });
const busted = [
  leg('p1', 'Bills −6.5', -110, 'L'),
  leg('p2', 'Saquon 75+ rush yds', -125, 'W'),
  leg('p3', 'Steelers ML', 135, 'L'),
  leg('p4', 'NYJ/NE under 41.5', -105, 'W'),
  leg('p5', 'Rangers ML', 105, 'P'),
];
const spin = { id: 's7', week_id: 'w7', pool: ['p1', 'p3'], landed_id: 'p3', eliminated: ['p1'] };

describe('weekRecap', () => {
  it('gives the wheel’s pick full bozo, other misses makeup, and wins and pushes clean', () => {
    const r = weekRecap({ weeks, legs: busted, spins: [spin], players }, 'w7');
    expect(r.bozo).toBe('p3');
    expect(r.people.map((p) => [p.id, p.face])).toEqual([['p3', 'full'], ['p1', 'makeup'], ['p2', 'clean'], ['p4', 'clean'], ['p5', 'clean']]);
    expect(r.hits).toBe(2);
    expect(r.total).toBe(5);
    expect(r.nextN).toBe(8);
    expect(r.stake).toBe(10);
    expect(r.info.status).toBe('busted');
    expect(r.each).toBe(0);
  });

  it('waits until every leg is graded and the spin has been watched', () => {
    const pending = busted.map((l, i) => (i === 1 ? { ...l, result: null } : l));
    expect(weekRecap({ weeks, legs: pending, spins: [], players }, 'w7')).toBe(null);
    expect(weekRecap({ weeks, legs: busted, spins: [{ ...spin, hidden: true }], players }, 'w7')).toBe(null);
    expect(weekRecap({ weeks, legs: [leg('p1', 'Bills', -110, null, 'w8')], spins: [], players }, 'w8')).toBe(null);
    expect(weekRecap({ weeks, legs: busted, spins: [], players }, 'nope')).toBe(null);
  });

  it('uses the re-spin, not the spin it replaced', () => {
    const respin = { ...spin, id: 's7b', landed_id: 'p1', eliminated: ['p3'] };
    const r = weekRecap({ weeks, legs: busted, spins: [spin, respin], players }, 'w7');
    expect(r.bozo).toBe('p1');
    expect(r.people[0]).toMatchObject({ id: 'p1', face: 'full' });
    expect(r.people.find((p) => p.id === 'p3').face).toBe('makeup');
  });

  it('works with no spin yet: nobody is full bozo', () => {
    const r = weekRecap({ weeks, legs: busted, spins: [], players }, 'w7');
    expect(r.bozo).toBe(null);
    expect(r.people.filter((p) => p.face === 'full')).toEqual([]);
  });

  it('puts someone who didn’t pick but was in the wheel in makeup', () => {
    const legs = busted.filter((l) => l.player_id !== 'p5');
    const r = weekRecap({ weeks, legs, spins: [{ ...spin, pool: ['p1', 'p3', 'p5'], eliminated: ['p1', 'p5'] }], players }, 'w7');
    const chris = r.people.find((p) => p.id === 'p5');
    expect(chris.face).toBe('makeup');
    expect(personLine(chris)).toBe('Didn’t pick');
  });

  it('keeps everyone clean when it hits, even the wheel’s pick for next week', () => {
    const won = busted.map((l) => ({ ...l, result: 'W' }));
    const everyone = { id: 's7', week_id: 'w7', pool: players.map((p) => p.id), landed_id: 'p2', eliminated: ['p1', 'p3', 'p4', 'p5'] };
    const r = weekRecap({ weeks: [{ ...weeks[0], actual_payout: 300 }, weeks[1]], legs: won, spins: [everyone], players }, 'w7');
    expect(r.info.status).toBe('hit');
    expect(r.bozo).toBe('p2');
    expect(r.people.every((p) => p.face === 'clean')).toBe(true);
    expect(r.people.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(r.each).toBe(60);
  });

  it('guesses the next week number when there isn’t one yet', () => {
    const r = weekRecap({ weeks: [weeks[0]], legs: busted, spins: [], players }, 'w7');
    expect(r.nextN).toBe(8);
  });
});

describe('recap text', () => {
  it('names the bozo and gives one line per person, worst first', () => {
    const r = weekRecap({ weeks, legs: busted, spins: [spin], players }, 'w7');
    const text = recapText(r, pname, 'Bozo Bets');
    expect(text.split('\n')).toEqual([
      'BOZO BETS · Week 7 recap',
      'Busted. 2 of 5 legs hit. Would’ve paid $157.66.', // the push drops out: $10 × 1.909 × 1.8 × 2.35 × 1.952
      'Mikey is the bozo. Puts in Week 8’s $10.',
      '',
      '🤡 Mikey: Steelers ML · lost',
      '💄 Lotti: Bills −6.5 · lost',
      '😎 Sully: Saquon 75+ rush yds · won',
      '😎 Danny B: NYJ/NE under 41.5 · won',
      '😎 Big Chris: Rangers ML · pushed',
    ]);
  });

  it('shows the payout when it hits', () => {
    const won = busted.map((l) => ({ ...l, result: 'W' }));
    const r = weekRecap({ weeks: [{ ...weeks[0], actual_payout: 300 }, weeks[1]], legs: won, spins: [], players }, 'w7');
    expect(recapText(r, pname).split('\n')[1]).toBe('It hit! $10 paid $300.00 ($60.00 each).');
  });

  it('has a name for every face', () => {
    expect(Object.keys(FACES)).toEqual(['clean', 'makeup', 'full']);
  });
});

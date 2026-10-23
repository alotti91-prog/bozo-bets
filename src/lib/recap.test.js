import { describe, it, expect } from 'vitest';
import { weekRecap, personLine, recapText, FACES, lossTier, cutoffs } from './recap.js';
import { liveStatus, gradeMargin } from './bets.js';

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
    expect(Object.keys(FACES)).toEqual(['clean', 'paint', 'makeup', 'wig', 'full']);
  });
});

describe('how bad a loss was', () => {
  const spread = (sport, margin) => ({ result: 'L', margin, bet: { sport, type: 'spread', side: 'away', line: -6.5 } });
  it('football: a hook is close, two touchdowns is a blowout', () => {
    expect(lossTier(spread('nfl', -0.5))).toBe('close');
    expect(lossTier(spread('nfl', -1))).toBe('close');
    expect(lossTier(spread('nfl', -1.5))).toBe('normal');
    expect(lossTier(spread('ncaaf', -13.5))).toBe('normal');
    expect(lossTier(spread('ncaaf', -14))).toBe('blowout');
    expect(lossTier({ result: 'L', margin: -3, bet: { sport: 'nfl', type: 'ml', side: 'home' } })).toBe('close'); // lost by a field goal
  });
  it('other sports use their own scale', () => {
    expect(lossTier(spread('nhl', -0.5))).toBe('close');
    expect(lossTier({ result: 'L', margin: -3, bet: { sport: 'nhl', type: 'ml' } })).toBe('blowout');
    expect(lossTier({ result: 'L', margin: -5, bet: { sport: 'mlb', type: 'total', line: 8.5 } })).toBe('blowout');
    expect(lossTier({ result: 'L', margin: -2, bet: { sport: 'nba', type: 'spread', line: 4.5 } })).toBe('close');
    expect(lossTier({ result: 'L', margin: -15, bet: { sport: 'nba', type: 'total', line: 229.5 } })).toBe('blowout');
  });
  it('props scale with the line; small lines have no close call', () => {
    const prop = (line, margin) => ({ result: 'L', margin, bet: { sport: 'nfl', type: 'prop', side: 'over', line, stat: 'rushYds' } });
    expect(lossTier(prop(74.5, -6.5))).toBe('close'); // 68 yards, needed 75
    expect(lossTier(prop(74.5, -20))).toBe('normal');
    expect(lossTier(prop(74.5, -44.5))).toBe('blowout'); // 30 yards
    expect(lossTier(prop(1.5, -1.5))).toBe('normal'); // 0 pass TDs: a miss is a miss
    expect(cutoffs({ type: 'prop', line: 5.5 })).toEqual({ close: 1, blowout: 2.75 });
  });
  it('typed legs and legs without a saved margin are a normal miss', () => {
    expect(lossTier({ result: 'L', margin: null, bet: { sport: 'nfl', type: 'spread' } })).toBe('normal');
    expect(lossTier({ result: 'L', margin: -0.5, bet: null })).toBe('normal');
    expect(lossTier({ result: 'L', margin: -0.5, bet: { sport: 'soccer', type: 'spread' } })).toBe('normal');
  });
  it('turns into faces: close → face paint, blowout → wig; the wheel’s pick stays full bozo', () => {
    const legs = [
      { ...leg('p1', 'Bills −6.5', -110, 'L'), margin: -0.5, bet: { sport: 'nfl', type: 'spread', line: -6.5 } },
      { ...leg('p2', 'Saquon 75+ rush yds', -125, 'L'), margin: -44.5, bet: { sport: 'nfl', type: 'prop', line: 74.5 } },
      { ...leg('p3', 'Steelers ML', 135, 'L'), margin: -21, bet: { sport: 'nfl', type: 'ml' } },
      leg('p4', 'NYJ/NE under 41.5', -105, 'L'),
      leg('p5', 'Rangers ML', 105, 'W'),
    ];
    const r = weekRecap({ weeks, legs, spins: [spin], players }, 'w7');
    expect(r.people.map((p) => [p.id, p.face])).toEqual([['p3', 'full'], ['p2', 'wig'], ['p4', 'makeup'], ['p1', 'paint'], ['p5', 'clean']]);
    expect(personLine(r.people.find((p) => p.id === 'p1'))).toBe('Bills −6.5 · missed by 0.5');
    expect(personLine(r.people.find((p) => p.id === 'p3'))).toBe('Steelers ML · lost by 21');
    expect(personLine(r.people.find((p) => p.id === 'p4'))).toBe('NYJ/NE under 41.5 · lost');
  });
  it('someone with two lost legs gets the worse face', () => {
    const legs = [
      { ...leg('p1', 'A', -110, 'L'), id: 'a', margin: -0.5, bet: { sport: 'nfl', type: 'spread' } },
      { ...leg('p1', 'B', -110, 'L'), id: 'b', margin: -20, bet: { sport: 'nfl', type: 'spread' } },
    ];
    expect(weekRecap({ weeks, legs, spins: [], players }, 'w7').people[0].face).toBe('wig');
  });
});

describe('saving the margin with a grade', () => {
  const game = (state, as, hs) => ({ state, detail: state === 'post' ? 'Final' : '2:10 - 4th', away: { abbr: 'BUF', score: as }, home: { abbr: 'MIA', score: hs } });
  const bills = { sport: 'nfl', type: 'spread', side: 'away', line: -6.5 };
  it('live status knows how far from the line a leg is', () => {
    expect(liveStatus(bills, game('in', 20, 14)).margin).toBe(-0.5);
    expect(liveStatus({ ...bills, type: 'ml' }, game('post', 17, 24)).margin).toBe(-7);
    expect(liveStatus({ sport: 'nfl', type: 'total', side: 'under', line: 41.5 }, game('post', 13, 24)).margin).toBe(4.5);
    expect(liveStatus({ sport: 'nfl', type: 'total', side: 'over', line: 41.5 }, game('post', 13, 24)).margin).toBe(-4.5);
  });
  it('is saved only when the game is final and agrees with the grade', () => {
    expect(gradeMargin(liveStatus(bills, game('post', 20, 14)), 'L')).toBe(-0.5);
    expect(gradeMargin(liveStatus(bills, game('post', 20, 14)), 'W')).toBe(null); // hand grade disagrees
    expect(gradeMargin(liveStatus(bills, game('in', 20, 14)), 'L')).toBe(null); // not final
    expect(gradeMargin(liveStatus(bills, game('post', 27, 14)), 'W')).toBe(6.5);
    expect(gradeMargin(null, 'L')).toBe(null); // typed leg, or no score
    expect(gradeMargin(liveStatus(bills, game('post', 20, 14)), null)).toBe(null); // un-graded
  });
});

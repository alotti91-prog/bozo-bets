import { describe, it, expect } from 'vitest';
import { weekRecap, personLine, legActual, recapText, FACES, lossTier, cutoffs, needsMissPick, marginFromLostBy, faceCounts, cutoffRows, FACE_ORDER } from './recap.js';
import { liveStatus, gradeMargin, finishedGrades } from './bets.js';
import { weekAwards, streak, missText } from './awards.js';
import { recapCard } from './recapCard.js';

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
    expect(personLine(r.people.find((p) => p.id === 'p1'))).toBe('Bills −6.5 · won by 6, needed 7');
    expect(personLine(r.people.find((p) => p.id === 'p2'))).toBe('Saquon 75+ rush yds · missed by 44.5'); // no stat saved: can't say how many
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

describe('typed legs: the commish picks how bad', () => {
  it('the pick decides the face, even without a number', () => {
    expect(lossTier({ result: 'L', miss: 'blowout', margin: null, bet: null })).toBe('blowout');
    expect(lossTier({ result: 'L', miss: 'close', margin: -7, bet: null })).toBe('close');
    expect(lossTier({ result: 'L', miss: null, margin: -7, bet: null })).toBe('normal'); // a number alone can't be judged
  });
  it('shows the number they typed in the recap', () => {
    const legs = [{ ...leg('p1', 'Steelers ML', 135, 'L'), miss: 'blowout', margin: -17 }];
    const r = weekRecap({ weeks, legs, spins: [], players }, 'w7');
    expect(r.people[0]).toMatchObject({ id: 'p1', face: 'wig' });
    expect(personLine(r.people[0])).toBe('Steelers ML · missed by 17');
  });
  it('is offered for typed legs, and for picked legs graded without a final score', () => {
    expect(needsMissPick({ result: 'L', bet: null, margin: null })).toBe(true);
    expect(needsMissPick({ result: 'L', bet: null, margin: -6 })).toBe(true); // still typed after entering a number
    expect(needsMissPick({ result: 'L', bet: { type: 'spread' }, margin: null })).toBe(true);
    expect(needsMissPick({ result: 'L', bet: { type: 'spread' }, margin: -0.5 })).toBe(false); // measured from the score
    expect(needsMissPick({ result: 'W', bet: null, margin: null })).toBe(false);
  });
  it('reads what was typed for "lost by"', () => {
    expect(marginFromLostBy('7')).toBe(-7);
    expect(marginFromLostBy(' 3.5 ')).toBe(-3.5);
    expect(marginFromLostBy('0,5')).toBe(-0.5);
    expect(marginFromLostBy('')).toBe(null);
    expect(marginFromLostBy('0')).toBe(undefined);
    expect(marginFromLostBy('-3')).toBe(undefined);
    expect(marginFromLostBy('a lot')).toBe(undefined);
  });
});

describe('the faces ladder', () => {
  it('counts how many people got each face, in ladder order', () => {
    const r = weekRecap({ weeks, legs: busted, spins: [spin], players }, 'w7');
    expect(faceCounts(r.people)).toEqual({ clean: 3, paint: 0, makeup: 1, wig: 0, full: 1 });
    expect(Object.keys(faceCounts([]))).toEqual(FACE_ORDER);
  });
  it('builds the rules table from the real cutoffs', () => {
    expect(cutoffRows()).toEqual([
      { label: 'Football', close: '1 pt (3 on a moneyline)', blowout: '14+' },
      { label: 'NBA', close: '2 pts (3 on a moneyline)', blowout: '15+' },
      { label: 'NHL', close: '1 goal', blowout: '3+' },
      { label: 'MLB', close: '1 run', blowout: '5+' },
      { label: 'Player props', close: 'Within 10% of the line', blowout: 'Half the line' },
    ]);
  });
});

describe('grading finished games in one tap', () => {
  const game = (state, as, hs) => ({ state, detail: state === 'post' ? 'Final' : '2:10 - 4th', away: { abbr: 'BUF', score: as }, home: { abbr: 'MIA', score: hs } });
  const games = { a: game('post', 20, 14), b: game('in', 20, 14), c: game('post', 13, 24) };
  const l = (id, key, bet, result = null) => ({ id, result, bet: { sport: 'nfl', game: { id: key }, ...bet } });
  const statusOf = (x) => liveStatus(x.bet, games[x.bet.game.id]);
  it('grades only ungraded legs whose game is final, with how far each finished', () => {
    const legs = [
      l('bills', 'a', { type: 'spread', side: 'away', line: -6.5 }), // final, missed by 0.5
      l('live', 'b', { type: 'spread', side: 'away', line: -6.5 }), // not final yet
      l('under', 'c', { type: 'total', side: 'under', line: 41.5 }), // final, under by 4.5
      l('done', 'c', { type: 'ml', side: 'home' }, 'W'), // already graded
      { id: 'typed', result: null, bet: null },
    ];
    expect(finishedGrades(legs, statusOf).map((g) => [g.leg.id, g.result, g.margin])).toEqual([['bills', 'L', -0.5], ['under', 'W', 4.5]]);
  });
});

describe('weekly awards', () => {
  const W = (n) => ({ id: 'w' + n, n, stake: 10 });
  const wk = [W(4), W(5), W(7), W(8)]; // week 6 skipped (NFL weeks can have gaps)
  const L = (p, week, result, extra = {}) => ({ id: `${p}-${week}-${extra.pick || ''}`, week_id: week, player_id: p, pick: extra.pick || `${p} pick`, odds: -110, result, ...extra });
  const spread = (line) => ({ v: 1, sport: 'nfl', type: 'spread', side: 'home', line });
  const legs = [
    // Lotti: lost 4, 5, 7, 8 → ice cold, 4 straight
    L('p1', 'w4', 'L'), L('p1', 'w5', 'L'), L('p1', 'w7', 'L'),
    L('p1', 'w8', 'L', { pick: 'Bills −6.5', margin: -0.5, bet: spread(-6.5) }),
    // Sully: won 5, 7, 8 (sat out 4) → on fire, 3 straight
    L('p2', 'w5', 'W'), L('p2', 'w7', 'W'), L('p2', 'w8', 'W', { pick: 'Saquon anytime TD', odds: 140 }),
    // Mikey: blowout loss, a bigger miss than Lotti's anyway
    L('p3', 'w8', 'L', { pick: 'Steelers ML', margin: -21, bet: { v: 1, sport: 'nfl', type: 'ml', side: 'away' } }),
    // Danny B: plus-money win, longest odds
    L('p4', 'w8', 'W', { pick: 'Jets ML', odds: 210 }),
    // Big Chris: typed leg the commish marked a close call, no number
    L('p5', 'w8', 'L', { pick: 'Rangers ML', miss: 'close' }),
  ];
  it('picks the closest miss, the biggest hit, and the streaks', () => {
    const a = weekAwards({ weeks: wk, legs, players }, 'w8');
    expect(a.map((x) => [x.key, pname(x.who), x.note])).toEqual([
      ['close', 'Lotti', 'Bills −6.5 · missed by 0.5'],
      ['big', 'Danny B', 'Jets ML · +210'],
      ['cold', 'Lotti', '4 straight losses'],
      ['hot', 'Sully', '3 straight wins'],
    ]);
    expect(a.map((x) => x.title)).toEqual(['Closest miss', 'Biggest hit', 'Ice cold', 'On fire']);
  });
  it('skips awards that don’t apply', () => {
    // Only a blowout loss and favorites winning: no closest miss, no biggest hit; streaks too short
    const quiet = [L('p3', 'w8', 'L', { margin: -21, bet: spread(-3) }), L('p2', 'w8', 'W', { odds: -200 })];
    expect(weekAwards({ weeks: wk, legs: quiet, players }, 'w8')).toEqual([]);
    // An unmeasured loss (typed, no close-call pick) can't be the closest miss
    expect(weekAwards({ weeks: wk, legs: [L('p1', 'w8', 'L')], players }, 'w8')).toEqual([]);
    // The commish's "close call" counts, after any measured close call
    expect(weekAwards({ weeks: wk, legs: [L('p5', 'w8', 'L', { pick: 'Rangers ML', miss: 'close' })], players }, 'w8')[0].note).toBe('Rangers ML · a close call');
    expect(weekAwards({ weeks: wk, legs, players }, 'nope')).toEqual([]);
  });
  it('counts streaks through weeks someone sat out, and stops at a push', () => {
    expect(streak('p2', wk, legs, 8)).toEqual({ kind: 'W', n: 3 });
    expect(streak('p1', wk, legs, 7)).toEqual({ kind: 'L', n: 3 }); // as of week 7
    const pushed = [...legs.filter((l) => !(l.player_id === 'p2' && l.week_id === 'w7')), L('p2', 'w7', 'P')];
    expect(streak('p2', wk, pushed, 8)).toEqual({ kind: 'W', n: 1 });
    expect(streak('p9', wk, legs, 8)).toEqual({ kind: null, n: 0 });
    expect(missText({ margin: -3, bet: { type: 'ml' } })).toBe('lost by 3');
    expect(missText({ margin: null, miss: 'close' })).toBe('a close call');
  });
  it('the share text lists the awards', () => {
    const r = { ...weekRecap({ weeks, legs: busted, spins: [spin], players }, 'w7'), awards: [{ key: 'big', icon: '💰', title: 'Biggest hit', who: 'p4', note: 'Jets ML · +210' }] };
    expect(recapText(r, pname)).toContain('💰 Biggest hit: Danny B (Jets ML · +210)');
  });
});

describe('the recap image’s content', () => {
  it('a busted week: the bozo up top, the numbers, awards, then everyone', () => {
    const r = { ...weekRecap({ weeks, legs: busted, spins: [spin], players }, 'w7'), awards: [{ key: 'big', icon: '💰', title: 'Biggest hit', who: 'p4', note: 'Jets ML · +210' }] };
    const c = recapCard(r, pname, 'Bozo Bets');
    expect(c.brand).toBe('Bozo Bets');
    expect(c.title).toBe('Week 7 recap');
    expect(c.hero).toEqual({ kind: 'bozo', faces: ['full'], big: 'Mikey', tone: 'loss', tag: 'Full bozo · picked by the wheel', sub: 'Puts in Week 8’s $10' });
    expect(c.stats).toMatch(/^2 of 5 legs hit · Would’ve paid \$/);
    expect(c.awards).toEqual([{ icon: '💰', title: 'Biggest hit', name: 'Danny B', note: 'Jets ML · +210' }]);
    expect(c.people[0]).toEqual({ face: 'full', name: 'Mikey', label: 'Full bozo', line: 'Steelers ML · lost', detail: ['Steelers ML', 'lost'], tone: 'loss', odds: '+135' });
    expect(c.people.find((p) => p.name === 'Sully')).toMatchObject({ face: 'clean', label: '' });
  });
  it('a week that hit: everyone’s faces and the payout', () => {
    const won = busted.map((l) => ({ ...l, result: 'W' }));
    const c = recapCard({ ...weekRecap({ weeks, legs: won, spins: [], players }, 'w7'), awards: [] }, pname);
    expect(c.hero.kind).toBe('hit');
    expect(c.hero.big).toBe('It hit.');
    expect(c.hero.faces).toHaveLength(5);
    expect(c.hero.tag).toMatch(/^\$10 paid \$.+ each$/);
    expect(c.stats).toBe('');
    expect(c.awards).toEqual([]);
  });
});

describe('what actually happened on a leg', () => {
  const game = { home: { short: 'Saints' }, away: { short: 'Steelers' } };
  const L = (bet, result, margin) => ({ bet: { sport: 'nfl', ...bet }, result, margin });
  it('props: how many they had, and how far off', () => {
    expect(legActual(L({ type: 'prop', stat: 'passYds', side: 'over', line: 239.5 }, 'L', -27.5))).toBe('had 212 pass yds, 27.5 short');
    expect(legActual(L({ type: 'prop', stat: 'passYds', side: 'over', line: 239.5 }, 'W', 20.5))).toBe('had 260 pass yds');
    expect(legActual(L({ type: 'prop', stat: 'rec', side: 'under', line: 4.5 }, 'L', -1.5))).toBe('had 6 receptions, 1.5 over');
    expect(legActual(L({ type: 'prop', stat: 'passTd', side: 'over', line: 1.5 }, 'L', -0.5))).toBe('had 1 pass TD, 0.5 short');
    expect(legActual(L({ type: 'prop', stat: 'td' }, 'W', null))).toBe('scored');
    expect(legActual(L({ type: 'prop', stat: 'td' }, 'L', null))).toBe('no TD');
  });
  it('totals, spreads, and moneylines', () => {
    expect(legActual(L({ type: 'total', side: 'over', line: 47.5 }, 'L', -3.5))).toBe('game went 44, 3.5 short');
    expect(legActual(L({ type: 'total', side: 'under', line: 41.5 }, 'W', 4.5))).toBe('game went 37');
    expect(legActual(L({ type: 'spread', side: 'away', line: -6.5, game }, 'L', -3.5))).toBe('Steelers won by 3, needed 7');
    expect(legActual(L({ type: 'spread', side: 'away', line: -7, game }, 'L', -2))).toBe('Steelers won by 5, needed 8');
    expect(legActual(L({ type: 'spread', side: 'home', line: 3.5, game }, 'L', -1.5))).toBe('Saints lost by 5, 1.5 short');
    expect(legActual(L({ type: 'spread', side: 'home', line: 3.5, game }, 'W', 1.5))).toBe('Saints lost by 2');
    expect(legActual(L({ type: 'ml', side: 'away', game }, 'L', -7))).toBe('Steelers lost by 7');
    expect(legActual(L({ type: 'ml', side: 'away' }, 'W', 10))).toBe('won by 10');
    expect(legActual(L({ type: 'spread', side: 'away', line: -3, game }, 'P', 0))).toBe('Steelers won by 3');
  });
  it('says nothing when it can’t tell', () => {
    expect(legActual({ bet: null, result: 'L', margin: -7 })).toBe(null); // typed
    expect(legActual(L({ type: 'spread', side: 'away', line: -6.5 }, 'L', null))).toBe(null); // graded before the final
    expect(legActual(L({ type: 'spread', side: 'away', line: -6.5 }, null, -3))).toBe(null); // not graded
  });
  it('shows up in the recap line', () => {
    const p = { legs: [{ pick: 'Shough 240+ pass yds', result: 'L', margin: -28, bet: { sport: 'nfl', type: 'prop', stat: 'passYds', side: 'over', line: 240 } }] };
    expect(personLine(p)).toBe('Shough 240+ pass yds · had 212 pass yds, 28 short');
  });
});

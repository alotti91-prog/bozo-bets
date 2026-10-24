import { describe, it, expect } from 'vitest';
import { legOutcome, carrier, slipOutcome, sweatEvents, sweatMessage } from './sweat.js';
import { currentBozo } from './stats.js';
import { herePeople, hereLine, arrivals, WHERE } from './presence.js';
import { autoCheck, autoGrades } from './autograde.js';

const leg = (id, player, pick, result = null) => ({ id, player_id: player, pick, result });
const names = (id) => ({ p1: 'Lotti', p2: 'Danny B', p3: 'Mikey' }[id] || id);

describe('Sunday sweat mode', () => {
  it('knows when a leg is decided: the grade first, then a final or locked live line', () => {
    expect(legOutcome(leg(1, 'p1', 'x', 'W'), null)).toBe('won');
    expect(legOutcome(leg(1, 'p1', 'x', 'L'), { tone: 'win', done: true })).toBe('lost'); // the commish's grade wins
    expect(legOutcome(leg(1, 'p1', 'x', 'P'), null)).toBe('push');
    expect(legOutcome(leg(1, 'p1', 'x'), { tone: 'loss', done: false, locked: false })).toBe(null); // losing, but not over
    expect(legOutcome(leg(1, 'p1', 'x'), { tone: 'win', done: false, locked: true })).toBe('won'); // an over that's already hit
    expect(legOutcome(leg(1, 'p1', 'x'), { tone: 'loss', done: true })).toBe('lost');
    expect(legOutcome(leg(1, 'p1', 'x'), { tone: 'push', done: true })).toBe('push');
    expect(legOutcome(leg(1, 'p1', 'x'), { tone: 'pre', done: false })).toBe(null);
    expect(legOutcome(leg(1, 'p1', 'x'), null)).toBe(null);
  });
  it('finds who’s carrying the slip: nothing lost, one leg left', () => {
    const o = (l) => (l.result === 'W' ? 'won' : l.result === 'L' ? 'lost' : l.result === 'P' ? 'push' : null);
    const a = leg(1, 'p1', 'Bills −6.5', 'W'); const b = leg(2, 'p2', 'Rangers ML'); const c = leg(3, 'p3', 'Under 41.5', 'P');
    expect(carrier([a, b, c], o)).toBe(b);
    expect(carrier([a, b, { ...c, result: null }], o)).toBe(null); // two still going
    expect(carrier([{ ...a, result: 'L' }, b, c], o)).toBe(null); // already busted
    expect(carrier([b], o)).toBe(null); // one leg isn't a parlay
    expect(carrier([a, { ...b, result: 'W' }], o)).toBe(null); // nothing left
    expect(slipOutcome([a, { ...b, result: 'W' }, c], o)).toBe('won');
    expect(slipOutcome([a, b, c], o)).toBe(null);
    expect(slipOutcome([a, { ...b, result: 'L' }, c], o)).toBe('lost');
    expect(slipOutcome([{ ...a, result: 'P' }, { ...c }], o)).toBe(null); // all pushes: no hit
    expect(slipOutcome([], o)).toBe(null);
  });
  it('only reports news: the first look takes stock, feed blinks don’t count', () => {
    let out = { a: null, b: null, c: 'won' };
    const legs = [leg('a', 'p1', 'Bills −6.5'), leg('b', 'p2', 'Saquon 75+ rush yds'), leg('c', 'p3', 'Under 41.5')];
    const of = (l) => out[l.id];
    let r = sweatEvents(null, legs, of);
    expect(r.events).toEqual([]); // opening the app: no replay of the under that already hit
    expect(Object.fromEntries(Object.entries(r.seen).map(([k, v]) => [k, v.o]))).toEqual({ a: null, b: null, c: 'won' });
    out = { a: 'won', b: null, c: 'won' };
    r = sweatEvents(r.seen, legs, of);
    expect(r.events.map((e) => [e.leg.id, e.outcome])).toEqual([['a', 'won']]);
    expect(r.slip).toBe(null);
    out = { a: null, b: null, c: 'won' }; // the feed blinks
    r = sweatEvents(r.seen, legs, of);
    expect(r.events).toEqual([]);
    expect(r.seen.a.o).toBe('won');
    out = { a: 'won', b: null, c: 'won' }; // and comes back: not news again
    r = sweatEvents(r.seen, legs, of);
    expect(r.events).toEqual([]);
    out = { a: 'won', b: 'won', c: 'won' };
    r = sweatEvents(r.seen, legs, of);
    expect(r.events.map((e) => e.leg.id)).toEqual(['b']);
    expect(r.slip).toBe('won');
    // A leg added later is taken stock of, not announced
    const more = [...legs, leg('d', 'p1', 'Lions ML')];
    out.d = 'lost';
    r = sweatEvents(r.seen, more, of);
    expect(r.events).toEqual([]);
    // The commish changes a grade: that's news
    out.d = 'won';
    r = sweatEvents(r.seen, more, of);
    expect(r.events.map((e) => [e.leg.id, e.outcome])).toEqual([['d', 'won']]);
  });
  it('a leg’s live score arriving after the app opens isn’t news either', () => {
    const legs = [leg('a', 'p1', 'NYJ/NE under 41.5'), leg('b', 'p2', 'Bills −6.5')];
    let out = { a: null, b: null };
    let known = { a: false, b: false }; // scores haven't loaded yet
    const of = (l) => out[l.id];
    const kn = (l) => known[l.id];
    let r = sweatEvents(null, legs, of, kn);
    out = { a: 'won', b: null }; known = { a: true, b: true }; // scores arrive: the under was already final
    r = sweatEvents(r.seen, legs, of, kn);
    expect(r.events).toEqual([]); // no replay
    out = { a: 'won', b: 'lost' }; // then the Bills lose while you watch
    r = sweatEvents(r.seen, legs, of, kn);
    expect(r.events.map((e) => [e.leg.id, e.outcome])).toEqual([['b', 'lost']]);
  });
  it('a grade from the commish is news even if the score never loaded', () => {
    const l = leg('a', 'p1', 'Rangers ML');
    let r = sweatEvents(null, [l], () => null, () => false); // feed down: never known
    r = sweatEvents(r.seen, [{ ...l, result: 'L' }], () => 'lost', () => true);
    expect(r.events.map((e) => e.outcome)).toEqual(['lost']);
  });
  it('says what happened in one line', () => {
    const a = leg('a', 'p1', 'Bills −6.5'); const b = leg('b', 'p3', 'Steelers ML');
    expect(sweatMessage([{ leg: b, outcome: 'lost' }], null, names)).toBe('🤡 Mikey’s leg busted: Steelers ML');
    expect(sweatMessage([{ leg: a, outcome: 'won' }], null, names)).toBe('✅ Lotti’s leg hit: Bills −6.5');
    expect(sweatMessage([{ leg: a, outcome: 'push' }], null, names)).toBe('Lotti’s leg pushed: Bills −6.5');
    expect(sweatMessage([{ leg: a, outcome: 'won' }, { leg: b, outcome: 'lost' }], null, names)).toBe('🤡 2 legs just settled: 1 hit, 1 busted');
    expect(sweatMessage([{ leg: a, outcome: 'won' }], 'won', names)).toBe('🎉 The slip hit!');
    expect(sweatMessage([], null, names)).toBe('');
  });
  it('the bozo wears it for the week after the spin, never before you’ve watched', () => {
    const weeks = [{ id: 'w5', n: 5 }, { id: 'w7', n: 7 }, { id: 'w8', n: 8 }]; // weeks can skip numbers
    const spin = (id, week_id, landed_id, created_at, extra = {}) => ({ id, week_id, landed_id, created_at, ...extra });
    // Week 7 busted and got spun (then re-spun); week 8 is open now
    const spins = [spin('a', 'w5', 'p1', '2026-10-05T23:00Z'), spin('b', 'w7', 'p2', '2026-10-19T23:00Z'), spin('c', 'w7', 'p3', '2026-10-19T23:05Z')];
    expect(currentBozo({ weeks, spins })).toBe('p3'); // the re-spin counts
    expect(currentBozo({ weeks: weeks.slice(0, 2), spins })).toBe('p3'); // spun but week 8 not open yet
    expect(currentBozo({ weeks, spins: spins.map((s) => (s.id === 'c' ? { ...s, hidden: true } : s)) })).toBe(null); // not watched: no spoilers
    expect(currentBozo({ weeks: [...weeks, { id: 'w9', n: 9 }], spins })).toBe(null); // two weeks later: the face comes off
    expect(currentBozo({ weeks, spins: [...spins, spin('d', 'w8', 'p1', '2026-10-26T23:00Z')] })).toBe('p1'); // this week's spin takes over
    expect(currentBozo({ weeks, spins: [] })).toBe(null);
    expect(currentBozo({ weeks: [], spins })).toBe(null);
  });
  it('who’s here: one entry per player, their latest app, in player order; no names shared', () => {
    const players = [{ id: 'p1', name: 'Lotti' }, { id: 'p2', name: 'Sully' }, { id: 'p3', name: 'Mikey' }];
    const state = {
      k1: [{ p: 'p3', t: 'standings', at: 5 }],
      k2: [{ p: 'p1', t: 'week', at: 3 }],
      k3: [{ p: 'p1', t: 'wheel', at: 9 }], // Lotti on a second phone, more recently
      k4: [{ p: 'p9', t: 'week', at: 1 }], // not a player here
      k5: [{ p: null, t: 'week', at: 1 }], // hasn't claimed a player
      k6: [{ p: 'p2', t: 'nonsense', at: 2 }],
    };
    expect(herePeople(state, players)).toEqual([{ id: 'p1', tab: 'wheel', at: 9 }, { id: 'p2', tab: 'week', at: 2 }, { id: 'p3', tab: 'standings', at: 5 }]);
    expect(herePeople(null, players)).toEqual([]);
    expect(Object.keys(WHERE)).toEqual(['week', 'wheel', 'standings', 'history']);
  });
  it('the line above the slip, only when someone else is here', () => {
    const here = [{ id: 'p1', tab: 'week' }, { id: 'p2', tab: 'week' }, { id: 'p3', tab: 'standings' }];
    expect(hereLine(here, 'p1', names, true)).toEqual({ head: '3 sweating the slip', sub: 'Danny B & Mikey are here' });
    expect(hereLine(here, 'p1', names, false).head).toBe('3 here now');
    expect(hereLine(here.slice(0, 2), 'p1', names).sub).toBe('Danny B is here');
    expect(hereLine([{ id: 'p1', tab: 'week' }], 'p1', names)).toBe(null);
    expect(hereLine([], 'p1', names)).toBe(null);
  });
  it('notices who just opened the wheel', () => {
    const here = [{ id: 'p1', tab: 'wheel' }, { id: 'p2', tab: 'wheel' }, { id: 'p3', tab: 'week' }];
    expect(arrivals(['p1'], here, 'wheel', 'p1')).toEqual(['p2']);
    expect(arrivals(['p1', 'p2'], here, 'wheel', 'p1')).toEqual([]);
    expect(arrivals([], here, 'wheel', 'p1')).toEqual(['p2']); // never you
  });
  it('auto-grades finals, leaves typed legs alone, and flags the ones a person should check', () => {
    const fin = (tone, extra = {}) => ({ tone, done: true, clock: 'Final', margin: 3, ...extra });
    const picked = (id, bet, extra = {}) => ({ id, player_id: 'p1', pick: id, result: null, bet: { game: { id: 'g' }, ...bet }, ...extra });
    const spread = picked('spread', { type: 'spread', side: 'home', line: -3 });
    expect(autoCheck(spread, fin('win', { margin: 4 }))).toEqual({ result: 'W', margin: 4 });
    expect(autoCheck(spread, fin('loss', { margin: -2.5, clock: 'Final/OT' }))).toEqual({ result: 'L', margin: -2.5 });
    expect(autoCheck(spread, fin('push', { margin: 0 }))).toEqual({ result: 'P', margin: null });
    expect(autoCheck(spread, { tone: 'win', done: false, clock: 'Q4 2:00', margin: 4 })).toBe(null); // still going
    expect(autoCheck(spread, fin('loss', { clock: 'Postponed' }))).toBe(null); // never grade a postponed game
    expect(autoCheck(spread, fin('loss', { clock: 'Canceled' }))).toBe(null);
    expect(autoCheck({ ...spread, result: 'W' }, fin('loss'))).toBe(null); // already graded
    expect(autoCheck({ id: 't', pick: 'Steelers ML', result: null, bet: null }, fin('loss'))).toBe(null); // typed
    const yards = picked('yards', { type: 'prop', stat: 'rushYds', side: 'over', line: 74.5 });
    expect(autoCheck(yards, fin('loss', { margin: -12.5, found: true }))).toEqual({ result: 'L', margin: -12.5 });
    expect(autoCheck(yards, fin('win', { margin: 0.5, found: true }))).toEqual({ why: 'close' }); // 75 on 74.5: official stats can differ
    expect(autoCheck(yards, fin('loss', { margin: -74.5, found: false }))).toEqual({ why: 'absent' }); // didn't play: DraftKings voids it
    const catches = picked('catches', { type: 'prop', stat: 'rec', side: 'over', line: 4.5 });
    expect(autoCheck(catches, fin('win', { margin: 0.5, found: true }))).toEqual({ result: 'W', margin: 0.5 }); // counts aren't close calls
    const td = picked('td', { type: 'prop', stat: 'td' });
    expect(autoCheck(td, fin('loss', { margin: null, found: true }))).toEqual({ result: 'L', margin: null });
    const status = { spread: fin('win', { margin: 4 }), yards: fin('win', { margin: 0.5, found: true }), catches: fin('win', { margin: 1.5, found: true }) };
    const all = autoGrades([spread, yards, catches], (l) => status[l.id]);
    expect(all.grade.map((g) => g.leg.id)).toEqual(['spread', 'catches']);
    expect(all.check).toEqual([{ leg: yards, why: 'close' }]);
    // The commish cleared a grade by hand: auto-grading leaves it alone
    expect(autoGrades([spread, yards, catches], (l) => status[l.id], new Set(['spread', 'yards'])).grade.map((g) => g.leg.id)).toEqual(['catches']);
  });
});

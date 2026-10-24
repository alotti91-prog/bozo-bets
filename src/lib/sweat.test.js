import { describe, it, expect } from 'vitest';
import { legOutcome, carrier, slipOutcome, sweatEvents, sweatMessage } from './sweat.js';

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
    expect(r.seen).toEqual({ a: null, b: null, c: 'won' });
    out = { a: 'won', b: null, c: 'won' };
    r = sweatEvents(r.seen, legs, of);
    expect(r.events.map((e) => [e.leg.id, e.outcome])).toEqual([['a', 'won']]);
    expect(r.slip).toBe(null);
    out = { a: null, b: null, c: 'won' }; // the feed blinks
    r = sweatEvents(r.seen, legs, of);
    expect(r.events).toEqual([]);
    expect(r.seen.a).toBe('won');
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
  it('says what happened in one line', () => {
    const a = leg('a', 'p1', 'Bills −6.5'); const b = leg('b', 'p3', 'Steelers ML');
    expect(sweatMessage([{ leg: b, outcome: 'lost' }], null, names)).toBe('🤡 Mikey’s leg busted: Steelers ML');
    expect(sweatMessage([{ leg: a, outcome: 'won' }], null, names)).toBe('✅ Lotti’s leg hit: Bills −6.5');
    expect(sweatMessage([{ leg: a, outcome: 'push' }], null, names)).toBe('Lotti’s leg pushed: Bills −6.5');
    expect(sweatMessage([{ leg: a, outcome: 'won' }, { leg: b, outcome: 'lost' }], null, names)).toBe('🤡 2 legs just settled: 1 hit, 1 busted');
    expect(sweatMessage([{ leg: a, outcome: 'won' }], 'won', names)).toBe('🎉 The slip hit!');
    expect(sweatMessage([], null, names)).toBe('');
  });
});

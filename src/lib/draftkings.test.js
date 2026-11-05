import { describe, it, expect } from 'vitest';
import { dkOutcomeId } from './espn.js';
import { normalizeProps } from './props.js';
import { dkLeg, dkSlip, dkUrl, dkPriceChanges } from './draftkings.js';

const ESPN_LINK = 'https://sportsbook.draftkings.com/gateway?s=__s__&wpcid=__wpcid__&wpsrc=413&wpcn=ESPN&wpscn=Widget&wpcrn=BetSlipDeepLink&wpscid=__wpscid__&wpcrid=xx&preurl=https%3A%2F%2Fsportsbook.draftkings.com%2Fevent%2F34118009%3Foutcomes%3D0ML84695442_1';

describe('DraftKings pick ids', () => {
  it('reads the id out of ESPN’s tracking link, a plain link, or a SportsGameOdds link', () => {
    expect(dkOutcomeId(ESPN_LINK)).toBe('0ML84695442_1');
    expect(dkOutcomeId('https://sportsbook.draftkings.com/event/34118095?outcomes=0HC84695528N250_3')).toBe('0HC84695528N250_3');
    expect(dkOutcomeId('https://sportsbook.draftkings.com/event/1?outcomes=0QA123%2399_1')).toBe('0QA123#99_1');
  });
  it('ignores anything else', () => {
    expect(dkOutcomeId('https://sportsbook.fanduel.com/addToBetslip?marketId=1&selectionId=2')).toBe(null);
    expect(dkOutcomeId('https://sportsbook.draftkings.com/event/34118009')).toBe(null);
    expect(dkOutcomeId('not a link draftkings')).toBe(null);
    expect(dkOutcomeId('https://sportsbook.draftkings.com/?outcomes=<script>')).toBe(null);
    expect(dkOutcomeId(null)).toBe(null);
  });
  it('keeps DraftKings’ prop ids when SportsGameOdds has them', () => {
    const dl = (id) => `https://sportsbook.draftkings.com/event/34118100?outcomes=${id}`;
    const lines = normalizeProps({
      players: { DJ_MOORE_1_NFL: { name: 'DJ Moore' } },
      odds: {
        a: { statID: 'receiving_yards', playerID: 'DJ_MOORE_1_NFL', periodID: 'game', betTypeID: 'ou', sideID: 'over', byBookmaker: { draftkings: { odds: '-115', overUnder: '62.5', deeplink: dl('0QA1O_1') } } },
        b: { statID: 'receiving_yards', playerID: 'DJ_MOORE_1_NFL', periodID: 'game', betTypeID: 'ou', sideID: 'under', byBookmaker: { draftkings: { odds: '-105', overUnder: '62.5' } } },
        c: { statID: 'touchdowns', playerID: 'DJ_MOORE_1_NFL', periodID: 'game', betTypeID: 'yn', sideID: 'yes', byBookmaker: { draftkings: { odds: '+165', deeplink: dl('0QA2Y_1') } } },
      },
    });
    expect(lines['dj moore']).toEqual({ recYds: { l: 62.5, o: -115, oi: '0QA1O_1', u: -105 }, td: { y: 165, yi: '0QA2Y_1' } });
  });
});

const team = (abbr) => ({ id: abbr, abbr, short: abbr, name: abbr });
const G = { id: '401', start: '2026-10-25T17:00Z', short: 'SF @ ATL', home: team('ATL'), away: team('SF') };
const game = (over = {}) => ({
  ...G, state: 'pre',
  odds: { board: {
    spread: { away: { line: -2.5, price: -115 }, home: { line: 2.5, price: -105 } },
    ml: { away: -140, home: 124 },
    total: { line: 47.5, over: -110, under: -110 },
    dk: { spread: { away: '0HC1N250_3', home: '0HC1P250_1' }, ml: { away: '0ML1_3', home: '0ML1_1' }, over: '0OU1O4750_1', under: null },
  } },
  ...over,
});
const leg = (id, bet, odds = -110, extra = {}) => ({ id, player_id: 'p' + id, pick: 'x', odds, bet: bet && { v: 1, sport: 'nfl', game: G, ...bet }, ...extra });
const LINES = { 'bijan robinson': { rushYds: { l: 79.5, o: -115, u: -115, oi: '0QB_O', ui: '0QB_U' }, td: { y: 110, yi: '0QB_TD' } } };
const bijan = { id: '9', name: 'Bijan Robinson' };

describe('putting a leg on DraftKings', () => {
  it('finds DraftKings’ pick and its current price', () => {
    expect(dkLeg(leg(1, { type: 'ml', side: 'home' }), game())).toEqual({ id: '0ML1_1', price: 124 });
    expect(dkLeg(leg(2, { type: 'spread', side: 'away', line: -2.5 }), game())).toEqual({ id: '0HC1N250_3', price: -115 });
    expect(dkLeg(leg(3, { type: 'total', side: 'over', line: 47.5 }), game())).toEqual({ id: '0OU1O4750_1', price: -110 });
    expect(dkLeg(leg(4, { type: 'prop', stat: 'rushYds', side: 'under', line: 79.5, player: bijan }), game(), LINES)).toEqual({ id: '0QB_U', price: -115 });
    expect(dkLeg(leg(5, { type: 'prop', stat: 'td', side: null, line: null, player: bijan }), game(), LINES)).toEqual({ id: '0QB_TD', price: 110 });
  });
  it('says why when it can’t', () => {
    expect(dkLeg(leg(1, null), game())).toEqual({ why: 'typed' });
    expect(dkLeg(leg(2, { type: 'ml', side: 'home' }), undefined)).toEqual({ why: 'missing' });
    expect(dkLeg(leg(3, { type: 'ml', side: 'home' }), game({ state: 'in' }))).toEqual({ why: 'started' });
    expect(dkLeg(leg(4, { type: 'spread', side: 'away', line: -3 }), game())).toEqual({ why: 'moved', line: -2.5 });
    expect(dkLeg(leg(5, { type: 'total', side: 'under', line: 47.5 }), game())).toEqual({ why: 'missing' }); // no id for the under
    expect(dkLeg(leg(6, { type: 'total', side: 'over', line: 48.5 }), game())).toEqual({ why: 'moved', line: 47.5 });
    expect(dkLeg(leg(7, { type: 'prop', stat: 'rushYds', side: 'over', line: 74.5, player: bijan }), game(), LINES)).toEqual({ why: 'moved', line: 79.5 });
    expect(dkLeg(leg(8, { type: 'prop', stat: 'recYds', side: 'over', line: 20.5, player: bijan }), game(), LINES)).toEqual({ why: 'missing' });
    expect(dkLeg(leg(9, { type: 'ml', side: 'home' }), game({ odds: null }))).toEqual({ why: 'missing' });
  });
});

describe('the DraftKings slip', () => {
  it('builds one link for every leg that can go, and lists the rest', () => {
    const legs = [
      leg(1, { type: 'ml', side: 'home' }, 124),
      leg(2, { type: 'spread', side: 'away', line: -2.5 }, -110),
      leg(3, null, 150),
      leg(4, { type: 'spread', side: 'away', line: -3 }),
      leg(5, { type: 'ml', side: 'away' }, -150, { result: 'W' }), // settled: left out
    ];
    const s = dkSlip(legs, () => game());
    expect(s.ready.map((r) => [r.leg.id, r.id, r.price, r.was])).toEqual([[1, '0ML1_1', 124, null], [2, '0HC1N250_3', -115, -110]]);
    expect(s.manual.map((m) => [m.leg.id, m.why, m.line])).toEqual([[3, 'typed', null], [4, 'moved', -2.5]]);
    expect(s.url).toBe('https://sportsbook.draftkings.com/?outcomes=0ML1_1+0HC1N250_3');
    expect(s.sameGame).toBe(true); // legs 1, 2 and 4 are all SF @ ATL
    expect(dkPriceChanges(s)).toEqual([{ id: 2, odds: -115 }]);
  });
  it('has no link when nothing can go, and spots separate games', () => {
    const s = dkSlip([leg(1, null)], () => undefined);
    expect(s.url).toBe(null);
    expect(s.sameGame).toBe(false);
    expect(dkUrl(['a#1', 'b', 'a#1'])).toBe('https://sportsbook.draftkings.com/?outcomes=a%231+b');
  });
});

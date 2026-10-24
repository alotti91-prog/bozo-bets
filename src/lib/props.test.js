import { describe, it, expect } from 'vitest';
import { sgoTeamID, hourOf, parsePropsQuery, propOddIDs, propsUrl, findEvent, normalizeProps, lineFor, propPrice, lineLabel } from './props.js';
import propsHandler from '../../api/props.js';

const now = Date.parse('2026-10-24T12:00:00Z');
// Shaped like SportsGameOdds' /v2/events (see their docs): players keyed by playerID, odds keyed by oddID.
const event = {
  eventID: 'ev1',
  teams: { home: { teamID: 'CHICAGO_BEARS_NFL', names: { long: 'Chicago Bears', medium: 'Bears', short: 'CHI' } }, away: { teamID: 'NEW_ENGLAND_PATRIOTS_NFL', names: { long: 'New England Patriots', medium: 'Patriots', short: 'NE' } } },
  players: {
    DJ_MOORE_1_NFL: { playerID: 'DJ_MOORE_1_NFL', teamID: 'CHICAGO_BEARS_NFL', firstName: 'DJ', lastName: 'Moore', name: 'DJ Moore' },
    DANDRE_SWIFT_1_NFL: { playerID: 'DANDRE_SWIFT_1_NFL', teamID: 'CHICAGO_BEARS_NFL', firstName: "D'Andre", lastName: 'Swift', name: "D'Andre Swift" },
    CALEB_WILLIAMS_1_NFL: { playerID: 'CALEB_WILLIAMS_1_NFL', teamID: 'CHICAGO_BEARS_NFL', firstName: 'Caleb', lastName: 'Williams' },
  },
  odds: {
    'receiving_yards-DJ_MOORE_1_NFL-game-ou-over': { statID: 'receiving_yards', playerID: 'DJ_MOORE_1_NFL', periodID: 'game', betTypeID: 'ou', sideID: 'over', byBookmaker: { draftkings: { odds: '-115', overUnder: '62.5', available: true }, fanduel: { odds: '-110', overUnder: '63.5', available: true } } },
    'receiving_yards-DJ_MOORE_1_NFL-game-ou-under': { statID: 'receiving_yards', playerID: 'DJ_MOORE_1_NFL', periodID: 'game', betTypeID: 'ou', sideID: 'under', byBookmaker: { draftkings: { odds: '-105', overUnder: '62.5', available: true } } },
    'receiving_yards-DJ_MOORE_1_NFL-1h-ou-over': { statID: 'receiving_yards', playerID: 'DJ_MOORE_1_NFL', periodID: '1h', betTypeID: 'ou', sideID: 'over', byBookmaker: { draftkings: { odds: '-115', overUnder: '30.5' } } },
    'touchdowns-DJ_MOORE_1_NFL-game-yn-yes': { statID: 'touchdowns', playerID: 'DJ_MOORE_1_NFL', periodID: 'game', betTypeID: 'yn', sideID: 'yes', byBookmaker: { draftkings: { odds: '+165', available: true } } },
    'rushing+receiving_yards-DANDRE_SWIFT_1_NFL-game-ou-over': { statID: 'rushing+receiving_yards', statEntityID: 'DANDRE_SWIFT_1_NFL', periodID: 'game', betTypeID: 'ou', sideID: 'over', byBookmaker: { draftkings: { odds: 'even', overUnder: '79.5' } } },
    'rushing_yards-DANDRE_SWIFT_1_NFL-game-ou-over': { statID: 'rushing_yards', playerID: 'DANDRE_SWIFT_1_NFL', periodID: 'game', betTypeID: 'ou', sideID: 'over', byBookmaker: { draftkings: { odds: '-110', overUnder: '59.5', available: false } } },
    'passing_yards-CALEB_WILLIAMS_1_NFL-game-ou-over': { statID: 'passing_yards', playerID: 'CALEB_WILLIAMS_1_NFL', periodID: 'game', betTypeID: 'ou', sideID: 'over', byBookmaker: { fanduel: { odds: '-110', overUnder: '224.5' } } },
    'points-home-game-ml-home': { statID: 'points', statEntityID: 'home', periodID: 'game', betTypeID: 'ml', sideID: 'home', byBookmaker: { draftkings: { odds: '-160' } } },
  },
};

describe('DraftKings prop lines (SportsGameOdds)', () => {
  it('builds team ids and rounds kickoff to the hour', () => {
    expect(sgoTeamID('CHI')).toBe('CHICAGO_BEARS_NFL');
    expect(sgoTeamID('SF')).toBe('SAN_FRANCISCO_49ERS_NFL');
    expect(sgoTeamID('XYZ')).toBe(null);
    expect(hourOf('2026-10-26T00:15:00Z')).toBe('2026-10-26T00:00:00Z');
    expect(hourOf('nope')).toBe(null);
  });
  it('only takes real, upcoming NFL games (so made-up URLs can’t use up the allowance)', () => {
    expect(parsePropsQuery({ home: 'CHI', away: 'NE', start: '2026-10-26T00:00:00Z' }, now)).toEqual({ home: 'CHI', away: 'NE', start: Date.parse('2026-10-26T00:00:00Z') });
    expect(parsePropsQuery({ home: 'CHI', away: 'NE', start: '2026-10-26T00:00Z' }, now).error).toBeUndefined();
    expect(parsePropsQuery({ home: 'CHI', away: 'NE', start: '2026-10-26T00:15:00Z' }, now).error).toMatch(/hour/);
    expect(parsePropsQuery({ home: 'CHI', away: 'CHI', start: '2026-10-26T00:00:00Z' }, now).error).toBeTruthy();
    expect(parsePropsQuery({ home: 'XYZ', away: 'NE', start: '2026-10-26T00:00:00Z' }, now).error).toBeTruthy();
    expect(parsePropsQuery({ home: 'CHI', away: 'NE', start: '2026-12-26T00:00:00Z' }, now).error).toMatch(/coming up/);
    expect(parsePropsQuery({ home: 'CHI', away: 'NE', start: '2026-10-26T00:00:00Z', x: '1' }, now).error).toMatch(/Unknown/);
  });
  it('asks for one game, only our stats, only DraftKings', () => {
    expect(propOddIDs()).toHaveLength(19); // 9 over/unders × 2 sides + anytime TD
    expect(propOddIDs()).toContain('rushing+receiving_yards-PLAYER_ID-game-ou-under');
    expect(propOddIDs()).toContain('touchdowns-PLAYER_ID-game-yn-yes');
    const q = { home: 'CHI', away: 'NE', start: Date.parse('2026-10-26T00:00:00Z') };
    const u = new URL(propsUrl(q, 'team'));
    expect(u.origin + u.pathname).toBe('https://api.sportsgameodds.com/v2/events');
    expect(u.searchParams.get('teamID')).toBe('CHICAGO_BEARS_NFL');
    expect(u.searchParams.get('bookmakerID')).toBe('draftkings');
    expect(u.searchParams.get('oddID').split(',')).toContain('rushing+receiving_yards-PLAYER_ID-game-ou-over');
    expect(u.searchParams.get('startsAfter')).toBe('2026-10-25T21:00:00.000Z');
    expect(u.searchParams.get('apiKey')).toBe(null); // the key goes in a header, not the address
    expect(new URL(propsUrl(q, 'window')).searchParams.get('teamID')).toBe(null);
  });
  it('finds the game by team id or by name', () => {
    const q = { home: 'CHI', away: 'NE' };
    expect(findEvent({ data: [event] }, q)).toBe(event);
    const renamed = { ...event, teams: { home: { teamID: 'CHI_BEARS', names: { long: 'Chicago Bears' } }, away: { teamID: 'NE_PATS', names: { medium: 'Patriots' } } } };
    expect(findEvent({ data: [renamed] }, q)).toBe(renamed);
    expect(findEvent({ data: [event] }, { home: 'NE', away: 'CHI' })).toBe(null); // home/away swapped: a different game
    expect(findEvent({ data: [] }, q)).toBe(null);
    expect(findEvent(null, q)).toBe(null);
  });
  it('keeps DraftKings’ full-game lines, keyed by player name', () => {
    expect(normalizeProps(event)).toEqual({
      'dj moore': { recYds: { l: 62.5, o: -115, u: -105 }, td: { y: 165 } },
      'dandre swift': { rushRecYds: { l: 79.5, o: 100 } }, // rushing yards: DraftKings closed it
    }); // Caleb: only FanDuel has him
    expect(normalizeProps(null)).toEqual({});
  });
  it('reads a line and a price for what’s picked', () => {
    const lines = normalizeProps(event);
    const moore = { id: '1', name: 'DJ Moore', team: 'CHI' };
    expect(lineFor(lines, moore, 'recYds')).toEqual({ l: 62.5, o: -115, u: -105 });
    expect(lineFor(lines, { name: 'D’Andre Swift' }, 'rushRecYds')).toEqual({ l: 79.5, o: 100 });
    expect(lineFor(lines, moore, 'rec')).toBe(null);
    expect(lineFor(null, moore, 'recYds')).toBe(null);
    const b = { type: 'prop', player: moore, stat: 'recYds', side: 'over', lineText: '62.5' };
    expect(propPrice(b, lines)).toBe(-115);
    expect(propPrice({ ...b, side: 'under' }, lines)).toBe(-105);
    expect(propPrice({ ...b, side: null }, lines)).toBe(null);
    expect(propPrice({ ...b, lineText: '70.5' }, lines)).toBe(null); // not DraftKings' number
    expect(propPrice({ ...b, lineText: '' }, lines)).toBe(null);
    expect(propPrice({ ...b, stat: 'td', side: null, lineText: '' }, lines)).toBe(165);
    expect(propPrice({ ...b, type: 'total' }, lines)).toBe(null);
    expect([lineLabel({ l: 62.5 }), lineLabel({ y: 165 }), lineLabel({ y: -120 }), lineLabel(null)]).toEqual(['62.5', '+165', '−120', '']);
  });
  it('the /api/props function: needs the key, falls back to the kickoff window, caches 30 minutes', async () => {
    const saved = { fetch: globalThis.fetch, key: process.env.SPORTSGAMEODDS_KEY };
    const res = () => { const r = { headers: {}, setHeader(k, v) { r.headers[k] = v; }, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
    const start = hourOf(new Date(Date.now() + 2 * 86400000).toISOString());
    const query = { home: 'CHI', away: 'NE', start };
    try {
      delete process.env.SPORTSGAMEODDS_KEY;
      expect((await propsHandler({ query }, res())).code).toBe(503);
      process.env.SPORTSGAMEODDS_KEY = 'test-key';
      expect((await propsHandler({ query: { ...query, home: 'NOPE' } }, res())).code).toBe(400);
      const calls = [];
      globalThis.fetch = async (url, opts) => { calls.push([url, opts.headers['x-api-key']]); return { ok: true, json: async () => ({ data: calls.length === 1 ? [] : [event] }) }; };
      const r = await propsHandler({ query }, res());
      expect(r.code).toBe(200);
      expect(r.body.via).toBe('window'); // the team id guess found nothing, the window did
      expect(r.body.lines['dj moore'].recYds.l).toBe(62.5);
      expect(calls.map(([u]) => new URL(u).searchParams.has('teamID'))).toEqual([true, false]);
      expect(calls.every(([, k]) => k === 'test-key')).toBe(true);
      expect(r.headers['Cache-Control']).toMatch(/s-maxage=1800/);
      globalThis.fetch = async () => ({ ok: false, status: 401 });
      const bad = await propsHandler({ query }, res());
      expect(bad.code).toBe(502);
      expect(bad.body.error).toMatch(/401/);
      expect(bad.body.error).not.toMatch(/test-key/);
    } finally {
      globalThis.fetch = saved.fetch;
      if (saved.key == null) delete process.env.SPORTSGAMEODDS_KEY; else process.env.SPORTSGAMEODDS_KEY = saved.key;
    }
  });
});

import { describe, it, expect } from 'vitest';
import { dec, amerFmt, fmtOdds, parseOdds, weekInfo, money, signed } from './odds.js';
import { standings, hitPct, bozoBelt } from './stats.js';
import { indexAt, targetRotation, restRotation, wheelContext, unwatchedSpin, hideSpin, TAU, spinRounds, spinMs, isElimination, SPIN_MS } from './wheel.js';
import { nflWeek, nflWeekDate, seasonOf } from './nfl.js';
import { countdown, lockState, toLocalInput, ago, updatedAgo, fmtTime, weeklyRule } from './deadline.js';
import { initials } from './ui.js';
import { isPrivateAddress } from './site.js';
import { RELEASES, unseenReleases } from './releases.js';
import { slipPaths } from './slip.js';
import { swipeDirection, swipeTarget } from './swipe.js';
import { espnUrl, espnUrls, daysIn, mergeEvents, weekDates, normalizeScoreboard, normalizeSummary, normalizeRoster, oddsBoard } from './espn.js';
import { pickText, parseLine, oddsLine, liveStatus, aliveCount, betProblem, fmtLine, shortClock, legState, suggestedGrade, gradeHidden, boardOptions, pickFromBoard, isBoardPick, betFromPick, boardPrice, emptyPick, PROP_CATS, STAT_POS, propCatOf, propPlayers, STATS } from './bets.js';
import espnHandler from '../../api/espn.js';
import { runChecks } from '../../api/health.js';
import { normalizeDepth, injuryTag } from './depth.js';
import depthHandler from '../../api/depth.js';

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
  it('says how long ago scores updated', () => {
    expect(updatedAgo(5e3)).toBe('just now');
    expect(updatedAgo(20e3)).toBe('20s ago');
    expect(updatedAgo(3 * 60e3)).toBe('3m ago');
    expect(updatedAgo(2 * 3600e3)).toBe('2h ago');
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

// ESPN-shaped samples, trimmed to the fields we read (checked against the live feed).
const SB = { events: [{
  id: '401873010', date: '2026-10-23T00:15Z', shortName: 'NE @ CHI',
  status: { displayClock: '6:12', period: 3, type: { state: 'in', completed: false, shortDetail: '6:12 - 3rd' } },
  competitions: [{ odds: [{ details: 'CHI -3', overUnder: 50.5 }], competitors: [
    { id: '3', homeAway: 'home', score: '17', team: { id: '3', abbreviation: 'CHI', displayName: 'Chicago Bears', shortDisplayName: 'Bears' } },
    { id: '17', homeAway: 'away', score: '10', team: { id: '17', abbreviation: 'NE', displayName: 'New England Patriots', shortDisplayName: 'Patriots' } },
  ] }],
}] };
const SUM = {
  header: { competitions: [{ id: '401873010', status: { type: { state: 'in', shortDetail: '6:12 - 3rd' } }, competitors: [
    { homeAway: 'home', score: '17', team: { id: '3', abbreviation: 'CHI', displayName: 'Chicago Bears', shortDisplayName: 'Bears' } },
    { homeAway: 'away', score: '10', team: { id: '17', abbreviation: 'NE', displayName: 'New England Patriots', shortDisplayName: 'Patriots' } },
  ] }] },
  boxscore: { players: [{ team: { abbreviation: 'CHI' }, statistics: [
    { name: 'passing', keys: ['completions/passingAttempts', 'passingYards', 'yardsPerPassAttempt', 'passingTouchdowns', 'interceptions'], labels: ['C/ATT', 'YDS', 'AVG', 'TD', 'INT'],
      athletes: [{ athlete: { id: '111', displayName: 'Caleb Williams' }, stats: ['18/27', '214', '7.9', '2', '1'] }] },
    { name: 'rushing', keys: ['rushingAttempts', 'rushingYards', 'yardsPerRushAttempt', 'rushingTouchdowns', 'longRushing'], labels: ['CAR', 'YDS', 'AVG', 'TD', 'LONG'],
      athletes: [{ athlete: { id: '222', displayName: 'D\'Andre Swift' }, stats: ['14', '52', '3.7', '1', '12'] }] },
    { name: 'receiving', labels: ['REC', 'YDS', 'AVG', 'TD', 'LONG'],
      athletes: [{ athlete: { id: '222', displayName: 'D\'Andre Swift' }, stats: ['3', '21', '7.0', '0', '11'] }] },
  ] }] },
};

describe('ESPN feed', () => {
  it('only builds addresses we allow', () => {
    expect(espnUrl({ kind: 'scoreboard', sport: 'nfl', dates: '20261020-20261026' })).toBe('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20261020-20261026');
    expect(espnUrl({ kind: 'scoreboard', sport: 'ncaaf', dates: '20261024' })).toContain('groups=80');
    expect(espnUrl({ kind: 'summary', sport: 'nfl', event: '401873010' })).toContain('summary?event=401873010');
    expect(espnUrl({ kind: 'roster', sport: 'nfl', team: '21' })).toContain('/teams/21/roster');
    expect(espnUrl({ kind: 'summary', sport: 'nfl', event: '1;drop' })).toBe(null);
    expect(espnUrl({ kind: 'scoreboard', sport: 'soccer', dates: '20261020' })).toBe(null);
    expect(espnUrl({ kind: 'news', sport: 'nfl' })).toBe(null);
  });
  it('asks for a week one day at a time (ESPN refuses ranges)', () => {
    expect(daysIn('20261030-20261102')).toEqual(['20261030', '20261031', '20261101', '20261102']);
    expect(daysIn('20261020')).toEqual(['20261020']);
    expect(daysIn('20261001-20261031')).toEqual([]); // too long
    expect(espnUrls({ kind: 'scoreboard', sport: 'nfl', dates: '20261020-20261026' })).toHaveLength(7);
    expect(espnUrls({ kind: 'scoreboard', sport: 'nfl', dates: '20261020-20261026' })[0]).toContain('dates=20261020');
    expect(espnUrls({ kind: 'scoreboard', sport: 'nba', dates: '20261020-20261026' })).toHaveLength(7);
    expect(espnUrls({ kind: 'scoreboard', sport: 'nba', dates: '20261022' })).toHaveLength(1);
    expect(espnUrls({ kind: 'scoreboard', sport: 'nfl', dates: 'x' })).toEqual([]);
    expect(mergeEvents([{ events: [{ id: '1' }, { id: '2' }] }, { events: [{ id: '2' }, { id: '3' }] }]).events.map((e) => e.id)).toEqual(['1', '2', '3']);
  });
  it('finds the Tuesday-to-Monday betting week', () => {
    expect(weekDates(new Date(2026, 9, 22))).toBe('20261020-20261026'); // Thursday
    expect(weekDates(new Date(2026, 9, 20))).toBe('20261020-20261026'); // Tuesday
    expect(weekDates(new Date(2026, 9, 26))).toBe('20261020-20261026'); // Monday night
    expect(weekDates(new Date(2026, 9, 27))).toBe('20261027-20261102');
  });
  it('trims the scoreboard', () => {
    const [g] = normalizeScoreboard(SB, 'nfl');
    expect(g).toMatchObject({ id: '401873010', short: 'NE @ CHI', state: 'in', detail: '6:12 - 3rd', odds: { details: 'CHI -3', total: 50.5 } });
    expect(g.home).toEqual({ id: '3', abbr: 'CHI', name: 'Chicago Bears', short: 'Bears', score: 17 });
    expect(g.away.score).toBe(10);
  });
  it('reads player stats from the box score, by key or by label', () => {
    const s = normalizeSummary(SUM, 'nfl', '401873010');
    expect(s.state).toBe('in');
    const qb = s.players.find((p) => p.id === '111');
    expect(qb.stats).toMatchObject({ passYds: 214, passTd: 2, int: 1, passCmp: 18 });
    const rb = s.players.find((p) => p.id === '222');
    expect(rb.stats).toMatchObject({ rushYds: 52, rushAtt: 14, rushTd: 1, rec: 3, recYds: 21, rushRecYds: 73, td: 1 });
    expect(normalizeSummary({}, 'nfl', '1')).toMatchObject({ state: 'pre', players: [] });
  });
  it('keeps skill players from a roster, either shape', () => {
    const grouped = { athletes: [{ position: 'offense', items: [
      { id: '1', displayName: 'Jalen Hurts', position: { abbreviation: 'QB' } },
      { id: '2', displayName: 'Saquon Barkley', position: { abbreviation: 'RB' } },
      { id: '3', displayName: 'Jordan Mailata', position: { abbreviation: 'OT' } },
    ] }] };
    expect(normalizeRoster(grouped).map((p) => p.name)).toEqual(['Jalen Hurts', 'Saquon Barkley']);
    expect(normalizeRoster({ athletes: [{ id: '9', displayName: 'Some WR', position: { abbreviation: 'WR' } }] })).toHaveLength(1);
  });
  it('the server piece refuses odd requests and caches live games briefly', async () => {
    const res = () => { const r = { headers: {}, code: 0, body: null }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
    const bad = res(); await espnHandler({ query: { kind: 'summary', sport: 'nfl', event: 'x' } }, bad);
    expect(bad.code).toBe(400);
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, json: async () => SB });
    try {
      const ok = res(); await espnHandler({ query: { kind: 'scoreboard', sport: 'nfl', dates: '20261020-20261026' } }, ok);
      expect(ok.code).toBe(200);
      expect(ok.body.games[0].short).toBe('NE @ CHI');
      expect(ok.headers['Cache-Control']).toContain('s-maxage=20');
      let calls = 0;
      globalThis.fetch = async () => { calls++; return { ok: calls !== 2, json: async () => SB }; }; // one day fails; the rest still count
      const week = res(); await espnHandler({ query: { kind: 'scoreboard', sport: 'nfl', dates: '20261020-20261026' } }, week);
      expect(calls).toBe(7);
      expect(week.code).toBe(200);
      expect(week.body.games).toHaveLength(1); // the same game from every day, once
      globalThis.fetch = async () => ({ ok: false, status: 503 });
      const down = res(); await espnHandler({ query: { kind: 'scoreboard', sport: 'nfl', dates: '20261020' } }, down);
      expect(down.code).toBe(502);
    } finally { globalThis.fetch = realFetch; }
  });
});

describe('health check', () => {
  const ok = (json) => ({ ok: true, status: 200, json: async () => json });
  const withEnv = async (fn) => {
    const saved = { url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY, f: globalThis.fetch };
    process.env.VITE_SUPABASE_URL = 'https://abc.supabase.co'; process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_x';
    try { await fn(); } finally {
      globalThis.fetch = saved.f;
      if (saved.url === undefined) delete process.env.VITE_SUPABASE_URL; else process.env.VITE_SUPABASE_URL = saved.url;
      if (saved.key === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY; else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = saved.key;
    }
  };
  it('passes when Supabase and ESPN both answer', () => withEnv(async () => {
    const asked = [];
    globalThis.fetch = async (u) => { asked.push(String(u)); return String(u).includes('supabase') ? ok([]) : String(u).includes('sleeper') ? ok({ season: '2026', week: 8 }) : ok(SB); };
    const r = await runChecks(new Date(2026, 9, 25));
    expect(r).toMatchObject({ ok: true, checks: { supabase: 'ok', espn: 'ok', sleeper: 'ok' } });
    expect(asked.some((u) => u.endsWith('/v1/state/nfl'))).toBe(true);
    expect(asked.some((u) => u.includes('/v1/players/'))).toBe(false); // never the 5MB list
    expect(asked.some((u) => u.includes('/rest/v1/leagues'))).toBe(true);
    expect(asked.some((u) => u.includes('dates=20261025'))).toBe(true);
  }));
  it('names what broke', () => withEnv(async () => {
    globalThis.fetch = async (u) => (String(u).includes('supabase') ? { ok: false, status: 540 } : ok({ nope: true }));
    const r = await runChecks();
    expect(r.ok).toBe(false);
    expect(r.checks.supabase).toMatch(/540.*paused/);
    expect(r.checks.espn).toMatch(/changed shape/);
    expect(r.checks.sleeper).toMatch(/Sleeper’s state changed shape/);
  }));
});

describe('structured legs', () => {
  const game = { id: 'g', start: '2026-10-25T17:00Z', short: 'DET @ GB', home: { id: '9', abbr: 'GB', short: 'Packers', name: 'Green Bay Packers' }, away: { id: '8', abbr: 'DET', short: 'Lions', name: 'Detroit Lions' } };
  const live = (a, h, state = 'in', players = []) => ({ state, detail: state === 'post' ? 'Final' : '6:12 - 3rd', home: { abbr: 'GB', score: h }, away: { abbr: 'DET', score: a }, players });
  it('writes the pick text', () => {
    expect(pickText({ type: 'spread', side: 'away', line: -3.5, game })).toBe('Lions −3.5');
    expect(pickText({ type: 'spread', side: 'home', line: 3.5, game })).toBe('Packers +3.5');
    expect(pickText({ type: 'ml', side: 'home', game })).toBe('Packers ML');
    expect(pickText({ type: 'total', side: 'over', line: 44.5, game })).toBe('DET/GB over 44.5');
    expect(pickText({ type: 'prop', side: 'over', line: 74.5, stat: 'rushYds', player: { name: 'Jahmyr Gibbs' }, game })).toBe('Jahmyr Gibbs 75+ rush yds');
    expect(pickText({ type: 'prop', side: 'under', line: 1.5, stat: 'passTd', player: { name: 'Jordan Love' }, game })).toBe('Jordan Love under 1.5 pass TDs');
    expect(pickText({ type: 'prop', stat: 'td', player: { name: 'Jahmyr Gibbs' }, game })).toBe('Jahmyr Gibbs anytime TD');
    expect(fmtLine(0)).toBe('PK');
  });
  it('reads lines people type, and ESPN’s line for a team', () => {
    expect(parseLine('3.5')).toBe(3.5); expect(parseLine('-3.5')).toBe(-3.5); expect(parseLine('−7')).toBe(-7); expect(parseLine('+3')).toBe(3);
    expect(parseLine('249.5')).toBe(249.5); expect(parseLine('abc')).toBe(null); expect(parseLine('3.25')).toBe(null);
    expect(oddsLine({ details: 'CHI -3' }, 'CHI')).toBe(-3); expect(oddsLine({ details: 'CHI -3' }, 'NE')).toBe(3); expect(oddsLine({ details: 'EVEN' }, 'NE')).toBe(null);
  });
  it('says what’s missing', () => {
    expect(betProblem({})).toBe('Pick the game.');
    expect(betProblem({ game, type: 'spread' })).toBe('Pick the team.');
    expect(betProblem({ game, type: 'spread', side: 'away' })).toMatch(/line/);
    expect(betProblem({ game, type: 'ml', side: 'away' })).toBe('');
    expect(betProblem({ game, type: 'prop', player: { id: '1' }, stat: 'td' })).toBe('');
  });
  it('tracks spreads and moneylines', () => {
    const lions = { type: 'spread', side: 'away', line: -3.5, game };
    expect(liveStatus(lions, live(24, 17)).tone).toBe('win');
    expect(liveStatus(lions, live(20, 17)).label).toBe('Not covering');
    expect(liveStatus(lions, live(24, 17, 'post'))).toMatchObject({ tone: 'win', label: 'Covered', done: true, clock: 'Final' });
    expect(liveStatus({ type: 'spread', side: 'home', line: 3, game }, live(20, 17, 'post')).tone).toBe('push');
    expect(liveStatus({ type: 'ml', side: 'home', game }, live(10, 10)).label).toBe('Tied');
    expect(liveStatus(lions, { state: 'pre', detail: 'Sun 1:00 PM', home: {}, away: {} })).toMatchObject({ tone: 'pre', clock: 'Sun 1:00 PM' });
    expect(liveStatus(lions, null)).toBe(null);
  });
  it('tracks totals and props, locking in once decided', () => {
    const over = { type: 'total', side: 'over', line: 44.5, game };
    expect(liveStatus(over, live(21, 10))).toMatchObject({ tone: 'live', label: '31 of 45' });
    expect(liveStatus(over, live(28, 20))).toMatchObject({ tone: 'win', locked: true });
    const under = { type: 'total', side: 'under', line: 44.5, game };
    expect(liveStatus(under, live(28, 20))).toMatchObject({ tone: 'loss', locked: true });
    expect(liveStatus(under, live(20, 17, 'post'))).toMatchObject({ tone: 'win', done: true });
    const gibbs = { type: 'prop', side: 'over', line: 74.5, stat: 'rushYds', player: { id: '7', name: 'Jahmyr Gibbs' }, game };
    const withGibbs = (yds, state) => live(14, 7, state, [{ id: '7', stats: { rushYds: yds, td: 0 } }]);
    expect(liveStatus(gibbs, withGibbs(52))).toMatchObject({ tone: 'live', label: '52 of 75 rush yds' });
    expect(liveStatus(gibbs, withGibbs(52)).progress).toBeCloseTo(52 / 74.5, 3);
    expect(liveStatus(gibbs, withGibbs(80))).toMatchObject({ tone: 'win', locked: true });
    expect(liveStatus(gibbs, withGibbs(60, 'post'))).toMatchObject({ tone: 'loss', done: true });
    expect(liveStatus({ ...gibbs, stat: 'td' }, withGibbs(0))).toMatchObject({ tone: 'live', label: 'No TD yet' });
    expect(liveStatus({ ...gibbs, stat: 'td' }, live(14, 7, 'in', [{ id: '7', stats: { td: 1 } }]))).toMatchObject({ tone: 'win', locked: true });
  });
  it('shortens the game clock and bolds the bet’s team', () => {
    expect(shortClock('6:12 - 3rd', 'nfl')).toBe('Q3 6:12');
    expect(shortClock('12:05 - 2nd', 'nhl')).toBe('P2 12:05');
    expect(shortClock('3:10 - OT', 'nba')).toBe('OT 3:10');
    expect(shortClock('Halftime', 'nfl')).toBe('Halftime');
    expect(shortClock('Bot 7th', 'mlb')).toBe('Bot 7th');
    const s = liveStatus({ sport: 'nfl', type: 'spread', side: 'away', line: -3.5, game }, live(24, 17));
    expect(s.clock).toBe('Q3 6:12');
    expect(s.away).toEqual({ abbr: 'DET', score: 24, mine: true });
    expect(s.home.mine).toBe(false);
    const prop = liveStatus({ sport: 'nfl', type: 'prop', side: 'over', line: 74.5, stat: 'rushYds', player: { id: '7', team: 'GB' }, game }, live(14, 7));
    expect(prop.home.mine).toBe(true);
    expect(liveStatus({ sport: 'nfl', type: 'total', side: 'over', line: 44.5, game }, live(14, 7)).away.mine).toBe(false);
  });
  it('picks a dot, a suggested grade, and when to hide the grade buttons', () => {
    const lions = { type: 'spread', side: 'away', line: -3.5, game };
    const s = (a, h, st) => liveStatus(lions, live(a, h, st));
    expect(legState({ result: 'L' }, s(24, 17))).toBe('loss');
    expect(legState({}, s(24, 17))).toBe('win');
    expect(legState({}, null)).toBe('pre');
    expect(legState({}, liveStatus({ type: 'total', side: 'over', line: 44.5, game }, live(10, 7)))).toBe('live');
    expect(suggestedGrade(s(24, 17))).toBe(null); // not final yet
    expect(suggestedGrade(s(24, 17, 'post'))).toBe('W');
    expect(suggestedGrade(s(20, 17, 'post'))).toBe('L');
    const leg = { bet: lions };
    expect(gradeHidden(leg, s(24, 17))).toBe(true);
    expect(gradeHidden(leg, s(24, 17, 'post'))).toBe(false);
    expect(gradeHidden({ ...leg, result: 'W' }, s(24, 17))).toBe(false);
    expect(gradeHidden({ pick: 'typed' }, null)).toBe(false);
    expect(gradeHidden(leg, null, Date.parse('2026-10-25T12:00Z'))).toBe(true); // before kickoff
    expect(gradeHidden(leg, null, Date.parse('2026-10-25T20:00Z'))).toBe(false); // can't see the game: show them
  });
  it('counts legs still alive', () => {
    const legs = [{ result: 'W' }, { result: 'L' }, { result: null, s: { tone: 'loss', locked: true } }, { result: null, s: { tone: 'loss' } }, { result: null }];
    expect(aliveCount(legs, (l) => l.s || null)).toEqual({ alive: 3, total: 5 });
  });
});

describe('swiping between tabs', () => {
  const base = { dy: 10, dt: 250, startX: 200, width: 390 };
  it('counts only quick, clearly sideways swipes away from the edges', () => {
    expect(swipeDirection({ ...base, dx: -120 })).toBe('next');
    expect(swipeDirection({ ...base, dx: 120 })).toBe('prev');
    expect(swipeDirection({ ...base, dx: -40 })).toBe(null); // too short
    expect(swipeDirection({ ...base, dx: -120, dy: 90 })).toBe(null); // scrolling
    expect(swipeDirection({ ...base, dx: -120, dt: 900 })).toBe(null); // slow drag
    expect(swipeDirection({ ...base, dx: 120, startX: 10 })).toBe(null); // Safari's back-swipe edge
    expect(swipeDirection({ ...base, dx: -120, startX: 380 })).toBe(null);
  });
  it('moves one tab and stops at the ends', () => {
    const tabs = ['week', 'wheel', 'standings', 'history'];
    expect(swipeTarget(tabs, 'week', 'next')).toBe('wheel');
    expect(swipeTarget(tabs, 'wheel', 'prev')).toBe('week');
    expect(swipeTarget(tabs, 'week', 'prev')).toBe(null);
    expect(swipeTarget(tabs, 'history', 'next')).toBe(null);
  });
});

describe('slip screenshots', () => {
  it('reads several, or the single one older weeks have', () => {
    expect(slipPaths({ slip_paths: ['a', 'b'], slip_path: 'a' })).toEqual(['a', 'b']);
    expect(slipPaths({ slip_paths: [], slip_path: 'old' })).toEqual(['old']);
    expect(slipPaths({ slip_path: null })).toEqual([]);
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
  it('plays an elimination spin as one round per knocked-out name', () => {
    const spin = { pool: ['a', 'b', 'c', 'd'], eliminated: ['c', 'a', 'd'], landed_id: 'b' };
    const rounds = spinRounds(spin);
    expect(rounds.map((r) => r.names)).toEqual([['a', 'b', 'c', 'd'], ['a', 'b', 'd'], ['b', 'd']]);
    expect(rounds.map((r) => r.at)).toEqual(['c', 'a', 'd']);
    expect(rounds.every((r) => !r.bozo)).toBe(true); // every round lands on someone who's safe
    expect(rounds.map((r) => r.quick)).toEqual([true, true, false]); // the last one gets the full spin
    expect(isElimination(spin)).toBe(true);
  });
  it('plays old spins and one-name wheels as a single spin onto the bozo', () => {
    const old = { pool: ['a', 'b'], landed_id: 'b' };
    expect(spinRounds(old)).toEqual([{ names: ['a', 'b'], at: 'b', bozo: true, quick: false }]);
    expect(isElimination(old)).toBe(false);
    const solo = { pool: ['a'], eliminated: [], landed_id: 'a' };
    expect(spinRounds(solo)).toEqual([{ names: ['a'], at: 'a', bozo: true, quick: false }]);
  });
  it('estimates how long a spin plays, so refreshes wait for it', () => {
    expect(spinMs({ pool: ['a', 'b'], landed_id: 'b' })).toBe(SPIN_MS.full[1] + 500);
    const six = { pool: ['a', 'b', 'c', 'd', 'e', 'f'], eliminated: ['a', 'b', 'c', 'd', 'e'], landed_id: 'f' };
    expect(spinMs(six)).toBe(4 * SPIN_MS.quick[1] + SPIN_MS.full[1] + 5 * SPIN_MS.pause + 500);
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

describe('small labels', () => {
  it('formats a deadline time and the weekly rule', () => {
    expect(fmtTime('12:55')).toBe('12:55 PM');
    expect(fmtTime('00:05')).toBe('12:05 AM');
    expect(fmtTime('19:00')).toBe('7:00 PM');
    expect(weeklyRule({ lock_dow: 0, lock_time: '12:55:00' })).toBe('Sun 12:55 PM');
    expect(weeklyRule({ lock_dow: null, lock_time: null })).toBe('Off');
  });
  it('makes name bubbles', () => {
    expect(initials('Danny B')).toBe('DB');
    expect(initials('T-Bone')).toBe('TB');
    expect(initials('Mori')).toBe('M');
    expect(initials('big chris')).toBe('BC');
    expect(initials('')).toBe('?');
  });
});

// DraftKings odds as ESPN sent them for PIT @ NO (Oct 2026), trimmed to the parts we read.
const PIT_NO = {
  details: 'PIT -3.5', overUnder: 44.5, spread: 3.5,
  moneyline: { home: { close: { odds: '+145' }, open: { odds: '+114' } }, away: { close: { odds: '-175' }, open: { odds: '-135' } } },
  pointSpread: { home: { close: { line: '+3.5', odds: '-118' } }, away: { close: { line: '-3.5', odds: '-102' } } },
  total: { over: { close: { line: 'o44.5', odds: '-110' } }, under: { close: { line: 'u44.5', odds: '-110' } } },
};
const PIT_NO_GAME = {
  id: '401873011', sport: 'nfl', start: '2026-10-25T17:00Z', short: 'PIT @ NO', state: 'pre',
  away: { id: '23', abbr: 'PIT', short: 'Steelers', name: 'Pittsburgh Steelers' },
  home: { id: '18', abbr: 'NO', short: 'Saints', name: 'New Orleans Saints' },
  odds: { details: 'PIT -3.5', total: 44.5, board: oddsBoard(PIT_NO) },
};

describe('the DraftKings board', () => {
  it('reads spread, moneyline, and total with prices from ESPN', () => {
    expect(oddsBoard(PIT_NO)).toEqual({
      spread: { away: { line: -3.5, price: -102 }, home: { line: 3.5, price: -118 } },
      ml: { away: -175, home: 145 },
      total: { line: 44.5, over: -110, under: -110 },
    });
  });
  it('copes with what the feed sometimes sends', () => {
    expect(oddsBoard({ details: 'CHI -3', overUnder: 50.5 })).toBe(null); // just the summary: no board
    expect(oddsBoard(null)).toBe(null);
    const odd = oddsBoard({
      awayTeamOdds: { moneyLine: -110 }, homeTeamOdds: { moneyLine: 'EVEN' },
      pointSpread: { away: { open: { line: 'PK', odds: '-110' } }, home: { open: { line: 'PK' } } },
    });
    expect(odd.ml).toEqual({ away: -110, home: 100 });
    expect(odd.spread).toEqual({ away: { line: 0, price: -110 }, home: { line: 0, price: null } });
    expect(odd.total).toBe(null);
    expect(normalizeScoreboard(SB, 'nfl')[0].odds.board).toBe(null);
  });
  it('turns a tapped price into the leg and its odds', () => {
    const opts = boardOptions(PIT_NO_GAME);
    expect(opts.map((o) => o.key)).toEqual(['spread:away', 'spread:home', 'total:over', 'total:under', 'ml:away', 'ml:home']);
    const leg = (key) => {
      const o = opts.find((x) => x.key === key);
      const { b, price } = pickFromBoard('nfl', PIT_NO_GAME, o);
      const bet = betFromPick(b);
      expect(betProblem(bet)).toBe('');
      expect(isBoardPick(b, PIT_NO_GAME, o)).toBe(true);
      return [pickText(bet), price, bet.line];
    };
    expect(leg('spread:away')).toEqual(['Steelers −3.5', -102, -3.5]);
    expect(leg('spread:home')).toEqual(['Saints +3.5', -118, 3.5]);
    expect(leg('total:under')).toEqual(['PIT/NO under 44.5', -110, 44.5]);
    expect(leg('ml:home')).toEqual(['Saints ML', 145, null]);
    // Change the line by hand and it's no longer that board choice
    const { b } = pickFromBoard('nfl', PIT_NO_GAME, opts[0]);
    expect(isBoardPick({ ...b, lineText: '3' }, PIT_NO_GAME, opts[0])).toBe(false);
    expect(boardOptions({ odds: { details: 'X -1' } })).toEqual([]);
  });
  it('fills DraftKings’ price for a bet built by hand when it matches the main line', () => {
    const built = (patch) => ({ ...emptyPick('nfl'), game: PIT_NO_GAME, ...patch });
    expect(boardPrice(built({ type: 'spread', side: 'away', lineText: '3.5', lineSign: '-' }), PIT_NO_GAME)).toBe(-102);
    expect(boardPrice(built({ type: 'ml', side: 'home' }), PIT_NO_GAME)).toBe(145);
    expect(boardPrice(built({ type: 'total', side: 'over', lineText: '44.5' }), PIT_NO_GAME)).toBe(-110);
    expect(boardPrice(built({ type: 'spread', side: 'away', lineText: '7.5', lineSign: '-' }), PIT_NO_GAME)).toBe(null); // alternate line
    expect(boardPrice(built({ type: 'spread', side: 'away' }), PIT_NO_GAME)).toBe(null); // no line yet
    expect(boardPrice(built({ type: 'prop', side: 'over', lineText: '74.5', stat: 'rushYds' }), PIT_NO_GAME)).toBe(null);
    expect(boardPrice(built({ type: 'ml', side: 'home' }), { ...PIT_NO_GAME, state: 'in' })).toBe(null); // started: no stale prices
    expect(boardPrice(built({ type: 'ml', side: 'home' }), null)).toBe(null);
  });
});

describe('player props, DraftKings style', () => {
  const roster = [
    { id: '1', name: 'Josh Allen', pos: 'QB', team: 'BUF' }, { id: '2', name: 'Mitchell Trubisky', pos: 'QB', team: 'BUF' },
    { id: '3', name: 'James Cook', pos: 'RB', team: 'BUF' }, { id: '4', name: 'Khalil Shakir', pos: 'WR', team: 'BUF' },
    { id: '5', name: 'Dalton Kincaid', pos: 'TE', team: 'BUF' }, { id: '6', name: 'Tua Tagovailoa', pos: 'QB', team: 'MIA' },
    { id: '7', name: 'De’Von Achane', pos: 'RB', team: 'MIA' }, { id: '8', name: 'Tyreek Hill', pos: 'WR', team: 'MIA' },
  ];
  const names = (groups) => groups.map((g) => [g.team, g.players.map((p) => p.name)]);
  it('covers every stat, each in one category, with positions that fit it', () => {
    const all = Object.values(PROP_CATS).flatMap((c) => c.stats);
    expect(all.sort()).toEqual(Object.keys(STATS).sort());
    all.forEach((st) => expect(STAT_POS[st].length).toBeGreaterThan(0));
    expect(propCatOf('recYds')).toBe('rec');
    expect(propCatOf('td')).toBe('td');
    expect(propCatOf(null)).toBe(null);
  });
  it('shows only the players who’d have that line, grouped by team, most likely positions first', () => {
    expect(names(propPlayers(roster, 'passYds', ['MIA', 'BUF']))).toEqual([['MIA', ['Tua Tagovailoa']], ['BUF', ['Josh Allen', 'Mitchell Trubisky']]]);
    expect(names(propPlayers(roster, 'recYds', ['BUF']))).toEqual([['BUF', ['Khalil Shakir', 'Dalton Kincaid', 'James Cook']]]);
    expect(names(propPlayers(roster, 'rushYds', ['BUF']))).toEqual([['BUF', ['James Cook', 'Josh Allen', 'Mitchell Trubisky']]]);
  });
  it('finds a player by name', () => {
    expect(names(propPlayers(roster, 'td', ['BUF', 'MIA'], ' hill'))).toEqual([['BUF', []], ['MIA', ['Tyreek Hill']]]);
  });
});

describe('depth charts from Sleeper', () => {
  const sleeper = {
    4984: { position: 'QB', team: 'BUF', espn_id: 3918298, depth_chart_order: 1, injury_status: null },
    2: { position: 'QB', team: 'BUF', espn_id: '3046779', depth_chart_order: 2, injury_status: null },
    3: { position: 'RB', team: 'BUF', espn_id: 4379399, depth_chart_order: 1, injury_status: 'Questionable' },
    4: { position: 'WR', team: null, espn_id: 111, depth_chart_order: 1 }, // free agent
    5: { position: 'LB', team: 'BUF', espn_id: 222, depth_chart_order: 1 }, // not a skill player
    6: { position: 'WR', team: 'MIA', espn_id: '', depth_chart_order: 1 }, // no ESPN id to match
    7: { fantasy_positions: ['TE'], team: 'MIA', espn_id: 333, depth_chart_order: null, injury_status: 'IR' },
  };
  it('keeps skill players on a team, keyed by ESPN id, with depth order and injury', () => {
    expect(normalizeDepth(sleeper)).toEqual({
      3918298: { o: 1, s: null }, 3046779: { o: 2, s: null }, 4379399: { o: 1, s: 'Questionable' }, 333: { o: null, s: 'IR' },
    });
    expect(normalizeDepth(null)).toEqual({});
  });
  it('shortens injuries like DraftKings', () => {
    expect([injuryTag('Questionable'), injuryTag('Doubtful'), injuryTag('Out'), injuryTag('IR'), injuryTag(null), injuryTag('NA')]).toEqual(['Q', 'D', 'Out', 'IR', '', '']);
  });
  it('the /api/depth function trims Sleeper’s list and caches it for a day', async () => {
    const saved = globalThis.fetch;
    const res = () => { const r = { headers: {}, setHeader(k, v) { r.headers[k] = v; }, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
    try {
      globalThis.fetch = async () => ({ ok: true, json: async () => sleeper });
      const r = await depthHandler({ query: {} }, res());
      expect(r.code).toBe(200);
      expect(r.body.players['3918298']).toEqual({ o: 1, s: null });
      expect(r.headers['Cache-Control']).toMatch(/s-maxage=86400/);
      globalThis.fetch = async () => { throw new Error('down'); };
      const bad = await depthHandler({ query: {} }, res());
      expect(bad.code).toBe(502);
    } finally { globalThis.fetch = saved; }
  });
  it('puts starters first and tucks the rest behind “Show all”', () => {
    const roster = [
      { id: '10', name: 'Curtis Samuel', pos: 'WR', team: 'BUF' }, { id: '11', name: 'Keon Coleman', pos: 'WR', team: 'BUF' },
      { id: '12', name: 'Khalil Shakir', pos: 'WR', team: 'BUF' }, { id: '13', name: 'Dalton Kincaid', pos: 'TE', team: 'BUF' },
      { id: '14', name: 'James Cook', pos: 'RB', team: 'BUF' }, { id: '15', name: 'Ray Davis', pos: 'RB', team: 'BUF' },
    ];
    const depth = { 10: { o: 2, s: null }, 11: { o: 1, s: 'Questionable' }, 12: { o: 1, s: null }, 13: { o: 1, s: null }, 14: { o: 1, s: null }, 15: { o: 2, s: null } };
    const [g] = propPlayers(roster, 'recYds', ['BUF'], '', depth);
    expect(g.players.map((p) => p.name)).toEqual(['Keon Coleman', 'Khalil Shakir', 'Dalton Kincaid', 'James Cook']);
    expect(g.players[0].inj).toBe('Questionable');
    expect(g.more.map((p) => p.name)).toEqual(['Curtis Samuel', 'Ray Davis']);
    expect(g.all.map((p) => p.name)).toEqual(['Keon Coleman', 'Khalil Shakir', 'Curtis Samuel', 'Dalton Kincaid', 'James Cook', 'Ray Davis']); // Show all: still by position
    // Searching looks through everyone
    expect(propPlayers(roster, 'recYds', ['BUF'], 'ray', depth)[0]).toMatchObject({ players: [{ name: 'Ray Davis' }], more: [] });
    // No depth data (college, or Sleeper down): everyone, as before
    expect(propPlayers(roster, 'recYds', ['BUF'])[0].more).toEqual([]);
    expect(propPlayers(roster, 'recYds', ['BUF'], '', {})[0].players.length).toBe(6);
  });
});

// Demo mode: an in-memory stand-in for Supabase so the app runs with no
// backend. Start it with `npm run demo`. Data resets on reload. Only the
// calls the app makes are implemented. Never used in a normal build.

const uid = 'demo-user';
const id = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);

const L = 'demo-league';
// Next time the weekly deadline comes around (viewer's local time is fine for the demo).
function nextLock(dow, hhmm) {
  if (dow == null) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const t = new Date(); t.setHours(h, m, 0, 0);
  t.setDate(t.getDate() + ((dow - t.getDay() + 7) % 7));
  if (t <= new Date()) t.setDate(t.getDate() + 7);
  return t.toISOString();
}
const lockAt = () => nextLock(db.leagues[0].lock_dow, db.leagues[0].lock_time || '12:55');
const names = ['Lotti', 'Sully', 'Mikey', 'Danny B', 'Big Chris', 'T-Bone'];
const P = names.map((n, i) => ({ id: 'p' + (i + 1), league_id: L, name: n, active: true, sort: i, created_at: now() }));
const W = [1, 2, 3, 4].map((n) => ({ id: 'w' + n, league_id: L, n: n + 3, start_date: daysAgo(35 - n * 7), stake: 10, payer_id: null, actual_payout: null, created_at: now() }));
W[0].payer_id = 'p1'; W[1].payer_id = 'p5'; W[2].payer_id = 'p3'; W[3].payer_id = 'p4';
const leg = (w, p, pick, odds, sport, result, extra = {}) => ({ id: id(), week_id: w, league_id: L, player_id: p, pick, odds, sport, result, bet: null, margin: null, miss: null, created_by: uid, created_at: now(), updated_at: now(), ...extra });

// ---- Fake scores for demo mode (stands in for /api/espn) ----
const inHours = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const mkTeam = (id, abbr, name, short) => ({ id, abbr, name, short });
const TEAMS = {
  CHI: mkTeam('3', 'CHI', 'Chicago Bears', 'Bears'), NE: mkTeam('17', 'NE', 'New England Patriots', 'Patriots'), BUF: mkTeam('2', 'BUF', 'Buffalo Bills', 'Bills'),
  MIA: mkTeam('15', 'MIA', 'Miami Dolphins', 'Dolphins'), NYJ: mkTeam('20', 'NYJ', 'New York Jets', 'Jets'), PHI: mkTeam('21', 'PHI', 'Philadelphia Eagles', 'Eagles'),
  NYG: mkTeam('19', 'NYG', 'New York Giants', 'Giants'), DET: mkTeam('8', 'DET', 'Detroit Lions', 'Lions'), GB: mkTeam('9', 'GB', 'Green Bay Packers', 'Packers'),
  KC: mkTeam('12', 'KC', 'Kansas City Chiefs', 'Chiefs'), LV: mkTeam('13', 'LV', 'Las Vegas Raiders', 'Raiders'),
  MICH: mkTeam('130', 'MICH', 'Michigan Wolverines', 'Michigan'), OSU: mkTeam('194', 'OSU', 'Ohio State Buckeyes', 'Ohio State'),
  TEX: mkTeam('251', 'TEX', 'Texas Longhorns', 'Texas'), UGA: mkTeam('61', 'UGA', 'Georgia Bulldogs', 'Georgia'),
  BOS: mkTeam('2', 'BOS', 'Boston Celtics', 'Celtics'), NYK: mkTeam('18', 'NYK', 'New York Knicks', 'Knicks'), LAL: mkTeam('13', 'LAL', 'Los Angeles Lakers', 'Lakers'), GSW: mkTeam('9', 'GSW', 'Golden State Warriors', 'Warriors'),
  NYR: mkTeam('13', 'NYR', 'New York Rangers', 'Rangers'), BOSH: mkTeam('1', 'BOS', 'Boston Bruins', 'Bruins'),
  LAD: mkTeam('19', 'LAD', 'Los Angeles Dodgers', 'Dodgers'), NYY: mkTeam('10', 'NYY', 'New York Yankees', 'Yankees'),
};
const mkGame = (id, sport, away, home, start, state, detail, as = null, hs = null, odds = null, players = []) => ({
  id, sport, start, short: `${TEAMS[away].abbr} @ ${TEAMS[home].abbr}`, state, detail,
  away: { ...TEAMS[away], score: as }, home: { ...TEAMS[home], score: hs }, odds, players,
});
// DraftKings board for an upcoming demo game: away spread line and both prices, both moneylines, total and both prices.
const bd = (line, ap, hp, mla, mlh, total, over, under) => ({
  spread: { away: { line, price: ap }, home: { line: -line, price: hp } }, ml: { away: mla, home: mlh }, total: { line: total, over, under },
});
const mkPlayer = (id, name, team, stats) => ({ id, name, team, stats: { rushRecYds: (stats.rushYds || 0) + (stats.recYds || 0), td: (stats.rushTd || 0) + (stats.recTd || 0), ...stats } });
const DEMO_GAMES = [
  mkGame('900002', 'nfl', 'BUF', 'MIA', inHours(-2), 'in', '6:12 - 3rd', 17, 10, { details: 'BUF -6.5', total: 47.5 },
    [mkPlayer('3918298', 'Josh Allen', 'BUF', { passYds: 214, passTd: 2, int: 0, passCmp: 17, rushYds: 22, rushTd: 0 }), mkPlayer('4379399', 'James Cook', 'BUF', { rushYds: 61, rushAtt: 12, rushTd: 1, rec: 2, recYds: 9 })]),
  mkGame('900004', 'nfl', 'PHI', 'NYG', inHours(-1), 'in', '2:41 - 2nd', 14, 3, { details: 'PHI -7', total: 43.5 },
    [mkPlayer('3929630', 'Saquon Barkley', 'PHI', { rushYds: 68, rushAtt: 11, rushTd: 1, rec: 1, recYds: 6 }), mkPlayer('4040715', 'Jalen Hurts', 'PHI', { passYds: 141, passTd: 1, int: 0, passCmp: 11, rushYds: 9 })]),
  mkGame('900003', 'nfl', 'NYJ', 'NE', inHours(-26), 'post', 'Final', 13, 24, { details: 'NE -3', total: 41.5 }),
  mkGame('900001', 'nfl', 'NE', 'CHI', inHours(3), 'pre', 'Tonight 8:15 PM', null, null, { details: 'CHI -3', total: 50.5, board: bd(3, -110, -110, 135, -160, 50.5, -112, -108) }),
  mkGame('900005', 'nfl', 'DET', 'GB', inHours(70), 'pre', 'Sun 1:00 PM', null, null, { details: 'DET -3.5', total: 48.5, board: bd(-3.5, -105, -115, -175, 145, 48.5, -110, -110) }),
  mkGame('900006', 'nfl', 'KC', 'LV', inHours(73), 'pre', 'Sun 4:25 PM', null, null, { details: 'KC -9.5', total: 44.5, board: bd(-9.5, -110, -110, -450, 340, 44.5, -105, -115) }),
  mkGame('910001', 'ncaaf', 'MICH', 'OSU', inHours(50), 'pre', 'Sat 12:00 PM', null, null, { details: 'OSU -10.5', total: 45.5, board: bd(10.5, -110, -110, 320, -425, 45.5, -110, -110) }),
  mkGame('910002', 'ncaaf', 'TEX', 'UGA', inHours(-1), 'in', '9:30 - 2nd', 10, 14, { details: 'UGA -2.5', total: 51.5 }),
  mkGame('920001', 'nba', 'BOS', 'NYK', inHours(-1), 'in', '4:12 - 3rd', 71, 68, { details: 'NYK -2', total: 221.5 }),
  mkGame('920002', 'nba', 'LAL', 'GSW', inHours(5), 'pre', 'Tonight 10:00 PM', null, null, { details: 'GSW -4.5', total: 229.5, board: bd(4.5, -108, -112, 160, -190, 229.5, -110, -110) }),
  mkGame('930001', 'nhl', 'NYR', 'BOSH', inHours(-1), 'in', '12:05 - 2nd', 2, 1, { details: 'BOS -130', total: 6 }),
  mkGame('940001', 'mlb', 'LAD', 'NYY', inHours(28), 'pre', 'Fri 8:08 PM', null, null, { details: 'LAD -125', total: 8.5, board: bd(-1.5, 135, -160, -125, 105, 8.5, -105, -115) }),
];
// [name, position, ESPN id (optional), depth chart order (default 1 = starter), injury]
const ROSTER = {
  CHI: [['Caleb Williams', 'QB'], ["D'Andre Swift", 'RB', null, 1, 'Questionable'], ['DJ Moore', 'WR'], ['Rome Odunze', 'WR'], ['Cole Kmet', 'TE'],
    ['Tyson Bagent', 'QB', null, 2], ['Roschon Johnson', 'RB', null, 2], ['Olamide Zaccheaus', 'WR', null, 2]],
  NE: [['Drake Maye', 'QB'], ['Rhamondre Stevenson', 'RB'], ['Stefon Diggs', 'WR'], ['Hunter Henry', 'TE'], ['Antonio Gibson', 'RB', null, 2], ['DeMario Douglas', 'WR', null, 2, 'Out']],
  BUF: [['Josh Allen', 'QB', '3918298'], ['James Cook', 'RB', '4379399'], ['Khalil Shakir', 'WR'], ['Dalton Kincaid', 'TE']],
  MIA: [['Tua Tagovailoa', 'QB'], ["De'Von Achane", 'RB'], ['Tyreek Hill', 'WR'], ['Jaylen Waddle', 'WR']],
  PHI: [['Jalen Hurts', 'QB', '4040715'], ['Saquon Barkley', 'RB', '3929630', 1, 'Questionable'], ['A.J. Brown', 'WR'], ['DeVonta Smith', 'WR'], ['Dallas Goedert', 'TE']],
  NYG: [['Jaxson Dart', 'QB'], ['Cam Skattebo', 'RB'], ['Malik Nabers', 'WR']],
  DET: [['Jared Goff', 'QB'], ['Jahmyr Gibbs', 'RB'], ['David Montgomery', 'RB'], ['Amon-Ra St. Brown', 'WR'], ['Sam LaPorta', 'TE']],
  GB: [['Jordan Love', 'QB'], ['Josh Jacobs', 'RB'], ['Jayden Reed', 'WR'], ['Tucker Kraft', 'TE']],
  NYJ: [['Justin Fields', 'QB'], ['Breece Hall', 'RB'], ['Garrett Wilson', 'WR']],
  KC: [['Patrick Mahomes', 'QB'], ['Isiah Pacheco', 'RB'], ['Travis Kelce', 'TE']],
  LV: [['Geno Smith', 'QB'], ['Ashton Jeanty', 'RB'], ['Brock Bowers', 'TE']],
  MICH: [['Bryce Underwood', 'QB'], ['Justice Haynes', 'RB']], OSU: [['Julian Sayin', 'QB'], ['Jeremiah Smith', 'WR']],
  TEX: [['Arch Manning', 'QB'], ['Quintrevion Wisner', 'RB']], UGA: [['Gunner Stockton', 'QB'], ['Nate Frazier', 'RB']],
};
const rosterFor = (sport, teamId) => {
  const g = DEMO_GAMES.find((x) => x.sport === sport && (x.home.id === teamId || x.away.id === teamId));
  const abbr = g ? (g.home.id === teamId ? g.home.abbr : g.away.abbr) : '';
  return (ROSTER[abbr] || []).map(([name, pos, pid], i) => ({ id: pid || `${teamId}${i}`, name, pos }));
};
function demoBet(type, sport, gameId, extra) {
  const g = DEMO_GAMES.find((x) => x.id === gameId);
  const team = (t) => ({ id: t.id, abbr: t.abbr, short: t.short, name: t.name });
  return { v: 1, sport, type, ...extra, game: { id: g.id, start: g.start, short: g.short, home: team(g.home), away: team(g.away) } };
}
// Fake depth charts for demo mode (stands in for /api/depth), keyed like the demo rosters' ids.
export function demoDepth() {
  const players = {};
  for (const g of DEMO_GAMES.filter((x) => x.sport === 'nfl')) {
    for (const t of [g.away, g.home]) (ROSTER[t.abbr] || []).forEach(([, , pid, o = 1, s = null], i) => { players[pid || `${t.id}${i}`] = { o, s }; });
  }
  return { players };
}
// Fake DraftKings prop lines for demo mode (stands in for /api/props), only for NE @ CHI.
// Backups have none, like the real thing, so they fall back to typing the number.
const DEMO_PROPS = {
  'caleb williams': { passYds: { l: 224.5, o: -115, u: -105 }, passTd: { l: 1.5, o: 105, u: -135 }, passCmp: { l: 21.5, o: -110, u: -120 }, int: { l: 0.5, o: -130, u: 100 }, td: { y: 600 } },
  'dandre swift': { rushYds: { l: 59.5, o: -110, u: -120 }, rushAtt: { l: 14.5, o: -105, u: -125 }, rushRecYds: { l: 79.5, o: -115, u: -115 }, rec: { l: 2.5, o: 105, u: -135 }, recYds: { l: 17.5, o: -115, u: -115 }, td: { y: 140 } },
  'dj moore': { recYds: { l: 62.5, o: -115, u: -105 }, rec: { l: 4.5, o: -140, u: 110 }, td: { y: 165 } },
  'rome odunze': { recYds: { l: 48.5, o: -110, u: -120 }, rec: { l: 3.5, o: -150, u: 120 }, td: { y: 210 } },
  'cole kmet': { recYds: { l: 28.5, o: -115, u: -115 }, rec: { l: 2.5, o: -125, u: -105 }, td: { y: 380 } },
  'drake maye': { passYds: { l: 218.5, o: -115, u: -115 }, passTd: { l: 1.5, o: 120, u: -150 }, passCmp: { l: 20.5, o: -115, u: -115 }, int: { l: 0.5, o: -145, u: 115 }, rushYds: { l: 24.5, o: -115, u: -115 }, td: { y: 330 } },
  'rhamondre stevenson': { rushYds: { l: 54.5, o: -115, u: -115 }, rushAtt: { l: 13.5, o: -110, u: -120 }, rushRecYds: { l: 71.5, o: -115, u: -115 }, td: { y: 135 } },
  'stefon diggs': { recYds: { l: 55.5, o: -115, u: -115 }, rec: { l: 5.5, o: 100, u: -130 }, td: { y: 200 } },
  'hunter henry': { recYds: { l: 34.5, o: -115, u: -115 }, rec: { l: 3.5, o: -120, u: -110 }, td: { y: 300 } },
};
export function demoProps(game) {
  return game?.id === '900001' ? { at: now(), via: 'team', lines: DEMO_PROPS } : { lines: {} };
}
export async function demoScores({ kind, sport, event, team }) {
  await new Promise((r) => setTimeout(r, 120));
  if (kind === 'scoreboard') return { games: DEMO_GAMES.filter((g) => g.sport === sport).map(({ players: _players, ...g }) => g) };
  if (kind === 'summary') { const g = DEMO_GAMES.find((x) => x.id === event); if (!g) throw new Error('No such game'); const { odds: _odds, ...rest } = g; return rest; }
  return { players: rosterFor(sport, team) };
}

const db = {
  leagues: [{ id: L, name: 'Bozo Bets', stake: 10, invite_code: 'DEMO42', created_by: uid, created_at: now(), lock_dow: 0, lock_time: '12:55:00', lock_tz: 'America/New_York' }],
  players: P,
  members: [
    { league_id: L, user_id: uid, role: 'owner', player_id: 'p1', email: 'you@example.com', joined_at: now() },
    { league_id: L, user_id: 'u2', role: 'member', player_id: 'p2', email: 'sully@example.com', joined_at: now() },
    { league_id: L, user_id: 'u3', role: 'member', player_id: 'p3', email: 'mikey@example.com', joined_at: now() },
  ],
  weeks: W,
  legs: [
    leg('w1', 'p1', 'Lions -3.5', -110, 'NFL', 'W'), leg('w1', 'p2', 'Bills ML', -180, 'NFL', 'W'), leg('w1', 'p3', 'Chiefs game over 44.5', -110, 'NFL', 'L', { margin: -17.5, bet: { v: 1, sport: 'nfl', type: 'total', side: 'over', line: 44.5 } }) /* a blowout */,
    leg('w1', 'p4', 'Ohio State -10.5', -110, 'NCAAF', 'W'), leg('w1', 'p5', 'Saquon 75+ rush yds', -125, 'NFL', 'L'), leg('w1', 'p6', 'Gibbs anytime TD', -140, 'NFL', 'W'),
    leg('w2', 'p1', 'Ravens -2.5', -115, 'NFL', 'W'), leg('w2', 'p2', 'Georgia ML', -250, 'NCAAF', 'W'), leg('w2', 'p3', 'Dodgers ML', -160, 'MLB', 'W'),
    leg('w2', 'p4', 'Packers +3', -105, 'NFL', 'W'), leg('w2', 'p5', 'Eagles game under 48.5', -110, 'NFL', 'W'), leg('w2', 'p6', 'Josh Allen 2+ pass TDs', -200, 'NFL', 'W'),
    leg('w3', 'p1', 'Texas -6.5', -110, 'NCAAF', 'L', { margin: -0.5, bet: { v: 1, sport: 'ncaaf', type: 'spread', side: 'home', line: -6.5 } }) /* missed by a hook */, leg('w3', 'p2', 'Lions ML', -200, 'NFL', 'W'), leg('w3', 'p3', 'Cowboys +4.5', -110, 'NFL', 'W'),
    leg('w3', 'p4', 'Rangers ML', -130, 'NHL', 'L'), leg('w3', 'p5', 'CeeDee Lamb 70+ rec yds', -115, 'NFL', 'W'), leg('w3', 'p6', 'Bijan 90+ rush yds', 120, 'NFL', 'W'),
    leg('w4', 'p1', 'Bills −6.5', -110, 'NFL', null, { bet: demoBet('spread', 'nfl', '900002', { side: 'away', line: -6.5 }) }),
    leg('w4', 'p2', 'Saquon Barkley 75+ rush yds', -125, 'NFL', null, { bet: demoBet('prop', 'nfl', '900004', { side: 'over', line: 74.5, stat: 'rushYds', player: { id: '3929630', name: 'Saquon Barkley', team: 'PHI' } }) }),
    leg('w4', 'p3', 'Steelers ML', 135, 'NFL', 'L'),
    leg('w4', 'p4', 'NYJ/NE under 41.5', -105, 'NFL', 'W', { bet: demoBet('total', 'nfl', '900003', { side: 'under', line: 41.5 }) }),
    leg('w4', 'p5', 'Rangers ML', 105, 'NHL', null, { bet: demoBet('ml', 'nhl', '930001', { side: 'away' }) }),
  ],
  spins: [
    // s1, s2, s3a are from before elimination (no `eliminated`): one spin, landed_id is the bozo.
    { id: 's1', week_id: 'w1', league_id: L, pool: ['p3', 'p5'], landed_id: 'p5', spun_by: uid, created_at: daysAgo(27) + 'T23:00:00Z' },
    { id: 's2', week_id: 'w2', league_id: L, pool: P.map((p) => p.id), landed_id: 'p3', spun_by: uid, created_at: daysAgo(20) + 'T23:00:00Z' },
    { id: 's3a', week_id: 'w3', league_id: L, pool: ['p1', 'p4'], landed_id: 'p1', spun_by: uid, created_at: daysAgo(13) + 'T22:58:00Z' },
    // The re-spin that counts, with elimination: Lotti knocked out, Danny B left. Sully spun it; you haven't watched.
    { id: 's3', week_id: 'w3', league_id: L, pool: ['p1', 'p4'], landed_id: 'p4', eliminated: ['p1'], spun_by: 'u2', created_at: daysAgo(13) + 'T23:00:00Z' },
  ],
  reactions: [],
  comments: [],
  spin_views: [],
};
// A few sample reactions on this week's picks (Sully is the other signed-in member).
W[3].lock_at = nextLock(0, '12:55');
db.legs.filter((l) => l.week_id === 'w4').slice(0, 3).forEach((l, i) => {
  db.reactions.push({ leg_id: l.id, league_id: L, user_id: 'u2', emoji: ['🔥', '🤡', '🙏'][i], created_at: now() });
});
// Sample trash talk: on this week's Steelers pick, and on a busted pick from Week 6.
const ago = (min) => new Date(Date.now() - min * 60e3).toISOString();
const steelers = db.legs.find((l) => l.week_id === 'w4' && l.player_id === 'p3');
const texas = db.legs.find((l) => l.week_id === 'w3' && l.player_id === 'p1');
[
  [steelers, 'u2', 'Steelers ML at +135. Mikey never learns.', 300],
  [steelers, uid, 'Bozo Belt is calling your name', 240],
  [steelers, 'u3', 'Defense travels. Watch.', 200],
  [steelers, 'u2', 'Aged like milk', 30],
  [texas, 'u2', 'Laying 6.5 on the road, brave', 9000],
].forEach(([l, u, body, min]) => db.comments.push({ id: id(), leg_id: l.id, league_id: L, user_id: u, body, created_at: ago(min) }));
const files = {};

const listeners = [];
function emit(table, eventType, row) {
  setTimeout(() => listeners.forEach((l) => { if (l.table === table) l.cb({ eventType, new: row }); }), 60);
}

function query(table) {
  const filters = [];
  const orders = [];
  let op = 'select';
  let payload = null;
  let single = null;
  let embedLeague = false;
  let returnRows = false;
  const b = {
    select(cols) { if (op === 'select') embedLeague = /leagues\(/.test(cols || ''); else returnRows = true; return b; },
    eq(col, val) { filters.push((r) => r[col] === val); return b; },
    order(col, opts = {}) { orders.push([col, opts.ascending !== false]); return b; },
    maybeSingle() { single = 'maybe'; return b; },
    single() { single = 'one'; return b; },
    insert(p) { op = 'insert'; payload = p; return b; },
    update(p) { op = 'update'; payload = p; return b; },
    delete() { op = 'delete'; return b; },
    then(res, rej) { return Promise.resolve().then(run).then(res, rej); },
  };
  function run() {
    const match = (r) => filters.every((f) => f(r));
    if (op === 'insert') {
      const rows = (Array.isArray(payload) ? payload : [payload]).map((r) => ({ id: id(), created_at: now(), active: true, result: null, ...r }));
      if (table === 'reactions' || table === 'comments' || table === 'spin_views') rows.forEach((r) => { r.user_id = uid; r.league_id = L; });
      if (table === 'spin_views' && rows.some((r) => db.spin_views.some((v) => v.spin_id === r.spin_id))) return { data: null, error: { message: 'duplicate key value violates unique constraint "spin_views_pkey"' } };
      if (table === 'legs') rows.forEach((r) => { r.bet = r.bet ?? null; r.margin = null; r.miss = null; }); // like the real columns' defaults
      if (table === 'comments') rows.forEach((r) => { r.body = String(r.body || '').trim(); });
      if (table === 'comments' && rows.some((r) => !r.body)) return { data: null, error: { message: 'Write something first' } };
      if (table === 'reactions' && rows.some((r) => db.reactions.some((x) => x.leg_id === r.leg_id && x.user_id === r.user_id && x.emoji === r.emoji))) {
        return { data: null, error: { message: 'duplicate key value violates unique constraint "reactions_pkey"' } };
      }
      if (table === 'legs' && rows.some((r) => db.legs.some((l) => l.week_id === r.week_id && l.player_id === r.player_id))) {
        return { data: null, error: { message: 'duplicate key value violates unique constraint "legs_week_id_player_id_key"' } };
      }
      db[table].push(...rows);
      rows.forEach((r) => emit(table, 'INSERT', r));
      return { data: returnRows ? (single ? rows[0] : rows) : null, error: null };
    }
    if (op === 'update') {
      db[table].filter(match).forEach((r) => {
        Object.assign(r, payload);
        if (table === 'legs' && !r.result) r.margin = null; // as the database does when a grade is undone
        if (table === 'legs' && r.result !== 'L') r.miss = null;
        emit(table, 'UPDATE', r);
      });
      return { data: null, error: null };
    }
    if (op === 'delete') {
      const gone = db[table].filter(match);
      db[table] = db[table].filter((r) => !match(r));
      gone.forEach((r) => emit(table, 'DELETE', r));
      return { data: null, error: null };
    }
    let rows = db[table].filter(match).map((r) => ({ ...r }));
    for (const [col, asc] of [...orders].reverse()) rows.sort((a, c) => (a[col] > c[col] ? 1 : a[col] < c[col] ? -1 : 0) * (asc ? 1 : -1));
    if (embedLeague) rows = rows.map((r) => ({ ...r, leagues: { name: db.leagues.find((l) => l.id === r.league_id)?.name } }));
    if (single) return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null };
  }
  return b;
}

const rpcs = {
  spin_wheel({ p_week, p_pool }) {
    const w = db.weeks.find((x) => x.id === p_week);
    const latest = Math.max(...db.weeks.map((x) => x.n));
    if (w.n === latest && db.legs.some((l) => l.week_id === w.id && !l.result)) throw new Error('Grade every leg before spinning');
    const pool = [...new Set(p_pool)];
    // Knock out a random name until one is left (same as spin_wheel in schema.sql).
    let left = [...pool];
    const eliminated = [];
    while (left.length > 1) {
      const a = new Uint32Array(1); crypto.getRandomValues(a);
      const out = left[a[0] % left.length];
      eliminated.push(out);
      left = left.filter((x) => x !== out);
    }
    const landed = left[0];
    const s = { id: id(), week_id: w.id, league_id: L, pool, landed_id: landed, eliminated, spun_by: uid, created_at: now() };
    db.spins.push(s);
    emit('spins', 'INSERT', s);
    const next = [...db.weeks].filter((x) => x.n > w.n).sort((a, b) => a.n - b.n)[0];
    if (next) { next.payer_id = landed; emit('weeks', 'UPDATE', next); }
    else { const nw = { id: id(), league_id: L, n: w.n + 1, start_date: new Date().toISOString().slice(0, 10), stake: db.leagues[0].stake, payer_id: landed, actual_payout: null, lock_at: lockAt(), created_at: now() }; db.weeks.push(nw); emit('weeks', 'INSERT', nw); }
    return s;
  },
  claim_player({ p_player }) { db.members[0].player_id = p_player; emit('members', 'UPDATE', db.members[0]); return null; },
  assign_player({ p_user, p_player }) { const m = db.members.find((x) => x.user_id === p_user); if (m) m.player_id = p_player; emit('members', 'UPDATE', m); return null; },
  set_member_role({ p_user, p_role }) { const m = db.members.find((x) => x.user_id === p_user); if (m) m.role = p_role; emit('members', 'UPDATE', m); return null; },
  remove_member({ p_user }) { db.members = db.members.filter((x) => x.user_id !== p_user); emit('members', 'DELETE', {}); return null; },
  regenerate_invite() { db.leagues[0].invite_code = 'NEW' + Math.floor(Math.random() * 900 + 100); emit('leagues', 'UPDATE', db.leagues[0]); return db.leagues[0].invite_code; },
  start_next_week() { const n = Math.max(...db.weeks.map((x) => x.n)) + 1; const nw = { id: id(), league_id: L, n, start_date: new Date().toISOString().slice(0, 10), stake: db.leagues[0].stake, payer_id: null, actual_payout: null, lock_at: lockAt(), created_at: now() }; db.weeks.push(nw); emit('weeks', 'INSERT', nw); return nw.id; },
  new_season() { db.weeks = [{ id: id(), league_id: L, n: 1, start_date: new Date().toISOString().slice(0, 10), stake: db.leagues[0].stake, payer_id: null, actual_payout: null, lock_at: lockAt(), created_at: now() }]; db.legs = []; db.spins = []; emit('weeks', 'INSERT', db.weeks[0]); return null; },
  set_week_number({ p_n }) {
    const cur = [...db.weeks].sort((a, b) => b.n - a.n)[0];
    const others = db.weeks.filter((w) => w !== cur).map((w) => w.n);
    if (others.length && p_n <= Math.max(...others)) throw new Error(`This week has to come after Week ${Math.max(...others)}, your latest past week`);
    cur.n = p_n; emit('weeks', 'UPDATE', cur); return null;
  },
  save_past_week({ p_week, p_n, p_start, p_payer, p_legs }) {
    let w;
    if (p_week) {
      w = db.weeks.find((x) => x.id === p_week);
      w.payer_id = p_payer;
      const keep = new Set(p_legs.map((l) => l.player_id));
      db.legs = db.legs.filter((l) => l.week_id !== w.id || keep.has(l.player_id));
    } else {
      if (db.weeks.some((x) => x.n === p_n)) throw new Error(`Week ${p_n} is already in the league. Edit it from History instead.`);
      w = { id: id(), league_id: L, n: p_n, start_date: p_start, stake: db.leagues[0].stake, payer_id: p_payer, actual_payout: null, created_at: now() };
      db.weeks.push(w);
    }
    p_legs.forEach((l) => {
      const was = db.legs.find((x) => x.week_id === w.id && x.player_id === l.player_id);
      if (!was) { db.legs.push(leg(w.id, l.player_id, l.pick, l.odds, l.sport || 'NFL', l.result)); return; }
      // Edited in place, like the real one: keep what the change doesn't make stale.
      const samePick = was.pick === l.pick;
      const sameResult = was.result === l.result;
      Object.assign(was, { pick: l.pick, odds: l.odds, sport: l.sport || 'NFL', result: l.result,
        bet: samePick ? was.bet : null, margin: samePick && sameResult ? was.margin : null, miss: sameResult ? was.miss : null });
    });
    emit('weeks', 'UPDATE', w); emit('legs', 'INSERT', {});
    return w.id;
  },
  delete_past_week({ p_week }) {
    db.weeks = db.weeks.filter((w) => w.id !== p_week);
    db.legs = db.legs.filter((l) => l.week_id !== p_week);
    db.spins = db.spins.filter((s) => s.week_id !== p_week);
    emit('weeks', 'DELETE', {}); return null;
  },
  reset_to_week({ p_week, p_clear_grades }) {
    const w = db.weeks.find((x) => x.id === p_week);
    if (w.n === Math.max(...db.weeks.map((x) => x.n))) throw new Error(`Week ${w.n} is already this week`);
    const gone = new Set(db.weeks.filter((x) => x.n > w.n).map((x) => x.id));
    db.weeks = db.weeks.filter((x) => !gone.has(x.id));
    db.legs = db.legs.filter((l) => !gone.has(l.week_id));
    db.spins = db.spins.filter((x) => !gone.has(x.week_id) && x.week_id !== w.id);
    if (p_clear_grades) db.legs.filter((l) => l.week_id === w.id).forEach((l) => { l.result = null; l.margin = null; });
    emit('weeks', 'DELETE', {}); return null;
  },
  mark_placed({ p_week, p_placed, p_slip_path }) {
    const w = db.weeks.find((x) => x.id === p_week);
    if (p_placed) { w.placed_at = w.placed_at || now(); w.placed_by = uid; w.slip_path = p_slip_path || w.slip_path || null; }
    else { w.placed_at = null; w.placed_by = null; w.slip_path = null; w.slip_paths = []; }
    emit('weeks', 'UPDATE', w); return null;
  },
  add_slips({ p_week, p_paths }) {
    const w = db.weeks.find((x) => x.id === p_week);
    const merged = [...new Set([...(w.slip_paths || []), ...p_paths])];
    if (merged.length > 10) throw new Error('That’s more than 10 screenshots. Remove some first.');
    Object.assign(w, { slip_paths: merged, slip_path: merged[0], placed_at: w.placed_at || now(), placed_by: w.placed_by || uid });
    emit('weeks', 'UPDATE', w); return null;
  },
  remove_slip({ p_week, p_path }) {
    const w = db.weeks.find((x) => x.id === p_week);
    const rest = (w.slip_paths || []).filter((p) => p !== p_path);
    Object.assign(w, rest.length ? { slip_paths: rest, slip_path: rest[0] } : { slip_paths: [], slip_path: null, placed_at: null, placed_by: null });
    emit('weeks', 'UPDATE', w); return null;
  },
  delete_spin({ p_spin }) {
    const s = db.spins.find((x) => x.id === p_spin);
    if (!s) throw new Error('That spin does not exist');
    if (!db.spins.some((x) => x.week_id === s.week_id && x.created_at > s.created_at)) throw new Error('That’s the spin that counts. Only spins replaced by a re-spin can be deleted.');
    db.spins = db.spins.filter((x) => x.id !== p_spin);
    emit('spins', 'DELETE', {}); return null;
  },
  set_deadline({ p_dow, p_time, p_tz }) {
    const lg = db.leagues[0];
    lg.lock_dow = p_dow; lg.lock_time = p_dow == null ? null : p_time + ':00'; if (p_tz) lg.lock_tz = p_tz;
    emit('leagues', 'UPDATE', lg);
    const cur = [...db.weeks].sort((a, b) => b.n - a.n)[0];
    if (cur) { cur.lock_at = lockAt(); emit('weeks', 'UPDATE', cur); }
    return null;
  },
  set_week_lock({ p_week, p_lock_at }) {
    const w = db.weeks.find((x) => x.id === p_week);
    w.lock_at = p_lock_at; emit('weeks', 'UPDATE', w); return null;
  },
  join_league() { return L; },
  create_league() { return L; },
};

const session = { user: { id: uid, email: 'you@example.com' } };

export const demoClient = {
  from: query,
  storage: {
    from() {
      return {
        async upload(path, blob) { files[path] = URL.createObjectURL(blob); return { data: { path }, error: null }; },
        async createSignedUrl(path) { return files[path] ? { data: { signedUrl: files[path] }, error: null } : { data: null, error: { message: 'Object not found' } }; },
        async remove(paths) { paths.forEach((p) => delete files[p]); return { data: null, error: null }; },
      };
    },
  },
  async rpc(name, args) {
    await new Promise((r) => setTimeout(r, 150));
    try { return { data: rpcs[name](args), error: null }; } catch (e) { return { data: null, error: { message: e.message } }; }
  },
  channel() {
    const ch = {
      on(_type, opts, cb) { listeners.push({ table: opts.table, cb, ch }); return ch; },
      subscribe() { return ch; },
    };
    return ch;
  },
  removeChannel(ch) { for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].ch === ch) listeners.splice(i, 1); },
  auth: {
    async getSession() { return { data: { session } }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
    async signOut() { window.location.reload(); },
    async signInWithOtp() { return { error: null }; },
    async verifyOtp() { return { error: null }; },
    async signInWithPassword() { return { error: null }; },
    async updateUser() { await new Promise((r) => setTimeout(r, 150)); return { data: { user: session.user }, error: null }; },
  },
};

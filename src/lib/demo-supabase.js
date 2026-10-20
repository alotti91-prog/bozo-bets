// Demo mode: an in-memory stand-in for Supabase so the app runs with no
// backend. Start it with `npm run demo`. Data resets on reload. Only the
// calls the app makes are implemented. Never used in a normal build.

const uid = 'demo-user';
const id = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);

const L = 'demo-league';
const names = ['Lotti', 'Sully', 'Mikey', 'Danny B', 'Big Chris', 'T-Bone'];
const P = names.map((n, i) => ({ id: 'p' + (i + 1), league_id: L, name: n, active: true, sort: i, created_at: now() }));
const W = [1, 2, 3, 4].map((n) => ({ id: 'w' + n, league_id: L, n, start_date: daysAgo(35 - n * 7), stake: 10, payer_id: null, actual_payout: null, created_at: now() }));
W[0].payer_id = 'p1'; W[1].payer_id = 'p5'; W[2].payer_id = 'p3'; W[3].payer_id = 'p4';
const leg = (w, p, pick, odds, sport, result) => ({ id: id(), week_id: w, league_id: L, player_id: p, pick, odds, sport, result, created_by: uid, created_at: now(), updated_at: now() });

const db = {
  leagues: [{ id: L, name: 'Bozo Bets', stake: 10, invite_code: 'DEMO42', created_by: uid, created_at: now() }],
  players: P,
  members: [
    { league_id: L, user_id: uid, role: 'owner', player_id: 'p1', email: 'you@example.com', joined_at: now() },
    { league_id: L, user_id: 'u2', role: 'member', player_id: 'p2', email: 'sully@example.com', joined_at: now() },
  ],
  weeks: W,
  legs: [
    leg('w1', 'p1', 'Lions -3.5', -110, 'NFL', 'W'), leg('w1', 'p2', 'Bills ML', -180, 'NFL', 'W'), leg('w1', 'p3', 'Chiefs game over 44.5', -110, 'NFL', 'L'),
    leg('w1', 'p4', 'Ohio State -10.5', -110, 'NCAAF', 'W'), leg('w1', 'p5', 'Saquon 75+ rush yds', -125, 'NFL', 'L'), leg('w1', 'p6', 'Gibbs anytime TD', -140, 'NFL', 'W'),
    leg('w2', 'p1', 'Ravens -2.5', -115, 'NFL', 'W'), leg('w2', 'p2', 'Georgia ML', -250, 'NCAAF', 'W'), leg('w2', 'p3', 'Dodgers ML', -160, 'MLB', 'W'),
    leg('w2', 'p4', 'Packers +3', -105, 'NFL', 'W'), leg('w2', 'p5', 'Eagles game under 48.5', -110, 'NFL', 'W'), leg('w2', 'p6', 'Josh Allen 2+ pass TDs', -200, 'NFL', 'W'),
    leg('w3', 'p1', 'Texas -6.5', -110, 'NCAAF', 'L'), leg('w3', 'p2', 'Lions ML', -200, 'NFL', 'W'), leg('w3', 'p3', 'Cowboys +4.5', -110, 'NFL', 'W'),
    leg('w3', 'p4', 'Rangers ML', -130, 'NHL', 'L'), leg('w3', 'p5', 'CeeDee Lamb 70+ rec yds', -115, 'NFL', 'W'), leg('w3', 'p6', 'Bijan 90+ rush yds', 120, 'NFL', 'W'),
    leg('w4', 'p1', 'Bills -6.5', -110, 'NFL', 'W'), leg('w4', 'p2', 'Michigan +3', -110, 'NCAAF', 'W'), leg('w4', 'p3', 'Steelers ML', 135, 'NFL', 'L'),
    leg('w4', 'p4', 'Jets-Patriots under 41.5', -105, 'NFL', 'W'), leg('w4', 'p5', 'Rangers ML', 105, 'NHL', null),
  ],
  spins: [
    { id: 's1', week_id: 'w1', league_id: L, pool: ['p3', 'p5'], landed_id: 'p5', spun_by: uid, created_at: daysAgo(27) + 'T23:00:00Z' },
    { id: 's2', week_id: 'w2', league_id: L, pool: P.map((p) => p.id), landed_id: 'p3', spun_by: uid, created_at: daysAgo(20) + 'T23:00:00Z' },
    { id: 's3', week_id: 'w3', league_id: L, pool: ['p1', 'p4'], landed_id: 'p4', spun_by: uid, created_at: daysAgo(13) + 'T23:00:00Z' },
  ],
};

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
      if (table === 'legs' && rows.some((r) => db.legs.some((l) => l.week_id === r.week_id && l.player_id === r.player_id))) {
        return { data: null, error: { message: 'duplicate key value violates unique constraint "legs_week_id_player_id_key"' } };
      }
      db[table].push(...rows);
      rows.forEach((r) => emit(table, 'INSERT', r));
      return { data: returnRows ? (single ? rows[0] : rows) : null, error: null };
    }
    if (op === 'update') {
      db[table].filter(match).forEach((r) => { Object.assign(r, payload); emit(table, 'UPDATE', r); });
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
    const a = new Uint32Array(1); crypto.getRandomValues(a);
    const landed = pool[a[0] % pool.length];
    const s = { id: id(), week_id: w.id, league_id: L, pool, landed_id: landed, spun_by: uid, created_at: now() };
    db.spins.push(s);
    emit('spins', 'INSERT', s);
    const next = db.weeks.find((x) => x.n === w.n + 1);
    if (next) { next.payer_id = landed; emit('weeks', 'UPDATE', next); }
    else { const nw = { id: id(), league_id: L, n: w.n + 1, start_date: new Date().toISOString().slice(0, 10), stake: db.leagues[0].stake, payer_id: landed, actual_payout: null, created_at: now() }; db.weeks.push(nw); emit('weeks', 'INSERT', nw); }
    return s;
  },
  claim_player({ p_player }) { db.members[0].player_id = p_player; emit('members', 'UPDATE', db.members[0]); return null; },
  assign_player({ p_user, p_player }) { const m = db.members.find((x) => x.user_id === p_user); if (m) m.player_id = p_player; emit('members', 'UPDATE', m); return null; },
  set_member_role({ p_user, p_role }) { const m = db.members.find((x) => x.user_id === p_user); if (m) m.role = p_role; emit('members', 'UPDATE', m); return null; },
  remove_member({ p_user }) { db.members = db.members.filter((x) => x.user_id !== p_user); emit('members', 'DELETE', {}); return null; },
  regenerate_invite() { db.leagues[0].invite_code = 'NEW' + Math.floor(Math.random() * 900 + 100); emit('leagues', 'UPDATE', db.leagues[0]); return db.leagues[0].invite_code; },
  start_next_week() { const n = Math.max(...db.weeks.map((x) => x.n)) + 1; const nw = { id: id(), league_id: L, n, start_date: new Date().toISOString().slice(0, 10), stake: db.leagues[0].stake, payer_id: null, actual_payout: null, created_at: now() }; db.weeks.push(nw); emit('weeks', 'INSERT', nw); return nw.id; },
  new_season() { db.weeks = [{ id: id(), league_id: L, n: 1, start_date: new Date().toISOString().slice(0, 10), stake: db.leagues[0].stake, payer_id: null, actual_payout: null, created_at: now() }]; db.legs = []; db.spins = []; emit('weeks', 'INSERT', db.weeks[0]); return null; },
  join_league() { return L; },
  create_league() { return L; },
};

const session = { user: { id: uid, email: 'you@example.com' } };

export const demoClient = {
  from: query,
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
  },
};

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
const leg = (w, p, pick, odds, sport, result) => ({ id: id(), week_id: w, league_id: L, player_id: p, pick, odds, sport, result, created_by: uid, created_at: now(), updated_at: now() });

const db = {
  leagues: [{ id: L, name: 'Bozo Bets', stake: 10, invite_code: 'DEMO42', created_by: uid, created_at: now(), lock_dow: 0, lock_time: '12:55:00', lock_tz: 'America/New_York' }],
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
  reactions: [],
};
// A few sample reactions on this week's picks (Sully is the other signed-in member).
W[3].lock_at = nextLock(0, '12:55');
db.legs.filter((l) => l.week_id === 'w4').slice(0, 3).forEach((l, i) => {
  db.reactions.push({ leg_id: l.id, league_id: L, user_id: 'u2', emoji: ['🔥', '🤡', '🙏'][i], created_at: now() });
});
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
      if (table === 'reactions') rows.forEach((r) => { r.user_id = uid; r.league_id = L; });
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
      db.legs = db.legs.filter((l) => l.week_id !== w.id);
    } else {
      if (db.weeks.some((x) => x.n === p_n)) throw new Error(`Week ${p_n} is already in the league. Edit it from History instead.`);
      w = { id: id(), league_id: L, n: p_n, start_date: p_start, stake: db.leagues[0].stake, payer_id: p_payer, actual_payout: null, created_at: now() };
      db.weeks.push(w);
    }
    p_legs.forEach((l) => db.legs.push(leg(w.id, l.player_id, l.pick, l.odds, l.sport || 'NFL', l.result)));
    emit('weeks', 'UPDATE', w); emit('legs', 'INSERT', {});
    return w.id;
  },
  delete_past_week({ p_week }) {
    db.weeks = db.weeks.filter((w) => w.id !== p_week);
    db.legs = db.legs.filter((l) => l.week_id !== p_week);
    db.spins = db.spins.filter((s) => s.week_id !== p_week);
    emit('weeks', 'DELETE', {}); return null;
  },
  mark_placed({ p_week, p_placed, p_slip_path }) {
    const w = db.weeks.find((x) => x.id === p_week);
    if (p_placed) { w.placed_at = w.placed_at || now(); w.placed_by = uid; w.slip_path = p_slip_path || w.slip_path || null; }
    else { w.placed_at = null; w.placed_by = null; w.slip_path = null; }
    emit('weeks', 'UPDATE', w); return null;
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

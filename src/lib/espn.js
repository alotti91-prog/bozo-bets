// ESPN's public scores feed (unofficial, no key). Used by the server function
// in api/espn.js, which fetches and caches it, and by the app in dev. These
// functions turn ESPN's large responses into the small shapes the app uses.
// Pure, covered by logic.test.js.

export const SPORTS = {
  // ESPN's scoreboards don't reliably take a date range, so a week is fetched
  // one day at a time (see espnUrls). groups=80 is every FBS game, ranked or not.
  nfl: { label: 'NFL', path: 'football/nfl', props: true },
  ncaaf: { label: 'NCAAF', path: 'football/college-football', props: true, query: 'groups=80&limit=400' },
  nba: { label: 'NBA', path: 'basketball/nba' },
  nhl: { label: 'NHL', path: 'hockey/nhl' },
  mlb: { label: 'MLB', path: 'baseball/mlb' },
};

export const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/';

/** The ESPN address for a request, or null if the request isn't one we allow. */
export function espnUrl({ kind, sport, dates, event, team }) {
  const s = SPORTS[sport];
  if (!s) return null;
  if (kind === 'scoreboard' && /^\d{8}(-\d{8})?$/.test(dates || '')) return `${ESPN_BASE}${s.path}/scoreboard?dates=${dates}${s.query ? '&' + s.query : ''}`;
  if (kind === 'summary' && /^\d{1,12}$/.test(event || '')) return `${ESPN_BASE}${s.path}/summary?event=${event}`;
  if (kind === 'roster' && /^\d{1,8}$/.test(team || '')) return `${ESPN_BASE}${s.path}/teams/${team}/roster`;
  return null;
}

/** Each day in a "20261020-20261026" range (at most 8), or [] if it isn't one. */
export function daysIn(range) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:-(\d{4})(\d{2})(\d{2}))?$/.exec(range || '');
  if (!m) return [];
  const start = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const end = m[4] ? new Date(Date.UTC(+m[4], +m[5] - 1, +m[6])) : start;
  const out = [];
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
    if (out.length > 8) return [];
  }
  return out;
}

/** The ESPN addresses to fetch for a request: one, or one per day for a scoreboard date range; [] if not allowed. */
export function espnUrls(q) {
  if (q.kind === 'scoreboard' && SPORTS[q.sport] && String(q.dates || '').includes('-')) {
    const days = daysIn(q.dates);
    return days.map((d) => espnUrl({ ...q, dates: d })).filter(Boolean);
  }
  const u = espnUrl(q);
  return u ? [u] : [];
}

/** Several scoreboard responses as one, without repeats. */
export function mergeEvents(jsons) {
  const seen = new Set();
  const events = [];
  for (const j of jsons) for (const e of j?.events || []) if (!seen.has(e.id)) { seen.add(e.id); events.push(e); }
  return { events };
}

/** The betting week, Tuesday through Monday, as a dates range: "20261020-20261026". */
export function weekDates(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() - 2 + 7) % 7)); // back to Tuesday
  const end = new Date(d); end.setDate(end.getDate() + 6);
  const f = (x) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}`;
  return `${f(d)}-${f(end)}`;
}

function side(c) {
  const t = c?.team || {};
  const raw = c?.score;
  const score = raw == null || raw === '' ? null : Number(typeof raw === 'object' ? raw.value ?? raw.displayValue : raw);
  return {
    id: String(t.id ?? c?.id ?? ''),
    abbr: t.abbreviation || '',
    name: t.displayName || '',
    short: t.shortDisplayName || t.name || t.abbreviation || '',
    score: Number.isFinite(score) ? score : null,
  };
}

function status(st) {
  const t = st?.type || {};
  return { state: ['pre', 'in', 'post'].includes(t.state) ? t.state : 'pre', detail: t.shortDetail || t.detail || '' };
}

function sides(competitors = []) {
  const home = competitors.find((c) => c.homeAway === 'home') || competitors[0];
  const away = competitors.find((c) => c.homeAway === 'away') || competitors[1];
  return { home: side(home), away: side(away) };
}

// ---- DraftKings lines (ESPN shows them per game) ----
const price = (v) => { // "+145", "-175", "EVEN", or a number → 145, -175, 100
  if (v == null || v === '') return null;
  const s = typeof v === 'number' ? v : String(v).trim().toUpperCase().replace('−', '-');
  if (s === 'EVEN' || s === 'EV') return 100;
  const n = typeof s === 'number' ? s : Number(s.replace(/^\+/, ''));
  return Number.isFinite(n) && Math.abs(n) >= 100 ? Math.round(n) : null;
};
const lineOf = (v) => { // "+3.5", "-3.5", "o44.5", "u44.5", "PK", or a number → 3.5, -3.5, 44.5, 0
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().toUpperCase().replace('−', '-').replace(/^[OU]/, '');
  if (s === 'PK' || s === 'PICK') return 0;
  const n = Number(s.replace(/^\+/, ''));
  return Number.isFinite(n) ? n : null;
};
const latest = (x) => x?.close || x?.current || x?.open || null; // ESPN calls the current line "close"

/** The full board: { spread: { away: { line, price }, home }, ml: { away, home }, total: { line, over, under } }, or null. */
export function oddsBoard(o) {
  if (!o) return null;
  const sa = latest(o.pointSpread?.away), sh = latest(o.pointSpread?.home);
  const spread = lineOf(sa?.line) != null && lineOf(sh?.line) != null
    ? { away: { line: lineOf(sa.line), price: price(sa.odds) }, home: { line: lineOf(sh.line), price: price(sh.odds) } } : null;
  const ma = price(latest(o.moneyline?.away)?.odds ?? o.awayTeamOdds?.moneyLine);
  const mh = price(latest(o.moneyline?.home)?.odds ?? o.homeTeamOdds?.moneyLine);
  const ml = ma != null && mh != null ? { away: ma, home: mh } : null;
  const ov = latest(o.total?.over), un = latest(o.total?.under);
  const tl = lineOf(ov?.line) ?? lineOf(un?.line) ?? (typeof o.overUnder === 'number' ? o.overUnder : null);
  const total = tl != null && (ov || un) ? { line: tl, over: price(ov?.odds), under: price(un?.odds) } : null;
  return spread || ml || total ? { spread, ml, total } : null;
}

/** Scoreboard → [{ id, sport, start, short, state, detail, home, away, odds: { details, total, board } }] */
export function normalizeScoreboard(json, sport) {
  return (json?.events || []).map((e) => {
    const comp = e.competitions?.[0] || {};
    const o = comp.odds?.[0];
    const { home, away } = sides(comp.competitors);
    return {
      id: String(e.id),
      sport,
      start: e.date || comp.date || null,
      short: e.shortName || `${away.abbr} @ ${home.abbr}`,
      ...status(e.status || comp.status),
      home,
      away,
      odds: o ? { details: o.details || '', total: typeof o.overUnder === 'number' ? o.overUnder : null, board: oddsBoard(o) } : null,
    };
  }).filter((g) => g.home.abbr && g.away.abbr);
}

// Football box score categories → our stat names. Matched by ESPN's key,
// falling back to the column label.
const FOOTBALL = {
  passing: [['passingYards', 'YDS', 'passYds'], ['passingTouchdowns', 'TD', 'passTd'], ['interceptions', 'INT', 'int'], ['completions/passingAttempts', 'C/ATT', 'passCmp']],
  rushing: [['rushingYards', 'YDS', 'rushYds'], ['rushingAttempts', 'CAR', 'rushAtt'], ['rushingTouchdowns', 'TD', 'rushTd']],
  receiving: [['receptions', 'REC', 'rec'], ['receivingYards', 'YDS', 'recYds'], ['receivingTouchdowns', 'TD', 'recTd']],
};

/** Game summary → { id, sport, state, detail, home, away, players: [{ id, name, team, stats }] } */
export function normalizeSummary(json, sport, id) {
  const comp = json?.header?.competitions?.[0] || {};
  const { home, away } = sides(comp.competitors);
  const byId = new Map();
  for (const tp of json?.boxscore?.players || []) {
    const teamAbbr = tp.team?.abbreviation || '';
    for (const cat of tp.statistics || []) {
      const wanted = FOOTBALL[cat.name];
      if (!wanted) continue;
      const keys = cat.keys || [];
      const labels = cat.labels || [];
      for (const a of cat.athletes || []) {
        const pid = String(a.athlete?.id || '');
        if (!pid) continue;
        if (!byId.has(pid)) byId.set(pid, { id: pid, name: a.athlete.displayName || a.athlete.shortName || '', team: teamAbbr, stats: {} });
        const p = byId.get(pid);
        for (const [key, label, ours] of wanted) {
          let i = keys.indexOf(key);
          if (i < 0) i = labels.indexOf(label);
          if (i < 0) continue;
          const n = parseFloat(String(a.stats?.[i] ?? '').split('/')[0]);
          p.stats[ours] = Number.isFinite(n) ? n : 0;
        }
      }
    }
  }
  const players = [...byId.values()].map((p) => {
    const s = p.stats;
    s.rushRecYds = (s.rushYds || 0) + (s.recYds || 0);
    s.td = (s.rushTd || 0) + (s.recTd || 0);
    return p;
  });
  return { id: String(id || comp.id || ''), sport, ...status(comp.status), home, away, players };
}

const SKILL = ['QB', 'RB', 'WR', 'TE', 'FB'];

/** Team roster → offensive skill players [{ id, name, pos }], QBs first. Handles grouped and flat shapes. */
export function normalizeRoster(json) {
  const list = (json?.athletes || []).flatMap((g) => (Array.isArray(g?.items) ? g.items : [g]));
  return list
    .map((a) => ({ id: String(a?.id || ''), name: a?.displayName || a?.fullName || '', pos: a?.position?.abbreviation || '' }))
    .filter((a) => a.id && a.name && SKILL.includes(a.pos))
    .sort((a, b) => SKILL.indexOf(a.pos) - SKILL.indexOf(b.pos) || a.name.localeCompare(b.name));
}

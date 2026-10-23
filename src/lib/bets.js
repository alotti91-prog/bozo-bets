// Structured legs: the pick text they save as, and where they stand while the
// game is on. Pure, covered by logic.test.js.
//
// A leg's `bet` (all optional; free-text legs have none):
//   { v: 1, sport: 'nfl', type: 'spread' | 'ml' | 'total' | 'prop',
//     side: 'home' | 'away' (spread, ml) or 'over' | 'under' (total, prop),
//     line: -3.5, stat: 'rushYds', player: { id, name, team },
//     game: { id, start, short, home: { id, abbr, short, name }, away: {...} } }

export const STATS = {
  passYds: { name: 'Passing yards', label: 'pass yds' },
  passTd: { name: 'Passing TDs', label: 'pass TDs' },
  passCmp: { name: 'Completions', label: 'completions' },
  int: { name: 'Interceptions thrown', label: 'INTs' },
  rushYds: { name: 'Rushing yards', label: 'rush yds' },
  rushAtt: { name: 'Rushing attempts', label: 'carries' },
  rec: { name: 'Receptions', label: 'receptions' },
  recYds: { name: 'Receiving yards', label: 'rec yds' },
  rushRecYds: { name: 'Rush + rec yards', label: 'rush+rec yds' },
  td: { name: 'Anytime touchdown', label: 'anytime TD', yesNo: true },
};

export const BET_TYPES = { spread: 'Spread', ml: 'Moneyline', total: 'Total', prop: 'Player prop' };

export const gameKey = (bet) => `${bet.sport}:${bet.game.id}`;

const num = (n) => String(Math.abs(n)).replace(/\.0+$/, '');
/** "+3.5", "−3.5", "PK" */
export const fmtLine = (n) => (n > 0 ? `+${num(n)}` : n < 0 ? `−${num(n)}` : 'PK');

/** Reads what people type for a line: "3.5", "-3.5", "+3", "−7". */
export function parseLine(raw) {
  const s = String(raw ?? '').trim().replace('−', '-');
  if (!/^[-+]?(\d{1,3}(\.\d)?|\.\d)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** The line ESPN shows for a team, from odds like "CHI -3": −3 for CHI, +3 for the other side. */
export function oddsLine(odds, abbr) {
  const m = /^([A-Z0-9&.]+)\s+([-+]?\d+(\.\d+)?)$/.exec((odds?.details || '').trim());
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] === abbr ? n : -n;
}

/** The pick as it reads on the slip: "Lions −3.5", "Lions ML", "DET/GB over 44.5", "Saquon Barkley 75+ rush yds". */
export function pickText(bet) {
  const g = bet.game;
  const t = bet.side === 'home' ? g.home : g.away;
  let s = '';
  if (bet.type === 'spread') s = `${t.short} ${fmtLine(bet.line)}`;
  else if (bet.type === 'ml') s = `${t.short} ML`;
  else if (bet.type === 'total') s = `${g.away.abbr}/${g.home.abbr} ${bet.side} ${num(bet.line)}`;
  else if (bet.type === 'prop') {
    const st = STATS[bet.stat] || { label: bet.stat };
    if (st.yesNo) s = `${bet.player.name} ${st.label}`;
    else if (bet.side === 'over' && !Number.isInteger(bet.line)) s = `${bet.player.name} ${Math.ceil(bet.line)}+ ${st.label}`;
    else s = `${bet.player.name} ${bet.side} ${num(bet.line)} ${st.label}`;
  }
  return s.slice(0, 80);
}

/** What's missing before a structured leg can be saved, or '' if it's complete. */
export function betProblem(b) {
  if (!b.game) return 'Pick the game.';
  if (!b.type) return 'Pick the kind of bet.';
  if (b.type === 'prop') {
    if (!b.player) return 'Pick the player.';
    if (!b.stat) return 'Pick the stat.';
    if (STATS[b.stat]?.yesNo) return '';
  }
  if (!b.side) return b.type === 'spread' || b.type === 'ml' ? 'Pick the team.' : 'Pick over or under.';
  if (b.type !== 'ml' && (b.line == null || !Number.isFinite(b.line))) return 'Enter the line, like 3.5.';
  if ((b.type === 'total' || b.type === 'prop') && b.line < 0) return 'The line can’t be negative.';
  return '';
}

/** ESPN's "6:12 - 3rd" as "Q3 6:12" (hockey: "P2 12:05", overtime: "OT 3:10"). Anything else is left as is. */
export function shortClock(detail, sport) {
  const m = /^(\d{1,2}:\d{2})\s*-\s*(1st|2nd|3rd|4th|\d?OT)$/i.exec(String(detail || '').trim());
  if (!m) return detail || '';
  const per = m[2].toUpperCase();
  if (per.endsWith('OT')) return `${per} ${m[1]}`;
  return `${sport === 'nhl' ? 'P' : 'Q'}${per[0]} ${m[1]}`;
}

/**
 * Where a leg stands right now. game is the latest from ESPN, or null.
 * Returns null without a game, else:
 *   { tone: 'pre' | 'live' | 'win' | 'loss' | 'push', label, score, clock,
 *     away, home ({ abbr, score, mine: is it this bet's team }),
 *     progress (0..1 or null), done (final), locked (decided before the final),
 *     margin (how far from the line, in the bet's units: + ahead, − behind; null for yes/no props) }
 */
export function liveStatus(bet, game) {
  if (!bet || !game) return null;
  const H = game.home.score ?? 0;
  const A = game.away.score ?? 0;
  const score = `${game.away.abbr} ${A}, ${game.home.abbr} ${H}`;
  if (game.state === 'pre') return { tone: 'pre', label: '', score: '', clock: game.detail, progress: null, done: false, locked: false };
  const done = game.state === 'post';
  const mineSide = bet.type === 'spread' || bet.type === 'ml' ? bet.side : null;
  const isMine = (side, abbr) => mineSide === side || (bet.type === 'prop' && !!bet.player?.team && bet.player.team === abbr);
  const away = { abbr: game.away.abbr, score: A, mine: isMine('away', game.away.abbr) };
  const home = { abbr: game.home.abbr, score: H, mine: isMine('home', game.home.abbr) };
  const clock = done ? (game.detail || 'Final') : shortClock(game.detail, bet.sport);
  let margin = null;
  const out = (tone, label, extra = {}) => ({ tone, label, score, clock, away, home, progress: null, done, locked: false, margin, ...extra });
  const line = bet.line;
  const round = (x) => Math.round(x * 10) / 10;

  if (bet.type === 'spread' || bet.type === 'ml') {
    const mine = bet.side === 'home' ? H : A;
    const theirs = bet.side === 'home' ? A : H;
    const m = mine - theirs + (bet.type === 'spread' ? line : 0);
    margin = round(m);
    if (bet.type === 'spread') {
      if (m > 0) return out('win', done ? 'Covered' : 'Covering');
      if (m < 0) return out('loss', done ? 'Didn’t cover' : 'Not covering');
      return out('push', done ? 'Push' : 'On the number');
    }
    if (m > 0) return out('win', done ? 'Won' : 'Winning');
    if (m < 0) return out('loss', done ? 'Lost' : 'Losing');
    return out('push', done ? 'Tie' : 'Tied');
  }

  // Totals and props: a running count against the line.
  let v;
  let unit = '';
  if (bet.type === 'total') v = H + A;
  else {
    const st = STATS[bet.stat] || {};
    const p = (game.players || []).find((x) => x.id === bet.player?.id);
    v = p ? p.stats[bet.stat] || 0 : 0;
    unit = st.label ? ` ${st.label}` : '';
    if (st.yesNo) {
      if (v >= 1) return out('win', 'Scored', { locked: true });
      return done ? out('loss', 'No TD') : out('live', 'No TD yet');
    }
  }
  const target = Number.isInteger(line) ? line : Math.ceil(line);
  margin = round(bet.side === 'over' ? v - line : line - v);
  if (bet.side === 'over') {
    if (v > line) return out('win', bet.type === 'total' ? `Over hit (${v})` : `Hit: ${v}${unit}`, { locked: true, progress: 1 });
    if (done) return v === line ? out('push', `Push at ${v}`) : out('loss', `Fell short: ${v}${unit}`);
    return out('live', `${v} of ${target}${unit}`, { progress: line > 0 ? Math.min(1, v / line) : 0 });
  }
  if (v > line) return out('loss', bet.type === 'total' ? `Went over (${v})` : `Went over: ${v}${unit}`, { locked: true, progress: 1 });
  if (done) return v === line ? out('push', `Push at ${v}`) : out('win', `Stayed under: ${v}${unit}`);
  return out('win', `${v}${unit}, under so far`, { progress: line > 0 ? Math.min(1, v / line) : 0 });
}

/** One word for a leg's dot at the top of the slip: 'win' | 'loss' | 'push' | 'live' | 'pre'. */
export function legState(leg, s) {
  if (leg.result === 'W') return 'win';
  if (leg.result === 'L') return 'loss';
  if (leg.result === 'P') return 'push';
  if (!s || s.tone === 'pre') return 'pre';
  return s.tone;
}

/** The grade a finished game points to ('W' | 'L' | 'P'), or null if it isn't final. */
export function suggestedGrade(s) {
  if (!s || !s.done) return null;
  return { win: 'W', loss: 'L', push: 'P' }[s.tone] || null;
}

/**
 * How far a leg finished from its line, to save with its grade: only when the
 * game is final and agrees with the grade (a hand grade that disagrees, say
 * after a stat correction, saves nothing). null otherwise.
 */
export function gradeMargin(s, result) {
  if (!result || result === 'P' || suggestedGrade(s) !== result || s.margin == null) return null;
  return s.margin;
}

/**
 * Whether to hide an ungraded picked leg's W/L/P buttons: yes while its game
 * hasn't finished (or hasn't started). Typed legs, graded legs, and legs whose
 * game we can't see always show them, so an admin is never stuck.
 */
export function gradeHidden(leg, s, now = Date.now()) {
  if (!leg.bet?.game || leg.result) return false;
  if (s) return !s.done;
  return !!leg.bet.game.start && new Date(leg.bet.game.start).getTime() > now;
}

/** How many legs are still alive: not graded a loss, and not already lost on the field. */
export function aliveCount(legs, statusOf) {
  let alive = 0;
  for (const l of legs) {
    if (l.result === 'L') continue;
    if (!l.result) {
      const s = statusOf(l);
      if (s && (s.done || s.locked) && s.tone === 'loss') continue;
    }
    alive++;
  }
  return { alive, total: legs.length };
}

// ---- The DraftKings board (see components/GameCard.jsx) ----

/** A game's board as tappable choices: both sides of the spread, the total, and the moneyline. */
export function boardOptions(game) {
  const bd = game?.odds?.board;
  if (!bd) return [];
  const out = [];
  if (bd.spread) for (const s of ['away', 'home']) out.push({ key: `spread:${s}`, type: 'spread', side: s, line: bd.spread[s].line, price: bd.spread[s].price });
  if (bd.total) for (const s of ['over', 'under']) out.push({ key: `total:${s}`, type: 'total', side: s, line: bd.total.line, price: bd.total[s] });
  if (bd.ml) for (const s of ['away', 'home']) out.push({ key: `ml:${s}`, type: 'ml', side: s, line: null, price: bd.ml[s] });
  return out;
}

/** Picker state for a tapped board choice, and its price to fill the odds (null if the board had none). */
export function pickFromBoard(sport, game, opt) {
  const b = { ...emptyPick(sport), game, type: opt.type, side: opt.side, lineAuto: opt.type !== 'ml' };
  if (opt.type === 'spread') { b.lineText = String(Math.abs(opt.line)); b.lineSign = opt.line > 0 ? '+' : '-'; }
  if (opt.type === 'total') b.lineText = String(opt.line);
  return { b, price: opt.price };
}

/** Whether picker state is exactly this board choice (to highlight it). */
export function isBoardPick(b, game, opt) {
  if (!b.game || b.game.id !== game.id || b.type !== opt.type || b.side !== opt.side) return false;
  return opt.type === 'ml' || betFromPick(b).line === opt.line;
}

// ---- Leg form state (see components/BetPicker.jsx) ----

/** Blank picker state. */
export const emptyPick = (sport = 'nfl') => ({ sport, game: null, type: null, side: null, lineText: '', lineSign: '-', lineAuto: false, stat: null, player: null });

/** Picker state back from a saved bet (editing a leg). */
export function pickFromBet(bet) {
  const line = typeof bet.line === 'number' ? bet.line : null;
  return {
    ...emptyPick(bet.sport), game: bet.game, type: bet.type, side: bet.side || null, stat: bet.stat || null, player: bet.player || null,
    lineText: line == null ? '' : String(bet.type === 'spread' ? Math.abs(line) : line), lineSign: line != null && line > 0 ? '+' : '-',
  };
}

/** The bet to save from picker state. */
export function betFromPick(b) {
  const team = (t) => ({ id: t.id, abbr: t.abbr, short: t.short, name: t.name });
  const raw = b.type === 'spread' ? `${b.lineSign === '+' ? '+' : '-'}${b.lineText}` : b.lineText;
  const yesNo = b.type === 'prop' && STATS[b.stat]?.yesNo;
  const bet = {
    v: 1, sport: b.sport, type: b.type, side: yesNo ? null : b.side,
    line: b.type === 'ml' || yesNo ? null : parseLine(raw),
    game: b.game && { id: b.game.id, start: b.game.start, short: b.game.short, home: team(b.game.home), away: team(b.game.away) },
  };
  if (b.type === 'prop') { bet.stat = b.stat; bet.player = b.player; }
  if (b.type === 'spread' && bet.line === 0 && b.lineText.trim() === '') bet.line = null;
  return bet;
}

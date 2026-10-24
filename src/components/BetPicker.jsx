import { useEffect, useState } from 'react';
import { SPORTS } from '../lib/espn.js';
import { BET_TYPES, STATS, oddsLine, pickText, betProblem, emptyPick, betFromPick, boardOptions, pickFromBoard, isBoardPick, boardPrice } from '../lib/bets.js';
import { getGames, getRoster } from '../lib/scores.js';
import { gameWhen } from '../lib/ui.js';
import GameCard from './GameCard.jsx';

const ORDER = { pre: 0, in: 1, post: 2 };

/**
 * Pick the bet. Upcoming games show DraftKings' board: tap a price and the
 * pick, line, and odds fill in. "Other bets" (or "Something else") builds it by
 * hand: the kind of bet, the side, the line, or a player prop.
 * value/onChange hold picker state (see emptyPick); onChange(state, price) passes
 * DraftKings' price when the bet is on the board (tapped, or built by hand to match). onTypeInstead switches the form to free text
 * ("Type it instead", right under the sports so nobody scrolls past the games for it).
 */
export default function BetPicker({ value: b, onChange, onTypeInstead }) {
  const [games, setGames] = useState({ sport: null, list: [], err: '' });
  const [find, setFind] = useState('');
  const [custom, setCustom] = useState(false); // building the bet by hand instead of from the board
  const [roster, setRoster] = useState({ key: '', list: [], err: '' });

  useEffect(() => {
    let live = true;
    getGames(b.sport).then(
      (list) => { if (live) setGames({ sport: b.sport, list, err: '' }); },
      () => { if (live) setGames({ sport: b.sport, list: [], err: 'Couldn’t load this week’s games right now.' }); },
    );
    return () => { live = false; };
  }, [b.sport]);

  const rosterKey = b.type === 'prop' && b.game ? `${b.sport}:${b.game.id}` : '';
  useEffect(() => {
    if (!rosterKey) return undefined;
    let live = true;
    Promise.all([getRoster(b.sport, b.game.away.id), getRoster(b.sport, b.game.home.id)]).then(
      ([a, h]) => { if (live) setRoster({ key: rosterKey, list: [...a.map((p) => ({ ...p, team: b.game.away.abbr })), ...h.map((p) => ({ ...p, team: b.game.home.abbr }))], err: '' }); },
      () => { if (live) setRoster({ key: rosterKey, list: [], err: 'Couldn’t load the rosters. Type this one instead.' }); },
    );
    return () => { live = false; };
  }, [rosterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = games.sport !== b.sport;
  // The picked game's board, if it has one and hasn't started.
  const listGame = b.game ? games.list.find((g) => g.id === b.game.id) : null;
  const boardGame = listGame && listGame.state === 'pre' && boardOptions(listGame).length ? listGame : null;
  // Building it by hand: when it lands exactly on DraftKings' main line, pass that price along too.
  const set = (patch) => { const nb = { ...b, ...patch }; onChange(nb, boardPrice(nb, boardGame)); };
  // A saved leg's game has no odds; borrow them from this week's list when it's there.
  const odds = b.game?.odds || games.list.find((g) => g.id === b.game?.id)?.odds || null;
  const pickSport = (s) => { setFind(''); setCustom(false); onChange(emptyPick(s)); };
  const pickGame = (g) => { setCustom(!!g); onChange({ ...emptyPick(b.sport), game: g }); };
  const pickBoard = (g, opt) => { setCustom(false); const { b: nb, price } = pickFromBoard(b.sport, g, opt); onChange(nb, price); };
  const onBoard = boardGame && b.type && boardOptions(boardGame).some((o) => isBoardPick(b, boardGame, o));
  const showCustom = !boardGame || custom || (b.type && !onBoard);
  const pickType = (t) => {
    const patch = { type: t, side: null, stat: null, player: null, lineText: '', lineSign: '-', lineAuto: false };
    if (t === 'total' && odds?.total != null) Object.assign(patch, { lineText: String(odds.total), lineAuto: true });
    set(patch);
  };
  const pickTeam = (side) => {
    const patch = { side };
    if (b.type === 'spread' && (!b.lineText || b.lineAuto)) {
      const l = oddsLine(odds, b.game[side].abbr);
      if (l != null) Object.assign(patch, { lineText: String(Math.abs(l)), lineSign: l > 0 ? '+' : '-', lineAuto: true });
    }
    set(patch);
  };

  const q = find.trim().toLowerCase();
  const shown = (q ? games.list.filter((g) => [g.short, g.home.name, g.away.name].join(' ').toLowerCase().includes(q)) : games.list)
    .slice().sort((x, y) => (ORDER[x.state] ?? 1) - (ORDER[y.state] ?? 1) || String(x.start).localeCompare(String(y.start)));
  const yesNo = b.type === 'prop' && STATS[b.stat]?.yesNo;
  const bet = betFromPick(b);
  const ready = !betProblem(bet);
  const teams = b.game ? [['away', b.game.away], ['home', b.game.home]] : [];

  return (
    <div className="stack bp">
      <div className="segmented" role="group" aria-label="Sport">
        {Object.entries(SPORTS).map(([k, s]) => (
          <button key={k} type="button" aria-pressed={b.sport === k} onClick={() => pickSport(k)}>{s.label}</button>
        ))}
        <button type="button" aria-pressed={false} onClick={onTypeInstead}>Other</button>
      </div>
      <div className="bp-lead">
        {!b.game && <span className="hint">Tap a price to pick it.</span>}
        <button type="button" className="text-btn link-sm" onClick={onTypeInstead}>Type it instead</button>
      </div>

      {b.game ? (
        <>
          <div className="bp-game is-picked">
            <span className="bp-game-name"><strong>{b.game.short}</strong><span className="sub">{gameWhen(listGame || b.game)}</span></span>
            <button type="button" className="text-btn nose" onClick={() => pickGame(null)}>Change</button>
          </div>
          {boardGame && !showCustom && (
            <>
              <GameCard game={boardGame} sport={b.sport} head={false} onPick={(o) => pickBoard(boardGame, o)} selected={(o) => isBoardPick(b, boardGame, o)} />
              <button type="button" className="text-btn muted center" onClick={() => setCustom(true)}>Something else: a player prop or another line</button>
            </>
          )}
          {boardGame && showCustom && (
            <button type="button" className="text-btn muted center" onClick={() => { setCustom(false); onChange({ ...emptyPick(b.sport), game: b.game }); }}>Back to DraftKings{'’'} lines</button>
          )}
        </>
      ) : (
        <div className="stack" style={{ gap: 6 }}>
          {loading && <p className="sub">Loading this week{'’'}s games{'…'}</p>}
          {!loading && games.err && (
            <p className="hint err">{games.err} <button type="button" className="link" onClick={onTypeInstead}>Type it instead</button></p>
          )}
          {!loading && !games.err && !games.list.length && (
            <p className="hint">No {SPORTS[b.sport].label} games this week. <button type="button" className="link" onClick={onTypeInstead}>Type it instead</button></p>
          )}
          {games.list.length > 8 && (
            <input aria-label="Find a team" placeholder="Find a team" value={find} onChange={(e) => setFind(e.target.value)} autoComplete="off" />
          )}
          <div className="bp-games">
            {shown.map((g) => (
              <GameCard key={g.id} game={g} sport={b.sport} onPick={(o) => pickBoard(g, o)} onOpen={() => pickGame(g)} />
            ))}
          </div>
        </div>
      )}

      {b.game && showCustom && (
        <div className="segmented" role="group" aria-label="Kind of bet">
          {Object.entries(BET_TYPES).filter(([k]) => k !== 'prop' || SPORTS[b.sport]?.props).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={b.type === k} onClick={() => pickType(k)}>{k === 'prop' ? 'Player' : label}</button>
          ))}
        </div>
      )}

      {showCustom && (b.type === 'spread' || b.type === 'ml') && (
        <div className="choices" role="group" aria-label="Team">
          {teams.map(([side, t]) => (
            <button key={side} type="button" aria-pressed={b.side === side} onClick={() => pickTeam(side)}>
              {t.short}<span>{side === 'away' ? 'Away' : 'Home'} · {t.abbr}</span>
            </button>
          ))}
        </div>
      )}

      {showCustom && b.type === 'prop' && (
        <>
          {roster.key !== rosterKey && <p className="sub">Loading players{'…'}</p>}
          {roster.key === rosterKey && roster.err && <p className="hint err">{roster.err} <button type="button" className="link" onClick={onTypeInstead}>Type it instead</button></p>}
          {roster.key === rosterKey && !roster.err && (
            <div className="field">
              <label htmlFor="bp-player">Player</label>
              <select id="bp-player" value={b.player?.id || ''} onChange={(e) => {
                const p = roster.list.find((x) => x.id === e.target.value);
                set({ player: p ? { id: p.id, name: p.name, team: p.team } : null });
              }}>
                <option value="">Choose{'…'}</option>
                {teams.map(([side, t]) => (
                  <optgroup key={side} label={t.name || t.abbr}>
                    {roster.list.filter((p) => p.team === t.abbr).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.pos})</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="bp-stat">Stat</label>
            <select id="bp-stat" value={b.stat || ''} onChange={(e) => set({ stat: e.target.value || null })}>
              <option value="">Choose{'…'}</option>
              {Object.entries(STATS).map(([k, s]) => <option key={k} value={k}>{s.name}</option>)}
            </select>
          </div>
        </>
      )}

      {showCustom && (b.type === 'total' || (b.type === 'prop' && b.stat && !yesNo)) && (
        <div className="choices" role="group" aria-label="Over or under">
          {['over', 'under'].map((s) => <button key={s} type="button" aria-pressed={b.side === s} onClick={() => set({ side: s })}>{s === 'over' ? 'Over' : 'Under'}</button>)}
        </div>
      )}

      {showCustom && (b.type === 'spread' || b.type === 'total' || (b.type === 'prop' && b.stat && !yesNo)) && (
        <div className="field">
          <label htmlFor="bp-line">{b.type === 'spread' ? 'Line' : 'Number'}</label>
          <div className="odds-in" style={{ maxWidth: 200 }}>
            {b.type === 'spread' && (
              <button type="button" aria-label={b.lineSign === '+' ? 'Getting points, tap for giving' : 'Giving points, tap for getting'}
                onClick={() => set({ lineSign: b.lineSign === '+' ? '-' : '+', lineAuto: false })}>{b.lineSign === '+' ? '+' : '−'}</button>
            )}
            <input id="bp-line" inputMode="decimal" autoComplete="off" placeholder={b.type === 'spread' ? '3.5' : b.type === 'total' ? '44.5' : '74.5'}
              value={b.lineText} onChange={(e) => {
                const v = e.target.value.trim();
                const patch = { lineText: v.replace(/^[-+−]/, ''), lineAuto: false };
                if (b.type === 'spread' && /^[-−]/.test(v)) patch.lineSign = '-';
                if (b.type === 'spread' && v.startsWith('+')) patch.lineSign = '+';
                set(patch);
              }} />
          </div>
          {b.lineAuto && <p className="hint">DraftKings{'’'} line from ESPN. Change it if yours is different.</p>}
        </div>
      )}

      {ready && <p className="bp-preview">Saves as <strong>{pickText(bet)}</strong></p>}
    </div>
  );
}

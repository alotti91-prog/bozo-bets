import { useEffect, useState } from 'react';
import { SPORTS } from '../lib/espn.js';
import { BET_TYPES, STATS, oddsLine, pickText, betProblem, emptyPick, betFromPick } from '../lib/bets.js';
import { getGames, getRoster } from '../lib/scores.js';

const kick = (iso) => {
  try { return new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }); } catch { return ''; }
};
const gameWhen = (g) => (g.state === 'pre' ? kick(g.start) : g.state === 'post' ? 'Final' : `${g.away.score ?? 0}–${g.home.score ?? 0} · ${g.detail}`);

/**
 * Pick the game, the kind of bet, and the details. The pick text writes itself.
 * value/onChange hold picker state (see emptyPick). onTypeInstead switches the
 * form to free text.
 */
export default function BetPicker({ value: b, onChange, onTypeInstead }) {
  const [games, setGames] = useState({ sport: null, list: [], err: '' });
  const [find, setFind] = useState('');
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
  const set = (patch) => onChange({ ...b, ...patch });
  // A saved leg's game has no odds; borrow them from this week's list when it's there.
  const odds = b.game?.odds || games.list.find((g) => g.id === b.game?.id)?.odds || null;
  const pickSport = (s) => { setFind(''); onChange(emptyPick(s)); };
  const pickGame = (g) => onChange({ ...emptyPick(b.sport), game: g });
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
  const shown = q ? games.list.filter((g) => [g.short, g.home.name, g.away.name].join(' ').toLowerCase().includes(q)) : games.list;
  const yesNo = b.type === 'prop' && STATS[b.stat]?.yesNo;
  const bet = betFromPick(b);
  const ready = !betProblem(bet);
  const teams = b.game ? [['away', b.game.away], ['home', b.game.home]] : [];

  return (
    <div className="stack bp">
      <div className="bp-chips" role="group" aria-label="Sport">
        {Object.entries(SPORTS).map(([k, s]) => (
          <button key={k} type="button" className="chip bp-chip" aria-pressed={b.sport === k} onClick={() => pickSport(k)}>{s.label}</button>
        ))}
        <button type="button" className="chip bp-chip" onClick={onTypeInstead}>Other</button>
      </div>

      {b.game ? (
        <div className="bp-game is-picked">
          <span><strong>{b.game.short}</strong> <span className="sub">{b.game.start ? kick(b.game.start) : ''}</span></span>
          <button type="button" className="link" onClick={() => pickGame(null)}>Change</button>
        </div>
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
              <button key={g.id} type="button" className="bp-game" onClick={() => pickGame(g)}>
                <strong>{g.short}</strong><span className={`sub${g.state === 'in' ? ' is-live' : ''}`}>{gameWhen(g)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {b.game && (
        <div className="bp-chips" role="group" aria-label="Kind of bet">
          {Object.entries(BET_TYPES).filter(([k]) => k !== 'prop' || SPORTS[b.sport]?.props).map(([k, label]) => (
            <button key={k} type="button" className="chip bp-chip" aria-pressed={b.type === k} onClick={() => pickType(k)}>{label}</button>
          ))}
        </div>
      )}

      {(b.type === 'spread' || b.type === 'ml') && (
        <div className="seg bp-seg" role="group" aria-label="Team">
          {teams.map(([side, t]) => (
            <button key={side} type="button" aria-pressed={b.side === side} onClick={() => pickTeam(side)}>{t.short}</button>
          ))}
        </div>
      )}

      {b.type === 'prop' && (
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

      {(b.type === 'total' || (b.type === 'prop' && b.stat && !yesNo)) && (
        <div className="seg bp-seg" role="group" aria-label="Over or under">
          {['over', 'under'].map((s) => <button key={s} type="button" aria-pressed={b.side === s} onClick={() => set({ side: s })}>{s === 'over' ? 'Over' : 'Under'}</button>)}
        </div>
      )}

      {(b.type === 'spread' || b.type === 'total' || (b.type === 'prop' && b.stat && !yesNo)) && (
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

      {ready && <p className="bp-preview">Saves as: <strong>{pickText(bet)}</strong></p>}
      <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={onTypeInstead}>Type it instead</button>
    </div>
  );
}

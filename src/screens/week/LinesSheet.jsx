import { useEffect, useState } from 'react';
import { SPORTS } from '../../lib/espn.js';
import { boardOptions } from '../../lib/bets.js';
import { getGames } from '../../lib/scores.js';
import { Sheet } from '../../components/common.jsx';
import GameCard from '../../components/GameCard.jsx';

/**
 * This week's DraftKings lines for upcoming games, to look over before picking.
 * Read-only: picking happens in "Add your leg", which has the same board.
 * onAdd (when you can still add a leg) closes this and opens that.
 */
export default function LinesSheet({ onClose, onAdd, addLabel }) {
  const [sport, setSport] = useState('nfl');
  const [games, setGames] = useState({ sport: null, list: [], err: '' });

  useEffect(() => {
    let live = true;
    getGames(sport).then(
      (list) => { if (live) setGames({ sport, list, err: '' }); },
      () => { if (live) setGames({ sport, list: [], err: 'Couldn’t load the lines right now. Try again in a minute.' }); },
    );
    return () => { live = false; };
  }, [sport]);

  const loading = games.sport !== sport;
  const upcoming = games.list.filter((g) => g.state === 'pre' && boardOptions(g).length)
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));

  return (
    <Sheet title="This week’s lines" onClose={onClose}>
      <div className="segmented" role="group" aria-label="Sport">
        {Object.entries(SPORTS).map(([k, s]) => (
          <button key={k} type="button" aria-pressed={sport === k} onClick={() => setSport(k)}>{s.label}</button>
        ))}
      </div>
      {loading ? <p className="sub">Loading{'…'}</p>
        : games.err ? <p className="hint err">{games.err}</p>
        : !upcoming.length ? <p className="note">No {SPORTS[sport].label} lines posted for games that haven{'’'}t started.</p>
        : <div className="bp-games">{upcoming.map((g) => <GameCard key={g.id} game={g} sport={sport} />)}</div>}
      <p className="fine">DraftKings lines from ESPN. They move, so check DraftKings before the bet goes in.</p>
      {onAdd && <button type="button" className="btn primary big" onClick={onAdd}>{addLabel}</button>}
    </Sheet>
  );
}

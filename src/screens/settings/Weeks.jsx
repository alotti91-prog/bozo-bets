import { useState } from 'react';
import { nflWeek } from '../../lib/nfl.js';
import WeekNumberForm from './WeekNumberForm.jsx';
import { settingsRpc } from './rpc.js';

// Admins only: this week's number, opening the next week by hand, and (owner only) a new season.
export default function Weeks({ data, isOwner, reload }) {
  const [confirm, setConfirm] = useState(null); // 'next' | 'season'
  const league = data.league;
  const rpc = (fn, args, ok) => settingsRpc(fn, args, ok, reload);
  return (
    <div className="stack">
      <WeekNumberForm data={data} reload={reload} />

      {confirm === 'next' ? (
        <div className="confirm-box">
          <p>Open the next week without spinning? You{'’'}ll pick who puts in by hand.</p>
          <div className="btns">
            <button type="button" className="btn small primary" onClick={() => { setConfirm(null); rpc('start_next_week', { p_league: league.id }, 'Next week is open.'); }}>Open next week</button>
            <button type="button" className="btn small" onClick={() => setConfirm(null)}>Never mind</button>
          </div>
        </div>
      ) : <button type="button" className="btn" onClick={() => setConfirm('next')}>Open next week without spinning</button>}

      {isOwner && (confirm === 'season' ? (
        <div className="confirm-box">
          <p>Delete every week, pick, and spin, and start over at Week {nflWeek().week} (the current NFL week)? Players and logins stay. This can{'’'}t be undone.</p>
          <div className="btns">
            <button type="button" className="btn small nose" onClick={() => { setConfirm(null); rpc('new_season', { p_league: league.id, p_first_week: nflWeek().week }, 'New season started.'); }}>Delete and restart</button>
            <button type="button" className="btn small" onClick={() => setConfirm(null)}>Keep everything</button>
          </div>
        </div>
      ) : (
        <div className="stack-sm">
          <button type="button" className="text-btn danger" onClick={() => setConfirm('season')}>Start a new season</button>
          <p className="fine">Deletes every week, pick, and spin. Players and logins stay.</p>
        </div>
      ))}
    </div>
  );
}

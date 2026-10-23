import { useState } from 'react';
import { isElimination } from '../../lib/wheel.js';
import { IconPlay, IconTrash } from '../../components/common.jsx';

/**
 * Every spin, newest first. The latest spin for a week counts; earlier ones were
 * replaced by a re-spin and are crossed out (admins can delete those).
 * Spins flagged hidden (not watched yet) show ??? instead of the bozo.
 */
export default function WheelLog({ spins, allSpins, isAdmin, pname, weekN, replaced, busy, onReplay, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(null); // spin id awaiting delete confirmation
  if (!spins.length) return null;
  return (
    <section className="group">
      <h3 className="group-title">Past spins</h3>
      <ol className="list log">
        {spins.slice(0, 12).map((s) => {
          const n = weekN(s.week_id);
          const idx = allSpins.filter((x) => x.week_id === s.week_id).findIndex((x) => x.id === s.id);
          const old = replaced(s);
          return (
            <li key={s.id} className={old ? 'is-replaced' : ''}>
              <span className="log-wk">Wk {n ?? '?'}</span>
              <span className="log-who">
                {s.hidden ? <b className="is-hidden">???</b> : old ? <s>{pname(s.landed_id)}</s> : <b>{pname(s.landed_id)}</b>}
                <small>{s.hidden ? 'Tap ▶ to find out' : old ? 'Replaced' : `${isElimination(s) ? 'Last of' : 'Out of'} ${s.pool.length}${idx > 0 ? ' · re-spin' : ''}`}</small>
              </span>
              <span className="log-acts">
                {isAdmin && old && (
                  <button type="button" className="round-btn" onClick={() => setConfirmDel(confirmDel === s.id ? null : s.id)}
                    aria-label={`Delete the replaced Week ${n ?? ''} spin`} title="Delete"><IconTrash /></button>
                )}
                <button type="button" className="round-btn play" disabled={busy} onClick={() => onReplay(s)}
                  aria-label={`Watch the Week ${n ?? ''} spin again`} title="Watch again"><IconPlay /></button>
              </span>
              {confirmDel === s.id && (
                <span className="log-confirm">Delete this replaced spin? It won{'’'}t change who{'’'}s on the hook.
                  <button type="button" className="text-btn danger" onClick={() => { setConfirmDel(null); onDelete(s); }}>Delete</button>
                  <button type="button" className="text-btn" onClick={() => setConfirmDel(null)}>Keep</button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="fine center">The server decides every spin. Nobody can rig it.</p>
    </section>
  );
}

import { useState } from 'react';
import { fmtWhen } from '../../lib/ui.js';
import { isElimination } from '../../lib/wheel.js';

/**
 * Every spin, newest first. The latest spin for a week counts; earlier ones were
 * replaced by a re-spin and are crossed out (admins can delete those).
 * Spins flagged hidden (not watched yet) show ??? instead of the bozo.
 */
export default function WheelLog({ spins, allSpins, isAdmin, pname, weekN, replaced, busy, onReplay, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(null); // spin id awaiting delete confirmation
  if (!spins.length) return null;
  return (
    <section className="card">
      <h3 className="sec-title-sm">Wheel log</h3>
      <ol className="log">
        {spins.slice(0, 12).map((s) => {
          const n = weekN(s.week_id);
          const idx = allSpins.filter((x) => x.week_id === s.week_id).findIndex((x) => x.id === s.id);
          const old = replaced(s);
          return (
            <li key={s.id} className={old ? 'is-replaced' : ''}>
              <span className="log-wk">Wk {n ?? '?'}</span>
              <span className="log-who">
                {s.hidden ? <span className="is-hidden">???</span> : old ? <s>{pname(s.landed_id)}</s> : pname(s.landed_id)}{' '}
                <small>{s.hidden ? 'tap ▶ to find out' : `${isElimination(s) ? 'last left of' : 'out of'} ${s.pool.length}${old ? ' · replaced' : idx > 0 ? ' · re-spin' : ''}`}</small>
              </span>
              <time dateTime={s.created_at}>{fmtWhen(s.created_at)}</time>
              <span className="log-acts">
                {isAdmin && old && (
                  <button type="button" className="log-btn" onClick={() => setConfirmDel(confirmDel === s.id ? null : s.id)}
                    aria-label={`Delete the replaced Week ${n ?? ''} spin`} title="Delete">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
                  </button>
                )}
                <button type="button" className="log-btn log-play" disabled={busy} onClick={() => onReplay(s)}
                  aria-label={`Watch the Week ${n ?? ''} spin again`} title="Watch again">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>
                </button>
              </span>
              {confirmDel === s.id && (
                <span className="log-confirm">Delete this replaced spin? It won{'’'}t change who{'’'}s on the hook.
                  <button type="button" className="link danger" onClick={() => { setConfirmDel(null); onDelete(s); }}>Delete</button>
                  <button type="button" className="link" onClick={() => setConfirmDel(null)}>Keep</button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="fine">Every spin is logged here. When a week is re-spun, only the latest counts; the replaced ones are crossed out{isAdmin ? ' and can be deleted' : ''}. Tap ▶ to watch one again.</p>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { wheelContext } from '../lib/wheel.js';
import { dollars } from '../lib/odds.js';
import { toast, listNames, fmtWhen, isMuted, setMuted } from '../lib/ui.js';
import WheelCanvas from '../components/WheelCanvas.jsx';

/**
 * The database picks the result (spin_wheel). This screen only animates to it.
 * When anyone spins, every phone with this tab open animates the same spin.
 */
export default function WheelTab({ data, isAdmin, reload, pname, spinEvent }) {
  const wheelRef = useRef(null);
  const [active, setActive] = useState(null); // spin being animated: { id, pool, landed_id, weekN }
  const [revealed, setRevealed] = useState(null);
  const [poolSel, setPoolSel] = useState(null); // { week, ids } — a manual pool for one week
  const [confirmFor, setConfirmFor] = useState(null); // week id awaiting re-spin confirmation
  const [busy, setBusy] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const handled = useRef(new Set());

  const ctx = wheelContext(data);
  const order = data.players.map((p) => p.id);
  const sortIds = (ids) => [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));

  const weekId = ctx.week?.id;
  const confirmRespin = confirmFor != null && confirmFor === ctx.last?.week.id;
  const setConfirmRespin = (on) => setConfirmFor(on ? ctx.last?.week.id ?? null : null);

  const defaultPool = ctx.mode === 'ready'
    ? sortIds(ctx.losers.length ? ctx.losers : data.players.filter((p) => p.active).map((p) => p.id))
    : [];
  const pool = poolSel && poolSel.week === weekId ? poolSel.ids : defaultPool;

  async function animate(spin) {
    if (handled.current.has(spin.id)) return;
    handled.current.add(spin.id);
    const week = data.weeks.find((w) => w.id === spin.week_id);
    setActive({ ...spin, weekN: week ? week.n : null });
    setRevealed(null);
    await wheelRef.current?.spinTo(spin.pool.map(pname), spin.pool.indexOf(spin.landed_id), spin.id);
    setActive(null);
    setRevealed(spin.id);
    reload();
  }

  // Someone spun (here or on another phone): animate it. `handled` makes sure
  // each spin animates once, whether the live event or our own call arrives first.
  useEffect(() => {
    if (spinEvent) animate(spinEvent);
  }, [spinEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  async function spin(weekId, ids) {
    setBusy(true);
    setConfirmRespin(false);
    const { data: row, error } = await supabase.rpc('spin_wheel', { p_week: weekId, p_pool: ids });
    setBusy(false);
    if (error) { toast(friendly(error)); return; }
    animate(Array.isArray(row) ? row[0] : row);
  }

  // What the wheel shows right now.
  let names = [];
  let restAt = null;
  let restKey = null;
  if (active) {
    names = active.pool.map(pname);
  } else if (ctx.mode === 'ready') {
    names = pool.map(pname);
  } else if (ctx.mode === 'waiting' && ctx.last) {
    names = ctx.last.spin.pool.map(pname);
    restAt = ctx.last.spin.pool.indexOf(ctx.last.spin.landed_id);
    restKey = ctx.last.spin.id;
  } else if (ctx.mode === 'waiting') {
    names = sortIds(ctx.losers.length ? ctx.losers : data.players.filter((p) => p.active).map((p) => p.id)).map(pname);
  }

  // Hide the spin that's still animating so the log doesn't spoil the result.
  const allSpins = [...data.spins].reverse().filter((s) => !active || s.id !== active.id);

  return (
    <>
      <section className="card wheel-card">
        {ctx.mode === 'none' && <h2 className="sec-title">The Bozo Wheel</h2>}
        {ctx.mode === 'ready' && !active && (
          <>
            <h2 className="sec-title">Week {ctx.week.n} wheel</h2>
            <p className="sub">
              {ctx.losers.length
                ? `${listNames(sortIds(ctx.losers).map(pname))}${ctx.losers.length > 1 ? ' all' : ''} missed. Spin to see who puts in ${dollars(data.league.stake)} for Week ${ctx.week.n + 1}.`
                : `Nobody missed, so everyone goes in the wheel for Week ${ctx.week.n + 1}.`}
            </p>
          </>
        )}
        {(ctx.mode === 'waiting' || active) && <h2 className="sec-title">The Bozo Wheel</h2>}

        <WheelCanvas ref={wheelRef} names={names} restAt={restAt} restKey={restKey} />

        {active && (
          <div className="result" role="status">
            <span className="label-sm">{active.weekN ? `Week ${active.weekN} wheel` : 'Wheel'} is spinning</span>
            <strong className="result-name">{'…'}</strong>
          </div>
        )}

        {!active && ctx.mode === 'waiting' && ctx.last && (
          <div className={`result${revealed === ctx.last.spin.id ? ' reveal' : ''}`} role="status">
            <span className="label-sm">Week {ctx.last.week.n} wheel landed on</span>
            <strong className="result-name">{pname(ctx.last.spin.landed_id)}</strong>
            <span className="result-sub">Puts in {dollars(ctx.week.stake)} for Week {ctx.week.n}</span>
          </div>
        )}

        {!active && ctx.mode === 'ready' && (isAdmin ? (
          <div className="stack">
            <div className="field">
              <span className="lbl">In the wheel (tap to add or remove)</span>
              <div className="chips">
                {sortIds([...new Set([...data.players.filter((p) => p.active).map((p) => p.id), ...ctx.legs.map((l) => l.player_id)])]).map((id) => {
                  const on = pool.includes(id);
                  return (
                    <button key={id} type="button" className="chip" aria-pressed={on}
                      onClick={() => setPoolSel({ week: weekId, ids: sortIds(on ? pool.filter((x) => x !== id) : [...pool, id]) })}>{pname(id)}</button>
                  );
                })}
              </div>
            </div>
            <button className="btn nose spin-btn" disabled={!pool.length || busy} onClick={() => spin(ctx.week.id, pool)}>
              {busy ? 'Spinning…' : 'Spin the wheel'}
            </button>
          </div>
        ) : <p className="note">The commish spins the wheel. Keep this tab open to watch it live.</p>)}

        {!active && ctx.mode === 'waiting' && (
          ctx.last ? (
            isAdmin ? (confirmRespin ? (
              <div className="confirm-box">
                <p>Spin Week {ctx.last.week.n} again with the same names? The re-spin is logged for everyone to see.</p>
                <div className="btns">
                  <button className="btn small nose" disabled={busy} onClick={() => spin(ctx.last.week.id, ctx.last.spin.pool)}>Spin again</button>
                  <button className="btn small" onClick={() => setConfirmRespin(false)}>Never mind</button>
                </div>
              </div>
            ) : (
              <div className="wheel-foot">
                <span className="sub">Week {ctx.week.n} spins once every leg is graded.</span>
                <button className="link" onClick={() => setConfirmRespin(true)}>Re-spin Week {ctx.last.week.n}</button>
              </div>
            )) : <p className="sub">Week {ctx.week.n} spins once every leg is graded.</p>
          ) : (
            <p className="sub">{ctx.legs.length ? `Opens once every leg is graded. ${ctx.info.pending.length} still pending.` : 'Opens once this week’s legs are in and graded.'}</p>
          )
        )}
        {ctx.mode === 'none' && <p className="sub">Start a week first. Anyone whose leg misses goes in the wheel.</p>}

        <div className="wheel-foot">
          <span className="fine">The server picks the result with a secure random number, so the spinner can{'’'}t rig it.</span>
          <button className="link" onClick={() => { setMuted(!muted); setMutedState(!muted); }}>Sound {muted ? 'off' : 'on'}</button>
        </div>
      </section>

      {allSpins.length > 0 && (
        <section className="card">
          <h3 className="sec-title-sm">Wheel log</h3>
          <ol className="log">
            {allSpins.slice(0, 12).map((s) => {
              const w = data.weeks.find((x) => x.id === s.week_id);
              const idx = data.spins.filter((x) => x.week_id === s.week_id).findIndex((x) => x.id === s.id);
              return (
                <li key={s.id}>
                  <span className="log-wk">Wk {w ? w.n : '?'}</span>
                  <span className="log-who">{pname(s.landed_id)} <small>out of {s.pool.length}{idx > 0 ? ' · re-spin' : ''}</small></span>
                  <time dateTime={s.created_at}>{fmtWhen(s.created_at)}</time>
                </li>
              );
            })}
          </ol>
          <p className="fine">Every spin is logged here, re-spins included.</p>
        </section>
      )}
    </>
  );
}

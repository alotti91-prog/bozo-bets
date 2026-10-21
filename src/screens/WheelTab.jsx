import { useEffect, useRef, useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { wheelContext } from '../lib/wheel.js';
import { dollars } from '../lib/odds.js';
import { toast, listNames, fmtWhen, isMuted, setMuted } from '../lib/ui.js';
import WheelCanvas from '../components/WheelCanvas.jsx';

/**
 * The database picks the result (spin_wheel). This screen only animates to it.
 * When anyone spins, every phone with this tab open animates the same spin, once.
 * Any past spin can be replayed; it always lands on the same name.
 */
export default function WheelTab({ data, isAdmin, reload, pname, spinEvent, seenSpins, markWatched }) {
  const wheelRef = useRef(null);
  const cardRef = useRef(null);
  const animating = useRef(false);
  const [active, setActive] = useState(null); // spin being animated: { ...spin, weekN, replay }
  const [revealed, setRevealed] = useState(null);
  const [focus, setFocus] = useState(null); // an older spin left on screen after replaying it
  const [poolSel, setPoolSel] = useState(null); // { week, ids }: a hand-picked pool for one week
  const [confirmFor, setConfirmFor] = useState(null); // week id awaiting re-spin confirmation
  const [confirmDel, setConfirmDel] = useState(null); // spin id awaiting delete confirmation
  const [busy, setBusy] = useState(false);
  const [muted, setMutedState] = useState(isMuted());

  const ctx = wheelContext(data);
  const order = data.players.map((p) => p.id);
  const sortIds = (ids) => [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const weekN = (id) => data.weeks.find((w) => w.id === id)?.n ?? null;
  const activeIds = data.players.filter((p) => p.active).map((p) => p.id);
  // The latest spin for a week is the one that counts. Earlier ones were replaced by a re-spin.
  const latestOf = {};
  data.spins.forEach((s) => { latestOf[s.week_id] = s.id; });
  const replaced = (s) => latestOf[s.week_id] !== s.id;

  const target = ctx.target || null;
  const inWheel = ctx.mode === 'ready' ? [...new Set([...ctx.losers, ...ctx.noShows])] : [];
  const defaultPool = ctx.mode === 'ready' ? sortIds(inWheel.length ? inWheel : activeIds) : [];
  const pool = poolSel && poolSel.week === target?.id ? poolSel.ids : defaultPool;

  const confirmRespin = confirmFor != null && confirmFor === ctx.last?.week.id;
  const setConfirmRespin = (on) => setConfirmFor(on ? ctx.last?.week.id ?? null : null);

  async function play(spin, replay = false) {
    if (!wheelRef.current || animating.current) return;
    animating.current = true;
    if (!replay) seenSpins?.add(spin.id);
    const isLatest = spin.id === ctx.last?.spin.id;
    setFocus(null);
    setActive({ ...spin, weekN: weekN(spin.week_id), replay });
    setRevealed(null);
    await wheelRef.current.spinTo(spin.pool.map(pname), spin.pool.indexOf(spin.landed_id), spin.id);
    animating.current = false;
    setActive(null);
    setRevealed(spin.id);
    if (!replay || isLatest) markWatched?.(spin.id);
    if (!replay) reload();
    else if (!isLatest) setFocus(spin);
  }

  function replay(spin) {
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    play(spin, true);
  }

  // Someone spun (here or on another phone): play it once.
  useEffect(() => {
    if (!spinEvent || seenSpins?.has(spinEvent.id)) return undefined;
    const t = setTimeout(() => play(spinEvent), 0);
    return () => clearTimeout(t);
  }, [spinEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  async function removeSpin(s) {
    setConfirmDel(null);
    const { error } = await supabase.rpc('delete_spin', { p_spin: s.id });
    if (error) { toast(friendly(error)); return; }
    if (focus?.id === s.id) setFocus(null);
    toast('Deleted. The spin that counts is still there.');
    reload();
  }

  async function spin(weekId, ids) {
    setBusy(true);
    setConfirmRespin(false);
    const { data: row, error } = await supabase.rpc('spin_wheel', { p_week: weekId, p_pool: ids });
    setBusy(false);
    if (error) { toast(friendly(error)); return; }
    const s = Array.isArray(row) ? row[0] : row;
    if (!seenSpins?.has(s.id)) play(s);
  }

  // What the wheel shows right now.
  let names = [];
  let restAt = null;
  let restKey = null;
  if (active) {
    names = active.pool.map(pname);
  } else if (focus) {
    names = focus.pool.map(pname);
    restAt = focus.pool.indexOf(focus.landed_id);
    restKey = focus.id;
  } else if (ctx.mode === 'ready') {
    names = pool.map(pname);
  } else if (ctx.last) {
    names = ctx.last.spin.pool.map(pname);
    if (!ctx.last.spin.hidden) { // don't park the wheel on a result they haven't watched
      restAt = ctx.last.spin.pool.indexOf(ctx.last.spin.landed_id);
      restKey = ctx.last.spin.id;
    }
  } else {
    names = sortIds(activeIds).map(pname);
  }

  // Hide a live spin from the log while it animates so the log doesn't spoil it.
  const allSpins = [...data.spins].reverse().filter((s) => !active || active.replay || s.id !== active.id);
  const idle = !active && !focus;

  return (
    <>
      <section className="card wheel-card" ref={cardRef}>
        {ctx.mode === 'ready' && idle ? (
          <>
            <h2 className="sec-title">Week {target.n} wheel</h2>
            <p className="sub">
              {inWheel.length
                ? `${[
                    ctx.losers.length ? `${listNames(sortIds(ctx.losers).map(pname))} missed` : '',
                    ctx.noShows.length ? `${listNames(sortIds(ctx.noShows).map(pname))} didn’t put in a leg` : '',
                  ].filter(Boolean).join(', and ')}. Spin to see who puts in ${dollars(data.league.stake)} for Week ${ctx.nextN}.`
                : `Nobody missed in Week ${target.n}, so everyone goes in the wheel for Week ${ctx.nextN}.`}
            </p>
          </>
        ) : <h2 className="sec-title">The Bozo Wheel</h2>}

        <WheelCanvas ref={wheelRef} names={names} restAt={restAt} restKey={restKey} />

        {active && (
          <div className="result" role="status">
            <span className="label-sm">{active.weekN ? `Week ${active.weekN} wheel` : 'Wheel'} {active.replay ? 'replay' : 'is spinning'}</span>
            <strong className="result-name">{'…'}</strong>
          </div>
        )}

        {!active && focus && (
          <div className={`result${revealed === focus.id ? ' reveal' : ''}`} role="status">
            <span className="label-sm">Week {weekN(focus.week_id) ?? '?'} wheel landed on</span>
            <strong className={`result-name${replaced(focus) ? ' struck' : ''}`}>{pname(focus.landed_id)}</strong>
            <span className="result-sub">{replaced(focus) ? 'Re-spun, so this one doesn’t count' : `Out of ${focus.pool.length} · ${fmtWhen(focus.created_at)}`}</span>
            <div className="btns">
              <button className="link" onClick={() => play(focus, true)}>Watch it again</button>
              <button className="link" onClick={() => setFocus(null)}>Back to the current wheel</button>
            </div>
          </div>
        )}

        {idle && ctx.mode === 'waiting' && ctx.last?.spin.hidden && (
          <div className="result" role="status">
            <span className="label-sm">Week {ctx.last.week.n} wheel has been spun</span>
            <strong className="result-name is-hidden" aria-label="Hidden until you watch">???</strong>
            <span className="result-sub">You missed it. Watch to see who puts in {dollars(ctx.week.stake)} for Week {ctx.week.n}.</span>
            <button className="btn nose" onClick={() => play(ctx.last.spin, true)}>Watch the spin</button>
          </div>
        )}

        {idle && ctx.mode === 'waiting' && ctx.last && !ctx.last.spin.hidden && (
          <div className={`result${revealed === ctx.last.spin.id ? ' reveal' : ''}`} role="status">
            <span className="label-sm">Week {ctx.last.week.n} wheel landed on</span>
            <strong className="result-name">{pname(ctx.last.spin.landed_id)}</strong>
            <span className="result-sub">Puts in {dollars(ctx.week.stake)} for Week {ctx.week.n}</span>
            <button className="link" onClick={() => play(ctx.last.spin, true)}>Watch it again</button>
          </div>
        )}

        {idle && ctx.mode === 'ready' && (isAdmin ? (
          <div className="stack">
            <div className="field">
              <span className="lbl">In the wheel (tap to add or remove)</span>
              <div className="chips">
                {sortIds([...new Set([...activeIds, ...ctx.legs.map((l) => l.player_id)])]).map((id) => {
                  const on = pool.includes(id);
                  return (
                    <button key={id} type="button" className="chip" aria-pressed={on}
                      onClick={() => setPoolSel({ week: target.id, ids: sortIds(on ? pool.filter((x) => x !== id) : [...pool, id]) })}>{pname(id)}</button>
                  );
                })}
              </div>
            </div>
            <button className="btn nose spin-btn" disabled={!pool.length || busy} onClick={() => spin(target.id, pool)}>
              {busy ? 'Spinning…' : 'Spin the wheel'}
            </button>
          </div>
        ) : <p className="note">The commish spins the wheel. Keep this tab open to watch it live, or replay it after.</p>)}

        {idle && ctx.mode === 'waiting' && (
          ctx.last && isAdmin ? (confirmRespin ? (
            <div className="confirm-box">
              <p>Spin Week {ctx.last.week.n} again with the same names? The re-spin is logged for everyone to see.</p>
              <div className="btns">
                <button className="btn small nose" disabled={busy} onClick={() => spin(ctx.last.week.id, ctx.last.spin.pool)}>Spin again</button>
                <button className="btn small" onClick={() => setConfirmRespin(false)}>Never mind</button>
              </div>
            </div>
          ) : (
            <div className="wheel-foot">
              <span className="sub">Week {ctx.week.n}{'’'}s wheel opens once every leg is graded.</span>
              <button className="link" onClick={() => setConfirmRespin(true)}>Re-spin Week {ctx.last.week.n}</button>
            </div>
          )) : (
            <p className="sub">
              Week {ctx.week.n}{'’'}s wheel opens once every leg is graded.
              {ctx.legs.length > 0 && ctx.info.pending.length > 0 && ` ${ctx.info.pending.length} still pending.`}
            </p>
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
              const n = weekN(s.week_id);
              const idx = data.spins.filter((x) => x.week_id === s.week_id).findIndex((x) => x.id === s.id);
              const old = replaced(s);
              return (
                <li key={s.id} className={old ? 'is-replaced' : ''}>
                  <span className="log-wk">Wk {n ?? '?'}</span>
                  <span className="log-who">
                    {s.hidden ? <span className="is-hidden">???</span> : old ? <s>{pname(s.landed_id)}</s> : pname(s.landed_id)}{' '}
                    <small>{s.hidden ? 'tap ▶ to find out' : `out of ${s.pool.length}${old ? ' · replaced' : idx > 0 ? ' · re-spin' : ''}`}</small>
                  </span>
                  <time dateTime={s.created_at}>{fmtWhen(s.created_at)}</time>
                  <span className="log-acts">
                    {isAdmin && old && (
                      <button type="button" className="log-btn" onClick={() => setConfirmDel(confirmDel === s.id ? null : s.id)}
                        aria-label={`Delete the replaced Week ${n ?? ''} spin`} title="Delete">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
                      </button>
                    )}
                    <button type="button" className="log-btn log-play" disabled={!!active} onClick={() => replay(s)}
                      aria-label={`Watch the Week ${n ?? ''} spin again`} title="Watch again">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>
                    </button>
                  </span>
                  {confirmDel === s.id && (
                    <span className="log-confirm">Delete this replaced spin? It won{'’'}t change who{'’'}s on the hook.
                      <button type="button" className="link danger" onClick={() => removeSpin(s)}>Delete</button>
                      <button type="button" className="link" onClick={() => setConfirmDel(null)}>Keep</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="fine">Every spin is logged here. When a week is re-spun, only the latest counts; the replaced ones are crossed out{isAdmin ? ' and can be deleted' : ''}. Tap ▶ to watch one again.</p>
        </section>
      )}
    </>
  );
}

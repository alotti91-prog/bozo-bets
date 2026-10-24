import { useEffect, useRef, useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { wheelContext, isElimination } from '../lib/wheel.js';
import { dollars } from '../lib/odds.js';
import { toast, listNames, fmtWhen, isMuted, setMuted } from '../lib/ui.js';
import WheelCanvas from '../components/WheelCanvas.jsx';
import { IconSound } from '../components/common.jsx';
import WheelLog from './wheel/WheelLog.jsx';
import { useSpinPlayer } from './wheel/useSpinPlayer.js';
import Watching from './wheel/Watching.jsx';

/**
 * The database decides the result (spin_wheel): it knocks names out one at a
 * time until one is left, the bozo. This screen only plays it back, one spin per
 * knocked-out name. When anyone spins, every phone with this tab open plays the
 * same sequence, once. Any past spin can be replayed; it always plays the same.
 * Spins from before elimination replay as a single spin onto the bozo.
 */
export default function WheelTab({ data, me, here = [], isAdmin, reload, pname, spinEvent, seenSpins, markWatched, autoplay, onAutoplay, openRecap }) {
  const wheelRef = useRef(null);
  const cardRef = useRef(null);
  const [poolSel, setPoolSel] = useState(null); // { week, ids }: a hand-picked pool for one week
  const [confirmFor, setConfirmFor] = useState(null); // week id awaiting re-spin confirmation
  const [busy, setBusy] = useState(false);
  const [editNames, setEditNames] = useState(false); // admin: the name chips are showing
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

  const { active, revealed, focus, setFocus, play, skip } = useSpinPlayer({
    wheelRef, pname, weekN, latestId: ctx.last?.spin.id, seenSpins, markWatched, reload,
  });

  const confirmRespin = confirmFor != null && confirmFor === ctx.last?.week.id;
  const setConfirmRespin = (on) => setConfirmFor(on ? ctx.last?.week.id ?? null : null);

  function replay(spin) {
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    play(spin, true);
  }

  // Someone spun (here or on another phone): play it once.
  useEffect(() => {
    if (!spinEvent || seenSpins?.has(spinEvent.id)) return undefined;
    if (document.visibilityState !== 'visible') return undefined; // they'll get "Watch the spin" when they're back
    const t = setTimeout(() => play(spinEvent), 0);
    return () => clearTimeout(t);
  }, [spinEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sent here by "Watch" or "Watch spin": replay the spin you haven't seen.
  useEffect(() => {
    if (!autoplay) return undefined;
    const t = setTimeout(() => {
      onAutoplay?.();
      if (ctx.last?.spin.id === autoplay) play(ctx.last.spin, true);
    }, 0);
    return () => clearTimeout(t);
  }, [autoplay]); // eslint-disable-line react-hooks/exhaustive-deps

  async function removeSpin(s) {
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

  // At rest after a spin: an elimination spin leaves only the bozo on the wheel;
  // an old spin points at the bozo among everyone who was in it.
  const restOn = (s) => (isElimination(s)
    ? { names: [pname(s.landed_id)], restAt: 0 }
    : { names: s.pool.map(pname), restAt: s.pool.indexOf(s.landed_id) });
  const resultLabel = (s) => `Week ${weekN(s.week_id) ?? '?'} ${isElimination(s) ? 'bozo' : 'wheel landed on'}`;
  const outOf = (s) => `${isElimination(s) ? 'Last name left of' : 'Out of'} ${s.pool.length}`;
  const namesLeft = (n) => (n === 1 ? 'One name left…' : `${n} names left`);
  const safeOrder = (s) => isElimination(s) && <span className="fine">Safe, in order: {s.eliminated.map(pname).join(', ')}</span>;

  // What the wheel shows right now.
  let names = [];
  let restAt = null;
  let restKey = null;
  let struck = null;
  if (active) {
    names = active.names.map(pname);
    if (active.safe) struck = active.names.indexOf(active.safe);
  } else if (focus) {
    ({ names, restAt } = restOn(focus));
    restKey = focus.id;
  } else if (ctx.mode === 'ready') {
    names = pool.map(pname);
  } else if (ctx.last) {
    if (ctx.last.spin.hidden) { // don't leave the wheel showing a result they haven't watched
      names = ctx.last.spin.pool.map(pname);
      restAt = -1;
      restKey = 'hidden-' + ctx.last.spin.id;
    } else {
      ({ names, restAt } = restOn(ctx.last.spin));
      restKey = ctx.last.spin.id;
    }
  } else {
    names = sortIds(activeIds).map(pname);
  }

  // Hide a live spin from the log while it plays so the log doesn't spoil it.
  const logSpins = [...data.spins].reverse().filter((s) => !active || active.replay || s.id !== active.id);
  const idle = !active && !focus;

  const title = ctx.mode === 'ready' && idle ? `Week ${target.n} wheel` : 'The Bozo Wheel';
  let sub = '';
  if (ctx.mode === 'ready' && idle) {
    sub = pool.length > 1
      ? `Last name left puts in ${dollars(data.league.stake)} for Week ${ctx.nextN}.`
      : `Spin to see who puts in ${dollars(data.league.stake)} for Week ${ctx.nextN}.`;
  } else if (ctx.mode === 'waiting') {
    sub = `Week ${ctx.week.n}’s wheel opens once every leg is graded.${ctx.legs.length > 0 && ctx.info.pending.length > 0 ? ` ${ctx.info.pending.length} still pending.` : ''}`;
  } else if (ctx.mode === 'none') {
    sub = 'Start a week first. Anyone whose leg misses goes in the wheel.';
  }
  const whyIn = ctx.mode !== 'ready' ? '' : inWheel.length
    ? [
        ctx.losers.length ? `${listNames(sortIds(ctx.losers).map(pname))} missed.` : '',
        ctx.noShows.length ? `${listNames(sortIds(ctx.noShows).map(pname))} didn’t pick.` : '',
      ].filter(Boolean).join(' ')
    : `Nobody missed in Week ${target.n}, so everyone’s in.`;

  return (
    <>
      <div className="page-head with-action">
        <div>
          <h2 className="page-title">{title}</h2>
          {sub && <p className="page-sub">{sub}</p>}
        </div>
        <button type="button" className="icon-btn" aria-pressed={!muted} aria-label="Sound"
          onClick={() => { setMuted(!muted); setMutedState(!muted); }}><IconSound off={muted} /></button>
      </div>

      <Watching here={here} me={me} pname={pname} spinning={!!active && !active.replay} />

      <section className="card wheel-card" ref={cardRef} data-noswipe={active ? '' : undefined}>
        <WheelCanvas ref={wheelRef} names={names} restAt={restAt} restKey={restKey} struck={struck} />

        {active && (
          <div className="result" role="status">
            <span className="result-label">
              {active.weekN ? `Week ${active.weekN} wheel` : 'Wheel'} {active.replay ? 'replay' : 'is spinning'}
              {active.rounds > 1 && ` · spin ${active.round} of ${active.rounds}`}
            </span>
            {active.safe
              ? <strong className="result-name is-safe">{pname(active.safe)} is safe</strong>
              : <strong className="result-name">{'…'}</strong>}
            {isElimination(active) && <span className="result-sub">{namesLeft(active.names.length - (active.safe ? 1 : 0))}</span>}
            {active.gone.length > 0 && (
              <div className="chips safe-list" aria-label="Safe so far">
                {active.gone.map((id) => <span key={id} className="chip safe">{pname(id)}</span>)}
              </div>
            )}
            {isElimination(active) && <button type="button" className="text-btn" onClick={skip}>Skip to the bozo</button>}
          </div>
        )}

        {!active && focus && (
          <div className={`result${revealed === focus.id ? ' reveal' : ''}`} role="status">
            <span className="result-label">{resultLabel(focus)}</span>
            <strong className={`result-name${replaced(focus) ? ' struck' : ''}`}>{pname(focus.landed_id)}</strong>
            <span className="result-sub">{replaced(focus) ? 'Re-spun, so this one doesn’t count' : `${outOf(focus)} · ${fmtWhen(focus.created_at)}`}</span>
            {safeOrder(focus)}
            <div className="btns center">
              <button type="button" className="text-btn" onClick={() => play(focus, true)}>Watch it again</button>
              <button type="button" className="text-btn" onClick={() => setFocus(null)}>Back to the current wheel</button>
            </div>
          </div>
        )}

        {idle && ctx.mode === 'waiting' && ctx.last?.spin.hidden && (
          <div className="result" role="status">
            <span className="result-label">Week {ctx.last.week.n} wheel has been spun</span>
            <strong className="result-name is-hidden" aria-label="Hidden until you watch">???</strong>
            <span className="result-sub">You missed it. Watch to see who puts in {dollars(ctx.week.stake)} for Week {ctx.week.n}.</span>
            <button type="button" className="btn nose" onClick={() => play(ctx.last.spin, true)}>Watch the spin</button>
          </div>
        )}

        {idle && ctx.mode === 'waiting' && ctx.last && !ctx.last.spin.hidden && (
          <div className={`result${revealed === ctx.last.spin.id ? ' reveal' : ''}`} role="status">
            <span className="result-label">{resultLabel(ctx.last.spin)}</span>
            <strong className="result-name">{pname(ctx.last.spin.landed_id)}</strong>
            <span className="result-sub">{isElimination(ctx.last.spin) && `${outOf(ctx.last.spin)} · `}Puts in {dollars(ctx.week.stake)} for Week {ctx.week.n}</span>
            {safeOrder(ctx.last.spin)}
            <div className="btns center">
              <button type="button" className="text-btn" onClick={() => play(ctx.last.spin, true)}>Watch it again</button>
              {openRecap && <button type="button" className="text-btn" onClick={() => openRecap(ctx.last.week.id)}>See the recap</button>}
            </div>
          </div>
        )}

        {idle && ctx.mode === 'waiting' && ctx.last && isAdmin && (confirmRespin ? (
          <div className="confirm-box">
            <p>Spin Week {ctx.last.week.n} again with the same names? The re-spin is logged for everyone to see.</p>
            <div className="btns">
              <button type="button" className="btn small nose" disabled={busy} onClick={() => spin(ctx.last.week.id, ctx.last.spin.pool)}>Spin again</button>
              <button type="button" className="btn small" onClick={() => setConfirmRespin(false)}>Never mind</button>
            </div>
          </div>
        ) : (
          <button type="button" className="text-btn muted center" onClick={() => setConfirmRespin(true)}>Re-spin Week {ctx.last.week.n}</button>
        ))}

        {idle && ctx.mode === 'ready' && (isAdmin ? (
          <div className="pool">
            <p className="pool-why">{whyIn}{' '}
              <button type="button" className="text-btn" aria-expanded={editNames} onClick={() => setEditNames(!editNames)}>{editNames ? 'Done' : 'Edit names'}</button>
            </p>
            {editNames && (
              <div className="chips center" role="group" aria-label="In the wheel">
                {sortIds([...new Set([...activeIds, ...ctx.legs.map((l) => l.player_id)])]).map((id) => {
                  const on = pool.includes(id);
                  return (
                    <button key={id} type="button" className="chip" aria-pressed={on}
                      onClick={() => setPoolSel({ week: target.id, ids: sortIds(on ? pool.filter((x) => x !== id) : [...pool, id]) })}>{pname(id)}</button>
                  );
                })}
              </div>
            )}
          </div>
        ) : <p className="pool-why">{whyIn} The commish spins it. Keep this open to watch live, or replay it after.</p>)}
      </section>

      {idle && ctx.mode === 'ready' && isAdmin && (
        <button type="button" className="btn nose big" disabled={!pool.length || busy} onClick={() => spin(target.id, pool)}>
          {busy ? 'Spinning…' : 'Spin the wheel'}
        </button>
      )}

      <WheelLog spins={logSpins} allSpins={data.spins} isAdmin={isAdmin} pname={pname} weekN={weekN} replaced={replaced}
        busy={!!active} onReplay={replay} onDelete={removeSpin} />
    </>
  );
}

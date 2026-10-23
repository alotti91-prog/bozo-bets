import { useEffect, useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { weekInfo, amerFmt, fmtOdds, money, dollars } from '../lib/odds.js';
import { toast, shareText, fmtDate, listNames } from '../lib/ui.js';
import { lockState, updatedAgo } from '../lib/deadline.js';
import { IconShare } from '../components/common.jsx';
import { slipPaths } from '../lib/slip.js';
import { liveStatus, aliveCount, gameKey, legState } from '../lib/bets.js';
import { useLiveGames } from '../lib/useLiveGames.js';
import PlacedSheet from './PlacedSheet.jsx';
import LegRow from './week/LegRow.jsx';
import LegForm from './week/LegForm.jsx';
import PayoutForm from './week/PayoutForm.jsx';

// The This week tab: header, the parlay slip, actions, who's missing, and the add-a-leg form.
// Each leg on the slip is ./week/LegRow.jsx; the forms are in ./week/ too.
export default function WeekTab({ data, me, isAdmin, reload, pname, userId, beltId, nameOfUser, openSettings, openWheel }) {
  const week = data.weeks[data.weeks.length - 1];
  const [confirmRm, setConfirmRm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [slipOpen, setSlipOpen] = useState(false);
  const [menuFor, setMenuFor] = useState(null); // leg whose ⋯ menu is open
  const [gradeFor, setGradeFor] = useState(null); // leg whose W/L/P an admin opened early
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000); // keeps the countdown and "updated" label fresh
    return () => clearInterval(t);
  }, []);
  const [games, updatedAt] = useLiveGames(week ? data.legs.filter((l) => l.week_id === week.id) : []);

  if (!week) {
    return (
      <section className="card empty">
        <h2 className="sec-title">No week open</h2>
        <p className="sub">{isAdmin ? 'Open Week 1 from Settings.' : 'The commish hasn’t opened a week yet.'}</p>
      </section>
    );
  }

  const order = Object.fromEntries(data.players.map((p, i) => [p.id, i]));
  const legs = data.legs.filter((l) => l.week_id === week.id).sort((a, b) => (order[a.player_id] ?? 99) - (order[b.player_id] ?? 99));
  const info = weekInfo(week, legs);
  const active = data.players.filter((p) => p.active);
  const missing = active.filter((p) => !legs.some((l) => l.player_id === p.id));
  const statusOf = (l) => (l.bet?.game ? liveStatus(l.bet, games[gameKey(l.bet)]) : null);
  const alive = aliveCount(legs, statusOf);
  const showAlive = info.status === 'live' && legs.some((l) => l.result || (statusOf(l) && statusOf(l).tone !== 'pre'));
  const states = legs.map((l) => legState(l, statusOf(l)));
  const showStrip = legs.some((l) => l.bet?.game || l.result);
  const anyLive = legs.some((l) => statusOf(l)?.tone && statusOf(l).tone !== 'pre' && !statusOf(l).done);
  const stripLabel = ['win', 'loss', 'live', 'push', 'pre'].map((k) => [k, states.filter((x) => x === k).length]).filter(([, n]) => n)
    .map(([k, n]) => `${n} ${{ win: 'winning or won', loss: 'losing or lost', live: 'in progress', push: 'push', pre: 'waiting' }[k]}`).join(', ');

  async function act(promise, okMsg) {
    const { error } = await promise;
    if (error) { toast(friendly(error)); return false; }
    if (okMsg) toast(okMsg);
    reload();
    return true;
  }

  const grade = (l, r) => act(supabase.from('legs').update({ result: l.result === r ? null : r }).eq('id', l.id));
  const remove = (l) => { setConfirmRm(null); return act(supabase.from('legs').delete().eq('id', l.id), 'Leg removed.'); };
  const setPayer = (pid) => act(supabase.from('weeks').update({ payer_id: pid || null }).eq('id', week.id));

  function slipText() {
    const lines = [`${data.league.name.toUpperCase()} · Week ${week.n} (${fmtDate(week.start_date)})`];
    legs.forEach((l) => {
      const mark = l.result === 'W' ? '✅ ' : l.result === 'L' ? '❌ ' : l.result === 'P' ? '➖ ' : '';
      lines.push(`${mark}${pname(l.player_id)}: ${l.pick} (${fmtOdds(l.odds, true)})`);
    });
    if (legs.length) lines.push('', `${legs.length} legs · ${amerFmt(info.d, true)} · ${money(info.stake)} pays ${money(info.projected)}`);
    if (week.payer_id) lines.push(`On the hook: ${pname(week.payer_id)}${week.placed_at ? ' · Placed ✅' : ''}`);
    if (lock) lines.push(locked ? `Picks locked ${lock.label}` : `⏰ Picks lock ${lock.label} (${lock.countdown} left)`);
    if (missing.length) lines.push(`Waiting on: ${missing.map((p) => p.name).join(', ')}`);
    return lines.join('\n');
  }

  const stamp = { live: 'Live', hit: 'Hit', busted: 'Busted' }[info.status];
  const ways = new Set(legs.map((l) => l.player_id)).size;
  const sunk = [...new Set(info.losers.map((l) => l.player_id))].sort((a, b) => order[a] - order[b]).map(pname);
  const placed = !!week.placed_at;
  const shots = slipPaths(week).length;
  const lock = lockState(week.lock_at);
  const locked = !!lock?.locked;
  const canMark = isAdmin || (!!me && week.payer_id === me);

  return (
    <>
      <div className="week-head">
        <div>
          <h2 className="week-title">Week {week.n}</h2>
          <p className="sub">Started {fmtDate(week.start_date)}</p>
          {lock ? (
            <p className={`lock-line${locked ? ' is-locked' : lock.soon ? ' is-soon' : ''}`}>
              {locked ? `Picks locked ${lock.label}` : `Picks lock ${lock.label} · ${lock.countdown} left`}
            </p>
          ) : isAdmin && openSettings ? (
            <button type="button" className="link" style={{ padding: 0 }} onClick={openSettings}>Set a pick deadline</button>
          ) : null}
        </div>
        <div className="payer">
          <span className="dot" aria-hidden="true" />
          {week.payer_hidden ? (
            <span>On the hook:{' '}
              <button type="button" className="link hook-hidden" onClick={openWheel}>Watch the spin to find out</button>
              {' '}{'·'} {dollars(info.stake)}
            </span>
          ) : isAdmin ? (
            <>
              <label htmlFor="payer">On the hook</label>
              <select id="payer" value={week.payer_id || ''} onChange={(e) => setPayer(e.target.value)}>
                <option value="">Choose{'…'}</option>
                {active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span>{'·'} {dollars(info.stake)}</span>
            </>
          ) : week.payer_id ? (
            <span>On the hook: <strong>{pname(week.payer_id)}</strong> {'·'} {dollars(info.stake)}</span>
          ) : (
            <span className="sub">Payer not set yet</span>
          )}
        </div>
      </div>

      <section className="ticket" aria-label={`Week ${week.n} parlay`}>
        <div className="t-head">
          <span className="t-kicker">Parlay slip</span>
          <span className="t-meta">Week {week.n} {'·'} {legs.length} leg{legs.length === 1 ? '' : 's'} {'·'} {fmtDate(week.start_date)}</span>
          {showStrip && (
            <div className="t-strip">
              <span className="t-dots" role="img" aria-label={stripLabel}>
                {legs.map((l, i) => <span key={l.id} className={`t-dot is-${states[i]}`} title={`${pname(l.player_id)}: ${l.pick}`} />)}
              </span>
              {showAlive && <span className={`t-alive${alive.alive < alive.total ? ' is-down' : ''}`}>{alive.alive} of {alive.total} alive</span>}
            </div>
          )}
          {anyLive && updatedAt && <span className="t-updated">Scores updated {updatedAgo(now - updatedAt)}</span>}
          {placed ? (
            <button type="button" className="placed yes" onClick={() => setSlipOpen(true)}>Placed ✓{shots ? ` · ${shots === 1 ? 'View slip' : `View slip (${shots})`}` : ''}</button>
          ) : legs.length > 0 ? <span className="placed">Not placed yet</span> : null}
        </div>
        {stamp && <div className={`stamp stamp-${info.status}`}>{stamp}</div>}
        <ol className="legs">
          {legs.length === 0 && <li className="leg-empty">No legs yet. First one in sets the tone.</li>}
          {legs.map((l) => (
            <LegRow key={l.id} leg={l} st={statusOf(l)} me={me} isAdmin={isAdmin} locked={locked} beltId={beltId} pname={pname}
              menuOpen={menuFor === l.id} onMenu={(open) => setMenuFor(open ? l.id : null)}
              confirming={confirmRm === l.id} onConfirm={(open) => setConfirmRm(open ? l.id : null)}
              gradeNow={gradeFor === l.id} onGradeNow={() => setGradeFor(l.id)}
              onGrade={(r) => grade(l, r)} onRemove={() => remove(l)} onEdit={() => setEditing(l)}
              data={data} userId={userId} nameOfUser={nameOfUser} reload={reload} />
          ))}
        </ol>
        {legs.length > 0 && (
          <div className="t-foot">
            <div className="t-row"><span>Total odds</span><b>{amerFmt(info.d)}</b></div>
            <div className="t-row"><span>Stake</span><b>{money(info.stake)}</b></div>
            {info.status === 'hit' && (
              <>
                <div className="t-row t-big"><span>Paid out</span><b>{money(info.payout)}</b></div>
                <p className="t-note win">Cash it. {money(info.payout / ways)} each, split {ways} ways.</p>
              </>
            )}
            {info.status === 'busted' && (
              <>
                <div className="t-row t-big"><span>Would have paid</span><b>{money(info.projected)}</b></div>
                <p className="t-note loss">Sunk by {listNames(sunk)}.{info.pending.length ? ` ${info.pending.length} leg${info.pending.length > 1 ? 's' : ''} still to grade.` : ''}</p>
              </>
            )}
            {info.status === 'live' && <div className="t-row t-big"><span>Pays</span><b>{money(info.projected)}</b></div>}
          </div>
        )}
      </section>

      <div className="actions-row">
        <button className="btn" onClick={() => shareText(slipText(), { title: `Week ${week.n} slip` })}><IconShare />Share the slip</button>
        {canMark && !placed && legs.length > 0 && (
          <button className="btn primary" onClick={() => setSlipOpen(true)}>Add slip screenshots</button>
        )}
        {canMark && placed && (
          <button className="btn" onClick={() => setSlipOpen(true)}>Slip screenshots{shots ? ` (${shots})` : ''}</button>
        )}
      </div>
      {slipOpen && <PlacedSheet data={data} week={week} canMark={canMark} reload={reload} nameOfUser={nameOfUser} onClose={() => setSlipOpen(false)} />}

      {info.status === 'hit' && isAdmin && <PayoutForm week={week} projected={info.projected} act={act} />}

      {missing.length > 0 ? (
        <div className="waiting">
          <span className="label-sm">{locked ? 'Missed the deadline' : 'Still waiting on'}</span>
          <div className="chips">{missing.map((p) => <span key={p.id} className={`chip${locked ? ' late' : ''}`}>{p.name}</span>)}</div>
          {locked && <p className="hint">They go in the wheel with anyone who misses.</p>}
        </div>
      ) : legs.length > 0 ? <p className="allin">Everyone{'’'}s in. Time to place it.</p> : null}

      <LegForm
        key={editing ? editing.id : 'new'}
        week={week}
        editing={editing}
        options={editing ? [] : (isAdmin ? missing : missing.filter((p) => p.id === me))}
        me={me}
        isAdmin={isAdmin}
        locked={locked}
        pname={pname}
        onDone={() => { setEditing(null); reload(); }}
        onCancel={() => setEditing(null)}
      />
    </>
  );
}

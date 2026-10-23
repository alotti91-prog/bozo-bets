import { useEffect, useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { weekInfo, amerFmt, fmtOdds, money, dollars } from '../lib/odds.js';
import { toast, shareText, fmtDate, listNames, initials } from '../lib/ui.js';
import { lockState, updatedAgo } from '../lib/deadline.js';
import { siteUrl } from '../lib/site.js';
import { Sheet, IconShare, IconPhoto, IconPlus, IconClock, IconLock, IconBoard } from '../components/common.jsx';
import { slipPaths } from '../lib/slip.js';
import { liveStatus, aliveCount, gameKey, gradeMargin, finishedGrades } from '../lib/bets.js';
import { useLiveGames } from '../lib/useLiveGames.js';
import PlacedSheet from './PlacedSheet.jsx';
import LegRow from './week/LegRow.jsx';
import LegSheet from './week/LegSheet.jsx';
import LegForm from './week/LegForm.jsx';
import PayoutForm from './week/PayoutForm.jsx';
import LinesSheet from './week/LinesSheet.jsx';

const FINAL = { W: 'won', L: 'lost', P: 'pushed' };

// The This week tab: the week and its deadline, a summary row, the slip (legs,
// who's still missing, the total), and the actions. Tapping a leg opens its
// panel (week/LegSheet); adding or editing a leg opens a sheet with week/LegForm.
export default function WeekTab({ data, me, isAdmin, reload, pname, userId, beltId, nameOfUser, openSettings, watchSpin }) {
  const week = data.weeks[data.weeks.length - 1];
  const [form, setForm] = useState(null); // null, 'new', or the leg being edited
  const [openId, setOpenId] = useState(null); // leg whose panel is open
  const [slipOpen, setSlipOpen] = useState(false);
  const [linesOpen, setLinesOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000); // keeps the countdown and "updated" label fresh
    return () => clearInterval(t);
  }, []);
  const [games, updatedAt] = useLiveGames(week ? data.legs.filter((l) => l.week_id === week.id) : []);

  if (!week) {
    return (
      <section className="card empty">
        <h2 className="page-title">No week open</h2>
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
  const anyLive = legs.some((l) => statusOf(l)?.tone && statusOf(l).tone !== 'pre' && !statusOf(l).done);
  const ways = new Set(legs.map((l) => l.player_id)).size;
  const sunk = [...new Set(info.losers.map((l) => l.player_id))].sort((a, b) => order[a] - order[b]).map(pname);
  const placed = !!week.placed_at;
  const shots = slipPaths(week).length;
  const lock = lockState(week.lock_at);
  const locked = !!lock?.locked;
  const canMark = isAdmin || (!!me && week.payer_id === me);
  const canAdd = isAdmin ? missing.length > 0 : !!me && !locked && missing.some((p) => p.id === me);
  const addLabel = !isAdmin || (missing.length === 1 && missing[0].id === me) ? 'Add your leg' : 'Add a leg';
  const openLeg = legs.find((l) => l.id === openId) || null;
  const finished = isAdmin ? finishedGrades(legs, statusOf) : []; // games that are over but not graded yet

  async function act(promise, okMsg) {
    const { error } = await promise;
    if (error) { toast(friendly(error)); return false; }
    if (okMsg) toast(okMsg);
    reload();
    return true;
  }
  const grade = (l, r) => {
    const result = l.result === r ? null : r;
    const patch = { result };
    // Save how far it missed with the grade, so the recap can tell a close call
    // from a blowout. Skipped until the database has the column (schema.sql).
    if ('margin' in l) patch.margin = gradeMargin(statusOf(l), result);
    return act(supabase.from('legs').update(patch).eq('id', l.id));
  };
  const remove = (l) => act(supabase.from('legs').delete().eq('id', l.id), 'Leg removed.');
  const setPayer = (pid) => act(supabase.from('weeks').update({ payer_id: pid || null }).eq('id', week.id));

  // The commish grades every finished game in one tap, saving how far each one finished.
  async function gradeFinished() {
    const done = await Promise.all(finished.map(({ leg, result, margin }) =>
      supabase.from('legs').update('margin' in leg ? { result, margin } : { result }).eq('id', leg.id)));
    const bad = done.find((r) => r.error);
    toast(bad ? friendly(bad.error) : `Graded ${finished.length} leg${finished.length === 1 ? '' : 's'}.`);
    reload();
  }

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

  function remind() {
    const names = listNames(missing.map((p) => p.name));
    shareText(`Still need a leg for Week ${week.n} from ${names}.${lock && !locked ? ` Picks lock ${lock.label}.` : ''}\n${siteUrl()}${window.location.pathname}`,
      { title: 'Bozo Bets', successMsg: 'Copied. Paste it in the group chat.' });
  }

  // The summary row: who's on the hook, then two numbers that depend on how the week is going.
  const hook = week.payer_hidden ? (
    <button type="button" className="text-btn nose hook-hidden" onClick={watchSpin}>Watch spin</button>
  ) : isAdmin ? (
    <select className="glance-select" aria-label="On the hook" value={week.payer_id || ''} onChange={(e) => setPayer(e.target.value)}>
      <option value="">Choose{'…'}</option>
      {active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  ) : week.payer_id ? pname(week.payer_id) : <span className="muted">Not set</span>;
  const cells = [['On the hook', hook]];
  if (!legs.length) cells.push(['Legs', '0'], ['Stake', dollars(info.stake)]);
  else if (info.status === 'hit') cells.push(['Paid', <span className="pos" key="p">{dollars(info.payout)}</span>], ['Each', dollars(info.payout / ways)]);
  else if (info.status === 'busted') cells.push(['Sunk by', <span className="neg" key="s">{listNames(sunk)}</span>], ['Missed out', dollars(info.projected)]);
  else cells.push(showAlive ? ['Still alive', `${alive.alive} of ${alive.total}`] : ['Legs', String(legs.length)], ['Pays', dollars(info.projected)]);

  return (
    <>
      <div className="page-head">
        <h2 className="page-title">Week {week.n}</h2>
        {lock ? (
          <p className={`page-sub lock-line${locked ? ' is-locked' : lock.soon ? ' is-soon' : ''}`}>
            {locked ? <IconLock /> : <IconClock />}
            {locked ? `Picks locked ${lock.label}` : `Picks lock ${lock.label} · ${lock.countdown} left`}
          </p>
        ) : isAdmin && openSettings ? (
          <button type="button" className="text-btn" onClick={openSettings}>Set a pick deadline</button>
        ) : <p className="page-sub">Started {fmtDate(week.start_date)}</p>}
      </div>

      <div className="glance three">
        {cells.map(([label, value]) => (
          <div key={label} className="glance-cell">
            <span className="glance-label">{label}</span>
            <span className="glance-value">{value}</span>
          </div>
        ))}
      </div>

      <section className="slip" aria-label={`Week ${week.n} parlay`}>
        <div className="slip-head">
          <div>
            <h3 className="slip-title">The slip</h3>
            <p className="slip-meta">
              {legs.length ? (placed ? 'Bet placed ✓' : 'Not placed yet') : 'No legs yet. First one in sets the tone.'}
              {anyLive && updatedAt ? ` · Updated ${updatedAgo(now - updatedAt)}` : ''}
            </p>
          </div>
          {legs.length > 0 && (
            <span className={`status-pill is-${info.status === 'live' && !anyLive ? 'open' : info.status}`}>
              {info.status === 'hit' ? 'Hit' : info.status === 'busted' ? 'Busted' : anyLive ? 'Live' : 'Open'}
            </span>
          )}
        </div>

        {legs.length > 0 && (
          <ol className="legs">
            {legs.map((l) => (
              <LegRow key={l.id} leg={l} st={statusOf(l)} me={me} isAdmin={isAdmin} beltId={beltId} pname={pname}
                reactions={data.reactions || []} comments={data.comments || []}
                onOpen={() => setOpenId(l.id)} onGrade={(r) => grade(l, r)} />
            ))}
          </ol>
        )}

        {finished.length > 1 && ( /* one finished game has its own "Final · Mark W" button on its row */
          <div className="slip-waiting is-final">
            <span className="sw-text">
              <b>{finished.length} games are final</b>
              <span>{finished.map(({ leg, result }) => `${pname(leg.player_id)} ${FINAL[result]}`).join(', ')}</span>
            </span>
            <button type="button" className="text-btn nose" onClick={gradeFinished}>Grade all</button>
          </div>
        )}

        {missing.length > 0 ? (
          <div className={`slip-waiting${locked ? ' is-late' : ''}`}>
            <span className="avatars" aria-hidden="true">
              {missing.slice(0, missing.length > 4 ? 3 : 4).map((p) => <span key={p.id} className="av">{initials(p.name)}</span>)}
              {missing.length > 4 && <span className="av">+{missing.length - 3}</span>}
            </span>
            <span className="sw-text">
              <b>{locked ? `Missed the deadline: ${missing.length}` : `Waiting on ${missing.length}`}</b>
              <span>{missing.map((p) => p.name).join(', ')}{locked ? '. They go in the wheel.' : ''}</span>
            </span>
            {!locked && <button type="button" className="text-btn nose" onClick={remind}>Remind</button>}
          </div>
        ) : legs.length > 0 ? (
          <div className="slip-waiting is-done"><span className="sw-text"><b>Everyone{'’'}s in.</b><span>Time to place it.</span></span></div>
        ) : null}

        {legs.length > 0 && (
          <div className="slip-foot">
            <span>{legs.length} leg{legs.length === 1 ? '' : 's'} · <b>{amerFmt(info.d)}</b></span>
            {info.status === 'hit' ? (
              <span>Paid <b>{money(info.payout)}</b></span>
            ) : info.status === 'busted' ? (
              <span>{info.pending.length ? `${info.pending.length} still to grade` : 'Busted'}</span>
            ) : (
              <span>{dollars(info.stake)} pays <b>{money(info.projected)}</b></span>
            )}
          </div>
        )}
      </section>

      {canAdd ? (
        <button type="button" className="btn primary big" onClick={() => setForm('new')}><IconPlus />{addLabel}</button>
      ) : !isAdmin && !me ? (
        <p className="note">Pick your name in Settings to add your own leg. <button type="button" className="text-btn" onClick={openSettings}>Open Settings</button></p>
      ) : !isAdmin && locked && missing.some((p) => p.id === me) ? (
        <p className="note">Picks are locked for this week. Ask the commish if you need a change.</p>
      ) : null}

      <div className="btn-pair">
        <button type="button" className="btn" onClick={() => shareText(slipText(), { title: `Week ${week.n} slip` })}><IconShare />Share slip</button>
        {legs.length > 0 && (canMark || placed) && (
          <button type="button" className="btn" onClick={() => setSlipOpen(true)}><IconPhoto />{placed ? `Slip photos${shots ? ` · ${shots}` : ''}` : 'Add slip photos'}</button>
        )}
      </div>

      <button type="button" className="text-btn muted center with-icon" onClick={() => setLinesOpen(true)}><IconBoard />This week{'’'}s lines</button>

      {info.status === 'hit' && isAdmin && <PayoutForm week={week} projected={info.projected} act={act} />}

      {openLeg && (
        <LegSheet key={openLeg.id} leg={openLeg} st={statusOf(openLeg)} data={data} me={me} isAdmin={isAdmin} locked={locked} pname={pname}
          userId={userId} nameOfUser={nameOfUser} reload={reload}
          onGrade={(r) => grade(openLeg, r)}
          onMiss={(patch) => act(supabase.from('legs').update(patch).eq('id', openLeg.id))}
          onEdit={() => { setOpenId(null); setForm(openLeg); }}
          onRemove={() => { setOpenId(null); remove(openLeg); }}
          onClose={() => setOpenId(null)} />
      )}
      {form && (
        <Sheet title={form === 'new' ? addLabel : `Edit ${pname(form.player_id)}’s leg`} onClose={() => setForm(null)}>
          <LegForm key={form === 'new' ? 'new' : form.id} week={week} editing={form === 'new' ? null : form}
            options={form === 'new' ? (isAdmin ? missing : missing.filter((p) => p.id === me)) : []}
            me={me} isAdmin={isAdmin} locked={locked} pname={pname}
            onDone={() => { setForm(null); reload(); }} onCancel={() => setForm(null)} />
        </Sheet>
      )}
      {linesOpen && (
        <LinesSheet onClose={() => setLinesOpen(false)} addLabel={addLabel}
          onAdd={canAdd ? () => { setLinesOpen(false); setForm('new'); } : null} />
      )}
      {slipOpen && <PlacedSheet data={data} week={week} canMark={canMark} reload={reload} nameOfUser={nameOfUser} onClose={() => setSlipOpen(false)} />}
    </>
  );
}

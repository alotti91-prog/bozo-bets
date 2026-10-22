import { useEffect, useRef, useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { weekInfo, amerFmt, fmtOdds, money, dollars, parseOdds } from '../lib/odds.js';
import { toast, shareText, fmtDate, listNames, store } from '../lib/ui.js';
import { lockState } from '../lib/deadline.js';
import { IconShare, Belt } from '../components/common.jsx';
import { LegTalk } from '../components/Comments.jsx';
import PlacedSheet from './PlacedSheet.jsx';
import { slipPaths } from '../lib/slip.js';
import { SPORTS as LIVE_SPORTS } from '../lib/espn.js';
import { liveStatus, aliveCount, gameKey, pickText, betProblem, emptyPick, pickFromBet, betFromPick, legState, suggestedGrade, gradeHidden } from '../lib/bets.js';
import { updatedAgo } from '../lib/deadline.js';
import { useLiveGames } from '../lib/useLiveGames.js';
import BetPicker from '../components/BetPicker.jsx';

const SPORTS = ['NFL', 'NCAAF', 'NBA', 'NHL', 'MLB', 'Soccer', 'Other'];
const HINT = 'American odds, as the book shows them. Tap the sign to switch between minus and plus.';

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
          {legs.map((l) => {
            const mine = me && l.player_id === me;
            const canEdit = isAdmin || (mine && !l.result && !locked);
            const st = statusOf(l);
            const hideGrade = gradeHidden(l, st) && gradeFor !== l.id;
            const suggest = isAdmin && !l.result ? suggestedGrade(st) : null;
            const word = { W: 'Won', L: 'Lost', P: 'Push' };
            const showPill = !isAdmin && (l.result || !l.bet?.game);
            // Nothing to act on (a live picked leg): put the sport tag and ⋯ at the end of the reactions row.
            const compact = !suggest && !(isAdmin && !hideGrade) && !showPill && l.result !== 'L' && confirmRm !== l.id && menuFor !== l.id;
            const moreBtn = canEdit && <button type="button" className="more-btn" aria-label={`More for ${pname(l.player_id)}’s leg`} onClick={() => setMenuFor(l.id)}>{'⋯'}</button>;
            return (
              <li key={l.id} className={`leg${l.result ? ' is-' + l.result : ''}`}>
                <span className="leg-who">{pname(l.player_id)}<Belt on={beltId === l.player_id} />{mine && <span className="you"> {'·'} you</span>}</span>
                <span className="leg-odds">{fmtOdds(l.odds)}</span>
                <span className="leg-pick">{l.pick}</span>
                {l.bet?.game && <LiveLine bet={l.bet} s={st} />}
                {!compact && <div className="leg-meta">
                  <span className="tag">{l.sport}</span>
                  {suggest && (
                    <button type="button" className="mark-btn" onClick={() => grade(l, suggest)} aria-label={`Final. Mark ${pname(l.player_id)}’s leg ${word[suggest]}`}>
                      Mark {suggest}
                    </button>
                  )}
                  {isAdmin ? (!hideGrade && (
                    <div className="grade" role="group" aria-label={`Result for ${pname(l.player_id)}`}>
                      {['W', 'L', 'P'].map((r) => (
                        <button key={r} type="button" className={`g-${r}`} aria-pressed={l.result === r} aria-label={word[r]} onClick={() => grade(l, r)}>{r}</button>
                      ))}
                    </div>
                  )) : showPill && (
                    <span className={`res res-${l.result || 'none'}`}>{word[l.result] || 'Pending'}</span>
                  )}
                  {canEdit && (confirmRm === l.id ? (
                    <span className="confirm">Remove this leg?
                      <button className="link danger" onClick={() => remove(l)}>Remove</button>
                      <button className="link" onClick={() => setConfirmRm(null)}>Keep</button>
                    </span>
                  ) : menuFor === l.id ? (
                    <span className="leg-menu">
                      <button className="link" onClick={() => { setMenuFor(null); setEditing(l); }}>Edit</button>
                      <button className="link" onClick={() => { setMenuFor(null); setConfirmRm(l.id); }}>Remove</button>
                      {isAdmin && hideGrade && <button className="link" onClick={() => { setMenuFor(null); setGradeFor(l.id); }}>Grade now</button>}
                      <button className="link" onClick={() => setMenuFor(null)} aria-label="Close menu">Done</button>
                    </span>
                  ) : moreBtn)}
                  {l.result === 'L' && <span className="bozo-mark">Bozo</span>}
                </div>}
                <LegTalk leg={l} data={data} userId={userId} isAdmin={isAdmin} nameOfUser={nameOfUser} reload={reload} who={pname(l.player_id)}
                  trailing={compact ? <><span className="tag">{l.sport}</span>{moreBtn}</> : null} />
              </li>
            );
          })}
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

function PayoutForm({ week, projected, act }) {
  const [v, setV] = useState(week.actual_payout == null ? '' : Number(week.actual_payout).toFixed(2));
  async function save(e) {
    e.preventDefault();
    const s = v.replace(/[$,\s]/g, '');
    if (s === '') { act(supabase.from('weeks').update({ actual_payout: null }).eq('id', week.id), 'Using the calculated payout.'); return; }
    const n = parseFloat(s);
    if (!(n >= 0)) { toast('Enter the payout as a dollar amount, like 254.10.'); return; }
    act(supabase.from('weeks').update({ actual_payout: Math.round(n * 100) / 100 }).eq('id', week.id), 'Payout saved.');
  }
  return (
    <form className="card stack" onSubmit={save}>
      <div className="field">
        <label htmlFor="ov">Actual payout, if the book paid a different amount</label>
        <div className="ov-row">
          <input id="ov" inputMode="decimal" autoComplete="off" placeholder={projected.toFixed(2)} value={v} onChange={(e) => setV(e.target.value)} />
          <button className="btn small" type="submit">Save payout</button>
        </div>
      </div>
      <p className="hint">Leave blank to use the calculated payout. Odds sometimes move before the bet is placed.</p>
    </form>
  );
}

// Live state under a picked leg: "Covering · DET 24, GB 17 · Q3 6:12" (your team in bold), with a bar for overs.
function LiveLine({ bet, s }) {
  const when = bet.game.start ? new Date(bet.game.start).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  if (!s || s.tone === 'pre') return <span className="leg-live tone-pre"><span className="ll-row"><span>{bet.game.short}</span>{when && <span>{when}</span>}</span></span>;
  const team = (t) => <span className={t.mine ? 'll-mine' : undefined}>{t.abbr} {t.score}</span>;
  return (
    <span className={`leg-live tone-${s.tone}`}>
      <span className="ll-row">
        <strong>{s.label}</strong>
        <span>{team(s.away)}, {team(s.home)}</span>
        <span>{s.clock}</span>
      </span>
      {s.progress != null && !s.done && <span className="leg-bar" aria-hidden="true"><span style={{ width: `${Math.round(s.progress * 100)}%` }} /></span>}
    </span>
  );
}

function LegForm({ week, editing, options, me, isAdmin, locked, pname, onDone, onCancel }) {
  const draftKey = 'bz-draft-' + week.id;
  const draft = editing ? null : store.get(draftKey, null);
  const [player, setPlayer] = useState(editing ? editing.player_id : (draft && options.some((p) => p.id === draft.player) ? draft.player : options[0]?.id || ''));
  const [pick, setPick] = useState(editing ? editing.pick : draft?.pick || '');
  const [sign, setSign] = useState(editing ? (editing.odds > 0 ? '+' : '-') : draft?.sign || '-');
  const [odds, setOdds] = useState(editing ? String(Math.abs(editing.odds)) : draft?.odds || '');
  const [sport, setSport] = useState(editing ? editing.sport : draft?.sport || 'NFL');
  // 'pick' = choose the game and bet (tracks live); 'type' = free text, for anything else.
  const [mode, setMode] = useState(editing ? (editing.bet ? 'pick' : 'type') : draft?.mode || 'pick');
  const [b, setB] = useState(editing?.bet ? pickFromBet(editing.bet) : draft?.b || emptyPick());
  const [hint, setHint] = useState({ text: HINT, err: false });
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  useEffect(() => {
    if (editing && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      formRef.current.querySelector('#f-pick')?.focus({ preventScroll: true });
    }
  }, [editing]);

  if (locked && !isAdmin) {
    return options.length ? <p className="note">Picks are locked for this week. Ask the commish if you need a change.</p> : null;
  }
  if (!editing && !options.length) {
    if (!isAdmin && !me) return <p className="note">Pick your name in Settings to add your own leg.</p>;
    return null;
  }

  const saveDraft = (patch) => { if (!editing) store.set(draftKey, { player, pick, sign, odds, sport, mode, b, ...patch }); };
  const toType = () => {
    const bet = betFromPick(b);
    if (!pick.trim() && !betProblem(bet)) setPick(pickText(bet));
    if (LIVE_SPORTS[b.sport]) setSport(LIVE_SPORTS[b.sport].label);
    setMode('type'); saveDraft({ mode: 'type' });
  };

  async function submit(e) {
    e.preventDefault();
    if (!player) { setHint({ text: 'Choose whose leg this is.', err: true }); return; }
    let row;
    if (mode === 'pick') {
      const bet = betFromPick(b);
      const problem = betProblem(bet);
      if (problem) { setHint({ text: problem, err: true }); return; }
      row = { pick: pickText(bet), sport: LIVE_SPORTS[b.sport].label, bet };
    } else {
      if (!pick.trim()) { setHint({ text: 'Type the pick, like “Bills -3.5”.', err: true }); return; }
      row = { pick: pick.trim().slice(0, 80), sport };
      if (editing?.bet) row.bet = null; // was picked from a game; now typed
    }
    const parsed = parseOdds(odds, sign);
    if (parsed.error) { setHint({ text: parsed.error, err: true }); return; }
    setBusy(true);
    row.odds = parsed.odds;
    const save = (r) => (editing
      ? supabase.from('legs').update(r).eq('id', editing.id)
      : supabase.from('legs').insert({ ...r, week_id: week.id, league_id: week.league_id, player_id: player }));
    let { error } = await save(row);
    let untracked = false;
    if (error && 'bet' in row && /\bbet\b.*(column|schema cache)|column.*\bbet\b/i.test(error.message || '')) {
      // The database hasn't been updated for picked legs yet: save it as a typed leg.
      const { bet: _bet, ...plain } = row;
      ({ error } = await save(plain));
      untracked = !error;
    }
    setBusy(false);
    if (error) { setHint({ text: friendly(error), err: true }); return; }
    if (untracked) toast('Saved, but without live tracking until the commish runs the latest database update.');
    store.remove(draftKey);
    if (!untracked) toast(editing ? 'Leg updated.' : `Added ${pname(player)}’s leg.`);
    onDone();
  }

  return (
    <form ref={formRef} className="card stack" onSubmit={submit} noValidate>
      <h3 className="sec-title-sm">{editing ? `Edit ${pname(editing.player_id)}’s leg` : player === me ? 'Add your leg' : 'Add a leg'}</h3>
      {locked && <p className="hint">Picks are locked. As an admin you can still add or fix legs.</p>}
      {!editing && options.length > 1 && (
        <div className="field">
          <label htmlFor="f-player">Whose leg</label>
          <select id="f-player" value={player} onChange={(e) => { setPlayer(e.target.value); saveDraft({ player: e.target.value }); }}>
            {options.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === me ? ' (you)' : ''}</option>)}
          </select>
        </div>
      )}
      {mode === 'pick' ? (
        <BetPicker value={b} onTypeInstead={toType}
          onChange={(nb) => { setB(nb); saveDraft({ b: nb }); setHint({ text: HINT, err: false }); }} />
      ) : (
        <div className="field">
          <label htmlFor="f-pick">Pick</label>
          <input id="f-pick" maxLength={80} autoComplete="off" placeholder="Bills -3.5, Lamar 250+ pass yds" value={pick}
            onChange={(e) => { setPick(e.target.value); saveDraft({ pick: e.target.value }); setHint({ text: HINT, err: false }); }} />
          <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => { setMode('pick'); saveDraft({ mode: 'pick' }); }}>
            Pick from this week{'’'}s games instead (tracks it live)
          </button>
        </div>
      )}
      <div className="field-row">
        <div className="field">
          <label htmlFor="f-odds">Odds</label>
          <div className="odds-in">
            <button type="button" aria-label={sign === '+' ? 'Plus odds, tap for minus' : 'Minus odds, tap for plus'}
              onClick={() => { const s = sign === '+' ? '-' : '+'; setSign(s); saveDraft({ sign: s }); }}>{sign === '+' ? '+' : '−'}</button>
            <input id="f-odds" inputMode="numeric" autoComplete="off" placeholder="110" value={odds}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith('+')) setSign('+');
                else if (/^[-−]/.test(v)) setSign('-');
                setOdds(v); saveDraft({ odds: v }); setHint({ text: HINT, err: false });
              }} />
          </div>
        </div>
        {mode === 'type' && (
          <div className="field">
            <label htmlFor="f-sport">Sport</label>
            <select id="f-sport" value={sport} onChange={(e) => { setSport(e.target.value); saveDraft({ sport: e.target.value }); }}>
              {SPORTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>
      <p className={`hint${hint.err ? ' err' : ''}`} role={hint.err ? 'alert' : undefined}>{hint.text}</p>
      <div className="btns">
        <button className="btn primary" style={{ flex: 1 }} type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add leg'}</button>
        {editing && <button className="btn" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

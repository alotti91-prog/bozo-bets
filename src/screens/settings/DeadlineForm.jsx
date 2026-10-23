import { useState } from 'react';
import { supabase, friendly } from '../../lib/supabase.js';
import { toast } from '../../lib/ui.js';
import { DAYS, lockState, toLocalInput, fmtTime } from '../../lib/deadline.js';

// Admins only: the weekly pick deadline, plus a one-off change for this week.
export default function DeadlineForm({ data, reload }) {
  const league = data.league;
  const cur = data.weeks[data.weeks.length - 1];
  const myTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  const [dow, setDow] = useState(league.lock_dow == null ? '' : String(league.lock_dow));
  const [time, setTime] = useState((league.lock_time || '12:55').slice(0, 5));
  const [one, setOne] = useState(cur?.lock_at ? toLocalInput(new Date(cur.lock_at)) : '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = cur ? lockState(cur.lock_at) : null;
  const on = league.lock_dow != null;
  const changed = dow !== (on ? String(league.lock_dow) : '') || (dow !== '' && time !== (league.lock_time || '').slice(0, 5));

  async function call(fn, args, ok) {
    setBusy(true); setErr('');
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setErr(friendly(error)); return; }
    toast(ok);
    reload();
  }
  function save(e) {
    e.preventDefault();
    if (dow !== '' && !/^\d{2}:\d{2}$/.test(time)) { setErr('Pick a time.'); return; }
    call('set_deadline', { p_league: league.id, p_dow: dow === '' ? null : Number(dow), p_time: dow === '' ? null : time, p_tz: myTz },
      dow === '' ? 'Deadline turned off.' : `Picks now lock ${DAYS[dow]}s at ${fmtTime(time)}.`);
  }
  function saveOne(e) {
    e.preventDefault();
    const d = new Date(one);
    if (!one || isNaN(d)) { setErr('Pick a date and time for this week.'); return; }
    call('set_week_lock', { p_week: cur.id, p_lock_at: d.toISOString() }, `Week ${cur.n} now locks ${lockState(d.toISOString()).label}.`);
  }

  return (
    <div className="stack">
      <p className="sub">After the deadline, people can{'’'}t add or change their own leg. Admins still can. Anyone without a leg goes in the wheel.</p>
      <form className="stack" onSubmit={save} noValidate>
        <div className="dl-row">
          <select aria-label="Deadline day" value={dow} onChange={(e) => setDow(e.target.value)}>
            <option value="">No deadline</option>
            {DAYS.map((d, i) => <option key={d} value={i}>Every {d}</option>)}
          </select>
          {dow !== '' && <input type="time" aria-label="Deadline time" value={time} onChange={(e) => setTime(e.target.value)} />}
          <button className="btn small primary" disabled={busy || !changed}>Save</button>
        </div>
        <p className="hint">{dow === '' ? 'Sunday 12:55 PM works well: picks close just before the early games.' : `Your time zone (${myTz.replace(/_/g, ' ')}). Applies to this week and every new week.`}</p>
      </form>
      {cur && (on || cur.lock_at) && (
        <form className="stack" onSubmit={saveOne} noValidate>
          <label htmlFor="one-lock" className="label-sm">Just Week {cur.n}</label>
          <p className="sub" style={{ marginTop: 0 }}>{lock ? (lock.locked ? `Locked ${lock.label}.` : `Locks ${lock.label}, ${lock.countdown} from now.`) : 'No deadline this week.'} Change it for a holiday or a weird schedule.</p>
          <div className="dl-row">
            <input id="one-lock" type="datetime-local" value={one} onChange={(e) => setOne(e.target.value)} />
            <button className="btn small" disabled={busy || !one}>Save for this week</button>
            {cur.lock_at && <button type="button" className="link" disabled={busy} onClick={() => { setOne(''); call('set_week_lock', { p_week: cur.id, p_lock_at: null }, `No deadline for Week ${cur.n}.`); }}>No deadline this week</button>}
          </div>
        </form>
      )}
      {err && <p className="hint err">{err}</p>}
    </div>
  );
}

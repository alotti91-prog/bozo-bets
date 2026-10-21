import { useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { parseOdds, weekInfo, amerFmt } from '../lib/odds.js';
import { nflWeekDate, seasonOf } from '../lib/nfl.js';
import { toast } from '../lib/ui.js';
import { Sheet } from '../components/common.jsx';

/**
 * Commish tool: enter (or fix) a week that happened before the league was in
 * the app. One row per player: pick, odds, and W/L/P. Leave a pick blank if
 * that player didn't have a leg that week.
 */
export default function PastWeekSheet({ data, week, onClose, reload }) {
  const weeks = data.weeks;
  const cur = weeks[weeks.length - 1];
  const used = new Set(weeks.map((w) => w.n));
  const free = [];
  for (let i = cur.n - 1; i >= 1; i--) if (!used.has(i)) free.push(i);

  const existing = week ? data.legs.filter((l) => l.week_id === week.id) : [];
  const playerIds = new Set([...data.players.filter((p) => p.active).map((p) => p.id), ...existing.map((l) => l.player_id)]);
  const players = data.players.filter((p) => playerIds.has(p.id));

  const [n, setN] = useState(week ? week.n : free[0]);
  const [payer, setPayer] = useState(week?.payer_id || '');
  const [rows, setRows] = useState(() => players.map((p) => {
    const l = existing.find((x) => x.player_id === p.id);
    return l
      ? { player_id: p.id, name: p.name, pick: l.pick, sign: l.odds > 0 ? '+' : '-', odds: String(Math.abs(l.odds)), result: l.result || '' }
      : { player_id: p.id, name: p.name, pick: '', sign: '-', odds: '', result: '' };
  }));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (i, patch) => { setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))); setErr(''); };

  if (!week && !free.length) {
    return (
      <Sheet title="Add a past week" onClose={onClose}>
        <p>Every week before Week {cur.n} is already in the league. To add more, change this week{'’'}s number in Settings first.</p>
      </Sheet>
    );
  }

  // Live summary of what's been entered.
  const filled = rows.filter((r) => r.pick.trim());
  const preview = filled.map((r) => ({ odds: parseOdds(r.odds, r.sign).odds || -110, result: r.result || null }));
  const info = weekInfo({ stake: data.league.stake, actual_payout: null }, preview);

  async function save() {
    const legs = [];
    for (const r of rows) {
      const hasAny = r.pick.trim() || r.odds.trim() || r.result;
      if (!hasAny) continue;
      if (!r.pick.trim()) { setErr(`Add ${r.name}’s pick, or clear their row.`); return; }
      const o = parseOdds(r.odds, r.sign);
      if (o.error) { setErr(`${r.name}: ${o.error}`); return; }
      if (!r.result) { setErr(`Mark ${r.name}’s pick W, L or P.`); return; }
      legs.push({ player_id: r.player_id, pick: r.pick.trim().slice(0, 80), odds: o.odds, sport: 'NFL', result: r.result });
    }
    if (!legs.length) { setErr('Add at least one pick.'); return; }
    setBusy(true);
    const season = seasonOf(cur.start_date);
    const { error } = await supabase.rpc('save_past_week', {
      p_league: data.league.id,
      p_week: week ? week.id : null,
      p_n: week ? null : n,
      p_start: week ? null : nflWeekDate(season, n),
      p_payer: payer || null,
      p_legs: legs,
    });
    setBusy(false);
    if (error) { setErr(friendly(error)); return; }
    toast(week ? `Week ${week.n} updated.` : `Week ${n} added.`);
    reload();
    onClose();
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.rpc('delete_past_week', { p_week: week.id });
    setBusy(false);
    if (error) { setErr(friendly(error)); return; }
    toast(`Week ${week.n} deleted.`);
    reload();
    onClose();
  }

  return (
    <Sheet title={week ? `Edit Week ${week.n}` : 'Add a past week'} onClose={onClose}>
      <div className="field-row">
        <div className="field">
          <label htmlFor="pw-n">Week</label>
          {week ? (
            <input id="pw-n" value={`Week ${week.n}`} disabled />
          ) : (
            <select id="pw-n" value={n} onChange={(e) => setN(parseInt(e.target.value, 10))}>
              {free.map((x) => <option key={x} value={x}>Week {x}</option>)}
            </select>
          )}
        </div>
        <div className="field">
          <label htmlFor="pw-payer">Who put in</label>
          <select id="pw-payer" value={payer} onChange={(e) => setPayer(e.target.value)}>
            <option value="">Not sure</option>
            {data.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <section>
        <span className="lbl">Picks</span>
        <p className="hint" style={{ marginTop: -4 }}>Leave a pick blank if that person didn{'’'}t have a leg. Use P for a push or void.</p>
        <div className="pw-list">
          {rows.map((r, i) => (
            <div className="pw-row" key={r.player_id}>
              <div className="pw-head">
                <span className="pw-name">{r.name}</span>
                <div className="seg" role="group" aria-label={`Result for ${r.name}`}>
                  {['W', 'L', 'P'].map((x) => (
                    <button key={x} type="button" className={`s-${x}`} aria-pressed={r.result === x}
                      aria-label={{ W: 'Won', L: 'Lost', P: 'Push or void' }[x]}
                      onClick={() => set(i, { result: r.result === x ? '' : x })}>{x}</button>
                  ))}
                </div>
              </div>
              <div className="pw-inputs">
                <input aria-label={`${r.name}’s pick`} placeholder="Pick, like Bills -3.5" maxLength={80} value={r.pick}
                  onChange={(e) => set(i, { pick: e.target.value })} />
                <div className="odds-in">
                  <button type="button" aria-label={r.sign === '+' ? 'Plus odds, tap for minus' : 'Minus odds, tap for plus'}
                    onClick={() => set(i, { sign: r.sign === '+' ? '-' : '+' })}>{r.sign === '+' ? '+' : '−'}</button>
                  <input aria-label={`${r.name}’s odds`} inputMode="numeric" placeholder="110" value={r.odds}
                    onChange={(e) => {
                      const v = e.target.value;
                      const patch = { odds: v };
                      if (v.startsWith('+')) patch.sign = '+';
                      else if (/^[-−]/.test(v)) patch.sign = '-';
                      set(i, patch);
                    }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="sub">
          {filled.length} pick{filled.length === 1 ? '' : 's'}
          {filled.length > 0 && <> · {amerFmt(info.d)} · {{ hit: 'Hit', busted: 'Busted', live: 'Some still need W/L/P', empty: '' }[info.status]}</>}
        </p>
        {err && <p className="hint err" role="alert">{err}</p>}
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : week ? 'Save changes' : `Add Week ${n}`}</button>
        </div>
        {week && (confirmDelete ? (
          <div className="confirm-box">
            <p>Delete Week {week.n} and all its picks? This can{'’'}t be undone.</p>
            <div className="btns">
              <button type="button" className="btn small nose" disabled={busy} onClick={remove}>Delete Week {week.n}</button>
              <button type="button" className="btn small" onClick={() => setConfirmDelete(false)}>Keep it</button>
            </div>
          </div>
        ) : <button type="button" className="link danger" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmDelete(true)}>Delete this week</button>)}
      </section>
    </Sheet>
  );
}

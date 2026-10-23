import { useEffect, useRef, useState } from 'react';
import { supabase, friendly } from '../../lib/supabase.js';
import { parseOdds } from '../../lib/odds.js';
import { toast, store } from '../../lib/ui.js';
import { SPORTS as LIVE_SPORTS } from '../../lib/espn.js';
import { pickText, betProblem, emptyPick, pickFromBet, betFromPick } from '../../lib/bets.js';
import BetPicker from '../../components/BetPicker.jsx';

const SPORTS = ['NFL', 'NCAAF', 'NBA', 'NHL', 'MLB', 'Soccer', 'Other'];
const HINT = 'American odds, as the book shows them. Tap the sign to switch between minus and plus.';

// Add or edit a leg: pick it from this week's games (tracks live) or type it. Keeps a draft until saved.
export default function LegForm({ week, editing, options, me, isAdmin, locked, pname, onDone, onCancel }) {
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

import { useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { Brand } from '../components/common.jsx';

/** No league yet: join one with a code, or start one. */
export default function Onboard({ onJoined, onSignOut, hasLeagues, onCancel }) {
  const [code, setCode] = useState('');
  const [joinErr, setJoinErr] = useState('');
  const [name, setName] = useState('Bozo Bets');
  const [stake, setStake] = useState('10');
  const [names, setNames] = useState('');
  const [me, setMe] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const list = [...new Set(names.split(/[\n,]+/).map((s) => s.trim().slice(0, 24)).filter(Boolean))];

  async function join(e) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length < 4) { setJoinErr('Enter the invite code from the commish.'); return; }
    setBusy(true); setJoinErr('');
    const { data, error } = await supabase.rpc('join_league', { p_code: c });
    setBusy(false);
    if (error) { setJoinErr(friendly(error)); return; }
    onJoined(data);
  }

  async function create(e) {
    e.preventDefault();
    const s = parseFloat(stake.replace(/[$,\s]/g, ''));
    if (!name.trim()) { setErr('Give the league a name.'); return; }
    if (!(s > 0)) { setErr('Stake needs to be a dollar amount, like 10.'); return; }
    if (list.length < 2) { setErr('Add at least two names, one per line.'); return; }
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('create_league', { p_name: name.trim(), p_stake: s, p_players: list, p_my_name: me || null });
    setBusy(false);
    if (error) { setErr(friendly(error)); return; }
    onJoined(data);
  }

  return (
    <main className="wrap gate">
      <h1 className="brand"><Brand /></h1>
      <form className="card stack" onSubmit={join} noValidate>
        <h2 className="sec-title-sm">Got an invite code?</h2>
        <div className="field">
          <label htmlFor="join-code">Invite code</label>
          <input id="join-code" className="code-input" autoCapitalize="characters" autoComplete="off" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC123" />
        </div>
        {joinErr && <p className="hint err">{joinErr}</p>}
        <button className="btn primary block" disabled={busy}>Join league</button>
      </form>

      <form className="card stack" onSubmit={create} noValidate>
        <h2 className="sec-title-sm">Or start a league (you’ll be the commish)</h2>
        <div className="field">
          <label htmlFor="names">Everyone in the bet, one per line</label>
          <textarea id="names" value={names} onChange={(e) => setNames(e.target.value)} placeholder={'Lotti\nStoosk\nMori'} />
        </div>
        {list.length > 1 && (
          <div className="field">
            <label htmlFor="me">Which one are you?</label>
            <select id="me" value={me} onChange={(e) => setMe(e.target.value)}>
              <option value="">Choose your name</option>
              {list.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
        <div className="field-row">
          <div className="field">
            <label htmlFor="lg-name">League name</label>
            <input id="lg-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="lg-stake">Weekly stake ($)</label>
            <input id="lg-stake" inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} />
          </div>
        </div>
        {err && <p className="hint err">{err}</p>}
        <button className="btn block" disabled={busy}>Start the league</button>
      </form>
      <div className="btns">
        {hasLeagues && <button className="link" onClick={onCancel}>Back to my league</button>}
        <button className="link" onClick={onSignOut}>Sign out</button>
      </div>
    </main>
  );
}

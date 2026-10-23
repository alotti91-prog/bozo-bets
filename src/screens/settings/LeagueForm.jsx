import { useState } from 'react';
import { supabase, friendly } from '../../lib/supabase.js';
import { toast } from '../../lib/ui.js';

// Admins only: league name and weekly stake.
export default function LeagueForm({ league, reload }) {
  const [name, setName] = useState(league.name);
  const [stake, setStake] = useState(String(league.stake));
  const [err, setErr] = useState('');
  async function save(e) {
    e.preventDefault();
    const s = parseFloat(stake.replace(/[$,\s]/g, ''));
    if (!name.trim()) { setErr('Give the league a name.'); return; }
    if (!(s > 0)) { setErr('Stake needs to be a dollar amount, like 10.'); return; }
    setErr('');
    const { error } = await supabase.from('leagues').update({ name: name.trim().slice(0, 40), stake: s }).eq('id', league.id);
    if (error) { setErr(friendly(error)); return; }
    toast('League updated. New stake applies to weeks opened from now on.');
    reload();
  }
  return (
    <div className="stack">
      <form className="stack" onSubmit={save} noValidate>
        <div className="field-row">
          <div className="field"><label htmlFor="s-name">Name</label><input id="s-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="s-stake">Weekly stake ($)</label><input id="s-stake" inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} /></div>
        </div>
        {err && <p className="hint err">{err}</p>}
        <button className="btn small primary" style={{ alignSelf: 'flex-start' }}>Save league</button>
      </form>
    </div>
  );
}

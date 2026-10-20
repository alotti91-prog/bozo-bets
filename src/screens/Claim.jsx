import { useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { toast } from '../lib/ui.js';
import { Brand } from '../components/common.jsx';

/** "Which one are you?" Links this login to a player name. */
export default function Claim({ data, userId, onDone, onSkip }) {
  const [busy, setBusy] = useState(false);
  const taken = new Set(data.members.filter((m) => m.player_id && m.user_id !== userId).map((m) => m.player_id));
  const open = data.players.filter((p) => p.active && !taken.has(p.id));

  async function pick(p) {
    setBusy(true);
    const { error } = await supabase.rpc('claim_player', { p_league: data.league.id, p_player: p.id });
    setBusy(false);
    if (error) { toast(friendly(error)); return; }
    toast(`You’re ${p.name}.`);
    onDone();
  }

  return (
    <main className="wrap gate">
      <h1 className="brand"><Brand name={data.league.name} /></h1>
      <section className="card stack">
        <h2 className="sec-title">Which one are you?</h2>
        <p className="sub">This lets you enter your own leg each week.</p>
        {open.length ? (
          <div className="claim-list">
            {open.map((p) => <button key={p.id} className="btn" disabled={busy} onClick={() => pick(p)}>{p.name}</button>)}
          </div>
        ) : (
          <p className="note">Every name is taken. Ask the commish to add you in Settings, then reopen the app.</p>
        )}
        <p className="fine">Not on the list? Ask the commish to add you. Just keeping score?{' '}
          <button className="link" onClick={onSkip}>Skip for now</button>
        </p>
      </section>
    </main>
  );
}

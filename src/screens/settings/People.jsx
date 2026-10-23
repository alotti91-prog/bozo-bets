import { useState } from 'react';
import { settingsRpc } from './rpc.js';

const ROLE = { owner: 'Owner', admin: 'Admin', member: 'Member' };

// Admins only: everyone who has signed in, which player each one is, and (owner only) admin and remove.
export default function People({ data, userId, isOwner, reload }) {
  const [confirm, setConfirm] = useState(null); // user id awaiting "Remove login"
  const league = data.league;
  const rpc = (fn, args, ok) => settingsRpc(fn, args, ok, reload);
  return (
    <div className="stack">
      <div className="rows">
        {data.members.map((m) => (
          <div className="member" key={m.user_id}>
            <div className="member-top">
              <span className="member-email">{m.email || 'Signed-in member'}{m.user_id === userId ? ' (you)' : ''}</span>
              <span className="role">{ROLE[m.role] || 'Member'}</span>
            </div>
            <select aria-label={`Player for ${m.email || 'member'}`} value={m.player_id || ''}
              onChange={(e) => rpc('assign_player', { p_league: league.id, p_user: m.user_id, p_player: e.target.value || null }, 'Updated.')}>
              <option value="">Not linked to a player</option>
              {data.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {isOwner && m.role !== 'owner' && (
              <div className="btns">
                <button type="button" className="btn small" onClick={() => rpc('set_member_role', { p_league: league.id, p_user: m.user_id, p_role: m.role === 'admin' ? 'member' : 'admin' }, m.role === 'admin' ? 'No longer an admin.' : 'Now an admin.')}>
                  {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                </button>
                {confirm === m.user_id ? (
                  <>
                    <button type="button" className="btn small nose" onClick={() => { setConfirm(null); rpc('remove_member', { p_league: league.id, p_user: m.user_id }, 'Removed. Their picks and history stay.'); }}>Remove login</button>
                    <button type="button" className="btn small" onClick={() => setConfirm(null)}>Keep</button>
                  </>
                ) : <button type="button" className="text-btn danger" onClick={() => setConfirm(m.user_id)}>Remove</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="fine">Admins can grade legs, spin the wheel, set the deadline, and edit players. Only the owner makes or removes admins. Someone has to open the invite and sign in before they show up here.</p>
    </div>
  );
}

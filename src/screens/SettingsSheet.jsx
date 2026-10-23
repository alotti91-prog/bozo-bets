import { useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { toast, shareText } from '../lib/ui.js';
import { Sheet, IconShare } from '../components/common.jsx';
import { nflWeek } from '../lib/nfl.js';
import { siteUrl } from '../lib/site.js';
import WhatsNew from './settings/WhatsNew.jsx';
import PasswordForm from './settings/PasswordForm.jsx';
import DeadlineForm from './settings/DeadlineForm.jsx';
import LeagueForm from './settings/LeagueForm.jsx';
import PlayersForm from './settings/PlayersForm.jsx';
import WeekNumberForm from './settings/WeekNumberForm.jsx';

// The Settings sheet: you, invite, members, and weeks live here.
// Each form is its own file in ./settings/.
export default function SettingsSheet({ data, userId, member, isAdmin, isOwner, reload, onClose, onChangePlayer, leagues, onSwitchLeague, onAddLeague, onSignOut, onNotesSeen }) {
  const [confirm, setConfirm] = useState(null);
  const league = data.league;
  const pname = (id) => data.players.find((p) => p.id === id)?.name || 'Unknown';
  const inviteLink = `${siteUrl()}${window.location.pathname}?join=${league.invite_code}`;

  async function rpc(fn, args, okMsg) {
    const { data: out, error } = await supabase.rpc(fn, args);
    if (error) { toast(friendly(error)); return null; }
    if (okMsg) toast(okMsg);
    reload();
    return out ?? true;
  }

  return (
    <Sheet title="Settings" onClose={onClose}>
      <section style={{ borderTop: 0, paddingTop: 0 }}>
        <span className="lbl">You</span>
        <p>{member?.player_id ? <>You{'’'}re <strong>{pname(member.player_id)}</strong> in {league.name}.</> : 'You’re not linked to a player yet.'}{' '}
          <span className="role">{member?.role === 'owner' ? 'Owner' : member?.role === 'admin' ? 'Admin' : 'Member'}</span>
        </p>
        <div className="btns">
          <button className="btn small" onClick={onChangePlayer}>{member?.player_id ? 'I’m someone else' : 'Pick my name'}</button>
          {leagues.length > 1 && (
            <select aria-label="Switch league" value={league.id} onChange={(e) => onSwitchLeague(e.target.value)} style={{ width: 'auto', minHeight: 34 }}>
              {leagues.map((l) => <option key={l.league_id} value={l.league_id}>{l.leagues?.name || 'League'}</option>)}
            </select>
          )}
          <button className="btn small" onClick={onAddLeague}>Join or start another league</button>
          <button className="btn small" onClick={onSignOut}>Sign out</button>
        </div>
      </section>

      {isAdmin && <WhatsNew onSeen={onNotesSeen} />}

      <PasswordForm />

      <section>
        <span className="lbl">Invite the group</span>
        <p className="invite-code" aria-label={`Invite code ${league.invite_code.split('').join(' ')}`}>{league.invite_code}</p>
        <p className="sub">Friends open the link, sign in with their email, and pick their name.</p>
        <div className="btns">
          <button className="btn primary" onClick={() => shareText(`Join our Bozo Bets league: ${inviteLink}\nInvite code: ${league.invite_code}`, { title: 'Join Bozo Bets', successMsg: 'Invite copied. Paste it in the group chat.' })}><IconShare />Share invite</button>
          {isOwner && (confirm === 'code' ? (
            <span className="btns">
              <button className="btn small nose" onClick={async () => { setConfirm(null); await rpc('regenerate_invite', { p_league: league.id }, 'New code ready. The old one stopped working.'); }}>Replace code</button>
              <button className="btn small" onClick={() => setConfirm(null)}>Keep it</button>
            </span>
          ) : <button className="link" onClick={() => setConfirm('code')}>New code</button>)}
        </div>
        <p className="fine" style={{ userSelect: 'all', overflowWrap: 'anywhere' }}>{inviteLink}</p>
      </section>

      {isAdmin && <DeadlineForm key={`${league.lock_dow}-${league.lock_time}-${data.weeks[data.weeks.length - 1]?.lock_at}`} data={data} reload={reload} />}
      {isAdmin && <LeagueForm league={league} reload={reload} />}
      {isAdmin && <PlayersForm data={data} reload={reload} />}

      {isAdmin && (
        <section>
          <span className="lbl">People signed in ({data.members.length})</span>
          {data.members.map((m) => (
            <div className="member" key={m.user_id}>
              <div className="member-top">
                <span className="member-email">{m.email || 'Signed-in member'}{m.user_id === userId ? ' (you)' : ''}</span>
                <span className="role">{m.role === 'owner' ? 'Owner' : m.role === 'admin' ? 'Admin' : 'Member'}</span>
              </div>
              <div className="p-row">
                <select aria-label={`Player for ${m.email || 'member'}`} value={m.player_id || ''}
                  onChange={(e) => rpc('assign_player', { p_league: league.id, p_user: m.user_id, p_player: e.target.value || null }, 'Updated.')}>
                  <option value="">Not linked to a player</option>
                  {data.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {isOwner && m.role !== 'owner' && (
                <div className="btns">
                  <button className="btn small" onClick={() => rpc('set_member_role', { p_league: league.id, p_user: m.user_id, p_role: m.role === 'admin' ? 'member' : 'admin' }, m.role === 'admin' ? 'No longer an admin.' : 'Now an admin.')}>
                    {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  </button>
                  {confirm === 'rm:' + m.user_id ? (
                    <>
                      <button className="btn small nose" onClick={() => { setConfirm(null); rpc('remove_member', { p_league: league.id, p_user: m.user_id }, 'Removed. Their picks and history stay.'); }}>Remove login</button>
                      <button className="btn small" onClick={() => setConfirm(null)}>Keep</button>
                    </>
                  ) : <button className="link danger" onClick={() => setConfirm('rm:' + m.user_id)}>Remove</button>}
                </div>
              )}
            </div>
          ))}
          <p className="fine">Admins (co-commishes) can grade legs, spin the wheel, set the deadline, and edit players. Only the owner makes or removes admins. Someone has to open the invite and sign in before they show up here.</p>
        </section>
      )}

      {isAdmin && (
        <section>
          <span className="lbl">Weeks</span>
          <WeekNumberForm data={data} reload={reload} />
          {confirm === 'next' ? (
            <div className="confirm-box">
              <p>Open the next week without spinning? You{'’'}ll pick who puts in by hand.</p>
              <div className="btns">
                <button className="btn small primary" onClick={() => { setConfirm(null); rpc('start_next_week', { p_league: league.id }, 'Next week is open.'); }}>Open next week</button>
                <button className="btn small" onClick={() => setConfirm(null)}>Never mind</button>
              </div>
            </div>
          ) : <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirm('next')}>Open next week without spinning</button>}
          {isOwner && (confirm === 'season' ? (
            <div className="confirm-box">
              <p>Delete every week, pick, and spin, and start over at Week {nflWeek().week} (the current NFL week)? Players and logins stay. This can{'’'}t be undone.</p>
              <div className="btns">
                <button className="btn small nose" onClick={() => { setConfirm(null); rpc('new_season', { p_league: league.id, p_first_week: nflWeek().week }, 'New season started.'); }}>Delete and restart</button>
                <button className="btn small" onClick={() => setConfirm(null)}>Keep everything</button>
              </div>
            </div>
          ) : <button className="link danger" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirm('season')}>Start a new season</button>)}
        </section>
      )}
    </Sheet>
  );
}

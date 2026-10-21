import { useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { toast, shareText, store } from '../lib/ui.js';
import { Sheet, IconShare } from '../components/common.jsx';
import { nflWeek } from '../lib/nfl.js';

export default function SettingsSheet({ data, userId, member, isAdmin, isOwner, reload, onClose, onChangePlayer, leagues, onSwitchLeague, onAddLeague, onSignOut }) {
  const [confirm, setConfirm] = useState(null);
  const league = data.league;
  const pname = (id) => data.players.find((p) => p.id === id)?.name || 'Unknown';
  const inviteLink = `${window.location.origin}${window.location.pathname}?join=${league.invite_code}`;

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
          <span className="role">{member?.role === 'owner' ? 'Owner' : member?.role === 'admin' ? 'Co-commish' : 'Member'}</span>
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

      {isAdmin && <LeagueForm league={league} reload={reload} />}
      {isAdmin && <PlayersForm data={data} reload={reload} />}

      {isAdmin && (
        <section>
          <span className="lbl">People signed in ({data.members.length})</span>
          {data.members.map((m) => (
            <div className="member" key={m.user_id}>
              <div className="member-top">
                <span className="member-email">{m.email || 'Signed-in member'}{m.user_id === userId ? ' (you)' : ''}</span>
                <span className="role">{m.role === 'owner' ? 'Owner' : m.role === 'admin' ? 'Co-commish' : 'Member'}</span>
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
                  <button className="btn small" onClick={() => rpc('set_member_role', { p_league: league.id, p_user: m.user_id, p_role: m.role === 'admin' ? 'member' : 'admin' }, m.role === 'admin' ? 'No longer a co-commish.' : 'Now a co-commish.')}>
                    {m.role === 'admin' ? 'Remove co-commish' : 'Make co-commish'}
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
          <p className="fine">Co-commishes can grade legs, spin the wheel, and edit players. Only the owner changes roles.</p>
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

function PasswordForm() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const hasPw = store.get('bz-has-pw', false);
  async function save(e) {
    e.preventDefault();
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('Those two don’t match.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setErr(/reauth|recent/i.test(error.message)
        ? 'For security, sign out and back in with an email code, then set your password.'
        : /same|different/i.test(error.message) ? 'That’s already your password.' : friendly(error));
      return;
    }
    store.set('bz-has-pw', true);
    store.set('bz-login-mode', 'password');
    setPw(''); setPw2('');
    toast('Password saved. Next time, sign in with your email and password.');
  }
  return (
    <section>
      <span className="lbl">{hasPw ? 'Change password' : 'Skip the sign-in email'}</span>
      <p className="sub">{hasPw
        ? 'You can sign in with your email and password on any device.'
        : 'Set a password and you can sign in with just your email and password next time. No code needed.'}</p>
      <form className="stack" onSubmit={save} noValidate>
        <input type="email" autoComplete="username" value={store.get('bz-last-email', '')} readOnly hidden />
        <div className="field-row">
          <div className="field">
            <label htmlFor="new-pw">New password</label>
            <input id="new-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="new-pw2">Type it again</label>
            <input id="new-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
        </div>
        {err && <p className="hint err">{err}</p>}
        <button className="btn small primary" style={{ alignSelf: 'flex-start' }} disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        <p className="fine">At least 8 characters. Don{'’'}t reuse a password from your bank or email.</p>
      </form>
    </section>
  );
}

function WeekNumberForm({ data, reload }) {
  const weeks = data.weeks;
  const cur = weeks[weeks.length - 1];
  const pastMax = weeks.length > 1 ? weeks[weeks.length - 2].n : 0;
  const [n, setN] = useState(cur ? String(cur.n) : '');
  const [err, setErr] = useState('');
  const now = nflWeek().week;
  if (!cur) return null;
  async function save(e) {
    e.preventDefault();
    const v = parseInt(n, 10);
    if (!(v >= 1 && v <= 30)) { setErr('Use a number from 1 to 30.'); return; }
    if (v <= pastMax) { setErr(`This week has to come after Week ${pastMax}, your latest past week.`); return; }
    setErr('');
    const { error } = await supabase.rpc('set_week_number', { p_league: data.league.id, p_n: v });
    if (error) { setErr(friendly(error)); return; }
    toast(`This week is now Week ${v}.`);
    reload();
  }
  return (
    <form className="stack" onSubmit={save} noValidate>
      <div className="field">
        <label htmlFor="cur-week">This week{'’'}s number</label>
        <div className="p-row">
          <input id="cur-week" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, '').slice(0, 2))} style={{ maxWidth: 120 }} />
          <button className="btn small" type="submit" disabled={String(cur.n) === n}>Save</button>
        </div>
        <p className="hint">It{'’'}s NFL Week {now} right now.{cur.n !== now ? ` Your league is on Week ${cur.n}.` : ''} Add earlier weeks from History.</p>
      </div>
      {err && <p className="hint err">{err}</p>}
    </form>
  );
}

function LeagueForm({ league, reload }) {
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
    <section>
      <span className="lbl">League</span>
      <form className="stack" onSubmit={save} noValidate>
        <div className="field-row">
          <div className="field"><label htmlFor="s-name">Name</label><input id="s-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="s-stake">Weekly stake ($)</label><input id="s-stake" inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} /></div>
        </div>
        {err && <p className="hint err">{err}</p>}
        <button className="btn small primary" style={{ alignSelf: 'flex-start' }}>Save league</button>
      </form>
    </section>
  );
}

function PlayersForm({ data, reload }) {
  const [rows, setRows] = useState(data.players.map((p) => ({ id: p.id, name: p.name, active: p.active })));
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const changed = rows.filter((r) => {
    const p = data.players.find((x) => x.id === r.id);
    return p && (p.name !== r.name.trim() || p.active !== r.active) && r.name.trim();
  });

  async function save() {
    setBusy(true);
    for (const r of changed) {
      const { error } = await supabase.from('players').update({ name: r.name.trim().slice(0, 24), active: r.active }).eq('id', r.id);
      if (error) { toast(friendly(error)); setBusy(false); return; }
    }
    setBusy(false);
    toast('Players updated.');
    reload();
  }
  async function add(e) {
    e.preventDefault();
    const n = newName.trim();
    if (!n) return;
    const { data: row, error } = await supabase.from('players')
      .insert({ league_id: data.league.id, name: n.slice(0, 24), sort: data.players.length }).select().single();
    if (error) { toast(friendly(error)); return; }
    setRows([...rows, { id: row.id, name: row.name, active: true }]);
    setNewName('');
    toast(`${row.name} added.`);
    reload();
  }

  return (
    <section>
      <span className="lbl">Players</span>
      <div className="p-list">
        {rows.map((r, i) => (
          <div key={r.id} className={`p-row${r.active ? '' : ' off'}`}>
            <input aria-label="Player name" value={r.name} maxLength={24} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <button type="button" className="btn small" onClick={() => setRows(rows.map((x, j) => (j === i ? { ...x, active: !x.active } : x)))}>{r.active ? 'Bench' : 'Bring back'}</button>
          </div>
        ))}
      </div>
      {changed.length > 0 && <button className="btn small primary" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={save}>Save {changed.length} change{changed.length > 1 ? 's' : ''}</button>}
      <form className="p-row" onSubmit={add}>
        <input aria-label="New player name" placeholder="Add a player" maxLength={24} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn small" type="submit">Add</button>
      </form>
      <p className="fine">Benched players keep their history but drop out of new weeks.</p>
    </section>
  );
}

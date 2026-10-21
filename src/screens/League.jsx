import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, demo } from '../lib/supabase.js';
import { useLeague } from '../lib/useLeague.js';
import { store, toast } from '../lib/ui.js';
import { Brand, IconGear } from '../components/common.jsx';
import Claim from './Claim.jsx';
import { bozoBelt } from '../lib/stats.js';
import WeekTab from './WeekTab.jsx';
import WheelTab from './WheelTab.jsx';
import StandingsTab from './StandingsTab.jsx';
import HistoryTab from './HistoryTab.jsx';
import SettingsSheet from './SettingsSheet.jsx';

const TABS = [['week', 'This week'], ['wheel', 'Wheel'], ['standings', 'Standings'], ['history', 'History']];

export default function League({ leagueId, userId, leagues, onSwitchLeague, onAddLeague, onSignOut }) {
  const [tab, setTab] = useState(() => {
    const h = window.location.hash.replace('#', '');
    return TABS.some((t) => t[0] === h) ? h : store.get('bz-tab', 'week');
  });
  const [spinEvent, setSpinEvent] = useState(null);
  const [settings, setSettings] = useState(false);
  const [pwNudgeHidden, setPwNudgeHidden] = useState(() => store.get('bz-has-pw', false) || store.get('bz-pw-nudge-off', false));
  const [skipClaim, setSkipClaim] = useState(() => store.get('bz-skip-claim-' + leagueId, false));
  const dataRef = useRef(null);

  const onSpin = useCallback((spin) => {
    setSpinEvent(spin);
    const d = dataRef.current;
    if (d && store.get('bz-tab', 'week') !== 'wheel') {
      const p = d.players.find((x) => x.id === spin.landed_id);
      toast(`The wheel landed on ${p ? p.name : 'someone'}.`);
    }
  }, [dataRef]);

  const { data, error, reload } = useLeague(leagueId, onSpin);
  useEffect(() => { dataRef.current = data; }, [data]);

  const go = (t) => { setTab(t); store.set('bz-tab', t); window.scrollTo(0, 0); };

  if (error) {
    return (
      <main className="wrap gate">
        <p className="err-box">{error}</p>
        <div className="btns"><button className="btn" onClick={reload}>Try again</button><button className="link" onClick={onAddLeague}>Join a different league</button><button className="link" onClick={onSignOut}>Sign out</button></div>
      </main>
    );
  }
  if (!data) return <div className="center-msg">Loading{'…'}</div>;

  const member = data.members.find((m) => m.user_id === userId);
  const isAdmin = member && (member.role === 'owner' || member.role === 'admin');
  const isOwner = member && member.role === 'owner';
  const me = member?.player_id || null;
  const pname = (id) => data.players.find((p) => p.id === id)?.name || 'Someone';

  if (!me && !skipClaim) {
    return (
      <Claim data={data} userId={userId} onDone={reload}
        onSkip={() => { setSkipClaim(true); store.set('bz-skip-claim-' + leagueId, true); }} />
    );
  }

  async function changePlayer() {
    await supabase.rpc('claim_player', { p_league: leagueId, p_player: null });
    store.remove('bz-skip-claim-' + leagueId);
    setSkipClaim(false);
    setSettings(false);
    reload();
  }

  const belt = bozoBelt(data);
  const nameOfUser = (uid) => {
    const m = data.members.find((x) => x.user_id === uid);
    return (m && m.player_id && pname(m.player_id)) || 'Someone';
  };
  const props = { data, me, isAdmin, reload, pname, userId, beltId: belt?.id || null, belt, nameOfUser };
  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand-row">
            <h1 className="brand"><Brand name={data.league.name} /></h1>
            <div className="top-actions">
              <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Settings"><IconGear /></button>
            </div>
          </div>
          <nav className="tabs" role="tablist" aria-label="Sections">
            {TABS.map(([k, label]) => (
              <button key={k} className="tab" role="tab" id={`tab-${k}`} aria-selected={tab === k} onClick={() => go(k)}>{label}</button>
            ))}
          </nav>
        </div>
      </header>
      <main className="wrap" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {demo && <p className="note">Demo mode: sample data, nothing is saved. Reload to reset.</p>}
        {tab === 'week' && !pwNudgeHidden && (
          <div className="banner">
            <p><strong>Skip the sign-in email next time.</strong> Set a password and sign in with just your email and password.</p>
            <div className="btns">
              <button className="btn small primary" onClick={() => setSettings(true)}>Set password</button>
              <button className="link" onClick={() => { store.set('bz-pw-nudge-off', true); setPwNudgeHidden(true); }}>Not now</button>
            </div>
          </div>
        )}
        {tab === 'week' && <WeekTab {...props} />}
        {tab === 'wheel' && <WheelTab {...props} spinEvent={spinEvent} />}
        {tab === 'standings' && <StandingsTab {...props} />}
        {tab === 'history' && <HistoryTab {...props} />}
      </main>
      {settings && (
        <SettingsSheet data={data} userId={userId} member={member} isAdmin={isAdmin} isOwner={isOwner} reload={reload}
          onClose={() => { setSettings(false); if (store.get('bz-has-pw', false)) setPwNudgeHidden(true); }} onChangePlayer={changePlayer}
          leagues={leagues} onSwitchLeague={(id) => { setSettings(false); onSwitchLeague(id); }}
          onAddLeague={() => { setSettings(false); onAddLeague(); }} onSignOut={onSignOut} />
      )}
    </>
  );
}

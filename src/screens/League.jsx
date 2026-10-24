import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, demo } from '../lib/supabase.js';
import { useLeague } from '../lib/useLeague.js';
import { usePresence } from '../lib/usePresence.js';
import { herePeople } from '../lib/presence.js';
import { unseenFeedback } from '../lib/feedback.js';
import { store, toast } from '../lib/ui.js';
import { Brand, IconGear, IconTicket, IconWheel, IconBars, IconHistory } from '../components/common.jsx';
import Claim from './Claim.jsx';
import { bozoBelt, currentBozo } from '../lib/stats.js';
import { unwatchedSpin, hideSpin } from '../lib/wheel.js';
import { weekRecap } from '../lib/recap.js';
import { weekAwards } from '../lib/awards.js';
import { RELEASES } from '../lib/releases.js';
import { feedDown } from '../lib/scores.js';
import { swipeDirection, swipeTarget } from '../lib/swipe.js';
import WeekTab from './WeekTab.jsx';
import WheelTab from './WheelTab.jsx';
import StandingsTab from './StandingsTab.jsx';
import HistoryTab from './HistoryTab.jsx';
import SettingsSheet from './SettingsSheet.jsx';
import RecapSheet, { WatchPrompt } from './RecapSheet.jsx';

const RECAP_DELAY = 1800; // ms between the spin's result and the recap sliding up
const TABS = [['week', 'This week'], ['wheel', 'Wheel'], ['standings', 'Standings'], ['history', 'History']];
const TAB_ICON = { week: IconTicket, wheel: IconWheel, standings: IconBars, history: IconHistory };

export default function League({ leagueId, userId, leagues, onSwitchLeague, onAddLeague, onSignOut }) {
  const [tab, setTab] = useState(() => {
    const h = window.location.hash.replace('#', '');
    return TABS.some((t) => t[0] === h) ? h : store.get('bz-tab', 'week');
  });
  const [spinEvent, setSpinEvent] = useState(null);
  const [settings, setSettings] = useState(false);
  const [skipClaim, setSkipClaim] = useState(() => store.get('bz-skip-claim-' + leagueId, false));
  const [seenSpins] = useState(() => new Set()); // live spins already played, so each plays once
  const [watched, setWatched] = useState(() => new Set()); // spins watched since the last load
  const [liveSpins] = useState(() => new Set()); // spins that happened with the app open (the toast offers them)
  const [recapOpen, setRecapOpen] = useState(null); // { spinId } after watching a spin, or { weekId } from History/Wheel
  const [watchNow, setWatchNow] = useState(null); // spin id the Wheel tab should replay as soon as it opens
  const [laterFor, setLaterFor] = useState(null); // spin id whose "wheel's been spun" prompt was answered
  const [notesSeen, setNotesSeen] = useState(() => !RELEASES.length || store.get('bz-seen-release') === RELEASES[0].id);
  const [scoresDown, setScoresDown] = useState(feedDown);
  const [asMember, setAsMember] = useState(false); // an admin previewing the member view; resets on reload
  useEffect(() => {
    const on = () => setScoresDown(feedDown());
    window.addEventListener('bz-feed', on);
    return () => window.removeEventListener('bz-feed', on);
  }, []);

  const [slide, setSlide] = useState(''); // 'next' | 'prev': which way the new tab slides in
  const go = (t) => {
    const keys = TABS.map(([k]) => k);
    setSlide(keys.indexOf(t) > keys.indexOf(tab) ? 'next' : 'prev');
    setTab(t); store.set('bz-tab', t); window.scrollTo(0, 0);
  };
  const goRef = useRef(go);
  useEffect(() => { goRef.current = go; });
  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  // Swipe left or right on the page to change tabs.
  useEffect(() => {
    const el = document;
    let start = null;
    const skip = (t) => !t.closest?.('[role="tabpanel"]') || !!t.closest('input, textarea, select, [contenteditable="true"], .overlay, [data-noswipe]');
    const onStart = (e) => {
      start = e.touches.length === 1 && !skip(e.target) ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
    };
    const onEnd = (e) => {
      if (!start || e.changedTouches.length !== 1) { start = null; return; }
      const c = e.changedTouches[0];
      const dir = swipeDirection({ dx: c.clientX - start.x, dy: c.clientY - start.y, dt: Date.now() - start.t, startX: start.x, width: window.innerWidth });
      start = null;
      const to = dir && swipeTarget(TABS.map(([k]) => k), tabRef.current, dir);
      if (to) goRef.current(to);
    };
    const onCancel = () => { start = null; };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onCancel, { passive: true });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchend', onEnd); el.removeEventListener('touchcancel', onCancel); };
  }, []);

  // Someone spun. On the Wheel tab it animates right away. Anywhere else, offer
  // to watch without naming who it landed on.
  const onSpin = useCallback((spin) => {
    setSpinEvent(spin);
    if (document.visibilityState === 'visible') liveSpins.add(spin.id); // came in while they were looking
    if (store.get('bz-tab', 'week') !== 'wheel') {
      toast('The wheel is spinning!', { label: 'Watch', onClick: () => { setTab('wheel'); store.set('bz-tab', 'wheel'); window.scrollTo(0, 0); } });
    }
  }, [liveSpins]);

  const { data, error, reload } = useLeague(leagueId, onSpin);
  // Who's here: shares your player and tab while the app is on screen (no names; see presence.js)
  const presence = usePresence(leagueId, data?.members.find((m) => m.user_id === userId)?.player_id || null, tab);
  // Admins: new feedback gets a toast once, right after the app loads (and a dot on the gear until they look).
  const fbToasted = useRef(false);
  useEffect(() => {
    if (fbToasted.current || !data) return;
    fbToasted.current = true;
    const m = data.members.find((x) => x.user_id === userId);
    if (!m || !['owner', 'admin'].includes(m.role)) return;
    const n = unseenFeedback(data.feedback, data.feedbackViews, userId);
    if (n) toast(`${n} new feedback for the commish`, { label: 'View', onClick: () => setSettings('inbox') });
  }, [data, userId]);

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
  // Member view only hides admin controls. The database still knows you're an admin.
  const realAdmin = !!member && (member.role === 'owner' || member.role === 'admin');
  const previewing = realAdmin && asMember;
  const isAdmin = realAdmin && !previewing;
  const isOwner = !!member && member.role === 'owner' && !previewing;
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

  // Watched a spin to the end (live or replay): remember it on this account so
  // the result shows everywhere, on every device.
  function markWatched(spinId) {
    if (watched.has(spinId)) return;
    setWatched((prev) => new Set(prev).add(spinId));
    supabase.from('spin_views').insert({ spin_id: spinId }).then(() => {}); // a repeat is harmless
    // The first time you see this result (live or replay), the recap follows.
    if (!(data.views || []).includes(spinId)) setTimeout(() => setRecapOpen({ spinId }), RECAP_DELAY);
  }
  // Until you've watched the latest spin, hide who it landed on on every tab.
  const hidden = unwatchedSpin(data, userId, watched);
  const view = hidden ? hideSpin(data, hidden) : data;
  const cur = data.weeks[data.weeks.length - 1];

  // Opened the app to a spin you haven't seen (not one that came in while you
  // were looking; the toast covers that): offer to watch it.
  const prompt = hidden && tab !== 'wheel' && !settings && !watchNow && laterFor !== hidden.id && !liveSpins.has(hidden.id) ? hidden : null;
  function watchSpin() {
    if (hidden) { setLaterFor(hidden.id); setWatchNow(hidden.id); }
    go('wheel');
  }
  const recapWeek = recapOpen && (recapOpen.weekId || view.spins.find((s) => s.id === recapOpen.spinId)?.week_id);
  const base = recapWeek ? weekRecap(view, recapWeek) : null; // null until the spin's row has loaded
  const recap = base && { ...base, awards: weekAwards(view, recapWeek) };

  const belt = bozoBelt(data);
  const nameOfUser = (uid) => {
    const m = data.members.find((x) => x.user_id === uid);
    return (m && m.player_id && pname(m.player_id)) || 'Someone';
  };
  const bozoId = currentBozo(view); // from the masked view, so an unwatched spin doesn't give it away
  const bozoUser = (uid) => !!bozoId && data.members.some((m) => m.user_id === uid && m.player_id === bozoId);
  const here = herePeople(presence, data.players);
  const fbNew = isAdmin ? unseenFeedback(data.feedback, data.feedbackViews, userId) : 0;
  const props = { data: view, me, here, isAdmin, reload, pname, userId, beltId: belt?.id || null, belt, bozoId, bozoUser, nameOfUser,
    openSettings: () => setSettings(true), watchSpin, markWatched, openRecap: (weekId) => setRecapOpen({ weekId }) };
  return (
    <>
      <header className="top">
        <div className="wrap brand-row">
          <h1 className="brand"><Brand name={data.league.name} /></h1>
          <button className="icon-btn" onClick={() => setSettings(true)} aria-label={isAdmin && (!notesSeen || fbNew) ? 'Settings (new updates)' : 'Settings'}>
            <IconGear />{isAdmin && (!notesSeen || fbNew > 0) && <span className="dot-new" aria-hidden="true" />}
          </button>
        </div>
        {previewing && (
          <div className="preview-bar" role="status">
            <div className="wrap">
              <span><strong>Member view.</strong> What members see. Anything you do still counts.</span>
              <button type="button" className="text-btn" onClick={() => setAsMember(false)}>Back to admin</button>
            </div>
          </div>
        )}
      </header>
      <main className="wrap" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {demo && <p className="note">Demo mode: sample data, nothing is saved. Reload to reset.</p>}
        {isAdmin && scoresDown && (
          <div className="banner">
            <p><strong>Live scores aren{'’'}t loading.</strong> ESPN{'’'}s feed isn{'’'}t answering right now, so legs won{'’'}t track live. People can still add legs with {'“'}Type it instead.{'”'}</p>
          </div>
        )}
        {isAdmin && data.missing?.length > 0 && (
          <div className="banner">
            <p><strong>Database update needed.</strong> {data.missing.join(' and ')} {data.missing.length > 1 ? 'are' : 'is'} turned off until you run the latest <code>schema.sql</code> in the Supabase SQL Editor.</p>
          </div>
        )}
        <div key={tab} className={`pane${slide ? ` pane-${slide}` : ''}`}>
        {tab === 'week' && <WeekTab {...props} />}
        {tab === 'wheel' && <WheelTab {...props} spinEvent={spinEvent} seenSpins={seenSpins} autoplay={watchNow} onAutoplay={() => setWatchNow(null)} />}
        {tab === 'standings' && <StandingsTab {...props} />}
        {tab === 'history' && <HistoryTab {...props} />}
        </div>
      </main>
      <nav className="tabbar" role="tablist" aria-label="Sections">
        {TABS.map(([k, label]) => {
          const Icon = TAB_ICON[k];
          return (
            <button key={k} type="button" className="tab" role="tab" id={`tab-${k}`} aria-selected={tab === k} onClick={() => go(k)}>
              <Icon /><span>{label}</span>
            </button>
          );
        })}
      </nav>
      {settings && (
        <SettingsSheet data={data} userId={userId} member={member} isAdmin={isAdmin} isOwner={isOwner} reload={reload} onNotesSeen={() => setNotesSeen(true)}
          canPreview={realAdmin} previewing={previewing} onPreview={(on) => { setAsMember(on); setSettings(false); window.scrollTo(0, 0); }}
          onClose={() => setSettings(false)} onChangePlayer={changePlayer}
          leagues={leagues} onSwitchLeague={(id) => { setSettings(false); onSwitchLeague(id); }}
          onAddLeague={() => { setSettings(false); onAddLeague(); }} onSignOut={onSignOut}
          initialPage={typeof settings === 'string' ? settings : null} />
      )}
      {prompt && (
        <WatchPrompt weekN={data.weeks.find((w) => w.id === prompt.week_id)?.n} nextN={cur.n} stake={Number(cur.stake)}
          onWatch={watchSpin} onLater={() => setLaterFor(prompt.id)} />
      )}
      {recap && <RecapSheet recap={recap} pname={pname} leagueName={data.league.name} onClose={() => setRecapOpen(null)} />}
    </>
  );
}

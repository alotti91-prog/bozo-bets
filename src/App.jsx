import { useCallback, useEffect, useState } from 'react';
import { supabase, configured, friendly } from './lib/supabase.js';
import { store, toast } from './lib/ui.js';
import { Toaster, Brand } from './components/common.jsx';
import SignIn from './screens/SignIn.jsx';
import Onboard from './screens/Onboard.jsx';
import League from './screens/League.jsx';
import { siteUrl, isPrivateAddress } from './lib/site.js';

// An invite link looks like https://your-site/?join=ABC123. Remember the code
// across the sign-in round trip, then tidy the address bar.
function readJoinCode() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('join');
  if (code) {
    store.set('bz-pending-join', code.toUpperCase());
    params.delete('join');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
  }
  return store.get('bz-pending-join', null);
}

export default function App() {
  if (!configured) return <SetupNeeded />;
  return (
    <>
      <PrivateAddressBar />
      <UpdateBar />
      <Main />
      <Toaster />
    </>
  );
}

function Main() {
  const [session, setSession] = useState(undefined);
  const [joinCode] = useState(readJoinCode);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="center-msg">Loading{'…'}</div>;
  if (!session) return <SignIn joinCode={joinCode} />;
  return <Home userId={session.user.id} />;
}

function Home({ userId }) {
  const [leagues, setLeagues] = useState(null);
  const [current, setCurrent] = useState(() => store.get('bz-league', null));
  const [adding, setAdding] = useState(false);

  const loadLeagues = useCallback(async () => {
    const pending = store.get('bz-pending-join', null);
    if (pending) {
      const { data, error } = await supabase.rpc('join_league', { p_code: pending });
      store.remove('bz-pending-join');
      if (error) toast(friendly(error));
      else { store.set('bz-league', data); setCurrent(data); }
    }
    const { data, error } = await supabase.from('members').select('league_id, role, player_id, leagues(name)').eq('user_id', userId).order('joined_at');
    if (error) { toast(friendly(error)); setLeagues([]); return; }
    setLeagues(data);
  }, [userId]);

  useEffect(() => { loadLeagues(); }, [loadLeagues]);

  const pick = (id) => { store.set('bz-league', id); setCurrent(id); setAdding(false); loadLeagues(); };
  const signOut = async () => { store.remove('bz-league'); await supabase.auth.signOut(); };

  if (!leagues) return <div className="center-msg">Loading{'…'}</div>;
  if (!leagues.length || adding) {
    return <Onboard onJoined={pick} onSignOut={signOut} hasLeagues={leagues.length > 0} onCancel={() => setAdding(false)} />;
  }
  const active = leagues.some((l) => l.league_id === current) ? current : leagues[0].league_id;
  return (
    <League key={active} leagueId={active} userId={userId} leagues={leagues}
      onSwitchLeague={pick} onAddLeague={() => setAdding(true)} onSignOut={signOut} />
  );
}

// A phone can keep the app open for days, especially from the home screen.
// Each time the app comes back on screen, check for a newer version. If there
// is one, reload right away, unless someone is mid-typing or has a sheet open
// (they may have flipped to DraftKings to check odds). Then offer a Refresh bar.
function busyTyping() {
  if (document.querySelector('.overlay')) return true; // Settings or another sheet is open
  return [...document.querySelectorAll('input, textarea')].some((el) =>
    !el.readOnly && !el.hidden && !['hidden', 'checkbox', 'radio', 'file'].includes(el.type) && String(el.value || '').trim() !== '');
}

function UpdateBar() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const mine = import.meta.env.VITE_BUILD_ID;
    if (!mine || import.meta.env.DEV) return undefined;
    let checking = false;
    const check = async (canReload) => {
      if (checking || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const r = await fetch('/version.json', { cache: 'no-store' });
        const v = r.ok ? await r.json() : null;
        if (v?.id && v.id !== mine) {
          // Reload once per new version; if that somehow didn't take, fall back to the bar.
          if (canReload && !busyTyping() && store.get('bz-reloaded-for') !== v.id) {
            store.set('bz-reloaded-for', v.id);
            window.location.reload();
            return;
          }
          setStale(true);
        }
      } catch { /* offline: try again later */ }
      checking = false;
    };
    const onShow = () => check(true); // coming back to the app: safe moment to reload
    const onTick = () => check(false); // while in use: just offer the bar
    onShow();
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onTick);
    const t = setInterval(onTick, 10 * 60e3);
    return () => { document.removeEventListener('visibilitychange', onShow); window.removeEventListener('focus', onTick); clearInterval(t); };
  }, []);
  if (!stale) return null;
  return (
    <div className="offsite update-bar" role="status">
      Bozo Bets was updated.{' '}
      <button type="button" className="link" onClick={() => window.location.reload()}>Refresh</button>
    </div>
  );
}

// Shown on Vercel's private deployment addresses, which friends can't open.
function PrivateAddressBar() {
  if (!isPrivateAddress()) return null;
  return (
    <div className="offsite" role="status">
      This is a private Vercel address, so friends can{'’'}t open it.{' '}
      <a href={siteUrl() + window.location.pathname + window.location.search}>Go to the public site</a>
    </div>
  );
}

function SetupNeeded() {
  return (
    <main className="wrap gate">
      <h1 className="brand"><Brand /></h1>
      <div className="card stack">
        <h2 className="sec-title-sm">Almost there: connect the database</h2>
        <p>This copy of the app doesn{'’'}t know which Supabase project to use yet. Add these two settings, then reload:</p>
        <p className="note"><code>VITE_SUPABASE_URL</code><br /><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></p>
        <p className="sub">On your computer they go in a file named <code>.env.local</code>. On Vercel they go under Project Settings {'→'} Environment Variables. The README walks through it.</p>
      </div>
    </main>
  );
}

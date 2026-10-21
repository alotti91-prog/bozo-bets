import { useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { store } from '../lib/ui.js';
import { Brand } from '../components/common.jsx';

/**
 * Sign-in. Two ways in:
 *  - Email code (first time, or if you forgot your password). Supabase emails
 *    a link that also contains a code. The code matters on iPhone: a
 *    home-screen app and Safari keep separate logins, so tapping the link
 *    signs you in to Safari, not the app. Typing the code signs in right here.
 *  - Email + password, once you've set one in Settings. No email is sent.
 * The app remembers which one you used last on this device.
 */
export default function SignIn({ joinCode }) {
  const [email, setEmail] = useState(() => store.get('bz-last-email', ''));
  const [mode, setMode] = useState(() => store.get('bz-login-mode', 'code')); // 'code' | 'password'
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const switchMode = (m) => { setMode(m); store.set('bz-login-mode', m); setErr(''); };
  const validEmail = () => {
    const addr = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(addr)) { setErr('Enter a full email address.'); return null; }
    store.set('bz-last-email', addr);
    return addr;
  };

  async function send(e) {
    e.preventDefault();
    const addr = validEmail();
    if (!addr) return;
    setBusy(true); setErr('');
    const redirect = window.location.origin + window.location.pathname + (joinCode ? `?join=${encodeURIComponent(joinCode)}` : '');
    const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: redirect } });
    setBusy(false);
    if (error) { setErr(/rate|seconds/i.test(error.message) ? 'Hold on a minute before asking for another email.' : friendly(error)); return; }
    setSent(true);
  }

  async function verify(e) {
    e.preventDefault();
    const token = code.replace(/\D/g, '');
    if (token.length < 6) { setErr('The code is the 6 or more digits in the email.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    setBusy(false);
    if (error) setErr(/expired|invalid/i.test(error.message) ? 'That code didn’t work or has expired. Send a new one.' : friendly(error));
  }

  async function signInWithPassword(e) {
    e.preventDefault();
    const addr = validEmail();
    if (!addr) return;
    if (!password) { setErr('Enter your password.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: addr, password });
    setBusy(false);
    if (!error) store.set('bz-has-pw', true);
    if (error) {
      setErr(/invalid login|credentials/i.test(error.message)
        ? 'That email and password don’t match. Forgot it, or never set one? Use an email code, then set a password in Settings.'
        : /rate|too many/i.test(error.message) ? 'Too many tries. Wait a few minutes, or use an email code.' : friendly(error));
    }
  }

  return (
    <main className="wrap gate">
      <h1 className="brand"><Brand /></h1>
      <p className="gate-lead">One leg each. One parlay. Whoever misses goes in the wheel.</p>
      {joinCode && <p className="note">You were invited with code <strong>{joinCode}</strong>. Sign in and you’ll join automatically.</p>}

      {sent ? (
        <form key="verify" className="card stack" onSubmit={verify} noValidate>
          <p>Check <strong>{email.trim()}</strong>. Tap the link in the email, or type the code here.</p>
          <div className="field">
            <label htmlFor="code">Code from the email</label>
            <input id="code" className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" autoFocus />
          </div>
          {err && <p className="hint err">{err}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
          <div className="btns">
            <button type="button" className="link" onClick={() => { setSent(false); setCode(''); setErr(''); }}>Use a different email</button>
            <button type="button" className="link" onClick={send} disabled={busy}>Send a new email</button>
          </div>
          <p className="fine">Using the home-screen app on iPhone? Type the code. The link opens Safari instead.</p>
        </form>
      ) : mode === 'password' ? (
        <form key="password" className="card stack" onSubmit={signInWithPassword} noValidate>
          <div className="field">
            <label htmlFor="email">Your email</label>
            <input id="email" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus={!!email} />
          </div>
          {err && <p className="hint err">{err}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => switchMode('code')}>No password yet, or forgot it? Email me a code</button>
        </form>
      ) : (
        <form key="code" className="card stack" onSubmit={send} noValidate>
          <div className="field">
            <label htmlFor="email">Your email</label>
            <input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
          </div>
          {err && <p className="hint err">{err}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in code'}</button>
          <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => switchMode('password')}>I have a password</button>
          <p className="fine">First time? We email you a code. After that, set a password in Settings and skip the email.</p>
        </form>
      )}
    </main>
  );
}

import { useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { Brand } from '../components/common.jsx';

/**
 * Email sign-in. Supabase emails a link that also contains a short code.
 * The code matters on iPhone: a home-screen app and Safari keep separate
 * logins, so tapping the link signs you in to Safari, not the app. Typing
 * the code signs in right here.
 */
export default function SignIn({ joinCode }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send(e) {
    e.preventDefault();
    const addr = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(addr)) { setErr('Enter a full email address.'); return; }
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

  return (
    <main className="wrap gate">
      <h1 className="brand"><Brand /></h1>
      <p className="gate-lead">One leg each. One parlay. Whoever misses goes in the wheel.</p>
      {joinCode && <p className="note">You were invited with code <strong>{joinCode}</strong>. Sign in and you’ll join automatically.</p>}
      {!sent ? (
        <form className="card stack" onSubmit={send} noValidate>
          <div className="field">
            <label htmlFor="email">Your email</label>
            <input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
          </div>
          {err && <p className="hint err">{err}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
          <p className="fine">No password. We email you a link and a code each time you sign in on a new device.</p>
        </form>
      ) : (
        <form className="card stack" onSubmit={verify} noValidate>
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
      )}
    </main>
  );
}

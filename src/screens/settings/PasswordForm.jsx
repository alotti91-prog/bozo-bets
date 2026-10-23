import { useState } from 'react';
import { supabase, friendly } from '../../lib/supabase.js';
import { toast, store } from '../../lib/ui.js';

// Anyone: set a password so you can skip the sign-in email.
export default function PasswordForm() {
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

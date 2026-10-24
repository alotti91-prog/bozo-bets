import { useState } from 'react';
import { supabase, friendly } from '../../lib/supabase.js';
import { toast } from '../../lib/ui.js';
import { ago } from '../../lib/deadline.js';

const MAX = 1000;

/** Everyone: send the commish a note, and see what you've sent (and whether it's done). */
export default function FeedbackForm({ data, userId, reload }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (data.feedback == null) {
    return <p className="hint">Feedback needs a quick database update first. Ask the commish to run the latest setup file in Supabase.</p>;
  }
  const mine = data.feedback.filter((f) => f.user_id === userId).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const { error } = await supabase.from('feedback').insert({ league_id: data.league.id, body });
    setBusy(false);
    if (error) { toast(friendly(error)); return; }
    setText('');
    toast('Sent. The commish will see it next time they open the app.');
    reload();
  }

  return (
    <div className="stack">
      <form className="stack" onSubmit={send}>
        <p className="sheet-lede">Ideas, bugs, complaints about the wheel. It goes to the commish, with your name on it.</p>
        <label className="field">
          <span className="sr-only">Your feedback</span>
          <textarea value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} placeholder="What should we change?" />
        </label>
        <div className="fb-send">
          <span className="fine">{text.length ? `${text.length}/${MAX}` : ''}</span>
          <button type="submit" className="btn primary" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send feedback'}</button>
        </div>
      </form>
      {mine.length > 0 && (
        <section className="stack" aria-labelledby="fb-mine">
          <h3 className="group-label" id="fb-mine">What you{'’'}ve sent</h3>
          <ul className="rows fb-list">
            {mine.map((f) => (
              <li key={f.id} className="row fb-item">
                <span className="row-label">
                  <span className="fb-body">{f.body}</span>
                  <span className="row-note">{ago(f.created_at)}{f.done_at ? ' · Done ✓' : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

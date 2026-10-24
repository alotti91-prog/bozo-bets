import { useEffect, useState } from 'react';
import { supabase, friendly } from '../../lib/supabase.js';
import { toast } from '../../lib/ui.js';
import { ago } from '../../lib/deadline.js';
import { feedbackLists } from '../../lib/feedback.js';

const stamp = () => new Date().toISOString(); // the database replaces it with its own clock

/**
 * Admins: everyone's feedback. New notes are marked seen when you open this
 * (for you only; other admins have their own). Notes you saw over a week ago,
 * and anything any admin marked done, fold into "Older". Nothing is deleted.
 */
export default function FeedbackInbox({ data, userId, nameOfUser, reload }) {
  const [now] = useState(() => Date.now());
  const lists = feedbackLists(data.feedback, data.feedbackViews, userId, now);
  // What was new when you opened this stays labeled New until you leave, so nothing jumps while you read.
  const [freshIds] = useState(() => new Set(lists.fresh.map((f) => f.id)));
  const [showOlder, setShowOlder] = useState(false);
  useEffect(() => {
    if (!freshIds.size) return;
    Promise.all([...freshIds].map((id) => supabase.from('feedback_views').insert({ feedback_id: id }))).then(() => reload());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (data.feedback == null) return <p className="hint">Feedback needs the latest setup file run in Supabase (SQL Editor).</p>;
  const all = [...lists.fresh, ...lists.recent, ...lists.older];
  const fresh = all.filter((f) => freshIds.has(f.id) && !f.done_at);
  const recent = all.filter((f) => !freshIds.has(f.id) && lists.recent.includes(f));
  const older = lists.older;

  async function toggleDone(f) {
    const { error } = await supabase.from('feedback').update({ done_at: f.done_at ? null : stamp() }).eq('id', f.id);
    if (error) { toast(friendly(error)); return; }
    toast(f.done_at ? 'Moved back to open.' : 'Marked done for every admin.');
    reload();
  }
  const item = (f, isNew = false) => (
    <li key={f.id} className={`row fb-item${f.done_at ? ' is-done' : ''}`}>
      <span className="row-label">
        <span className="fb-head"><b>{nameOfUser(f.user_id)}</b><span className="muted"> · {ago(f.created_at)}</span>{isNew && <span className="rel-new">New</span>}</span>
        <span className="fb-body">{f.body}</span>
        {f.done_at && <span className="row-note">Done{f.done_by ? ` by ${nameOfUser(f.done_by)}` : ''} · {ago(f.done_at)}</span>}
      </span>
      <button type="button" className={`text-btn${f.done_at ? ' muted' : ''}`} onClick={() => toggleDone(f)}>{f.done_at ? 'Undo' : 'Done'}</button>
    </li>
  );

  if (!all.length) return <p className="sheet-lede">No feedback yet. When someone sends some from Settings, it shows up here and you get a dot on the gear.</p>;
  return (
    <div className="stack">
      {fresh.length > 0 && (
        <section className="stack" aria-labelledby="fb-new">
          <h3 className="group-label" id="fb-new">New</h3>
          <ul className="rows fb-list">{fresh.map((f) => item(f, true))}</ul>
        </section>
      )}
      {recent.length > 0 && (
        <section className="stack" aria-labelledby="fb-recent">
          <h3 className="group-label" id="fb-recent">This week</h3>
          <ul className="rows fb-list">{recent.map((f) => item(f))}</ul>
        </section>
      )}
      {!fresh.length && !recent.length && <p className="sheet-lede">You{'’'}re all caught up.</p>}
      {older.length > 0 && (
        <section className="stack" aria-labelledby="fb-older">
          <button type="button" className="text-btn muted fb-older-toggle" id="fb-older" aria-expanded={showOlder} onClick={() => setShowOlder(!showOlder)}>
            {showOlder ? 'Hide older' : `Older (${older.length})`}
          </button>
          {showOlder && <ul className="rows fb-list">{older.map((f) => item(f))}</ul>}
        </section>
      )}
      <p className="fine">Seen over a week ago, or marked done, moves to Older. Each admin{'’'}s week starts when they see it.</p>
    </div>
  );
}

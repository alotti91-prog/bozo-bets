import { useEffect, useState } from 'react';
import { store } from '../../lib/ui.js';
import { RELEASES, unseenReleases } from '../../lib/releases.js';

// Admins only: what changed lately, newest first. Opening Settings marks it read.
export default function WhatsNew({ onSeen }) {
  const [fresh] = useState(() => new Set(unseenReleases(store.get('bz-seen-release')).map((r) => r.id)));
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (!RELEASES.length) return;
    store.set('bz-seen-release', RELEASES[0].id);
    onSeen?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!RELEASES.length) return null;
  const shown = all ? RELEASES : RELEASES.filter((r, i) => i === 0 || fresh.has(r.id));
  const more = RELEASES.length - shown.length;
  return (
    <section className="whats-new">
      <span className="lbl">What{'’'}s new <span className="role">Admins only</span></span>
      {shown.map((r) => (
        <article key={r.id} className="rel">
          <h4 className="rel-title">
            {r.title}{fresh.has(r.id) && <span className="rel-new">New</span>}
            <time dateTime={r.date}>{new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time>
          </h4>
          <ul>{r.items.map((t) => <li key={t}>{t}</li>)}</ul>
          {r.idea && <p className="fine">Idea from {r.idea}</p>}
        </article>
      ))}
      {more > 0 && <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setAll(true)}>Show earlier updates ({more})</button>}
    </section>
  );
}

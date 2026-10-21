import { useEffect, useRef, useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { toast } from '../lib/ui.js';
import { ago } from '../lib/deadline.js';
import Reactions from './Reactions.jsx';

const MAX = 280;
const PREVIEW = 2; // comments shown before "See all"

/**
 * Reactions plus the comment thread under one pick on the slip. The 💬 button
 * opens the box to write one. Shows the latest two comments until opened.
 */
export function LegTalk({ leg, data, userId, isAdmin, nameOfUser, reload, who }) {
  const [mode, setMode] = useState('closed'); // 'closed' | 'all' | 'write'
  const here = (data.comments || []).filter((c) => c.leg_id === leg.id);
  return (
    <>
      <Reactions leg={leg} reactions={data.reactions || []} userId={userId} nameOfUser={nameOfUser} reload={reload}>
        <button type="button" className="react" aria-expanded={mode === 'write'}
          aria-label={here.length ? `Comments, ${here.length}. Add one` : 'Add a comment'} title="Comment"
          onClick={() => setMode(mode === 'write' ? 'closed' : 'write')}>
          <span aria-hidden="true">💬</span>{here.length > 0 && <b>{here.length}</b>}
        </button>
      </Reactions>
      <Comments leg={leg} comments={here} userId={userId} isAdmin={isAdmin} nameOfUser={nameOfUser} reload={reload}
        mode={mode} setMode={setMode} who={who} />
    </>
  );
}

/** The thread itself. readOnly lists every comment with no box or delete (History). */
export default function Comments({ leg, comments, userId, isAdmin, nameOfUser, reload, mode = 'all', setMode, who, readOnly = false }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const input = useRef(null);

  useEffect(() => { if (mode === 'write') input.current?.focus(); }, [mode]);

  const open = readOnly || mode !== 'closed';
  const shown = open ? comments : comments.slice(-PREVIEW);
  const hidden = comments.length - shown.length;
  if (!shown.length && !open) return null;
  if (readOnly && !comments.length) return null;

  async function post(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const { error } = await supabase.from('comments').insert({ leg_id: leg.id, body });
    setBusy(false);
    if (error) { toast(friendly(error)); return; }
    setText('');
    reload();
  }

  async function remove(c) {
    setConfirmDel(null);
    const { error } = await supabase.from('comments').delete().eq('id', c.id);
    if (error) { toast(friendly(error)); return; }
    reload();
  }

  return (
    <div className="cmts">
      {hidden > 0 && (
        <button type="button" className="link cmt-more" onClick={() => setMode('all')}>See all {comments.length} comments</button>
      )}
      {shown.length > 0 && (
        <ul className="cmt-list" aria-label="Comments">
          {shown.map((c) => (
            <li key={c.id} className="cmt">
              <b>{nameOfUser(c.user_id)}</b> <span className="cmt-body">{c.body}</span>{' '}
              <span className="cmt-meta">
                <time dateTime={c.created_at}>{ago(c.created_at)}</time>
                {!readOnly && open && (c.user_id === userId || isAdmin) && (confirmDel === c.id ? (
                  <> · Delete?{' '}
                    <button type="button" className="link danger" onClick={() => remove(c)}>Yes</button>
                    <button type="button" className="link" onClick={() => setConfirmDel(null)}>No</button>
                  </>
                ) : (
                  <> · <button type="button" className="link" onClick={() => setConfirmDel(c.id)}>Delete</button></>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && open && (
        <form className="cmt-form" onSubmit={post} noValidate>
          <input ref={input} value={text} maxLength={MAX} enterKeyHint="send" autoComplete="off"
            aria-label={who ? `Comment on ${who}’s pick` : 'Comment on this pick'}
            placeholder={comments.length ? 'Pile on…' : 'Talk your trash…'}
            onChange={(e) => setText(e.target.value)} />
          <button className="cmt-post" disabled={busy || !text.trim()}>{busy ? '…' : 'Post'}</button>
        </form>
      )}
      {!readOnly && open && text.length > MAX - 40 && <p className="cmt-count">{MAX - text.length} characters left</p>}
    </div>
  );
}

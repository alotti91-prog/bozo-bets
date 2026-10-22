import { useEffect, useRef, useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { toast, shrinkImage, fmtWhen } from '../lib/ui.js';
import { Sheet } from '../components/common.jsx';
import { slipPaths } from '../lib/slip.js';

const MAX = 10;

const setupMsg = 'The commish needs to run the latest database update (schema.sql in Supabase) first.';
const needsSetup = (e) => /bucket not found|could not find the function|PGRST202/i.test(`${e?.code || ''} ${e?.message || ''}`);

/**
 * The bet slip. Whoever's on the hook (or the commish) adds screenshots from
 * DraftKings, one or several, and the first one marks the bet placed.
 * Everyone in the league can flip through them.
 */
export default function PlacedSheet({ data, week, canMark, onClose, reload, nameOfUser }) {
  const paths = slipPaths(week);
  const [urls, setUrls] = useState({}); // path -> signed link
  const [view, setView] = useState(null); // index of the screenshot shown big
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [confirmRm, setConfirmRm] = useState(false);
  const inputRef = useRef(null);
  const placed = !!week.placed_at;
  const key = paths.join('|');

  // Private files: fetch a short-lived link for each one we haven't loaded yet.
  useEffect(() => {
    let live = true;
    const todo = paths.filter((p) => !urls[p]);
    if (!todo.length) return undefined;
    Promise.all(todo.map((p) => supabase.storage.from('slips').createSignedUrl(p, 3600).then(({ data: d }) => [p, d?.signedUrl || ''])))
      .then((pairs) => { if (live) setUrls((u) => ({ ...u, ...Object.fromEntries(pairs) })); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = view != null && view < paths.length ? view : null;

  async function addFiles(list) {
    const files = [...(list || [])].slice(0, MAX - paths.length);
    if (inputRef.current) inputRef.current.value = '';
    if (!files.length) return;
    setErr('');
    const done = [];
    for (let i = 0; i < files.length; i++) {
      setBusy(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : 'Uploading…');
      const blob = await shrinkImage(files[i]);
      if (blob.size > 5 * 1024 * 1024) { setErr('One image was over 5 MB and was skipped. A regular screenshot is fine.'); continue; }
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : blob.type === 'image/heic' ? 'heic' : 'jpg';
      const path = `${data.league.id}/${week.id}/${Date.now()}-${i}.${ext}`;
      const up = await supabase.storage.from('slips').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
      if (up.error) { setErr(needsSetup(up.error) ? setupMsg : friendly(up.error)); break; }
      done.push(path);
    }
    if (done.length) {
      const { error } = await supabase.rpc('add_slips', { p_week: week.id, p_paths: done });
      if (error) {
        setErr(needsSetup(error) ? setupMsg : friendly(error));
        supabase.storage.from('slips').remove(done).then(() => {});
      } else {
        toast(placed ? `Added ${done.length} screenshot${done.length === 1 ? '' : 's'}.` : 'Slip is in. Good luck, boys.');
        reload();
      }
    }
    setBusy('');
  }

  async function remove(path) {
    setConfirmRm(false);
    setBusy('Removing…');
    const { error } = await supabase.rpc('remove_slip', { p_week: week.id, p_path: path });
    setBusy('');
    if (error) { setErr(needsSetup(error) ? setupMsg : friendly(error)); return; }
    supabase.storage.from('slips').remove([path]).then(() => {}); // delete the file itself too
    setView(null);
    toast(paths.length === 1 ? 'Removed. The bet shows as not placed until a screenshot is added.' : 'Screenshot removed.');
    reload();
  }

  async function unmark() {
    const { error } = await supabase.rpc('mark_placed', { p_week: week.id, p_placed: false, p_slip_path: null });
    if (error) { setErr(friendly(error)); return; }
    toast('Marked as not placed.');
    reload();
    onClose();
  }

  const n = paths.length;
  return (
    <Sheet title={placed ? `Week ${week.n} bet slip` : 'Place the bet'} onClose={onClose}>
      {placed ? (
        <p className="sub">
          Placed {fmtWhen(week.placed_at)}{week.placed_by && !week.payer_hidden ? ` by ${nameOfUser(week.placed_by)}` : ''}.
          {n > 0 && ` ${n} screenshot${n === 1 ? '' : 's'}.`}
        </p>
      ) : (
        <p className="sub">Put the parlay in on DraftKings, then add screenshots of the slip. Use as many as it takes to show every leg.</p>
      )}

      {shown != null ? (
        <div className="stack">
          <div className="slip-img">
            {urls[paths[shown]] ? <img src={urls[paths[shown]]} alt={`Week ${week.n} slip, screenshot ${shown + 1} of ${n}`} /> : <p className="sub" style={{ padding: 16 }}>Loading{'…'}</p>}
          </div>
          <div className="slip-nav">
            <button type="button" className="btn small" disabled={shown === 0} onClick={() => setView(shown - 1)} aria-label="Previous screenshot">‹</button>
            <span className="sub">{shown + 1} of {n}</span>
            <button type="button" className="btn small" disabled={shown === n - 1} onClick={() => setView(shown + 1)} aria-label="Next screenshot">›</button>
            <button type="button" className="link" onClick={() => { setView(null); setConfirmRm(false); }}>All screenshots</button>
          </div>
          {canMark && (confirmRm ? (
            <div className="confirm-box">
              <p>Remove this screenshot? It{'’'}s deleted for everyone.{n === 1 ? ' With none left, the bet shows as not placed.' : ''}</p>
              <div className="btns">
                <button type="button" className="btn small nose" disabled={!!busy} onClick={() => remove(paths[shown])}>Remove</button>
                <button type="button" className="btn small" onClick={() => setConfirmRm(false)}>Keep it</button>
              </div>
            </div>
          ) : <button type="button" className="link danger" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmRm(true)}>Remove this screenshot</button>)}
        </div>
      ) : n > 0 && (
        <div className="slip-grid">
          {paths.map((p, i) => (
            <button key={p} type="button" className="slip-thumb" onClick={() => setView(i)} aria-label={`Open screenshot ${i + 1} of ${n}`}>
              {urls[p] ? <img src={urls[p]} alt="" /> : <span className="sub">{'…'}</span>}
            </button>
          ))}
        </div>
      )}

      {placed && n === 0 && <p className="note">Marked placed without a screenshot.</p>}

      {canMark && shown == null && (
        <div className="stack">
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          {n < MAX ? (
            <button type="button" className={`btn${n ? '' : ' primary'}`} style={{ alignSelf: 'flex-start' }} disabled={!!busy} onClick={() => inputRef.current?.click()}>
              {busy || (n ? 'Add more screenshots' : 'Add slip screenshots')}
            </button>
          ) : <p className="hint">That{'’'}s the max of {MAX} screenshots. Remove one to add another.</p>}
          {!busy && n < MAX && <p className="hint">Pick several at once if the slip takes more than one screenshot.</p>}
          {placed && n === 0 && <button type="button" className="link danger" style={{ alignSelf: 'flex-start' }} onClick={unmark}>Not placed after all</button>}
        </div>
      )}
      {err && <p className="hint err" role="alert">{err}</p>}
      {!placed && !canMark && <p className="note">Whoever{'’'}s on the hook adds the slip once the bet is in.</p>}
    </Sheet>
  );
}

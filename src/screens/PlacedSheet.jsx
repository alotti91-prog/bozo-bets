import { useEffect, useRef, useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { toast, shrinkImage, fmtWhen } from '../lib/ui.js';
import { Sheet } from '../components/common.jsx';

/**
 * "Bet placed." Whoever's on the hook (or the commish) marks the slip placed
 * and can attach a DraftKings screenshot. Everyone else can view it.
 */
export default function PlacedSheet({ data, week, canMark, onClose, reload, nameOfUser }) {
  const [url, setUrl] = useState(null);
  const [loadingImg, setLoadingImg] = useState(!!week.slip_path);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmUndo, setConfirmUndo] = useState(false);
  const inputRef = useRef(null);
  const placed = !!week.placed_at;

  useEffect(() => {
    let live = true;
    if (!week.slip_path) return undefined;
    supabase.storage.from('slips').createSignedUrl(week.slip_path, 3600).then(({ data: d, error }) => {
      if (!live) return;
      setLoadingImg(false);
      if (error) setErr('Couldn’t load the screenshot. Try again in a minute.');
      else setUrl(d.signedUrl);
    });
    return () => { live = false; };
  }, [week.slip_path]);

  useEffect(() => {
    if (!file) { setPreview(null); return undefined; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function save() {
    setBusy(true); setErr('');
    let path = null;
    if (file) {
      const blob = await shrinkImage(file);
      if (blob.size > 5 * 1024 * 1024) { setBusy(false); setErr('That image is over 5 MB. Try a regular screenshot instead.'); return; }
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : blob.type === 'image/heic' ? 'heic' : 'jpg';
      path = `${data.league.id}/${week.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from('slips').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
      if (up.error) {
        setBusy(false);
        setErr(/bucket not found/i.test(up.error.message)
          ? 'Screenshot storage isn’t set up yet. The commish needs to run the latest database setup in Supabase.'
          : friendly(up.error));
        return;
      }
    }
    const { error } = await supabase.rpc('mark_placed', { p_week: week.id, p_placed: true, p_slip_path: path });
    setBusy(false);
    if (error) { setErr(friendly(error)); return; }
    toast(placed ? 'Slip updated.' : 'Marked as placed. Good luck, boys.');
    reload();
    onClose();
  }

  async function undo() {
    setBusy(true);
    const { error } = await supabase.rpc('mark_placed', { p_week: week.id, p_placed: false, p_slip_path: null });
    setBusy(false);
    if (error) { setErr(friendly(error)); return; }
    toast('Marked as not placed.');
    reload();
    onClose();
  }

  return (
    <Sheet title={placed ? 'Bet placed' : 'Place the bet'} onClose={onClose}>
      {placed ? (
        <p className="sub">Placed {fmtWhen(week.placed_at)}{week.placed_by ? ` by ${nameOfUser(week.placed_by)}` : ''}.</p>
      ) : (
        <p className="sub">Put the parlay in on DraftKings, then mark it here so everyone knows it{'’'}s in.</p>
      )}

      {(preview || url) && (
        <div className="slip-img">
          <img src={preview || url} alt={`Week ${week.n} bet slip screenshot`} />
        </div>
      )}
      {loadingImg && !preview && <p className="sub">Loading screenshot{'…'}</p>}
      {placed && !week.slip_path && !preview && <p className="note">No screenshot was added.</p>}

      {canMark && (
        <div className="stack">
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { setFile(e.target.files?.[0] || null); setErr(''); }} />
          <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => inputRef.current?.click()}>
            {file ? 'Choose a different screenshot' : week.slip_path ? 'Replace screenshot' : 'Add a screenshot (optional)'}
          </button>
          {err && <p className="hint err" role="alert">{err}</p>}
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="button" className="btn primary" disabled={busy || (placed && !file)} onClick={save}>
              {busy ? 'Saving…' : placed ? 'Save screenshot' : 'Mark as placed'}
            </button>
          </div>
          {placed && (confirmUndo ? (
            <div className="confirm-box">
              <p>Mark this week as not placed? The screenshot link is removed too.</p>
              <div className="btns">
                <button type="button" className="btn small nose" disabled={busy} onClick={undo}>Not placed</button>
                <button type="button" className="btn small" onClick={() => setConfirmUndo(false)}>Keep it</button>
              </div>
            </div>
          ) : <button type="button" className="link danger" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmUndo(true)}>Not placed after all</button>)}
        </div>
      )}
      {!canMark && err && <p className="hint err" role="alert">{err}</p>}
    </Sheet>
  );
}

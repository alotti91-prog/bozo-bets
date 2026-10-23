import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { slipPaths } from '../../lib/slip.js';
import { listNames } from '../../lib/ui.js';
import { settingsRpc } from './rpc.js';

// Admins only: go back to an earlier week, say after a test spin. Every later
// week is deleted, that week's spin is undone, and its grades can be cleared.
export default function ResetWeekForm({ data, reload }) {
  const past = data.weeks.slice(0, -1).reverse(); // newest first; the current week isn't a choice
  const [weekId, setWeekId] = useState(past[0]?.id || '');
  const [clear, setClear] = useState(true);
  const [confirm, setConfirm] = useState(false);
  if (!past.length) return null;

  const w = past.find((x) => x.id === weekId) || past[0];
  const later = data.weeks.filter((x) => x.n > w.n);
  const laterLegs = data.legs.filter((l) => later.some((x) => x.id === l.week_id)).length;
  const spun = data.spins.some((s) => s.week_id === w.id);
  const graded = data.legs.filter((l) => l.week_id === w.id && l.result).length;
  const which = later.length === 1 ? `Week ${later[0].n} is` : `Weeks ${listNames(later.map((x) => String(x.n)))} are`;
  const s = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  async function goBack() {
    setConfirm(false);
    const photos = later.flatMap(slipPaths); // noted before those weeks are gone
    const done = await settingsRpc('reset_to_week', { p_week: w.id, p_clear_grades: clear }, `Back to Week ${w.n}.`, reload);
    if (done && photos.length) supabase.storage.from('slips').remove(photos).then(() => {});
  }

  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="reset-week">Go back to an earlier week</label>
        <select id="reset-week" value={w.id} onChange={(e) => { setWeekId(e.target.value); setConfirm(false); }}>
          {past.map((x) => <option key={x.id} value={x.id}>Week {x.n}</option>)}
        </select>
        <p className="hint">For undoing a test or a mistake. It becomes this week again.</p>
      </div>
      <div className="rows">
        <div className="row">
          <span className="row-label" id="reset-clear">Clear its grades<span className="row-note">So its legs can be graded again</span></span>
          <button type="button" role="switch" className="switch" aria-checked={clear} aria-labelledby="reset-clear" onClick={() => setClear(!clear)}><span /></button>
        </div>
      </div>
      {confirm ? (
        <div className="confirm-box" role="alert">
          <p><b>Go back to Week {w.n}?</b></p>
          <ul className="confirm-list">
            <li>{which} deleted{laterLegs ? `, with ${s(laterLegs, 'leg')} and any trash talk or slip photos` : ''}.</li>
            {spun && <li>Week {w.n}{'’'}s spin is undone, so the wheel can spin it again.</li>}
            {clear && graded > 0 && <li>Week {w.n}{'’'}s {s(graded, 'grade')} {graded === 1 ? 'is' : 'are'} cleared.</li>}
          </ul>
          <p>This can{'’'}t be undone.</p>
          <div className="btns">
            <button type="button" className="btn small nose" onClick={goBack}>Go back to Week {w.n}</button>
            <button type="button" className="btn small" onClick={() => setConfirm(false)}>Never mind</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn" onClick={() => setConfirm(true)}>Go back to Week {w.n}{'…'}</button>
      )}
    </div>
  );
}

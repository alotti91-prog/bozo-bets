import { useState } from 'react';
import { supabase, friendly } from '../../lib/supabase.js';
import { toast } from '../../lib/ui.js';
import { nflWeek } from '../../lib/nfl.js';

// Admins only: renumber this week (weeks follow NFL weeks and can skip).
export default function WeekNumberForm({ data, reload }) {
  const weeks = data.weeks;
  const cur = weeks[weeks.length - 1];
  const pastMax = weeks.length > 1 ? weeks[weeks.length - 2].n : 0;
  const [n, setN] = useState(cur ? String(cur.n) : '');
  const [err, setErr] = useState('');
  const now = nflWeek().week;
  if (!cur) return null;
  async function save(e) {
    e.preventDefault();
    const v = parseInt(n, 10);
    if (!(v >= 1 && v <= 30)) { setErr('Use a number from 1 to 30.'); return; }
    if (v <= pastMax) { setErr(`This week has to come after Week ${pastMax}, your latest past week.`); return; }
    setErr('');
    const { error } = await supabase.rpc('set_week_number', { p_league: data.league.id, p_n: v });
    if (error) { setErr(friendly(error)); return; }
    toast(`This week is now Week ${v}.`);
    reload();
  }
  return (
    <form className="stack" onSubmit={save} noValidate>
      <div className="field">
        <label htmlFor="cur-week">This week{'’'}s number</label>
        <div className="p-row">
          <input id="cur-week" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, '').slice(0, 2))} style={{ maxWidth: 120 }} />
          <button className="btn small" type="submit" disabled={String(cur.n) === n}>Save</button>
        </div>
        <p className="hint">It{'’'}s NFL Week {now} right now.{cur.n !== now ? ` Your league is on Week ${cur.n}.` : ''} Add earlier weeks from History.</p>
      </div>
      {err && <p className="hint err">{err}</p>}
    </form>
  );
}

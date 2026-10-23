import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { toast } from '../../lib/ui.js';

// Admins only, after a hit: the payout the book actually paid, if it differs from the math.
export default function PayoutForm({ week, projected, act }) {
  const [v, setV] = useState(week.actual_payout == null ? '' : Number(week.actual_payout).toFixed(2));
  async function save(e) {
    e.preventDefault();
    const s = v.replace(/[$,\s]/g, '');
    if (s === '') { act(supabase.from('weeks').update({ actual_payout: null }).eq('id', week.id), 'Using the calculated payout.'); return; }
    const n = parseFloat(s);
    if (!(n >= 0)) { toast('Enter the payout as a dollar amount, like 254.10.'); return; }
    act(supabase.from('weeks').update({ actual_payout: Math.round(n * 100) / 100 }).eq('id', week.id), 'Payout saved.');
  }
  return (
    <form className="card stack" onSubmit={save}>
      <div className="field">
        <label htmlFor="ov">Actual payout, if the book paid a different amount</label>
        <div className="ov-row">
          <input id="ov" inputMode="decimal" autoComplete="off" placeholder={projected.toFixed(2)} value={v} onChange={(e) => setV(e.target.value)} />
          <button className="btn small" type="submit">Save payout</button>
        </div>
      </div>
      <p className="hint">Leave blank to use the calculated payout. Odds sometimes move before the bet is placed.</p>
    </form>
  );
}

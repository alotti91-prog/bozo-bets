import { useState } from 'react';
import { weekInfo, amerFmt, fmtOdds, money } from '../lib/odds.js';
import { fmtDate, listNames, toast } from '../lib/ui.js';
import { IconChev, Belt } from '../components/common.jsx';
import Reactions from '../components/Reactions.jsx';
import PastWeekSheet from './PastWeekSheet.jsx';
import { supabase, friendly } from '../lib/supabase.js';
import { nflWeek } from '../lib/nfl.js';

export default function HistoryTab({ data, pname, isAdmin, reload, beltId, nameOfUser, userId }) {
  const [open, setOpen] = useState({});
  const [editing, setEditing] = useState(null); // null, 'new', or a week row
  if (!data.weeks.length) {
    return <section className="card empty"><h2 className="sec-title">History</h2><p className="sub">Past weeks show up here.</p></section>;
  }
  const order = Object.fromEntries(data.players.map((p, i) => [p.id, i]));
  const cur = data.weeks[data.weeks.length - 1];
  const used = new Set(data.weeks.map((w) => w.n));
  let freeCount = 0;
  for (let i = 1; i < cur.n; i++) if (!used.has(i)) freeCount++;
  const now = nflWeek().week;
  const pastMax = data.weeks.length > 1 ? data.weeks[data.weeks.length - 2].n : 0;
  const canCatchUp = cur.n < now && now > pastMax;

  async function catchUp() {
    const { error } = await supabase.rpc('set_week_number', { p_league: data.league.id, p_n: now });
    if (error) { toast(friendly(error)); return; }
    toast(`This week is now Week ${now}. Add earlier weeks below.`);
    reload();
  }

  return (
    <>
      {isAdmin && (freeCount > 0 || canCatchUp) && (
        <section className="card stack">
          <div>
            <h2 className="sec-title-sm">Started late?</h2>
            <p className="sub">
              {canCatchUp ? `It’s NFL Week ${now}, but your league is on Week ${cur.n}. Change it to Week ${now}, then add the weeks before it. ` : ''}
              Past weeks get everyone{'’'}s picks and results, and they count in Standings.
            </p>
          </div>
          <div className="btns">
            {canCatchUp && <button className="btn primary" onClick={catchUp}>Change to Week {now}</button>}
            {freeCount > 0 && <button className={`btn${canCatchUp ? '' : ' primary'}`} onClick={() => setEditing('new')}>Add a past week</button>}
          </div>
        </section>
      )}

      {[...data.weeks].reverse().map((w) => {
        const legs = data.legs.filter((l) => l.week_id === w.id).sort((a, b) => (order[a.player_id] ?? 99) - (order[b.player_id] ?? 99));
        const info = weekInfo(w, legs);
        const spins = data.spins.filter((s) => s.week_id === w.id);
        const losers = [...new Set(info.losers.map((l) => l.player_id))].sort((a, b) => order[a] - order[b]).map(pname);
        const subs = [];
        if (w.payer_id) subs.push(`Put in by ${pname(w.payer_id)}${w.placed_at ? ' ✓' : ''}`);
        if (losers.length) subs.push(`Sunk by ${listNames(losers)}`);
        if (info.status === 'hit') subs.push(`Paid ${money(info.payout)}`);
        if (spins.length) {
          const last = spins[spins.length - 1];
          subs.push(`Wheel → ${pname(last.landed_id)}${spins.length > 1 ? ` (re-spun ${spins.length - 1}×)` : ''}`);
        }
        const isOpen = !!open[w.id];
        const isPast = w.id !== cur.id;
        return (
          <article className="hist" key={w.id}>
            <button className="hist-head" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [w.id]: !isOpen })}>
              <span className="hist-title">Week {w.n} <span>· {fmtDate(w.start_date)}</span></span>
              <span className={`pill pill-${info.status}`}>{{ live: 'Live', hit: 'Hit', busted: 'Busted', empty: 'Open' }[info.status]}</span>
              <IconChev />
            </button>
            <p className="hist-sub">
              {legs.length > 0 && <><span className="hist-odds">{amerFmt(info.d)}</span> · </>}
              {subs.join(' · ') || 'No legs yet'}
            </p>
            {isOpen && (
              <ol className="hist-legs">
                {legs.length ? legs.map((l) => (
                  <li key={l.id} className={l.result ? 'r-' + l.result : ''}>
                    <span className="hl-who">{pname(l.player_id)}<Belt on={beltId === l.player_id} /> · {l.sport}</span>
                    <span className="hl-pick">{l.pick} <Reactions readOnly leg={l} reactions={data.reactions || []} userId={userId} nameOfUser={nameOfUser} reload={reload} /></span>
                    <span className="hl-odds">{fmtOdds(l.odds)}</span>
                    <span className="hl-r">{l.result || '–'}</span>
                  </li>
                )) : <li><span className="hl-pick">No legs</span></li>}
              </ol>
            )}
            {isAdmin && isPast && (
              <div className="hist-actions">
                <button className="link" onClick={() => setEditing(w)}>Edit Week {w.n}</button>
              </div>
            )}
          </article>
        );
      })}

      {editing && (
        <PastWeekSheet data={data} week={editing === 'new' ? null : editing} reload={reload} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

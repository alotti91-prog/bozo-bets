import { useState } from 'react';
import { weekInfo, amerFmt, fmtOdds, money } from '../lib/odds.js';
import { fmtDate, listNames } from '../lib/ui.js';
import { IconChev } from '../components/common.jsx';

export default function HistoryTab({ data, pname }) {
  const [open, setOpen] = useState({});
  if (!data.weeks.length) {
    return <section className="card empty"><h2 className="sec-title">History</h2><p className="sub">Past weeks show up here.</p></section>;
  }
  const order = Object.fromEntries(data.players.map((p, i) => [p.id, i]));

  return [...data.weeks].reverse().map((w) => {
    const legs = data.legs.filter((l) => l.week_id === w.id).sort((a, b) => (order[a.player_id] ?? 99) - (order[b.player_id] ?? 99));
    const info = weekInfo(w, legs);
    const spins = data.spins.filter((s) => s.week_id === w.id);
    const losers = [...new Set(info.losers.map((l) => l.player_id))].sort((a, b) => order[a] - order[b]).map(pname);
    const subs = [];
    if (w.payer_id) subs.push(`Put in by ${pname(w.payer_id)}`);
    if (losers.length) subs.push(`Sunk by ${listNames(losers)}`);
    if (info.status === 'hit') subs.push(`Paid ${money(info.payout)}`);
    if (spins.length) {
      const last = spins[spins.length - 1];
      subs.push(`Wheel → ${pname(last.landed_id)}${spins.length > 1 ? ` (re-spun ${spins.length - 1}×)` : ''}`);
    }
    const isOpen = !!open[w.id];
    return (
      <article className="hist" key={w.id}>
        <button className="hist-head" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [w.id]: !isOpen })}>
          <span className="hist-title">Week {w.n} <span>{'·'} {fmtDate(w.start_date)}</span></span>
          <span className={`pill pill-${info.status}`}>{{ live: 'Live', hit: 'Hit', busted: 'Busted', empty: 'Open' }[info.status]}</span>
          <IconChev />
        </button>
        <p className="hist-sub">
          {legs.length > 0 && <><span className="hist-odds">{amerFmt(info.d)}</span> {'·'} </>}
          {subs.join(' · ') || 'No legs yet'}
        </p>
        {isOpen && (
          <ol className="hist-legs">
            {legs.length ? legs.map((l) => (
              <li key={l.id} className={l.result ? 'r-' + l.result : ''}>
                <span className="hl-who">{pname(l.player_id)} {'·'} {l.sport}</span>
                <span className="hl-pick">{l.pick}</span>
                <span className="hl-odds">{fmtOdds(l.odds)}</span>
                <span className="hl-r">{l.result || '–'}</span>
              </li>
            )) : <li><span className="hl-pick">No legs</span></li>}
          </ol>
        )}
      </article>
    );
  });
}

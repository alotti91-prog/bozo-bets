import { useState } from 'react';
import { weekInfo, amerFmt, fmtOdds, money } from '../lib/odds.js';
import { fmtDate, listNames, toast } from '../lib/ui.js';
import { IconChev, IconChevR, IconPlus, Belt, BozoTag } from '../components/common.jsx';
import BozoFace from '../components/BozoFace.jsx';
import { weekRecap } from '../lib/recap.js';
import Reactions from '../components/Reactions.jsx';
import Comments from '../components/Comments.jsx';
import PastWeekSheet from './PastWeekSheet.jsx';
import { supabase, friendly } from '../lib/supabase.js';
import { nflWeek } from '../lib/nfl.js';

const PILL = { live: 'Live', hit: 'Hit', busted: 'Busted', empty: 'Open' };

// History: one row per week (result, who sank it, who the wheel picked).
// Tap a week for its picks and trash talk. Admins add or fix past weeks.
export default function HistoryTab({ data, pname, isAdmin, reload, beltId, bozoId, bozoUser, nameOfUser, userId, openRecap }) {
  const [open, setOpen] = useState({});
  const [editing, setEditing] = useState(null); // null, 'new', or a week row
  if (!data.weeks.length) {
    return <section className="card empty"><h2 className="page-title">History</h2><p className="sub">Past weeks show up here.</p></section>;
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
      <div className="page-head"><h2 className="page-title">History</h2></div>

      {isAdmin && canCatchUp && (
        <div className="banner">
          <p>It{'’'}s NFL Week {now}, but your league is on Week {cur.n}.</p>
          <button type="button" className="btn small primary" onClick={catchUp}>Change to Week {now}</button>
        </div>
      )}

      <ol className="list hist">
        {[...data.weeks].reverse().map((w) => {
          const legs = data.legs.filter((l) => l.week_id === w.id).sort((a, b) => (order[a.player_id] ?? 99) - (order[b.player_id] ?? 99));
          const info = weekInfo(w, legs);
          const spins = data.spins.filter((s) => s.week_id === w.id);
          const last = spins[spins.length - 1];
          const losers = [...new Set(info.losers.map((l) => l.player_id))].sort((a, b) => order[a] - order[b]).map(pname);
          const detail = !legs.length ? 'No legs yet'
            : info.status === 'hit' ? `Paid ${money(info.payout)}`
            : info.status === 'busted' ? `Sunk by ${listNames(losers)}`
            : `${legs.length} leg${legs.length === 1 ? '' : 's'} · ${amerFmt(info.d)}`;
          const isOpen = !!open[w.id];
          const recap = isOpen ? weekRecap(data, w.id) : null; // null while the spin is unwatched
          return (
            <li key={w.id}>
              <button type="button" className="hist-row" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [w.id]: !isOpen })}>
                <span className="hist-main">
                  <span className="hist-title">Week {w.n} <span>· {fmtDate(w.start_date)}</span></span>
                  <span className="hist-sub">{detail}</span>
                  {last && (
                    <span className="hist-sub">Bozo: {last.hidden ? 'watch the spin to find out' : <b className="nose">{pname(last.landed_id)}</b>}
                      {spins.length > 1 ? ` · re-spun ${spins.length - 1}×` : ''}</span>
                  )}
                </span>
                <span className={`status-pill is-${info.status}`}>{PILL[info.status]}</span>
                <IconChev />
              </button>
              {isOpen && (
                <div className="hist-open">
                  {recap && openRecap && (
                    <button type="button" className="recap-strip" onClick={() => openRecap(w.id)}>
                      <span className="recap-strip-faces" aria-hidden="true">
                        {recap.people.slice(0, 6).map((p) => <BozoFace key={p.id} face={p.face} size={26} />)}
                        {recap.people.length > 6 && <span className="recap-more">+{recap.people.length - 6}</span>}
                      </span>
                      <span>See the recap</span>
                      <IconChevR />
                    </button>
                  )}
                  {(w.payer_id || legs.length > 0) && (
                    <p className="hist-meta">
                      {w.payer_id ? `Put in by ${pname(w.payer_id)}${w.placed_at ? ' · placed ✓' : ''}` : ''}
                      {w.payer_id && legs.length ? ' · ' : ''}{legs.length ? `${amerFmt(info.d)} total` : ''}
                    </p>
                  )}
                  <ol className="hist-legs">
                    {legs.length ? legs.map((l) => (
                      <li key={l.id} className={l.result ? 'r-' + l.result : ''}>
                        <span className="hl-who">{pname(l.player_id)}<Belt on={beltId === l.player_id} /><BozoTag on={bozoId === l.player_id} /> · {l.sport}</span>
                        <span className="hl-pick">{l.pick} <Reactions readOnly leg={l} reactions={data.reactions || []} userId={userId} nameOfUser={nameOfUser} reload={reload} /></span>
                        <span className="hl-odds">{fmtOdds(l.odds)}</span>
                        <span className="hl-r">{l.result || '–'}</span>
                        <Comments readOnly leg={l} comments={(data.comments || []).filter((c) => c.leg_id === l.id)} nameOfUser={nameOfUser} bozoUser={bozoUser} />
                      </li>
                    )) : <li><span className="hl-pick">No legs</span></li>}
                  </ol>
                  {isAdmin && w.id !== cur.id && (
                    <button type="button" className="text-btn" onClick={() => setEditing(w)}>Edit Week {w.n}</button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {isAdmin && freeCount > 0 && (
        <button type="button" className="text-btn muted center with-icon" onClick={() => setEditing('new')}><IconPlus />Add a past week</button>
      )}

      {editing && (
        <PastWeekSheet data={data} week={editing === 'new' ? null : editing} reload={reload} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

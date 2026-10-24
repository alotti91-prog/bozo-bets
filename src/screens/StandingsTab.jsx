import { useState } from 'react';
import { standings, hitPct } from '../lib/stats.js';
import { amerFmt, fmtOdds, dollars, signed } from '../lib/odds.js';
import { Belt, BozoTag } from '../components/common.jsx';

// Standings: two headline numbers, a leaderboard (tap a name for more), awards
// you can swipe through, and hit rate by sport.
export default function StandingsTab({ data, me, belt, bozoId }) {
  const [openId, setOpenId] = useState(null);
  const s = standings(data);
  const all = Object.values(s.rows);
  const rows = all.filter((r) => r.n > 0)
    .sort((a, b) => hitPct(b) - hitPct(a) || b.W - a.W || a.L - b.L || a.p.name.localeCompare(b.p.name));
  const noPicks = all.filter((r) => r.p.active && r.n === 0).map((r) => r.p.name);

  if (!rows.length) {
    return (
      <section className="card empty">
        <h2 className="page-title">Standings</h2>
        <p className="sub">Grade a few legs and the board fills in.</p>
      </section>
    );
  }

  const net = s.totalWon - s.totalIn;
  const cls = (n) => (Math.round(n) > 0 ? 'pos' : Math.round(n) < 0 ? 'neg' : '');
  const pct = (r) => (hitPct(r) < 0 ? '—' : Math.round(hitPct(r) * 100) + '%');
  const sharp = rows.filter((r) => r.W + r.L >= 3).sort((a, b) => hitPct(b) - hitPct(a) || b.W - a.W)[0];
  const shot = rows.filter((r) => r.best).sort((a, b) => b.best.odds - a.best.odds)[0];
  const magnet = rows.filter((r) => r.landed > 0).sort((a, b) => b.landed - a.landed)[0];
  const hot = rows.filter((r) => r.streakType === 'W' && r.streak >= 2).sort((a, b) => b.streak - a.streak)[0];
  const cold = rows.filter((r) => r.streakType === 'L' && r.streak >= 2).sort((a, b) => b.streak - a.streak)[0];
  const beltRow = belt && s.rows[belt.id];
  const awards = [
    sharp && ['Sharpest', sharp.p.name, `${sharp.W}–${sharp.L}, ${pct(sharp)}`],
    beltRow && ['Bozo Belt', beltRow.p.name, `${belt.misses} miss${belt.misses > 1 ? 'es' : ''}`],
    shot && ['Longest hit', shot.p.name, `${fmtOdds(shot.best.odds)} · ${shot.best.pick}`],
    magnet && ['Wheel magnet', magnet.p.name, `Landed on ${magnet.landed}×`],
    hot && ['On a heater', hot.p.name, `${hot.streak} straight hits`],
    cold && ['Ice cold', cold.p.name, `${cold.streak} straight misses`],
  ].filter(Boolean);
  const sports = Object.entries(s.sport).filter(([, v]) => v.W + v.L > 0).sort((a, b) => (b[1].W + b[1].L) - (a[1].W + a[1].L));

  return (
    <>
      <div className="page-head"><h2 className="page-title">Standings</h2></div>

      <div className="glance">
        <div className="glance-cell"><span className="glance-label">Parlays hit</span><span className="glance-value">{s.hits} of {s.settled}</span></div>
        <div className="glance-cell"><span className="glance-label">Group net</span><span className={`glance-value ${cls(net)}`}>{signed(net)}</span></div>
      </div>

      <section className="list board" aria-label="Leaderboard">
        <div className="board-head" aria-hidden="true"><span /><span /><span>Record</span><span>Solo $100</span></div>
        <ol>
          {rows.map((r, i) => {
            const open = openId === r.p.id;
            const mynet = r.share - r.paid;
            return (
              <li key={r.p.id} className={r.p.id === me ? 'is-me' : undefined}>
                <button type="button" className="board-row" aria-expanded={open} onClick={() => setOpenId(open ? null : r.p.id)}>
                  <span className="rank">{i + 1}</span>
                  <span className="board-name">
                    {r.p.name}<Belt on={belt?.id === r.p.id} /><BozoTag on={bozoId === r.p.id} />
                    {r.p.id === me && <span className="muted"> · you</span>}
                    {!r.p.active && <span className="muted"> · benched</span>}
                  </span>
                  <span className="board-rec">{r.W}–{r.L}{r.P ? `–${r.P}` : ''}</span>
                  <span className={`board-solo ${cls(r.solo)}`}>{signed(r.solo)}</span>
                </button>
                {open && (
                  <dl className="board-more">
                    <div><dt>Hit rate</dt><dd>{pct(r)}</dd></div>
                    <div><dt>Avg odds</dt><dd>{r.nOdds ? amerFmt(r.decSum / r.nOdds) : '—'}</dd></div>
                    <div><dt>Put in</dt><dd>{dollars(r.paid)}</dd></div>
                    <div><dt>Net</dt><dd className={cls(mynet)}>{signed(mynet)}</dd></div>
                    <div><dt>Wheel landed</dt><dd>{r.landed}×</dd></div>
                  </dl>
                )}
              </li>
            );
          })}
        </ol>
        {noPicks.length > 0 && <p className="board-foot">No picks yet: {noPicks.join(', ')}</p>}
      </section>
      <p className="fine">Solo $100 is what you{'’'}d be up or down betting $100 on just your own leg each week. Tap a name for more.</p>

      {awards.length > 0 && (
        <section className="group">
          <h3 className="group-title">Bragging rights</h3>
          <div className="awards" data-noswipe="">
            {awards.map(([label, who, detail]) => (
              <div className="award" key={label}>
                <span className="award-label">{label}{label === 'Bozo Belt' && <Belt on size={16} />}</span>
                <b>{who}</b>
                <span className="award-detail">{detail}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {sports.length > 0 && (
        <section className="group">
          <h3 className="group-title">Hit rate by sport</h3>
          <div className="card sports">
            {sports.map(([name, v]) => {
              const p = (v.W / (v.W + v.L)) * 100;
              return (
                <div className="sport-row" key={name}>
                  <span className="sp-name">{name}</span>
                  <span className="bar" role="img" aria-label={`${name} hit rate ${Math.round(p)} percent, ${v.W} and ${v.L}`}>
                    <span style={{ width: p.toFixed(1) + '%' }} />
                    <i style={{ left: 'calc(52.4% - 1px)' }} />
                  </span>
                  <span className="sp-rec"><b>{Math.round(p)}%</b> {v.W}–{v.L}</span>
                </div>
              );
            })}
            <p className="fine">Red line: 52.4%, the break-even rate on {'−'}110 bets.</p>
          </div>
        </section>
      )}
    </>
  );
}

import { standings, hitPct } from '../lib/stats.js';
import { amerFmt, fmtOdds, dollars, signed } from '../lib/odds.js';

export default function StandingsTab({ data, me }) {
  const s = standings(data);
  const rows = Object.values(s.rows).filter((r) => r.p.active || r.n > 0)
    .sort((a, b) => hitPct(b) - hitPct(a) || b.W - a.W || a.L - b.L || a.p.name.localeCompare(b.p.name));

  if (!rows.length) {
    return <section className="card empty"><h2 className="sec-title">Standings</h2><p className="sub">Grade a few legs and the board fills in.</p></section>;
  }

  const net = s.totalWon - s.totalIn;
  const cls = (n) => (Math.round(n) > 0 ? 'pos' : Math.round(n) < 0 ? 'neg' : '');
  const sharp = rows.filter((r) => r.W + r.L >= 3).sort((a, b) => hitPct(b) - hitPct(a) || b.W - a.W)[0];
  const bozo = rows.filter((r) => r.L > 0).sort((a, b) => b.L - a.L || hitPct(a) - hitPct(b))[0];
  const shot = rows.filter((r) => r.best).sort((a, b) => b.best.odds - a.best.odds)[0];
  const magnet = rows.filter((r) => r.landed > 0).sort((a, b) => b.landed - a.landed)[0];
  const hot = rows.filter((r) => r.streakType === 'W' && r.streak >= 2).sort((a, b) => b.streak - a.streak)[0];
  const cold = rows.filter((r) => r.streakType === 'L' && r.streak >= 2).sort((a, b) => b.streak - a.streak)[0];
  const sports = Object.entries(s.sport).filter(([, v]) => v.W + v.L > 0).sort((a, b) => (b[1].W + b[1].L) - (a[1].W + a[1].L));

  return (
    <>
      <div className="summary">
        <div><span className="label-sm">Parlays hit</span><b>{s.hits}<span className="sub"> / {s.settled}</span></b></div>
        <div><span className="label-sm">Put in</span><b>{dollars(s.totalIn)}</b></div>
        <div><span className="label-sm">Won back</span><b>{dollars(s.totalWon)}</b></div>
        <div><span className="label-sm">Group net</span><b className={cls(net)}>{signed(net)}</b></div>
      </div>

      <section className="card">
        <h2 className="sec-title">Standings</h2>
        <div className="table-scroll">
          <table>
            <thead><tr><th scope="col">Player</th><th scope="col">W-L-P</th><th scope="col">Hit</th><th scope="col">Avg odds</th><th scope="col">Paid</th><th scope="col">Net</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const h = hitPct(r);
                const mynet = r.share - r.paid;
                return (
                  <tr key={r.p.id}>
                    <td>{r.p.name}{r.p.id === me ? ' (you)' : ''}{!r.p.active && <span className="benched"> benched</span>}</td>
                    <td>{r.W}-{r.L}-{r.P}</td>
                    <td>{h < 0 ? '—' : Math.round(h * 100) + '%'}</td>
                    <td>{r.n ? amerFmt(r.decSum / r.n) : '—'}</td>
                    <td>{dollars(r.paid)}</td>
                    <td className={cls(mynet)}>{signed(mynet)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="fine" style={{ marginTop: 10 }}>Money counts settled weeks only. Net is your share of payouts minus what you put in.</p>
        <div className="supers">
          <Sup label="Sharpest" who={sharp?.p.name} detail={sharp && `${sharp.W}-${sharp.L}, ${Math.round(hitPct(sharp) * 100)}% (3+ legs)`} />
          <Sup label="Head bozo" who={bozo?.p.name} detail={bozo && `${bozo.L} miss${bozo.L > 1 ? 'es' : ''}`} />
          <Sup label="Longest shot hit" who={shot?.p.name} detail={shot && `${fmtOdds(shot.best.odds)} · ${shot.best.pick} (Wk ${shot.best.n})`} />
          <Sup label="Wheel magnet" who={magnet?.p.name} detail={magnet && `Landed on ${magnet.landed}×`} />
          <Sup label="On a heater" who={hot?.p.name} detail={hot && `${hot.streak} straight hits`} none="Nobody right now" />
          <Sup label="Ice cold" who={cold?.p.name} detail={cold && `${cold.streak} straight misses`} none="Nobody right now" />
        </div>
      </section>

      {sports.length > 0 && (
        <section className="card">
          <h3 className="sec-title-sm">Hit rate by sport</h3>
          <div style={{ marginTop: 8 }}>
            {sports.map(([name, v]) => {
              const pct = (v.W / (v.W + v.L)) * 100;
              return (
                <div className="sport-row" key={name}>
                  <span className="sp-name">{name}</span>
                  <div className="bar" role="img" aria-label={`${name} hit rate ${Math.round(pct)} percent`}>
                    <span style={{ width: pct.toFixed(1) + '%' }} />
                    <i style={{ left: 'calc(52.4% - 1px)' }} />
                  </div>
                  <span className="sp-rec"><b>{Math.round(pct)}%</b> {v.W}-{v.L}</span>
                </div>
              );
            })}
          </div>
          <p className="fine" style={{ marginTop: 8 }}>The red line marks 52.4%, the hit rate you need to break even on {'−'}110 bets.</p>
        </section>
      )}
    </>
  );
}

function Sup({ label, who, detail, none }) {
  return (
    <div>
      <span className="label-sm">{label}</span>
      <strong>{who || none || '—'}</strong>
      <span className="d">{detail || (none ? '2+ in a row qualifies' : 'Not enough data yet')}</span>
    </div>
  );
}

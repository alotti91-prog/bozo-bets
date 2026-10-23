import { Sheet, IconShare } from '../components/common.jsx';
import BozoFace from '../components/BozoFace.jsx';
import { FACES, personLine, recapText } from '../lib/recap.js';
import { money, dollars, fmtOdds } from '../lib/odds.js';
import { shareText } from '../lib/ui.js';

/**
 * The weekly recap (r from weekRecap): who the wheel picked, then everyone's
 * face for the week. Opens a beat after you first watch a spin, live or as a
 * replay. History and the Wheel tab open it again.
 */
export default function RecapSheet({ recap: r, pname, leagueName, onClose }) {
  const hit = r.info.status === 'hit';
  return (
    <Sheet kicker={`Week ${r.week.n}`} title="The recap" onClose={onClose}>
      {hit ? (
        <div className="recap-hero is-hit">
          <span className="recap-faces" aria-hidden="true">
            {r.people.slice(0, 6).map((p) => <BozoFace key={p.id} face={p.face} size={44} />)}
          </span>
          <span className="recap-big">It hit.</span>
          <span className="recap-tag is-win">{dollars(r.info.stake)} paid {money(r.info.payout)} · {money(r.each)} each</span>
          {r.bozo && <span className="recap-sub">{pname(r.bozo)} puts in Week {r.nextN}{'’'}s {dollars(r.stake)}</span>}
        </div>
      ) : r.bozo ? (
        <div className="recap-hero">
          <BozoFace face="full" size={96} label="Full bozo" />
          <span className="recap-big">{pname(r.bozo)}</span>
          <span className="recap-tag is-loss">Full bozo · picked by the wheel</span>
          <span className="recap-sub">Puts in Week {r.nextN}{'’'}s {dollars(r.stake)}</span>
        </div>
      ) : (
        <div className="recap-hero">
          <BozoFace face="makeup" size={96} />
          <span className="recap-big">Busted</span>
          <span className="recap-sub">The wheel hasn{'’'}t been spun yet.</span>
        </div>
      )}

      {!hit && (
        <div className="glance">
          <div className="glance-cell"><span className="glance-label">Legs that hit</span><span className="glance-value">{r.hits} of {r.total}</span></div>
          <div className="glance-cell"><span className="glance-label">Would{'’'}ve paid</span><span className="glance-value">{money(r.info.projected)}</span></div>
        </div>
      )}

      <section aria-labelledby="recap-people">
        <h3 className="group-label" id="recap-people">How everyone did</h3>
        <ol className="rows recap-list">
          {r.people.map((p) => (
            <li key={p.id} className="row">
              <BozoFace face={p.face} size={40} />
              <span className="row-label">
                <span><b>{pname(p.id)}</b>{p.face !== 'clean' && <> · <b className={`face-${p.face}`}>{FACES[p.face]}</b></>}</span>
                <span className="row-note">{personLine(p)}</span>
              </span>
              {p.legs.length === 1 && <span className="row-value">{fmtOdds(p.legs[0].odds)}</span>}
            </li>
          ))}
        </ol>
      </section>

      <div className="btn-pair">
        <button type="button" className="btn" onClick={() => shareText(recapText(r, pname, leagueName), { title: `Week ${r.week.n} recap` })}>
          <IconShare />Share recap
        </button>
        <button type="button" className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}

/**
 * First time you open the app after a spin you haven't seen: offer to watch it.
 * The result stays hidden either way until you do.
 */
export function WatchPrompt({ weekN, nextN, stake, onWatch, onLater }) {
  return (
    <Sheet kicker={`Week ${weekN}`} title={'The wheel’s been spun'} onClose={onLater}>
      <p className="sheet-lede">Watch it to see who puts in {dollars(stake)} for Week {nextN}, then how everyone did.</p>
      <div className="btn-pair">
        <button type="button" className="btn" onClick={onLater}>Later</button>
        <button type="button" className="btn nose" onClick={onWatch}>Watch</button>
      </div>
    </Sheet>
  );
}

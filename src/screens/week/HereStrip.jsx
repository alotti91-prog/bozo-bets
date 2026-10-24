import { useState } from 'react';
import { Sheet, IconChevR } from '../../components/common.jsx';
import { initials } from '../../lib/ui.js';
import { hereLine, WHERE } from '../../lib/presence.js';

/** Initials with a green "here now" dot. */
export function HereAv({ name, here = true }) {
  return <span className={`here-av${here ? ' is-here' : ''}`} aria-hidden="true">{initials(name)}</span>;
}

/**
 * Who's here, above the slip: everyone with the app open right now, with a
 * green dot ("4 sweating the slip" while games are on). Hidden when you're the
 * only one. Tap it for who's where (HereSheet).
 *   here  herePeople() list   live  games on right now
 */
export default function HereStrip({ here, me, pname, players, live, weekN }) {
  const [open, setOpen] = useState(false);
  const line = hereLine(here, me, pname, live);
  if (!line) return null;
  return (
    <>
      <button type="button" className="here-strip" onClick={() => setOpen(true)}>
        <span className="here-stack">{here.slice(0, 5).map((p) => <HereAv key={p.id} name={pname(p.id)} />)}</span>
        <span className="here-text"><b>{line.head}</b><span>{line.sub}</span></span>
        <IconChevR />
      </button>
      {open && <HereSheet here={here} me={me} pname={pname} players={players} weekN={weekN} live={live} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Who's on the app and where, then everyone who isn't. */
function HereSheet({ here, me, pname, players, weekN, live, onClose }) {
  const ids = new Set(here.map((p) => p.id));
  const away = players.filter((p) => p.active && !ids.has(p.id));
  return (
    <Sheet kicker={`Week ${weekN}${live ? ' · games are on' : ''}`} title="Here now" onClose={onClose}>
      <section className="stack" aria-labelledby="here-on">
        <h3 className="group-label" id="here-on">On the app · {here.length}</h3>
        <ul className="rows here-list">
          {here.map((p) => (
            <li key={p.id} className="row">
              <HereAv name={pname(p.id)} />
              <span className="row-label"><span><b>{pname(p.id)}</b>{p.id === me && <span className="muted"> · you</span>}</span></span>
              <span className="row-value muted">{WHERE[p.tab]}</span>
            </li>
          ))}
        </ul>
      </section>
      {away.length > 0 && (
        <section className="stack" aria-labelledby="here-off">
          <h3 className="group-label" id="here-off">Not on right now</h3>
          <ul className="rows here-list">
            {away.map((p) => (
              <li key={p.id} className="row is-away">
                <HereAv name={p.name} here={false} />
                <span className="row-label muted">{p.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="fine">Shows who has the app open right now.</p>
    </Sheet>
  );
}

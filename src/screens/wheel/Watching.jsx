import { useEffect, useRef, useState } from 'react';
import { arrivals } from '../../lib/presence.js';
import { HereAv } from '../week/HereStrip.jsx';

/**
 * Who else is on the Wheel tab right now: "5 watching live" while a spin plays,
 * "3 on the wheel" otherwise, and a note for a few seconds when someone new
 * shows up. Hidden when you're the only one here.
 *   here  herePeople() list   spinning  a spin is playing on this phone
 */
export default function Watching({ here, me, pname, spinning }) {
  const on = here.filter((p) => p.tab === 'wheel');
  const ids = on.map((p) => p.id).join();
  const [joined, setJoined] = useState(null);
  const before = useRef(null);
  useEffect(() => {
    const came = before.current ? arrivals(before.current, here, 'wheel', me) : [];
    before.current = on.map((p) => p.id);
    if (came.length) setJoined(came[came.length - 1]);
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!joined) return undefined;
    const t = setTimeout(() => setJoined(null), 4000);
    return () => clearTimeout(t);
  }, [joined]);

  if (!on.some((p) => p.id !== me)) return null;
  return (
    <div className="watching" role="status">
      <span className="watching-chip">
        <span className="here-stack">{on.slice(0, 5).map((p) => <HereAv key={p.id} name={pname(p.id)} />)}</span>
        <b><span className="live-dot" aria-hidden="true" />{on.length} {spinning ? 'watching live' : 'on the wheel'}</b>
      </span>
      {joined && <span className="watching-joined"><b>{pname(joined)}</b> {spinning ? 'just started watching' : 'just opened the wheel'}</span>}
    </div>
  );
}

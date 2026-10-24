import { useEffect, useRef, useState } from 'react';
import { legOutcome, carrier, sweatEvents, sweatMessage } from '../../lib/sweat.js';
import { audioInit, honk, ding, toast } from '../../lib/ui.js';
import { confetti, buzz, lessMotion } from '../../lib/fx.js';

/**
 * Sunday sweat mode for the slip. While it's on screen: a leg that busts gets
 * the clown horn, a buzz, and a shake; one that cashes gets a ding and
 * confetti; the slip hitting gets the big shower. Only news that happens while
 * you watch: opening the app takes stock silently. Sounds follow the Wheel
 * tab's sound switch and start after your first tap (browsers require one).
 * Returns { shaking: Set of leg ids shaking right now, carry: the leg carrying the slip or null }.
 */
export default function useSweat(legs, statusOf, pname) {
  const seen = useRef(null);
  const [shaking, setShaking] = useState(() => new Set());
  const outcomeOf = (l) => legOutcome(l, statusOf(l));
  // A fingerprint of every leg's outcome, so the effect runs only when one changes.
  const key = legs.map((l) => `${l.id}:${outcomeOf(l) || ''}:${l.result || statusOf(l) ? 1 : 0}`).join('|');

  useEffect(() => {
    const unlock = () => audioInit();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    const { seen: next, events, slip } = sweatEvents(seen.current, legs, outcomeOf, (l) => !l.bet?.game || !!l.result || statusOf(l) != null);
    seen.current = next;
    if (!events.length) return;
    const lost = events.filter((e) => e.outcome === 'lost');
    if (lost.length) { honk(); buzz(220); } else if (events.some((e) => e.outcome === 'won')) ding();
    if (slip === 'won') confetti(true);
    else if (!lost.length && events.some((e) => e.outcome === 'won')) confetti(false);
    toast(sweatMessage(events, slip, pname));
    if (lost.length && !lessMotion()) setShaking(new Set(lost.map((e) => e.leg.id)));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // A shake lasts just under a second.
  useEffect(() => {
    if (!shaking.size) return undefined;
    const t = setTimeout(() => setShaking(new Set()), 900);
    return () => clearTimeout(t);
  }, [shaking]);

  return { shaking, carry: carrier(legs, outcomeOf) };
}

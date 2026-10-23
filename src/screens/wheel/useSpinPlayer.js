import { useEffect, useRef, useState } from 'react';
import { spinRounds, isElimination, SPIN_MS } from '../../lib/wheel.js';
import { honk } from '../../lib/ui.js';

/**
 * Plays a spin on the wheel: one spin per knocked-out name ("X is safe"), then
 * the bozo. Old spins play as one spin onto the bozo. Returns the spin being
 * played (active), the one just revealed, an older spin left on screen after a
 * replay (focus), and play/skip.
 *   latestId   the spin that decided this week (replaying it counts as watching)
 *   seenSpins  live spins already played on this phone, so each plays once
 */
export function useSpinPlayer({ wheelRef, pname, weekN, latestId, seenSpins, markWatched, reload }) {
  const animating = useRef(false);
  const alive = useRef(true); // false once this tab is closed, so a half-played spin doesn't count as watched
  const skipping = useRef(false);
  const wake = useRef(null); // ends the "X is safe" pause early on Skip
  // spin being played: { ...spin, weekN, replay, round, rounds, names (on the wheel now), safe (just knocked out), gone (safe so far) }
  const [active, setActive] = useState(null);
  const [revealed, setRevealed] = useState(null);
  const [focus, setFocus] = useState(null); // an older spin left on screen after replaying it
  useEffect(() => {
    alive.current = true;
    const wheel = wheelRef.current;
    return () => { alive.current = false; wheel?.stop(); wake.current?.(); };
  }, [wheelRef]);

  const pause = (ms) => new Promise((done) => {
    const t = setTimeout(done, ms);
    wake.current = () => { clearTimeout(t); done(); };
  });

  function skip() {
    skipping.current = true;
    wheelRef.current?.stop();
    wake.current?.();
  }

  async function play(spin, replay = false) {
    if (!wheelRef.current || animating.current) return;
    animating.current = true;
    skipping.current = false;
    if (!replay) seenSpins?.add(spin.id);
    const isLatest = spin.id === latestId;
    // Phones and browsers pause animations on hidden pages, then jump to the end
    // when you come back. That isn't watching, so it doesn't count.
    let missed = document.visibilityState !== 'visible';
    const onVis = () => { if (document.visibilityState !== 'visible') missed = true; };
    document.addEventListener('visibilitychange', onVis);
    setFocus(null);
    setRevealed(null);
    const rounds = spinRounds(spin);
    const base = { ...spin, weekN: weekN(spin.week_id), replay, rounds: rounds.length };
    const gone = [];
    for (let i = 0; i < rounds.length && alive.current && !skipping.current; i++) {
      const r = rounds[i];
      setActive({ ...base, round: i + 1, names: r.names, safe: null, gone: [...gone] });
      // Old spins land on the bozo itself and rest there (key = spin id). Knock-out
      // rounds get their own key so the wheel resets to the result afterwards.
      await wheelRef.current?.spinTo(r.names.map(pname), r.names.indexOf(r.at), r.bozo ? spin.id : `${spin.id}:${i}`,
        { quick: r.quick, sound: r.bozo ? 'honk' : 'ding' });
      if (r.bozo || !alive.current || skipping.current) continue;
      gone.push(r.at);
      setActive({ ...base, round: i + 1, names: r.names, safe: r.at, gone: [...gone] });
      await pause(SPIN_MS.pause);
    }
    document.removeEventListener('visibilitychange', onVis);
    animating.current = false;
    wake.current = null;
    if (!alive.current) return; // left the Wheel tab partway: not watched, it stays hidden
    if (isElimination(spin) && !skipping.current) honk(); // the last name left
    setActive(null);
    setRevealed(spin.id);
    if (!missed && (!replay || isLatest)) markWatched?.(spin.id);
    if (!replay) reload();
    else if (!isLatest) setFocus(spin);
  }

  return { active, revealed, focus, setFocus, play, skip };
}

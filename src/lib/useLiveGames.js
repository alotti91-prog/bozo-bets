import { useEffect, useRef, useState } from 'react';
import { getGame } from './scores.js';
import { gameKey } from './bets.js';

/**
 * Keeps the games behind this week's structured legs up to date. Checks every
 * 30 seconds while the app is on screen, only for games that are on or about
 * to start. Finished games are fetched once and left alone.
 * Returns [games, updatedAt]: games is { "nfl:401873010": game }; updatedAt is when scores last came in (ms) or null.
 */
export function useLiveGames(legs) {
  const [games, setGames] = useState({});
  const [updatedAt, setUpdatedAt] = useState(null);
  const latest = useRef(games);
  useEffect(() => { latest.current = games; }, [games]);
  const wanted = [];
  const seen = new Set();
  for (const l of legs) {
    if (!l.bet?.game?.id) continue;
    const key = gameKey(l.bet);
    if (seen.has(key)) continue;
    seen.add(key);
    wanted.push({ key, sport: l.bet.sport, id: l.bet.game.id, start: l.bet.game.start });
  }
  const sig = wanted.map((w) => w.key).sort().join(',');

  useEffect(() => {
    if (!wanted.length) return undefined;
    let stop = false;
    let timer;
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const due = wanted.filter((w) => {
          const g = latest.current[w.key];
          if (!g) return true;
          if (g.state === 'post') return false;
          if (g.state === 'pre') return !w.start || new Date(w.start).getTime() - now < 15 * 60e3;
          return true;
        });
        const got = await Promise.all(due.map((w) => getGame(w.sport, w.id).then((g) => [w.key, g]).catch(() => null)));
        const fresh = Object.fromEntries(got.filter(Boolean));
        if (!stop && Object.keys(fresh).length) { setGames((prev) => ({ ...prev, ...fresh })); setUpdatedAt(Date.now()); }
      }
      if (!stop) timer = setTimeout(tick, 30000);
    };
    tick();
    const onShow = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); tick(); } };
    document.addEventListener('visibilitychange', onShow);
    return () => { stop = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onShow); };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  return [games, updatedAt];
}

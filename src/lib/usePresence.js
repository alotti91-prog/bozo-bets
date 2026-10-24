import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.js';

/**
 * Joins the league's presence channel and says who's here (Supabase Realtime
 * Presence: nothing is saved, it only knows who has the app open right now).
 * While this app is on screen and you've claimed a player, it shares
 * { p: your player id, t: the tab you're on, at: when }; it stops when the app
 * goes to the background. Returns the raw presence state; herePeople() in
 * presence.js turns it into a list.
 */
export function usePresence(leagueId, playerId, tab) {
  const [state, setState] = useState({});
  const ch = useRef(null);
  const ready = useRef(false);
  const mine = useRef({ p: playerId, t: tab });

  const share = () => {
    const c = ch.current;
    if (!c || !ready.current) return;
    if (mine.current.p && document.visibilityState === 'visible') c.track({ ...mine.current, at: Date.now() })?.catch?.(() => {});
    else c.untrack?.()?.catch?.(() => {});
  };

  useEffect(() => {
    if (!leagueId || !supabase?.channel) return undefined;
    const key = Math.random().toString(36).slice(2, 10); // one per open app, so two phones don't collide
    const c = supabase.channel(`presence-${leagueId}`, { config: { presence: { key } } });
    ch.current = c;
    c.on('presence', { event: 'sync' }, () => setState({ ...c.presenceState() }));
    c.subscribe((status) => { if (status === 'SUBSCRIBED') { ready.current = true; share(); } });
    document.addEventListener('visibilitychange', share);
    return () => {
      document.removeEventListener('visibilitychange', share);
      ready.current = false;
      ch.current = null;
      c.untrack?.()?.catch?.(() => {});
      supabase.removeChannel(c);
    };
  }, [leagueId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Changing tabs (or claiming a player) updates what you share.
  useEffect(() => {
    mine.current = { p: playerId, t: tab };
    share();
  }, [playerId, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

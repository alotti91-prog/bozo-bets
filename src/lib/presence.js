// Who's here: people with the app open right now, from Supabase Realtime
// Presence (see usePresence.js). Each open app shares only { p: player id,
// t: tab, at: time }: no names, so the channel says nothing to anyone outside
// the league. Pure functions, covered by sweat.test.js.
import { listNames } from './ui.js';

export const WHERE = { week: 'On the slip', wheel: 'On the wheel', standings: 'On Standings', history: 'In History' };

/**
 * The raw presence state ({ key: [{ p, t, at }, …] }, one key per open app) →
 * the people here, one entry per player (their most recent app wins), in player
 * order: [{ id, tab, at }]. Unknown players (or apps with no player) are left out.
 */
export function herePeople(state, players) {
  const order = new Map(players.map((p, i) => [p.id, i]));
  const best = new Map();
  for (const metas of Object.values(state || {})) {
    for (const m of metas || []) {
      if (!m?.p || !order.has(m.p)) continue;
      const cur = best.get(m.p);
      if (!cur || (m.at || 0) > cur.at) best.set(m.p, { id: m.p, tab: WHERE[m.t] ? m.t : 'week', at: m.at || 0 });
    }
  }
  return [...best.values()].sort((a, b) => order.get(a.id) - order.get(b.id));
}

/**
 * The line above the slip, or null when you're the only one here:
 * { head: '4 sweating the slip' (games on) | '3 here now', sub: 'Sully & Mikey are here' }.
 */
export function hereLine(people, me, pname, live = false) {
  const others = people.filter((p) => p.id !== me);
  if (!others.length) return null;
  const n = people.length;
  return {
    head: live ? `${n} sweating the slip` : `${n} here now`,
    sub: `${listNames(others.map((p) => pname(p.id)))} ${others.length === 1 ? 'is' : 'are'} here`,
  };
}

/** Who just showed up on a tab since last time (ids), not counting you. */
export function arrivals(before, people, tab, me) {
  const was = new Set(before);
  return people.filter((p) => p.tab === tab && p.id !== me && !was.has(p.id)).map((p) => p.id);
}

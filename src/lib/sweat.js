// Sunday sweat mode: notice when a leg cashes or busts while the slip is on
// screen, and who's carrying the slip when it comes down to one leg. Pure
// functions, covered by sweat.test.js; the sounds and confetti are in
// screens/week/useSweat.js.

/**
 * How a leg ended up, once it's decided: 'won' | 'lost' | 'push', or null while
 * it's still in play. The commish's grade counts first; otherwise the live
 * feed, when the game is final or the leg is already decided (an over that's
 * hit, an under that's gone over, an anytime TD that's scored).
 *   st  live status from liveStatus(), or null
 */
export function legOutcome(leg, st) {
  if (leg.result === 'W') return 'won';
  if (leg.result === 'L') return 'lost';
  if (leg.result === 'P') return 'push';
  if (!st || !(st.done || st.locked)) return null;
  return { win: 'won', loss: 'lost', push: 'push' }[st.tone] || null;
}

/**
 * Who's carrying the slip: when nothing has busted and every leg but one is
 * decided, that last leg. Needs at least two legs (one leg is just a bet).
 *   outcomeOf(leg) → legOutcome
 */
export function carrier(legs, outcomeOf) {
  if (legs.length < 2) return null;
  const outs = legs.map(outcomeOf);
  if (outs.includes('lost')) return null;
  const open = legs.filter((_, i) => outs[i] == null);
  return open.length === 1 ? open[0] : null;
}

/** The whole slip: 'won' when every leg is decided, none lost, and at least one won; 'lost' once any leg busts; else null. */
export function slipOutcome(legs, outcomeOf) {
  if (!legs.length) return null;
  const outs = legs.map(outcomeOf);
  if (outs.includes('lost')) return 'lost';
  return outs.every(Boolean) && outs.includes('won') ? 'won' : null;
}

/**
 * What just happened since last time. seen: { [legId]: last decided outcome or
 * null } from the previous call, or null the first time (which only takes
 * stock, so opening the app never replays old news). A leg's outcome flickering
 * to "unknown" (the feed blinking) doesn't count as a change.
 * Returns { seen, events: [{ leg, outcome }], slip: 'won' | null (the slip just hit) }.
 */
export function sweatEvents(seen, legs, outcomeOf) {
  const next = {};
  const events = [];
  for (const l of legs) {
    const o = outcomeOf(l);
    const before = seen ? seen[l.id] : undefined;
    next[l.id] = o ?? before ?? null;
    if (seen && l.id in seen && o && o !== before) events.push({ leg: l, outcome: o });
  }
  const wasWon = seen ? slipOutcome(legs.filter((l) => l.id in seen), (l) => seen[l.id]) === 'won' : true;
  const slip = !wasWon && events.length && slipOutcome(legs, outcomeOf) === 'won' ? 'won' : null;
  return { seen: next, events, slip };
}

/** One line for what just happened, for a toast. names(playerId) → name. */
export function sweatMessage(events, slip, names) {
  if (slip === 'won') return '🎉 The slip hit!';
  if (!events.length) return '';
  if (events.length > 1) {
    const n = (o) => events.filter((e) => e.outcome === o).length;
    const parts = [[n('won'), 'hit'], [n('lost'), 'busted'], [n('push'), 'pushed']].filter(([c]) => c).map(([c, w]) => `${c} ${w}`);
    return `${n('lost') ? '🤡' : '✅'} ${events.length} legs just settled: ${parts.join(', ')}`;
  }
  const { leg, outcome } = events[0];
  const who = names(leg.player_id);
  if (outcome === 'lost') return `🤡 ${who}’s leg busted: ${leg.pick}`;
  if (outcome === 'won') return `✅ ${who}’s leg hit: ${leg.pick}`;
  return `${who}’s leg pushed: ${leg.pick}`;
}

import { createClient } from '@supabase/supabase-js';
import { demoClient } from './demo-supabase.js';

const url = import.meta.env.VITE_SUPABASE_URL;
// New Supabase projects give you a "publishable" key (sb_publishable_...).
// Older projects call it the "anon" key. Either works here.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// `npm run demo` sets VITE_DEMO=1 and swaps in sample data with no backend.
// In a normal build this is false at compile time and the demo code is dropped.
export const demo = import.meta.env.VITE_DEMO === '1';
export const configured = demo || Boolean(url && key);
export const supabase = demo ? demoClient : configured ? createClient(url, key) : null;

/** Turn a Supabase error into a sentence a person can act on. */
export function friendly(error) {
  if (!error) return '';
  const m = error.message || String(error);
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Can’t reach the server. Check your connection and try again.';
  if (/duplicate key.*legs_week_id_player_id/i.test(m)) return 'That player already has a leg this week.';
  if (/duplicate key.*players_league_id_name/i.test(m)) return 'There’s already a player with that name.';
  if (/row-level security/i.test(m)) return 'You don’t have permission to do that.';
  if (error.code === 'PGRST202' || /Could not find the function/i.test(m)) return 'This needs a database update. Run the latest schema.sql in the Supabase SQL Editor, then try again.';
  return m;
}

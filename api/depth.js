// Vercel serverless function: GET /api/depth
// NFL depth charts and injuries for the player prop picker, from Sleeper's free
// public API (no key). Sleeper's list is ~5MB and they ask for it once a day at
// most, so this trims it to { espnId: { o, s } } and Vercel's CDN keeps it a day.
import { SLEEPER_PLAYERS, normalizeDepth } from '../src/lib/depth.js';

export default async function handler(req, res) {
  let json = null;
  try {
    const r = await fetch(SLEEPER_PLAYERS, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    if (r.ok) json = await r.json();
  } catch { /* handled below */ }
  const players = normalizeDepth(json);
  if (!Object.keys(players).length) {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
    return res.status(502).json({ error: 'Couldn’t get depth charts from Sleeper.' });
  }
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
  return res.status(200).json({ at: new Date().toISOString(), players });
}

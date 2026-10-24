// Vercel serverless function: GET /api/props?home=CHI&away=NE&start=2026-10-26T00:00Z
// DraftKings player prop lines for one NFL game, from SportsGameOdds. The key
// lives only here, as the Vercel environment variable SPORTSGAMEODDS_KEY (never
// VITE_..., which would ship it to every browser). The free plan allows 2,500
// games a month, so each game's lines are cached for 30 minutes.
import { parsePropsQuery, propsUrl, findEvent, normalizeProps } from '../src/lib/props.js';

async function sgo(url, key) {
  const r = await fetch(url, { headers: { 'x-api-key': key, accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (r.status === 401 || r.status === 403) throw new Error(`SportsGameOdds didn’t accept the key (${r.status}). Check SPORTSGAMEODDS_KEY in Vercel, then redeploy`);
  if (!r.ok) throw new Error(`SportsGameOdds answered ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  const q = parsePropsQuery(req.query);
  if (q.error) return res.status(400).json({ error: q.error });
  const key = (process.env.SPORTSGAMEODDS_KEY || '').trim(); // a pasted key often carries a space or line break
  if (!key) {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
    return res.status(503).json({ error: 'Prop lines aren’t set up yet.' });
  }
  try {
    // By team id first (one game, the cheapest). If that finds nothing, every game kicking off around then.
    let via = 'team';
    let event = findEvent(await sgo(propsUrl(q, 'team'), key), q);
    if (!event) { via = 'window'; event = findEvent(await sgo(propsUrl(q, 'window'), key), q); }
    const lines = event ? normalizeProps(event) : {};
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=600');
    return res.status(200).json({ at: new Date().toISOString(), via: event ? via : null, players: Object.keys(lines).length, lines });
  } catch (e) {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
    return res.status(502).json({ error: `Couldn’t get prop lines (${e.message || 'no answer'}).` });
  }
}

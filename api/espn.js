// Vercel serverless function: GET /api/espn?kind=scoreboard|summary|roster&sport=nfl&...
// Fetches ESPN's public scores feed, trims it to what the app needs, and lets
// Vercel's CDN cache it, so ESPN sees a few requests a minute no matter how
// many phones are watching. Only the requests espnUrl() allows get through.
import { espnUrl, normalizeScoreboard, normalizeSummary, normalizeRoster } from '../src/lib/espn.js';

export default async function handler(req, res) {
  const q = req.query || {};
  const url = espnUrl(q);
  if (!url) return res.status(400).json({ error: 'That request isn’t supported.' });
  let json;
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(502).json({ error: `ESPN returned ${r.status}.` });
    json = await r.json();
  } catch {
    return res.status(502).json({ error: 'Couldn’t reach ESPN.' });
  }
  let body;
  let ttl;
  if (q.kind === 'scoreboard') {
    const games = normalizeScoreboard(json, q.sport);
    body = { games };
    ttl = games.some((g) => g.state === 'in') ? 20 : 300;
  } else if (q.kind === 'summary') {
    body = normalizeSummary(json, q.sport, q.event);
    ttl = body.state === 'in' ? 20 : body.state === 'post' ? 3600 : 120;
  } else {
    body = { players: normalizeRoster(json) };
    ttl = 86400;
  }
  res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=${ttl * 3}`);
  return res.status(200).json(body);
}

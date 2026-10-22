// Vercel serverless function: GET /api/espn?kind=scoreboard|summary|roster&sport=nfl&...
// Fetches ESPN's public scores feed, trims it to what the app needs, and lets
// Vercel's CDN cache it, so ESPN sees a few requests a minute no matter how
// many phones are watching. Only the requests espnUrls() allows get through.
import { espnUrls, mergeEvents, normalizeScoreboard, normalizeSummary, normalizeRoster } from '../src/lib/espn.js';

export default async function handler(req, res) {
  const q = req.query || {};
  const urls = espnUrls(q);
  if (!urls.length) return res.status(400).json({ error: 'That request isn’t supported.' });
  const got = await Promise.all(urls.map((u) => fetch(u, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null)));
  const good = got.filter(Boolean);
  if (!good.length) return res.status(502).json({ error: 'Couldn’t get scores from ESPN.' });
  const json = urls.length > 1 ? mergeEvents(good) : good[0];
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

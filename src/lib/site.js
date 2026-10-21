// The app's public address. Vercel also serves every deployment at private
// addresses (like bozo-bets-abc123-you.vercel.app) that ask for a Vercel login.
// Invite and sign-in links always use the public one, so they work for friends.
// On Vercel it's filled in at build time (see vite.config.js); elsewhere it's
// whatever address the app is open on.

const PUBLIC = (import.meta.env.VITE_SITE_URL || '').replace(/\/+$/, '');

export function siteUrl() {
  return PUBLIC || window.location.origin;
}

/** True when we know the public address and this page isn't on it. */
export function isPrivateAddress(publicUrl = PUBLIC, host = window.location.host) {
  if (!publicUrl) return false;
  try { return new URL(publicUrl).host !== host; } catch { return false; }
}

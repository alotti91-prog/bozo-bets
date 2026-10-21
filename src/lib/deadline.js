// Time display helpers (pick deadline, comment times). Pure functions, covered by logic.test.js.

const MIN = 60e3;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "2d 4h", "3h 12m", "12m", "under a minute". */
export function countdown(ms) {
  if (ms < MIN) return 'under a minute';
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MIN);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** "Sun 12:55 PM" within a week, otherwise "Oct 30, 12:55 PM" (viewer's local time). */
export function lockLabel(date, now = new Date()) {
  const soon = date - now < 6 * DAY && date - now > -6 * DAY;
  return soon
    ? date.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Where a week stands against its deadline. Returns null when the week has
 * no deadline, else { locked, at, left, label, countdown, soon }.
 */
export function lockState(lockAt, now = Date.now()) {
  if (!lockAt) return null;
  const at = new Date(lockAt);
  const left = at.getTime() - now;
  return {
    locked: left <= 0,
    at,
    left,
    label: lockLabel(at, new Date(now)),
    countdown: left > 0 ? countdown(left) : '',
    soon: left > 0 && left < 2 * HOUR,
  };
}

/** How long ago, short: "now", "5m", "3h", "2d", then "Oct 14". */
export function ago(iso, now = Date.now()) {
  const ms = now - new Date(iso).getTime();
  if (ms < MIN) return 'now';
  if (ms < HOUR) return `${Math.floor(ms / MIN)}m`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h`;
  if (ms < 7 * DAY) return `${Math.floor(ms / DAY)}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Value for an <input type="datetime-local"> in the viewer's time zone. */
export function toLocalInput(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

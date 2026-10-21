// NFL week math. Pure functions, covered by logic.test.js.
//
// The NFL season starts the week after Labor Day (the first Monday in
// September). Weeks run Tuesday through Monday, so Week 1 is the Tuesday after
// Labor Day through the following Monday. That's close enough for "what week
// are we in" without hard-coding each year's schedule.

const DAY = 864e5;

/** Tuesday after Labor Day, as a UTC timestamp at midnight. */
export function seasonStart(year) {
  const sep1 = new Date(Date.UTC(year, 8, 1));
  const toMonday = (8 - sep1.getUTCDay()) % 7; // days from Sep 1 to the first Monday
  return Date.UTC(year, 8, 1 + toMonday + 1);
}

/**
 * The NFL week for a date (default: today, in the viewer's time zone).
 * Returns { season, week }. Out of season (after the Super Bowl, before the
 * next kickoff) it returns Week 1 of the upcoming season.
 */
export function nflWeek(date = new Date()) {
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  let season = date.getFullYear();
  if (today < seasonStart(season)) season -= 1;
  const week = Math.floor((today - seasonStart(season)) / (7 * DAY)) + 1;
  if (week > 23) return { season: season + 1, week: 1 };
  return { season, week };
}

/** The Thursday of a given NFL week, as YYYY-MM-DD (used as a past week's date). */
export function nflWeekDate(season, week) {
  return new Date(seasonStart(season) + ((week - 1) * 7 + 2) * DAY).toISOString().slice(0, 10);
}

/** Season a league's week belongs to, based on the date that week started. */
export function seasonOf(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  return nflWeek(new Date(y, m - 1, d)).season;
}

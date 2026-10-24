// Feedback for the commish (Settings → Send feedback / Feedback). Pure
// functions, covered by sweat.test.js.

export const WEEK_MS = 7 * 864e5;

/**
 * One admin's view of the feedback, newest first:
 *   fresh   not seen yet (and not done)
 *   recent  seen within the last week (and not done)
 *   older   seen over a week ago, or marked done by any admin
 * views: this admin's [{ feedback_id, seen_at }]. Their own notes count as seen when sent.
 */
export function feedbackLists(feedback, views, userId, now = Date.now()) {
  const seen = new Map((views || []).map((v) => [v.feedback_id, Date.parse(v.seen_at)]));
  const lists = { fresh: [], recent: [], older: [] };
  const rows = [...(feedback || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  for (const f of rows) {
    const at = seen.get(f.id) ?? (f.user_id === userId ? Date.parse(f.created_at) : null);
    if (f.done_at) lists.older.push(f);
    else if (at == null) lists.fresh.push(f);
    else if (now - at < WEEK_MS) lists.recent.push(f);
    else lists.older.push(f);
  }
  return lists;
}

/** How many notes this admin hasn't seen: for the dot on the gear. */
export const unseenFeedback = (feedback, views, userId) => feedbackLists(feedback, views, userId).fresh.length;

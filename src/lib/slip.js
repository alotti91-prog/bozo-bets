// The week's slip screenshots, oldest first. Weeks from before multiple
// screenshots only have slip_path.
export function slipPaths(week) {
  if (week.slip_paths?.length) return week.slip_paths;
  return week.slip_path ? [week.slip_path] : [];
}

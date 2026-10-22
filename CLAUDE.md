# Bozo Bets: notes for Claude

Weekly group-parlay tracker for a group of friends. React (Vite, plain JavaScript) on Vercel, Supabase for data, auth, and realtime. The owners are not professional developers: explain changes plainly and keep the code simple.

## Commands
- `npm run demo`: run with built-in sample data, no backend (best for UI work)
- `npm run dev`: run against Supabase (needs `.env.local`, see `.env.example`)
- `npm test`: unit tests for odds, standings, and wheel math (`src/lib/logic.test.js`)
- `npm run test:sql`: runs `supabase/schema.sql` in PGlite and checks the permission rules
- `npm run build`: production build

Run all three checks before saying a change is done.

## How it fits together
- `supabase/schema.sql` is the whole backend: tables, row-level security, server functions (`create_league`, `join_league`, `claim_player`, `spin_wheel`, …), and the realtime publication. Keep it re-runnable (`if not exists`, `create or replace`, `drop policy if exists`). Any new rule needs a check in `scripts/sql-dryrun.mjs`, which also checks re-running the file and upgrading from the first version (`scripts/fixtures/schema-v1.sql`). When a function's arguments change, add `drop function if exists` for the old signature and update the grant lists.
- Pick deadline: `leagues.lock_dow/lock_time/lock_tz` is the weekly rule; `weeks.lock_at` is the per-week deadline (null = none). `week_open()` in SQL and `lockState()` in `src/lib/deadline.js` decide if a week is locked. Admins bypass the lock.
- Week numbers follow NFL weeks and can have gaps. The current week is always the highest `n`; "last week" means the closest lower `n`. `src/lib/nfl.js` works out the current NFL week.
- Links back to the app (invites, sign-in emails) use `siteUrl()` from `src/lib/site.js`, never `window.location.origin`, so they point at the public Vercel address.
- Permissions are enforced in the database. UI checks (`isAdmin`, `me`) only hide buttons.
- `src/lib/useLeague.js` loads every row for a league and re-fetches on any realtime change. Screens get `data = { league, players, members, weeks, legs, spins, reactions, comments, views }` (`views` = spin ids you've watched, or null if the table isn't there).
- Until you watch the latest spin, `League.jsx` passes the tabs a masked copy of the data (`unwatchedSpin` + `hideSpin` in `wheel.js`): that week's spins are flagged `hidden` and the payer they set is blanked with `payer_hidden`. Any new place that shows a spin result or payer must respect those flags.
- A week's slip screenshots are `weeks.slip_paths` (read them with `slipPaths()` in `src/lib/slip.js`; older weeks only have `slip_path`). Added with `add_slips()`, removed with `remove_slip()`; the first one marks the bet placed. Files sit at `<league>/<week>/…` in the private Storage bucket `slips` (set up at the bottom of `schema.sql`, skipped when there's no `storage` schema, as in tests). The demo client fakes `storage.from().upload/createSignedUrl`.
- Live legs: a leg picked from a game stores `legs.bet` (jsonb: sport, game, type, side, line, player, stat; see `src/lib/bets.js`). Free-text legs have none. Scores come from ESPN's public, unofficial feed through the Vercel function `api/espn.js`, which only allows requests `espnUrl()` builds, trims responses with `src/lib/espn.js`, and sets CDN caching. The app calls it via `src/lib/scores.js` (`demoScores` in demo mode; straight to ESPN in `npm run dev`, which has no `/api`). `useLiveGames` polls only unfinished games while the app is on screen. If the feed breaks, legs show no live line; nothing else may depend on it.
- Pure logic lives in `src/lib/odds.js`, `stats.js`, `wheel.js`, `espn.js`, and `bets.js`, with tests. Put new math there, not in components.
- `src/lib/demo-supabase.js` fakes the Supabase calls the app uses. If you add a new query or RPC, add it there too so `npm run demo` keeps working.
- Styling is one file, `src/styles.css`, with color tokens on `:root` and a dark-mode override. Use the tokens rather than new hard-coded colors.

## Conventions
- Copy is short and plain. Errors say what happened and what to do.
- Record notable choices in `DECISIONS.md` (date · decision · why).
- When a change people will notice ships, add a plain-language entry at the top of `src/lib/releases.js` (admins see it in Settings → What's new, with a dot on the gear). Credit whoever asked for it with `idea: 'Name'`.
- Never commit `.env.local` or any Supabase secret key. The publishable key is meant to be public.
- `main` is protected by a GitHub ruleset and every push to it goes live. The repo owner can push directly. Everyone else: work on a branch, run the three checks, and open a pull request for the owner to approve. Vercel builds a preview for each pull request.

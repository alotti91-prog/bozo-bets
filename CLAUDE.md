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
- `supabase/schema.sql` is the whole backend: tables, row-level security, server functions (`create_league`, `join_league`, `claim_player`, `spin_wheel`, …), and the realtime publication. Keep it re-runnable (`if not exists`, `create or replace`, `drop policy if exists`). Any new rule needs a check in `scripts/sql-dryrun.mjs`.
- Permissions are enforced in the database. UI checks (`isAdmin`, `me`) only hide buttons.
- `src/lib/useLeague.js` loads every row for a league and re-fetches on any realtime change. Screens get `data = { league, players, members, weeks, legs, spins }`.
- Pure logic lives in `src/lib/odds.js`, `stats.js`, and `wheel.js`, with tests. Put new math there, not in components.
- `src/lib/demo-supabase.js` fakes the Supabase calls the app uses. If you add a new query or RPC, add it there too so `npm run demo` keeps working.
- Styling is one file, `src/styles.css`, with color tokens on `:root` and a dark-mode override. Use the tokens rather than new hard-coded colors.

## Conventions
- Copy is short and plain. Errors say what happened and what to do.
- Record notable choices in `DECISIONS.md` (date · decision · why).
- Never commit `.env.local` or any Supabase secret key. The publishable key is meant to be public.

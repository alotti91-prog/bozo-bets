# Decisions

Why Bozo Bets is built the way it is. Newest at the bottom. Add an entry whenever you make a choice someone (or Claude) might later wonder about.

---

**2026-10-20 · Standalone web app instead of a Claude artifact**
The first version was a Claude artifact. Every friend needed a Claude account and edit access to enter a pick, which was too much friction for a $10 bet. A plain website with email sign-in removes that.

**2026-10-20 · Stack: Vite + React, Supabase, Vercel**
It's the same stack as Red Haus, so the setup is already familiar. Free tiers cover six people easily. Supabase supplies the database, login, and live updates in one place.

**2026-10-20 · Website added to the home screen, not an App Store app**
A home-screen web app looks and feels like an app for this use. A store app would add review cycles, developer fees, and two codebases for no real gain.

**2026-10-20 · Email sign-in with a link *and* a typed code**
No passwords. On iPhone, a home-screen app keeps a separate login from Safari, so a link alone signs people in to the wrong place. The Magic Link email template must include `{{ .Token }}` so people can type the code instead. See the README, step 3.

**2026-10-20 · Players are separate from logins**
A player is a name in the bet. A login (member) can claim one player. Friends who never sign in still play, and the commish enters their legs. History stays attached to the player even if a login is removed.

**2026-10-20 · Permissions live in the database**
Row-level security plus a trigger on `legs` enforce the rules: members edit only their own ungraded leg in the current week, and only the commish grades. The app's buttons mirror the rules but don't enforce them. `npm run test:sql` checks this.

**2026-10-20 · The server picks the wheel result**
`spin_wheel()` picks the name with `gen_random_uuid()` bytes, which come from a cryptographically secure source. It logs the spin and sets next week's payer. Phones only animate to the answer, so a spinner can't rig the result by editing the app.

**2026-10-20 · Re-spins are allowed, but always logged**
Mistakes happen, such as a wrong name in the wheel. Only last week can be re-spun, and every spin shows in the Wheel log with a "re-spin" tag.

**2026-10-20 · Spins play live on every phone**
A new row in `spins` arrives over Supabase Realtime, and every phone with the Wheel tab open animates the same spin. It's the most fun part of the app, and it cost about 20 lines.

**2026-10-20 · Reload the whole league on any change**
A season is a few hundred rows. Re-fetching everything on any live event is simpler and harder to get wrong than patching local state. Revisit this if a league ever gets big.

**2026-10-20 · Money counts settled weeks only**
"Put in," "Paid," and "Net" only count weeks that hit or busted. A live week isn't money lost yet. Net per person = their share of payouts minus what they put in as payer.

**2026-10-21 · Read the Vercel Supabase integration's keys**
The Vercel Supabase integration names its variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, but Vite only exposes `VITE_` ones. `vite.config.js` passes through exactly those two public values (falling back to the `VITE_` names, and to `anon` keys on older projects). It deliberately does not use `envPrefix: 'SUPABASE_'`, because that would ship the service-role key and JWT secret to every browser.

**2026-10-20 · Demo mode**
`npm run demo` swaps in an in-memory fake of Supabase with sample data, so anyone can work on screens without setting up a backend. `vite.config.js` swaps it out of real builds.

**2026-10-21 · "Solo $100" standings column**
The sheet tracked each person's running profit as if they'd bet $100 on their own leg alone. Standings now shows the same number (win: the payout on $100, loss: −$100, push: $0), and a test checks it against the sheet's totals.

**2026-10-21 · Weeks follow the NFL calendar; past weeks are entered in the app**
New leagues start at the current NFL week (worked out in `src/lib/nfl.js`: weeks run Tuesday to Monday from the Tuesday after Labor Day), editable at setup. The commish can renumber the current week and add, edit, or delete past weeks from History (`save_past_week`, `delete_past_week`, `set_week_number`). This replaced a one-off SQL import of the group's spreadsheet, so any league that starts late can fill in its history. Week numbers can now have gaps, so the wheel's "last week" is the closest earlier week, not `n - 1`. Pushes no longer count toward average odds, so a void entered with placeholder odds doesn't skew anything.

**2026-10-21 · Optional password after the first email sign-in**
People sign in the first time with an emailed code, then can set a password in Settings and sign in with email + password, with no email sent. Email alone was ruled out: anyone who knew a friend's email, or the commish's, could act as them. Sessions already persist per device, so most people rarely sign in at all. The sign-in screen remembers which method you used last on that device. Forgot your password? Use an email code, then set a new one; there's no separate reset flow. 8-character minimum, checked in the app.

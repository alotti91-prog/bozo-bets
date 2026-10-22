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

**2026-10-21 · Bozo Belt, reactions, and "bet placed"**
- *Bozo Belt:* the most misses this season, ties to the most recent miss (`bozoBelt()` in `stats.js`). It's computed, not stored, so it changes hands on its own and fixes itself when a grade is corrected. Shown as 🤡 next to the name everywhere.
- *Reactions:* a fixed set (🔥 🙏 🤡 💀) so the row stays tidy on a phone; one of each per person per pick. A trigger fills in league and user, so people can't react as someone else.
- *Bet placed:* `mark_placed()` lets whoever's on the hook, or the commish, mark it, with an optional screenshot in a private Storage bucket (`slips`, 5 MB, images only). Files sit under `<league id>/`, and Storage rules check league membership. Photos are shrunk in the browser first (≤2000 px JPEG). Replaced screenshots aren't deleted; there's little reason to bother at this size.
- Supabase can't filter delete events by league, so the app listens for deletes on a few tables unfiltered and reloads.

**2026-10-21 · Pick deadline, and "admin" instead of "co-commish"**
- A league has one weekly deadline (day, time, time zone) in `leagues`; each week stores its own `lock_at`. New weeks get the next deadline from a trigger (`weeks_fill_lock`), so a one-off change (`set_week_lock`) never leaks into other weeks. Past weeks added from History get no deadline.
- The time zone is the admin's phone's when they save, so "Sunday 12:55 PM" means what they think it means. Everyone else sees the deadline in their own local time.
- After the deadline, members can't add, edit, or remove their own leg. The `legs_guard` trigger and the delete policy enforce it, not just the app. Admins can still fix anything, because someone always sends his pick late in the group chat.
- Anyone with no leg in the current week goes in the wheel by default along with the losers (the admin can still change the pool before spinning). Without this, skipping your pick would be a free pass out of the wheel.
- The button and role label say "Admin" because that's the word people look for. The rights are the same as before.

**2026-10-21 · Invite and sign-in links always use the public address**
Vercel serves each deployment at extra addresses (`bozo-bets-<id>-<you>.vercel.app`, `bozo-bets-git-main-…`) that Standard Protection hides behind a Vercel login. The app used to build invite links from whatever address it was open on, so opening it from the Vercel dashboard produced invites friends couldn't open. Production builds now bake in `VERCEL_PROJECT_PRODUCTION_URL` (or `VITE_SITE_URL` if set) and use it for invites and sign-in email links. A yellow bar on any other address links to the public one. We chose not to redirect automatically: if Vercel ever reports a different domain than the one people use, a redirect would sign everyone out, while the bar only nags.

**2026-10-21 · Comments on picks, not a general chat**
The group chat already handles general trash talk, and the app has no notifications, so a league-wide comment feed would go quiet fast. Comments hang off a single leg instead, so the roast stays next to the pick in History. Up to 280 characters, the latest two shown until you open the thread. No editing (what was said stays said). You can delete your own; admins can delete anyone's. A trigger fills in the league and the author, so nobody can post as someone else. Notifications were left out on purpose; revisit only if people actually use comments.

**2026-10-21 · Wheel spins on the last settled week, with replays**
- The group spins mid-week, after the weekend's bets settle. The result stays up until the next week settles, then the wheel loads that week's losers. The spin still opens the next week, as before.
- If last week settled but was never spun (a league that started mid-season with past weeks added, or a week opened from Settings without spinning), the wheel spins on last week and sets this week's payer, instead of sitting idle until this week is graded. `spin_wheel` now requires every leg in the spun week to be graded, not just in the current week.
- Any spin can be replayed from the result or the Wheel log. Replays reuse the saved names and result, so they always land on the same person; only the animation is new.
- A live spin plays once per phone. On other tabs, the pop-up says "The wheel is spinning!" with a Watch button and doesn't name anyone, and the app holds back data refreshes for about 7.5 seconds so "On the hook" doesn't give it away.

**2026-10-21 · Replaced spins are crossed out and can be deleted**
When a week is re-spun, only the latest spin counts. Earlier ones stay in the Wheel log crossed out (and on replay) so everyone can see a re-spin happened. Admins can delete a replaced spin with `delete_spin()`; the spin that counts can't be deleted, so the payer never changes by accident. Trade-off: deleting replaced spins erases the record that a week was re-spun, which was the main check on an admin re-spinning until they like the result.

**2026-10-21 · The bozo stays hidden until you watch the spin**
If you miss the live spin, who it landed on is hidden on every tab (Wheel result and log, "On the hook", History, the Standings wheel count) until you watch it, live or as a replay. Watching is saved per account in `spin_views`, not per phone, because an iPhone home screen app and Safari don't share storage. Only the latest spin, the one that set this week's payer, is hidden, so people who join late don't have to sit through old weeks. The person who spun it never has it hidden. All of that week's spins are hidden, re-spun ones included, so nobody can work it out by elimination. Hiding is done in the app, not the database: anyone determined could still find the name. It's for fun, not secrecy.

**2026-10-22 · Fixes after the first real re-spin**
- Bug: a spin counted as watched when its animation finished, even on a page nobody was looking at. Browsers pause animations on hidden pages and jump to the end on return, so switching apps mid-spin revealed the bozo. A spin now counts only if the page stayed on screen the whole time, and a live spin that arrives while the page is hidden doesn't auto-play.
- Phones keep the app open for days (especially from the home screen), so people can run an old version. The build now writes `version.json`, and the app shows "Bozo Bets was updated. Refresh" when the online version differs.
- If a table the app needs is missing (schema.sql not re-run), admins now see a "Database update needed" banner instead of the feature quietly switching off.

**2026-10-22 · Auto-refresh to the newest version**
When the app comes back on screen and a newer version is online, it reloads by itself, unless a sheet is open or something is typed in a box (people flip to DraftKings mid-pick to check odds, and a reload would wipe it). Then it shows the Refresh bar instead. Checks while the app is in use only show the bar, so a reload never interrupts a spin. It reloads at most once per version, to avoid a loop if a stale copy is cached. We don't reload on every single open: data already refreshes on return, and an unconditional reload would lose half-typed picks.

**2026-10-22 · What's new, for admins**
Release notes live in `src/lib/releases.js`, written by hand in plain words (commit messages and this file are too technical for the group). Admins see them in Settings → What's new, with a red dot on the gear when there's something new. "Seen" is remembered per device, which is fine for a nudge. Entries can credit whoever suggested the change (`idea`), so the people asking for features see their names.

**2026-10-22 · Protect main**
Every push to `main` deploys to the whole group. A GitHub ruleset on the default branch requires a pull request with 1 approval, blocks force pushes, and blocks deleting the branch. Repository admins (the owner) can bypass it, so the owner's changes still ship directly; collaborators' changes need the owner's approval. The Claude GitHub App is deliberately not on the bypass list: collaborators also make changes through Claude, and an app bypass would let those skip review.

**2026-10-22 · Slip screenshots replace "I placed it"**
People screenshot the DraftKings slip, often in several pieces, so placing the bet is now just adding screenshots (up to 10, several at once). The first marks the bet placed; removing the last un-marks it. Whoever's on the hook or an admin can add or remove; everyone in the league can view. Removed screenshots are deleted from Storage (new "slips delete" policy, which checks the week folder's payer/admin), because slips can show balances. `weeks.slip_paths` holds them; `slip_path` stays as the first one, and `mark_placed` is kept and synced, so phones still on the old version keep working. "Placed by" is hidden while the bozo is hidden, though a screenshot itself may still show a DraftKings username.


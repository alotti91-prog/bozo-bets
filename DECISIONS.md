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

**2026-10-22 · Live legs from ESPN's free feed**
Legs can be picked from this week's games (sport → game → spread/moneyline/total/prop → details), and those legs show live status on the slip. Data comes from ESPN's public site API: free, no key, covers NFL, college football, NBA, NHL, and MLB, but unofficial and undocumented, so it can change without notice. Paid feeds were ruled out: cheap ones lack player stats, and full ones cost real money. A small Vercel function (`api/espn.js`) sits in between: it only allows three request shapes, trims ESPN's large JSON to a few fields, and sets `s-maxage` so Vercel's CDN serves everyone from one fetch (20 seconds while live, longer otherwise). That keeps ESPN traffic tiny and avoids browser cross-site issues. The line comes from what people enter (prefilled from DraftKings' line in ESPN's scoreboard), so no odds data is bought. Props are football-only for now (pre-game player lists come from team rosters, live stats from the box score). Status is for the sweat only: admins still grade, because stat corrections, voids, and DraftKings' own settlement rules would make auto-grading wrong sometimes. Free text stays for everything else and as the fallback when the feed is down.

**2026-10-22 · Outage alerts through a health check and a free uptime monitor**
`/api/health` tests the two outside dependencies: a Supabase read with the public key (row-level security returns nothing, but a 200 proves the database answered) and ESPN's scoreboard (that it answers and still has the shape we parse). UptimeRobot's free plan checks it every 5 minutes and emails on failure and recovery. Vercel Cron was ruled out: Hobby cron runs once a day and would need an email service. Inside the app, two failed score fetches in a row show admins a "Live scores aren't loading" banner. Side effect worth knowing: the 5-minute check is database activity, so Supabase won't pause the free project in the offseason.

**2026-10-22 · Game-day slip: show controls only when there's something to do**
Mid-game, every leg showed W/L/P, Edit, Remove, and five emoji buttons, which buried the live lines. Now an ungraded picked leg hides W/L/P until its game is final (`gradeHidden()`); typed legs, graded legs, and legs whose game we can't see always show them, and "⋯ → Grade now" opens them early. A final game offers a one-tap grade from the score (`suggestedGrade()`), still a human decision. Edit and Remove live in the ⋯ menu. When a leg has nothing to act on, its sport tag and ⋯ sit at the end of the reactions row. Reactions show only emojis someone used, plus ☺+. The header gets one dot per leg (`legState()`) and a "scores updated" time; the clock reads "Q3 6:12" (`shortClock()`), and the bettor's team is bold.

**2026-10-22 · Swipe to change tabs**
A quick, clearly sideways swipe (at least 70 px, twice as far sideways as up or down, under 0.6 s) changes tab; see `swipeDirection()` in `src/lib/swipe.js`. Swipes that start within 24 px of the screen edge are ignored, because Safari uses those for "back". Swipes that start in a text box or select, in an open sheet, or on anything marked `data-noswipe` are ignored too, and the tabs don't wrap around. Listeners are passive and never prevent scrolling. The new tab slides in from the direction you're heading (off with reduced motion). Mark any future horizontally swipeable element with `data-noswipe`.


**2026-10-22 · Split the two biggest screens into smaller files**
This week (430 lines) and Settings (395) had grown into several things each. Each leg on the slip is now `src/screens/week/LegRow.jsx`, with the leg form and payout form next to it, and every Settings form has its own file in `src/screens/settings/`. Nothing works differently: the same scripted click-through ran on the old and new versions with identical results and matching screenshots. The leg row's open menu, "Remove?" and "Grade now" state stays in WeekTab so only one can be open at a time, as before. Rule of thumb from here: keep files under about 300 lines.

**2026-10-22 · The wheel eliminates instead of picking**
Lotti's idea: each spin knocks a name out (that person is safe) until one is left, and that last name is the bozo. The database decides the whole knock-out order in one go when the commish taps Spin, saves it in `spins.eliminated`, and sets the payer. Every phone then plays the same sequence (quicker spins for the early rounds, the full spin for the last two names) without the commish tapping each round, so it can't stall halfway or differ between phones. Odds don't change: with equal slices, knocking out a random name each round leaves each person a 1-in-N chance of being last, the same as one spin. The database checks confirm it over 600 spins. `landed_id` stays the bozo, so nothing that reads results had to change, and spins from before the change replay as single spins. Leaving the Wheel tab partway through doesn't count as watching, so the bozo stays hidden until you see the end. "Skip to the bozo" does count.

**2026-10-22 · Member view for admins**
Settings → Member view hides every admin control so an admin can check what members see. It's a preview, not a security test: the database still treats you as an admin, so anything you do counts, and a yellow strip under the tabs says so. It resets when the app reloads, so nobody gets stuck in it. The real member permissions are covered by the database checks (`npm run test:sql`). For a true end-to-end member test, sign in with a second address in a private window.

**2026-10-22 · A simpler look ("say a lot with a little")**
Lotti asked for an Apple-like UI with less on screen. Mockups first, then built as drawn:
- Tabs moved to a bottom bar.
- This week leads with one summary row, and each leg is one line: dot, who, pick, odds, live status. Reactions, comments, grading, edit, and remove moved into a panel you open by tapping the leg.
- "Still waiting on" became one line inside the slip with a Remind button.
- The leg form opens in its own panel.
- Settings became a list of rows that open pages.

Trade-offs we accepted:
- The password reminder banner is gone; Settings shows "Password · Not set" instead.
- Standings' Hit % and Avg odds moved behind a tap on the player.
- The rubber-stamp "BUSTED" and the typewriter font are gone.

The crowding that started this had a real bug under it: the wrapper added for the tab-swipe animation dropped the spacing between sections, so every tab's sections ran together. `.pane` now spaces them.

**2026-10-22 · Pick legs from DraftKings' board, inside Add a leg**
ESPN's scoreboard already carries DraftKings' full board for each game: both sides of the spread with prices, both moneylines, and the over/under with prices. We used to keep only the spread number and the total. Now the board shows in Add a leg, and tapping a price fills in the pick, the line, and the odds. We built it into Add a leg instead of a fifth tab: browsing lines mostly copies the DraftKings app, and a tab would undo the simplicity we just shipped. A read-only "This week's lines" sheet covers browsing. Boards show only for games that haven't started (started games show live or closing prices, which would mislead). Prop lines aren't in ESPN's feed and would need a paid odds service, so props are still built by hand. Lines move, so the odds stay editable and the sheet says to check DraftKings.

**2026-10-22 · Add a leg always opens on the live picker**
The leg form saves a draft as you go, and the draft used to remember whether you were picking or typing. One tap on "Type it instead" (or "Other") meant the form kept reopening typed for the rest of the week. Now a new leg always opens on this week's games and lines, the typed text stays in the draft behind "Type it instead", and editing a typed leg still opens it typed.

**2026-10-23 · A weekly recap after the spin, instead of a live bozo meter**
We mocked up a live "bozo meter" on the slip (a clown face that got worse with each losing leg) and chose a recap instead. A settled parlay has only two outcomes, hit or a lost leg, so the meter's middle steps only existed during games. It would have sat at full bozo all weekend after an early loss, and it put a permanent face in the summary row. The recap is a sheet that opens a beat after you first watch the spin, live or as a replay. That way it can never give the result away, and the existing "watched" record (`spin_views`) already makes it show once per person on any device. Faces: the wheel's pick in a busted week is full bozo; a lost leg, or no leg while in the wheel, is makeup; a win or push is clean. We dropped a "first leg to lose" step because typed legs only get a time when someone grades them. A week that hits still gets a spin (everyone goes in) to pick next week's payer, so it needs no separate trigger and no new table. If the commish ever skips the spin, the recap is still in History. The first time someone opens the app to a spin they haven't watched, a prompt offers to play it (Watch / Later). Later lasts for that visit, and the prompt is skipped for spins that happened while the app was open, since the toast covers those. The clown is drawn from scratch rather than taken from the meme photo, which shows a real person and is someone else's image. The repo and site are public.

**2026-10-23 · Recap faces get worse the worse a leg missed**
When the commish grades a leg picked from a game and the final score agrees, the app saves `legs.margin`: how far it finished from the line in the bet's own units (negative = missed by). The recap turns a lost leg into a face from that: a close call is face paint, a normal miss is makeup, a blowout is the wig, and the wheel's pick is still full bozo. Cutoffs, in `recap.js`: football is close within 1 point (3 on a moneyline) and a blowout at 14 or more. The NBA is 2 (3 on a moneyline) and 15. The NHL is 1 goal and 3. MLB is 1 run and 5. Player props scale with the line: within 10% (at least 1) is close, and half the line or more is a blowout. Lines under 5, like TDs or a few catches, have no close call. We save the margin at grading, not by looking old games up later, because ESPN's feed is unofficial and nothing else should lean on it. The cost: typed legs and weeks graded before this count as a normal miss. Only the commish can set it (the leg guard treats it like the grade), and undoing a grade clears it. A grade that disagrees with the final score, say after a stat correction, saves no margin rather than a wrong one. Until `schema.sql` is re-run, grading works as before and admins see the "Database update needed" banner.

**2026-10-23 · "Go back to an earlier week" (commish tool)**
A spin opens the next week, so after a test spin the tested week is locked in as last week, with its spin and grades. The new tool in Settings → Weeks (`reset_to_week()` in SQL, `settings/ResetWeekForm.jsx`) makes any earlier week this week again. It deletes every later week (their picks, spins, reactions, and comments go with them), removes that week's spins so its wheel can spin again, and can clear its grades. That switch is on by default, because the usual reason is a test. It stays admin-only like the other week tools, rather than owner-only like a new season, because it removes only the weeks after the one you pick. The confirm box lists what will be deleted, with counts. Slip photos of deleted weeks are removed by the app through the Storage API after the reset, since Supabase doesn't let SQL delete Storage files.

**2026-10-23 · Typed legs: the commish picks close call or blowout**
A typed leg has no bet type or line, so a "lost by" number alone can't be judged: 6 short on a 75-yard prop is a close call, while 6 on a spread is a regular miss. So when a typed leg is graded Lost, the commish picks Close call, Regular, or Blowout in the leg's panel (`week/MissPicker.jsx`, saved as `legs.miss`). An optional "Lost by" number is saved in `legs.margin` and only shows in the recap text. The same pick appears for a picked leg graded before its game was final, since there's no margin to measure (no number box there). The pick wins over any margin. The leg guard treats `miss` like the grade (commish only), and any result other than Lost clears it.

**2026-10-23 · A faces key in the recap**
With five faces, people couldn't tell the scale existed: face paint and makeup look alike at row size, and the wig and full bozo differ only by the nose. The recap now has a one-row ladder (`recap/FaceLadder.jsx`) above "How everyone did". It shows all five faces in order, with a count badge for how many people got each, and faces nobody got fade out. It's the key and a summary of the week in one row, about the height of one person's row. Tapping it, or "How faces work", opens a rules page inside the same sheet (`recap/FaceRules.jsx`). Its cutoffs table is built from the `CUTOFFS` in `recap.js` (`cutoffRows()`), so it can't drift from the real rules. We passed on a big meme-style ladder because it would push the bozo and the list below the fold.

**2026-10-23 · A credit line, first names only**
"Bozo Bets · made by Chris & Andrew" sits at the bottom of Settings. It isn't a footer on every screen: the tab bar is pinned there, and it would add clutter to every screen. First names only, because the repo is public.

**2026-10-23 · Grade all, Edit Week in place, and the Belt as a face**
- **Grade all:** when two or more legs picked from a game are final but ungraded, the slip shows "N games are final · Grade all" for the commish (`finishedGrades()` in `bets.js`). It saves each grade with its margin. With just one, the leg's own "Final · Mark W" button already does the job, so the row stays hidden.
- **Edit Week:** `save_past_week()` used to delete and re-insert a week's legs. That silently dropped the game link, margins, close-call picks, reactions, and trash talk. It now updates each leg in place (`on conflict (week_id, player_id) do update`). A changed pick drops the game link and margin. A changed result drops the margin and close-call pick. Players removed from the week lose their leg, as before.
- **Bozo Belt:** the 🤡 emoji is replaced with the full-bozo `BozoFace` so it matches the recap. The 🤡 reaction stays, since that's an emoji people send.

**2026-10-23 · DraftKings' price for hand-built bets, and no paid props feed (yet)**
A spread, total, or moneyline built with "Other bets" now gets DraftKings' price when it lands exactly on the board's main line (`boardPrice()` in `bets.js`, games that haven't started only). If the bet then moves off the board, say to an alternate line or another game, an auto-filled price is cleared so a wrong price can't sit there. Odds the person typed are never touched. Player props still have no prices: ESPN's feed has none, and DraftKings has no public API (scraping breaks their terms and gets blocked). A licensed feed (The Odds API) covers DraftKings props. We'll only wire it in if the free plan includes DraftKings, because $30 a month isn't worth it for one prop a week.

**2026-10-23 · Player props: category, then stat, then player**
The prop builder used to be two dropdowns: a player (every skill player on both teams, A–Z within position) and a stat. Now it follows DraftKings (`components/PropPicker.jsx`): a category (Passing, Rushing, Receiving, TDs), then the stat as buttons, then only the players who'd have that line (`propPlayers()` with `STAT_POS` in `bets.js`). Players are grouped by team with a position tag, most likely positions first: QBs for passing, RBs then QBs for rushing, WRs then TEs then RBs for receiving. A search box shows when the list is long, and picking a player folds the list to them. Switching to a stat the player wouldn't have (a WR under Passing) clears the pick. Within a position the order is still A–Z, because ESPN's free roster doesn't say who starts and we can't check its depth-chart data from here. That would be the next step if the lists feel long.

**2026-10-23 · NFL depth charts from Sleeper**
ESPN's free roster doesn't say who starts, so prop lists were A–Z within a position. Sleeper's public API is free for non-commercial use, needs no key, and is documented at docs.sleeper.com. Every NFL player in it comes with a depth chart order, injury status, and their ESPN id, which lines up with our ESPN rosters and live stats. Its player list is about 5MB and Sleeper asks for it once a day at most. So `/api/depth` fetches it, `normalizeDepth()` trims it to `{ espnId: { o, s } }` for skill players, and Vercel's CDN caches it for a day. The health check pings Sleeper's tiny `/state/nfl` endpoint, never the big list. In the picker, starters (depth order 1) show first, everyone else is behind "Show all players" (still in position order), searching looks through everyone, and injuries show as tags. If Sleeper is down, or for college, the picker lists everyone as before. It can't be tested against live Sleeper data from the build workspace (the network blocks it), so it's built to the docs and checked against the live site after deploying. If we ever charge money, Sleeper's terms need a licensing talk.

**2026-10-23 · Match Sleeper players by name too**
Checked live after deploying: Sleeper only had an ESPN id for about 200 skill players, and only 47 starters matched (James Cook, Puka Nacua and Matthew Stafford were missing). A team with one matched starter would have hidden its real, unmatched starters behind "Show all players." Two fixes: `normalizeDepth()` also keys each player by a cleaned-up name (`nameKey()`: no punctuation, accents, or Jr./III), skipping any name two skill players share rather than guessing; and the picker only hides players Sleeper actually knows to be backups or off the depth chart. Anyone it can't match stays up front, so a bad match can only show too many players, never hide a starter.

**2026-10-23 · Injury tags on the slip**
The picker was the only place injury tags showed, but the slip is where people look all week. NFL player-prop legs on the slip now show the same tag (`legInjury()` in `depth.js`, drawn by `components/InjuryTag.jsx`) until kickoff. After kickoff it disappears, since the pre-game report is old news by then, and graded legs never show it. Typed legs get nothing because the app doesn't know which player they're about. The slip stays light in dark mode, so its tags use paper colors (`--p-warn*`, `--p-loss*`). The data is Sleeper's daily list, so a tag can be up to a day old; the release note says so.

**2026-10-24 · DraftKings prop lines from SportsGameOdds**
ESPN's free feed has no prop lines. Compared free options (SportsGameOdds, The Odds API, PropLine, OddsPapi, Odds-API.io): SportsGameOdds' free plan is the only one that says outright it includes player props and DraftKings, and it charges per game, not per market, so one call gets every prop for a game. Limits: 2,500 games a month, 10 requests a minute, odds refreshed every 10 minutes, and every response counts as at least one game even when empty. So `/api/props` asks for a single game (home team id plus a kickoff window, falling back to all games in that window matched by name if the team id guess misses), only the 19 markets the picker offers, only DraftKings, and the CDN caches each game 30 minutes. It accepts only real NFL abbreviations and an on-the-hour kickoff within the next 10 days, so nobody can spend the allowance with made-up URLs. Worst case, someone opening the picker every 30 minutes all day for every game would be about 750 a day; real use is a few dozen a week. The health check reports whether the key is set but never calls SportsGameOdds, since an uptime monitor every 5 minutes would burn the allowance. The key is the server-only env var `SPORTSGAMEODDS_KEY`. Lines match ESPN rosters by name (`nameKey`). Only DraftKings, to match the game lines. Built from SportsGameOdds' docs without being able to call it from the build workspace; checked on the live site the same day: the team id guess (`ATLANTA_FALCONS_NFL` style) finds the game on the first try, so each lookup costs one game, and SF @ ATL came back with DraftKings lines for 22 players. Like Sleeper, their terms need a look if we ever charge money.

**2026-10-24 · "Other bets" becomes "Player props"; no alternate lines**
Once Add a leg opened on DraftKings' board, "Other bets" was mostly a slow way into player props (Other bets → Player → category). It's now "Player props" on football games and opens the prop picker directly. The hand-built spread, total, and moneyline are gone for games with a board: Lotti says nobody bets alternate lines, and "Type it instead" covers the rare one. Games without a board (no lines on ESPN, or already started) still get the hand-built controls, since there's nothing to tap otherwise. Editing an older hand-built leg still shows its builder so it can be changed.

**2026-10-24 · Sunday sweat mode**
The slip already tracked live scores, so the fun part was reacting to them. A leg counts as decided when it's graded, or when the live line is final or locked (an over that's hit, an under that's gone over, an anytime TD that's scored), the same rule the alive count uses. Only changes that happen while you're looking count: the first look takes stock silently, so opening the app at 4pm doesn't replay the whole afternoon, and a leg flickering back to "unknown" when the feed blinks isn't news. Several legs settling at once (Grade all) get one combined toast. "Carrying the slip" only shows when nothing has busted and exactly one leg is left, and needs at least two legs. Sounds reuse the wheel's horn and ding and its sound switch; browsers only allow sound after a tap, so it unlocks on your first tap. Confetti and shakes are skipped for anyone whose phone asks for less motion. No SQL.

**2026-10-24 · The bozo wears it**
For the week after the spin, the wheel's bozo gets a red "Bozo" tag with the full clown face after their name on the slip, Standings, History, and their comments. "The week after" is the latest spin of the current week, or else of last week (the closest lower week number), so the tag comes off once the following week opens, and a week whose parlay hit (no spin) doesn't extend it. It's worked out from the masked data, so nobody sees it before watching the spin. It's a pill with the word "Bozo" rather than the bare face because the bare face already means the Bozo Belt (most misses this season). No SQL.

**2026-10-24 · Awards in the recap**
Four awards, each shown only when it applies, so a quiet week isn't padded with filler. Closest miss goes to the lost leg nearest its line as a share of that sport's blowout margin (so half a point in football and one run in baseball compare fairly), close calls first; blowouts never win it, and neither do typed legs with no "lost by" or close-call pick, since we can't measure them. Biggest hit is plus money only: a −200 favorite cashing isn't news. Ice cold and On fire need 3 weeks in a row; weeks someone sat out don't break a streak, a push does. Ties go to player order. They're added to the recap in `League.jsx` instead of inside `weekRecap()` to keep awards.js → recap.js one-way. No SQL.

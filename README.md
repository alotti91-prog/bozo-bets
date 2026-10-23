# Bozo Bets

A weekly group-parlay tracker. Everyone adds one leg. If the parlay hits, you split it. Anyone whose leg misses goes in the Bozo Wheel. It knocks names out one spin at a time, and the last name left puts in next week's stake.

- **This week:** the parlay as a bet slip, with combined odds and payout. Everyone adds their own leg from their phone.
- **Wheel:** once a week's bets settle, the wheel loads everyone who missed and the commish spins whenever you're ready (say, mid-week). Each spin knocks out a name (they're safe) until one is left: the bozo. The server decides every spin, so nobody can rig it. Every open phone watches the same spins live, and anyone can replay it after. Miss it, and the bozo stays hidden everywhere in the app until you watch the replay. The result stays up until the next week settles.
- **Standings:** records, hit %, money in and out, and superlatives.
- **History:** every week, who sank it, and where the wheel landed. The commish can add weeks from before the league joined the app.
- **Bozo Belt 🤡:** most misses this season wears the clown nose next to their name until someone passes him.
- **Reactions:** 🔥 🙏 🤡 💀 on anyone's pick, live.
- **Live legs:** pick your leg from this week's games (spread, moneyline, total, or a football player prop) and the slip tracks it live: "Covering · DET 24, GB 17", "52 of 75 rush yds", and how many legs are still alive. Anything else can still be typed in.
- **Slip screenshots:** whoever's on the hook adds screenshots of the DraftKings slip, one or several. The first one marks the bet placed, and everyone can flip through them.

Built with React (Vite), Supabase (database, login, live updates), and Vercel (hosting). The free tiers of both cover a group this size.

---

## Try it with no setup

```bash
npm install
npm run demo
```

Open the address it prints. You'll see sample data, and nothing is saved.

---

## Set it up for real (about 20 minutes, one time)

### 1. Create the database (Supabase)

1. Sign in at [supabase.com](https://supabase.com) and create a new project. Any name and region works. Save the database password somewhere, though the app never needs it.
2. In the project, open **SQL Editor**, start a new query, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. It should finish with "Success. No rows returned."
3. Open the project's **API keys** settings and copy two values:
   - the **Project URL** (looks like `https://abcd1234.supabase.co`)
   - the **publishable key** (starts with `sb_publishable_`). Older projects call this the `anon` key; that works too.

### 2. Put the site online (Vercel)

1. Sign in at [vercel.com](https://vercel.com) with GitHub and choose **Add New → Project**. Import the `bozo-bets` repository. Vercel detects Vite on its own.
2. Before deploying, open **Environment Variables** and add both:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Project URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | your publishable key |

   If you connected Supabase through Vercel's **Supabase integration**, you can skip this step. The integration already adds `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, and the app picks those up on its own.

3. Click **Deploy**. When it finishes, copy your site address (like `https://bozo-bets.vercel.app`).

### 3. Set up sign-in emails (Supabase), required

Supabase's built-in email sender only delivers to members of your Supabase organization, about 2 emails an hour. Your friends would never get their sign-in emails. On new free projects it also locks the email templates. So connect your own sender. A Gmail account works and needs no domain:

1. **Make a Gmail app password.** A separate account like `bozobets.app@gmail.com` is best, since sign-in emails come from it. Turn on **2-Step Verification** for that account, then go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), create one named "Bozo Bets", and copy the 16-character code.
2. **In Supabase, go to Authentication → Emails → SMTP Settings** and turn on custom SMTP:

   | Field | Value |
   |---|---|
   | Sender email | the Gmail address |
   | Sender name | `Bozo Bets` |
   | Host | `smtp.gmail.com` |
   | Port | `587` |
   | Username | the Gmail address |
   | Password | the 16-character app password (no spaces) |

3. **Authentication → URL Configuration:**
   - **Site URL:** your Vercel address.
   - **Redirect URLs:** add `https://YOUR-SITE.vercel.app/**` and, for working on your own computer, `http://localhost:5173/**`.
4. **Authentication → Emails → Templates → Magic link or OTP:** add this line somewhere in the body:

   ```
   Or type this code in the app: {{ .Token }}
   ```

   This matters on iPhone. An app added to the home screen keeps a separate login from Safari, so tapping the email link signs you in to Safari instead of the app. Typing the code signs you in right in the app.

The first few emails from a new Gmail sender can land in spam, so tell the group to check there.

### 4. Start your league

1. Open your site, enter your email, and sign in with the link or code.
2. Choose **Start a league**, list everyone in the bet, pick your own name, and set the stake. The starting week fills in with the current NFL week. You're the owner (commish).
   - **Started the season before using the app?** Open **History → Add a past week** to enter earlier weeks: who put in, plus each person's pick, odds, and W/L/P. Those weeks count in Standings.
3. Open **Settings** (the gear) and tap **Share invite**. Send it to the group chat. Friends open it, sign in, and pick their name.
   - Only share your public address (the one under **Domains** in Vercel, like `bozo-bets-psi.vercel.app`). Vercel's other addresses for each deployment ask for a Vercel login, so friends get stuck there. The invite button always uses the public address, and the app shows a yellow bar if you're on a private one.
4. After signing in once with the email code, everyone can set a password in **Settings → Skip the sign-in email**. Next time they sign in with email + password, and no email is sent. On the same phone they stay signed in anyway.
5. Tell everyone to add it to their home screen:
   - **iPhone (iOS 26):** open the site in Safari → tap **•••** next to the address bar → **Share** → **Add to Home Screen** (scroll down or tap **View More** if it's hidden) → leave **Open as Web App** on → **Add**.
   - **iPhone (older iOS):** Safari → the Share button at the bottom → **Add to Home Screen**.
   - Join and pick your name in Safari first, then add it. The home screen app has its own login, so sign in there once more with your password or the 6-digit code (typing the code, not tapping the email link).
   - **Android:** open in Chrome → menu → **Add to Home screen** (or **Install app**).

---

## Get an alert if something breaks

`/api/health` on your site checks Supabase (the database) and ESPN's live-scores feed, and answers 200 when both work or 503 with what's broken. Point a free uptime monitor at it:

1. Sign up at **uptimerobot.com** (free).
2. **New monitor** → type **HTTP(s)** → URL `https://<your-site>/api/health` → check every **5 minutes**.
3. Alert contact: your email. You get an email when it breaks and another when it recovers.

Admins also see a banner in the app when live scores stop loading. Side effect: the monitor's check counts as database activity, so Supabase won't pause the project in the offseason.

---

## Who can do what

| | Member | Admin | Owner |
|---|---|---|---|
| See everything | ✓ | ✓ | ✓ |
| React to and comment on any pick, delete **their own** comments | ✓ | ✓ | ✓ |
| Add, edit, or remove **their own** leg (current week, before it's graded and before the pick deadline) | ✓ | ✓ | ✓ |
| Add or edit anyone's leg (even after the deadline), grade legs, set the payer, enter the actual payout | | ✓ | ✓ |
| Spin and re-spin the wheel, delete replaced spins, add or bench players, open the next week, set the pick deadline, delete anyone's comment | | ✓ | ✓ |
| See the app as a member (Settings → Member view; only hides buttons) | | ✓ | ✓ |
| Make someone an admin, remove a login, new invite code, new season | | | ✓ |

The database enforces these rules, not just the app's buttons. A regular member can't grade a leg or sneak a pick in after the deadline, even with a modified app.

**To make a friend an admin:** they open the invite link and sign in first. Then the owner goes to Settings → People signed in → **Make admin** next to their email.

**Pick deadline:** an admin sets it in Settings → Pick deadline (for example, every Sunday at 12:55 PM). It applies to this week and every new week. Under "Just Week N" you can move one week's deadline, say for Thanksgiving, or turn it off for that week. Anyone without a leg at the deadline is listed under "Missed the deadline" and goes in the wheel by default.

Friends who never sign in still work fine. The commish can add their legs for them.

---

## Working on it together

**Add a collaborator:** on GitHub, open the repo → **Settings → Collaborators → Add people**.

**On your own computer:**

```bash
git clone https://github.com/alotti91-prog/bozo-bets.git
cd bozo-bets
npm install
cp .env.example .env.local   # then paste in the two Supabase values
npm run dev                  # opens at http://localhost:5173
```

Or skip the keys and run `npm run demo`.

**Checks before you push:**

```bash
npm test          # odds, payout, standings, and wheel math
npm run test:sql  # runs the database setup in a throwaway Postgres and checks the permission rules
npm run build     # makes sure the site builds
```

**Deploys:** every push to `main` goes live on Vercel automatically. Pull requests get their own preview link, so you can try a change on your phone before merging it.

**Using Claude Code:** [`CLAUDE.md`](CLAUDE.md) tells Claude how this project is laid out, and [`DECISIONS.md`](DECISIONS.md) records why things are built the way they are. Add a line to `DECISIONS.md` whenever you make a choice someone might later wonder about.

**Changing the database:** add the change to `supabase/schema.sql` in a way that's safe to run again (`create ... if not exists`, `create or replace`, `drop policy if exists` before `create policy`). Run `npm run test:sql` first. Then paste the **whole** file into the Supabase SQL Editor and run it. It keeps all existing data.

---

## Project layout

```
supabase/schema.sql        tables, permission rules, server functions, live updates
scripts/sql-dryrun.mjs     tests schema.sql in an in-memory Postgres
src/lib/odds.js            odds and payout math
src/lib/stats.js           standings
src/lib/wheel.js           wheel states and angle math
src/lib/useLeague.js       loads a league and keeps it live
src/lib/demo-supabase.js   sample data for `npm run demo`
src/lib/bets.js, espn.js    live legs: bet text, live status, ESPN data
api/                       Vercel functions: ESPN proxy, health check
src/screens/               sign-in, onboarding, and the four tabs + settings
src/screens/week/          This week's pieces: one leg row, the leg form, payout
src/screens/settings/      one file per Settings form (deadline, players, …)
src/components/            the wheel canvas, bet picker, comments, sheet, toasts
```

Keep files small enough to read in one sitting (roughly under 300 lines). When a screen grows past that, move a self-contained piece into its own file next to it.

// Release notes. Admins see these in Settings → What's new, and get a dot on
// the gear when there's a new one. Newest first. Add an entry whenever a change
// people will notice ships: plain words, what it does for the group, no tech talk.
// If someone asked for it, credit them with idea: 'Name'.

export const RELEASES = [
  {
    id: '2026-10-24-i',
    date: '2026-10-24',
    title: 'Legs grade themselves',
    idea: 'Lotti',
    items: [
      'Once a game is final, legs picked from it grade themselves (when the commish has the app open), with how far they finished from the line.',
      'A few wait for the commish, with the reason on the slip: a player who isn’t in the box score (DraftKings voids props for players who sit), or a yards prop within a yard of the line. Typed-in legs are still graded by hand.',
      'The commish can still change any grade, and a grade changed by hand stays put.',
      'Fixed: sweat mode no longer celebrates a yards prop before the final (yards can drop on a negative play), and no longer replays results when the app opens.',
    ],
  },
  {
    id: '2026-10-24-h',
    date: '2026-10-24',
    title: 'The recap shows what happened',
    idea: 'Lotti',
    items: [
      'Under each pick in the recap: how it actually went. “Shough 240+ pass yds · had 212 pass yds, 28 short,” “Bills won by 3, needed 7,” “game went 44.”',
      'It’s on the recap picture and the shared text too. Legs typed in by hand, or graded before the final score, still just say won or lost.',
    ],
  },
  {
    id: '2026-10-24-g',
    date: '2026-10-24',
    title: 'See who’s here',
    idea: 'Lotti',
    items: [
      'This week now shows who has the app open right now (“4 sweating the slip” during games). Tap it to see who’s where.',
      'A green dot on the slip marks each leg whose owner is on the app.',
      'The Wheel tab shows how many are watching a spin live, and who just showed up.',
    ],
  },
  {
    id: '2026-10-24-f',
    date: '2026-10-24',
    title: 'Share the recap as a picture',
    idea: 'Lotti',
    items: [
      '“Share image” on the recap turns it into a picture (the bozo, the awards, everyone’s face) to post in the group chat.',
      'On a computer it saves the picture instead. The text version is still there under “Share as text instead.”',
    ],
  },
  {
    id: '2026-10-24-e',
    date: '2026-10-24',
    title: 'Awards in the recap',
    idea: 'Lotti',
    items: [
      'The weekly recap now hands out awards: 😬 Closest miss, 💰 Biggest hit (plus-money only), 🧊 Ice cold (3+ straight losses), and 🔥 On fire (3+ straight wins).',
      'They’re in the shared recap text too.',
    ],
  },
  {
    id: '2026-10-24-d',
    date: '2026-10-24',
    title: 'The bozo wears it',
    idea: 'Lotti',
    items: [
      'For the week after the spin, the wheel’s bozo gets a red clown tag next to their name: on the slip, Standings, History, and their comments.',
      'Nobody sees it until they’ve watched the spin, so no spoilers.',
    ],
  },
  {
    id: '2026-10-24-c',
    date: '2026-10-24',
    title: 'Sunday sweat mode',
    idea: 'Lotti',
    items: [
      'Keep the slip open during games: a leg that busts gets the clown horn and a shake, one that cashes gets confetti, and the slip hitting gets the full shower.',
      'When it comes down to one leg, the slip says who’s carrying it.',
      'Sounds follow the sound switch on the Wheel tab, and start after your first tap.',
    ],
  },
  {
    id: '2026-10-24-b',
    date: '2026-10-24',
    title: 'Player props, one tap',
    idea: 'Lotti',
    items: [
      'Football games now have a “Player props” button that opens straight to Passing, Rushing, Receiving, and TDs.',
      'The hand-built spread, total, and moneyline are gone for games with DraftKings lines. Tap the price on the board, or use “Type it instead” for anything else.',
    ],
  },
  {
    id: '2026-10-24-a',
    date: '2026-10-24',
    title: 'DraftKings prop lines',
    idea: 'Lotti',
    items: [
      'NFL player props now show DraftKings’ line next to each player, like “DJ Moore 62.5.”',
      'Pick a player and the number fills in. The Over and Under buttons show DraftKings’ prices, and tapping one fills in the odds.',
      'If DraftKings doesn’t have that prop, or the game has started, type the number like before.',
    ],
  },
  {
    id: '2026-10-23-k',
    date: '2026-10-23',
    title: 'Injury tags on the slip',
    idea: 'Lotti',
    items: [
      'NFL player props on the slip now show the player’s injury tag (Q, D, Out, IR) until his game kicks off, so a late downgrade doesn’t sneak up on anyone.',
      'Injury news comes from Sleeper and can be up to a day old. Check the news before kickoff.',
    ],
  },
  {
    id: '2026-10-23-j',
    date: '2026-10-23',
    title: 'Starters first, with injury tags',
    idea: 'Lotti',
    items: [
      'NFL player props now list each team’s starters first, from Sleeper’s depth charts: QB1, RB1, the starting receivers. Backups are one tap away under “Show all players.”',
      'Injured players get a tag like DraftKings: Q, D, Out, or IR.',
      'College props still list everyone, with search.',
    ],
  },
  {
    id: '2026-10-23-i',
    date: '2026-10-23',
    title: 'Player props, DraftKings style',
    idea: 'Lotti',
    items: [
      'Player props now go category first, like DraftKings: Passing, Rushing, Receiving, or TDs, then the stat (Yards, Catches, and so on).',
      'You only see the players who’d have that line, grouped by team with their position: QBs for passing, WRs then TEs then RBs for receiving. There’s a search box when the list is long.',
      'Tap a player and the list folds down to them, with Change to pick someone else.',
    ],
  },
  {
    id: '2026-10-23-h',
    date: '2026-10-23',
    title: 'DraftKings’ odds for bets you build',
    idea: 'Lotti',
    items: [
      'Building a spread, total, or moneyline with “Other bets” now fills in DraftKings’ odds too, as long as it’s their main line.',
      'Pick an alternate line and the odds clear, so you type the real ones. Player props still need their odds typed in.',
    ],
  },
  {
    id: '2026-10-23-g',
    date: '2026-10-23',
    title: '“Type it instead” up top',
    idea: 'Lotti',
    items: [
      'Add your leg now shows “Type it instead” right under the sports, so you don’t have to scroll past every game to type a leg in.',
    ],
  },
  {
    id: '2026-10-23-f',
    date: '2026-10-23',
    title: 'Grade all, safer edits, and a new Bozo Belt',
    idea: 'Lotti',
    items: [
      'When two or more games are final, the slip shows “Grade all”. One tap grades every finished leg and saves how far each one finished, so the recap faces come out right.',
      'Editing a past week in History no longer wipes its legs’ reactions, trash talk, or close-call picks. Only what you change is changed.',
      'The Bozo Belt is now the full-bozo clown face instead of the emoji.',
    ],
  },
  {
    id: '2026-10-23-e',
    date: '2026-10-23',
    title: 'A key for the faces',
    idea: 'Lotti',
    items: [
      'The recap now has a row of all five faces, clean to full bozo, with how many people got each one that week. Faces nobody got fade out.',
      'Tap it, or “How faces work”, to see what each face means and what counts as a close call or a blowout in each sport.',
    ],
  },
  {
    id: '2026-10-23-d',
    date: '2026-10-23',
    title: 'Close calls and blowouts for typed legs',
    idea: 'Lotti',
    items: [
      'When the commish grades a typed leg Lost, the leg’s panel asks “How bad was the miss?”: Close call, Regular, or Blowout. That sets the face in the recap: face paint, makeup, or the wig.',
      'There’s an optional “Lost by” box too. The number shows in the recap, like “missed by 7”.',
      'Legs picked from a game still work it out from the final score. If one was graded before the game ended, the commish can pick for it the same way.',
    ],
  },
  {
    id: '2026-10-23-c',
    date: '2026-10-23',
    title: 'Go back to an earlier week',
    idea: 'Lotti',
    items: [
      'Settings → Weeks → “Go back to an earlier week” makes a past week this week again. Use it to undo a test or a mistake.',
      'Every later week is deleted, that week’s spin is undone so the wheel can spin it again, and its grades can be cleared too. It shows exactly what will happen before you confirm.',
    ],
  },
  {
    id: '2026-10-23-b',
    date: '2026-10-23',
    title: 'The worse the miss, the worse the makeup',
    idea: 'Lotti',
    items: [
      'In the recap, a lost leg now gets a face for how badly it missed. Lose by a hook and you only get face paint. A normal miss is makeup. Get blown out (two touchdowns in football) and the wig goes on. The wheel’s pick is still full bozo.',
      'The recap says by how much, like “missed by 0.5”.',
      'It works for legs picked from a game and graded from this week on. Typed legs and older weeks count as a normal miss.',
    ],
  },
  {
    id: '2026-10-23-a',
    date: '2026-10-23',
    title: 'The weekly recap',
    idea: 'Lotti',
    items: [
      'After you watch the spin, live or later, the week’s recap slides up: who the wheel picked, and a clown face for everyone. Win and you’re clean, miss and the makeup goes on, and the wheel’s pick is full bozo.',
      'Missed the spin? The first time you open the app after one, it offers to play it for you. “Watch spin” now starts the replay right away too.',
      'Open any past week’s recap from History, or from the Wheel tab. Share it to the group chat from the recap.',
    ],
  },
  {
    id: '2026-10-22-k',
    date: '2026-10-22',
    title: 'Live picks first',
    idea: 'Lotti',
    items: [
      'Add your leg always opens on this week’s games and DraftKings’ lines, even if you typed a leg last time. Typing is still there under “Type it instead,” and anything you typed is kept.',
    ],
  },
  {
    id: '2026-10-22-j',
    date: '2026-10-22',
    title: 'Pick from DraftKings’ lines',
    idea: 'Lotti',
    items: [
      'Add your leg now shows DraftKings’ lines for every upcoming game: spread, total, and moneyline, with prices. Tap one and the pick and odds fill in.',
      'Want a player prop or a different line? Tap “Other bets” on a game, or “Something else” after picking.',
      'Anyone can look over the board from “This week’s lines,” under the slip.',
      'Lines come from ESPN and move, so whoever places the bet should check DraftKings.',
    ],
  },
  {
    id: '2026-10-22-i',
    date: '2026-10-22',
    title: 'A simpler look',
    idea: 'Lotti',
    items: [
      'Tabs moved to the bottom, like an iPhone app.',
      'This week opens with one summary row: who’s on the hook, how many legs are still alive, and what it pays.',
      'Each leg on the slip is one clean line. Tap it for reactions, trash talk, grading, edit, and remove.',
      '“Still waiting on” is one line on the slip, with a Remind button that copies a nudge for the group chat.',
      'Adding a leg opens its own panel instead of a long form at the bottom of the page.',
      'Settings is a short list. Each row opens its own page.',
      'Wheel, Standings, and History say the same things with fewer words. Tap a name in Standings for more.',
      'Fixed: sections on every tab were running into each other.',
    ],
  },
  {
    id: '2026-10-22-h',
    date: '2026-10-22',
    title: 'The elimination wheel',
    idea: 'Lotti',
    items: [
      'The wheel now knocks names out one at a time. Each spin lands on someone who’s safe, their slice drops off, and it spins again. The last name left is the bozo.',
      'Everyone has the same chance as before. It just takes longer to find out. “Skip to the bozo” jumps to the end.',
      'Spins from before the change replay the way they happened.',
      'Member view: in Settings, admins can see the app the way everyone else does. It only hides buttons, so anything you do still counts.',
    ],
  },
  {
    id: '2026-10-22-g',
    date: '2026-10-22',
    title: 'Swipe between tabs',
    items: [
      'Swipe left or right anywhere on the page to move between This week, Wheel, Standings, and History.',
      'Scrolling, typing, and Safari’s edge swipe for “back” work like before.',
    ],
  },
  {
    id: '2026-10-22-f',
    date: '2026-10-22',
    title: 'A cleaner slip on game day',
    items: [
      'A row of dots at the top shows every leg at a glance: green winning, red losing, gold in progress, hollow waiting. Plus “Scores updated 20s ago.”',
      'W/L/P buttons stay out of the way until a picked leg’s game is final. Typed legs still show them. Need to grade early? ⋯ → Grade now.',
      'When a game ends, admins get a one-tap “Mark W” (or L or P) based on the final score.',
      'Edit and Remove moved into the ⋯ menu.',
      'Live lines read cleaner (“Q3 6:12”) and your team’s score is in bold.',
      'Reactions only show the emojis people used. Tap ☺+ to add one.',
    ],
  },
  {
    id: '2026-10-22-e',
    date: '2026-10-22',
    title: 'Outage alerts',
    items: [
      'Admins see a banner when live scores stop loading, so you know it’s ESPN and not you.',
      'The site has a health check that an uptime monitor can watch to email the owner if the database or the scores feed goes down.',
    ],
  },
  {
    id: '2026-10-22-d',
    date: '2026-10-22',
    title: 'Live legs',
    items: [
      'Add your leg by picking it from this week’s games: sport, game, then spread, moneyline, total, or a player prop (football). The pick text writes itself.',
      'Spreads and totals come prefilled with DraftKings’ line. Change it if your bet was different.',
      'Picked legs track live on the slip: “Covering · DET 24, GB 17”, “52 of 75 rush yds” with a progress bar, and how many legs are still alive.',
      'Anything that doesn’t fit (same-game parlays, alternate lines, golf…) still works with “Type it instead.”',
      'Live info is just for the sweat. Admins still grade each leg.',
    ],
  },
  {
    id: '2026-10-22-c',
    date: '2026-10-22',
    title: 'Slip screenshots',
    items: [
      'Placing the bet is now just adding screenshots of the slip: one or several, whatever it takes to fit every leg. The first one marks the bet placed.',
      'Everyone in the league can flip through them from “Placed ✓ · View slip” on the slip.',
      'Whoever’s on the hook, or an admin, can add more or remove one. Removed screenshots are deleted, not just hidden.',
    ],
  },
  {
    id: '2026-10-22-b',
    date: '2026-10-22',
    title: 'Always on the latest version',
    items: [
      'What’s new: this section, so admins can see what changed. Only admins see it.',
      'The app updates itself when you come back to it. If you’re in the middle of typing, you get a Refresh bar instead, so nothing gets lost.',
      'Fixed: switching apps while a spin is playing no longer counts as watching it. The bozo stays hidden until you actually watch.',
      'Admins get a warning if the database needs updating before a new feature works.',
    ],
  },
  {
    id: '2026-10-21-c',
    date: '2026-10-21',
    title: 'The spoiler-free wheel',
    items: [
      'Miss the spin and who it landed on stays hidden everywhere (This week, Wheel, History, Standings) until you watch the replay.',
      'Replay any spin: “Watch it again” on the result, or ▶ on any line of the Wheel log.',
      'Re-spins: earlier spins are crossed out so everyone knows only the latest counts. Admins can delete the crossed-out ones.',
      'If last week settled but was never spun, the wheel spins on last week’s losers and sets this week’s payer.',
      'If you’re on another tab when someone spins, you get “The wheel is spinning! Watch” instead of the name.',
    ],
  },
  {
    id: '2026-10-21-b',
    date: '2026-10-21',
    title: 'Comments and pick deadlines',
    items: [
      'Comment on any pick with 💬. The trash talk stays with the pick in History.',
      'Pick deadline: admins set a weekly lock in Settings (like Sunday 12:55 PM). After it, people can’t add or change their own leg. Admins still can.',
      'Anyone without a leg at the deadline goes in the wheel with the losers.',
      '“Co-commish” is now “Admin.” The owner makes admins in Settings → People signed in.',
      'Invite links always point at the public address, so friends never hit a Vercel login.',
    ],
  },
  {
    id: '2026-10-21-a',
    date: '2026-10-21',
    title: 'Bozo Belt, reactions, and slips',
    items: [
      'The Bozo Belt 🤡 goes to whoever has the most misses this season.',
      'React to picks with 🔥 🙏 🤡 💀.',
      'Whoever’s on the hook can mark the bet placed and attach a screenshot of the slip.',
      'Set a password in Settings and skip the sign-in email.',
      'Leagues start at the current NFL week, and admins can add earlier weeks from History.',
      'Standings show a Solo $100 column: how you’d be doing betting $100 on your own legs.',
    ],
  },
  {
    id: '2026-10-20-a',
    date: '2026-10-20',
    title: 'Bozo Bets is live',
    items: [
      'Your own league with an invite link: everyone adds one leg, admins grade, and the wheel picks next week’s bozo.',
      'Standings, history, and a wheel that every phone watches live.',
    ],
  },
];

/** Releases newer than the one last seen. Never seen one (or it's gone): just the latest. */
export function unseenReleases(seenId, releases = RELEASES) {
  const i = releases.findIndex((r) => r.id === seenId);
  return i === -1 ? releases.slice(0, 1) : releases.slice(0, i);
}

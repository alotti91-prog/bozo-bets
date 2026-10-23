// Release notes. Admins see these in Settings → What's new, and get a dot on
// the gear when there's a new one. Newest first. Add an entry whenever a change
// people will notice ships: plain words, what it does for the group, no tech talk.
// If someone asked for it, credit them with idea: 'Name'.

export const RELEASES = [
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

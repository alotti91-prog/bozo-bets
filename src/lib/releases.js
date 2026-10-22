// Release notes. Admins see these in Settings → What's new, and get a dot on
// the gear when there's a new one. Newest first. Add an entry whenever a change
// people will notice ships: plain words, what it does for the group, no tech talk.
// If someone asked for it, credit them with idea: 'Name'.

export const RELEASES = [
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

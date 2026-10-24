// What goes on the shareable recap image (screens/recap/recapImage.js draws it):
// the same story as the recap sheet, flattened into plain text and face names.
// Pure, covered by recap.test.js.
import { FACES, personLine } from './recap.js';
import { money, dollars, fmtOdds } from './odds.js';

/**
 * r: weekRecap() output plus r.awards. Returns
 *   { brand, title, hero: { kind: 'bozo' | 'hit' | 'busted', faces, big, tag, tone, sub }, stats, awards, people }
 * hero.faces: one face (the bozo) or up to six (a hit). tone: 'loss' | 'win'.
 * Each person's detail is [pick, what happened] for one leg ("Shough 240+ pass yds",
 * "had 212 pass yds, 28 short"), or [their whole line] otherwise; tone colors the
 * second line: 'win' | 'loss' | ''.
 */
export function recapCard(r, pname, leagueName = 'Bozo Bets') {
  const hit = r.info.status === 'hit';
  let hero;
  if (hit) {
    hero = {
      kind: 'hit', faces: r.people.slice(0, 6).map((p) => p.face), big: 'It hit.', tone: 'win',
      tag: `${dollars(r.info.stake)} paid ${money(r.info.payout)} · ${money(r.each)} each`,
      sub: r.bozo ? `${pname(r.bozo)} puts in Week ${r.nextN}’s ${dollars(r.stake)}` : '',
    };
  } else if (r.bozo) {
    hero = { kind: 'bozo', faces: ['full'], big: pname(r.bozo), tone: 'loss', tag: 'Full bozo · picked by the wheel', sub: `Puts in Week ${r.nextN}’s ${dollars(r.stake)}` };
  } else {
    hero = { kind: 'busted', faces: ['makeup'], big: 'Busted', tone: 'loss', tag: '', sub: 'The wheel hasn’t been spun yet.' };
  }
  return {
    brand: leagueName || 'Bozo Bets',
    title: `Week ${r.week.n} recap`,
    hero,
    stats: hit ? '' : `${r.hits} of ${r.total} legs hit · Would’ve paid ${money(r.info.projected)}`,
    awards: (r.awards || []).map((a) => ({ icon: a.icon, title: a.title, name: pname(a.who), note: a.note })),
    people: r.people.map((p) => {
      const line = personLine(p);
      const one = p.legs.length === 1 ? p.legs[0] : null;
      return {
        face: p.face,
        name: pname(p.id),
        label: p.face === 'clean' ? '' : FACES[p.face],
        line,
        detail: one ? [one.pick, line.slice(one.pick.length + 3)] : [line],
        tone: one ? ({ W: 'win', L: 'loss' }[one.result] || '') : '',
        odds: one ? fmtOdds(Number(one.odds)) : '',
      };
    }),
  };
}

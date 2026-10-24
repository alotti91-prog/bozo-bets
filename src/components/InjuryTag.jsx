import { injuryTag } from '../lib/depth.js';

/**
 * A small injury tag like DraftKings shows: gold "Q" for questionable, red "D",
 * "Out", "IR" and so on for worse. Nothing when the player's healthy.
 * Screen readers hear the full status.
 */
export default function InjuryTag({ s }) {
  const tag = injuryTag(s);
  if (!tag) return null;
  return <span className={`inj-tag${s === 'Questionable' ? '' : ' is-out'}`} role="img" aria-label={`Injury: ${s}`} title={s}>{tag}</span>;
}

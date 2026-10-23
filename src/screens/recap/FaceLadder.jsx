import BozoFace from '../../components/BozoFace.jsx';
import { FACE_ORDER, FACE_SHORT, faceCounts } from '../../lib/recap.js';

/**
 * The recap's key: all five faces, best to worst, with how many people got
 * each this week. Faces nobody got fade out. Tapping it opens the rules.
 */
export default function FaceLadder({ people, hit, onOpen }) {
  const counts = faceCounts(people);
  const said = FACE_ORDER.map((f) => `${counts[f]} ${FACE_SHORT[f].toLowerCase()}`).join(', ');
  return (
    <button type="button" className="ladder" onClick={onOpen} aria-label={`Faces this week: ${said}. How the faces work.`}>
      {FACE_ORDER.map((f) => (
        <span key={f} className={`rung rung-${f}${counts[f] ? '' : ' is-empty'}${hit && f === 'clean' ? ' is-win' : ''}`}>
          <span className="rung-face">
            <BozoFace face={f} size={38} />
            {counts[f] > 0 && <b className="rung-count">{counts[f]}</b>}
          </span>
          <span className="rung-label">{FACE_SHORT[f]}</span>
        </span>
      ))}
    </button>
  );
}

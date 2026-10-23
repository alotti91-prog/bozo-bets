import BozoFace from '../../components/BozoFace.jsx';
import { FACE_ORDER, FACES, cutoffRows } from '../../lib/recap.js';

const MEANS = {
  clean: 'Your leg won or pushed.',
  paint: 'Lost, but only just. A bad beat.',
  makeup: 'A regular miss, or no leg that week.',
  wig: 'Blown out.',
  full: 'The wheel picked you. You put in next week.',
};

// "How the faces work": a page inside the recap sheet, opened from the ladder.
export default function FaceRules() {
  return (
    <>
      <ol className="rows face-rules">
        {FACE_ORDER.map((f) => (
          <li key={f} className="row">
            <BozoFace face={f} size={52} />
            <span className="row-label">
              <b className={f === 'full' ? 'face-full' : ''}>{FACES[f]}</b>
              <span className="row-note">{MEANS[f]}</span>
            </span>
          </li>
        ))}
      </ol>

      <section aria-labelledby="cutoffs-label">
        <h3 className="group-label" id="cutoffs-label">What counts as close or a blowout</h3>
        <table className="cutoffs">
          <thead><tr><th scope="col"><span className="sr-only">Sport</span></th><th scope="col">Face paint</th><th scope="col">Wig</th></tr></thead>
          <tbody>
            {cutoffRows().map((r) => (
              <tr key={r.label}><th scope="row">{r.label}</th><td>{r.close}</td><td>{r.blowout}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="fine">How far it finished from the line. Legs picked from a game are measured from the final score. For typed legs, the commish picks. Small props, like TDs or a few catches, are just a miss.</p>
      </section>
    </>
  );
}

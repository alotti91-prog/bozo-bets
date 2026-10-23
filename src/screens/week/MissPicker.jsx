import { useState } from 'react';
import { marginFromLostBy } from '../../lib/recap.js';

const CHOICES = [['close', 'Close call'], [null, 'Regular'], ['blowout', 'Blowout']];

/**
 * Admins, on a lost leg the app can't measure (a typed leg, or one graded
 * without a final score): how bad was the miss? Sets the face in the recap.
 * Typed legs can also note how much they lost by. onSave(patch) updates the leg.
 */
export default function MissPicker({ leg, onSave }) {
  const typed = !leg.bet;
  const [by, setBy] = useState(leg.margin != null ? String(Math.abs(Number(leg.margin))) : '');
  const [err, setErr] = useState('');

  function saveBy() {
    const margin = marginFromLostBy(by);
    if (margin === undefined) { setErr('Use a number, like 3 or 6.5.'); return; }
    setErr('');
    if (margin !== (leg.margin == null ? null : Number(leg.margin))) onSave({ margin });
  }

  return (
    <div className="miss-pick">
      <span className="label-sm" id={`miss-${leg.id}`}>How bad was the miss?</span>
      <div className="segmented" role="group" aria-labelledby={`miss-${leg.id}`}>
        {CHOICES.map(([v, label]) => (
          <button key={label} type="button" aria-pressed={(leg.miss || null) === v} onClick={() => onSave({ miss: v })}>{label}</button>
        ))}
      </div>
      {typed && (
        <label className="p-row lost-by">
          <span>Lost by</span>
          <input inputMode="decimal" placeholder="Optional, like 3.5" aria-label="Lost by" value={by}
            onChange={(e) => setBy(e.target.value)} onBlur={saveBy}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
        </label>
      )}
      {err ? <p className="hint err">{err}</p> : (
        <p className="hint">Sets their face in the recap. {typed ? 'A typed leg can’t be measured from the score.' : 'There was no final score to measure it.'}</p>
      )}
    </div>
  );
}

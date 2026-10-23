import { useState } from 'react';
import { supabase, friendly } from '../lib/supabase.js';
import { toast } from '../lib/ui.js';

export const EMOJI = ['🔥', '🙏', '🤡', '💀'];
const LABEL = { '🔥': 'Fire', '🙏': 'Praying', '🤡': 'Clown', '💀': 'Dead' };

/**
 * Emoji reactions on one pick: four buttons with counts (the leg panel).
 * Tapping adds yours; tapping again takes it back. readOnly shows just the
 * counts as text (History).
 */
export default function Reactions({ leg, reactions, userId, nameOfUser, reload, readOnly = false }) {
  const [busy, setBusy] = useState(null);
  const here = reactions.filter((r) => r.leg_id === leg.id);
  const counts = EMOJI.map((e) => {
    const rs = here.filter((r) => r.emoji === e);
    return { e, n: rs.length, mine: rs.some((r) => r.user_id === userId), who: rs.map((r) => nameOfUser(r.user_id)) };
  });

  if (readOnly) {
    const shown = counts.filter((c) => c.n);
    if (!shown.length) return null;
    return <span className="react-sum" aria-label={shown.map((c) => `${c.n} ${LABEL[c.e]}`).join(', ')}>{shown.map((c) => `${c.e} ${c.n}`).join('  ')}</span>;
  }

  async function toggle(c) {
    if (!userId || busy) return;
    setBusy(c.e);
    const { error } = c.mine
      ? await supabase.from('reactions').delete().eq('leg_id', leg.id).eq('user_id', userId).eq('emoji', c.e)
      : await supabase.from('reactions').insert({ leg_id: leg.id, emoji: c.e });
    setBusy(null);
    if (error) { toast(friendly(error)); return; }
    reload();
  }

  return (
    <div className="react-grid" role="group" aria-label="Reactions">
      {counts.map((c) => (
        <button key={c.e} type="button" className="react" aria-pressed={c.mine} disabled={!userId || busy === c.e}
          title={c.n ? c.who.join(', ') : LABEL[c.e]}
          aria-label={`${LABEL[c.e]}${c.n ? `, ${c.n}: ${c.who.join(', ')}` : ''}`}
          onClick={() => toggle(c)}>
          <span aria-hidden="true">{c.e}</span>{c.n > 0 && <b>{c.n}</b>}
        </button>
      ))}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { toast, store } from '../../lib/ui.js';
import { autoGrades } from '../../lib/autograde.js';

const NONE = { grade: [], check: [] };

/**
 * Auto-grading for the slip. While an admin has the app open (on, since only the
 * commish may set grades), picked legs grade themselves once their game is Final,
 * saving the margin like a hand grade (see autograde.js for what waits for a
 * person). A leg the commish graded or cleared by hand is left alone from then on
 * (remembered on this phone). Returns { check: legs that need a look, markHandled(id) }.
 */
export default function useAutoGrade(legs, statusOf, on, reload) {
  const [handled, setHandled] = useState(() => new Set(store.get('bz-hand-graded', [])));
  const markHandled = (id) => setHandled((prev) => {
    const next = new Set(prev).add(id);
    store.set('bz-hand-graded', [...next].slice(-300));
    return next;
  });
  const tried = useRef(new Set()); // asked once per visit, so a refused write doesn't repeat
  const auto = on ? autoGrades(legs, statusOf, handled) : NONE;
  const key = auto.grade.map((g) => g.leg.id).join();
  useEffect(() => {
    const todo = auto.grade.filter((g) => !tried.current.has(g.leg.id));
    if (!todo.length) return;
    todo.forEach((g) => tried.current.add(g.leg.id));
    Promise.all(todo.map(({ leg, result, margin }) => supabase.from('legs').update('margin' in leg ? { result, margin } : { result }).eq('id', leg.id)))
      .then((res) => {
        const ok = res.filter((r) => !r.error).length;
        if (ok) toast(`Graded ${ok} finished leg${ok === 1 ? '' : 's'} from the final score.`);
        reload();
      });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { check: auto.check, markHandled };
}

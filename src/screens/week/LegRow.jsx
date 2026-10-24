import { fmtOdds } from '../../lib/odds.js';
import { legState, suggestedGrade } from '../../lib/bets.js';
import { Belt, BozoTag, IconComment } from '../../components/common.jsx';
import { EMOJI } from '../../components/Reactions.jsx';
import InjuryTag from '../../components/InjuryTag.jsx';
import LiveLine from './LiveLine.jsx';

const WORD = { W: 'Won', L: 'Lost', P: 'Push' };
const TONE = { W: 'win', L: 'loss', P: 'pre' };

/**
 * One leg on the slip: a status dot, who, the pick and odds, one live line, and
 * reaction and comment counts once there are any. Tapping it opens the leg
 * panel (LegSheet). Admins get a one-tap "Mark W" when a picked leg's game is final.
 *   st   live status from liveStatus() (null for typed legs or no feed)
 *   inj  the player's injury status for an NFL prop before kickoff (legInjury()), or null
 *   fx   'shake' (it just busted) or 'carry' (last leg standing), from useSweat
 *   here the leg's owner has the app open right now (a green dot after their name)
 */
export default function LegRow({ leg, st, inj, fx, here, me, isAdmin, beltId, bozoId, pname, reactions, comments, onOpen, onGrade }) {
  const who = pname(leg.player_id);
  const mine = me && leg.player_id === me;
  const state = legState(leg, st);
  const suggest = isAdmin && !leg.result ? suggestedGrade(st) : null;
  const reacts = EMOJI.map((e) => [e, reactions.filter((r) => r.leg_id === leg.id && r.emoji === e).length]).filter(([, n]) => n);
  const talk = comments.filter((c) => c.leg_id === leg.id).length;
  // A graded leg whose game we can't see (no feed, or not started) shows its grade instead.
  const showLive = leg.bet?.game && !(leg.result && (!st || st.tone === 'pre'));

  return (
    <li className={`leg is-${state}${fx ? ` is-${fx}` : ''}`}>
      <button type="button" className="leg-main" onClick={onOpen} aria-haspopup="dialog">
        <span className="leg-dot" aria-hidden="true" />
        <span className="leg-body">
          <span className="leg-who">{who}{here && <span className="here-dot" role="img" aria-label="(here now)" title="Here now" />}<Belt on={beltId === leg.player_id} /><BozoTag on={bozoId === leg.player_id} />{mine && <span className="you"> · you</span>}</span>
          <span className="leg-pick">{leg.pick}{inj && <> <InjuryTag s={inj} /></>}</span>
          {showLive ? <LiveLine bet={leg.bet} s={st} /> : (
            <span className={`leg-live tone-${TONE[leg.result] || 'pre'}`}>
              <span className="ll-row">{leg.result && <strong>{WORD[leg.result]}</strong>}<span>{leg.sport}</span></span>
            </span>
          )}
          {(reacts.length > 0 || talk > 0) && (
            <span className="leg-social">
              {reacts.map(([e, n]) => <span key={e}>{e} {n}</span>)}
              {talk > 0 && <span className="leg-talk"><IconComment />{talk}</span>}
            </span>
          )}
        </span>
        <span className="leg-odds">{fmtOdds(leg.odds)}</span>
      </button>
      {suggest && (
        <button type="button" className="mark-btn" onClick={() => onGrade(suggest)} aria-label={`Final. Mark ${who}’s leg ${WORD[suggest]}`}>
          Final · Mark {suggest}
        </button>
      )}
    </li>
  );
}

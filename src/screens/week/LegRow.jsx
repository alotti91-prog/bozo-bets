import { fmtOdds } from '../../lib/odds.js';
import { suggestedGrade, gradeHidden } from '../../lib/bets.js';
import { Belt } from '../../components/common.jsx';
import { LegTalk } from '../../components/Comments.jsx';

const WORD = { W: 'Won', L: 'Lost', P: 'Push' };

/**
 * One leg on the slip: who, odds, pick, the live line, grading, the ⋯ menu, reactions and comments.
 * Which menu or confirm is open lives in WeekTab, so only one is open at a time.
 *   st          live status from liveStatus() (null for typed legs or no feed)
 *   menuOpen    the ⋯ menu is open; onMenu(true|false)
 *   confirming  "Remove this leg?" is showing; onConfirm(true|false)
 *   gradeNow    an admin chose "Grade now" before the game ended; onGradeNow()
 */
export default function LegRow({ leg, st, me, isAdmin, locked, beltId, pname, menuOpen, onMenu, confirming, onConfirm, gradeNow, onGradeNow,
  onGrade, onRemove, onEdit, data, userId, nameOfUser, reload }) {
  const who = pname(leg.player_id);
  const mine = me && leg.player_id === me;
  const canEdit = isAdmin || (mine && !leg.result && !locked);
  const hideGrade = gradeHidden(leg, st) && !gradeNow;
  const suggest = isAdmin && !leg.result ? suggestedGrade(st) : null;
  const showPill = !isAdmin && (leg.result || !leg.bet?.game);
  // Nothing to act on (a live picked leg): put the sport tag and ⋯ at the end of the reactions row.
  const compact = !suggest && !(isAdmin && !hideGrade) && !showPill && leg.result !== 'L' && !confirming && !menuOpen;
  const moreBtn = canEdit && <button type="button" className="more-btn" aria-label={`More for ${who}’s leg`} onClick={() => onMenu(true)}>{'⋯'}</button>;

  return (
    <li className={`leg${leg.result ? ' is-' + leg.result : ''}`}>
      <span className="leg-who">{who}<Belt on={beltId === leg.player_id} />{mine && <span className="you"> {'·'} you</span>}</span>
      <span className="leg-odds">{fmtOdds(leg.odds)}</span>
      <span className="leg-pick">{leg.pick}</span>
      {leg.bet?.game && <LiveLine bet={leg.bet} s={st} />}
      {!compact && <div className="leg-meta">
        <span className="tag">{leg.sport}</span>
        {suggest && (
          <button type="button" className="mark-btn" onClick={() => onGrade(suggest)} aria-label={`Final. Mark ${who}’s leg ${WORD[suggest]}`}>
            Mark {suggest}
          </button>
        )}
        {isAdmin ? (!hideGrade && (
          <div className="grade" role="group" aria-label={`Result for ${who}`}>
            {['W', 'L', 'P'].map((r) => (
              <button key={r} type="button" className={`g-${r}`} aria-pressed={leg.result === r} aria-label={WORD[r]} onClick={() => onGrade(r)}>{r}</button>
            ))}
          </div>
        )) : showPill && (
          <span className={`res res-${leg.result || 'none'}`}>{WORD[leg.result] || 'Pending'}</span>
        )}
        {canEdit && (confirming ? (
          <span className="confirm">Remove this leg?
            <button className="link danger" onClick={onRemove}>Remove</button>
            <button className="link" onClick={() => onConfirm(false)}>Keep</button>
          </span>
        ) : menuOpen ? (
          <span className="leg-menu">
            <button className="link" onClick={() => { onMenu(false); onEdit(); }}>Edit</button>
            <button className="link" onClick={() => { onMenu(false); onConfirm(true); }}>Remove</button>
            {isAdmin && hideGrade && <button className="link" onClick={() => { onMenu(false); onGradeNow(); }}>Grade now</button>}
            <button className="link" onClick={() => onMenu(false)} aria-label="Close menu">Done</button>
          </span>
        ) : moreBtn)}
        {leg.result === 'L' && <span className="bozo-mark">Bozo</span>}
      </div>}
      <LegTalk leg={leg} data={data} userId={userId} isAdmin={isAdmin} nameOfUser={nameOfUser} reload={reload} who={who}
        trailing={compact ? <><span className="tag">{leg.sport}</span>{moreBtn}</> : null} />
    </li>
  );
}

// Live state under a picked leg: "Covering · DET 24, GB 17 · Q3 6:12" (your team in bold), with a bar for overs.
function LiveLine({ bet, s }) {
  const when = bet.game.start ? new Date(bet.game.start).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  if (!s || s.tone === 'pre') return <span className="leg-live tone-pre"><span className="ll-row"><span>{bet.game.short}</span>{when && <span>{when}</span>}</span></span>;
  const team = (t) => <span className={t.mine ? 'll-mine' : undefined}>{t.abbr} {t.score}</span>;
  return (
    <span className={`leg-live tone-${s.tone}`}>
      <span className="ll-row">
        <strong>{s.label}</strong>
        <span>{team(s.away)}, {team(s.home)}</span>
        <span>{s.clock}</span>
      </span>
      {s.progress != null && !s.done && <span className="leg-bar" aria-hidden="true"><span style={{ width: `${Math.round(s.progress * 100)}%` }} /></span>}
    </span>
  );
}

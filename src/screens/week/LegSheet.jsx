import { useState } from 'react';
import { fmtOdds } from '../../lib/odds.js';
import { gradeHidden, suggestedGrade } from '../../lib/bets.js';
import { autoCheck, WHY } from '../../lib/autograde.js';
import { Sheet, IconChevR } from '../../components/common.jsx';
import Reactions from '../../components/Reactions.jsx';
import Comments from '../../components/Comments.jsx';
import LiveLine from './LiveLine.jsx';
import MissPicker from './MissPicker.jsx';
import { needsMissPick } from '../../lib/recap.js';

const WORD = { W: 'Won', L: 'Lost', P: 'Push' };

/**
 * Everything about one leg, opened by tapping it on the slip: the live line,
 * reactions, trash talk, and, for whoever is allowed, grading (admins),
 * editing, and removing it. The database enforces who can do what.
 */
export default function LegSheet({ leg, st, data, me, isAdmin, locked, pname, userId, nameOfUser, bozoUser, reload, onGrade, onMiss, onEdit, onRemove, onClose }) {
  const [gradeNow, setGradeNow] = useState(false); // an admin grading before the game is final
  const [confirmRm, setConfirmRm] = useState(false);
  const who = pname(leg.player_id);
  const mine = !!me && leg.player_id === me;
  const canEdit = isAdmin || (mine && !leg.result && !locked);
  const hideGrade = gradeHidden(leg, st) && !gradeNow;
  const suggest = isAdmin && !leg.result ? suggestedGrade(st) : null;
  const look = isAdmin ? autoCheck(leg, st)?.why : null; // final, but auto-grading left it for a person
  const comments = (data.comments || []).filter((c) => c.leg_id === leg.id);

  return (
    <Sheet kicker={mine ? `${who} · you` : who} title={leg.pick} onClose={onClose}>
      <div className="leg-card">
        <div className="lc-row">
          {leg.bet?.game ? <LiveLine bet={leg.bet} s={st} /> : (
            <span className={`lc-status${leg.result ? ' r-' + leg.result : ''}`}>{leg.result ? WORD[leg.result] : 'Not graded yet'}</span>
          )}
          <b className="lc-odds">{fmtOdds(leg.odds)}</b>
        </div>
        <span className="lc-meta">{leg.sport}{leg.bet?.game ? ' · tracks live' : ' · typed in'}{leg.result && leg.bet?.game ? ` · graded ${WORD[leg.result].toLowerCase()}` : ''}</span>
      </div>

      <Reactions leg={leg} reactions={data.reactions || []} userId={userId} nameOfUser={nameOfUser} reload={reload} />

      <div className="group">
        <span className="group-label">Trash talk</span>
        <Comments leg={leg} comments={comments} userId={userId} isAdmin={isAdmin} nameOfUser={nameOfUser} bozoUser={bozoUser} reload={reload}
          mode="all" setMode={() => {}} who={who} />
      </div>

      {isAdmin && (
        <div className="group">
          <span className="group-label">Grade</span>
          {look && <p className="hint">{look === 'absent' ? `${leg.bet.player?.name || 'The player'} ` : ''}{WHY[look][1]}</p>}
          {hideGrade ? (
            <div className="rows">
              <button type="button" className="row" onClick={() => setGradeNow(true)}>
                <span className="row-label">Grade now<span className="row-note">The game isn’t final yet</span></span><IconChevR />
              </button>
            </div>
          ) : (
            <div className="segmented grade" role="group" aria-label={`Result for ${who}`}>
              {['W', 'L', 'P'].map((r) => (
                <button key={r} type="button" className={`g-${r}`} aria-pressed={leg.result === r} onClick={() => onGrade(r)}>{WORD[r]}</button>
              ))}
            </div>
          )}
          {suggest && <p className="hint">The final score says {WORD[suggest].toLowerCase()}.</p>}
          {onMiss && 'miss' in leg && needsMissPick(leg) && <MissPicker key={leg.id} leg={leg} onSave={onMiss} />}
        </div>
      )}

      {canEdit && (
        <div className="rows">
          <button type="button" className="row" onClick={onEdit}><span className="row-label">Edit leg</span><IconChevR /></button>
          {confirmRm ? (
            <div className="row row-confirm">
              <span className="row-label">Remove this leg?</span>
              <button type="button" className="text-btn danger" onClick={onRemove}>Remove</button>
              <button type="button" className="text-btn" onClick={() => setConfirmRm(false)}>Keep</button>
            </div>
          ) : <button type="button" className="row is-danger" onClick={() => setConfirmRm(true)}><span className="row-label">Remove leg</span></button>}
        </div>
      )}
    </Sheet>
  );
}

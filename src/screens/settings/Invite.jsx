import { useState } from 'react';
import { shareText } from '../../lib/ui.js';
import { siteUrl } from '../../lib/site.js';
import { IconShare } from '../../components/common.jsx';
import { settingsRpc } from './rpc.js';

// The invite code and link. The owner can replace the code (the old one stops working).
export default function Invite({ league, isOwner, reload }) {
  const [confirm, setConfirm] = useState(false);
  const link = `${siteUrl()}${window.location.pathname}?join=${league.invite_code}`;
  return (
    <div className="stack">
      <p className="invite-code" aria-label={`Invite code ${league.invite_code.split('').join(' ')}`}>{league.invite_code}</p>
      <p className="sub">Friends open the link, sign in with their email, and pick their name.</p>
      <button type="button" className="btn primary big" onClick={() => shareText(`Join our Bozo Bets league: ${link}\nInvite code: ${league.invite_code}`, { title: 'Join Bozo Bets', successMsg: 'Invite copied. Paste it in the group chat.' })}>
        <IconShare />Share invite
      </button>
      <p className="fine" style={{ userSelect: 'all', overflowWrap: 'anywhere' }}>{link}</p>
      {isOwner && (confirm ? (
        <div className="confirm-box">
          <p>Make a new code? The old one stops working right away.</p>
          <div className="btns">
            <button type="button" className="btn small nose" onClick={async () => { setConfirm(false); await settingsRpc('regenerate_invite', { p_league: league.id }, 'New code ready. The old one stopped working.', reload); }}>Replace code</button>
            <button type="button" className="btn small" onClick={() => setConfirm(false)}>Keep it</button>
          </div>
        </div>
      ) : <button type="button" className="text-btn muted" onClick={() => setConfirm(true)}>New code</button>)}
    </div>
  );
}

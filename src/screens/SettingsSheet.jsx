import { useState } from 'react';
import { store, initials } from '../lib/ui.js';
import { dollars } from '../lib/odds.js';
import { weeklyRule } from '../lib/deadline.js';
import { unseenReleases } from '../lib/releases.js';
import { Sheet, IconChevR, IconShare, IconClock } from '../components/common.jsx';
import WhatsNew from './settings/WhatsNew.jsx';
import PasswordForm from './settings/PasswordForm.jsx';
import DeadlineForm from './settings/DeadlineForm.jsx';
import LeagueForm from './settings/LeagueForm.jsx';
import PlayersForm from './settings/PlayersForm.jsx';
import People from './settings/People.jsx';
import Weeks from './settings/Weeks.jsx';
import Invite from './settings/Invite.jsx';
import Profile from './settings/Profile.jsx';

const ROLE = { owner: 'Owner', admin: 'Admin', member: 'Member' };
const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const IconPeople = () => <svg {...svg}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5A6.5 6.5 0 0 1 21.5 20" /></svg>;
const IconCheckIn = () => <svg {...svg}><circle cx="10" cy="8" r="3.5" /><path d="M3.5 20a6.5 6.5 0 0 1 11-4.7M15.5 18.5l2 2 4-4.5" /></svg>;
const IconStar = () => <svg {...svg}><path d="m12 3 2.4 5.6 5.6.8-4.3 3.9 1.3 5.9L12 16.3 7 19.2l1.3-5.9L4 9.4l5.6-.8z" /></svg>;
const IconEye = () => <svg {...svg}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>;
const IconKey = () => <svg {...svg}><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M14.5 8.5l2 2" /></svg>;

// Settings: a short list of rows. Each opens its own page (the forms live in ./settings/).
export default function SettingsSheet({ data, userId, member, isAdmin, isOwner, reload, onClose, onChangePlayer, leagues, onSwitchLeague, onAddLeague, onSignOut, onNotesSeen, canPreview, previewing, onPreview }) {
  const [page, setPage] = useState(null);
  const league = data.league;
  const cur = data.weeks[data.weeks.length - 1];
  const pname = (id) => data.players.find((p) => p.id === id)?.name || 'Unknown';
  const myName = member?.player_id ? pname(member.player_id) : null;
  const hasPw = store.get('bz-has-pw', false);
  const unseen = isAdmin ? unseenReleases(store.get('bz-seen-release')).length : 0;

  const pages = {
    profile: ['You', <Profile key="p" data={data} member={member} pname={pname} leagues={leagues} onChangePlayer={onChangePlayer} onSwitchLeague={onSwitchLeague} onAddLeague={onAddLeague} />],
    invite: ['Invite friends', <Invite key="i" league={league} isOwner={isOwner} reload={reload} />],
    deadline: ['Pick deadline', <DeadlineForm key={`${league.lock_dow}-${league.lock_time}-${cur?.lock_at}`} data={data} reload={reload} />],
    players: ['Players', <PlayersForm key="pl" data={data} reload={reload} />],
    people: ['People signed in', <People key="pe" data={data} userId={userId} isOwner={isOwner} reload={reload} />],
    league: ['League name and stake', <LeagueForm key="l" league={league} reload={reload} />],
    weeks: ['Weeks', <Weeks key="w" data={data} isOwner={isOwner} reload={reload} />],
    whatsnew: ['What’s new', <WhatsNew key="n" onSeen={onNotesSeen} />],
    password: [hasPw ? 'Change password' : 'Set a password', <PasswordForm key="pw" />],
  };
  const open = page && pages[page];

  return (
    <Sheet title={open ? open[0] : 'Settings'} onClose={onClose} onBack={open ? () => setPage(null) : undefined} backLabel="Settings">
      {open ? open[1] : (
        <>
          <button type="button" className="profile-row" onClick={() => setPage('profile')}>
            <span className="avatar" aria-hidden="true">{initials(myName || member?.email || '?')}</span>
            <span className="profile-text"><b>{myName || 'Not linked to a player'}</b><span>{ROLE[member?.role] || 'Member'} · {league.name}</span></span>
            <IconChevR />
          </button>

          <div className="rows">
            <Row icon={<IconShare />} tint="nose" label="Invite friends" value={league.invite_code} onClick={() => setPage('invite')} />
          </div>

          {isAdmin && (
            <Group label="League">
              <Row icon={<IconClock />} tint="orange" label="Pick deadline" value={weeklyRule(league)} onClick={() => setPage('deadline')} />
              <Row icon={<IconPeople />} tint="blue" label="Players" value={data.players.filter((p) => p.active).length} onClick={() => setPage('players')} />
              <Row icon={<IconCheckIn />} tint="teal" label="People signed in" value={data.members.length} onClick={() => setPage('people')} />
              <Row icon={<b>$</b>} tint="green" label="League name and stake" value={dollars(league.stake)} onClick={() => setPage('league')} />
            </Group>
          )}

          {canPreview && (
            <Group label="Admin">
              {isAdmin && <Row icon={<IconStar />} tint="purple" label="What’s new" badge={unseen ? `${unseen} new` : null} onClick={() => setPage('whatsnew')} />}
              <div className="row">
                <span className="row-icon tint-gold" aria-hidden="true"><IconEye /></span>
                <span className="row-label" id="member-view-label">Member view<span className="row-note">Only hides buttons. Anything you do still counts.</span></span>
                <button type="button" role="switch" className="switch" aria-checked={previewing} aria-labelledby="member-view-label" onClick={() => onPreview(!previewing)}><span /></button>
              </div>
              {isAdmin && <Row icon={<b>#</b>} tint="gray" label="Weeks" value={cur ? `Week ${cur.n}` : null} onClick={() => setPage('weeks')} />}
            </Group>
          )}

          <Group label="Account">
            <Row icon={<IconKey />} tint="gray" label="Password" value={hasPw ? 'Set' : 'Not set'} onClick={() => setPage('password')} />
            <button type="button" className="row is-danger" onClick={onSignOut}><span className="row-label">Sign out</span></button>
          </Group>

          <p className="fine center">Bozo Bets · made by Chris &amp; Andrew</p>
        </>
      )}
    </Sheet>
  );
}

function Group({ label, children }) {
  return (
    <div className="group">
      <span className="group-label">{label}</span>
      <div className="rows">{children}</div>
    </div>
  );
}

function Row({ icon, tint, label, value, badge, onClick }) {
  return (
    <button type="button" className="row" onClick={onClick}>
      {icon && <span className={`row-icon tint-${tint}`} aria-hidden="true">{icon}</span>}
      <span className="row-label">{label}</span>
      {badge && <span className="badge">{badge}</span>}
      {value != null && <span className="row-value">{value}</span>}
      <IconChevR />
    </button>
  );
}

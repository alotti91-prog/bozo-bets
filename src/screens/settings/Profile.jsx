import { IconChevR } from '../../components/common.jsx';

// You: which player you are, and your leagues.
export default function Profile({ data, member, pname, leagues, onChangePlayer, onSwitchLeague, onAddLeague }) {
  const league = data.league;
  const linked = !!member?.player_id;
  return (
    <div className="stack">
      <p>{linked ? <>You{'’'}re <strong>{pname(member.player_id)}</strong> in {league.name}.</> : 'You’re not linked to a player yet.'}</p>
      <div className="rows">
        <button type="button" className="row" onClick={onChangePlayer}><span className="row-label">{linked ? 'I’m someone else' : 'Pick my name'}</span><IconChevR /></button>
      </div>
      <div className="group">
        <span className="group-label">Your leagues</span>
        <div className="rows">
          {leagues.map((l) => (
            <button key={l.league_id} type="button" className="row" aria-current={l.league_id === league.id ? 'true' : undefined} onClick={() => onSwitchLeague(l.league_id)}>
              <span className="row-label">{l.leagues?.name || 'League'}</span>
              {l.league_id === league.id && <span className="row-value">Current</span>}
            </button>
          ))}
          <button type="button" className="row" onClick={onAddLeague}><span className="row-label">Join or start another league</span><IconChevR /></button>
        </div>
      </div>
    </div>
  );
}

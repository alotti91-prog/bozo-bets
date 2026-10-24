import { useEffect, useState } from 'react';
import { PROP_CATS, STAT_POS, STATS, propCatOf, propPlayers } from '../lib/bets.js';
import { getDepth } from '../lib/scores.js';
import { injuryTag, depthOf } from '../lib/depth.js';

// Short names for the stat buttons inside a category ("Yards" under Passing).
const CHIP = {
  passYds: 'Yards', passTd: 'TDs', passCmp: 'Completions', int: 'INTs',
  rushYds: 'Yards', rushAtt: 'Carries', rushRecYds: 'Rush + rec',
  recYds: 'Yards', rec: 'Catches', td: 'Anytime TD',
};

/**
 * A player prop, the DraftKings way: pick a category (Passing, Rushing,
 * Receiving, TDs), then the stat, then a player. Only players who'd have that
 * line show, grouped by team, most likely positions first. For the NFL, Sleeper's
 * depth charts put starters up front (the rest behind "Show all players") and add
 * injury tags. Once picked, the list folds down to that player. The over/under
 * and number come after, in BetPicker.
 *   b/set     picker state and its updater
 *   teams     [[side, team], ...] for the game
 *   roster    { list: [{ id, name, pos, team }], err } or null while loading
 */
export default function PropPicker({ b, set, teams, roster, onTypeInstead }) {
  const [find, setFind] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [depth, setDepth] = useState(null); // NFL depth charts; null = none (everyone shows)
  useEffect(() => {
    let live = true;
    getDepth(b.sport).then((d) => { if (live) setDepth(d); });
    return () => { live = false; };
  }, [b.sport]);
  const cat = propCatOf(b.stat);
  const posOf = (id) => roster?.list.find((p) => p.id === id)?.pos || null;
  const fits = (player, stat) => !player || !roster || STAT_POS[stat].includes(posOf(player.id));
  // A new stat: keep the player if they'd still have that line; the number starts over.
  const pickStat = (stat) => {
    setFind(''); setShowAll(false);
    set({ stat, player: fits(b.player, stat) ? b.player : null, side: STATS[stat].yesNo ? null : b.side, lineText: '', lineAuto: false });
  };

  const groups = cat && roster && !roster.err ? propPlayers(roster.list, b.stat, teams.map(([, t]) => t.abbr), find, depth) : [];
  const hidden = groups.reduce((n, g) => n + g.more.length, 0);
  const shown = groups.map((g) => ({ ...g, players: showAll ? g.all : g.players }));
  const total = shown.reduce((n, g) => n + g.players.length, 0);
  const injOf = (player) => depthOf(depth, { id: player.id, name: player.name })?.s || null;
  const teamName = (abbr) => teams.find(([, t]) => t.abbr === abbr)?.[1].short || abbr;
  const picked = b.player && roster && !roster.err && fits(b.player, b.stat);

  return (
    <>
      <div className="segmented" role="group" aria-label="Prop category">
        {Object.entries(PROP_CATS).map(([k, c]) => (
          <button key={k} type="button" aria-pressed={cat === k} onClick={() => pickStat(PROP_CATS[k].stats.includes(b.stat) ? b.stat : c.stats[0])}>{c.label}</button>
        ))}
      </div>

      {cat && PROP_CATS[cat].stats.length > 1 && (
        <div className="segmented stat-pick" role="group" aria-label="Stat">
          {PROP_CATS[cat].stats.map((st) => (
            <button key={st} type="button" aria-pressed={b.stat === st} onClick={() => pickStat(st)}>{CHIP[st]}</button>
          ))}
        </div>
      )}

      {cat && !roster && <p className="sub">Loading players{'…'}</p>}
      {cat && roster?.err && <p className="hint err">{roster.err} <button type="button" className="link" onClick={onTypeInstead}>Type it instead</button></p>}

      {cat && picked && (
        <div className="bp-game is-picked">
          <span className="bp-game-name"><strong>{b.player.name}</strong><span className="sub">{posOf(b.player.id)} · {teamName(b.player.team)}{injOf(b.player) ? ` · ${injOf(b.player)}` : ''}</span></span>
          <button type="button" className="text-btn nose" onClick={() => set({ player: null })}>Change</button>
        </div>
      )}

      {cat && roster && !roster.err && !picked && (
        <div className="prop-players">
          {(total + (showAll ? 0 : hidden) > 8 || find) && (
            <input aria-label="Find a player" placeholder="Find a player" value={find} onChange={(e) => setFind(e.target.value)} autoComplete="off" />
          )}
          {shown.filter((g) => g.players.length).map((g) => (
            <div key={g.team} className="group">
              <span className="group-label">{teamName(g.team)}</span>
              <div className="rows">
                {g.players.map((p) => (
                  <button key={p.id} type="button" className="row" onClick={() => { setFind(''); set({ player: { id: p.id, name: p.name, team: p.team } }); }}>
                    <span className="row-label">{p.name}</span>
                    {injuryTag(p.inj) && <span className={`inj-tag${p.inj === 'Questionable' ? '' : ' is-out'}`} title={p.inj}>{injuryTag(p.inj)}</span>}
                    <span className="pos-tag">{p.pos}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {hidden > 0 && !showAll && (
            <button type="button" className="text-btn muted center" onClick={() => setShowAll(true)}>Show all players ({hidden} more)</button>
          )}
          {!total && <p className="hint">{find ? 'No one by that name here.' : 'No players for this one.'} <button type="button" className="link" onClick={onTypeInstead}>Type it instead</button></p>}
        </div>
      )}
    </>
  );
}

import { fmtOdds } from '../lib/odds.js';
import { fmtLine, boardOptions } from '../lib/bets.js';
import { gameWhen } from '../lib/ui.js';

const SPREAD = { nhl: 'Puck line', mlb: 'Run line' };

/**
 * One game and its DraftKings board: spread, total, and moneyline for each side,
 * with prices. Tap a price to make it your leg (onPick); without onPick the
 * board is read-only. Games that have started, or have no lines yet, show as a
 * plain row (onOpen picks the game to build the bet by hand).
 *   selected(opt)  true for the choice currently picked
 *   head           false hides the matchup line (the picker shows its own)
 */
export default function GameCard({ game, sport, onPick, onOpen, selected, head = true }) {
  const opts = game.state === 'pre' ? boardOptions(game) : [];
  if (!opts.length) {
    if (!onOpen) return null;
    return (
      <button type="button" className="bp-game" onClick={onOpen}>
        <strong>{game.short}</strong><span className={`sub${game.state === 'in' ? ' is-live' : ''}`}>{gameWhen(game)}</span>
      </button>
    );
  }
  const by = Object.fromEntries(opts.map((o) => [o.key, o]));
  const rows = [
    [SPREAD[sport] || 'Spread', by['spread:away'], by['spread:home']],
    ['Total', by['total:over'], by['total:under']],
    ['Moneyline', by['ml:away'], by['ml:home']],
  ].filter(([, a, b]) => a || b);

  const text = (o) => (o.type === 'spread' ? `${game[o.side].abbr} ${fmtLine(o.line)}` : o.type === 'total' ? `${o.side === 'over' ? 'O' : 'U'} ${o.line}` : game[o.side].abbr);
  const said = (o) => (o.type === 'spread' ? `${game[o.side].short} ${fmtLine(o.line)}` : o.type === 'total' ? `${o.side === 'over' ? 'Over' : 'Under'} ${o.line}` : `${game[o.side].short} moneyline`)
    + (o.price != null ? ` at ${fmtOdds(o.price, true)}` : '');
  const cell = (o, i) => {
    if (!o) return <span key={i} className="gc-cell is-empty" aria-hidden="true">{'—'}</span>;
    const inner = <><span className="gc-pick">{text(o)}</span>{o.price != null && <span className="gc-price">{fmtOdds(o.price)}</span>}</>;
    return onPick ? (
      <button key={o.key} type="button" className="gc-cell" aria-pressed={!!selected?.(o)} aria-label={said(o)} onClick={() => onPick(o)}>{inner}</button>
    ) : <span key={o.key} className="gc-cell" aria-label={said(o)}>{inner}</span>;
  };

  return (
    <div className="gc">
      {head && (
        <div className="gc-head">
          <span className="gc-match"><b>{game.short}</b><span>{gameWhen(game)}</span></span>
          {onOpen && <button type="button" className="text-btn muted" onClick={onOpen}>Other bets</button>}
        </div>
      )}
      <div className="gc-board">
        {rows.map(([label, a, b]) => (
          <div key={label} className="gc-row">
            <span className="gc-label">{label}</span>
            {cell(a, 0)}{cell(b, 1)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Live state of a picked leg: "Covering · DET 24, GB 17 · Q3 6:12" (your team in bold),
// with a bar for overs. Before the game: "DET @ GB · Sun 1:00 PM".
export default function LiveLine({ bet, s }) {
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

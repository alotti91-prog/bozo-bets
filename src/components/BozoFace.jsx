// The recap's clown face, drawn from scratch (not the meme photo). Best to worst:
//   clean   a smiling face
//   paint   white face paint, a flat mouth (a close call)
//   makeup  paint plus blue diamond eyes, pink cheeks, red lips
//   wig     makeup plus a rainbow wig and worried brows (a blowout)
//   full    wig plus half-shut eyes and a red nose (the wheel's pick)
// It's a drawing, so it keeps its own colors in dark mode (like the paper slip).
const INK = '#141A33';
const SKIN = '#FFD34D';
const PAINT = '#FFFFFF';
const BLUE = '#2F5BD3';
const RED = '#E03A2D';
const CHEEK = '#F7A1B5';
const WIG = [
  [14.7, 72, 13, '#E86FA0'], [16.8, 48.3, 15, '#E03A2D'], [27.5, 31.5, 15, '#F07A1A'],
  [44.3, 20.8, 15, '#F2B705'], [60, 18, 15, '#7DBA2E'], [75.7, 20.8, 15, '#14A08A'],
  [92.5, 31.5, 15, '#2F5BD3'], [103.2, 48.3, 15, '#7B4FD0'], [105.3, 72, 13, '#E86FA0'],
];

export default function BozoFace({ face = 'clean', size = 40, label }) {
  const sw = size >= 80 ? 3 : 4.5; // thicker lines when it's drawn small
  const line = { fill: 'none', stroke: INK, strokeWidth: sw + 1, strokeLinecap: 'round' };
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  const wig = face === 'wig' || face === 'full';
  const made = face === 'makeup' || wig; // blue eyes, cheeks, lips
  const dots = (
    <>
      <circle cx="48" cy="60" r={sw + 0.8} fill={INK} />
      <circle cx="72" cy="60" r={sw + 0.8} fill={INK} />
    </>
  );
  return (
    <svg className="bozo-face" width={size} height={size} viewBox="0 0 120 120" {...a11y}>
      {wig && WIG.map(([cx, cy, r, fill]) => <circle key={cx} cx={cx} cy={cy} r={r} fill={fill} />)}
      <circle cx="60" cy="64" r="40" fill={face === 'clean' ? SKIN : PAINT} stroke={INK} strokeWidth={sw} />
      {face === 'clean' && (
        <>
          <path d="M42 61 q6 -7 12 0 M66 61 q6 -7 12 0" {...line} />
          <path d="M44 76 q16 14 32 0" {...line} />
        </>
      )}
      {face === 'paint' && (
        <>
          {dots}
          <path d="M48 80 q12 3 24 0" {...line} />
        </>
      )}
      {made && (
        <>
          <path d="M48 47 L52.5 60 L48 73 L43.5 60 Z M72 47 L76.5 60 L72 73 L67.5 60 Z" fill={BLUE} />
          {face === 'full' ? <path d="M43 61 h10 M67 61 h10" {...line} /> : dots}
          {wig && <path d="M40 44 L52 39 M80 44 L68 39" {...line} strokeWidth={sw} />}
          <circle cx="36" cy="76" r="6" fill={CHEEK} />
          <circle cx="84" cy="76" r="6" fill={CHEEK} />
          <path d="M40 79 Q60 101 80 79 Q60 89 40 79 Z" fill={RED} />
        </>
      )}
      {face === 'full' && (
        <>
          <circle cx="60" cy="67" r="10" fill={RED} stroke={INK} strokeWidth={sw - 0.5} />
          <circle cx="56.8" cy="63.8" r="2.8" fill="#FFFFFF" />
        </>
      )}
    </svg>
  );
}

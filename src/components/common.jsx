import { useEffect, useRef, useState } from 'react';
import BozoFace from './BozoFace.jsx';

export function Brand({ name }) {
  const n = name || 'Bozo Bets';
  const m = n.match(/bozo/i);
  if (!m) return <>{n}</>;
  const i = m.index;
  return (
    <>
      {n.slice(0, i + 3)}
      <span className="nose">{n.charAt(i + 3)}</span>
      {n.slice(i + 4)}
    </>
  );
}

// The Bozo Belt: the full-bozo face next to whoever has the most misses this season.
export function Belt({ on, size = 18 }) {
  if (!on) return null;
  return <span className="belt" title="Bozo Belt: most misses this season" aria-label="(Bozo Belt holder)" role="img"><BozoFace face="full" size={size} /></span>;
}

export function Toaster() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let t;
    const on = (e) => {
      const d = typeof e.detail === 'string' ? { text: e.detail } : e.detail;
      setMsg({ ...d, key: Date.now() });
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), d.action ? 8000 : 3400);
    };
    window.addEventListener('bz-toast', on);
    return () => { window.removeEventListener('bz-toast', on); clearTimeout(t); };
  }, []);
  if (!msg) return null;
  return (
    <div className="toast" role="status" key={msg.key}>
      <span>{msg.text}</span>
      {msg.action && <button type="button" className="toast-act" onClick={() => { msg.action.onClick(); setMsg(null); }}>{msg.action.label}</button>}
    </div>
  );
}

/**
 * A panel that slides up from the bottom (centered on wide screens).
 *   kicker  small line above the title (whose leg this is)
 *   onBack  shows a ‹ back button instead of the title row's left edge (Settings pages)
 */
export function Sheet({ title, kicker, onClose, onBack, backLabel = 'Back', children }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [title]); // a new page starts at the top
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" ref={ref}>
        <span className="grabber" aria-hidden="true" />
        {onBack && (
          <button type="button" className="sheet-back" onClick={onBack}><IconChevL />{backLabel}</button>
        )}
        <div className="sheet-head">
          <div className="sheet-titles">
            {kicker && <span className="sheet-kicker">{kicker}</span>}
            <h2 className="sheet-title" id="sheet-title">{title}</h2>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const svgProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const IconX = () => <svg {...svgProps} strokeWidth={2.6}><path d="M18 6 6 18M6 6l12 12" /></svg>;
export const IconShare = () => <svg {...svgProps}><path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>;
export const IconPhoto = () => <svg {...svgProps}><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-8 8" /></svg>;
export const IconPlus = () => <svg {...svgProps} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>;
export const IconClock = () => <svg {...svgProps}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
export const IconLock = () => <svg {...svgProps}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>;
export const IconComment = () => <svg {...svgProps}><path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4.5 19.5l1.4-4.2A7.5 7.5 0 1 1 20 11.5z" /></svg>;
export const IconChev = () => <svg className="chev-down" {...svgProps} strokeWidth={2.2}><path d="m6 9 6 6 6-6" /></svg>;
export const IconChevR = () => <svg className="chev" {...svgProps} strokeWidth={2.4}><path d="m9 6 6 6-6 6" /></svg>;
export const IconChevL = () => <svg {...svgProps} strokeWidth={2.4}><path d="m15 6-6 6 6 6" /></svg>;
export const IconSound = ({ off }) => (
  <svg {...svgProps}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {off ? <path d="m16 9.5 5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}
  </svg>
);
export const IconBoard = () => <svg {...svgProps}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10" /></svg>;
export const IconPlay = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>;
export const IconTrash = () => <svg {...svgProps}><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;
export const IconGear = () => (
  <svg {...svgProps} strokeWidth={1.8}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
// Bottom tab icons
export const IconTicket = () => <svg {...svgProps} strokeWidth={1.9}><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.2a2.8 2.8 0 0 0 0 5.6V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.2a2.8 2.8 0 0 0 0-5.6z" /><path d="M15 5.5v13" strokeDasharray="1.5 2.2" /></svg>;
export const IconWheel = () => <svg {...svgProps} strokeWidth={1.9}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18" /></svg>;
export const IconBars = () => <svg {...svgProps} strokeWidth={2.2}><path d="M5 20v-8M12 20V5M19 20v-5" /></svg>;
export const IconHistory = IconClock;

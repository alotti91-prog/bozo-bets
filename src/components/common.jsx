import { useEffect, useState } from 'react';

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

export function Belt({ on }) {
  if (!on) return null;
  return <span className="belt" title="Bozo Belt: most misses this season" aria-label="(Bozo Belt holder)" role="img">🤡</span>;
}

export function Toaster() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let t;
    const on = (e) => {
      setMsg({ text: e.detail, key: Date.now() });
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 3400);
    };
    window.addEventListener('bz-toast', on);
    return () => { window.removeEventListener('bz-toast', on); clearTimeout(t); };
  }, []);
  if (!msg) return null;
  return <div className="toast" role="status" key={msg.key}>{msg.text}</div>;
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="sheet-head">
          <h2 className="sec-title" id="sheet-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const svgProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const IconX = () => <svg {...svgProps}><path d="M18 6 6 18M6 6l12 12" /></svg>;
export const IconShare = () => <svg {...svgProps}><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><path d="m16 6-4-4-4 4" /><path d="M12 2v13" /></svg>;
export const IconChev = () => <svg className="hist-chev" {...svgProps} strokeWidth={2.2}><path d="m6 9 6 6 6-6" /></svg>;
export const IconGear = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

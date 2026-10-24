// Little celebrations: confetti and a phone buzz. Skipped for people who've
// asked their phone for less motion.

export const lessMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** A buzz on phones that support it (Android; iPhones ignore it). */
export function buzz(ms = 180) {
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}

const COLORS = ['var(--gold)', 'var(--win)', 'var(--nose)', 'var(--p-push)', 'var(--gold-ink)'];

/** Confetti falling over the whole screen for a couple of seconds. big: a full shower (the slip hit). */
export function confetti(big = false) {
  if (lessMotion() || typeof document === 'undefined') return;
  const root = document.createElement('div');
  root.className = 'confetti';
  root.setAttribute('aria-hidden', 'true');
  const n = big ? 90 : 36;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = COLORS[i % COLORS.length];
    p.style.setProperty('--d', `${(big ? 1.8 : 1.3) + Math.random() * 1.2}s`);
    p.style.setProperty('--w', `${Math.round(Math.random() * 120 - 60)}px`);
    p.style.setProperty('--r', `${Math.round(Math.random() * 720 - 360)}deg`);
    p.style.animationDelay = `${Math.random() * 0.35}s`;
    root.appendChild(p);
  }
  document.body.appendChild(root);
  setTimeout(() => root.remove(), 3600);
}

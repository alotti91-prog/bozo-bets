// Small shared helpers: toasts, sharing, sounds, local storage.

/** Show a short message. action = { label, onClick } adds a button to it. */
export function toast(message, action = null) {
  window.dispatchEvent(new CustomEvent('bz-toast', { detail: { text: message, action } }));
}

export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* private mode */ }
  },
};

/** Phone share sheet when available, otherwise copy to clipboard. */
export async function shareText(text, { title, successMsg = 'Copied. Paste it in the group chat.' } = {}) {
  if (navigator.share) {
    try { await navigator.share({ title, text }); return true; } catch (e) { if (e && e.name === 'AbortError') return false; }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(successMsg);
    return true;
  } catch {
    toast('Couldn’t copy automatically. Long-press to select the text instead.');
    return false;
  }
}

// ---- sounds (Web Audio, starts only after a tap) ----
let actx = null;
export function isMuted() { return store.get('bz-mute', false); }
export function setMuted(v) { store.set('bz-mute', v); }
export function audioInit() {
  if (isMuted()) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { actx = null; }
}
function tone(type, f, t0, dur, vol, f2) {
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(actx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
export function tick() {
  if (!actx || isMuted()) return;
  try { tone('square', 1700, actx.currentTime, 0.03, 0.035); } catch { /* ignore */ }
}
export function honk() {
  if (!actx || isMuted()) return;
  try {
    const t = actx.currentTime;
    tone('sawtooth', 330, t, 0.16, 0.07, 300);
    tone('sawtooth', 262, t + 0.2, 0.3, 0.07, 220);
  } catch { /* ignore */ }
}

// A bright two-note ding: someone's safe.
export function ding() {
  if (!actx || isMuted()) return;
  try {
    const t = actx.currentTime;
    tone('sine', 880, t, 0.12, 0.06);
    tone('sine', 1320, t + 0.1, 0.22, 0.06);
  } catch { /* ignore */ }
}

export function secureRandom() {
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch { return Math.random(); }
}

export function fmtDate(iso) {
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return iso; }
}
export function fmtWhen(iso) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return ''; }
}
export function listNames(names) {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
}

/** Shrink a photo before upload (long side ≤ max px, JPEG). Falls back to the original file. */
export async function shrinkImage(file, max = 2000) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

// Draws the recap as a PNG for the group chat (content from recapCard() in
// lib/recapCard.js), and shares or downloads it. Browser only. The colors are
// the app's light-mode tokens written out, because a canvas can't read CSS
// variables and the image should look the same whoever makes it (like the
// paper slip, it ignores dark mode).
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import BozoFace from '../../components/BozoFace.jsx';

const C = {
  bg: '#141A33', paper: '#FFFDF8', ink: '#1A1D29', muted: '#5F6476', line: '#E8E1D2', sunk: '#F1ECE1',
  loss: '#C42E25', lossSoft: '#FBE2DF', win: '#12804F', winSoft: '#DCF2E6', nose: '#D93428', white: '#FFFFFF',
};
const BODY = 'Figtree, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const DISPLAY = '"Alfa Slab One", Rockwell, Georgia, serif';
const W = 1080;
const PAD = 56; // paper card inset from the image edge
const IN = 64; // content inset inside the card

// A face as an <img> the canvas can draw, from the same SVG the app shows.
const faceCache = new Map();
function faceImage(face) {
  if (!faceCache.has(face)) {
    faceCache.set(face, new Promise((resolve) => {
      const div = document.createElement('div');
      const root = createRoot(div);
      flushSync(() => root.render(createElement(BozoFace, { face, size: 240 })));
      let svg = div.innerHTML;
      root.unmount();
      if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }));
  }
  return faceCache.get(face);
}

async function fontsReady() {
  try {
    await Promise.all(['400 40px "Alfa Slab One"', '800 40px Figtree', '700 40px Figtree', '600 40px Figtree', '500 40px Figtree']
      .map((f) => document.fonts.load(f)));
  } catch { /* fall back to system fonts */ }
}

// Text cut down with "…" to fit a width.
function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The recap card (recapCard() output) → a PNG Blob. */
export async function drawRecapImage(card) {
  await fontsReady();
  const faces = {};
  const wanted = new Set([...card.hero.faces, ...card.people.map((p) => p.face)]);
  await Promise.all([...wanted].map(async (f) => { faces[f] = await faceImage(f); }));

  const ROW = 128;
  const LINE2 = 40; // a second detail line (what actually happened)
  const AWARD = 104;
  const heroH = card.hero.kind === 'hit' ? 450 : 550;
  const h = PAD + 150 + heroH + (card.stats ? 90 : 20)
    + (card.awards.length ? 80 + card.awards.length * AWARD : 0)
    + 80 + card.people.reduce((s, p) => s + ROW + (p.detail.length - 1) * LINE2, 0) + 60 + PAD;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  // Navy background, paper card
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, h);
  roundRect(ctx, PAD, PAD, W - PAD * 2, h - PAD * 2, 40);
  ctx.fillStyle = C.paper;
  ctx.fill();
  const L = PAD + IN;
  const R = W - PAD - IN;
  const mid = W / 2;
  let y = PAD + 96;

  // Wordmark ("BOZO BETS" with a red O) and the week
  ctx.font = `52px ${DISPLAY}`;
  const brand = card.brand.toUpperCase();
  const at = brand.search(/BOZO/);
  if (at >= 0) {
    const parts = [brand.slice(0, at + 3), brand.charAt(at + 3), brand.slice(at + 4)];
    const total = parts.reduce((s, t) => s + ctx.measureText(t).width, 0);
    let x = mid - total / 2;
    parts.forEach((t, i) => { ctx.fillStyle = i === 1 ? C.nose : C.ink; ctx.textAlign = 'left'; ctx.fillText(t, x, y); x += ctx.measureText(t).width; });
  } else {
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.fillText(brand, mid, y);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = C.muted;
  ctx.font = `600 34px ${BODY}`;
  ctx.fillText(card.title, mid, y + 52);
  y += 110;

  // Hero: the bozo (or the hit), in a box outlined red or green
  const hero = card.hero;
  const tone = hero.tone === 'win' ? C.win : C.loss;
  roundRect(ctx, L - 16, y, R - L + 32, heroH - 40, 32);
  ctx.lineWidth = 5;
  ctx.strokeStyle = tone;
  ctx.stroke();
  let hy = y + 40;
  if (hero.faces.length === 1) {
    const img = faces[hero.faces[0]];
    if (img) ctx.drawImage(img, mid - 115, hy, 230, 230);
    hy += 250;
  } else {
    const s = 120;
    const gap = 14;
    const n = hero.faces.length;
    let x = mid - (n * s + (n - 1) * gap) / 2;
    hero.faces.forEach((f) => { if (faces[f]) ctx.drawImage(faces[f], x, hy, s, s); x += s + gap; });
    hy += s + 30;
  }
  ctx.fillStyle = C.ink;
  ctx.font = `92px ${DISPLAY}`;
  ctx.fillText(fit(ctx, hero.big, R - L - 40), mid, hy + 70);
  hy += 120;
  if (hero.tag) {
    ctx.font = `800 36px ${BODY}`;
    ctx.fillStyle = tone;
    ctx.fillText(fit(ctx, hero.tag, R - L - 40), mid, hy);
    hy += 52;
  }
  if (hero.sub) {
    ctx.font = `500 34px ${BODY}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(fit(ctx, hero.sub, R - L - 40), mid, hy);
  }
  y += heroH;

  if (card.stats) {
    ctx.font = `700 34px ${BODY}`;
    ctx.fillStyle = C.ink;
    ctx.fillText(fit(ctx, card.stats, R - L), mid, y + 20);
    y += 90;
  } else y += 20;

  const section = (label) => {
    ctx.textAlign = 'left';
    ctx.font = `700 30px ${BODY}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(label, L, y + 40);
    y += 80;
  };

  // Awards
  if (card.awards.length) {
    section('This week’s awards');
    card.awards.forEach((a) => {
      ctx.fillStyle = C.sunk;
      ctx.beginPath();
      ctx.arc(L + 40, y + 36, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.font = `44px ${BODY}`;
      ctx.fillStyle = C.ink;
      ctx.fillText(a.icon, L + 40, y + 52);
      ctx.textAlign = 'left';
      ctx.font = `800 36px ${BODY}`;
      const head = `${a.title} · `;
      ctx.fillText(head, L + 104, y + 30);
      const hw = ctx.measureText(head).width;
      ctx.font = `600 36px ${BODY}`;
      ctx.fillText(fit(ctx, a.name, R - L - 104 - hw), L + 104 + hw, y + 30);
      ctx.font = `500 30px ${BODY}`;
      ctx.fillStyle = C.muted;
      ctx.fillText(fit(ctx, a.note, R - L - 104), L + 104, y + 72);
      y += AWARD;
    });
  }

  // Everyone's face
  section('How everyone did');
  card.people.forEach((p, i) => {
    if (i) { ctx.fillStyle = C.line; ctx.fillRect(L, y - 14, R - L, 2); }
    if (faces[p.face]) ctx.drawImage(faces[p.face], L, y, 92, 92);
    ctx.textAlign = 'left';
    const x = L + 120;
    const oddsW = p.odds ? 130 : 0;
    ctx.font = `800 38px ${BODY}`;
    ctx.fillStyle = C.ink;
    const name = fit(ctx, p.name, R - x - oddsW - 20);
    ctx.fillText(name, x, y + 40);
    if (p.label) {
      const nw = ctx.measureText(name).width;
      ctx.font = `800 34px ${BODY}`;
      ctx.fillStyle = p.face === 'full' ? C.nose : C.muted;
      ctx.fillText(fit(ctx, ` · ${p.label}`, R - x - oddsW - nw - 20), x + nw, y + 40);
    }
    ctx.font = `500 30px ${BODY}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(fit(ctx, p.detail[0], R - x - oddsW - 20), x, y + 82);
    if (p.detail[1]) { // what actually happened, green or red
      ctx.font = `700 30px ${BODY}`;
      ctx.fillStyle = p.tone === 'win' ? C.win : p.tone === 'loss' ? C.loss : C.muted;
      ctx.fillText(fit(ctx, p.detail[1], R - x - 20), x, y + 82 + LINE2);
    }
    if (p.odds) {
      ctx.textAlign = 'right';
      ctx.font = `700 34px ${BODY}`;
      ctx.fillStyle = C.ink;
      ctx.fillText(p.odds, R, y + 58);
    }
    y += ROW + (p.detail.length - 1) * LINE2;
  });

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/**
 * Hands the image to the phone's share sheet (Messages, WhatsApp, …), or
 * downloads it where sharing files isn't supported. Returns 'shared' |
 * 'cancelled' | 'downloaded'. Call it straight from the tap: phones only allow
 * the share sheet right after one.
 */
export async function shareImage(blob, filename, title) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

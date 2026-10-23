import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { TAU, SPIN_MS, indexAt, targetRotation, restRotation } from '../lib/wheel.js';
import { secureRandom, tick, honk, ding, audioInit } from '../lib/ui.js';

const SEG = [
  ['#E03A2D', '#FFFFFF'], ['#F2B705', '#1A1D29'], ['#2F5BD3', '#FFFFFF'], ['#14A08A', '#FFFFFF'],
  ['#F07A1A', '#1A1D29'], ['#7B4FD0', '#FFFFFF'], ['#E86FA0', '#1A1D29'], ['#7DBA2E', '#1A1D29'],
];

/**
 * The Bozo Wheel. Props:
 *   names    array of display names, drawn clockwise from the pointer
 *   restAt   index to centre under the pointer when idle, -1 to park the pointer
 *            between two names (gives nothing away), or null to leave it be
 *   restKey  changes when a new result should be shown
 *   struck   index of a name to grey out and cross off (knocked out), or null
 * Ref: spinTo(names, landedIndex, key, { quick, sound }) -> Promise that resolves when it stops.
 *        quick: a shorter spin (knock-out rounds). sound: 'honk' (bozo) or 'ding' (safe).
 *      stop() ends the current spin right away, silently (Skip).
 */
const WheelCanvas = forwardRef(function WheelCanvas({ names, restAt, restKey, struck = null }, ref) {
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const rot = useRef(0);
  const animNames = useRef(null);
  const settledKey = useRef(null);
  const stopped = useRef(false);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const list = animNames.current || names;
    const size = Math.max(200, Math.round(cv.clientWidth || 320));
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const px = Math.round(size * dpr);
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const R = size / 2;
    const rr = R - 16;
    ctx.save();
    ctx.translate(R, R);
    ctx.beginPath(); ctx.arc(0, 0, R - 1, 0, TAU); ctx.fillStyle = '#141A33'; ctx.fill();
    for (let b = 0; b < 28; b++) {
      const a = (b / 28) * TAU;
      ctx.beginPath(); ctx.arc(Math.cos(a) * (R - 8), Math.sin(a) * (R - 8), 2.6, 0, TAU);
      ctx.fillStyle = b % 2 ? '#F2B705' : '#FFF6D6'; ctx.fill();
    }
    ctx.rotate(rot.current);
    if (!list.length) {
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fillStyle = '#2A3150'; ctx.fill();
    } else {
      const seg = TAU / list.length;
      list.forEach((name, i) => {
        let col = SEG[i % SEG.length];
        if (list.length > 1 && i === list.length - 1 && i % SEG.length === 0) col = SEG[2];
        const out = !animNames.current && struck === i;
        if (out) col = ['#3A4060', 'rgba(255,255,255,.6)'];
        const a0 = -Math.PI / 2 + i * seg;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rr, a0, a0 + seg); ctx.closePath();
        ctx.fillStyle = col[0]; ctx.fill();
        if (list.length > 1) { ctx.strokeStyle = 'rgba(20,26,51,.4)'; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.save();
        ctx.rotate(a0 + seg / 2);
        ctx.fillStyle = col[1]; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        let fs = Math.round(Math.min(18, Math.max(12, size / 19)));
        const maxW = rr * 0.52;
        let label = name;
        ctx.font = `700 ${fs}px Figtree, system-ui, sans-serif`;
        while (ctx.measureText(label).width > maxW && fs > 10) { fs--; ctx.font = `700 ${fs}px Figtree, system-ui, sans-serif`; }
        if (ctx.measureText(label).width > maxW) {
          while (label.length > 2 && ctx.measureText(label + '…').width > maxW) label = label.slice(0, -1);
          label += '…';
        }
        ctx.fillText(label, rr - 30, 0);
        if (out) { const lw = ctx.measureText(label).width; ctx.fillRect(rr - 30 - lw, -1, lw, 2); }
        ctx.restore();
      });
    }
    ctx.restore();
    ctx.save();
    ctx.translate(R, R);
    const hr = R * 0.12;
    ctx.beginPath(); ctx.arc(0, 0, hr + 4, 0, TAU); ctx.fillStyle = '#141A33'; ctx.fill();
    const g = ctx.createRadialGradient(-hr * 0.35, -hr * 0.4, hr * 0.1, 0, 0, hr);
    g.addColorStop(0, '#FF9184'); g.addColorStop(0.4, '#E5392C'); g.addColorStop(1, '#9E1D14');
    ctx.beginPath(); ctx.arc(0, 0, hr, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
  }, [names, struck]);

  // Idle: centre the latest result under the pointer, unless we just animated to it.
  useEffect(() => {
    if (animNames.current) return;
    if (restAt != null && names.length && settledKey.current !== restKey) {
      rot.current = restAt === -1 ? 0 : restRotation(names.length, restAt);
      settledKey.current = restKey;
    }
    draw();
  }, [names, restAt, restKey, draw]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => draw());
    ro.observe(cv);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    return () => ro.disconnect();
  }, [draw]);

  useImperativeHandle(ref, () => ({
    spinTo(list, k, key, { quick = false, sound = 'honk' } = {}) {
      return new Promise((resolve) => {
        audioInit();
        stopped.current = false;
        const n = list.length;
        if (!n) { resolve(); return; }
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const start = rot.current;
        const [lo, hi] = quick ? SPIN_MS.quick : SPIN_MS.full;
        const turns = reduce ? 1 : (quick ? 3 : 6) + Math.floor(secureRandom() * 2);
        const end = targetRotation(start, n, k, 0.14 + secureRandom() * 0.72, turns);
        const dur = reduce ? 1200 : lo + secureRandom() * (hi - lo);
        animNames.current = list;
        let last = indexAt(start, n);
        const t0 = performance.now();
        const frame = (t) => {
          const p = stopped.current ? 1 : Math.min(1, (t - t0) / dur);
          const e = 1 - Math.pow(1 - p, 4);
          rot.current = start + (end - start) * e;
          draw();
          const idx = indexAt(rot.current, n);
          if (idx !== last) {
            last = idx;
            tick();
            const el = pointerRef.current;
            if (el && !reduce) { el.classList.remove('bump'); void el.getBoundingClientRect(); el.classList.add('bump'); }
          }
          if (p < 1) requestAnimationFrame(frame);
          else {
            if (!stopped.current) (sound === 'ding' ? ding : honk)();
            animNames.current = null;
            settledKey.current = key;
            resolve();
          }
        };
        requestAnimationFrame(frame);
      });
    },
    stop() { stopped.current = true; },
  }), [draw]);

  return (
    <div className="wheel-box">
      <svg className="pointer" ref={pointerRef} viewBox="0 0 34 42" aria-hidden="true">
        <path d="M17 39 L3.5 9 Q2 3.5 7.5 3.5 H26.5 Q32 3.5 30.5 9 Z" />
        <circle cx="17" cy="13" r="3.6" />
      </svg>
      <canvas ref={canvasRef} role="img" aria-label={`Wheel with ${names.length} name${names.length === 1 ? '' : 's'}${names.length ? ': ' + names.join(', ') : ''}`} />
    </div>
  );
});

export default WheelCanvas;

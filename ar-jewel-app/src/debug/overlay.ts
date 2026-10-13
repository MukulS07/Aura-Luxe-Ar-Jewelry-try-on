import type { Pt, Tracking } from '../types';
import type { TryOn } from '../render/tryon';

/**
 * Developer overlay, loaded only with `?debug` (agent.md §7). Never part of the kiosk path.
 * Draws what the tracker measured on a separate canvas and offers keyboard nudges for tuning:
 *   [ ]  piece size   , .  piece height   0 reset   g guides on/off
 */
export function attachDebug(tryon: TryOn, host: HTMLElement): () => void {
  const cv = Object.assign(document.createElement('canvas'), { width: tryon.W, height: tryon.H });
  Object.assign(cv.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '4' });
  const ctx = cv.getContext('2d')!;
  const fps = Object.assign(document.createElement('div'), { id: 'debug' });
  host.append(cv, fps);
  let guides = true;
  let fpsText = '';

  const dot = (p: Pt, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const ring = (p: Pt, r: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  const label = (text: string, p: Pt, color = '#fff') => {
    ctx.fillStyle = color;
    ctx.font = '600 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, p.x, p.y);
  };

  tryon.onFps = (f) => {
    fpsText = `${f} FPS`;
  };
  // Samples for e2e/motion.spec.ts: raw tracked lobe vs the smoothed position actually drawn
  const samples: { t: number; rawX: number; rawY: number; outX: number; outY: number; phase: string }[] = [];
  (globalThis as { __samples?: typeof samples }).__samples = samples;
  tryon.onFrame = (tr: Tracking | null, now: number) => {
    const fr = tryon.lastFrame;
    if (tr && fr && fr.count === 2 && samples.length < 4000) {
      samples.push({
        t: now,
        rawX: tr.ears.lobeR.x,
        rawY: tr.ears.lobeR.y,
        outX: fr.pieces[1].x,
        outY: tryon.H - fr.pieces[1].y,
        phase: tryon.measure.phase,
      });
    }
    ctx.clearRect(0, 0, cv.width, cv.height);
    const fit = tryon.fit;
    fps.textContent = `${fpsText} · track ${Math.round(tryon.detectMs)}ms · fit ${Math.round(fit.scale * 100)}% ${fit.yMm >= 0 ? '+' : ''}${fit.yMm}mm`;
    if (!tr || !guides) return;

    for (const [p, hidden, name] of [
      [tr.ears.lobeL, tr.ears.hiddenL, 'L'],
      [tr.ears.lobeR, tr.ears.hiddenR, 'R'],
    ] as const) {
      ring(p, 16, hidden ? '#ef4444' : '#d4af37');
      dot(p, 3.5, '#ffd700');
      label(`lobe ${name}${hidden ? ' · hair' : ''}`, { x: p.x, y: p.y - 24 });
    }

    const n = tr.neckline;
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    n.contour.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    dot(n.center, 6, '#ffd700');
    dot(n.sternumDrop, 4, '#d4af37');
    label(`neck ${Math.round(n.widthMm)}mm · ears ${Math.round(tr.ears.spanMm)}mm`, { x: n.center.x, y: n.center.y + 28 });
    const prof = tryon.measure.profile;
    label(`${tryon.measure.phase}${prof ? ` · neck ${Math.round(prof.neckMm ?? 0)}mm ear ${Math.round(prof.earSpanMm)}mm` : ''}`, {
      x: n.center.x,
      y: n.center.y + 64,
    });
    label(`${tr.poseSource} · scale ${tr.scaleSource} · ${tr.isLocked ? 'locked' : 'aligning'}`, { x: n.center.x, y: n.center.y + 46 });

    for (const h of tr.hands) {
      ring(h.ringAnchor, 10, '#38bdf8');
      dot(h.bangleAnchor, 5, '#38bdf8');
      label(`${h.side} hand ${h.palmFacing ? 'palm' : 'back'}`, { x: h.wrist.x, y: h.wrist.y + 24 }, '#7dd3fc');
    }
  };

  const keys = (e: KeyboardEvent) => {
    const f = tryon.fit;
    if (e.key === '[') tryon.fit = { ...f, scale: +(f.scale - 0.05).toFixed(2) };
    else if (e.key === ']') tryon.fit = { ...f, scale: +(f.scale + 0.05).toFixed(2) };
    else if (e.key === ',') tryon.fit = { ...f, yMm: f.yMm - 3 };
    else if (e.key === '.') tryon.fit = { ...f, yMm: f.yMm + 3 };
    else if (e.key === '0') tryon.fit = { scale: 1, yMm: 0 };
    else if (e.key === 'g') guides = !guides;
  };
  addEventListener('keydown', keys);

  return () => {
    removeEventListener('keydown', keys);
    cv.remove();
    fps.remove();
    tryon.onFps = undefined;
    tryon.onFrame = undefined;
  };
}

import type { Pt, Tracking } from '../types';
import type { MeasureState } from '../tracking/measurer';

/**
 * The face layout drawn over the camera on the scan screen: the face outline, the two earlobes, the neck line and
 * the points the measuring reads. Thin gold lines; dashed while still measuring, solid once locked.
 */
export class ScanOverlay {
  readonly canvas = document.createElement('canvas');
  private g = this.canvas.getContext('2d')!;

  constructor(
    host: HTMLElement,
    readonly W: number,
    readonly H: number,
  ) {
    this.canvas.width = W;
    this.canvas.height = H;
    Object.assign(this.canvas.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    host.append(this.canvas);
  }

  draw(tr: Tracking | null, m: MeasureState, nowMs: number) {
    const g = this.g;
    g.clearRect(0, 0, this.W, this.H);
    if (!tr) return;
    const locked = m.phase === 'ready';
    const gold = locked ? '#F0D898' : 'rgba(216,181,106,.9)';
    const k = Math.max(0.6, this.W / 1000); // line weight follows the frame size
    g.save();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.shadowColor = 'rgba(216,181,106,.7)';
    g.shadowBlur = 10 * k;

    // face outline with a slow travelling dash while measuring
    g.strokeStyle = gold;
    g.lineWidth = 2.2 * k;
    g.setLineDash(locked ? [] : [14 * k, 10 * k]);
    g.lineDashOffset = -(nowMs / 40) % (24 * k);
    this.path(tr.faceOval, true);
    g.stroke();
    g.setLineDash([]);

    // constellation: the outline points joined to the face centre, very faint
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(240,216,152,.16)';
    g.lineWidth = 1 * k;
    g.beginPath();
    for (let i = 0; i < tr.faceOval.length; i += 3) {
      g.moveTo(tr.center.x, tr.center.y);
      g.lineTo(tr.faceOval[i].x, tr.faceOval[i].y);
    }
    g.stroke();
    g.fillStyle = gold;
    for (const p of tr.faceOval) this.dot(p, 2.4 * k);

    // earlobes: ring and cross, lit when the ears are measured
    for (const p of [tr.ears.lobeL, tr.ears.lobeR]) {
      g.strokeStyle = m.ears ? '#F0D898' : 'rgba(247,242,232,.5)';
      g.lineWidth = 2 * k;
      g.beginPath();
      g.arc(p.x, p.y, 15 * k, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(p.x - 24 * k, p.y);
      g.lineTo(p.x - 9 * k, p.y);
      g.moveTo(p.x + 9 * k, p.y);
      g.lineTo(p.x + 24 * k, p.y);
      g.stroke();
      g.fillStyle = '#F0D898';
      this.dot(p, 3.4 * k);
    }

    // neck line and its centre
    if (m.neck) {
      const n = tr.neckline;
      g.strokeStyle = gold;
      g.lineWidth = 2.2 * k;
      g.shadowBlur = 8 * k;
      this.path(n.contour, false);
      g.stroke();
      g.fillStyle = '#F0D898';
      this.dot(n.center, 5 * k);
      g.setLineDash([4 * k, 6 * k]);
      g.strokeStyle = 'rgba(240,216,152,.45)';
      g.beginPath();
      g.moveTo(tr.chin.x, tr.chin.y);
      g.lineTo(n.center.x, n.center.y);
      g.stroke();
    }
    g.restore();
  }

  private path(pts: Pt[], close: boolean) {
    const g = this.g;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    if (close) g.closePath();
  }

  private dot(p: Pt, r: number) {
    this.g.beginPath();
    this.g.arc(p.x, p.y, r, 0, Math.PI * 2);
    this.g.fill();
  }

  dispose() {
    this.canvas.remove();
  }
}

import type { CatalogItem, Tracking } from '../types';
import { OneEuro } from '../tracking/smooth';
import { HEAD_HALF_MM } from '../tracking/measure';
import { pieceSpec } from './spec';

/**
 * Where each piece goes on screen. Pure maths over Tracking: no WebGL, so alignment can be unit tested.
 * Coordinates are scene px with y up (origin bottom-left), matching the orthographic camera in Scene3D.
 */

const FADE = 0.22; // opacity easing per frame
const HIDE_FADE = 0.25; // per-earring fade when hair covers the lobe
const NECK_Z = 45;
const MAX_LEAD_MS = 50; // never extrapolate further than this
const LEAD_GAIN = 0.7; // under-correct on purpose: the speed estimate is itself a little late

/** Manual nudge for debugging and booth tuning. Not exposed to visitors. */
export interface Fit {
  scale: number; // 0.7 to 1.4
  yMm: number; // -40 to 40
}
export const defaultFit = (): Fit => ({ scale: 1, yMm: 0 });
export const clampFit = (f: Fit): Fit => ({
  scale: Math.max(0.7, Math.min(1.4, f.scale)),
  yMm: Math.max(-40, Math.min(40, f.yMm)),
});

export interface Xform {
  x: number;
  y: number;
  z: number;
  scale: number;
  rx: number;
  ry: number;
  rz: number;
  opacity: number;
}
export const OVAL_N = 36;
export interface Occluder {
  visible: boolean;
  /** Face outline in scene px, x y pairs. Depth-only plane behind the nose-tip, in front of the far ear. */
  oval: Float32Array;
  x: number;
  y: number;
  sx: number;
  sy: number;
  sz: number;
  rx: number;
  rz: number;
}
/** Reused every frame (no allocation in the render loop). Only `pieces[0..count)` are valid. */
export interface Frame {
  opacity: number;
  count: number;
  pieces: Xform[];
  occluder: Occluder;
}

const xf = (): Xform => ({ x: 0, y: 0, z: 0, scale: 1, rx: 0, ry: 0, rz: 0, opacity: 0 });
const px = () => new OneEuro(1.2, 0.02);
const ang = () => new OneEuro(1.5, 0.6);
const PX_KEYS = ['cx', 'cy', 'w', 'lx', 'ly', 'rx', 'ry', 'nx', 'ny', 'ppm'];
const ANG_KEYS = ['yaw', 'pitch', 'roll', 'nr'];

export class Placement {
  private f: Record<string, OneEuro> = {};
  private alpha = 0;
  private lastYaw = 0;
  private dangleAngle = 0;
  private dangleVelocity = 0;
  private earAlpha = [1, 1];
  private ovalReady = false;
  private frame: Frame = {
    opacity: 0,
    count: 0,
    pieces: [xf(), xf()],
    occluder: { visible: false, oval: new Float32Array(OVAL_N * 2), x: 0, y: 0, sx: 1, sy: 1, sz: 1, rx: 0, rz: 0 },
  };

  constructor(private H: number) {
    for (const k of PX_KEYS) this.f[k] = px();
    for (const k of ANG_KEYS) this.f[k] = ang();
  }

  /** A new piece fades in from nothing. */
  restartFade() {
    this.alpha = 0;
  }

  private settle() {
    Object.values(this.f).forEach((x) => x.reset());
    this.dangleAngle = 0;
    this.dangleVelocity = 0;
    this.earAlpha = [1, 1];
    this.ovalReady = false;
  }

  /**
   * `leadMs`: how stale the tracking result already is when it is drawn (detect time). Positions are pushed
   * forward by their smoothed speed times this, so the jewelry meets the video frame the viewer sees now.
   */
  update(tr: Tracking | null, it: CatalogItem | undefined, tMs: number, fit: Fit, leadMs = 0): Frame {
    const fr = this.frame;
    const live = !!tr && !!it;
    this.alpha += ((live ? 1 : 0) - this.alpha) * FADE;
    fr.opacity = this.alpha;
    fr.count = 0;
    fr.occluder.visible = false;
    if (!live) {
      if (this.alpha < 0.01) this.settle();
      return fr;
    }

    const lead = Math.max(0, Math.min(MAX_LEAD_MS, leadMs)) / 1000;
    const s = (k: string, v: number) => this.f[k].step(v, tMs);
    // Position channels only; angles and scale stay as they are.
    const sp = (k: string, v: number) => {
      const x = this.f[k].step(v, tMs);
      return x + this.f[k].rate * lead * LEAD_GAIN;
    };
    const H = this.H;
    const faceW = s('w', tr.faceW);
    const yaw = s('yaw', tr.yaw);
    const roll = s('roll', tr.roll);
    const pitch = s('pitch', tr.pitch || 0);
    const cx = sp('cx', tr.center.x);
    const cy = H - sp('cy', tr.center.y);
    const pxPerMm = s('ppm', tr.pxPerMm || faceW / 140);

    // Earring inertia on head turns
    const yawDelta = yaw - this.lastYaw;
    this.lastYaw = yaw;
    this.dangleVelocity += yawDelta * 0.45;
    this.dangleVelocity *= 0.88;
    this.dangleAngle += this.dangleVelocity;
    this.dangleAngle *= 0.92;

    const spec = pieceSpec(it);
    const userOffsetPx = fit.yMm * pxPerMm;
    const yOffsetPx = spec.yOffsetMm * pxPerMm + userOffsetPx;
    const [ox, oy, oz] = it.anchor.offset;

    if (it.type === 'earrings') {
      // Head-shaped depth-only occluder: earrings hide behind the face on turns (FR-5)
      const o = fr.occluder;
      o.visible = true;
      o.x = cx;
      o.y = cy;
      o.sx = HEAD_HALF_MM.x * pxPerMm;
      o.sy = HEAD_HALF_MM.y * pxPerMm;
      o.sz = HEAD_HALF_MM.z * pxPerMm;
      o.rz = -roll;
      o.rx = pitch * 0.4;
      // Light smoothing of the outline so the hidden edge does not shimmer
      const k = this.ovalReady ? 0.5 : 1;
      for (let i = 0; i < OVAL_N; i++) {
        const q = tr.faceOval[i];
        o.oval[i * 2] += ((q?.x ?? cx) - o.oval[i * 2]) * k;
        o.oval[i * 2 + 1] += (H - (q?.y ?? H - cy) - o.oval[i * 2 + 1]) * k;
      }
      this.ovalReady = true;

      const h = spec.sizeMm * pxPerMm * it.anchor.scale * fit.scale;
      const half = faceW / 2;
      const hidden = [tr.ears.hiddenL, tr.ears.hiddenR]; // hair covers the lobe (FR-6)
      const lobes = [
        { side: -1, x: sp('lx', tr.ears.lobeL.x), y: sp('ly', tr.ears.lobeL.y) },
        { side: 1, x: sp('rx', tr.ears.lobeR.x), y: sp('ry', tr.ears.lobeR.y) },
      ];
      const sway = it.dimensions?.rigid ? 0 : this.dangleAngle; // studs do not dangle
      for (let i = 0; i < 2; i++) {
        const e = lobes[i];
        this.earAlpha[i] += ((hidden[i] ? 0 : 1) - this.earAlpha[i]) * HIDE_FADE;
        const p = fr.pieces[i];
        p.x = e.x + e.side * ox * faceW;
        p.y = H - (e.y + yOffsetPx) + oy * faceW;
        p.z = -e.side * half * Math.sin(yaw) + oz * faceW;
        p.scale = h;
        p.rx = pitch * 0.4;
        p.ry = yaw * 0.5;
        p.rz = -roll + sway * e.side;
        p.opacity = this.alpha * this.earAlpha[i];
      }
      fr.count = 2;
    } else {
      const w = spec.sizeMm * pxPerMm * it.anchor.scale * fit.scale;
      // Where the chain rests: just above the collarbone line
      const neckTopY = (tr.neckline.left.y + tr.neckline.right.y) * 0.5 - 12 * pxPerMm;
      const p = fr.pieces[0];
      p.x = sp('nx', tr.neckline.center.x) + ox * w;
      p.y = H - (sp('ny', neckTopY) + yOffsetPx) + oy * w;
      p.z = NECK_Z + oz * w;
      p.scale = w;
      p.rx = pitch * 0.35;
      p.ry = yaw * 0.25;
      p.rz = -this.f['nr'].step(tr.neckline.roll, tMs);
      p.opacity = this.alpha;
      fr.count = 1;
    }
    return fr;
  }
}

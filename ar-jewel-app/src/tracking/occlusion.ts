import type { Pt } from '../types';
import type { View } from './solve';

/** selfie_multiclass_256x256 categories: 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 other. */
export const CAT_HAIR = 1;
/** Hair share around a lobe above which the earring is treated as hidden by hair (FR-6). TODO(confirm): tune on real hairstyles. */
export const HAIR_COVER_THRESHOLD = 0.5;

export interface CategoryMask {
  data: Uint8Array;
  w: number;
  h: number;
}

/** Inverse of `toView`: display px -> normalised video coords. */
export function fromView(p: Pt, v: View): Pt {
  const s = Math.max(v.W / v.vw, v.H / v.vh);
  const ox = (v.W - v.vw * s) / 2,
    oy = (v.H - v.vh * s) / 2;
  return { x: (v.W - p.x - ox) / (v.vw * s), y: (p.y - oy) / (v.vh * s) };
}

/** Share (0..1) of mask pixels inside a circle (display px) that are `cat`. Circle outside the frame counts as 0. */
export function categoryShare(mask: CategoryMask, centre: Pt, radiusPx: number, v: View, cat = CAT_HAIR): number {
  const c = fromView(centre, v);
  const s = Math.max(v.W / v.vw, v.H / v.vh);
  const rx = (radiusPx / (v.vw * s)) * mask.w,
    ry = (radiusPx / (v.vh * s)) * mask.h;
  const cx = c.x * mask.w,
    cy = c.y * mask.h;
  let hit = 0,
    n = 0;
  for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(mask.h - 1, Math.ceil(cy + ry)); y++) {
    for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(mask.w - 1, Math.ceil(cx + rx)); x++) {
      const dx = (x - cx) / (rx || 1),
        dy = (y - cy) / (ry || 1);
      if (dx * dx + dy * dy > 1) continue;
      n++;
      if (mask.data[y * mask.w + x] === cat) hit++;
    }
  }
  return n ? hit / n : 0;
}

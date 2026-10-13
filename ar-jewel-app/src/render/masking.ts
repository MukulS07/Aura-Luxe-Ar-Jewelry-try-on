import type { Pt } from '../types';
import { CAT_FACE, CAT_HAIR } from '../tracking/occlusion';

/**
 * Which camera pixels must sit IN FRONT of the jewelry. Pure rules, so they can be tested without a camera.
 * Segmentation classes: 1 hair, 3 face skin (src/tracking/occlusion.ts).
 *
 *  - Necklace: the face and chin are always in front of it (it passes behind the jaw).
 *  - Earrings: the far side of a turned face covers the far earring; hair near a lobe covers the top of that earring
 *    (so it looks tucked into the hair) while the dangling part below stays visible.
 */
export type Zone = { kind: 'earrings'; lobes: [Pt, Pt]; far: -1 | 0 | 1; faceCx: number; ppm: number } | { kind: 'necklace' };

export const HAIR_COVER_MM = 26; // radius around a lobe where hair is in front of the earring. TODO(confirm) on real hairstyles.
export const HAIR_LIFT_MM = 10; // the covered circle sits a little above the lobe, over the ear itself
export const FAR_TURN = 0.12; // radians of head turn before one ear counts as the far one

/** Which side (-1 screen-left, +1 screen-right) is turned away from the camera; 0 when the head is nearly frontal. */
export function farSide(yaw: number): -1 | 0 | 1 {
  return yaw <= -FAR_TURN ? -1 : yaw >= FAR_TURN ? 1 : 0;
}

/** True when the camera pixel at display (x, y) with segmentation class `cls` covers the jewelry. */
export function occludes(cls: number, x: number, y: number, z: Zone): boolean {
  if (z.kind === 'necklace') return cls === CAT_FACE;
  if (cls === CAT_HAIR) {
    const r = HAIR_COVER_MM * z.ppm;
    return z.lobes.some((l) => (x - l.x) ** 2 + (y - (l.y - HAIR_LIFT_MM * z.ppm)) ** 2 < r * r);
  }
  return cls === CAT_FACE && z.far !== 0 && (x - z.faceCx) * z.far > 0;
}

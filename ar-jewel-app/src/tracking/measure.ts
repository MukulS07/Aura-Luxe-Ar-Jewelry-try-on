import type { Pt } from '../types';

/** Human-size constants. Population averages, not measurements of the visitor. TODO(confirm): validate on the booth test. */
export const NECK_TO_SHOULDER = 0.29; // neck breadth / shoulder breadth
export const NECK_WIDTH_RANGE_MM: [number, number] = [95, 150];
export const SCALE_BLEND_BODY = 0.3; // weight of the body-derived scale when both agree
export const SCALE_AGREE: [number, number] = [0.75, 1.35]; // body/face ratio treated as plausible

/**
 * Yaw and pitch (radians) from a MediaPipe facial transformation matrix (4x4, column-major).
 * Conventions match `Tracking`: yaw + = face turned toward screen right, pitch - = looking up.
 * `forward` is the face's +Z axis in camera space. yawSign = -1 was calibrated on a real photo and its mirror (e2e/tracking.spec.ts).
 */
export function headPoseFromMatrix(m: ArrayLike<number>, yawSign = -1): { yaw: number; pitch: number } | null {
  if (m.length < 16) return null;
  const fx = m[8],
    fy = m[9],
    fz = m[10];
  const len = Math.hypot(fx, fy, fz);
  if (!len || !Number.isFinite(len)) return null;
  return {
    yaw: yawSign * Math.atan2(fx / len, Math.abs(fz / len)),
    pitch: -Math.asin(Math.max(-1, Math.min(1, fy / len))),
  };
}

/** Combine the face-derived scale with the shoulder-derived one. Falls back to the face scale when they disagree. */
export function fuseScale(facePxPerMm: number, bodyPxPerMm?: number): { pxPerMm: number; fused: boolean } {
  if (!bodyPxPerMm || !Number.isFinite(bodyPxPerMm)) return { pxPerMm: facePxPerMm, fused: false };
  const r = bodyPxPerMm / facePxPerMm;
  if (r < SCALE_AGREE[0] || r > SCALE_AGREE[1]) return { pxPerMm: facePxPerMm, fused: false };
  return { pxPerMm: facePxPerMm * (1 - SCALE_BLEND_BODY) + bodyPxPerMm * SCALE_BLEND_BODY, fused: true };
}

/** Earlobe position relative to the cheek-edge landmark, in head-frame mm. TODO(confirm): measure on real heads. */
export const LOBE_OUT_MM = 8; // further out than the cheek-edge landmark
export const LOBE_DROP_FROM_CHEEK_MM = 38; // below the cheek-edge landmark
export const LOBE_BACK_MM = 30; // behind the cheek plane (ears sit behind the cheekbone)
/** Half-sizes of the skull ellipsoid that hides the far earring on a head turn (FR-5). TODO(confirm). */
export const HEAD_HALF_MM = { x: 68, y: 105, z: 85 };

/**
 * Display-px offset of a head-frame point (mm; x right, y up, z out of the face) under the head rotation
 * `m` (MediaPipe 4x4 column-major, camera space: x right, y up, z toward the camera). Display is mirrored, so x flips.
 */
export function headOffsetPx(m: ArrayLike<number>, v: [number, number, number], pxPerMm: number): Pt {
  const cx = m[0] * v[0] + m[4] * v[1] + m[8] * v[2];
  const cy = m[1] * v[0] + m[5] * v[1] + m[9] * v[2];
  return { x: -cx * pxPerMm, y: -cy * pxPerMm };
}

/** Pixels per mm from the shoulder line: 2D shoulder distance over the model's metric (3D) shoulder distance. */
export function bodyScale(shoulderPx: number, shoulderWorldM: number, torsoYawRad: number): number | undefined {
  if (shoulderWorldM <= 0 || Math.abs(torsoYawRad) > 0.5) return undefined; // turned torso shortens the 2D span
  return shoulderPx / (shoulderWorldM * 1000);
}

/** Neck base width (mm) from the shoulder width, clamped to a plausible range. */
export function neckWidthMm(shoulderMm: number | undefined, fallbackMm: number): number {
  if (!shoulderMm) return fallbackMm;
  return Math.max(NECK_WIDTH_RANGE_MM[0], Math.min(NECK_WIDTH_RANGE_MM[1], shoulderMm * NECK_TO_SHOULDER));
}

/** Torso yaw from the metric z-difference of the shoulders (radians). */
export function torsoYaw(zLeft: number, zRight: number, shoulderWorldM: number): number {
  if (shoulderWorldM <= 0) return 0;
  return Math.asin(Math.max(-1, Math.min(1, (zRight - zLeft) / shoulderWorldM)));
}

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

import type { Pt, Tracking, NecklineData, EarData } from '../types';
import {
  bodyScale,
  dist,
  fuseScale,
  headOffsetPx,
  headPoseFromMatrix,
  LOBE_BACK_MM,
  LOBE_DROP_FROM_CHEEK_MM,
  LOBE_OUT_MM,
  lerp,
  neckWidthMm,
  torsoYaw,
} from './measure';
import { categoryShare, HAIR_COVER_THRESHOLD, type CategoryMask } from './occlusion';
import { nearestX, pickClosest } from './pick';

export interface LM {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}
export interface View {
  W: number;
  H: number;
  vw: number;
  vh: number;
}

/** Optional extra signals from the tracker. `solve` still works with faces and poses alone. */
export interface Extras {
  /** Facial transformation matrices, same order as `faces` */
  matrices?: (ArrayLike<number> | undefined)[];
  /** Pose world landmarks (metres), same order as `poses` */
  worldPoses?: LM[][];
  /** Latest person/hair segmentation mask */
  mask?: CategoryMask;
}

// Key Facial Anthropometric Landmarks (MediaPipe 468/478)
const NOSE = 1,
  CHIN = 152,
  TOP = 10,
  MID_EYES = 168;
const CHEEK_L = 234,
  CHEEK_R = 454;
const LOBE_L_TRAGUS = 177,
  LOBE_L_BASE = 138;
const LOBE_R_TRAGUS = 401,
  LOBE_R_BASE = 367;
const PUPIL_L = 468,
  PUPIL_R = 473;
const EYE_OUT_L = 33,
  EYE_OUT_R = 263;
// MediaPipe face-oval landmark loop, in order
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
  234, 127, 162, 21, 54, 103, 67, 109,
];

// Pose Landmarks
const POSE_EAR_L = 7,
  POSE_EAR_R = 8;
const SHOULDER_L = 11,
  SHOULDER_R = 12;
const MIN_VIS = 0.4;

/** Adult Anthropometric Standards (ISO 7250 / ANSI Human Dimensions in mm) */
export const ADULT_IPD_MM = 63.0; // Interpupillary distance (~63mm)
export const ADULT_OUTER_EYE_MM = 92.0; // Outer canthus distance (~92mm)
export const ADULT_FACE_WIDTH_MM = 140.0; // Bitemporal face width (~140mm)
export const ADULT_NECK_WIDTH_MM = 122.0; // Base of neck circumference diameter (~122mm)
export const LOBE_DROP_MM = 12.0; // Tragus-to-earlobe piercing drop (~12mm)

/** Normalised video coords -> mirrored, cover-fitted display px. */
export function toView(p: LM, v: View): Pt {
  const s = Math.max(v.W / v.vw, v.H / v.vh);
  const ox = (v.W - v.vw * s) / 2,
    oy = (v.H - v.vh * s) / 2;
  return { x: v.W - (ox + p.x * v.vw * s), y: oy + p.y * v.vh * s };
}

export function solve(faces: LM[][], poses: LM[][], view: View, ex: Extras = {}): Tracking | null {
  if (!faces.length) return null;

  const faceBoxW = faces.map((f) => {
    const p1 = f[CHEEK_L] ?? f[0];
    const p2 = f[CHEEK_R] ?? f[0];
    return dist(toView(p1, view), toView(p2, view));
  });

  const fi = pickClosest(faceBoxW);
  if (fi < 0) return null;
  const f = faces[fi];

  const cL = toView(f[CHEEK_L] ?? f[0], view);
  const cR = toView(f[CHEEK_R] ?? f[0], view);
  const [leftCheek, rightCheek] = cL.x <= cR.x ? [cL, cR] : [cR, cL];

  const nose = toView(f[NOSE] ?? f[0], view);
  const chin = toView(f[CHIN] ?? f[0], view);
  const top = toView(f[TOP] ?? f[0], view);
  const midEyes = f[MID_EYES] ? toView(f[MID_EYES], view) : { x: (leftCheek.x + rightCheek.x) / 2, y: (top.y + chin.y) * 0.45 };

  const faceW = dist(leftCheek, rightCheek);
  const faceH = dist(top, chin);
  if (faceW < 20) return null;

  const mid = { x: (leftCheek.x + rightCheek.x) / 2, y: (leftCheek.y + rightCheek.y) / 2 };
  let yaw = Math.asin(Math.max(-1, Math.min(1, (nose.x - mid.x) / (faceW / 2))));
  const roll = Math.atan2(rightCheek.y - leftCheek.y, rightCheek.x - leftCheek.x);

  // Pitch calculation (head tilt up / down)
  const eyeToNose = Math.max(1, nose.y - midEyes.y);
  const noseToChin = Math.max(1, chin.y - nose.y);
  const pitchRatio = (eyeToNose - noseToChin * 0.72) / (faceH * 0.5);
  let pitch = Math.asin(Math.max(-0.9, Math.min(0.9, pitchRatio)));

  // The 3D face transform is far steadier than 2D ratios; roll stays 2D (cheek line), it is already exact.
  const hp = ex.matrices?.[fi] ? headPoseFromMatrix(ex.matrices[fi]!) : null;
  if (hp) {
    yaw = hp.yaw;
    pitch = hp.pitch;
  }

  // --- 1. Real Anthropometric Scale (Pixels Per Millimeter) ---
  let pxPerMm: number = faceW / ADULT_FACE_WIDTH_MM;
  if (f[PUPIL_L] && f[PUPIL_R] && (f[PUPIL_L].x !== f[0].x || f[PUPIL_R].x !== f[0].x)) {
    const pL = toView(f[PUPIL_L], view),
      pR = toView(f[PUPIL_R], view);
    const ipdPx = dist(pL, pR);
    if (ipdPx > 20) pxPerMm = ipdPx / ADULT_IPD_MM;
  } else if (f[EYE_OUT_L] && f[EYE_OUT_R] && (f[EYE_OUT_L].x !== f[0].x || f[EYE_OUT_R].x !== f[0].x)) {
    const eL = toView(f[EYE_OUT_L], view),
      eR = toView(f[EYE_OUT_R], view);
    const eyeDistPx = dist(eL, eR);
    if (eyeDistPx > 30) pxPerMm = eyeDistPx / ADULT_OUTER_EYE_MM;
  }

  // Match the pose to this face, then cross-check the scale with the shoulder line (metric world landmarks).
  const pi = poses.length
    ? nearestX(
        poses.map((q) => toView(q[0] ?? { x: 0, y: 0 }, view).x),
        nose.x,
      )
    : -1;
  const pose = pi >= 0 ? poses[pi] : undefined;
  let shoulderMm: number | undefined;
  let scaleSource: Tracking['scaleSource'] = 'face';
  const wl = ex.worldPoses?.[pi]?.[SHOULDER_L],
    wr = ex.worldPoses?.[pi]?.[SHOULDER_R];
  if (pose && wl && wr && (pose[SHOULDER_L]?.visibility ?? 1) > MIN_VIS && (pose[SHOULDER_R]?.visibility ?? 1) > MIN_VIS) {
    const worldM = Math.hypot(wl.x - wr.x, wl.y - wr.y, (wl.z ?? 0) - (wr.z ?? 0));
    const shoulderPx = dist(toView(pose[SHOULDER_L], view), toView(pose[SHOULDER_R], view));
    const bodyPx = bodyScale(shoulderPx, worldM, torsoYaw(wl.z ?? 0, wr.z ?? 0, worldM));
    const fused = fuseScale(pxPerMm, bodyPx);
    pxPerMm = fused.pxPerMm;
    shoulderMm = worldM * 1000; // metric, independent of the pixel scale
    if (fused.fused) scaleSource = 'face+body';
  }

  // --- 2. Precise Anatomical Ear Lobe Measurement ---
  let earL: Pt, earR: Pt;
  let isEarMeasured = false;

  // Subnasale / nose base height (landmark 2) and mouth (landmark 17)
  const noseBase = f[2] ? toView(f[2], view) : nose;
  const mouthY = f[17] ? toView(f[17], view).y : (nose.y + chin.y) * 0.5;
  // Natural anatomical earlobe height aligns between nose base and mouth
  const targetLobeY = noseBase.y * 0.4 + mouthY * 0.6;

  const hasFaceLobes =
    f[LOBE_L_TRAGUS] &&
    f[LOBE_L_BASE] &&
    f[LOBE_R_TRAGUS] &&
    f[LOBE_R_BASE] &&
    (f[LOBE_L_TRAGUS].x !== f[0].x || f[LOBE_R_TRAGUS].x !== f[0].x);

  if (hasFaceLobes) {
    const lb = toView(f[LOBE_L_BASE], view),
      rb = toView(f[LOBE_R_BASE], view);

    // Vector lateral offset: away from face center
    const lateralShift = 6.0 * pxPerMm;
    const pA: Pt = {
      x: lb.x - Math.sign(lb.x - mid.x || -1) * lateralShift,
      y: (lb.y + targetLobeY) * 0.5,
    };
    const pB: Pt = {
      x: rb.x + Math.sign(rb.x - mid.x || 1) * lateralShift,
      y: (rb.y + targetLobeY) * 0.5,
    };
    [earL, earR] = pA.x <= pB.x ? [pA, pB] : [pB, pA];
    isEarMeasured = true;
  } else {
    // Robust fallback using cheek edge + tragus-to-lobe drop
    const drop = Math.max(22 * pxPerMm, faceH * 0.22);
    earL = { x: leftCheek.x - 7 * pxPerMm, y: leftCheek.y + drop };
    earR = { x: rightCheek.x + 7 * pxPerMm, y: rightCheek.y + drop };
  }

  // Head turned: place each lobe from the 3D head rotation, so the near ear swings out and the far ear tucks in.
  const rot = ex.matrices?.[fi];
  if (rot && rot.length >= 16) {
    const sL = rot[0] >= 0 ? 1 : -1; // which head-frame side faces screen-left
    const lobeAt = (cheek: Pt, side: number): Pt => {
      const o = headOffsetPx(rot, [side * LOBE_OUT_MM, -LOBE_DROP_FROM_CHEEK_MM, -LOBE_BACK_MM], pxPerMm);
      return { x: cheek.x + o.x, y: cheek.y + o.y };
    };
    earL = lobeAt(leftCheek, sL);
    earR = lobeAt(rightCheek, -sL);
  }

  // --- 3. Precise Anatomical Neckline & Clavicle Measurement ---
  // Distance from chin to suprasternal notch (jugular notch / collarbone hollow)
  // Standard adult anthropometric chin-to-notch distance is ~82mm
  const chinToNotchMm = Math.max(68, Math.min(105, 82.0 + pitch * 28.0));
  const estimatedNotchY = chin.y + chinToNotchMm * pxPerMm;

  let neckCenter: Pt = {
    x: chin.x + Math.sin(roll) * (chinToNotchMm * pxPerMm * 0.15),
    y: estimatedNotchY,
  };
  let neckRoll = roll * 0.6;
  let hasPose = false;

  // Enhance with Pose Landmarker when shoulders are in frame
  {
    const p = pose;
    if (p) {
      // Reinforce earlobes using Pose ears (landmarks 7 & 8)
      const pel = p[POSE_EAR_L],
        per = p[POSE_EAR_R];
      if (pel && per && (pel.visibility ?? 1) > MIN_VIS && (per.visibility ?? 1) > MIN_VIS) {
        const peA = toView(pel, view),
          peB = toView(per, view);
        const [pLeftEar, pRightEar] = peA.x <= peB.x ? [peA, peB] : [peB, peA];
        // Earlobe is ~14mm below auditory meatus / ear canal
        const pLobeL = { x: pLeftEar.x, y: pLeftEar.y + 14 * pxPerMm };
        const pLobeR = { x: pRightEar.x, y: pRightEar.y + 14 * pxPerMm };
        earL = { x: earL.x * 0.5 + pLobeL.x * 0.5, y: earL.y * 0.5 + pLobeL.y * 0.5 };
        earR = { x: earR.x * 0.5 + pLobeR.x * 0.5, y: earR.y * 0.5 + pLobeR.y * 0.5 };
        isEarMeasured = true;
      }

      // Check pose shoulders for true collarbone alignment (landmarks 11 & 12)
      const sl = p[SHOULDER_L],
        sr = p[SHOULDER_R];
      if (sl && sr && (sl.visibility ?? 1) > MIN_VIS && (sr.visibility ?? 1) > MIN_VIS) {
        const s1 = toView(sl, view),
          s2 = toView(sr, view);
        const [sa, sb] = s1.x <= s2.x ? [s1, s2] : [s2, s1];
        const shoulderMid = { x: (sa.x + sb.x) / 2, y: (sa.y + sb.y) / 2 };

        // Suprasternal notch sits at the top hollow of clavicles (~68% from chin to shoulder line)
        const poseClavicleY = chin.y + (shoulderMid.y - chin.y) * 0.68;
        neckCenter = {
          x: neckCenter.x * 0.35 + shoulderMid.x * 0.65,
          y: estimatedNotchY * 0.35 + poseClavicleY * 0.65,
        };
        neckRoll = Math.atan2(sb.y - sa.y, sb.x - sa.x);
        hasPose = true;
      }
    }
  }

  // Neck base width across clavicles and trapezius (ANSI ~122mm)
  const measuredNeckWidthMm = neckWidthMm(shoulderMm, ADULT_NECK_WIDTH_MM);
  const measuredNeckWidthPx = measuredNeckWidthMm * pxPerMm;
  const halfW = measuredNeckWidthPx / 2;

  // Neck base attachment roots (curving upwards along trapezius by ~16mm)
  const neckLeft: Pt = {
    x: neckCenter.x - halfW * Math.cos(neckRoll),
    y: neckCenter.y - halfW * Math.sin(neckRoll) - 16 * pxPerMm,
  };
  const neckRight: Pt = {
    x: neckCenter.x + halfW * Math.cos(neckRoll),
    y: neckCenter.y + halfW * Math.sin(neckRoll) - 16 * pxPerMm,
  };

  // 5-point anatomical neckline contour curve
  const necklineContour: Pt[] = [neckLeft, lerp(neckLeft, neckCenter, 0.52), neckCenter, lerp(neckCenter, neckRight, 0.48), neckRight];

  const earSpanMm = dist(earL, earR) / pxPerMm;

  // Sternum Drop: center of chest where pendants hang (~72mm below jugular notch)
  const sternumDropMm = 72.0;
  const sternumDrop: Pt = {
    x: neckCenter.x - Math.sin(neckRoll) * (sternumDropMm * pxPerMm),
    y: neckCenter.y + Math.cos(neckRoll) * (sternumDropMm * pxPerMm),
  };

  const necklineData: NecklineData = {
    center: neckCenter,
    left: neckLeft,
    right: neckRight,
    widthPx: measuredNeckWidthPx,
    widthMm: measuredNeckWidthMm,
    contour: necklineContour,
    roll: neckRoll,
    sternumDrop,
  };

  const lobeR = 10 * pxPerMm;
  const earData: EarData = {
    lobeL: earL,
    lobeR: earR,
    spanMm: earSpanMm,
    isMeasured: isEarMeasured,
    hiddenL: !!ex.mask && categoryShare(ex.mask, earL, lobeR, view) > HAIR_COVER_THRESHOLD,
    hiddenR: !!ex.mask && categoryShare(ex.mask, earR, lobeR, view) > HAIR_COVER_THRESHOLD,
  };

  // True when user is facing camera stably within optimal try-on angle
  const isLocked = faceW >= 70 && Math.abs(yaw) < 0.65;

  return {
    faceCount: faces.length,
    center: mid,
    faceW,
    faceH,
    yaw,
    pitch,
    roll,
    earL,
    earR,
    chin,
    neck: {
      x: neckCenter.x,
      y: neckCenter.y,
      w: measuredNeckWidthPx,
      roll: neckRoll,
    },
    hasPose,
    pxPerMm,
    neckline: necklineData,
    ears: earData,
    isLocked,
    faceOval: FACE_OVAL.map((i) => toView(f[i] ?? f[0], view)),
    poseSource: hp ? 'matrix' : 'landmarks',
    scaleSource,
    hands: [],
  };
}

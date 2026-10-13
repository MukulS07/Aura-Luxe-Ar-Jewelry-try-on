import type { HandData, Pt } from '../types';
import { dist, lerp } from './measure';
import type { LM, View } from './solve';
import { toView } from './solve';

/** Experimental (rings and bangles, owner decision 2026-10-12). Averages, TODO(confirm) on real hands. */
export const PALM_WIDTH_MM = 72; // index MCP to pinky MCP
export const RING_ALONG_PROXIMAL = 0.45; // ring position from MCP toward PIP
export const BANGLE_OFFSET_MM = 15; // from the wrist point toward the forearm

export interface RawHand {
  landmarks: LM[];
  label: string;
  score: number;
}

// MediaPipe hand landmark indices
const WRIST = 0,
  INDEX_MCP = 5,
  MIDDLE_MCP = 9,
  RING_MCP = 13,
  RING_PIP = 14,
  PINKY_MCP = 17;

/**
 * Turn raw hand landmarks into jewelry anchors in display px.
 * `faceCx` (display px) decides left/right on screen, so we never depend on the model's handedness label.
 * `palmFacing` uses the label, which the model computes for a mirrored image; we feed an unmirrored one, so it is inverted here.
 */
export function solveHands(hands: RawHand[], view: View, faceCx: number): HandData[] {
  const out: HandData[] = [];
  for (const h of hands) {
    const lm = h.landmarks;
    if (lm.length < 21) continue;
    const p = (i: number): Pt => toView(lm[i], view);
    const wrist = p(WRIST),
      indexB = p(INDEX_MCP),
      midB = p(MIDDLE_MCP),
      ringB = p(RING_MCP),
      ringP = p(RING_PIP),
      pinkyB = p(PINKY_MCP);
    const palmWidthPx = dist(indexB, pinkyB);
    if (palmWidthPx < 8) continue;
    const pxPerMm = palmWidthPx / PALM_WIDTH_MM;

    const toFingers = { x: midB.x - wrist.x, y: midB.y - wrist.y };
    const len = Math.hypot(toFingers.x, toFingers.y) || 1;
    const roll = Math.atan2(toFingers.y, toFingers.x); // wrist -> fingers, screen space
    const bangleAnchor: Pt = {
      x: wrist.x - (toFingers.x / len) * BANGLE_OFFSET_MM * pxPerMm,
      y: wrist.y - (toFingers.y / len) * BANGLE_OFFSET_MM * pxPerMm,
    };

    // Screen-space cross of (wrist->index) x (wrist->pinky); sign flips between palm and back of the hand.
    const cross = (indexB.x - wrist.x) * (pinkyB.y - wrist.y) - (indexB.y - wrist.y) * (pinkyB.x - wrist.x);
    const modelRight = h.label.toLowerCase() === 'right';
    const palmFacing = modelRight ? cross > 0 : cross < 0;

    out.push({
      side: wrist.x < faceCx ? 'left' : 'right',
      score: h.score,
      wrist,
      palmCenter: lerp(wrist, midB, 0.55),
      ringBase: ringB,
      ringAnchor: lerp(ringB, ringP, RING_ALONG_PROXIMAL),
      ringAngle: Math.atan2(ringP.y - ringB.y, ringP.x - ringB.x),
      bangleAnchor,
      roll,
      palmWidthPx,
      pxPerMm,
      palmFacing,
    });
  }
  return out;
}

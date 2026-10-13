import type { Tracking } from '../types';

/**
 * The measuring step before any jewelry is shown. It watches Tracking until face, ears and neck have all been
 * seen steadily for a moment, then reports `ready` with a small profile. Nothing leaves the browser: the profile
 * lives in memory for this visit only (agent.md rule 1).
 */

// Proposed values, TODO(confirm) at the booth test.
export const STABLE_MS = 1200; // all checks must hold this long
export const GIVE_UP_MS = 7000; // after this, ears alone are enough (shoulders out of frame): never block the visitor
export const LOST_MS = 2000; // face gone this long: measure again
export const MAX_FRAME_GAP_MS = 150; // a frame counts for at most this much hold time, so a frozen thread cannot fake stability
export const MIN_FACE_PX = 70;
export const MAX_YAW = 0.35; // radians, about 20 degrees

export interface Profile {
  /** Median over the stable frames. `neckMm` is undefined when shoulders were never seen. */
  faceWidthMm: number;
  earSpanMm: number;
  neckMm?: number;
  pxPerMm: number;
}

export interface MeasureState {
  phase: 'measuring' | 'ready';
  face: boolean;
  ears: boolean;
  neck: boolean;
  /** 0..1 progress of the stable hold */
  progress: number;
  profile?: Profile;
  /** The one hint to show while measuring */
  hint: 'none' | 'noface' | 'turn' | 'shoulders';
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const fresh = (): MeasureState => ({ phase: 'measuring', face: false, ears: false, neck: false, progress: 0, hint: 'noface' });

export class Measurer {
  private startedAt?: number;
  private heldMs = 0; // accumulated stable time
  private lastAt?: number;
  private lostSince?: number;
  private samples: { face: number; ear: number; neck: number | undefined; ppm: number }[] = [];
  private state: MeasureState = fresh();

  reset() {
    this.startedAt = this.lostSince = this.lastAt = undefined;
    this.heldMs = 0;
    this.samples = [];
    this.state = fresh();
  }

  /** Continue from an earlier scan of the same visitor: ready at once (a long loss still triggers a new measuring). */
  assume(profile: Profile): MeasureState {
    this.reset();
    return (this.state = {
      phase: 'ready',
      face: true,
      ears: true,
      neck: profile.neckMm !== undefined,
      progress: 1,
      hint: 'none',
      profile,
    });
  }

  update(tr: Tracking | null, nowMs: number): MeasureState {
    this.startedAt ??= nowMs;

    if (this.state.phase === 'ready') {
      if (tr) this.lostSince = undefined;
      else {
        this.lostSince ??= nowMs;
        if (nowMs - this.lostSince > LOST_MS) {
          this.reset();
          this.startedAt = nowMs;
        }
      }
      return this.state;
    }

    const face = !!tr && tr.faceW >= MIN_FACE_PX && Math.abs(tr.yaw) < MAX_YAW;
    const ears = face && !!tr?.ears.isMeasured;
    const neck = face && !!tr?.hasPose;
    const elapsed = nowMs - this.startedAt;
    const ok = (face && ears && neck) || (face && ears && elapsed > GIVE_UP_MS);

    const dt = this.lastAt === undefined ? 0 : Math.min(MAX_FRAME_GAP_MS, nowMs - this.lastAt);
    this.lastAt = nowMs;
    if (ok && tr) {
      this.heldMs += dt;
      if (this.samples.length < 90)
        this.samples.push({
          face: tr.faceW / tr.pxPerMm,
          ear: tr.ears.spanMm,
          neck: neck ? tr.neckline.widthMm : undefined,
          ppm: tr.pxPerMm,
        });
    } else {
      this.heldMs = 0;
      this.samples = [];
    }
    const progress = Math.min(1, this.heldMs / STABLE_MS);

    if (progress >= 1) {
      const necks = this.samples.map((s) => s.neck).filter((n): n is number => n !== undefined);
      this.state = {
        phase: 'ready',
        face: true,
        ears: true,
        neck,
        progress: 1,
        hint: 'none',
        profile: {
          faceWidthMm: median(this.samples.map((s) => s.face)),
          earSpanMm: median(this.samples.map((s) => s.ear)),
          neckMm: necks.length ? median(necks) : undefined,
          pxPerMm: median(this.samples.map((s) => s.ppm)),
        },
      };
      return this.state;
    }

    let hint: MeasureState['hint'] = 'none';
    if (!tr || tr.faceW < MIN_FACE_PX) hint = 'noface';
    else if (Math.abs(tr.yaw) >= MAX_YAW) hint = 'turn';
    else if (!neck && elapsed > 2500) hint = 'shoulders';
    this.state = { phase: 'measuring', face, ears, neck, progress, hint };
    return this.state;
  }
}

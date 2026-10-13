import { describe, expect, it } from 'vitest';
import { bodyScale, fuseScale, headOffsetPx, headPoseFromMatrix, neckWidthMm, torsoYaw } from '../src/tracking/measure';
import { solveHands, type RawHand } from '../src/tracking/hands';
import { categoryShare, fromView } from '../src/tracking/occlusion';
import { solve, toView, type LM } from '../src/tracking/solve';

const view = { W: 1000, H: 1000, vw: 1000, vh: 1000 };

describe('head pose from matrix', () => {
  const m = (fx: number, fy: number, fz: number) => [1, 0, 0, 0, 0, 1, 0, 0, fx, fy, fz, 0, 0, 0, 0, 1];
  it('facing the camera is zero', () => {
    const p = headPoseFromMatrix(m(0, 0, 1))!;
    expect(p.yaw).toBeCloseTo(0);
    expect(p.pitch).toBeCloseTo(0);
  });
  it('turning flips the yaw sign, looking up is negative pitch', () => {
    expect(headPoseFromMatrix(m(0.5, 0, 0.87))!.yaw).toBeLessThan(0);
    expect(headPoseFromMatrix(m(-0.5, 0, 0.87))!.yaw).toBeGreaterThan(0);
    expect(headPoseFromMatrix(m(0, 0.4, 0.9))!.pitch).toBeLessThan(0);
  });
  it('rejects bad input', () => {
    expect(headPoseFromMatrix([1, 2])).toBeNull();
    expect(headPoseFromMatrix(m(0, 0, 0))).toBeNull();
  });
});

describe('scale and neck', () => {
  it('fuses only when body and face agree', () => {
    expect(fuseScale(2, 2.2).fused).toBe(true);
    expect(fuseScale(2, 2.2).pxPerMm).toBeCloseTo(2.06);
    expect(fuseScale(2, 3.5)).toEqual({ pxPerMm: 2, fused: false });
    expect(fuseScale(2, undefined)).toEqual({ pxPerMm: 2, fused: false });
  });
  it('ignores the shoulder scale when the torso is turned', () => {
    expect(bodyScale(400, 0.4, 0.8)).toBeUndefined();
    expect(bodyScale(400, 0.4, 0)).toBeCloseTo(1);
  });
  it('torso yaw from shoulder depth', () => {
    expect(torsoYaw(0, 0, 0.4)).toBe(0);
    expect(torsoYaw(0, 0.2, 0.4)).toBeCloseTo(Math.asin(0.5));
  });
  it('neck width follows shoulders inside the plausible range', () => {
    expect(neckWidthMm(undefined, 122)).toBe(122);
    expect(neckWidthMm(400, 122)).toBeCloseTo(116);
    expect(neckWidthMm(200, 122)).toBe(95);
    expect(neckWidthMm(900, 122)).toBe(150);
  });
});

describe('solve with extras', () => {
  const face = (): LM[] => {
    const f: LM[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.4 }));
    f[234] = { x: 0.4, y: 0.4 };
    f[454] = { x: 0.6, y: 0.4 };
    f[1] = { x: 0.5, y: 0.42 };
    f[152] = { x: 0.5, y: 0.6 };
    f[10] = { x: 0.5, y: 0.2 };
    return f;
  };
  const pose = (): LM[] => {
    const p: LM[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
    p[11] = { x: 0.35, y: 0.8, visibility: 1 };
    p[12] = { x: 0.65, y: 0.8, visibility: 1 };
    return p;
  };
  const world = (w: number): LM[] => {
    const p: LM[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
    p[11] = { x: -w / 2, y: 0, z: 0 };
    p[12] = { x: w / 2, y: 0, z: 0 };
    return p;
  };
  it('uses the shoulder line for neck width and flags the fused scale', () => {
    const tr = solve([face()], [pose()], view, { worldPoses: [world(0.36)] })!;
    expect(tr.neckline.widthMm).toBeCloseTo(0.36 * 1000 * 0.29, 0);
    expect(tr.poseSource).toBe('landmarks');
  });
  it('takes yaw from the matrix when given', () => {
    const m = [1, 0, 0, 0, 0, 1, 0, 0, 0.5, 0, 0.87, 0, 0, 0, 0, 1];
    const tr = solve([face()], [], view, { matrices: [m] })!;
    expect(tr.poseSource).toBe('matrix');
    expect(tr.yaw).toBeLessThan(0);
  });
  it('flags a lobe covered by hair', () => {
    const w = 100,
      h = 100,
      data = new Uint8Array(w * h).fill(1); // all hair
    const tr = solve([face()], [], view, { mask: { data, w, h } })!;
    expect(tr.ears.hiddenL && tr.ears.hiddenR).toBe(true);
    const clear = solve([face()], [], view, { mask: { data: new Uint8Array(w * h), w, h } })!;
    expect(clear.ears.hiddenL || clear.ears.hiddenR).toBe(false);
  });
  it('works without any extras (backward compatible)', () => {
    const tr = solve([face()], [], view)!;
    expect(tr.hands).toEqual([]);
    expect(tr.ears.hiddenL).toBe(false);
  });
});

describe('occlusion helpers', () => {
  it('fromView inverts toView', () => {
    const p = { x: 0.3, y: 0.7 };
    const back = fromView(toView(p, view), view);
    expect(back.x).toBeCloseTo(0.3);
    expect(back.y).toBeCloseTo(0.7);
  });
  it('measures the share of a category inside a circle', () => {
    const w = 10,
      h = 10,
      data = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < 5; x++) data[y * w + x] = 1;
    const v = { W: 10, H: 10, vw: 10, vh: 10 };
    expect(categoryShare({ data, w, h }, { x: 7.5, y: 5 }, 1, v)).toBe(1); // view is mirrored: display x 7.5 is the left half of the mask
    expect(categoryShare({ data, w, h }, { x: 2.5, y: 5 }, 1, v)).toBe(0);
  });
});

describe('hands', () => {
  const lm = (): LM[] => {
    const l: LM[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
    l[0] = { x: 0.5, y: 0.8 };
    l[5] = { x: 0.45, y: 0.55 };
    l[9] = { x: 0.5, y: 0.5 };
    l[13] = { x: 0.55, y: 0.55 };
    l[14] = { x: 0.56, y: 0.48 };
    l[17] = { x: 0.6, y: 0.6 };
    return l;
  };
  it('puts the ring on the ring finger and the bangle past the wrist', () => {
    const raw: RawHand[] = [{ landmarks: lm(), label: 'Right', score: 0.9 }];
    const [h] = solveHands(raw, view, 500);
    const ring = toView(lm()[13], view),
      wrist = toView(lm()[0], view);
    expect(Math.hypot(h.ringAnchor.x - ring.x, h.ringAnchor.y - ring.y)).toBeGreaterThan(0);
    expect(h.bangleAnchor.y).toBeGreaterThan(wrist.y); // toward the forearm (down in this pose)
    expect(h.pxPerMm).toBeGreaterThan(0);
  });
  it('skips degenerate hands', () => {
    const l = lm();
    l[17] = { ...l[5] };
    expect(solveHands([{ landmarks: l, label: 'Left', score: 1 }], view, 500)).toEqual([]);
    expect(solveHands([{ landmarks: [], label: 'Left', score: 1 }], view, 500)).toEqual([]);
  });
});

describe('head-frame offsets', () => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  // Real matrix from the e2e photo: head turned about 19 degrees, z axis pointing toward image-right
  const turned = [0.944, -0.031, -0.329, 0, 0.062, 0.994, 0.085, 0, 0.325, -0.101, 0.94, 0, 0, 0, 0, 1];
  it('frontal: lateral mm maps to mirrored px, depth does not move the point', () => {
    const o = headOffsetPx(I, [8, 0, -30], 2);
    expect(o.x).toBeCloseTo(-16);
    expect(o.y).toBeCloseTo(0);
  });
  it('a drop below the point moves it down on screen (y grows)', () => {
    expect(headOffsetPx(I, [0, -10, 0], 2).y).toBeCloseTo(20);
  });
  it('turned head: a point behind the face swings sideways with the turn', () => {
    const behind = headOffsetPx(turned, [0, 0, -30], 2);
    expect(behind.x).toBeGreaterThan(15); // 30 mm * sin(19deg) * 2 px/mm, toward screen right
  });
});

import { describe, expect, it } from 'vitest';
import type { Tracking } from '../src/types';
import { GIVE_UP_MS, LOST_MS, MAX_FRAME_GAP_MS, Measurer, STABLE_MS } from '../src/tracking/measurer';
import { solve, type LM } from '../src/tracking/solve';

const view = { W: 1000, H: 1000, vw: 1000, vh: 1000 };
const faceLm = (): LM[] => {
  const f: LM[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.4 }));
  f[234] = { x: 0.4, y: 0.4 };
  f[454] = { x: 0.6, y: 0.4 };
  f[1] = { x: 0.5, y: 0.42 };
  f[152] = { x: 0.5, y: 0.6 };
  f[10] = { x: 0.5, y: 0.2 };
  // distinct jaw-base and tragus points so the ears count as measured from the face alone
  f[177] = { x: 0.41, y: 0.47 };
  f[138] = { x: 0.42, y: 0.5 };
  f[401] = { x: 0.59, y: 0.47 };
  f[367] = { x: 0.58, y: 0.5 };
  return f;
};
const poseLm = (): LM[] => {
  const p: LM[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  p[11] = { x: 0.35, y: 0.8, visibility: 1 };
  p[12] = { x: 0.65, y: 0.8, visibility: 1 };
  return p;
};
const world = (): LM[] => {
  const p: LM[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  p[11] = { x: -0.18, y: 0, z: 0 };
  p[12] = { x: 0.18, y: 0, z: 0 };
  return p;
};
const full = (): Tracking => solve([faceLm()], [poseLm()], view, { worldPoses: [world()] })!;
const noShoulders = (): Tracking => solve([faceLm()], [], view)!;

/** Feed one tracking result every 33 ms for `ms`. */
const feed = (m: Measurer, tr: Tracking | null, from: number, ms: number) => {
  let s = m.update(tr, from);
  for (let t = from + 33; t <= from + ms; t += 33) s = m.update(tr, t);
  return s;
};

describe('measuring step', () => {
  it('starts measuring with nothing found', () => {
    const s = new Measurer().update(null, 0);
    expect(s).toMatchObject({ phase: 'measuring', face: false, progress: 0, hint: 'noface' });
  });
  it('is ready after face, ears and neck hold steady, with a profile', () => {
    const m = new Measurer();
    expect(feed(m, full(), 0, STABLE_MS / 2).phase).toBe('measuring');
    const s = feed(m, full(), STABLE_MS / 2 + 33, STABLE_MS);
    expect(s.phase).toBe('ready');
    expect(s.profile?.neckMm).toBeGreaterThan(90);
    expect(s.profile?.earSpanMm).toBeGreaterThan(50);
  });
  it('a lost face restarts the hold', () => {
    const m = new Measurer();
    feed(m, full(), 0, STABLE_MS - 200);
    expect(m.update(null, STABLE_MS).progress).toBe(0);
    expect(feed(m, full(), STABLE_MS + 33, STABLE_MS / 2).phase).toBe('measuring');
  });
  it('without shoulders it asks to step back, then continues on ears alone after the give-up time', () => {
    const m = new Measurer();
    const early = feed(m, noShoulders(), 0, 3000);
    expect(early.phase).toBe('measuring');
    expect(early.hint).toBe('shoulders');
    const late = feed(m, noShoulders(), 3033, GIVE_UP_MS);
    expect(late.phase).toBe('ready');
    expect(late.profile?.neckMm).toBeUndefined();
  });
  it('a turned head asks to look at the camera', () => {
    const turned = { ...full(), yaw: 0.6 };
    expect(new Measurer().update(turned, 0).hint).toBe('turn');
  });
  it('stays ready through a short loss, measures again after a long one', () => {
    const m = new Measurer();
    feed(m, full(), 0, STABLE_MS + 100);
    expect(m.update(null, 5000).phase).toBe('ready');
    expect(m.update(null, 5000 + LOST_MS - 100).phase).toBe('ready');
    expect(m.update(null, 5000 + LOST_MS + 100).phase).toBe('measuring');
  });
  it('a frozen thread cannot fake stability: one long gap counts as one short frame', () => {
    const m = new Measurer();
    m.update(full(), 0);
    const s = m.update(full(), 6000); // six seconds between two frames
    expect(s.phase).toBe('measuring');
    expect(s.progress).toBeLessThanOrEqual(MAX_FRAME_GAP_MS / STABLE_MS + 0.001);
  });
  it('reset forgets everything', () => {
    const m = new Measurer();
    feed(m, full(), 0, STABLE_MS + 100);
    m.reset();
    expect(m.update(null, 99999).phase).toBe('measuring');
  });
});

import { describe, expect, it } from 'vitest';
import type { CatalogItem, Tracking } from '../src/types';
import { clampFit, defaultFit, Placement } from '../src/render/placement';
import { pieceSpec } from '../src/render/spec';
import { solve, type LM } from '../src/tracking/solve';

const H = 1000;
const view = { W: 1000, H, vw: 1000, vh: 1000 };

const face = (): LM[] => {
  const f: LM[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.4 }));
  f[234] = { x: 0.4, y: 0.4 };
  f[454] = { x: 0.6, y: 0.4 };
  f[1] = { x: 0.5, y: 0.42 };
  f[152] = { x: 0.5, y: 0.6 };
  f[10] = { x: 0.5, y: 0.2 };
  return f;
};
const track = (mask?: { data: Uint8Array; w: number; h: number }): Tracking => solve([face()], [], view, { mask })!;

const earrings = (extra: Partial<CatalogItem> = {}): CatalogItem => ({
  id: 'e',
  name: 'E',
  type: 'earrings',
  model: 'procedural:drop',
  material: 'yellow-gold',
  anchor: { offset: [0, 0, 0], scale: 1 },
  dimensions: { sizeMm: 40, yOffsetMm: 0 },
  active: true,
  ...extra,
});
const necklace = (): CatalogItem => ({
  ...earrings(),
  type: 'necklace',
  model: 'procedural:choker',
  dimensions: { sizeMm: 120, yOffsetMm: 0 },
});

/** Run enough frames for the smoothing and fade to settle. */
const settle = (p: Placement, tr: Tracking | null, it: CatalogItem, fit = defaultFit(), frames = 60) => {
  let fr = p.update(tr, it, 0, fit);
  for (let i = 1; i < frames; i++) fr = p.update(tr, it, i * 33, fit);
  return fr;
};

describe('piece spec', () => {
  it('reads size from the catalog item', () => expect(pieceSpec(earrings())).toEqual({ sizeMm: 40, yOffsetMm: 0 }));
  it('falls back to a per-type default', () => {
    expect(pieceSpec(earrings({ dimensions: undefined })).sizeMm).toBe(42);
    expect(pieceSpec({ ...necklace(), dimensions: undefined }).sizeMm).toBe(124);
    expect(pieceSpec(earrings({ dimensions: { sizeMm: 0 } })).sizeMm).toBe(42); // zero is not a size
  });
});

describe('earring placement', () => {
  it('puts one earring on each lobe, sized in real millimetres', () => {
    const tr = track();
    const fr = settle(new Placement(H), tr, earrings());
    expect(fr.count).toBe(2);
    expect(fr.pieces[0].x).toBeCloseTo(tr.ears.lobeL.x, 0);
    expect(fr.pieces[1].x).toBeCloseTo(tr.ears.lobeR.x, 0);
    expect(fr.pieces[0].y).toBeCloseTo(H - tr.ears.lobeL.y, 0);
    expect(fr.pieces[0].scale).toBeCloseTo(40 * tr.pxPerMm, 0);
    expect(fr.occluder.visible).toBe(true);
  });
  it('a bigger real size draws bigger, a height offset moves it down', () => {
    const tr = track();
    const a = settle(new Placement(H), tr, earrings()).pieces[0];
    const big = settle(new Placement(H), tr, earrings({ dimensions: { sizeMm: 80, yOffsetMm: 10 } })).pieces[0];
    expect(big.scale).toBeCloseTo(a.scale * 2, 0);
    expect(big.y).toBeLessThan(a.y); // scene y is up, so lower on screen = smaller y
  });
  it('fades out when the face is lost and stops drawing', () => {
    const p = new Placement(H);
    settle(p, track(), earrings());
    let fr = p.update(null, earrings(), 5000, defaultFit());
    for (let i = 0; i < 80; i++) fr = p.update(null, earrings(), 5000 + i * 33, defaultFit());
    expect(fr.opacity).toBeLessThan(0.01);
    expect(fr.count).toBe(0);
  });
  it('a new piece fades in from nothing', () => {
    const p = new Placement(H);
    settle(p, track(), earrings());
    p.restartFade();
    expect(p.update(track(), earrings(), 9000, defaultFit()).opacity).toBeLessThan(0.3);
  });
  it('hides only the earring whose lobe is under hair', () => {
    const w = 100,
      h = 100;
    const data = new Uint8Array(w * h);
    const tr0 = track();
    // paint hair only around the left lobe (display x -> mirrored mask x)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.abs((1 - x / w) * 1000 - tr0.ears.lobeL.x) < 60) data[y * w + x] = 1;
    const tr = track({ data, w, h });
    expect(tr.ears.hiddenL).toBe(true);
    expect(tr.ears.hiddenR).toBe(false);
    const fr = settle(new Placement(H), tr, earrings());
    expect(fr.pieces[0].opacity).toBeLessThan(0.05);
    expect(fr.pieces[1].opacity).toBeGreaterThan(0.95);
  });
  it('studs do not sway', () => {
    const p = new Placement(H);
    const stud = earrings({ dimensions: { sizeMm: 10, rigid: true } });
    for (let i = 0; i < 20; i++) p.update({ ...track(), yaw: Math.sin(i / 2) }, stud, i * 33, defaultFit());
    const fr = p.update({ ...track(), yaw: 0.8 }, stud, 700, defaultFit());
    expect(fr.pieces[0].rz).toBeCloseTo(-track().roll, 1);
  });
});

describe('necklace placement', () => {
  it('centres on the neck and is sized in real millimetres', () => {
    const tr = track();
    const fr = settle(new Placement(H), tr, necklace());
    expect(fr.count).toBe(1);
    expect(fr.pieces[0].x).toBeCloseTo(tr.neckline.center.x, 0);
    expect(fr.pieces[0].scale).toBeCloseTo(120 * tr.pxPerMm, 0);
    expect(fr.occluder.visible).toBe(false);
  });
});

describe('manual fit', () => {
  it('scales the piece and is clamped', () => {
    const tr = track();
    const a = settle(new Placement(H), tr, earrings()).pieces[0].scale;
    const b = settle(new Placement(H), tr, earrings(), { scale: 1.2, yMm: 0 }).pieces[0].scale;
    expect(b).toBeCloseTo(a * 1.2, 0);
    expect(clampFit({ scale: 5, yMm: -99 })).toEqual({ scale: 1.4, yMm: -40 });
  });
});

describe('face outline occluder', () => {
  it('follows the face oval, flipped into scene y', () => {
    const tr = track();
    const fr = settle(new Placement(H), tr, earrings());
    expect(tr.faceOval).toHaveLength(36);
    for (let i = 0; i < 36; i++) {
      expect(fr.occluder.oval[i * 2]).toBeCloseTo(tr.faceOval[i].x, 0);
      expect(fr.occluder.oval[i * 2 + 1]).toBeCloseTo(H - tr.faceOval[i].y, 0);
    }
  });
});

describe('latency compensation', () => {
  /** Slide the face right at a steady speed and read the drawn right-earring x after the filters settle. */
  const slide = (leadMs: number) => {
    const p = new Placement(H);
    const it = earrings();
    let fr = p.update(track(), it, 0, defaultFit(), leadMs);
    let last = 0;
    for (let i = 1; i < 90; i++) {
      const tr = track();
      const dx = i * 6; // 6 px per 33 ms frame, about 180 px/s
      const move = (q: { x: number; y: number }) => ({ ...q, x: q.x + dx });
      tr.center = move(tr.center);
      tr.earL = move(tr.earL);
      tr.earR = move(tr.earR);
      tr.ears = { ...tr.ears, lobeL: tr.earL, lobeR: tr.earR };
      fr = p.update(tr, it, i * 33, defaultFit(), leadMs);
      last = tr.ears.lobeR.x;
    }
    return { drawn: fr.pieces[1].x, tracked: last };
  };
  it('without lead the drawn earring trails the moving face', () => {
    const r = slide(0);
    expect(r.drawn).toBeLessThan(r.tracked);
  });
  it('with lead it catches up, and never overshoots the tracked position by much', () => {
    const a = slide(0),
      b = slide(40);
    expect(b.drawn).toBeGreaterThan(a.drawn);
    expect(b.drawn - b.tracked).toBeLessThan(15);
  });
  it('a standing face is not moved by the lead', () => {
    const p = new Placement(H);
    const it = earrings();
    p.update(track(), it, 0, defaultFit(), 0);
    let fr = p.update(track(), it, 33, defaultFit(), 0);
    const x0 = settle(new Placement(H), track(), it).pieces[1].x;
    for (let i = 0; i < 60; i++) fr = p.update(track(), it, i * 33, defaultFit(), 50);
    expect(fr.pieces[1].x).toBeCloseTo(x0, 0);
  });
});

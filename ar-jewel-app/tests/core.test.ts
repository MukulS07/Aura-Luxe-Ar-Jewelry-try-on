import { describe, expect, it } from 'vitest';
import { Machine } from '../src/privacy/machine';
import { nearestX, pickClosest } from '../src/tracking/pick';
import { OneEuro } from '../src/tracking/smooth';
import { solve, toView, type LM } from '../src/tracking/solve';

describe('state machine', () => {
  it('follows the booth flow', () => {
    const m = new Machine();
    for (const s of ['notice', 'pick', 'live', 'photo', 'qr', 'start'] as const) m.go(s);
    expect(m.state).toBe('start');
  });
  it('blocks illegal jumps (camera never starts without notice)', () => {
    const m = new Machine();
    expect(() => m.go('live')).toThrow();
    expect(() => m.go('pick')).toThrow();
  });
  it('idle reset works from anywhere', () => {
    const m = new Machine();
    m.go('notice');
    m.go('pick');
    m.go('live');
    m.reset();
    expect(m.state).toBe('start');
  });
});

describe('closest person', () => {
  it('picks widest face', () => expect(pickClosest([80, 200, 120])).toBe(1));
  it('empty -> -1', () => expect(pickClosest([])).toBe(-1));
  it('matches pose by x', () => expect(nearestX([100, 540, 900], 500)).toBe(1));
});

describe('smoothing', () => {
  it('damps jitter, follows a move', () => {
    const f = new OneEuro(1, 0.01);
    let v = 0;
    for (let i = 0; i < 30; i++) v = f.step(100 + (i % 2 ? 1 : -1), i * 33);
    expect(Math.abs(v - 100)).toBeLessThan(1);
    for (let i = 30; i < 90; i++) v = f.step(300, i * 33);
    expect(v).toBeGreaterThan(280);
  });
});

describe('solve', () => {
  const view = { W: 1000, H: 1000, vw: 1000, vh: 1000 };
  const face = (cx: number, w: number, noseDx = 0) => {
    const f: LM[] = Array.from({ length: 478 }, () => ({ x: cx, y: 0.4 }));
    f[234] = { x: cx - w / 2, y: 0.4 };
    f[454] = { x: cx + w / 2, y: 0.4 };
    f[1] = { x: cx + noseDx, y: 0.42 };
    f[152] = { x: cx, y: 0.6 };
    f[10] = { x: cx, y: 0.2 };
    return f;
  };
  it('mirrors x', () => expect(toView({ x: 0.1, y: 0.5 }, view).x).toBeCloseTo(900));
  it('no face -> null', () => expect(solve([], [], view)).toBeNull());
  it('picks the closest of two faces', () => {
    const r = solve([face(0.3, 0.1), face(0.7, 0.3)], [], view)!;
    expect(r.faceCount).toBe(2);
    expect(r.faceW).toBeCloseTo(300);
  });
  it('yaw sign follows nose offset', () => {
    expect(solve([face(0.5, 0.3, 0)], [], view)!.yaw).toBeCloseTo(0);
    expect(Math.abs(solve([face(0.5, 0.3, 0.1)], [], view)!.yaw)).toBeGreaterThan(0.5);
  });
});

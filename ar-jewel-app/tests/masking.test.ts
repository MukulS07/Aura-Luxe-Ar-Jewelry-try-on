import { describe, expect, it } from 'vitest';
import { farSide, occludes, type Zone } from '../src/render/masking';

const HAIR = 1,
  FACE = 3,
  CLOTHES = 4;
const ears = (far: -1 | 0 | 1): Zone => ({
  kind: 'earrings',
  lobes: [
    { x: 300, y: 500 },
    { x: 700, y: 500 },
  ],
  far,
  faceCx: 500,
  ppm: 2,
});

describe('which pixels sit in front of the jewelry', () => {
  it('the face and chin always cover a necklace; clothes and hair do not', () => {
    const z: Zone = { kind: 'necklace' };
    expect(occludes(FACE, 500, 600, z)).toBe(true);
    expect(occludes(CLOTHES, 500, 700, z)).toBe(false);
    expect(occludes(HAIR, 500, 700, z)).toBe(false);
  });
  it('the far side of a turned face covers the far earring, the near side does not', () => {
    expect(occludes(FACE, 350, 520, ears(-1))).toBe(true); // far = screen-left, pixel on the left of the face
    expect(occludes(FACE, 650, 520, ears(-1))).toBe(false); // near ear is never cut by the face
    expect(occludes(FACE, 650, 520, ears(1))).toBe(true);
  });
  it('a frontal face cuts neither earring', () => {
    expect(occludes(FACE, 350, 520, ears(0))).toBe(false);
    expect(occludes(FACE, 650, 520, ears(0))).toBe(false);
  });
  it('hair covers an earring only close to its lobe', () => {
    const z = ears(0);
    expect(occludes(HAIR, 302, 485, z)).toBe(true); // just above the left lobe
    expect(occludes(HAIR, 300, 900, z)).toBe(false); // hair far below, behind the dangling part
    expect(occludes(HAIR, 500, 500, z)).toBe(false); // hair in the middle of the head
  });
  it('clothes never cover an earring', () => expect(occludes(CLOTHES, 300, 500, ears(0))).toBe(false));
  it('far side follows the head turn, with a dead zone for a frontal face', () => {
    expect(farSide(-0.3)).toBe(-1);
    expect(farSide(0.3)).toBe(1);
    expect(farSide(0.05)).toBe(0);
  });
});

import { expect, test, type Page } from '@playwright/test';
import type { Tracking } from '../src/types';

interface Result {
  error?: string;
  tr: Tracking;
  size: number[];
}

// Runs the real Tracker (MediaPipe, WASM) on the still photo public/hero.jpg.
test.setTimeout(120_000);
const run = async (page: Page, qs = '') => {
  await page.goto('/tracking-check.html' + qs);
  return page.evaluate(() => (window as unknown as { checkResult: Promise<Result> }).checkResult);
};

test('measures neck, ears, hand and hair on a real photo', async ({ page }) => {
  const r = await run(page);
  expect(r.error).toBeUndefined();
  console.log(JSON.stringify(r.tr, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)));
  const tr = r.tr;
  expect(tr).toBeTruthy();
  expect(tr.poseSource).toBe('matrix');
  expect(tr.hasPose).toBe(true);
  expect(tr.neckline.widthMm).toBeGreaterThan(95);
  expect(tr.neckline.widthMm).toBeLessThan(150);
  expect(tr.ears.lobeL.x).toBeLessThan(tr.ears.lobeR.x);
  // Regression value read off the photo by eye: the visible (screen-right) ear's lobe is at about (582, 440) px.
  expect(Math.hypot(tr.ears.lobeR.x - 582, tr.ears.lobeR.y - 440)).toBeLessThan(30);
  // The photo shows the back of a hand on the shoulder, so the palm must not face the camera.
  expect(tr.hands).toHaveLength(1);
  expect(tr.hands[0].palmFacing).toBe(false);
  expect(tr.hands[0].pxPerMm).toBeGreaterThan(0.5);
  expect(tr.ears.hiddenL || tr.ears.hiddenR).toBe(false); // lobes are clear of hair here
});

test('mirrored photo keeps the same hand result', async ({ page }) => {
  const b = (await run(page, '?flip')).tr;
  expect(b.hands).toHaveLength(1);
  expect(b.hands[0].palmFacing).toBe(false);
});

test('mirroring the photo flips the head yaw', async ({ page }) => {
  const a = (await run(page)).tr,
    b = (await run(page, '?flip')).tr;
  console.log('yaw', a.yaw, 'flipped', b.yaw, 'heuristic-free');
  expect(Math.sign(a.yaw) * Math.sign(b.yaw)).toBeLessThanOrEqual(0);
});

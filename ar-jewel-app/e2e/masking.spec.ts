import { expect, test } from '@playwright/test';
import sharp from 'sharp';

// Foreground layer on the real photo (public/hero.jpg): the face repaints over the necklace where the jaw overlaps it.
// Screenshots: test-results/mask-*.png
test.use({ baseURL: 'http://localhost:5173' });
test.setTimeout(120_000);

type Result = { error?: string; fgCovered: number };
const run = async (page: import('@playwright/test').Page, qs: string) => {
  await page.goto(`/tracking-check.html?${qs}`);
  return page.evaluate(() => (window as unknown as { checkResult: Promise<Result> }).checkResult);
};

test('face and hair are repainted in front of the jewelry', async ({ page }) => {
  // choker pushed up so it rides over the jaw: the face must be repainted over it, so the picture changes
  const up = await run(page, 'draw=neck-001&y=-90');
  expect(up.error).toBeUndefined();
  expect(up.fgCovered).toBeGreaterThan(200);
  const withMask = await page.locator('#wrap').screenshot({ path: 'test-results/mask-necklace-with.png' });
  await run(page, 'draw=neck-001&y=-90&nofg=1');
  const without = await page.locator('#wrap').screenshot({ path: 'test-results/mask-necklace-without.png' });
  const raw = async (png: Buffer) => (await sharp(png).raw().toBuffer()) as Buffer;
  const [a, b] = [await raw(withMask), await raw(without)];
  let changed = 0;
  for (let i = 0; i < a.length; i += 4)
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) changed++;
  console.log('MASK pixels changed by the foreground layer:', changed);
  expect(changed).toBeGreaterThan(300);

  // earrings: the far side of the turned head covers the far earring
  const ear = await run(page, 'draw=ear-001');
  expect(ear.error).toBeUndefined();
  await page.locator('#wrap').screenshot({ path: 'test-results/mask-earrings.png' });
});

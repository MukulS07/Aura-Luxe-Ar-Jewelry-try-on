import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

// Fake webcam that shows a real face: public/hero.jpg letterboxed to 1280x720, as a motion-JPEG stream.
const dir = resolve('e2e/.fixtures'); // outside test-results: Playwright empties that folder on every run
mkdirSync(dir, { recursive: true });
const face = resolve(dir, 'face.y4m');
const W = 1280,
  H = 720;
const rgb = await sharp('public/hero.jpg').resize(W, H, { fit: 'contain', background: '#0b0908' }).removeAlpha().raw().toBuffer();
// RGB -> I420 (BT.601), the format Chrome's fake capture reads from a .y4m file
const yuv = Buffer.alloc(W * H * 1.5);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3,
      r = rgb[i],
      g = rgb[i + 1],
      b = rgb[i + 2];
    yuv[y * W + x] = 0.299 * r + 0.587 * g + 0.114 * b;
    if (y % 2 === 0 && x % 2 === 0) {
      const o = (y / 2) * (W / 2) + x / 2;
      yuv[W * H + o] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      yuv[W * H + (W * H) / 4 + o] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    }
  }
const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg${String.fromCharCode(10)}`);
const fr = Buffer.concat([Buffer.from(`FRAME${String.fromCharCode(10)}`), yuv]);
writeFileSync(face, Buffer.concat([head, ...Array.from({ length: 8 }, () => fr)]));

test.use({
  baseURL: 'http://localhost:5173',
  viewport: { width: 1920, height: 1080 },
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${face}`],
  },
});
test.setTimeout(180_000);

test('new-design booth: notice, camera, tracking and jewelry', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/booth-v2.html?debug');
  const camOn = () => page.evaluate(() => !!(document.querySelector('#live video') as HTMLVideoElement | null)?.srcObject);

  // Notice first, then the scan screen (camera on, jewelry not yet), then the pick
  await page.evaluate(() => (document.querySelector('[data-go="notice"]') as HTMLElement).click());
  await page.locator('#notice [data-go="scan"]').click(); // Accept
  await expect(page.locator('#scan.on')).toBeVisible();
  await expect(page.locator('#scanContinue')).toBeDisabled(); // not measured yet
  await expect
    .poll(() => page.evaluate(() => !!(document.querySelector('#scan video') as HTMLVideoElement | null)?.srcObject), { timeout: 30_000 })
    .toBe(true);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/v2-scan-measuring.png' });
  await expect(page.locator('#scanContinue')).toBeEnabled({ timeout: 120_000 }); // measured
  await expect(page.locator('#scan .mlist li.ok')).toHaveCount(3);
  for (const id of ['#vFace', '#vEars', '#vNeck']) expect(await page.locator(id).textContent()).toMatch(/\d+ mm/);
  await page.screenshot({ path: 'test-results/v2-scan-done.png' });
  await page.locator('#scanContinue').click();
  await expect(page.locator('#pick.on')).toBeVisible();
  expect(await page.evaluate(() => !!(document.querySelector('#scan video') as HTMLVideoElement).srcObject)).toBe(false); // scan camera is off again
  await page.locator('[data-pick="ear-001"]').click();
  await expect(page.locator('#live.on')).toBeVisible();
  await expect.poll(camOn, { timeout: 30_000 }).toBe(true);
  // Already measured: no second measuring, the shutter is open and the jewelry appears
  await expect(page.locator('#shutter')).toBeEnabled({ timeout: 30_000 });
  await page.waitForTimeout(5000); // piece fades in
  await page.screenshot({ path: 'test-results/v2-live-earrings.png' });
  // Every drawn frame belongs to a visitor who had been measured
  const phases = await page.evaluate(() => ((globalThis as { __samples?: { phase: string }[] }).__samples ?? []).map((p) => p.phase));
  expect(phases.length).toBeGreaterThan(0);
  expect(phases.every((p) => p === 'ready')).toBe(true);

  await page.locator('[data-cat2="necklace"]').click(); // switch piece, camera must stay on
  await page.waitForTimeout(3000);
  expect(await camOn()).toBe(true);
  await page.screenshot({ path: 'test-results/v2-live-necklace.png' });

  await page.locator('#shutter').click();
  await expect(page.locator('#photoS.on')).toBeVisible({ timeout: 15_000 });
  expect(await camOn()).toBe(false); // camera off on the photo screen
  await page.screenshot({ path: 'test-results/v2-photo.png' });
  expect(errors).toEqual([]);
});

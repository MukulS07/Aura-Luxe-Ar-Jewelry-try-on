import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

// Phone check: 390x844 touch device, portrait camera showing a real face. Screenshots: test-results/m-*.png
const W = 720,
  H = 1280;
const dir = resolve('e2e/.fixtures');
mkdirSync(dir, { recursive: true });
const face = resolve(dir, 'face-portrait.y4m');
{
  const rgb = await sharp('public/hero.jpg').resize(W, H, { fit: 'cover', position: 'top' }).removeAlpha().raw().toBuffer();
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
  const nl = String.fromCharCode(10);
  const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg${nl}`);
  const fr = Buffer.concat([Buffer.from(`FRAME${nl}`), yuv]);
  writeFileSync(face, Buffer.concat([head, ...Array.from({ length: 6 }, () => fr)]));
}

test.use({
  baseURL: 'http://localhost:5173',
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${face}`],
  },
});
test.setTimeout(240_000);

test('phone: whole flow fits the screen and works by touch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/booth-v2.html?debug');

  const fits = async (label: string) => {
    const o = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      iw: innerWidth,
      // anything wider than the screen inside the visible screen
      wide: [...document.querySelectorAll('.screen.on *')]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.width > 0 &&
            (r.right > innerWidth + 1 || r.left < -1) &&
            getComputedStyle(e).position !== 'fixed' &&
            !e.closest('.strip,.curtain,.s-bg,.s-glint,.march')
          );
        })
        .map((e) => `${e.tagName}.${(e as HTMLElement).className}`)
        .slice(0, 5),
    }));
    expect(o.sw, `${label}: page scrolls sideways`).toBeLessThanOrEqual(o.iw);
    expect(o.wide, `${label}: elements past the screen edge`).toEqual([]);
  };
  const tappable = async (sel: string, label: string) => {
    const box = await page.locator(sel).first().boundingBox();
    expect(box, label).not.toBeNull();
    expect(Math.min(box!.width, box!.height), `${label} touch size`).toBeGreaterThanOrEqual(44);
  };

  await page.waitForTimeout(4500); // opening finishes
  await page.screenshot({ path: 'test-results/m-1-start.png' });
  await fits('start');
  await tappable('.s-cta', 'begin button');

  await page.locator('.s-cta').tap();
  await expect(page.locator('#notice.on')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/m-2-notice.png' });
  await fits('notice');
  await tappable('#notice [data-go="scan"]', 'accept');
  await tappable('#notice [data-go="start"]', 'decline');

  await page.locator('#notice [data-go="scan"]').tap();
  await expect(page.locator('#scan.on')).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/m-2b-scan.png' });
  await fits('scan measuring');
  await expect(page.locator('#scanContinue')).toBeEnabled({ timeout: 120_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/m-2c-scan-done.png' });
  await fits('scan done');
  await tappable('#scanContinue', 'continue');
  await page.locator('#scanContinue').tap();
  await expect(page.locator('#pick.on')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/m-3-pick.png' });
  await fits('pick');
  await tappable('[data-pick="ear-001"]', 'piece card');

  await page.locator('[data-pick="ear-001"]').tap();
  await expect(page.locator('#live.on')).toBeVisible();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/m-4-live-start.png' });
  await fits('live start');
  await expect(page.locator('#shutter')).toBeEnabled({ timeout: 90_000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-results/m-5-live.png' });
  await fits('live');
  await tappable('#shutter', 'shutter');
  await tappable('.tab', 'category tab');
  await tappable('.thumb', 'piece thumbnail');
  expect(await page.evaluate(() => ((globalThis as { __samples?: unknown[] }).__samples ?? []).length)).toBeGreaterThan(0);

  await page.locator('#shutter').tap();
  await expect(page.locator('#photoS.on')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/m-6-photo.png' });
  await fits('photo');
  await expect(page.locator('#photoS [data-go="qrS"]')).toHaveText('Save photo');

  await page.locator('#photoS [data-go="qrS"]').tap();
  await expect(page.locator('#qrS.on')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/m-7-done.png' });
  await fits('done');
  await expect(page.locator('#dl')).toBeVisible();
  expect(await page.locator('#dl').getAttribute('href')).toMatch(/^blob:/); // photo stays on the phone
  expect(errors).toEqual([]);
});

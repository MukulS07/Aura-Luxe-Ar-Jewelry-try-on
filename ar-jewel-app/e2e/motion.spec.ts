import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

/**
 * Motion check with known ground truth. The webcam shows public/hero.jpg sliding left and right as a sine wave
 * (period 2 s, amplitude 100 px of a 640 px frame). We compare what the tracker measures and what is drawn
 * against that known motion: gain, jitter and lag.
 */
const W = 640,
  H = 360,
  FPS = 30,
  PERIOD_S = 2,
  AMP_PX = 100,
  FRAMES = FPS * PERIOD_S * 2; // two periods, the file loops
const dir = resolve('e2e/.fixtures');
mkdirSync(dir, { recursive: true });
const y4m = resolve(dir, 'motion.y4m');
{
  const hero = await sharp('public/hero.jpg')
    .resize({ height: H - 20 })
    .toBuffer();
  const heroW = (await sharp(hero).metadata()).width!;
  const nl = String.fromCharCode(10);
  const parts: Buffer[] = [Buffer.from(`YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg${nl}`)];
  for (let f = 0; f < FRAMES; f++) {
    const dx = AMP_PX * Math.sin((2 * Math.PI * f) / (FPS * PERIOD_S));
    const rgb = await sharp({ create: { width: W, height: H, channels: 3, background: '#0b0908' } })
      .composite([{ input: hero, left: Math.round((W - heroW) / 2 + dx), top: 10 }])
      .removeAlpha()
      .raw()
      .toBuffer();
    const yuv = Buffer.alloc(W * H * 1.5);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        const r = rgb[i],
          g = rgb[i + 1],
          b = rgb[i + 2];
        yuv[y * W + x] = 0.299 * r + 0.587 * g + 0.114 * b;
        if (y % 2 === 0 && x % 2 === 0) {
          const o = (y / 2) * (W / 2) + x / 2;
          yuv[W * H + o] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          yuv[W * H + (W * H) / 4 + o] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        }
      }
    parts.push(Buffer.from(`FRAME${nl}`), yuv);
  }
  writeFileSync(y4m, Buffer.concat(parts));
}

test.use({
  baseURL: 'http://localhost:5173',
  viewport: { width: 1920, height: 1080 },
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`],
  },
});
test.setTimeout(240_000);

/** Least-squares fit of c + a*sin(wt) + b*cos(wt). Returns amplitude, phase and residual rms. */
function fit(t: number[], v: number[], w: number) {
  const n = t.length;
  const A = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const B = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const row = [1, Math.sin(w * t[i]), Math.cos(w * t[i])];
    for (let r = 0; r < 3; r++) {
      B[r] += row[r] * v[i];
      for (let c = 0; c < 3; c++) A[r][c] += row[r] * row[c];
    }
  }
  // solve 3x3 by Cramer's rule
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  const sol = [0, 1, 2].map((k) => det(A.map((row, r) => row.map((x, c) => (c === k ? B[r] : x)))) / D);
  const [c, a, b] = sol;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (v[i] - (c + a * Math.sin(w * t[i]) + b * Math.cos(w * t[i]))) ** 2;
  return { amp: Math.hypot(a, b), phase: Math.atan2(b, a), rms: Math.sqrt(ss / n) };
}

test('tracking follows a moving face: gain, jitter and lag', async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('/booth-v2.html?debug');
  await page.evaluate(() => (document.querySelector('[data-go="notice"]') as HTMLElement).click());
  await page.locator('#notice [data-go="scan"]').click();
  await expect(page.locator('#scanContinue')).toBeEnabled({ timeout: 120_000 }); // measured on the scan screen
  await page.locator('#scanContinue').click();
  await page.locator('[data-pick="ear-001"]').click();
  await expect(page.locator('#shutter')).toBeEnabled({ timeout: 120_000 }); // measuring done, jewelry is being drawn
  await page.waitForTimeout(3000);
  await page.evaluate(() => ((globalThis as { __samples?: unknown[] }).__samples!.length = 0));
  await page.waitForTimeout(8_000);
  const s = await page.evaluate(() => (globalThis as { __samples?: { t: number; rawX: number; outX: number }[] }).__samples!);
  expect(s.length).toBeGreaterThan(30);

  writeFileSync(resolve(dir, 'motion-samples.json'), JSON.stringify(s));
  const t = s.map((p) => (p.t - s[0].t) / 1000);
  // The fake camera is not exactly real time under load, so search the motion frequency (+-15%) for the best fit.
  let w = (2 * Math.PI) / PERIOD_S;
  let best = Infinity;
  for (let k = -15; k <= 15; k++) {
    const wk = ((2 * Math.PI) / PERIOD_S) * (1 + k / 100);
    const r = fit(
      t,
      s.map((p) => p.rawX),
      wk,
    ).rms;
    if (r < best) {
      best = r;
      w = wk;
    }
  }
  const raw = fit(
    t,
    s.map((p) => p.rawX),
    w,
  );
  const out = fit(
    t,
    s.map((p) => p.outX),
    w,
  );
  const expected = AMP_PX * (1920 / W); // display px per camera px = 3 (video is cover-fitted to 16:9)
  const lagMs = ((((raw.phase - out.phase + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) / w) * 1000;
  const fps = (s.length - 1) / t[t.length - 1];
  console.log(
    JSON.stringify({
      samples: s.length,
      fps: +fps.toFixed(1),
      expectedAmpPx: expected,
      trackedAmpPx: +raw.amp.toFixed(1),
      drawnAmpPx: +out.amp.toFixed(1),
      gainTracked: +(raw.amp / expected).toFixed(2),
      jitterTrackedRms: +raw.rms.toFixed(1),
      jitterDrawnRms: +out.rms.toFixed(1),
      periodS: +((2 * Math.PI) / w).toFixed(2),
      drawnVsTrackedMs: +lagMs.toFixed(0), // negative = drawn ahead of the raw tracked position (latency compensation)
    }),
  );
  expect(raw.amp / expected).toBeGreaterThan(0.8);
  expect(raw.amp / expected).toBeLessThan(1.2);
  // Drawn motion must keep the size of the tracked motion (no overshoot from the latency compensation).
  expect(out.amp / raw.amp).toBeGreaterThan(0.85);
  expect(out.amp / raw.amp).toBeLessThan(1.15);
});

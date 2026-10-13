import { expect, test } from '@playwright/test';

// New-design prototype (redesign/booth.html, served on :5199): camera only on the live screen, frame captured in memory.
test.use({ baseURL: 'http://localhost:5199', viewport: { width: 1920, height: 1080 } });

test.beforeAll(async () => {
  // Needs the prototype server: npx http-server redesign -p 5199
  const up = await fetch('http://localhost:5199/booth.html')
    .then((r) => r.ok)
    .catch(() => false);
  test.skip(!up, 'prototype server on :5199 is not running');
});

test('camera starts on live, captures a frame, and stops when leaving', async ({ page }) => {
  await page.goto('/booth.html?clean');
  const state = () =>
    page.evaluate(() => ({
      stream: !!(document.getElementById('camVideo') as HTMLVideoElement).srcObject,
      on: document.getElementById('cam')!.classList.contains('on'),
    }));
  expect(await state()).toEqual({ stream: false, on: false }); // nothing before the live screen
  await page.evaluate(() => (window as unknown as { go: (s: string) => void }).go('notice'));
  expect((await state()).stream).toBe(false); // notice never turns the camera on
  await page.evaluate(() => (window as unknown as { go: (s: string) => void }).go('live'));
  await expect.poll(async () => (await state()).on, { timeout: 10_000 }).toBe(true);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: 'test-results/booth-live-camera.png' });

  await page.evaluate(() => (document.getElementById('shutter') as HTMLButtonElement).click());
  await expect(page.locator('#photoS.on')).toBeVisible({ timeout: 10_000 });
  const bg = await page.evaluate(() => (document.querySelector('.frame .img') as HTMLElement).style.backgroundImage);
  expect(bg).toContain('data:image/jpeg'); // captured frame, held in memory only
  expect((await state()).stream).toBe(false); // camera is off on the photo screen
  await page.screenshot({ path: 'test-results/booth-photo.png' });

  await page.evaluate(() => (window as unknown as { go: (s: string) => void }).go('start'));
  expect(await page.evaluate(() => (document.querySelector('.frame .img') as HTMLElement).style.backgroundImage)).toBe('');
});

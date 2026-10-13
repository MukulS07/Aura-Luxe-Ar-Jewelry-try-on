import { test } from '@playwright/test';

// Visual check: each piece rendered through Placement + Scene3D on the mirrored photo. Look at test-results/align-*.png.
test.setTimeout(120_000);
const shots: [string, string][] = [
  ['ear-001', 'jhumka'],
  ['ear-003', 'drop'],
  ['ear-004', 'hoop'],
  ['neck-001', 'choker'],
  ['neck-003', 'haar'],
  ['neck-002', 'pendant'],
];
for (const [id, name] of shots) {
  test(`render ${name}`, async ({ page }) => {
    await page.goto(`/tracking-check.html?draw=${id}`);
    await page.evaluate(() => (window as unknown as { checkResult: Promise<unknown> }).checkResult);
    await page.locator('#wrap').screenshot({ path: `test-results/align-${name}.png` });
  });
}

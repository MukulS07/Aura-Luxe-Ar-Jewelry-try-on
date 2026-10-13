import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// The asset path end to end: optimise a heavy .glb with scripts/optimize-glb.mjs (meshopt), then load the result
// through the app's own loader in a real browser.
test.use({ baseURL: 'http://localhost:5173' });
test.setTimeout(120_000);

test('an optimised, meshopt-compressed glb loads in the app', async ({ page }) => {
  const dir = resolve('e2e/.fixtures');
  mkdirSync(dir, { recursive: true });
  const out = resolve(dir, 'amulet.opt.glb');
  execFileSync('node', ['scripts/optimize-glb.mjs', 'public/models/ruby-amulet.glb', out, '--simplify', '0.15']);
  await page.goto('/tracking-check.html?load=/e2e/.fixtures/amulet.opt.glb&type=necklace');
  const r = await page.evaluate(
    () => (window as unknown as { checkResult: Promise<{ loaded?: boolean; meshes?: number; tris?: number; error?: string }> }).checkResult,
  );
  expect(r.error).toBeUndefined();
  expect(r.loaded).toBe(true);
  expect(r.meshes).toBeGreaterThan(0);
  expect(r.tris).toBeGreaterThan(1000);
});

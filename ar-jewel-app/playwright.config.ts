import { defineConfig } from '@playwright/test';

// Uses the installed Chrome (no browser download) with a fake camera for the visitor flow.
export default defineConfig({
  testDir: 'e2e',
  retries: 1, // the timing tests are CPU-bound and can miss on a busy machine
  workers: 1, // tracking tests are CPU-bound; running them side by side skews the timing checks
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
});

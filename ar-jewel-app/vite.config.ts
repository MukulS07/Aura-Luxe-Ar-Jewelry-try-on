import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const API = 'http://localhost:8787';
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] }, // e2e/ belongs to Playwright
  server: {
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev', '.ngrok.io'], // dev tunnel only
    proxy: { '/api': API, '/uploads': API },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        share: resolve(__dirname, 'share.html'),
        admin: resolve(__dirname, 'admin.html'),
        terms: resolve(__dirname, 'terms.html'),
        booth2: resolve(__dirname, 'booth-v2.html'),
      },
    },
  },
});

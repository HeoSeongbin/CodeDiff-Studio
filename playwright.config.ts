import { defineConfig } from '@playwright/test';
const port = process.env.CODEDIFF_TEST_PORT || '5188';
const production = process.env.CODEDIFF_TEST_PREVIEW === '1';
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/performance.spec.ts', '**/deployment.spec.ts'],
  use: {
    channel: process.env.CI ? undefined : 'msedge',
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: production
      ? `npm exec vite -- preview --host 127.0.0.1 --port ${port} --strictPort`
      : `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !production && !process.env.CI,
  },
  reporter: 'list',
});

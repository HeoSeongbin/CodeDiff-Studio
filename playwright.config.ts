import { defineConfig } from '@playwright/test';
const port = process.env.CODEDIFF_TEST_PORT || '5188';
export default defineConfig({
  testDir: './e2e',
  use: {
    channel: 'msedge',
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
  reporter: 'list',
});

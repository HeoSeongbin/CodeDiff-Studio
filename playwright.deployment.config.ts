import { defineConfig } from '@playwright/test';

const port = process.env.CODEDIFF_TEST_PORT || '5220';
const base = process.env.VITE_BASE_PATH || '/CodeDiff-Studio/';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'deployment.spec.ts',
  use: {
    channel: process.env.CI ? undefined : 'msedge',
    baseURL: `http://127.0.0.1:${port}${base}`,
  },
  webServer: {
    command: `npm exec vite -- preview --host 127.0.0.1 --port ${port} --strictPort --base ${base}`,
    url: `http://127.0.0.1:${port}${base}`,
    reuseExistingServer: false,
  },
});

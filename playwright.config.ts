import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  webServer: {
    command: 'node scripts/serve.mjs',
    url: 'http://localhost:4174/demo/',
    reuseExistingServer: !process.env.CI,
  },
});

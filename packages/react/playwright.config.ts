import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    // Set explicitly: Playwright only infers it when there is one web server.
    baseURL: 'http://localhost:4173',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      // The fixture page (e2e/fixture), built by `test:e2e`.
      command: 'pnpm exec vite preview -c e2e/vite.config.ts',
      port: 4173,
      reuseExistingServer: true,
      timeout: 10_000,
    },
    {
      // The sandbox from this checkout, not the deployed one: `test:e2e` builds
      // both, and builds the fixture with VITE_SANDBOX_ORIGIN pointing here.
      command: 'pnpm --filter @simten/sandbox-app exec vite preview --port 4174 --strictPort',
      port: 4174,
      reuseExistingServer: true,
      timeout: 20_000,
    },
  ],
});

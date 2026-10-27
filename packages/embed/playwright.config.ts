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
      // No `--single`: that is an SPA flag telling `serve` to rewrite unmatched
      // routes to /index.html, and this fixture directory has no index.html. It
      // turned the clean-URL redirect (/test-page.html -> /test-page) into a 404,
      // so every test loaded an error page and all six failed.
      command: 'npx serve dist -l 4173 --no-clipboard',
      port: 4173,
      reuseExistingServer: true,
      timeout: 10_000,
    },
    {
      // The sandbox from this checkout, not the deployed one: `test:e2e` builds
      // both, and builds the embed with VITE_SANDBOX_ORIGIN pointing here.
      command: 'pnpm --filter @simten/sandbox exec vite preview --port 4174 --strictPort',
      port: 4174,
      reuseExistingServer: true,
      timeout: 20_000,
    },
  ],
});

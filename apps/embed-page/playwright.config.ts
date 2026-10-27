import { defineConfig } from '@playwright/test';
import { EMBED_PORT, HOST_PORT, SANDBOX_PORT, STATE_DIR } from './e2e/setup';

// Run with `pnpm test:e2e`, which builds and seeds first (e2e/build.mts).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  use: { headless: true, viewport: { width: 1280, height: 800 } },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      // The production build with its _headers, on the Workers runtime.
      command: `pnpm exec wrangler dev -c dist/simten_embed/wrangler.json --port ${EMBED_PORT} --persist-to ${STATE_DIR} --show-interactive-dev-session=false`,
      port: EMBED_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm --filter @simten/sandbox exec vite preview --port ${SANDBOX_PORT} --strictPort`,
      port: SANDBOX_PORT,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'pnpm exec tsx e2e/servers.mts',
      port: HOST_PORT,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});

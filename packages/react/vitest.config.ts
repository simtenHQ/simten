import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // e2e/ is Playwright, run by `test:e2e`.
    exclude: ['e2e/**', 'node_modules/**'],
  },
});

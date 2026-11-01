import { defineConfig } from 'vitest/config';

export default defineConfig({
  // `@/` imports, for tests that render components.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

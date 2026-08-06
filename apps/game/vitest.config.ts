import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Node environment: the grader's rules are pure, and the tests drive them
// through a host-side runtime rather than the sandbox iframe. See
// src/game/__tests__/local-runtime.ts.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});

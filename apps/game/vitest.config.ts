import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Node environment: the tests grade through `inProcessSandbox()`, the real
// session host without the iframe. A test that renders opts into jsdom itself.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});

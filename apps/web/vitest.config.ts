import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
    setupFiles: ['./vitest.setup.ts'],
    css: false,
  },
  css: {
    postcss: {},
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});

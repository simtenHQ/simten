import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['@simten/source', 'import', 'node', 'default'],
  },
  test: {
    globals: true,
    environment: 'node',
  },
});

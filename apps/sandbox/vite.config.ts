import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['@simten/source', 'import', 'module', 'browser', 'default'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
});

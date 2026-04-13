import { defineConfig } from 'vite';

const CSP = "connect-src 'self' https://esm.sh;";

export default defineConfig({
  server: {
    headers: { 'Content-Security-Policy': CSP },
  },
  preview: {
    headers: { 'Content-Security-Policy': CSP },
  },
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

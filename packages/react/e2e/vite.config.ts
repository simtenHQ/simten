import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The page the Playwright suite drives: a few `<CircuitEmbed>`s and a
 * `SimulationView`, built against the sandbox in VITE_SANDBOX_ORIGIN (the
 * `test:e2e` script points it at this checkout's sandbox on :4174).
 */
export default defineConfig({
  root: new URL('./fixture', import.meta.url).pathname,
  plugins: [tailwindcss(), react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: new URL('./dist', import.meta.url).pathname,
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});

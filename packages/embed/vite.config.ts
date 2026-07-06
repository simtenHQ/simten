import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

const isAnalyze = process.env.ANALYZE === 'true';

/**
 * Vite config for building the web component bundle.
 *
 * Produces:
 *   dist/circuit-embed.js  — IIFE registering <circuit-embed>
 *   dist/styles.css         — all CSS (Tailwind ti-prefixed + ReactFlow)
 *
 * CSS is handled entirely by Vite + Tailwind plugin — no manual merging.
 */
export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    tailwindcss(),
    react(),
    ...(isAnalyze
      ? [
          visualizer({
            filename: 'dist/bundle-stats.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': JSON.stringify({}),
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/webcomponent/index.ts'),
      formats: ['iife'],
      name: 'SimtenEmbed',
      fileName: () => 'circuit-embed.js',
    },
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'esbuild',
    sourcemap: false,
    cssCodeSplit: false,
    cssMinify: true,
    rollupOptions: {
      output: {
        assetFileNames: 'styles[extname]',
      },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { resolve } from "path";

const isAnalyze = process.env.ANALYZE === "true";

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
    conditions: ["@turing-incomplete/source", "import", "module", "browser", "default"],
    dedupe: ["react", "react-dom"],
  },
  plugins: [
    tailwindcss(),
    react(),
    ...(isAnalyze
      ? [
          visualizer({
            filename: "dist/bundle-stats.html",
            open: true,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env": JSON.stringify({}),
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/webcomponent/index.ts"),
      formats: ["iife"],
      name: "TuringIncompleteEmbed",
      fileName: () => "circuit-embed.js",
    },
    outDir: "dist",
    emptyOutDir: true,
    minify: "esbuild",
    sourcemap: false,
    cssCodeSplit: false,
    cssMinify: true,
    rollupOptions: {
      output: {
        assetFileNames: "styles[extname]",
      },
    },
  },
});

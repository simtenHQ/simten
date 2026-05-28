import { defineConfig } from 'vite';

// Sandbox CSP — kept in sync with apps/sandbox/public/_headers (prod).
//
// default-src 'none' closes the script-src hole: prior to this, only connect-src
// was set, which left `import()`, inline scripts, and loaded styles ungoverned.
// Each allowlisted directive below is the minimum needed for the sandbox to
// actually function:
//
//   script-src 'self'             — the main.ts bundle, served same-origin.
//   script-src 'unsafe-eval'      — executeCircuitCode + iframe-main eval
//                                   reconstruction use new Function().
//   script-src blob:              — worker.ts dynamically imports a blob-URL
//                                   loader module to resolve npm packages.
//   script-src https://esm.sh     — that loader's static imports resolve to
//                                   esm.sh URLs; dynamic import() of esm.sh
//                                   is governed by script-src, not connect-src.
//   connect-src 'self' esm.sh     — fetch/XHR/WebSocket allowlist (esm.sh metadata,
//                                   same-origin postMessage doesn't count here).
//   worker-src 'self'             — Web Worker constructed from a same-origin URL.
//   base-uri / form-action /
//   object-src 'none'             — cheap defense-in-depth; sandbox uses none of these.
//
// No frame-ancestors directive: the sandbox is iframed by simten.dev AND by
// third-party @simten/embed consumers. Default ('*') is intentional.
//
// Dev caveat: this tightens dev to match prod. If Vite's HMR error overlay
// breaks (it uses inline styles which `default-src 'none'` blocks), comment
// out the headers blocks below temporarily — errors still appear in the console.
const CSP = "default-src 'none'; script-src 'self' 'unsafe-eval' blob: https://esm.sh; connect-src 'self' https://esm.sh; worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none';";

export default defineConfig({
  server: {
    headers: { 'Content-Security-Policy': CSP },
  },
  preview: {
    headers: { 'Content-Security-Policy': CSP },
  },
  resolve: {
    dedupe: ['@simten/core'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
});

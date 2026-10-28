import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Sandbox CSP. Production headers are in public/_headers; the dev and preview
// servers send that file's `/*` block too, so the policy is written once.
//
// default-src 'none' closes the script-src hole: prior to this, only connect-src
// was set, which left `import()`, inline scripts, and loaded styles ungoverned.
// Each allowlisted directive below is the minimum needed for the sandbox to
// actually function:
//
//   script-src 'self'             — the main.ts bundle, served same-origin.
//   script-src 'unsafe-eval'      — executeCircuitCode + the worker's eval
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
//   frame-ancestors http: https: — any web page may embed the sandbox: it
//                                   is iframed by simten.dev, play.simten.dev
//                                   and third-party @simten/embed pages.
//
// Dev caveat: this tightens dev to match prod. If Vite's HMR error overlay
// breaks (it uses inline styles which `default-src 'none'` blocks), comment
// out `server: { headers }` below temporarily — errors still appear in the console.
const headers = siteWideHeaders(
  readFileSync(new URL('./public/_headers', import.meta.url), 'utf8'),
);

/** The `Name: value` lines of the `/*` block in a Cloudflare `_headers` file. */
function siteWideHeaders(file: string): Record<string, string> {
  const headers: Record<string, string> = {};
  let inBlock = false;
  for (const line of file.split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      inBlock = line.trim() === '/*';
      continue;
    }
    const colon = line.indexOf(':');
    if (inBlock && colon > 0) headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  if (!headers['Content-Security-Policy']) {
    throw new Error('public/_headers has no Content-Security-Policy in its /* block');
  }
  return headers;
}

export default defineConfig({
  server: { headers },
  preview: { headers },
  resolve: {
    dedupe: ['@simten/core'],
  },
  // The worker is a module worker (`type: 'module'` in main.ts). Building it as
  // ES lets Vite split out what it loads with import(), such as the Verilog
  // exporter, which an iife worker would inline.
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
});

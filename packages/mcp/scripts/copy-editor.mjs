// Bundle the editor into the MCP so it can be served from localhost — same origin
// as the studio WS, which sidesteps Chrome's Local Network Access block (a public
// page can't reach ws://localhost). The pinned-in-package editor (not live CDN
// code) is also what keeps a simten.dev compromise out of the privileged page.
//
// Source is the standalone, client-only viewer build (apps/web/dist/viewer) — a
// plain Vite SPA that mounts the editor at the root path, NOT the full TanStack
// Start site build. Robust copy: take index.html (the genuine Vite shell) +
// assets/ + fonts/ + favicon, and DROP the SEO/PWA cruft that the shared
// publicDir drags in (blog-assets/, og-*.png, logo*.png, manifest.json,
// robots.txt, _headers, .well-known/). We copy ALL of assets/ rather than
// computing a per-route chunk closure, so every chunk the editor lazily needs is
// guaranteed present (no silent 404s); the E2E zero-404 assertion guards this.
//
// Because index.html is the genuine Vite output, its `import("/assets/main-<hash>.js")`
// is always self-consistent with the copied assets — no hand-authored shell, no
// stale-hash trap.
//
// Default warns-and-skips if the viewer build is absent (keeps a bare `tsc` build
// working in dev/CI); --require fails loudly (used at publish via prepack).
import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRE = process.argv.includes('--require');
const here = dirname(fileURLToPath(import.meta.url)); // packages/mcp/scripts
const SRC = join(here, '..', '..', '..', 'apps', 'web', 'dist', 'viewer');
const DEST = join(here, '..', 'dist', 'public');

if (!existsSync(join(SRC, 'index.html'))) {
  const msg = `[copy-editor] viewer build not found at ${SRC}\n  Build it first:  pnpm --filter ./apps/web build:viewer`;
  if (REQUIRE) { console.error(msg + '\n  (--require) refusing to continue without the bundled editor.'); process.exit(1); }
  console.warn(msg + '\n  Skipping bundle (the MCP will fall back to SIMTEN_URL at runtime).');
  process.exit(0);
}
if (!existsSync(join(here, '..', 'dist'))) {
  console.error('[copy-editor] dist/ missing — run tsc -b first.');
  process.exit(REQUIRE ? 1 : 0);
}

// Only what the viewer needs to boot and run. assets/ + fonts/ are the editor;
// index.html is the shell; favicon for the tab. Everything else the shared
// publicDir copies into the build (og-*.png, logo*.png, manifest.json,
// robots.txt, _headers, blog-assets/, .well-known/) is public-site cruft, not
// the editor — left out.
const INCLUDE = ['index.html', 'assets', 'fonts', 'favicon.svg'];

await rm(DEST, { recursive: true, force: true });
await mkdir(DEST, { recursive: true });
for (const entry of INCLUDE) {
  const from = join(SRC, entry);
  if (existsSync(from)) await cp(from, join(DEST, entry), { recursive: true });
}
console.log(`[copy-editor] bundled editor → ${DEST} (${INCLUDE.filter((e) => existsSync(join(SRC, e))).join(', ')})`);

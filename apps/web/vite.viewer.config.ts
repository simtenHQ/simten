import { defineConfig } from 'vite';
import { resolve } from 'node:path';

import tsconfigPaths from 'vite-tsconfig-paths';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Standalone, client-only build of the visual editor for the local MCP viewer.
//
// Deliberately omits the cloudflare / tanstackStart / fumadocs plugins of the
// main config: no SSR, no prerender, and therefore no CLOUDFLARE_API_TOKEN and
// no module-scope-nanoid prerender constraint. The output is a plain SPA that
// the MCP serves from localhost (see packages/mcp/scripts/copy-editor.mjs).
//
// Monaco is CDN-loaded by @monaco-editor/react, so no worker config is needed.
export default defineConfig({
  // `root: viewer` so index.html + main.tsx live there; publicDir/outDir are
  // pulled back up to apps/web so the build reuses the site's /fonts + favicon.
  root: resolve(__dirname, 'viewer'),
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    // The `viewer/` entry lives outside `src/`, so vite-tsconfig-paths (scoped
    // to the tsconfig include) won't map `@/` for it — alias it explicitly.
    // Order matters: the share/server stub is matched before the general `@`.
    alias: [
      // The editor dynamically imports the share server fn (cloudflare:workers
      // backed). The viewer never calls it (standalone → Share hidden), so swap
      // it for a stub to keep the server-fn graph out of the client bundle.
      {
        find: /^@\/features\/share\/server$/,
        replacement: resolve(__dirname, 'viewer/stubs/share-server.ts'),
      },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  plugins: [
    tsconfigPaths({ projects: [resolve(__dirname, 'tsconfig.json')] }),
    tailwindcss(),
    viteReact(),
  ],
  build: {
    outDir: resolve(__dirname, 'dist/viewer'),
    emptyOutDir: true,
  },
});

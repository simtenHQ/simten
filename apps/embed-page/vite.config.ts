import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { headersFile } from './src/headers.ts';

/** Writes `_headers` (CSP and caching) next to the built page. See src/headers.ts. */
function headers(): Plugin {
  return {
    name: 'embed-page-headers',
    applyToEnvironment: (environment) => environment.name === 'client',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: headersFile(process.env.VITE_SANDBOX_ORIGIN || undefined),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    cloudflare({
      // In dev, read the shares the local simten.dev (apps/web, `pnpm dev`)
      // writes: its local KV lives in its own .wrangler/state.
      persistState: { path: new URL('../web/.wrangler/state', import.meta.url).pathname },
      remoteBindings: false,
    }),
    tailwindcss(),
    react(),
    headers(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // The circuit chunk (React, React Flow, the simulator) is about 590 kB,
    // 186 kB gzipped, loaded in parallel with the share. Splitting it further
    // is #419's "Later" bundle work, not a warning to repeat on every build.
    chunkSizeWarningLimit: 800,
  },
});

import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { LEVELS } from './src/game/levels';

// `resolve.tsconfigPaths` is a Vite 8 feature. This workspace is pinned to
// Vite 7 to match @simten/web, so path aliases come from the plugin instead.
const config = defineConfig({
  plugins: [
    tsconfigPaths(),
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart({
      /**
       * Sitemap only — no prerender.
       *
       * Every level is a real URL a crawler can reach and a person can share,
       * so each belongs in the sitemap. Prerendering is a separate question and
       * deliberately left off: it needs a Cloudflare token at build time (see
       * @simten/web's config), and these pages are interactive rather than
       * content, so there is little to bake.
       *
       * The page list is derived from `LEVELS` rather than typed out, so adding
       * a level cannot silently leave it out. `levels.ts` imports only a type,
       * so pulling it into the build config costs nothing at runtime.
       */
      sitemap: {
        enabled: true,
        host: 'https://play.simten.dev',
      },
      pages: [{ path: '/' }, ...LEVELS.map((level) => ({ path: `/${level.id}` }))],
    }),
    viteReact(),
  ],
});

export default config;

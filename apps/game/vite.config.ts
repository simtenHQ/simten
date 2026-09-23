import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

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
       * Prerendering is deliberately off: it needs a Cloudflare token at build
       * time (see @simten/web's config), and these pages are interactive
       * rather than content, so there is little to bake.
       *
       * The map is the only entry a crawler should have. Levels send
       * `noindex` (see `$levelId`'s head), because the campaign is an order
       * rather than a menu, and a sitemap listing pages that refuse to be
       * indexed asks for the two to be read together and contradict each
       * other. They stay reachable and shareable, just not advertised.
       */
      sitemap: {
        enabled: true,
        host: 'https://play.simten.dev',
      },
      pages: [{ path: '/' }],
    }),
    viteReact(),
  ],
});

export default config;

import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import viteReact from '@vitejs/plugin-react';
import fumadocsMdx from 'fumadocs-mdx/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as MdxConfig from './source.config';

const isAnalyze = process.env.ANALYZE === 'true';

// Auto-discover doc pages from content/docs/*.mdx so adding a new file
// doesn't require touching this config. `index.mdx` becomes `/docs`,
// everything else becomes `/docs/<slug>`.
const docsPages = readdirSync(resolve(__dirname, 'content/docs'))
  .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
  .map((f) => {
    const slug = f.replace(/\.(mdx|md)$/, '');
    return { path: slug === 'index' ? '/docs' : `/docs/${slug}` };
  });

// Auto-discover blog post routes from src/routes/blog/<slug>.tsx so adding
// a new post just means dropping in a route file — no vite.config edit.
const blogPages = readdirSync(resolve(__dirname, 'src/routes/blog'))
  .filter((f) => f.endsWith('.tsx') && f !== 'index.tsx' && f !== '$.tsx')
  .map((f) => ({ path: `/blog/${f.replace(/\.tsx$/, '')}` }));

// Auto-discover MDX blog posts from content/blog/*.mdx. These render through
// the /blog/$ splat route; index.mdx is excluded (it would map to /blog, which
// the TSX blog index already owns).
const blogMdxPages = readdirSync(resolve(__dirname, 'content/blog'))
  .filter((f) => (f.endsWith('.mdx') || f.endsWith('.md')) && f !== 'index.mdx')
  .map((f) => ({ path: `/blog/${f.replace(/\.(mdx|md)$/, '')}` }));

const config = defineConfig(({ command }) => ({
  plugins: [
    cloudflare({
      viteEnvironment: { name: 'ssr' },
      // During `vite build`, prerender starts a Vite preview server. With
      // remote bindings on, that preview proxies the COMPILER service to the
      // live worker — which (a) requires CLOUDFLARE_API_TOKEN to set up, and
      // (b) leaves an open connection that prevents Node from exiting after
      // prerender finishes. We don't need the real compiler at prerender
      // time (circuits hydrate client-side), so disable it for build only.
      // Dev (`vite dev`) and the deployed worker keep remote bindings.
      remoteBindings: command !== 'build',
    }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    fumadocsMdx(MdxConfig),
    tanstackStart({
      // Build-time HTML generation for static routes. The Cloudflare vite
      // plugin auto-binds dist/client as static assets, so prerendered files
      // are served without invoking the worker. crawlLinks is off because the
      // crawler picked up trailing-slash duplicates (/blog/ and /blog) and
      // unrelated paths (/docs); we declare the canonical list explicitly.
      // /docs/* stays SSR pending fumadocs SSR fix (#80).
      // /editor is sitemap-only (not prerendered): a Zustand store calls
      // nanoid() at module-init scope, which Cloudflare Workers forbids
      // (Disallowed operation in global scope). See follow-up #81.
      // Prerender requires CLOUDFLARE_API_TOKEN at build time (TanStack
      // spins up a Vite preview server, which the Cloudflare vite plugin
      // bootstraps via the edge-preview API). Locally + CI inject the token
      // through dotenv-cli / GH Actions secrets respectively.
      prerender: {
        enabled: true,
        crawlLinks: false,
        // The route file tree has both /blog (blog.tsx layout) and /blog/
        // (blog/index.tsx); auto-discovery would emit duplicate sitemap
        // entries. Same for /learn. We declare the canonical list explicitly.
        autoStaticPathsDiscovery: false,
      },
      sitemap: {
        enabled: true,
        host: 'https://simten.dev',
      },
      pages: [
        { path: '/' },
        { path: '/circuit', prerender: { enabled: false } },
        { path: '/blog' },
        { path: '/learn' },
        { path: '/learn/adders' },
        { path: '/learn/abstraction' },
        { path: '/learn/registers' },
        { path: '/cpu' },
        { path: '/cpu/rv32i' },
        // Blog posts — auto-discovered from src/routes/blog/<slug>.tsx (TSX)
        // and content/blog/*.mdx (MDX, via the /blog/$ splat route).
        ...blogPages,
        ...blogMdxPages,
        // Docs — auto-discovered from content/docs/*.mdx. Prerender bakes
        // each MDX body into static HTML at build time — TanStack's SSR
        // pass waits for the clientLoader Suspense boundary to resolve,
        // so crawlers see full content, not the layout shell.
        ...docsPages,
      ],
    }),
    viteReact(),
    ...(isAnalyze
      ? [
          visualizer({
            filename: 'dist/bundle-stats.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          }),
        ]
      : []),
  ],
  // Pre-bundle Radix Dialog on startup. The Verilog-import Sheet is the first
  // consumer of @radix-ui/react-dialog, so without this Vite discovers it lazily
  // on first /circuit load and re-optimizes mid-render — which surfaces as a
  // spurious "Invalid hook call / duplicate React" error until a dev restart.
  optimizeDeps: {
    include: ['@radix-ui/react-dialog'],
  },
}));

export default config;

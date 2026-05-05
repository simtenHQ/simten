import { defineConfig } from "vite";

import tsconfigPaths from "vite-tsconfig-paths";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import fumadocsMdx from "fumadocs-mdx/vite";
import { visualizer } from "rollup-plugin-visualizer";
import * as MdxConfig from "./source.config";

const isAnalyze = process.env.ANALYZE === "true";

const config = defineConfig(({ command }) => ({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      // During `vite build`, prerender starts a Vite preview server. With
      // remote bindings on, that preview proxies the COMPILER service to the
      // live worker — which (a) requires CLOUDFLARE_API_TOKEN to set up, and
      // (b) leaves an open connection that prevents Node from exiting after
      // prerender finishes. We don't need the real compiler at prerender
      // time (circuits hydrate client-side), so disable it for build only.
      // Dev (`vite dev`) and the deployed worker keep remote bindings.
      remoteBindings: command !== 'build',
    }),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
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
        { path: '/editor', prerender: { enabled: false } },
        { path: '/blog' },
        { path: '/learn' },
        { path: '/learn/rv32i-cpu' },
        { path: '/blog/aes-in-hardware' },
        { path: '/blog/breakout-in-hardware' },
        { path: '/blog/building-a-cpu' },
        { path: '/blog/chacha20-in-hardware' },
        { path: '/blog/computing-trig-in-hardware' },
        { path: '/blog/crc32-in-hardware' },
        { path: '/blog/how-network-switches-work' },
        { path: '/blog/how-tpus-work' },
        { path: '/blog/mcp-bidirectional-bridge' },
        { path: '/blog/pong-in-hardware' },
        { path: '/blog/rv32i-cpu' },
        { path: '/blog/snake-in-hardware' },
        { path: '/blog/sorting-networks' },
      ],
    }),
    viteReact(),
    ...(isAnalyze
      ? [
          visualizer({
            filename: "dist/bundle-stats.html",
            open: true,
            gzipSize: true,
            brotliSize: true,
            template: "treemap",
          }),
        ]
      : []),
  ],
}));

export default config;

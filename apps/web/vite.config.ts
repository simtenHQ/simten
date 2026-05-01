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

const config = defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
    }),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    fumadocsMdx(MdxConfig),
    tanstackStart(),
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
});

export default config;

import { defineConfig } from "vite";

import tsconfigPaths from "vite-tsconfig-paths";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import fumadocsMdx from "fumadocs-mdx/vite";
import * as MdxConfig from "./source.config";

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
  ],
});

export default config;

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["@simten/source", "import", "node", "default"],
  },
  test: {
    exclude: ["e2e/**", "node_modules/**"],
  },
});

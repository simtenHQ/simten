/**
 * Example circuits for the editor empty state.
 *
 * The catalog itself (titles, descriptions, sources) is canonical in
 * @simten/core/examples/catalog, shared with the MCP server. Only the
 * editor presentation (category colors/labels) lives here.
 */

import type { Example } from "@simten/core/examples/catalog";

export { EXAMPLES } from "@simten/core/examples/catalog";
export type { Example };

export const CATEGORY_COLORS: Record<Example["category"], string> = {
  game: "text-green-400 border-green-800/50 bg-green-900/30",
  math: "text-amber-400 border-amber-800/50 bg-amber-900/30",
  cpu: "text-blue-400 border-blue-800/50 bg-blue-900/30",
  basics: "text-gray-400 border-gray-700/50 bg-gray-800/30",
};

export const CATEGORY_LABELS: Record<Example["category"], string> = {
  game: "Game",
  math: "Math",
  cpu: "CPU",
  basics: "Basics",
};

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
  game: "text-green-700 border-green-300 bg-green-50 dark:text-green-400 dark:border-green-800/50 dark:bg-green-900/30",
  math: "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-800/50 dark:bg-amber-900/30",
  cpu: "text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-400 dark:border-blue-800/50 dark:bg-blue-900/30",
  basics: "text-gray-600 border-gray-300 bg-gray-100 dark:text-gray-400 dark:border-gray-700/50 dark:bg-gray-800/30",
};

export const CATEGORY_LABELS: Record<Example["category"], string> = {
  game: "Game",
  math: "Math",
  cpu: "CPU",
  basics: "Basics",
};

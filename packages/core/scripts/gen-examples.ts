#!/usr/bin/env tsx
/**
 * Writes src/examples/snake-source.gen.ts: SnakeCore and its stages as
 * editor source, copied from src/examples/snake.ts so the /circuit example and
 * the module that ships to the FPGA are one piece of code.
 *
 * The copy is the code between the `// editor-example:start` and
 * `// editor-example:end` markers in buildSnake(), with the function's
 * indentation removed. src/examples/__tests__/snake-source.test.ts fails when
 * the written file is out of date.
 *
 *   pnpm --filter @simten/core gen:examples
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SNAKE_MODULE = fileURLToPath(new URL('../src/examples/snake.ts', import.meta.url));
export const SNAKE_SOURCE_FILE = fileURLToPath(
  new URL('../src/examples/snake-source.gen.ts', import.meta.url),
);

const START = '// editor-example:start';
const END = '// editor-example:end';

/** The lines between the markers, dedented by the start marker's indentation. */
export function extractEditorExample(moduleText: string): string {
  const lines = moduleText.split('\n');
  const start = lines.findIndex((l) => l.trim() === START);
  const end = lines.findIndex((l) => l.trim() === END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`snake.ts must contain '${START}' followed by '${END}'`);
  }
  const indent = lines[start].length - lines[start].trimStart().length;
  return lines
    .slice(start + 1, end)
    .map((l) => (l.slice(0, indent).trim() === '' ? l.slice(indent) : l))
    .join('\n');
}

/** The contents of snake-source.gen.ts for a given snake.ts. */
export function renderSnakeSource(moduleText: string): string {
  const code = extractEditorExample(moduleText)
    .replaceAll('\\', '\\\\')
    .replaceAll('`', '\\`')
    .replaceAll('${', '\\${');
  return `// Generated from snake.ts by scripts/gen-examples.ts. Do not edit; run
// \`pnpm --filter @simten/core gen:examples\` after changing snake.ts.

/** SnakeCore and its stages as editor source: top-level consts, no imports. */
export const SNAKE_CORE_SOURCE = \`${code}
\`;
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(SNAKE_SOURCE_FILE, renderSnakeSource(readFileSync(SNAKE_MODULE, 'utf8')));
  console.log(`Wrote ${SNAKE_SOURCE_FILE}`);
}

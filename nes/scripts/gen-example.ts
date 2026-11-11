#!/usr/bin/env tsx
/**
 * Writes packages/core/src/examples/nes-source.gen.ts: the whole NES as
 * editor source for the /circuit example, made from the modules in nes/src
 * so the example and the tested code are one piece of code.
 *
 * The modules go in import order, the demo last (its NesDemo is the circuit
 * the editor runs), each under a line naming its file. Imports and `export`
 * keywords come out, as the editor provides simten's names itself. board.ts
 * stops at `// editor-example:end`: below it is test tooling. Tests, the APU's
 * reference model and the iNES parser are left out. demo.test.ts fails when
 * the written file is out of date.
 *
 *   pnpm --filter @simten/nes gen:example
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const NES_SRC = resolve(here, '../src');
export const NES_SOURCE_FILE = resolve(here, '../../packages/core/src/examples/nes-source.gen.ts');

const LEFT_OUT = /(\.test\.ts|test-frame\.ts|reference\.ts|ines\.ts)$/;
const END = '// editor-example:end';

function modules(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return modules(path);
    return name.endsWith('.ts') && !LEFT_OUT.test(name) ? [path] : [];
  });
}

/** The relative modules a file imports, as absolute paths. */
function importsOf(path: string, text: string): string[] {
  return [...text.matchAll(/^import[\s\S]*?from\s+'(\.[^']+)';/gm)].map((m) =>
    resolve(dirname(path), m[1].replace(/\.js$/, '.ts')),
  );
}

/** Each module after the ones it imports; ties in name order. */
function inImportOrder(paths: string[], texts: Map<string, string>): string[] {
  const done = new Set<string>();
  const order: string[] = [];
  const visit = (p: string) => {
    if (done.has(p)) return;
    done.add(p);
    for (const dep of importsOf(p, texts.get(p) ?? '')) if (texts.has(dep)) visit(dep);
    order.push(p);
  };
  for (const p of [...paths].sort()) visit(p);
  return order;
}

/** One module as editor source: no imports, no exports, test tooling cut. */
function editorText(text: string): string {
  const end = text.indexOf(END);
  return (end === -1 ? text : text.slice(0, end))
    .replace(/^import[\s\S]*?from\s+'[^']+';\n/gm, '')
    .replace(/^export (?=(const|function|interface|type|class) )/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The contents of nes-source.gen.ts for the current nes/src. */
export function renderNesSource(): string {
  const paths = modules(NES_SRC);
  const texts = new Map(paths.map((p) => [p, readFileSync(p, 'utf8')]));
  const demo = join(NES_SRC, 'demo.ts');
  const order = [...inImportOrder(paths, texts).filter((p) => p !== demo), demo];
  const code = order
    .map((p) => `// ── nes/src/${relative(NES_SRC, p)} ──\n\n${editorText(texts.get(p) ?? '')}`)
    .join('\n\n')
    .replaceAll('\\', '\\\\')
    .replaceAll('`', '\\`')
    .replaceAll('${', '\\${');
  return `// Generated from nes/src by nes/scripts/gen-example.ts. Do not edit; run
// \`pnpm --filter @simten/nes gen:example\` after changing the NES.

/** The NES, from the cartridge connector to the APU, as editor source. */
export const NES_SOURCE = \`\n${code}
\`;
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(NES_SOURCE_FILE, renderNesSource());
  console.log(`Wrote ${NES_SOURCE_FILE}`);
}

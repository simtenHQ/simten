/**
 * Codemod (string mode): rename `in:` / `out:` → `inputs:` / `outputs:` and
 * reshape connect destructures inside template literals.
 *
 * The AST codemod (`circuit-keys.ts`) only sees real source code. Many circuit
 * definitions in this repo live inside template literals (`code = \`const X =
 * circuit(...)\``) — used by the editor's "Load an example" panel, splash demos,
 * docs visualizers, etc. Those need the same transform but applied to string
 * content.
 *
 * Strategy:
 *   1. Read each target file as text.
 *   2. Apply ordered regex replacements that rewrite connect destructures and
 *      embed sentinel markers tagging the captured aliases.
 *   3. Walk the markers, rewriting body references using the captured aliases,
 *      stripping markers as we go.
 *   4. Rename top-level config keys `in:` → `inputs:`, `out:` → `outputs:`.
 *
 * Markers use `[[ALIAS:kind:name]]` form — square brackets are not word chars
 * and unambiguous against the surrounding TS source.
 *
 * Usage:
 *   pnpm exec tsx tools/codemod/circuit-keys-strings.ts <file>...
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface FileResult {
  file: string;
  changes: number;
}

const MARKER_RE = /\[\[ALIAS:(IN|OUT):([a-zA-Z_$][\w$]*)\]\]/;

function transformConnects(content: string): { result: string; changes: number } {
  let changes = 0;
  let result = content;

  // 1. `{ in: <alias>, out: <alias>, <nodes>... }` — both renamed
  result = result.replace(
    /connect:\s*\(\{\s*in:\s*([a-zA-Z_$][\w$]*)\s*,\s*out:\s*([a-zA-Z_$][\w$]*)\s*,\s*([\s\S]*?)\}\)/g,
    (_, inAlias: string, outAlias: string, rest: string) => {
      changes++;
      const cleanRest = rest.replace(/\s+/g, ' ').replace(/,\s*$/, '').trim();
      return `connect: ({ inputs, outputs, nodes: { ${cleanRest} } })[[ALIAS:IN:${inAlias}]][[ALIAS:OUT:${outAlias}]]`;
    },
  );

  // 2. `{ in: <alias>, out, <nodes>... }` — out shorthand
  result = result.replace(
    /connect:\s*\(\{\s*in:\s*([a-zA-Z_$][\w$]*)\s*,\s*out\s*,\s*([\s\S]*?)\}\)/g,
    (_, inAlias: string, rest: string) => {
      changes++;
      const cleanRest = rest.replace(/\s+/g, ' ').replace(/,\s*$/, '').trim();
      return `connect: ({ inputs, outputs, nodes: { ${cleanRest} } })[[ALIAS:IN:${inAlias}]][[ALIAS:OUT:out]]`;
    },
  );

  // 3. `{ in: <alias>, out }` — no nodes
  result = result.replace(
    /connect:\s*\(\{\s*in:\s*([a-zA-Z_$][\w$]*)\s*,\s*out\s*\}\)/g,
    (_, inAlias: string) => {
      changes++;
      return `connect: ({ inputs, outputs })[[ALIAS:IN:${inAlias}]][[ALIAS:OUT:out]]`;
    },
  );

  // 4. `{ out, <nodes>... }` — no inputs, out shorthand
  result = result.replace(/connect:\s*\(\{\s*out\s*,\s*([\s\S]*?)\}\)/g, (_, rest: string) => {
    changes++;
    const cleanRest = rest.replace(/\s+/g, ' ').replace(/,\s*$/, '').trim();
    return `connect: ({ outputs, nodes: { ${cleanRest} } })[[ALIAS:OUT:out]]`;
  });

  // 5. `{ <nodes only> }` — top-level demos with no in/out config keys.
  //    Skip destructures we already rewrote (they start with inputs/outputs/nodes:).
  result = result.replace(
    /connect:\s*\(\{\s*((?!inputs[,\s]|outputs[,\s]|nodes:|in:|out\b)[^}]*?)\}\)/g,
    (match, rest: string) => {
      const trimmed = rest.trim();
      if (!trimmed) return match;
      changes++;
      const cleanRest = trimmed.replace(/\s+/g, ' ').replace(/,\s*$/, '').trim();
      return `connect: ({ nodes: { ${cleanRest} } })`;
    },
  );

  return { result, changes };
}

/** Walk markers, rewrite body refs, strip markers. */
function rewriteBodyAliases(content: string): string {
  while (true) {
    const m = content.match(MARKER_RE);
    if (!m) break;

    const kind = m[1] as 'IN' | 'OUT';
    const alias = m[2];
    const idx = m.index!;
    const markerLen = m[0].length;

    // Scope: from end of marker to start of the next circuit() call. Prevents
    // an alias from leaking across circuit boundaries when multiple circuits
    // sit in one template literal.
    const remainder = content.slice(idx + markerLen);
    const nextCircuitIdx = remainder.search(/circuit\s*\(/);
    const scopeEnd = nextCircuitIdx >= 0 ? idx + markerLen + nextCircuitIdx : content.length;

    const before = content.slice(0, idx);
    const scope = content.slice(idx + markerLen, scopeEnd);
    const after = content.slice(scopeEnd);

    // Only rewrite when alias isn't chained off another identifier.
    const replacement = kind === 'IN' ? 'inputs.' : 'outputs.';
    const rewritten = scope.replace(new RegExp(`(?<![.\\w])${alias}\\.`, 'g'), replacement);

    content = before + rewritten + after;
  }

  return content;
}

/** Rename top-level config keys `in: { ... }` → `inputs: { ... }`. */
function renameConfigKeys(content: string): { result: string; changes: number } {
  let changes = 0;
  let result = content;

  result = result.replace(/(\n[ \t]+)in(\s*:\s*\{[^}]*\})/g, (_, ws, rest) => {
    changes++;
    return `${ws}inputs${rest}`;
  });

  result = result.replace(/(\n[ \t]+)out(\s*:\s*\{[^}]*\})/g, (_, ws, rest) => {
    changes++;
    return `${ws}outputs${rest}`;
  });

  return { result, changes };
}

function processFile(file: string): FileResult {
  const original = readFileSync(file, 'utf-8');
  let content = original;
  let totalChanges = 0;

  const pass1 = transformConnects(content);
  content = pass1.result;
  totalChanges += pass1.changes;

  content = rewriteBodyAliases(content);

  const pass3 = renameConfigKeys(content);
  content = pass3.result;
  totalChanges += pass3.changes;

  if (content !== original) {
    writeFileSync(file, content);
  }

  return { file, changes: totalChanges };
}

const files = process.argv.slice(2).map((f) => resolve(f));
if (files.length === 0) {
  console.error('Usage: codemod-strings <file>...');
  process.exit(1);
}

let totalChanges = 0;
let filesChanged = 0;
for (const file of files) {
  const result = processFile(file);
  if (result.changes > 0) {
    filesChanged++;
    totalChanges += result.changes;
    const rel = file.replace(process.cwd() + '/', '');
    console.log(`  ${rel}: ${result.changes} change(s)`);
  }
}

console.log(`\nTotal: ${totalChanges} changes across ${filesChanged} files`);

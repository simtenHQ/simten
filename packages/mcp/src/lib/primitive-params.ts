/**
 * Factory option signatures for parameterized stdlib components.
 *
 * The injected primitives list shows component PORTS but not the options a
 * factory takes — so an agent can see `DFlipFlop` has `d → q` but not that it's
 * seeded via `DFlipFlop({ value })`, or `Register` via `Register({ width, value })`.
 * That gap costs an iterate cycle (or a silent mis-parameterization).
 *
 * We recover the signatures from @simten/core's shipped `bundle.d.ts` — the same
 * published types the editor's IntelliSense uses — so this is drift-free (parsed
 * from the real types on every server start) and needs no per-component schema or
 * build step. Runs only in the MCP parent at startup, where fs is available.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/** Map of component name → constructor options type, e.g. "{ width?: number; value?: number }". */
export function getFactoryOptionSignatures(): Map<string, string> {
  const out = new Map<string, string>();

  let dts: string;
  try {
    const require = createRequire(import.meta.url);
    // `@simten/core/bundle` is an explicit export → ./dist/bundle.d.ts, which
    // ships with the package (so this resolves for real installs, not just the
    // workspace). The package.json itself is not exported, so we anchor here.
    dts = readFileSync(require.resolve('@simten/core/bundle'), 'utf8');
  } catch {
    return out; // best-effort: no annotations if the types can't be located
  }

  // Factories declare as `declare const Name: (opts?: { ... }) => ...`.
  // Match up to the opening brace, then balance-scan to capture the full
  // (possibly nested) options object.
  const re = /declare const (\w+)\s*:\s*\(opts\??\s*:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(dts)) !== null) {
    const name = m[1];
    const open = re.lastIndex - 1; // index of the `{`
    let depth = 0;
    let i = open;
    for (; i < dts.length; i++) {
      if (dts[i] === '{') depth++;
      else if (dts[i] === '}' && --depth === 0) { i++; break; }
    }
    const body = dts.slice(open + 1, i - 1).replace(/\s+/g, ' ').replace(/;\s*$/, '').trim();
    if (body) out.set(name, `{ ${body} }`);
  }

  return out;
}

/**
 * Append constructor-options annotations to a compact primitives listing.
 * Each line looks like `Name(ports...) -> (outs...) [timing] // desc`; for any
 * parameterized factory we insert ` ctor(<opts>)` before the trailing comment.
 */
export function annotatePrimitivesWithOptions(primitives: string, opts: Map<string, string>): string {
  if (opts.size === 0) return primitives;
  return primitives
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\w+)\(/);
      if (!m || !opts.has(m[1])) return line;
      const ann = ` ctor(${opts.get(m[1])})`;
      const c = line.indexOf(' // ');
      return c >= 0 ? line.slice(0, c) + ann + line.slice(c) : line + ann;
    })
    .join('\n');
}

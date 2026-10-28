/**
 * Guards for the gate-level reference builds.
 *
 * The load-bearing one is the containment suite. `STDLIB_CIRCUITS` materializes
 * every exported function in the std modules by calling it with no arguments
 * and keeping whatever returns a `Circuit` (see `_materialize` in
 * `std/index.ts`). A `MADE_OF` builder called with no arguments returns exactly
 * that, so exporting one bare from a std module — or adding `made-of.js` to
 * `_allExports` — would silently register a second, structurally different
 * "Adder" in the stdlib. Nothing else would fail; the canvas and the exporter
 * would just start disagreeing about what an Adder is.
 *
 * Also spawns `made-of-equivalence.verify.ts` so the equivalence proof runs in CI. It lives
 * in a subprocess because the verify harness is a module singleton — one
 * testbench per process.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { internalsOf, isCircuit } from '../../circuit/internals.js';
import { STDLIB_CIRCUITS } from '../index.js';
import * as MadeOfModule from '../made-of.js';
import { hasMadeOf, MADE_OF, MADE_OF_NAMES } from '../made-of.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../../..');
const stdDir = resolve(here, '..');

const stdlibNames = STDLIB_CIRCUITS.map((c) => c.name);

/** A reference build, checked to be a circuit. */
function build(name: string, args: Parameters<(typeof MADE_OF)[string]>[0]) {
  const built = MADE_OF[name](args);
  if (!isCircuit(built)) throw new Error(`MADE_OF.${name} did not build a circuit`);
  return built;
}

describe('MADE_OF containment', () => {
  it('never leaks a reference build into STDLIB_CIRCUITS', () => {
    // Every builder names its output `<Primitive><width>_madeOf`, so a leak is
    // visible by name regardless of which module let it through.
    const leaked = stdlibNames.filter((n) => n.endsWith('_madeOf'));
    expect(leaked).toEqual([]);
  });

  it('exports nothing that survives _materialize', () => {
    // The real guard. What makes a leak possible is not where the module sits
    // in the import graph — it is whether the module exports a bare function
    // that returns a Circuit when called with no arguments. This is
    // `_materialize`'s exact predicate, applied to this module's public
    // surface, so it fails the moment someone exports a builder directly
    // (`export function adderMadeOf(...)`) whether or not index.ts changes.
    const materializes = Object.entries(MadeOfModule).filter(([, v]) => {
      if (typeof v !== 'function') return false;
      try {
        const built = (v as () => unknown)();
        return isCircuit(built);
      } catch {
        return false;
      }
    });
    expect(materializes.map(([k]) => k)).toEqual([]);
  });

  it('produces exactly the circuits a bare export would leak', () => {
    // Pin the mechanism the guard above protects against: these builders really
    // do return a Circuit when called with no arguments, which is what
    // `_materialize` does to every exported function.
    for (const name of MADE_OF_NAMES) {
      expect(build(name, {}).name).toMatch(/_madeOf$/);
    }
  });

  it('keeps made-of.js out of the _allExports list in index.ts', () => {
    // The behavioural checks above catch a leak after the fact; this catches
    // the specific edit that would cause one.
    const indexSrc = readFileSync(resolve(stdDir, 'index.ts'), 'utf8');
    const allExportsBlock = indexSrc.slice(
      indexSrc.indexOf('const _allExports'),
      indexSrc.indexOf('const _materialize'),
    );
    expect(allExportsBlock).not.toMatch(/made-?of/i);
    expect(indexSrc).not.toMatch(/import \* as \w+ from '\.\/made-of\.js'/);
  });

  it('registers no duplicate circuit names in the stdlib', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const n of stdlibNames) {
      if (seen.has(n)) dupes.push(n);
      seen.add(n);
    }
    expect(dupes).toEqual([]);
  });
});

describe('MADE_OF table', () => {
  it('keys every entry to a real stdlib primitive', () => {
    for (const name of MADE_OF_NAMES) {
      expect(stdlibNames, `${name} is not a stdlib circuit`).toContain(name);
    }
  });

  it('reports drillability by name', () => {
    expect(hasMadeOf('Adder')).toBe(true);
    expect(hasMadeOf('Comparator')).toBe(true);
    // Deliberately absent: a 256-adder array teaches nothing, and memory maps
    // to hardened blocks so a gate build would misrepresent the hardware.
    expect(hasMadeOf('Multiplier')).toBe(false);
    expect(hasMadeOf('RAM')).toBe(false);
    expect(hasMadeOf('Constant')).toBe(false);
    // Not inherited from Object.prototype.
    expect(hasMadeOf('toString')).toBe(false);
    expect(hasMadeOf('constructor')).toBe(false);
  });

  it('builds to the width it is given, not the default', () => {
    for (const w of [1, 4, 16]) {
      const built = build('Adder', { width: w });
      expect(built.name).toBe(`Adder${w}_madeOf`);
      // One FullAdder per bit.
      const stages = internalsOf(built).ir.nodes.filter((n) => n.componentRef === 'FullAdder');
      expect(stages).toHaveLength(w);
    }
  });

  it('builds from nothing that has a reference build of its own', () => {
    // The inspector relies on this: a drill-down stack holds at most one
    // reference build, fed from the main simulation. A build containing an
    // Adder would need a reference session fed from another reference session.
    for (const name of MADE_OF_NAMES) {
      const { ir, dependencies } = internalsOf(build(name, { width: 4 }));
      const parts = [ir, ...[...dependencies.values()].map((d) => internalsOf(d).ir)];
      for (const part of parts) {
        for (const node of part.nodes) {
          expect(hasMadeOf(node.componentRef), `${name} contains ${node.componentRef}`).toBe(false);
        }
      }
    }
  });

  it('falls back to the default width on a malformed argument', () => {
    for (const bad of [undefined, 0, -4, 2.5, 'wide']) {
      expect(build('Adder', { width: bad } as never).name).toBe('Adder8_madeOf');
    }
  });
});

describe('FullAdder', () => {
  const fullAdder = () => {
    const fa = STDLIB_CIRCUITS.find((c) => c.name === 'FullAdder');
    if (!fa) throw new Error('FullAdder is not in STDLIB_CIRCUITS');
    return internalsOf(fa).ir;
  };

  it('is a composite in the stdlib, so it can be drilled into', () => {
    expect(fullAdder().implementation.kind).toBe('composite');
    expect(fullAdder().nodes.length).toBeGreaterThan(0);
  });

  it('stops at Xor/And/Or — the game already covers NAND', () => {
    const refs = new Set(fullAdder().nodes.map((n) => n.componentRef));
    expect([...refs].sort()).toEqual(['And', 'Or', 'Xor']);
  });
});

describe('made-of-equivalence.verify.ts', () => {
  it('proves every reference build equivalent to its primitive', { timeout: 120_000 }, () => {
    // Strip VITEST so the harness runs in its real tsx mode (emit JSON +
    // exit code) rather than vitest mode (throw).
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.VITEST;
    delete env.VITEST_POOL_ID;
    delete env.VITEST_WORKER_ID;
    const r = spawnSync(
      resolve(repoRoot, 'node_modules/.bin/tsx'),
      [resolve(here, 'made-of-equivalence.verify.ts')],
      { cwd: repoRoot, env, encoding: 'utf8' },
    );
    expect(r.stdout, r.stderr).toContain('"testbench_passed": true');
    expect(r.status).toBe(0);
  });
});

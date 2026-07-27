/**
 * Guards for issue #102: the bundled .d.ts shipped to Monaco at /circuit
 * must keep its public surface intact and not leak @internal fields. The
 * substring assertions catch the failure modes that matter (regressions in
 * tsc stripInternal, rollup-plugin-dts dropping a re-export, internal-API
 * leaks) without the brittleness of a full snapshot or a compile-in-isolation
 * setup.
 *
 * Depends on the build artifact at dist/bundle.d.ts. The package's
 * `pretest` script runs the build, so this test works on a fresh clone.
 */

import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(here, '..', '..', '..', 'dist', 'bundle.d.ts');
const globalsPath = join(here, '..', '..', '..', 'dist', 'editor-globals.dts.txt');

describe('dist/bundle.d.ts', () => {
  const bundle = readFileSync(bundlePath, 'utf8');

  it.each([
    ['declare function circuit'],
    ['declare const bit'],
    ['declare function bus'],
    ['declare function reg'],
    ['declare function mem'],
    ['declare const And'],
    ['declare const Or'],
    ['declare const Adder'],
    ['declare const Register'],
    ['declare function romFromBytes'],
    ['interface BuiltCircuit'],
    ['interface CircuitConfig'],
  ])('contains public symbol: %s', (needle) => {
    expect(bundle).toContain(needle);
  });

  it.each([['_shape'], ['_path'], ['_type']])('does not leak @internal field: %s', (needle) => {
    // Use a word boundary so member-like accesses are flagged but unrelated
    // identifiers (e.g. `path` in a name like `portPath`) are not.
    expect(bundle).not.toMatch(new RegExp(`\\b${needle}\\b`));
  });

  it('keeps _dependencies (real public API, not internal)', () => {
    expect(bundle).toContain('_dependencies');
  });

  it('stays under the 110 KB headroom budget', () => {
    // Guard on the Monaco type-payload size (affects editor cold-load). Bump
    // deliberately when the public stdlib grows: raised 100 → 110 KB for the
    // four import-reconstruction components (Slice/Concat/SignExtend/ZeroExtend).
    // Trim JSDoc before bumping further.
    const { size } = statSync(bundlePath);
    expect(size).toBeLessThan(110 * 1024);
  });
});

describe('dist/editor-globals.dts.txt', () => {
  const globals = readFileSync(globalsPath, 'utf8');

  it('wraps declarations in declare global + export {}', () => {
    expect(globals).toContain('declare global {');
    expect(globals).toContain('export {};');
  });

  it.each([
    'const circuit:',
    'const component:',
    'const bit:',
    'const bus:',
    'const reg:',
    'const mem:',
    'const And:',
    'const Adder:',
    'const Register:',
    'const romFromBytes:',
  ])('declares ambient global: %s', (decl) => {
    expect(globals).toContain(decl);
  });

  it('does not leak non-stdlib root exports as globals', () => {
    // executeCircuitCode only injects stdlib + the 6 fixed names. Things
    // like `elaborate`, `createSimulator`, `executeCircuitCode` itself are
    // root exports but must NOT appear in the editor's global scope.
    expect(globals).not.toMatch(/\bconst elaborate:/);
    expect(globals).not.toMatch(/\bconst createSimulator:/);
    expect(globals).not.toMatch(/\bconst executeCircuitCode:/);
  });
});

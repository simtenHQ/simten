/**
 * Component-homes registry — the single source of truth for {kind, home}.
 *
 * Two guarantees:
 *  1. Behaviour: reconstruction vs semantic, stdlib vs import are classified as
 *     the plan's principle requires.
 *  2. Completeness: every primitive the importer actually emits for a real
 *     design resolves (classify ≠ undefined), or is an instantiated submodule.
 *     A new lift rule that emits an unclassified primitive fails this test.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classify, isKnownSerializablePrimitive, isReconstruction } from '../component-homes.js';
import { importNetlist, type YosysNetlist } from '../index.js';

describe('classification principle', () => {
  it('reconstruction = the four bit-wiring constructs (+ their Rtl* precursors)', () => {
    for (const n of ['Slice', 'Concat', 'SignExtend', 'ZeroExtend', 'RtlSlice', 'RtlConcat2'])
      expect(isReconstruction(n), n).toBe(true);
    for (const n of ['Adder', 'Mux', 'Register', 'Constant', 'RtlAdd', 'Pmux_8w_2s'])
      expect(isReconstruction(n), n).toBe(false);
  });

  it('home splits authored constructs (stdlib) from elaboration artifacts (import)', () => {
    for (const n of ['Slice', 'Concat', 'SignExtend', 'ZeroExtend', 'Adder', 'Mux', 'Register'])
      expect(classify(n)?.home, n).toBe('stdlib');
    // pure elaboration artifacts — shape-named, matched by prefix
    for (const n of ['Pmux_32w_10s', 'Mem_2r1w_8a_8w_256d', 'Dlatch_8w_ep1'])
      expect(classify(n)?.home, n).toBe('import');
  });

  it('unknown names (submodule / user circuits) are unclassified, not serializable primitives', () => {
    expect(classify('top')).toBeUndefined();
    expect(isKnownSerializablePrimitive('top')).toBe(false);
    expect(isKnownSerializablePrimitive('Adder')).toBe(true);
    expect(isKnownSerializablePrimitive('Mem_2r1w_8a_8w_256d')).toBe(true);
  });
});

describe('completeness against a real import', () => {
  const fix = (name: string) =>
    readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8');
  const netlist = JSON.parse(fix('demo.json')) as YosysNetlist;

  it('every emitted node is a classified primitive or an instantiated submodule', () => {
    const { library } = importNetlist(netlist, 'top');
    const moduleNames = new Set(library.keys());
    for (const c of library.values()) {
      for (const n of c.nodes) {
        const ref = n.componentRef;
        const ok = classify(ref) !== undefined || moduleNames.has(ref);
        expect(ok, `unclassified componentRef '${ref}' in module '${c.name}'`).toBe(true);
      }
    }
  });
});

/**
 * Export reports primitives it has no mapping for, instead of hiding them.
 *
 * `emitPrimitive`'s default case emits `// WARNING: Unsupported primitive` in
 * place of logic and lets the export succeed. The result parses, synthesizes,
 * and does not do what the circuit does — a yosys `miter`/`sat` equivalence
 * check against the original Verilog finds counterexamples. It was found that
 * way: round-tripping RV32I_ALU through import and back produced a module whose
 * `result` matched but whose `zero` output did not, and nothing in the file
 * looked wrong to a reader.
 *
 * Imported designs hit this routinely, since `Slice`, `ZeroExtend`, `Pmux_*` and
 * `SignedRightShifter` are all products of yosys elaboration with no exporter
 * mapping. So `ExportResult.unsupported` records them and callers refuse.
 *
 * Two claims:
 *  1. A circuit using an unmapped primitive reports it, keyed by type, with the
 *     offending node ids — and the count matches the warnings actually emitted.
 *  2. A clean circuit leaves the field absent, so `if (unsupported)` is a safe
 *     guard and existing consumers destructuring `{ verilog, files }` are
 *     unaffected.
 */

import { describe, expect, it } from 'vitest';
import { bus, circuit } from '../../circuit/index.js';
import type { Circuit, CircuitLibrary } from '../../index.js';
import { And, Slice } from '../../std/index.js';
import { exportVerilog } from '../index.js';
import { UNSUPPORTED_MARKER } from '../primitive-map.js';

/** Same shape as `exporter.test.ts`'s helper: the top circuit plus every
 *  transitive dependency, so elaboration can resolve the primitives. */
function libraryFor(c: {
  circuit: Circuit;
  _dependencies: ReadonlyMap<string, { circuit: Circuit }>;
}) {
  const byName = new Map<string, Circuit>();
  const lib: CircuitLibrary & { addCircuit(x: Circuit): void } = {
    resolveCircuit: (name) => byName.get(name),
    getAllPrimitiveNames: () =>
      [...byName.entries()]
        .filter(([, x]) => x.implementation.kind === 'primitive')
        .map(([n]) => n),
    addCircuit: (x) => {
      byName.set(x.name, x);
    },
  };
  lib.addCircuit(c.circuit);
  for (const [, dep] of c._dependencies) lib.addCircuit(dep.circuit ?? (dep as unknown as Circuit));
  return lib;
}

describe('verilog export: unsupported primitives', () => {
  it('reports unmapped primitives with their node ids', () => {
    const WithSlice = circuit('WithSlice', {
      inputs: { a: bus(8) },
      outputs: { y: bus(4) },
      nodes: { s0: Slice({ inWidth: 8, offset: 0, width: 4 }) },
      connect: ({ inputs, outputs, nodes: { s0 } }) => [inputs.a.to(s0.in), s0.out.to(outputs.y)],
    });

    const result = exportVerilog(WithSlice.circuit, libraryFor(WithSlice));

    expect(result.unsupported).toBeDefined();
    expect(Object.keys(result.unsupported ?? {})).toContain('Slice');
    expect(result.unsupported?.Slice).toEqual(['s0']);

    // The report must match what actually landed in the file — a mismatch would
    // mean either a silent gap or a spurious refusal.
    const emitted = (result.verilog.match(new RegExp(UNSUPPORTED_MARKER, 'g')) ?? []).length;
    expect(emitted).toBe(Object.values(result.unsupported ?? {}).flat().length);
  });

  it('leaves the field absent for a cleanly exportable circuit', () => {
    const Clean = circuit('Clean', {
      inputs: { a: bus(1), b: bus(1) },
      outputs: { y: bus(1) },
      nodes: { g: And },
      connect: ({ inputs, outputs, nodes: { g } }) => [
        inputs.a.to(g.a),
        inputs.b.to(g.b),
        g.out.to(outputs.y),
      ],
    });

    const result = exportVerilog(Clean.circuit, libraryFor(Clean));

    expect(result.unsupported).toBeUndefined();
    expect(result.verilog).not.toContain(UNSUPPORTED_MARKER);
  });
});

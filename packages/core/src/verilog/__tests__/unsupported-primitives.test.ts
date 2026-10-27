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
 * Imported designs used to hit this routinely (`Slice` and `SignedRightShifter`,
 * products of yosys elaboration, had no mapping until #458), and a user
 * primitive whose `eval` can't be translated still does. So
 * `ExportResult.unsupported` records them and callers refuse.
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
import { And } from '../../std/index.js';
import { exportVerilog } from '../index.js';
import { UNSUPPORTED_MARKER } from '../primitive-map.js';

describe('verilog export: unsupported primitives', () => {
  it('reports unmapped primitives with their node ids', () => {
    // No mapping, and an eval with a call the exporter can't translate.
    const Opaque = circuit('Opaque', {
      inputs: { a: bus(8) },
      outputs: { y: bus(8) },
      eval: ({ a }) => ({ y: Math.max(a, 3) }),
    });
    const WithOpaque = circuit('WithOpaque', {
      inputs: { a: bus(8) },
      outputs: { y: bus(8) },
      nodes: { s0: Opaque },
      connect: ({ inputs, outputs, nodes: { s0 } }) => [inputs.a.to(s0.a), s0.y.to(outputs.y)],
    });

    const result = exportVerilog(WithOpaque);

    expect(result.unsupported).toBeDefined();
    expect(Object.keys(result.unsupported ?? {})).toContain('Opaque');
    expect(result.unsupported?.Opaque).toEqual(['s0']);

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

    const result = exportVerilog(Clean);

    expect(result.unsupported).toBeUndefined();
    expect(result.verilog).not.toContain(UNSUPPORTED_MARKER);
  });
});

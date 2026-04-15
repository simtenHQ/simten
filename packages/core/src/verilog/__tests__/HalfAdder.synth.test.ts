/**
 * HalfAdder synthesis smoke test.
 *
 * The simplest possible combinational circuit — two gates — proves that
 * exportVerilog with target:'synthesis' produces Verilog Yosys accepts, and
 * that the returned stats match what we'd expect from first principles.
 */

import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { circuit, bit } from '../../circuit/index.js';
import { And, Xor } from '../../std/index.js';
import type { CircuitLibrary } from '../../types/circuit.js';
import { synthesizeVerilog, hasSynth } from './synth.js';

function buildHalfAdder() {
  const HalfAdder = circuit('HalfAdder', {
    in: { a: bit, b: bit },
    out: { sum: bit, carry: bit },
    nodes: { x: Xor, a: And },
    connect: ({ in: inp, out, x, a }) => [
      inp.a.to(x.a, a.a),
      inp.b.to(x.b, a.b),
      x.out.to(out.sum),
      a.out.to(out.carry),
    ],
  });

  const lib: CircuitLibrary = {
    resolveCircuit: (name) => {
      if (name === 'HalfAdder') return HalfAdder.circuit;
      return HalfAdder._dependencies.get(name)?.circuit;
    },
    getAllPrimitiveNames: () => [...HalfAdder._dependencies.keys()],
  };

  return { circuit: HalfAdder.circuit, lib };
}

const d = describe.skipIf(!hasSynth());

d('HalfAdder — Yosys synthesis', () => {
  it('synthesizes cleanly and maps to 2 cells (AND + XOR)', { timeout: 30000 }, async () => {
    const { circuit, lib } = buildHalfAdder();
    const result = exportVerilog(circuit, lib, { target: 'synthesis' });

    const resp = await synthesizeVerilog(result, 'HalfAdder');

    if (!resp.success) {
      // eslint-disable-next-line no-console
      console.error('synth response:', JSON.stringify(resp, null, 2));
    }

    expect(resp.success).toBe(true);
    expect(resp.stats).toBeDefined();
    expect(resp.stats!.cells).toBe(2);
    expect(resp.stats!.cellBreakdown['$_AND_']).toBe(1);
    expect(resp.stats!.cellBreakdown['$_XOR_']).toBe(1);
    expect(resp.netlist).toBeTruthy();
  });
});

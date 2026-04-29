/**
 * Counter synthesis test.
 *
 * Re-uses the same Register+Adder+Mux+Or counter from the co-sim e2e test
 * and proves it also synthesizes cleanly with target:'synthesis'. This
 * exercises sequential logic (always @(posedge clk) blocks, DFFs) through
 * the Yosys flow — a different code path from the combinational HalfAdder test.
 *
 * We don't assert exact cell counts here since Yosys may optimize the
 * 8-bit adder/mux differently across versions. We just require:
 *   - synthesis succeeds without errors
 *   - at least one register cell is present (the circuit IS sequential)
 *   - total cell count is plausible (> 0)
 *   - a netlist JSON is returned
 */

import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import { Adder, Register, Constant, Mux, Or } from '../../std/index.js';
import type { CircuitLibrary } from '../../types/circuit.js';
import { synthesizeVerilog, hasSynth } from './synth.js';

function buildCounter() {
  const Counter = circuit('Counter', {
    inputs: { enable: bit, clear: bit },
    outputs: { count: bus(8) },
    nodes: {
      reg: Register,
      add: Adder,
      one: Constant,
      zero: Constant,
      mux: Mux,
      weOr: Or,
    },
    nodeArgs: {
      one: { value: 1 },
      zero: { value: 0 },
    },
    connect: ({ inputs, outputs, nodes: { reg, add, one, zero, mux, weOr } }) => [
      reg.q.to(add.a, outputs.count),
      one.out.to(add.b),
      zero.out.to(add.carry_in, mux.in1),
      add.sum.to(mux.in0),
      inputs.clear.to(mux.sel, weOr.a),
      inputs.enable.to(weOr.b),
      weOr.out.to(reg.we),
      mux.out.to(reg.data),
    ],
  });

  const lib: CircuitLibrary = {
    resolveCircuit: (name) => {
      if (name === 'Counter') return Counter.circuit;
      return Counter._dependencies.get(name)?.circuit;
    },
    getAllPrimitiveNames: () => [...Counter._dependencies.keys()],
  };

  return { circuit: Counter.circuit, lib };
}

const d = describe.skipIf(!hasSynth());

d('Counter (Register+Adder+Mux+Or) — Yosys synthesis', () => {
  it('synthesizes cleanly and includes sequential (DFF) cells', { timeout: 30000 }, async () => {
    const { circuit, lib } = buildCounter();
    const result = exportVerilog(circuit, lib, { target: 'synthesis' });

    const resp = await synthesizeVerilog(result, 'Counter');

    if (!resp.success) {
      // eslint-disable-next-line no-console
      console.error('synth response:', JSON.stringify(resp, null, 2));
    }

    expect(resp.success).toBe(true);
    expect(resp.stats).toBeDefined();
    expect(resp.stats!.cells).toBeGreaterThan(0);
    expect(resp.netlist).toBeTruthy();

    // The counter has a Register — Yosys must produce at least one DFF cell.
    const dffCells = Object.entries(resp.stats!.cellBreakdown)
      .filter(([name]) => name.includes('DFF') || name.includes('dff'))
      .reduce((sum, [, count]) => sum + count, 0);

    expect(dffCells).toBeGreaterThan(0);
  });
});

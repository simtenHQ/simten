/**
 * HalfAdder synthesis smoke test.
 *
 * The simplest possible combinational circuit — two gates — proves that
 * exportVerilog with target:'synthesis' produces Verilog Yosys accepts, and
 * that the returned stats match what we'd expect from first principles.
 */

import { describe, expect, it } from 'vitest';
import { libraryOf } from '../../circuit/behavior.js';
import { bit, circuit } from '../../circuit/index.js';
import { internalsOf } from '../../circuit/internals.js';
import { And, Xor } from '../../std/index.js';
import { getStdLibrary } from '../../std/library.js';
import { exportVerilogFromIR } from '../exporter.js';
import { hasSynth, synthesizeVerilog } from './synth.js';

function buildHalfAdder() {
  const HalfAdder = circuit('HalfAdder', {
    inputs: { a: bit, b: bit },
    outputs: { sum: bit, carry: bit },
    nodes: { x: Xor, a: And },
    connect: ({ inputs, outputs, nodes: { x, a } }) => [
      inputs.a.to(x.a, a.a),
      inputs.b.to(x.b, a.b),
      x.out.to(outputs.sum),
      a.out.to(outputs.carry),
    ],
  });

  const definitions = libraryOf(HalfAdder).definitions;

  return { circuit: internalsOf(HalfAdder).ir, definitions };
}

const d = describe.skipIf(!hasSynth());

d('HalfAdder — Yosys synthesis', () => {
  it('synthesizes cleanly and maps to 2 cells (AND + XOR)', { timeout: 30000 }, async () => {
    const { circuit, definitions } = buildHalfAdder();
    const result = exportVerilogFromIR(
      circuit,
      { definitions: definitions, behaviors: getStdLibrary().behaviors },
      { target: 'synthesis' },
    );

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

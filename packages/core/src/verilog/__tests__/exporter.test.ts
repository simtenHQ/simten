/**
 * Verilog Exporter Tests
 *
 * Verifies that circuits defined with circuit() can be exported to Verilog.
 */

import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import { And, Or, Xor, Not, Adder, Register, DFlipFlop } from '../../std/index.js';
import { createStdLibrary } from '../../std/index.js';

function libraryFor(c: { circuit: any; _dependencies: ReadonlyMap<string, any> }) {
  const lib = createStdLibrary();
  lib.addCircuit(c.circuit);
  for (const [, dep] of c._dependencies) lib.addCircuit(dep);
  return lib;
}

describe('exportVerilog', () => {
  it('exports a half adder', () => {
    const HalfAdder = circuit('HalfAdder', {
      in: { a: bit, b: bit },
      out: { sum: bit, carry: bit },
      nodes: { x1: Xor, a1: And },
      connect: ({ in: inp, out, x1, a1 }) => [
        inp.a.to(x1.a, a1.a),
        inp.b.to(x1.b, a1.b),
        x1.out.to(out.sum),
        a1.out.to(out.carry),
      ],
    });

    const verilog = exportVerilog(HalfAdder.circuit, libraryFor(HalfAdder));

    expect(verilog).toContain('module HalfAdder');
    expect(verilog).toContain('input');
    expect(verilog).toContain('output');
    expect(verilog).toContain('endmodule');
  });

  it('exports a full adder built from half adders', () => {
    const HalfAdder = circuit('HalfAdder', {
      in: { a: bit, b: bit },
      out: { sum: bit, carry: bit },
      nodes: { x1: Xor, a1: And },
      connect: ({ in: inp, out, x1, a1 }) => [
        inp.a.to(x1.a, a1.a),
        inp.b.to(x1.b, a1.b),
        x1.out.to(out.sum),
        a1.out.to(out.carry),
      ],
    });

    const FullAdder = circuit('FullAdder', {
      in: { a: bit, b: bit, cin: bit },
      out: { sum: bit, cout: bit },
      nodes: { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
      connect: ({ in: inp, out, ha1, ha2, or1 }) => [
        inp.a.to(ha1.a),
        inp.b.to(ha1.b),
        ha1.sum.to(ha2.a),
        inp.cin.to(ha2.b),
        ha2.sum.to(out.sum),
        ha1.carry.to(or1.a),
        ha2.carry.to(or1.b),
        or1.out.to(out.cout),
      ],
    });

    const verilog = exportVerilog(FullAdder.circuit, libraryFor(FullAdder));

    expect(verilog).toContain('module FullAdder');
    expect(verilog).toContain('endmodule');
  });

  it('exports a circuit with bus ports', () => {
    const BusPassthrough = circuit('BusPassthrough', {
      in: { data: bus(8) },
      out: { data_out: bus(8) },
      nodes: {},
      connect: ({ in: inp, out }) => [
        inp.data.to(out.data_out),
      ],
    });

    const verilog = exportVerilog(BusPassthrough.circuit, libraryFor(BusPassthrough));

    expect(verilog).toContain('module BusPassthrough');
    expect(verilog).toContain('[7:0]');
  });
});

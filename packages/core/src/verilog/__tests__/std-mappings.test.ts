/**
 * Hand-written Verilog mappings apply only to std's own primitives (#488).
 *
 * The exporter has hand-written Verilog for std primitives by name (`Adder`,
 * `Mux`, `Xor`, ...). A user circuit can take one of those names for something
 * else, and used to export as std's logic with no error. Whether a node is
 * std's is decided by its behavior, not its name, on both export paths.
 */

import { describe, expect, it } from 'vitest';
import { libraryOf } from '../../circuit/behavior.js';
import { bit, bus, circuit } from '../../circuit/index.js';
import { internalsOf } from '../../circuit/internals.js';
import { Adder, Combiner, Mux, Splitter, Xor } from '../../std/index.js';
import { exportVerilog, exportVerilogFromIR } from '../exporter.js';

/** A user `Adder` with std's ports that subtracts instead. */
const MyAdder = circuit('Adder', {
  inputs: { a: bus(8), b: bus(8), carry_in: bit },
  outputs: { sum: bus(8), carry_out: bit },
  eval: ({ a, b }) => ({ sum: (a - b) & 0xff, carry_out: 0 }),
});

/** A user `Xor` whose eval the exporter can't translate. */
const MyXor = circuit('Xor', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  eval: ({ a, b }) => ({ out: Math.max(a, b) }),
});

const addTop = (adder: typeof MyAdder, width = 8) =>
  circuit('AddTop', {
    inputs: { a: bus(width), b: bus(width), cin: bit },
    outputs: { sum: bus(width), cout: bit },
    nodes: { add: adder },
    connect: ({ inputs, outputs, nodes: { add } }) => [
      inputs.a.to(add.a),
      inputs.b.to(add.b),
      inputs.cin.to(add.carry_in),
      add.sum.to(outputs.sum),
      add.carry_out.to(outputs.cout),
    ],
  });

const xorTop = (xor: typeof Xor) =>
  circuit('XorTop', {
    inputs: { a: bit, b: bit },
    outputs: { out: bit },
    nodes: { x: xor },
    connect: ({ inputs, outputs, nodes: { x } }) => [
      inputs.a.to(x.a),
      inputs.b.to(x.b),
      x.out.to(outputs.out),
    ],
  });

const STD_ADDER_LINE = 'assign {w_add_carry_out, w_add_sum} = a + b + cin;';

describe("hand-written mappings apply only to std's own primitives", () => {
  describe('exportVerilog(top)', () => {
    it("translates a user Adder from its own eval, not as std's Adder", () => {
      const { verilog, unsupported } = exportVerilog(addTop(MyAdder));
      expect(unsupported).toBeUndefined();
      expect(verilog).not.toContain(STD_ADDER_LINE);
      expect(verilog).toContain(
        "assign w_add_sum = (($signed({1'b0, a}) - $signed({1'b0, b})) & 255);",
      );
      expect(verilog).toContain('assign w_add_carry_out = 0;');
    });

    it('reports a user Xor it cannot translate instead of using std logic', () => {
      const { verilog, unsupported } = exportVerilog(xorTop(MyXor));
      expect(unsupported).toEqual({ Xor: ['x'] });
      expect(verilog).not.toContain('a ^ b');
    });
  });

  describe('exportVerilogFromIR', () => {
    it("translates a user Adder from the library's behavior", () => {
      const top = addTop(MyAdder);
      const { verilog, unsupported } = exportVerilogFromIR(internalsOf(top).ir, libraryOf(top));
      expect(unsupported).toBeUndefined();
      expect(verilog).not.toContain(STD_ADDER_LINE);
      expect(verilog).toContain(
        "assign w_add_sum = (($signed({1'b0, a}) - $signed({1'b0, b})) & 255);",
      );
    });
  });

  describe("std's own primitives keep their mappings", () => {
    it.each([8, 16, 32])('Adder w%i', (width) => {
      const { verilog, unsupported } = exportVerilog(addTop(Adder({ width }), width));
      expect(unsupported).toBeUndefined();
      expect(verilog).toContain(STD_ADDER_LINE);
    });

    it('Xor', () => {
      expect(exportVerilog(xorTop(Xor)).verilog).toContain('assign w_x_out = a ^ b;');
    });

    it('Mux', () => {
      const top = circuit('MuxTop', {
        inputs: { a: bus(8), b: bus(8), s: bit },
        outputs: { y: bus(8) },
        nodes: { m: Mux({ width: 8 }) },
        connect: ({ inputs, outputs, nodes: { m } }) => [
          inputs.a.to(m.in0),
          inputs.b.to(m.in1),
          inputs.s.to(m.sel),
          m.out.to(outputs.y),
        ],
      });
      expect(exportVerilog(top).verilog).toContain('assign w_m_out = s ? b : a;');
    });

    it('Splitter and Combiner at a width the std library does not hold', () => {
      const top = circuit('BitsTop', {
        inputs: { a: bus(4) },
        outputs: { y: bus(4) },
        nodes: { s: Splitter({ width: 4 }), c: Combiner({ width: 4 }) },
        connect: ({ inputs, outputs, nodes: { s, c } }) => [
          inputs.a.to(s.in),
          s.bit0.to(c.bit1),
          s.bit1.to(c.bit0),
          s.bit2.to(c.bit2),
          s.bit3.to(c.bit3),
          c.out.to(outputs.y),
        ],
      });
      const { verilog, unsupported } = exportVerilog(top);
      expect(unsupported).toBeUndefined();
      expect(verilog).toContain('assign w_s_bit0 = a[0];');
    });
  });
});

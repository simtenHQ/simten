import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { compileDSL } from '../../dsl/index.js';
import { createComponentLibrary, PRIMITIVES } from '../../simulator/index.js';
import type { ComponentLibrary } from '../../types/simulator.js';

function compile(dsl: string): { circuit: ReturnType<typeof compileDSL>['circuits'][0]; library: ComponentLibrary } {
  const library = createComponentLibrary([...PRIMITIVES]);
  const result = compileDSL(dsl, library as any, 'test.dsl');
  if (result.errors.length > 0) {
    throw new Error(`DSL compilation failed: ${result.errors.map(e => e.message).join('; ')}`);
  }
  return { circuit: result.circuits[result.circuits.length - 1], library };
}

describe('Verilog exporter', () => {
  it('exports a combinational half adder', () => {
    const { circuit, library } = compile(`
      circuit HalfAdder {
        input a: Bit
        input b: Bit
        output sum: Bit
        output carry: Bit
        impl {
          node xor1: Xor
          node and1: And
          connect a -> xor1.a
          connect b -> xor1.b
          connect xor1.out -> sum
          connect a -> and1.a
          connect b -> and1.b
          connect and1.out -> carry
        }
      }
    `);

    const verilog = exportVerilog(circuit, library);

    // Should contain module declaration
    expect(verilog).toContain('module HalfAdder');
    expect(verilog).toContain('endmodule');

    // Should contain XOR and AND assignments
    expect(verilog).toMatch(/assign\s+\S+\s*=\s*\S+\s*\^\s*\S+/); // XOR
    expect(verilog).toMatch(/assign\s+\S+\s*=\s*\S+\s*&\s*\S+/); // AND

    // Should have input and output ports
    expect(verilog).toContain('input');
    expect(verilog).toContain('output');

    // Should not contain clock (purely combinational)
    expect(verilog).not.toContain('posedge');
  });

  it('exports a sequential counter with clock', () => {
    const { circuit, library } = compile(`
      circuit Counter {
        clock clk
        output q: Bit
        impl {
          node dff: DFlipFlop
          node inv: Not
          connect dff.q -> inv.in
          connect inv.out -> dff.d
          connect clk -> dff.clk
          connect dff.q -> q
        }
      }
    `);

    const verilog = exportVerilog(circuit, library);

    // Should contain clock input
    expect(verilog).toContain('input clk');

    // Should contain always block with posedge
    expect(verilog).toContain('always @(posedge clk)');

    // Should use non-blocking assignment
    expect(verilog).toContain('<=');

    // Should contain reg declaration
    expect(verilog).toContain('reg ');
  });

  it('exports a 32-bit adder with bus widths', () => {
    const { circuit, library } = compile(`
      circuit Adder32 {
        input a: Bus[32]
        input b: Bus[32]
        output sum: Bus[32]
        impl {
          node gnd: Constant(value=0)
          node add: Adder(width=32)
          connect a -> add.a
          connect b -> add.b
          connect gnd.out -> add.carry_in
          connect add.sum -> sum
        }
      }
    `);

    const verilog = exportVerilog(circuit, library);

    // Should have 32-bit port declarations
    expect(verilog).toContain('[31:0]');

    // Should contain addition
    expect(verilog).toMatch(/assign.*=.*\+.*\+/); // a + b + carry_in
  });

  it('exports a circuit with Constant values', () => {
    const { circuit, library } = compile(`
      circuit ConstDemo {
        output val: Bus[8]
        impl {
          node c: Constant(value=42, width=8)
          connect c.out -> val
        }
      }
    `);

    const verilog = exportVerilog(circuit, library);

    // Should contain constant assignment
    expect(verilog).toContain("8'd42");
  });

  it('includes timescale by default', () => {
    const { circuit, library } = compile(`
      circuit Simple {
        input a: Bit
        output b: Bit
        impl {
          node buf: Buffer
          connect a -> buf.in
          connect buf.out -> b
        }
      }
    `);

    const verilog = exportVerilog(circuit, library);
    expect(verilog).toContain('`timescale 1ns / 1ps');
  });

  it('omits timescale when disabled', () => {
    const { circuit, library } = compile(`
      circuit Simple {
        input a: Bit
        output b: Bit
        impl {
          node buf: Buffer
          connect a -> buf.in
          connect buf.out -> b
        }
      }
    `);

    const verilog = exportVerilog(circuit, library, { includeTimescale: false });
    expect(verilog).not.toContain('`timescale');
  });

  it('handles Mux correctly', () => {
    const { circuit, library } = compile(`
      circuit MuxDemo {
        input a: Bit
        input b: Bit
        input sel: Bit
        output out: Bit
        impl {
          node mux: Mux
          connect a -> mux.in0
          connect b -> mux.in1
          connect sel -> mux.sel
          connect mux.out -> out
        }
      }
    `);

    const verilog = exportVerilog(circuit, library);
    expect(verilog).toMatch(/assign.*=.*\?.*:/); // ternary
  });

  it('handles BitSlice correctly', () => {
    const { circuit, library } = compile(`
      circuit SliceDemo {
        input val: Bus[8]
        output nibble: Bus[4]
        impl {
          node slice: BitSlice(low=0, high=3)
          connect val -> slice.in
          connect slice.out -> nibble
        }
      }
    `);

    const verilog = exportVerilog(circuit, library);
    expect(verilog).toContain('[3:0]');
  });
});

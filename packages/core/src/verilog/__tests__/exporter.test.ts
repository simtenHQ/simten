/**
 * Verilog Exporter Tests
 *
 * Verifies that circuits defined with circuit() can be exported to Verilog.
 */

import { describe, expect, it } from 'vitest';
import { libraryOf } from '../../circuit/behavior.js';
import type { Circuit } from '../../circuit/builder-types.js';
import { bit, bus, circuit } from '../../circuit/index.js';
import { internalsOf } from '../../circuit/internals.js';
import type { BitType, BusType, CircuitDefinitions, CircuitIR } from '../../ir/circuit-ir.js';
import { And, DFlipFlop, LogicNot, Or, RAM, Register, ROM, Xor } from '../../std/index.js';
import { getStdLibrary, stdBehaviorsFor } from '../../std/library.js';
import { checkSynthesizable, exportVerilog, exportVerilogFromIR } from '../exporter.js';

describe('exportVerilog', () => {
  it('exports a half adder', () => {
    const HalfAdder = circuit('HalfAdder', {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { x1: Xor, a1: And },
      connect: ({ inputs, outputs, nodes: { x1, a1 } }) => [
        inputs.a.to(x1.a, a1.a),
        inputs.b.to(x1.b, a1.b),
        x1.out.to(outputs.sum),
        a1.out.to(outputs.carry),
      ],
    });

    const { verilog } = exportVerilog(HalfAdder);

    expect(verilog).toContain('module HalfAdder');
    expect(verilog).toContain('input');
    expect(verilog).toContain('output');
    expect(verilog).toContain('endmodule');
  });

  it('exports a full adder built from half adders', () => {
    const HalfAdder = circuit('HalfAdder', {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { x1: Xor, a1: And },
      connect: ({ inputs, outputs, nodes: { x1, a1 } }) => [
        inputs.a.to(x1.a, a1.a),
        inputs.b.to(x1.b, a1.b),
        x1.out.to(outputs.sum),
        a1.out.to(outputs.carry),
      ],
    });

    const FullAdder = circuit('FullAdder', {
      inputs: { a: bit, b: bit, cin: bit },
      outputs: { sum: bit, cout: bit },
      nodes: { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
      connect: ({ inputs, outputs, nodes: { ha1, ha2, or1 } }) => [
        inputs.a.to(ha1.a),
        inputs.b.to(ha1.b),
        ha1.sum.to(ha2.a),
        inputs.cin.to(ha2.b),
        ha2.sum.to(outputs.sum),
        ha1.carry.to(or1.a),
        ha2.carry.to(or1.b),
        or1.out.to(outputs.cout),
      ],
    });

    const { verilog } = exportVerilog(FullAdder);

    expect(verilog).toContain('module FullAdder');
    expect(verilog).toContain('endmodule');
  });

  it('exports a circuit with bus ports', () => {
    const BusPassthrough = circuit('BusPassthrough', {
      inputs: { data: bus(8) },
      outputs: { data_out: bus(8) },
      nodes: {},
      connect: ({ inputs, outputs }) => [inputs.data.to(outputs.data_out)],
    });

    const { verilog } = exportVerilog(BusPassthrough);

    expect(verilog).toContain('module BusPassthrough');
    expect(verilog).toContain('[7:0]');
  });

  // ── Memory init emission ──────────────────────────────────────────
  describe('memory initial-data emission', () => {
    it('omits initial block when memory has no preloaded data', () => {
      const Plain = circuit('PlainRAM', {
        inputs: { addr: bus(8), data_in: bus(8), we: bit },
        outputs: { data_out: bus(8) },
        nodes: { r: RAM() },
        connect: ({ inputs, outputs, nodes: { r } }) => [
          inputs.addr.to(r.addr),
          inputs.data_in.to(r.data_in),
          inputs.we.to(r.we),
          r.data_out.to(outputs.data_out),
        ],
      });

      const { verilog } = exportVerilog(Plain);
      expect(verilog).not.toMatch(/initial begin\s+mem_/);
    });

    it('emits sorted, zero-padded hex memory init when state.initialValue.data is populated', () => {
      // Exercise the declarative-state path (`collectStateInits`) by
      // constructing a library where the RAM primitive has preloaded
      // initial data. This mirrors what a user would get from
      // `mem(depth, width, initialMap)` in a real circuit definition.
      const RamUser = circuit('RamUser', {
        inputs: { addr: bus(8), data_in: bus(8), we: bit },
        outputs: { data_out: bus(8) },
        nodes: { r: RAM() },
        connect: ({ inputs, outputs, nodes: { r } }) => [
          inputs.addr.to(r.addr),
          inputs.data_in.to(r.data_in),
          inputs.we.to(r.we),
          r.data_out.to(outputs.data_out),
        ],
      });

      // Build a custom library with preloaded RAM state (deliberately
      // out-of-order to verify we sort on emission).
      const ramDefWithData: CircuitIR = {
        ...internalsOf(RAM()).ir,
        state: [
          {
            ...internalsOf(RAM()).ir.state[0],
            initialValue: {
              data: { 2: 0xab, 0: 0xcd, 1: 0xef },
              addressWidth: 8,
              dataWidth: 8,
            },
          },
        ],
      };
      const circuitMap = new Map<string, CircuitIR>([
        [RamUser.name, internalsOf(RamUser).ir],
        ['RAM', ramDefWithData],
      ]);
      const definitions: CircuitDefinitions = {
        resolveCircuit: (name) => circuitMap.get(name),
        getAllPrimitiveNames: () => ['RAM'],
      };

      const { verilog } = exportVerilogFromIR(internalsOf(RamUser).ir, {
        definitions: definitions,
        behaviors: getStdLibrary().behaviors,
      });
      const initSection = verilog.match(/initial begin[\s\S]*?end/)?.[0] ?? '';
      // Sorted ascending by address
      expect(initSection.indexOf('[0]')).toBeLessThan(initSection.indexOf('[1]'));
      expect(initSection.indexOf('[1]')).toBeLessThan(initSection.indexOf('[2]'));
      // Zero-padded 8-bit hex literals
      expect(initSection).toMatch(/\[0\] = 8'hcd/);
      expect(initSection).toMatch(/\[1\] = 8'hef/);
      expect(initSection).toMatch(/\[2\] = 8'hab/);
    });

    it('switches to $readmemh + sidecar hex file above the inline threshold', () => {
      // Build a library with a RAM whose state has > threshold entries
      // populated. Expect the exported Verilog to contain a $readmemh
      // directive and the returned `files` map to carry the hex payload.
      const RamUser = circuit('BigRam', {
        inputs: { addr: bus(8), data_in: bus(8), we: bit },
        outputs: { data_out: bus(8) },
        nodes: { r: RAM() },
        connect: ({ inputs, outputs, nodes: { r } }) => [
          inputs.addr.to(r.addr),
          inputs.data_in.to(r.data_in),
          inputs.we.to(r.we),
          r.data_out.to(outputs.data_out),
        ],
      });

      const bigData: Record<number, number> = {};
      // 10 entries is tiny, but we'll lower the threshold via export options
      // to force the $readmemh path — cheaper than populating 2048+ entries
      // for a unit test.
      for (let i = 0; i < 10; i++) bigData[i] = i * 3 + 1;

      const ramDefWithData: CircuitIR = {
        ...internalsOf(RAM()).ir,
        state: [
          {
            ...internalsOf(RAM()).ir.state[0],
            initialValue: { data: bigData, addressWidth: 8, dataWidth: 8 },
          },
        ],
      };
      const circuitMap = new Map<string, CircuitIR>([
        [RamUser.name, internalsOf(RamUser).ir],
        ['RAM', ramDefWithData],
      ]);
      const definitions: CircuitDefinitions = {
        resolveCircuit: (name) => circuitMap.get(name),
        getAllPrimitiveNames: () => ['RAM'],
      };

      const result = exportVerilogFromIR(
        internalsOf(RamUser).ir,
        { definitions: definitions, behaviors: getStdLibrary().behaviors },
        {
          inlineMemoryThreshold: 5, // force the big path
        },
      );

      expect(result.verilog).toMatch(/\$readmemh\("[^"]+\.hex",\s*mem_/);
      expect(Object.keys(result.files).length).toBe(1);

      // Hex file content: one word per line, sorted by address, 2 hex chars
      // (8-bit). Our init map: i -> i*3+1 for i in 0..9.
      const [filename, contents] = Object.entries(result.files)[0];
      expect(filename).toMatch(/\.hex$/);
      const lines = contents.trimEnd().split('\n');
      expect(lines.length).toBe(10);
      expect(lines[0]).toBe('01'); // i=0 → 0*3+1 = 1
      expect(lines[1]).toBe('04'); // i=1 → 4
      expect(lines[9]).toBe('1c'); // i=9 → 28 = 0x1c
    });

    it('emits rst_n port and reset arm on every sequential always-block', () => {
      // Sequential circuit exercising Register, DFlipFlop, and RAM in one
      // module so the test fails if any of the three reset-arm sites
      // regresses. (Pure-combinational circuits must NOT get rst_n — that
      // case is covered separately below.)
      const Mixed = circuit('Mixed', {
        inputs: { a: bit, b: bit, addr: bus(8), wdata: bus(8), we: bit },
        outputs: { d_q: bit, ram_q: bus(8) },
        nodes: { d: DFlipFlop(), r: Register({ width: 1 }), m: RAM() },
        connect: ({ inputs, outputs, nodes: { d, r, m } }) => [
          inputs.a.to(d.d),
          inputs.b.to(r.data),
          inputs.b.to(r.we),
          inputs.addr.to(m.addr),
          inputs.wdata.to(m.data_in),
          inputs.we.to(m.we),
          d.q.to(outputs.d_q),
          m.data_out.to(outputs.ram_q),
        ],
      });

      const { verilog } = exportVerilog(Mixed);

      // Module declares rst_n as a port.
      expect(verilog).toMatch(/input rst_n/);

      // Every `always @(posedge clk)` block has a reset arm — either an
      // `if (!rst_n)` reset-load (DFlipFlop, Register, RV32I_RegisterFile)
      // or a combined-guard write (RAM, DualPortRAM, RV32I_DataMem).
      const alwaysBlocks = verilog.match(/always @\(posedge clk\)[\s\S]*?end/g) ?? [];
      expect(alwaysBlocks.length).toBeGreaterThan(0);
      for (const block of alwaysBlocks) {
        const hasResetLoad = /if \(!rst_n\)/.test(block);
        const hasGuardedWrite = /&& rst_n/.test(block);
        expect(hasResetLoad || hasGuardedWrite).toBe(true);
      }
    });

    it('does not emit rst_n when no sequential primitives are present', () => {
      const Combo = circuit('Combo', {
        inputs: { a: bit, b: bit },
        outputs: { s: bit, c: bit },
        nodes: { x: Xor, a1: And },
        connect: ({ inputs, outputs, nodes: { x, a1 } }) => [
          inputs.a.to(x.a, a1.a),
          inputs.b.to(x.b, a1.b),
          x.out.to(outputs.s),
          a1.out.to(outputs.c),
        ],
      });
      const { verilog } = exportVerilog(Combo);
      expect(verilog).not.toMatch(/input rst_n/);
      expect(verilog).not.toMatch(/input clk/);
    });

    it('emits initial for stdlib ROM via factory memory arg', () => {
      const PreloadedROM = circuit('PreloadedROM', {
        inputs: { addr: bus(16) },
        outputs: { data_out: bus(8) },
        nodes: { r: ROM({ memory: { 0: 0xaa, 1: 0xbb } }) },
        connect: ({ inputs, outputs, nodes: { r } }) => [
          inputs.addr.to(r.addr),
          r.data_out.to(outputs.data_out),
        ],
      });

      const { verilog } = exportVerilog(PreloadedROM);
      expect(verilog).toMatch(/initial begin/);
      expect(verilog).toMatch(/mem_.*\[0\] = 8'd170/);
      expect(verilog).toMatch(/mem_.*\[1\] = 8'd187/);
    });
  });
});

describe("a user primitive's own behavior", () => {
  // Not in std and with no hand-written mapping, so only its own eval can
  // become Verilog. The exporter reads it from the circuit's library.
  const Majority = circuit('Majority3', {
    inputs: { a: bit, b: bit, c: bit },
    outputs: { out: bit },
    eval: ({ a, b, c }) => ({ out: (a & b) | (a & c) | (b & c) }),
  });
  const Voter = circuit('Voter', {
    inputs: { a: bit, b: bit, c: bit },
    outputs: { out: bit },
    nodes: { m: Majority },
    connect: ({ inputs, outputs, nodes: { m } }) => [
      inputs.a.to(m.a),
      inputs.b.to(m.b),
      inputs.c.to(m.c),
      m.out.to(outputs.out),
    ],
  });

  it('is translated by exportVerilog', () => {
    const { verilog, unsupported } = exportVerilog(Voter);
    expect(unsupported).toBeUndefined();
    expect(verilog).not.toContain('WARNING: Unsupported primitive');
    expect(verilog).toMatch(/assign .*&.*\|/);
  });

  it('passes checkSynthesizable', () => {
    expect(checkSynthesizable(Voter)).toEqual({ valid: true, errors: [] });
  });

  it('is named by checkSynthesizable when it cannot be translated', () => {
    const Parse = circuit('ParseDigit', {
      inputs: { a: bus(8) },
      outputs: { out: bus(8) },
      eval: ({ a }) => ({ out: Number.parseInt(String(a), 10) }),
    });
    const Top = circuit('ParseTop', {
      inputs: { a: bus(8) },
      outputs: { out: bus(8) },
      nodes: { p: Parse },
      connect: ({ inputs, outputs, nodes: { p } }) => [inputs.a.to(p.a), p.out.to(outputs.out)],
    });
    const { valid, errors } = checkSynthesizable(Top);
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((e) => e.startsWith('ParseDigit: '))).toBe(true);
  });
});

describe('an export from IR alone', () => {
  // LogicNot has no hand-written mapping, so its Verilog comes only from the
  // behavior passed in. The page has IR only and gets std's behavior from
  // `stdBehaviorsFor`.
  const top = (not: Circuit<{ a: BusType }, { out: BitType }>) =>
    circuit('NotTop', {
      inputs: { a: bus(8) },
      outputs: { out: bit },
      nodes: { n: not },
      connect: ({ inputs, outputs, nodes: { n } }) => [inputs.a.to(n.a), n.out.to(outputs.out)],
    });
  const exportIR = (built: Circuit, userNames: string[] = []) => {
    const { definitions } = libraryOf(built);
    const behaviors = stdBehaviorsFor(definitions, new Set(userNames));
    return exportVerilogFromIR(internalsOf(built).ir, { definitions, behaviors });
  };

  it("translates std's own primitive with std's behavior", () => {
    expect(exportIR(top(LogicNot())).unsupported).toBeUndefined();
  });

  it('reports a user primitive named like a std one instead of using std logic', () => {
    const MyNot = circuit('LogicNot', {
      inputs: { a: bus(8) },
      outputs: { out: bit },
      eval: ({ a }) => ({ out: a & 1 }),
    });
    expect(exportIR(top(MyNot)).unsupported).toEqual({ LogicNot: ['n'] });
  });

  it("gives no std behavior to a name the user's source defines", () => {
    expect(exportIR(top(LogicNot()), ['LogicNot']).unsupported).toEqual({ LogicNot: ['n'] });
  });

  it('reports a primitive with no behavior rather than borrowing std', () => {
    const built = top(LogicNot());
    const { definitions } = libraryOf(built);
    const result = exportVerilogFromIR(internalsOf(built).ir, {
      definitions,
      behaviors: new Map(),
    });
    expect(result.unsupported).toEqual({ LogicNot: ['n'] });
  });
});

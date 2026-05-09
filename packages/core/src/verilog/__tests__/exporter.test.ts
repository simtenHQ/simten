/**
 * Verilog Exporter Tests
 *
 * Verifies that circuits defined with circuit() can be exported to Verilog.
 */

import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { circuit, bit, bus, mem } from '../../circuit/index.js';
import { And, Or, Xor, Not, Adder, Register, DFlipFlop, ROM, RAM, DualPortRAM, RV32I_InstrMem } from '../../std/index.js';
import type { Circuit, CircuitLibrary } from '../../types/circuit.js';

function libraryFor(c: { circuit: any; _dependencies: ReadonlyMap<string, any> }) {
  const circuitMap = new Map<string, Circuit>();
  const lib: CircuitLibrary & { addCircuit(c: Circuit): void } = {
    resolveCircuit: (name) => circuitMap.get(name),
    getAllPrimitiveNames: () => [...circuitMap.entries()].filter(([, c]) => c.implementation.kind === 'primitive').map(([n]) => n),
    addCircuit: (c) => { circuitMap.set(c.name, c); },
  };
  lib.addCircuit(c.circuit);
  for (const [, dep] of c._dependencies) lib.addCircuit(dep.circuit ?? dep);
  return lib;
}

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

    const { verilog } = exportVerilog(HalfAdder.circuit, libraryFor(HalfAdder));

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

    const { verilog } = exportVerilog(FullAdder.circuit, libraryFor(FullAdder));

    expect(verilog).toContain('module FullAdder');
    expect(verilog).toContain('endmodule');
  });

  it('exports a circuit with bus ports', () => {
    const BusPassthrough = circuit('BusPassthrough', {
      inputs: { data: bus(8) },
      outputs: { data_out: bus(8) },
      nodes: {},
      connect: ({ inputs, outputs }) => [
        inputs.data.to(outputs.data_out),
      ],
    });

    const { verilog } = exportVerilog(BusPassthrough.circuit, libraryFor(BusPassthrough));

    expect(verilog).toContain('module BusPassthrough');
    expect(verilog).toContain('[7:0]');
  });

  // ── Memory init emission ──────────────────────────────────────────
  describe('memory initial-data emission', () => {
    it('omits initial block when memory has no preloaded data', () => {
      const Plain = circuit('PlainRAM', {
        inputs: { addr: bus(8), data_in: bus(8), we: bit },
        outputs: { data_out: bus(8) },
        nodes: { r: RAM },
        connect: ({ inputs, outputs, nodes: { r } }) => [
          inputs.addr.to(r.addr),
          inputs.data_in.to(r.data_in),
          inputs.we.to(r.we),
          r.data_out.to(outputs.data_out),
        ],
      });

      const { verilog } = exportVerilog(Plain.circuit, libraryFor(Plain));
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
        nodes: { r: RAM },
        connect: ({ inputs, outputs, nodes: { r } }) => [
          inputs.addr.to(r.addr),
          inputs.data_in.to(r.data_in),
          inputs.we.to(r.we),
          r.data_out.to(outputs.data_out),
        ],
      });

      // Build a custom library with preloaded RAM state (deliberately
      // out-of-order to verify we sort on emission).
      const ramDefWithData: Circuit = {
        ...RAM.circuit,
        state: [
          {
            ...RAM.circuit.state[0],
            initialValue: {
              data: new Map<number, number>([[2, 0xAB], [0, 0xCD], [1, 0xEF]]),
              addressWidth: 8,
              dataWidth: 8,
            },
          },
        ],
      };
      const circuitMap = new Map<string, Circuit>([
        [RamUser.circuit.name, RamUser.circuit],
        ['RAM', ramDefWithData],
      ]);
      const lib: CircuitLibrary = {
        resolveCircuit: (name) => circuitMap.get(name),
        getAllPrimitiveNames: () => ['RAM'],
      };

      const { verilog } = exportVerilog(RamUser.circuit, lib);
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
        nodes: { r: RAM },
        connect: ({ inputs, outputs, nodes: { r } }) => [
          inputs.addr.to(r.addr),
          inputs.data_in.to(r.data_in),
          inputs.we.to(r.we),
          r.data_out.to(outputs.data_out),
        ],
      });

      const bigData = new Map<number, number>();
      // 10 entries is tiny, but we'll lower the threshold via export options
      // to force the $readmemh path — cheaper than populating 2048+ entries
      // for a unit test.
      for (let i = 0; i < 10; i++) bigData.set(i, i * 3 + 1);

      const ramDefWithData: Circuit = {
        ...RAM.circuit,
        state: [
          {
            ...RAM.circuit.state[0],
            initialValue: { data: bigData, addressWidth: 8, dataWidth: 8 },
          },
        ],
      };
      const circuitMap = new Map<string, Circuit>([
        [RamUser.circuit.name, RamUser.circuit],
        ['RAM', ramDefWithData],
      ]);
      const lib: CircuitLibrary = {
        resolveCircuit: (name) => circuitMap.get(name),
        getAllPrimitiveNames: () => ['RAM'],
      };

      const result = exportVerilog(RamUser.circuit, lib, {
        inlineMemoryThreshold: 5, // force the big path
      });

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

    it('emits initial for stdlib ROM via nodeArgs.init (legacy path still works)', () => {
      const LegacyROM = circuit('LegacyROM', {
        inputs: { addr: bus(16) },
        outputs: { data_out: bus(8) },
        nodes: { r: ROM },
        nodeArgs: { r: { init: { 0: 0xAA, 1: 0xBB } } },
        connect: ({ inputs, outputs, nodes: { r } }) => [
          inputs.addr.to(r.addr),
          r.data_out.to(outputs.data_out),
        ],
      });

      const { verilog } = exportVerilog(LegacyROM.circuit, libraryFor(LegacyROM));
      expect(verilog).toMatch(/initial begin/);
      expect(verilog).toMatch(/mem_.*\[0\] = 8'd170/);
      expect(verilog).toMatch(/mem_.*\[1\] = 8'd187/);
    });
  });
});

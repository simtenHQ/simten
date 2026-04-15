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

    const { verilog } = exportVerilog(HalfAdder.circuit, libraryFor(HalfAdder));

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

    const { verilog } = exportVerilog(FullAdder.circuit, libraryFor(FullAdder));

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

    const { verilog } = exportVerilog(BusPassthrough.circuit, libraryFor(BusPassthrough));

    expect(verilog).toContain('module BusPassthrough');
    expect(verilog).toContain('[7:0]');
  });

  // ── Memory init emission ──────────────────────────────────────────
  describe('memory initial-data emission', () => {
    it('omits initial block when memory has no preloaded data', () => {
      const Plain = circuit('PlainRAM', {
        in: { addr: bus(8), data_in: bus(8), we: bit },
        out: { data_out: bus(8) },
        nodes: { r: RAM },
        connect: ({ in: inp, out, r }) => [
          inp.addr.to(r.addr),
          inp.data_in.to(r.data_in),
          inp.we.to(r.we),
          r.data_out.to(out.data_out),
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
        in: { addr: bus(8), data_in: bus(8), we: bit },
        out: { data_out: bus(8) },
        nodes: { r: RAM },
        connect: ({ in: inp, out, r }) => [
          inp.addr.to(r.addr),
          inp.data_in.to(r.data_in),
          inp.we.to(r.we),
          r.data_out.to(out.data_out),
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
        [RamUser.name, RamUser.circuit],
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
        in: { addr: bus(8), data_in: bus(8), we: bit },
        out: { data_out: bus(8) },
        nodes: { r: RAM },
        connect: ({ in: inp, out, r }) => [
          inp.addr.to(r.addr),
          inp.data_in.to(r.data_in),
          inp.we.to(r.we),
          r.data_out.to(out.data_out),
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
        [RamUser.name, RamUser.circuit],
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
        in: { addr: bus(16) },
        out: { data_out: bus(8) },
        nodes: { r: ROM },
        nodeArgs: { r: { init: { 0: 0xAA, 1: 0xBB } } },
        connect: ({ in: inp, out, r }) => [
          inp.addr.to(r.addr),
          r.data_out.to(out.data_out),
        ],
      });

      const { verilog } = exportVerilog(LegacyROM.circuit, libraryFor(LegacyROM));
      expect(verilog).toMatch(/initial begin/);
      expect(verilog).toMatch(/mem_.*\[0\] = 8'd170/);
      expect(verilog).toMatch(/mem_.*\[1\] = 8'd187/);
    });
  });
});

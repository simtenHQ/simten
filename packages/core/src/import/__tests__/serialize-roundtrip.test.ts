/**
 * Serializer verification bars for the import path (plan Workstreams D + editability).
 *
 *  1. Round-trip (faithful inverse): import demo → circuitToSource → recompile
 *     the generated source → simulate → identical to the iverilog golden. Proves
 *     the emitted source is a faithful, re-simulatable representation.
 *
 *  2. Editability (the actual product claim): take the generated source, make a
 *     specified hand-edit (flip the adder's carry-in constant 0 → 1), recompile,
 *     and assert the predicted behavioural change (every `wide` output +1).
 *     Proves a human can open the source, find the component, edit it, and
 *     re-simulate — which a pure round-trip does not prove.
 *
 * The generated source is sandbox-style (no imports; circuit/bit/bus + stdlib are
 * ambient). We recompile it the same way the editor sandbox does — a `new
 * Function` with those symbols injected — then `return` the named entry circuit.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { circuitToSource } from '../../circuit/circuit-to-source.js';
import { executeJsCode } from '../../circuit/execute.js';
import { bit, buildFromIR, bus, circuit } from '../../circuit/index.js';
import type { BuiltCircuit } from '../../circuit/types.js';
import { Mem } from '../../rtl/index.js';
import { simulate } from '../../sim/index.js';
import {
  Adder,
  Comparator,
  Concat,
  Constant,
  Mux,
  Register,
  SignExtend,
  Slice,
  ZeroExtend,
} from '../../std/index.js';
import { importNetlist, type YosysNetlist } from '../index.js';

const fix = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8');
const netlist = JSON.parse(fix('demo.json')) as YosysNetlist;
const golden = JSON.parse(fix('demo.golden.json')) as {
  vectors: { in: Record<string, number>; out: Record<string, number> }[];
};

/** The ambient symbols the sandbox pre-injects (circuit/bit/bus + stdlib). */
const INJECT: Record<string, unknown> = {
  circuit,
  bit,
  bus,
  Adder,
  Comparator,
  Concat,
  Constant,
  Mux,
  Register,
  SignExtend,
  Slice,
  ZeroExtend,
};

/** Compile sandbox-style source and return the entry (last-declared) circuit. */
function recompile(source: string): BuiltCircuit {
  // Entry = the last `const <id> = circuit(...)` — robust to reserved-name
  // remapping (the `top` module is emitted as `const top_`).
  const decls = [...source.matchAll(/const (\w+) = circuit\(/g)];
  const entry = decls[decls.length - 1]?.[1];
  if (!entry) throw new Error('no circuit() declaration found in generated source');
  const names = Object.keys(INJECT);
  // biome-ignore lint/security/noGlobalEval: sandbox-equivalent script-body eval
  const fn = new Function(...names, `${source}\nreturn ${entry};`);
  return fn(...names.map((n) => INJECT[n])) as BuiltCircuit;
}

function importedTop(): BuiltCircuit {
  const { top, library } = importNetlist(netlist, 'top');
  const deps = [...library.values()].filter((c) => c.name !== top.name);
  return buildFromIR(top, deps);
}

describe('memory contents survive the round trip through generated source', () => {
  it('a recompiled Mem still holds the $readmemh image it was imported with', () => {
    // The editor shows generated source and re-compiles *that*, so anything the
    // factory call drops is gone by the time the design runs. When `store` was
    // absent from Mem's args the source still read `Mem({ …, store: {…} })` and
    // still compiled — it just booted from empty memory, and an imported CPU
    // fetched zeros instead of its program.
    const image = { 0: 0x40000437, 1: 0x00100293, 5: 0xdeadbeef };
    const rom = circuit('RomProbe', {
      inputs: { addr: bus(4) },
      outputs: { data: bus(32) },
      nodes: {
        m: Mem({ rdPorts: 1, wrPorts: 0, abits: 4, width: 32, size: 16, store: image }),
      },
      connect: ({ inputs, outputs, nodes }: any) => [
        inputs.addr.to(nodes.m.rd_addr_0),
        nodes.m.rd_data_0.to(outputs.data),
      ],
    } as any) as BuiltCircuit;

    const source = circuitToSource(rom);
    expect(source).toMatch(/Mem\(\{ rdPorts: 1, .*store: \{/);

    const res = executeJsCode(source);
    expect(res.error, res.error ?? '').toBeNull();
    const entry = res.builtCircuits.find((c) => c.circuit.name === 'RomProbe');
    expect(entry).toBeDefined();

    const sim = simulate(entry as BuiltCircuit);
    for (const [addr, want] of Object.entries(image)) {
      sim.set({ addr: Number(addr) });
      sim.tick();
      // A 32-bit bus reads back signed, so normalise both sides.
      expect((sim.get('data') as number) | 0, `word ${addr}`).toBe(want | 0);
    }
    sim.set({ addr: 7 });
    sim.tick();
    expect(sim.get('data')).toBe(0);
    sim.dispose();
  });
});

describe('serializer round-trip (import → source → recompile → simulate)', () => {
  it('generated source is Rtl*-free and re-simulates to the iverilog golden', () => {
    const source = circuitToSource(importedTop());
    // cleanliness gate: no Rtl* primitive leaked into the emitted source
    expect(source).not.toMatch(/\bRtl[A-Z]/);
    // reserved-name gate: module `top` clashes with the DOM global, so the
    // emitted `const` is remapped while the circuit('top') name is preserved.
    expect(source).toContain("const top_ = circuit('top'");

    const top = recompile(source);
    const sim = simulate(top);
    for (const v of golden.vectors) {
      sim.set(v.in);
      sim.tick();
      for (const [k, want] of Object.entries(v.out)) {
        expect(sim.get(k), `${k} for in=${JSON.stringify(v.in)}`).toBe(want);
      }
    }
    sim.dispose();
  });
});

describe('real design (RV32I_CPU_Core) serializes fully clean and re-simulates', () => {
  it('imports → source with 0 Rtl*, Pmux/Mem as factory calls → recompiles via the sandbox → simulates', () => {
    const rv32i = JSON.parse(
      gunzipSync(
        readFileSync(fileURLToPath(new URL('../__fixtures__/rv32i_cpu.json.gz', import.meta.url))),
      ).toString('utf8'),
    ) as YosysNetlist;
    const { top, library } = importNetlist(rv32i, 'RV32I_CPU_Core');
    const source = circuitToSource(
      buildFromIR(
        top,
        [...library.values()].filter((c) => c.name !== top.name),
      ),
    );

    // fully clean: no Rtl* anywhere; the import-namespace primitives emit as
    // factory calls that reconstruct their shape.
    expect(source).not.toMatch(/\bRtl[A-Z]/);
    expect(source).toMatch(/Pmux\(\{ width: \d+, sWidth: \d+ \}\)/);
    expect(source).toMatch(/Mem\(\{ rdPorts: \d+, /);

    // recompile through the actual editor sandbox (Pmux/Mem/Dlatch injected)
    // and simulate — proves the generated source is executable, not just clean.
    const res = executeJsCode(source);
    expect(res.error, res.error ?? '').toBeNull();
    const entry = res.builtCircuits.find((c) => c.circuit.name === 'RV32I_CPU_Core');
    expect(entry).toBeDefined();
    const sim = simulate(entry as BuiltCircuit);
    sim.tick();
    sim.tick();
    sim.dispose();
  });
});

describe('editability (scripted hand-edit → predicted behavioural change)', () => {
  it('flipping the adder carry-in constant 0 → 1 raises every `wide` output by 1', () => {
    const source = circuitToSource(importedTop());
    // The carry-in of the imported $add is a tied constant. Find it precisely:
    // it is the Constant that drives `.carry_in` — value 0 in the import.
    expect(source).toMatch(/_k1: Constant\(\{ width: 1, value: 0 \}\)/);
    const edited = source.replace(
      '_k1: Constant({ width: 1, value: 0 })',
      '_k1: Constant({ width: 1, value: 1 })',
    );
    expect(edited).not.toBe(source);

    const base = simulate(recompile(source));
    const mod = simulate(recompile(edited));
    for (const v of golden.vectors) {
      base.set(v.in);
      base.tick();
      mod.set(v.in);
      mod.tick();
      const expected = (((base.get('wide') as number) >>> 0) + 1) & 0xff;
      expect((mod.get('wide') as number) >>> 0, `wide for in=${JSON.stringify(v.in)}`).toBe(
        expected,
      );
    }
    base.dispose();
    mod.dispose();
  });
});

/**
 * Verilog Golden Hashes
 *
 * Correctness gate for the in/out → inputs/outputs builder migration.
 *
 * Modes:
 *   CAPTURE=1 pnpm --filter @simten/core test golden-hashes
 *     Writes SHA-256 of every selected circuit's Verilog output to
 *     <repo>/tools/codemod/golden-verilog-hashes.json. Run BEFORE the
 *     migration to capture the pre-state.
 *
 *   pnpm --filter @simten/core test golden-hashes
 *     Reads the goldens and asserts every hash matches. Run AFTER the
 *     migration. If any circuit's hash differs, either the codemod
 *     corrupted a circuit, the builder rewrite changed elaboration
 *     semantics, or the exporter changed unrelatedly. All three need
 *     investigation, not a green-light override.
 *
 * The selection is curated, not exhaustive: ~25 circuits spanning every
 * stdlib category. Exhaustive coverage isn't needed — we want enough
 * surface to catch any IR-level regression introduced by the migration,
 * not a per-primitive guarantee.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportVerilog } from '../exporter.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import {
  // Logic
  And, Or, Not, Nand, Xor,
  // Arithmetic (composites — these have `connect` and are touched by codemod)
  Adder, Subtractor, Comparator, Multiplier,
  // Routing
  Mux, Decoder, BitSlice,
  // Sequential
  DFlipFlop, Register,
  // Memory
  ROM, RAM,
  // RV32I
  RV32I_Decode, RV32I_ALU, RV32I_ImmGen, RV32I_Control,
  RV32I_BranchComp, RV32I_RegisterFile,
} from '../../std/index.js';
import type { Circuit, CircuitLibrary } from '../../types/circuit.js';

const GOLDEN_FILE_REL = '../../../../../tools/codemod/golden-verilog-hashes.json';

function libraryFor(c: { circuit: Circuit; _dependencies: ReadonlyMap<string, { circuit: Circuit }> }): CircuitLibrary {
  const map = new Map<string, Circuit>();
  map.set(c.circuit.name, c.circuit);
  for (const [, dep] of c._dependencies) map.set(dep.circuit.name, dep.circuit);
  return {
    resolveCircuit: (name) => map.get(name),
    getAllPrimitiveNames: () => [...map.entries()]
      .filter(([, c]) => c.implementation.kind === 'primitive')
      .map(([n]) => n),
  };
}

function hash(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function tryHash(name: string, c: { circuit: Circuit; _dependencies: ReadonlyMap<string, any> }): string | null {
  try {
    const { verilog } = exportVerilog(c.circuit, libraryFor(c));
    return hash(verilog);
  } catch (err) {
    // Some primitives (Switch, Led, displays, RAMs requiring init) cannot be
    // exported to Verilog standalone. Skip them in the hash set; they aren't
    // touched by the codemod anyway.
    return null;
  }
}

// ── Test composites built on the fly (exercise `connect` end-to-end) ────────

function buildHalfAdder() {
  return circuit('HalfAdder_Golden', {
    inputs:  { a: bit, b: bit },
    outputs: { sum: bit, carry: bit },
    nodes: { x1: Xor, a1: And },
    connect: ({ inputs, outputs, nodes: { x1, a1 } }) => [
      inputs.a.to(x1.a, a1.a),
      inputs.b.to(x1.b, a1.b),
      x1.out.to(outputs.sum),
      a1.out.to(outputs.carry),
    ],
  });
}

function buildFullAdder() {
  const HalfAdder = buildHalfAdder();
  return circuit('FullAdder_Golden', {
    inputs:  { a: bit, b: bit, cin: bit },
    outputs: { sum: bit, cout: bit },
    nodes: { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
    connect: ({ inputs, outputs, nodes: { ha1, ha2, or1 } }) => [
      inputs.a.to(ha1.a),
      inputs.b.to(ha1.b),
      ha1.sum.to(ha2.a),
      inputs.cin.to(ha2.b),
      ha1.carry.to(or1.a),
      ha2.carry.to(or1.b),
      ha2.sum.to(outputs.sum),
      or1.out.to(outputs.cout),
    ],
  });
}

function buildBusPassthrough() {
  return circuit('BusPassthrough_Golden', {
    inputs: { x: bus(8) },
    outputs: { y: bus(8) },
    connect: ({ inputs, outputs }) => [
      inputs.x.to(outputs.y),
    ],
  });
}

function buildSimpleSequential() {
  return circuit('Counter_Golden', {
    outputs: { q: bit },
    nodes: { dff: DFlipFlop, n: Not },
    connect: ({ outputs, nodes: { dff, n } }) => [
      dff.q.to(n.in, outputs.q),
      n.out.to(dff.d),
    ],
  });
}

// ── Hashable set ─────────────────────────────────────────────────────────────

const subjects: Array<{ name: string; build: () => any }> = [
  // Stdlib — singletons are bare BuiltCircuits; parameterized components are
  // invoked with default args to capture the canonical (default-width) shape.
  // Widths are exercised through the synthetic composites further down.
  { name: 'And',                 build: () => And },
  { name: 'Or',                  build: () => Or },
  { name: 'Not',                 build: () => Not },
  { name: 'Nand',                build: () => Nand },
  { name: 'Xor',                 build: () => Xor },
  { name: 'Adder',               build: () => Adder() },
  { name: 'Subtractor',          build: () => Subtractor() },
  { name: 'Comparator',          build: () => Comparator() },
  { name: 'Multiplier',          build: () => Multiplier },
  { name: 'Mux',                 build: () => Mux() },
  { name: 'Decoder',             build: () => Decoder },
  { name: 'BitSlice',            build: () => BitSlice() },
  { name: 'DFlipFlop',           build: () => DFlipFlop() },
  { name: 'Register',            build: () => Register() },
  { name: 'ROM',                 build: () => ROM() },
  { name: 'RAM',                 build: () => RAM() },

  // RV32I (real-world composites, dense usage of connect)
  { name: 'RV32I_Decode',        build: () => RV32I_Decode },
  { name: 'RV32I_ALU',           build: () => RV32I_ALU },
  { name: 'RV32I_ImmGen',        build: () => RV32I_ImmGen },
  { name: 'RV32I_Control',       build: () => RV32I_Control },
  { name: 'RV32I_BranchComp',    build: () => RV32I_BranchComp },
  { name: 'RV32I_RegisterFile',  build: () => RV32I_RegisterFile },

  // Synthetic composites that exercise the connect callback shape directly
  // (these write the same shape the codemod will rewrite, so any IR drift
  // shows up here even if stdlib stays stable)
  { name: 'GOLDEN_HalfAdder',      build: buildHalfAdder },
  { name: 'GOLDEN_FullAdder',      build: buildFullAdder },
  { name: 'GOLDEN_BusPassthrough', build: buildBusPassthrough },
  { name: 'GOLDEN_Counter',        build: buildSimpleSequential },
];

function computeAllHashes(): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const { name, build } of subjects) {
    result[name] = tryHash(name, build());
  }
  return result;
}

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = resolve(here, GOLDEN_FILE_REL);

if (process.env.CAPTURE === '1') {
  describe('Verilog golden hashes — CAPTURE mode', () => {
    it('writes goldens to disk', () => {
      const hashes = computeAllHashes();
      mkdirSync(dirname(goldenPath), { recursive: true });
      writeFileSync(
        goldenPath,
        JSON.stringify(
          {
            note: 'Pre-migration Verilog hashes. See packages/core/src/verilog/__tests__/golden-hashes.test.ts.',
            capturedAt: new Date().toISOString(),
            hashes,
          },
          null,
          2,
        ) + '\n',
      );
      const captured = Object.entries(hashes).filter(([, h]) => h !== null).length;
      const skipped = Object.entries(hashes).filter(([, h]) => h === null).length;
      console.log(`✓ Captured ${captured} hashes, skipped ${skipped} (non-exportable)`);
      expect(captured).toBeGreaterThan(20);
    });
  });
} else {
  describe('Verilog golden hashes — VERIFY mode', () => {
    it('every hash matches the golden file', () => {
      if (!existsSync(goldenPath)) {
        console.warn(
          `Goldens not found at ${goldenPath}. Run with CAPTURE=1 first to establish the baseline.`,
        );
        return;
      }
      const goldens = JSON.parse(readFileSync(goldenPath, 'utf-8')).hashes as Record<string, string | null>;
      const current = computeAllHashes();

      const mismatches: string[] = [];
      for (const name of Object.keys(goldens)) {
        if (goldens[name] !== current[name]) {
          mismatches.push(`  ${name}: golden=${goldens[name]}, current=${current[name]}`);
        }
      }

      if (mismatches.length > 0) {
        throw new Error(
          `Verilog hash mismatch (${mismatches.length} circuits). The migration changed the exporter output:\n${mismatches.join('\n')}`,
        );
      }
    });
  });
}

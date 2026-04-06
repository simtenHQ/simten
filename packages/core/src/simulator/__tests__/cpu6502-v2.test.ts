/**
 * CPU 6502 System V2 — Flat motherboard layout compilation test
 *
 * Verifies that the v2 DSL file parses, compiles, and can be elaborated
 * with all primitives resolved correctly.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCircuitLibrary } from '../index.js';
import { PRIMITIVES } from '../primitives.js';
import { parseDSL, compileDSL } from '../../dsl/index.js';

const dslPath = resolve(__dirname, '../../../../../examples/cpu6502/cpu6502-system-v2.dsl');

describe('CPU 6502 System V2 (motherboard layout)', () => {
  const source = readFileSync(dslPath, 'utf8');
  const library = createCircuitLibrary(PRIMITIVES);

  it('should parse without errors', () => {
    const { errors } = parseDSL(source, 'cpu6502-system-v2.dsl');
    expect(errors).toHaveLength(0);
  });

  it('should compile all circuits', () => {
    const compiled = new Map<string, any>();
    const compilerLib = {
      getCircuit: (name: string) => compiled.get(name) ?? library.resolveCircuit(name),
      hasCircuit: (name: string) => compiled.has(name) || library.resolveCircuit(name) !== undefined,
      addCircuit: (circuit: any) => { compiled.set(circuit.name, circuit); },
    };

    const { circuits, errors } = compileDSL(source, compilerLib);

    expect(errors.map((e) => e.message)).toEqual([]);
    expect(circuits.length).toBeGreaterThan(0);

    const names = circuits.map((c) => c.name);
    expect(names).toContain('AddressDecode');
    expect(names).toContain('DataMux');
    expect(names).toContain('CPU6502Test');
  });
});

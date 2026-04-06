import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportVerilog } from '../exporter.js';
import { parseDSL } from '../../dsl/parser/index.js';
import { compileToIR } from '../../dsl/compiler/index.js';
import { createCircuitLibrary, PRIMITIVES } from '../../simulator/index.js';
import type { Circuit } from '../../types/circuit.js';
import type { CircuitLibrary } from '../../types/simulator.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

function createMutableLibrary(): {
  compilerLib: { getCircuit: (name: string) => Circuit | undefined; hasCircuit: (name: string) => boolean; addCircuit: (c: Circuit) => void };
  simLib: CircuitLibrary;
} {
  const allCircuits = new Map<string, Circuit>();
  for (const p of PRIMITIVES) {
    allCircuits.set(p.name, p);
  }

  return {
    compilerLib: {
      getCircuit: (name: string) => allCircuits.get(name),
      hasCircuit: (name: string) => allCircuits.has(name),
      addCircuit: (circuit: Circuit) => { allCircuits.set(circuit.name, circuit); },
    },
    simLib: {
      resolveCircuit: (name: string) => allCircuits.get(name),
      getAllPrimitiveNames: () => Array.from(allCircuits.entries())
        .filter(([_, c]) => c.implementation.kind === 'primitive')
        .map(([name]) => name),
    },
  };
}

describe('Systolic3x3 Verilog export', () => {
  it('exports Systolic3x3_CounterBased to valid Verilog', () => {
    const source = readFileSync(resolve(repoRoot, 'dsl-files/Systolic3x3_CounterBased.dsl'), 'utf-8');
    const { compilerLib, simLib } = createMutableLibrary();

    const { ast, errors: parseErrors } = parseDSL(source, 'Systolic3x3_CounterBased.dsl');
    expect(parseErrors).toHaveLength(0);

    const circuits = compileToIR(ast, compilerLib);
    expect(circuits.length).toBeGreaterThanOrEqual(2);

    const sysCircuit = circuits.find(c => c.name === 'Systolic3x3_CounterBased');
    expect(sysCircuit).toBeDefined();
    const sysVerilog = exportVerilog(sysCircuit!, simLib);

    // Basic structural checks
    expect(sysVerilog).toContain('module Systolic3x3_CounterBased');
    expect(sysVerilog).toContain('endmodule');
    expect(sysVerilog).toContain('input clk');
    expect(sysVerilog).toContain('always @(posedge clk)');

    // Write to file for iverilog verification
    const outPath = resolve(repoRoot, 'dsl-files/Systolic3x3.v');
    writeFileSync(outPath, sysVerilog);
    console.log(`Verilog written to ${outPath} (${sysVerilog.length} chars)`);
  });
});

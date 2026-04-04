/**
 * Verify that DSL→TS conversion produces equivalent simulation output.
 *
 * Converts DSL files with the fixed generator (clean args), then runs
 * both versions through the simulator and compares port values.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDSL } from '../../dsl/parser/index.js';
import { compileDSL } from '../../dsl/index.js';
import { executeCircuitCode } from '../execute.js';
import {
  createSimulatorFromCircuit,
  createComponentLibrary,
  getPrimitives,
} from '../../simulator/index.js';
import type { Circuit } from '../../types/circuit.js';
import type { CircuitDef, ConnectionStmt, TypeExpr } from '../../dsl/types/ast.js';

const ROOT = join(__dirname, '..', '..', '..', '..', '..');

// ── Code generator (with clean args) ──

function dslToTS(dslSource: string): string {
  const { ast, errors } = parseDSL(dslSource, 'test.dsl');
  if (errors.length > 0) throw new Error(errors.map(e => e.message).join('; '));

  const lines: string[] = [];
  const definedNames = new Set(ast.circuits.map(c => c.name));

  for (const circuit of ast.circuits) {
    const ind = '  ';
    lines.push(`const ${circuit.name} = component('${circuit.name}')`);

    for (const input of circuit.inputs) {
      lines.push(`${ind}.in('${input.name}', ${typeToTS(input.portType)})`);
    }
    for (const output of circuit.outputs) {
      lines.push(`${ind}.out('${output.name}', ${typeToTS(output.portType)})`);
    }

    if (circuit.impl && circuit.impl.nodes.length > 0) {
      for (const node of circuit.impl.nodes) {
        const cleanArgs = node.arguments
          .map(a => ({ name: a.name, value: cleanArgValue(a.value) }))
          .filter(a => a.value !== undefined);
        if (cleanArgs.length > 0) {
          const argsStr = cleanArgs.map(a => `${a.name}: ${JSON.stringify(a.value)}`).join(', ');
          lines.push(`${ind}.node('${node.instanceName}', ${node.componentType}, { ${argsStr} })`);
        } else {
          lines.push(`${ind}.node('${node.instanceName}', ${node.componentType})`);
        }
      }
      if (circuit.impl.connections.length > 0) {
        const clockNames = new Set(circuit.clocks.map(c => c.name));
        const filtered = circuit.impl.connections.filter(c => {
          if (!c.source.nodeId && clockNames.has(c.source.portName)) return false;
          if (c.target.portName === 'clk') return false;
          return true;
        });
        const grouped = groupConns(filtered);
        const nodeNames = circuit.impl.nodes.map(n => n.instanceName).join(', ');
        lines.push(`${ind}.connect(({ in: inp, out, ${nodeNames} }) => [`);
        for (const g of grouped) {
          const src = fmtRef(g.source, circuit);
          const targets = g.targets.map(t => fmtRef(t, circuit)).join(', ');
          lines.push(`${ind}${ind}${src}.to(${targets}),`);
        }
        lines.push(`${ind}])`);
      }
    }
    lines.push(`${ind}.build()\n`);
  }
  return lines.join('\n');
}

function cleanArgValue(value: any): any {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'object' && value.kind === 'object' && Array.isArray(value.entries)) {
    const obj: Record<number, number> = {};
    for (const entry of value.entries) {
      obj[entry.key] = typeof entry.value === 'object' ? cleanArgValue(entry.value) : entry.value;
    }
    return obj;
  }
  if (typeof value === 'object' && value.kind === 'array' && Array.isArray(value.elements)) {
    return value.elements.map((e: any) => cleanArgValue(e));
  }
  return undefined;
}

function typeToTS(t: TypeExpr): string {
  if (t.kind === 'bit') return 'bit';
  if (t.kind === 'bus') {
    const w = typeof t.width === 'number' ? t.width : t.width.name;
    return `bus(${w})`;
  }
  return 'bit';
}

function groupConns(conns: ConnectionStmt[]) {
  const map = new Map<string, { source: any; targets: any[] }>();
  for (const c of conns) {
    const key = c.source.nodeId ? `${c.source.nodeId}.${c.source.portName}` : c.source.portName;
    if (!map.has(key)) map.set(key, { source: c.source, targets: [] });
    map.get(key)!.targets.push(c.target);
  }
  return Array.from(map.values());
}

function fmtRef(ref: { nodeId: string | null; portName: string }, circuit: CircuitDef): string {
  if (!ref.nodeId) {
    if (circuit.inputs.some(i => i.name === ref.portName)) return `inp.${ref.portName}`;
    if (circuit.outputs.some(o => o.name === ref.portName)) return `out.${ref.portName}`;
    return `inp.${ref.portName}`;
  }
  return `${ref.nodeId}.${ref.portName}`;
}

// ── Simulation ──

function runDSL(source: string, ticks: number) {
  const prims = getPrimitives();
  const all: Circuit[] = [...prims];
  const lib = {
    resolveComponent: (n: string) => all.find(c => c.name === n),
    getAllPrimitiveNames: () => prims.map(c => c.name),
    getCircuit: (n: string) => all.find(c => c.name === n),
    hasCircuit: (n: string) => all.some(c => c.name === n),
    addCircuit: (c: Circuit) => { all.push(c); },
  };
  const result = compileDSL(source, lib, 'test.dsl');
  if (result.errors.length > 0) throw new Error(result.errors.map(e => e.message).join('; '));
  const main = result.circuits[result.circuits.length - 1];
  const simLib = createComponentLibrary(all);
  const engine = createSimulatorFromCircuit(main, simLib);
  engine.runCombinational();
  const values: number[][] = [];
  for (let i = 0; i < ticks; i++) {
    engine.tick();
    values.push(
      Array.from(engine.getPortValues().values())
        .map(v => typeof v === 'boolean' ? (v ? 1 : 0) : v as number)
        .sort((a, b) => a - b)
    );
  }
  return values;
}

function runTS(source: string, ticks: number) {
  const result = executeCircuitCode(source);
  if (result.error) throw new Error(result.error);
  if (!result.circuit) throw new Error('No circuit');
  const engine = createSimulatorFromCircuit(result.circuit, result.library);
  engine.runCombinational();
  const values: number[][] = [];
  for (let i = 0; i < ticks; i++) {
    engine.tick();
    values.push(
      Array.from(engine.getPortValues().values())
        .map(v => typeof v === 'boolean' ? (v ? 1 : 0) : v as number)
        .sort((a, b) => a - b)
    );
  }
  return values;
}

// ── Tests ──

describe('conversion equivalence', () => {
  it('Counter.dsl → TS produces identical output', () => {
    const dsl = readFileSync(join(ROOT, 'dsl-files/Counter.dsl'), 'utf-8');
    const ts = dslToTS(dsl);
    const dslOut = runDSL(dsl, 10);
    const tsOut = runTS(ts, 10);
    for (let i = 0; i < 10; i++) {
      expect(tsOut[i]).toEqual(dslOut[i]);
    }
  });

  it('SimpleCombinational.dsl → TS produces identical output', () => {
    const dsl = readFileSync(join(ROOT, 'dsl-files/SimpleCombinational.dsl'), 'utf-8');
    const ts = dslToTS(dsl);
    const dslOut = runDSL(dsl, 5);
    const tsOut = runTS(ts, 5);
    for (let i = 0; i < 5; i++) {
      expect(tsOut[i]).toEqual(dslOut[i]);
    }
  });

  it('SnakeAdvanced.dsl → TS produces identical output', () => {
    const dsl = readFileSync(join(ROOT, 'dsl-files/SnakeAdvanced.dsl'), 'utf-8');
    const ts = dslToTS(dsl);
    const dslOut = runDSL(dsl, 20);
    const tsOut = runTS(ts, 20);
    for (let i = 0; i < 20; i++) {
      if (JSON.stringify(tsOut[i]) !== JSON.stringify(dslOut[i])) {
        // Find diffs
        const diffs: string[] = [];
        for (let j = 0; j < tsOut[i].length; j++) {
          if (tsOut[i][j] !== dslOut[i][j]) diffs.push(`[${j}] DSL=${dslOut[i][j]} TS=${tsOut[i][j]}`);
        }
        console.log(`Tick ${i}: ${diffs.length} diffs: ${diffs.slice(0, 5).join(', ')}`);
      }
      expect(tsOut[i]).toEqual(dslOut[i]);
    }
  });
});

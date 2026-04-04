/**
 * Verify that DSL→TS conversion produces equivalent simulation output.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { compileDSL } from '../../dsl/index.js';
import { parseDSL } from '../../dsl/parser/index.js';
import { executeCircuitCode } from '../execute.js';
import { generateTS } from './dsl-to-ts.test.js';
import {
  createSimulatorFromCircuit,
  createComponentLibrary,
  getPrimitives,
} from '../../simulator/index.js';
import type { Circuit } from '../../types/circuit.js';

const ROOT = join(__dirname, '..', '..', '..', '..', '..');

function dslToTS(dslSource: string): string {
  const { ast, errors } = parseDSL(dslSource, 'test.dsl');
  if (errors.length > 0) throw new Error(errors.map(e => e.message).join('; '));
  return generateTS(ast);
}

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

describe('conversion equivalence', () => {
  it('Counter.dsl → TS produces identical output', () => {
    const dsl = readFileSync(join(ROOT, 'dsl-files/Counter.dsl'), 'utf-8');
    const ts = dslToTS(dsl);
    const dslOut = runDSL(dsl, 10);
    const tsOut = runTS(ts, 10);
    for (let i = 0; i < 10; i++) expect(tsOut[i]).toEqual(dslOut[i]);
  });

  it('SimpleCombinational.dsl → TS produces identical output', () => {
    const dsl = readFileSync(join(ROOT, 'dsl-files/SimpleCombinational.dsl'), 'utf-8');
    const ts = dslToTS(dsl);
    const dslOut = runDSL(dsl, 5);
    const tsOut = runTS(ts, 5);
    for (let i = 0; i < 5; i++) expect(tsOut[i]).toEqual(dslOut[i]);
  });

  it('SnakeAdvanced.dsl → TS produces identical output', () => {
    const dsl = readFileSync(join(ROOT, 'dsl-files/SnakeAdvanced.dsl'), 'utf-8');
    const ts = dslToTS(dsl);
    const dslOut = runDSL(dsl, 20);
    const tsOut = runTS(ts, 20);
    for (let i = 0; i < 20; i++) expect(tsOut[i]).toEqual(dslOut[i]);
  });
});

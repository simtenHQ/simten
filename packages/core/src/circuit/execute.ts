/**
 * Circuit Code Execution Engine
 *
 * Executes TypeScript circuit code and extracts Circuit IR.
 * Uses sucrase for fast type stripping (microseconds).
 * Standard library is injected as scope — no imports needed.
 *
 * Usage:
 *   const result = executeCircuitCode(`
 *     const ha = circuit('HalfAdder', {
 *       inputs:  { a: bit, b: bit },
 *       outputs: { sum: bit, carry: bit },
 *       nodes:   { xor1: Xor, and1: And },
 *       connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
 *         inputs.a.to(xor1.a, and1.a),
 *         inputs.b.to(xor1.b, and1.b),
 *         xor1.out.to(outputs.sum),
 *         and1.out.to(outputs.carry),
 *       ],
 *     })
 *   `)
 *   result.circuit // → Circuit IR
 */

import { transform } from 'sucrase';
import { circuit } from './circuit.js';
import { bit, bus } from './bit-bus.js';
import type { BuiltCircuit } from './types.js';
import type { Circuit, CircuitLibrary } from '../types/circuit.js';
import * as std from '../std/index.js';

// ============================================================================
// Execution result
// ============================================================================

export interface ExecuteResult {
  /** The last/main circuit found in the code (built) */
  circuit: Circuit | null;
  /** All circuits found (if code defines multiple) */
  circuits: Circuit[];
  /** All BuiltCircuits found */
  builtCircuits: BuiltCircuit[];
  /** The circuit library (stdlib + user-defined circuits) */
  library: CircuitLibrary & { addCircuit(c: Circuit): void; getAllCircuitNames(): string[] };
  /** Error message if execution failed */
  error: string | null;
}

// ============================================================================
// Scope injection
// ============================================================================

/** Build the scope injected into user code as function arguments */
function buildScope(): { names: string[]; values: unknown[] } {
  const scope = new Map<string, unknown>();

  // Core circuit() API — inject both `circuit` (canonical) and `component` (backward compat)
  scope.set('circuit', circuit);
  scope.set('component', circuit);
  scope.set('bit', bit);
  scope.set('bus', bus);

  // All stdlib components (inject by name so user code can reference And, Or, etc.)
  for (const [, value] of Object.entries(std)) {
    if (value && typeof value === 'object' && 'name' in value && 'circuit' in value) {
      scope.set((value as BuiltCircuit).name, value);
    }
  }

  return {
    names: Array.from(scope.keys()),
    values: Array.from(scope.values()),
  };
}

let cachedScope: { names: string[]; values: unknown[] } | null = null;
function getScope() {
  if (!cachedScope) cachedScope = buildScope();
  return cachedScope;
}

// ============================================================================
// Type stripping
// ============================================================================

/**
 * Strip TypeScript type annotations from code, producing executable JavaScript.
 * Uses sucrase — fast (microseconds), handles all TS syntax.
 */
export function stripTypes(code: string): string {
  return transform(code, {
    transforms: ['typescript'],
    disableESTransforms: true,
  }).code;
}

// ============================================================================
// Execute
// ============================================================================

/**
 * Execute pre-stripped JavaScript circuit code with an optional extra scope.
 *
 * Lower-level than executeCircuitCode: accepts JS that has already been
 * type-stripped and has had import statements removed. Extra scope entries
 * (e.g. npm packages loaded via dynamic import) are merged with the stdlib
 * scope and made available as function parameters.
 *
 * @param jsCode - Plain JavaScript circuit code (no TypeScript, no imports)
 * @param extraScope - Additional names to inject alongside the stdlib scope
 * @returns Execution result with circuits and any error
 */
export function executeJsCode(jsCode: string, extraScope?: Record<string, unknown>): ExecuteResult {
  const { names, values } = getScope();

  const allNames = extraScope ? [...names, ...Object.keys(extraScope)] : names;
  const allValues = extraScope ? [...values, ...Object.values(extraScope)] : values;

  const circuitMap = new Map<string, Circuit>();
  const library: CircuitLibrary & { addCircuit(c: Circuit): void; getAllCircuitNames(): string[] } = {
    resolveCircuit: (name) => circuitMap.get(name),
    getAllPrimitiveNames: () => [...circuitMap.entries()].filter(([, c]) => c.implementation.kind === 'primitive').map(([n]) => n),
    addCircuit: (c) => { circuitMap.set(c.name, c); },
    getAllCircuitNames: () => [...circuitMap.keys()],
  };
  const builtCircuits: BuiltCircuit[] = [];
  const circuits: Circuit[] = [];

  try {
    // Wrap: intercept circuit()/component() calls to collect all created circuits
    const wrappedCode = `
      "use strict";
      const __collector = [];
      const __origCircuit = circuit;
      const __trackingCircuit = function(name, config) {
        const result = __origCircuit(name, config);
        __collector.push(result);
        return result;
      };
      {
        const circuit = __trackingCircuit;
        const component = __trackingCircuit;
        ${jsCode}
      }
      return __collector;
    `;

    const fn = new Function(...allNames, wrappedCode);
    const collected = fn(...allValues) as BuiltCircuit[];

    for (const built of collected) {
      if (built && built.circuit) {
        builtCircuits.push(built);
        circuits.push(built.circuit);
        library.addCircuit(built.circuit);
        // Add all transitive dependencies (stdlib + user-defined)
        if (built._dependencies) {
          for (const [, dep] of built._dependencies) {
            library.addCircuit(dep.circuit);
          }
        }
      }
    }

    return {
      circuit: circuits.length > 0 ? circuits[circuits.length - 1] : null,
      circuits,
      builtCircuits,
      library,
      error: null,
    };
  } catch (e) {
    return {
      circuit: null,
      circuits: [],
      builtCircuits: [],
      library,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Execute TypeScript circuit code and extract Circuit IR.
 *
 * The code is type-stripped, then run in a function scope with the
 * standard library injected. All component() calls are tracked and
 * the last one becomes the main circuit.
 *
 * @param code - TypeScript or JavaScript circuit code
 * @returns Execution result with circuits and any error
 */
export function executeCircuitCode(code: string): ExecuteResult {
  let stripped: string;
  try {
    stripped = stripTypes(code);
  } catch (e) {
    // sucrase parse failure — return an error result without running anything.
    // Reuse executeJsCode's empty-library shape by passing a no-op snippet.
    const empty = executeJsCode('');
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }
  return executeJsCode(stripped);
}


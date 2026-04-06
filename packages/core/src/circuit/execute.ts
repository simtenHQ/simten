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
 *       in: { a: bit, b: bit },
 *       out: { sum: bit, carry: bit },
 *       nodes: { x: Xor, a: And },
 *       connect: ({ in: inp, out, x, a }) => [
 *         inp.a.to(x.a, a.a),
 *         inp.b.to(x.b, a.b),
 *         x.out.to(out.sum),
 *         a.out.to(out.carry),
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
import { createStdLibrary, getAllStdCircuits } from '../std/index.js';

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
  library: CircuitLibrary & { addCircuit(c: Circuit): void };
  /** Error message if execution failed */
  error: string | null;
}

// ============================================================================
// Scope injection
// ============================================================================

/** Build the scope injected into user code as function arguments */
function buildScope(): { names: string[]; values: unknown[] } {
  const scope = new Map<string, unknown>();

  // Core builder API — inject both `circuit` (canonical) and `component` (backward compat)
  scope.set('circuit', circuit);
  scope.set('component', circuit);
  scope.set('bit', bit);
  scope.set('bus', bus);

  // All stdlib components
  for (const comp of getAllStdCircuits()) {
    scope.set(comp.name, comp);
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
  const { names, values } = getScope();
  const library = createStdLibrary();
  const builtCircuits: BuiltCircuit[] = [];
  const circuits: Circuit[] = [];

  try {
    // Strip TypeScript types → plain JavaScript
    const js = stripTypes(code);

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
        ${js}
      }
      return __collector;
    `;

    const fn = new Function(...names, wrappedCode);
    const collected = fn(...values) as BuiltCircuit[];

    for (const built of collected) {
      if (built && built.circuit) {
        builtCircuits.push(built);
        circuits.push(built.circuit);
        library.addCircuit(built.circuit);
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

/** @deprecated Use executeCircuitCode instead */
export const executeComponentCode = executeCircuitCode;

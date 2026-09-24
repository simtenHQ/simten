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
import { Dlatch, Mem, Pmux } from '../rtl/index.js';
import * as std from '../std/index.js';
import type { Circuit, CircuitLibrary } from '../types/circuit.js';
import { bit, bus, mem, reg } from './bit-bus.js';
import { circuit } from './circuit.js';
import type { BuiltCircuit } from './types.js';

// ============================================================================
// Execution result
// ============================================================================

export interface ExecuteResult {
  /** The last/main circuit found in the code (built) */
  circuit: Circuit | null;
  /** All circuits found (if code defines multiple) */
  circuits: Circuit[];
  /**
   * Circuits the code exported without defining, e.g. `export default FullAdder`.
   *
   * Kept apart from `circuits`, which means "constructed here" and is reported
   * as such by the MCP tools. Re-exporting a stdlib component defines nothing,
   * but it is a reasonable thing to want to look at, so a renderer can fall
   * back to this rather than reporting an empty source.
   */
  exportedCircuits: Circuit[];
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
  scope.set('reg', reg);
  scope.set('mem', mem);

  // All stdlib exports — circuits inject by their internal `name` (And, Or, …),
  // helper functions inject by their export name (romFromBytes, …).
  for (const [exportName, value] of Object.entries(std)) {
    if (value && typeof value === 'object' && 'circuit' in value) {
      scope.set((value as BuiltCircuit).circuit.name, value);
    } else if (typeof value === 'function') {
      scope.set(exportName, value);
    }
  }

  // Import-namespace factories — shape-named primitives that fall out of yosys
  // elaboration (a `case` → Pmux, inferred latch → Dlatch, `$mem_v2` → Mem).
  // Injected so generated source resolves them, but kept out of STDLIB_CIRCUITS
  // (so they don't appear in the docs component list).
  scope.set('Pmux', Pmux);
  scope.set('Mem', Mem);
  scope.set('Dlatch', Dlatch);

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

/**
 * Strip ES `import` statements from circuit code.
 *
 * Circuit code runs inside `new Function(...)` with the stdlib injected as scope
 * (see buildScope), so an `import` statement is both unnecessary and fatal —
 * `new Function` bodies can't contain `import` ("Cannot use import statement
 * outside a module"). Removing them lets a file carry real imports for the
 * benefit of editors / `tsc` / `tsx` (where `@simten/core` is a real package)
 * while still executing here against the injected scope. `@simten/core` symbols
 * resolve from scope; an unresolved import (e.g. an npm package) surfaces as a
 * normal ReferenceError rather than a cryptic syntax crash.
 *
 * Handles: `import x from 'm'`, `import {a, b} from 'm'` (incl. multiline),
 * `import * as ns from 'm'`, and side-effect `import 'm'` — single or double
 * quotes, optional trailing semicolon.
 */
export function stripImports(code: string): string {
  return code.replace(
    /^[ \t]*import\b[\s\S]*?(?:from[ \t]*['"][^'"]+['"]|['"][^'"]+['"])[ \t]*;?[ \t]*$/gm,
    '',
  );
}

/**
 * Strip ES `export` keywords from circuit code.
 *
 * Circuit files `export` their top-level circuit so a testbench (.verify.ts) can
 * `import` it under tsx/vitest. But the same file is also run via `new Function`
 * (executeJsCode — simulate, check, the web /circuit worker), whose body can't
 * contain `export`. We drop the `export` keyword (the `const`/`function` survives
 * and the circuit() call is still collected); `export { … }` re-export lines are
 * removed entirely. The tsx/import path keeps the real export.
 */
export function stripExports(code: string): string {
  return code
    .replace(/^[ \t]*export\s+\{[\s\S]*?\}[ \t]*(?:from[ \t]*['"][^'"]+['"])?[ \t]*;?[ \t]*$/gm, '')
    .replace(/^([ \t]*)export\s+default\s+/gm, '$1')
    .replace(/^([ \t]*)export\s+(?=(?:const|let|var|function|class|async)\b)/gm, '$1');
}

/**
 * Read an exported value as a component, or null if it is not one.
 *
 * Handles both shapes the stdlib exports: a built component (`FullAdder`) and
 * the factory a parameterised one is exported as (`Adder`, `Register`). The
 * factory is called with no arguments for its default instance, which is what
 * `nodes: { r: Register }` does too, so the diagram matches what wiring it up
 * would give you.
 */
function asBuiltCircuit(value: unknown): BuiltCircuit | null {
  const built = value as BuiltCircuit | undefined;
  if (built?.circuit?.name) return built;

  if (typeof value === 'function') {
    try {
      const made = (value as () => BuiltCircuit)();
      if (made?.circuit?.name) return made;
    } catch {
      // Not a component factory, or one that needs arguments. Nothing to show.
    }
  }
  return null;
}

/**
 * Names bound by top-level `export const|let|var|function|class` declarations.
 *
 * Read off the source before stripping, so the executed code can hand those
 * values back. Only used to recognise a re-exported component: `export default
 * FullAdder` defines no circuit, so without this the source looks empty.
 *
 * Deliberately a regex over the same lines `stripExports` rewrites, rather than
 * a parse. It runs on every keystroke in the editor, the shapes it has to catch
 * are the ones that survive stripping, and anything it misses simply falls back
 * to today's behaviour.
 */
function exportedNames(code: string): string[] {
  const names = new Set<string>();
  const decl =
    /^[ \t]*export\s+(?:const|let|var|function|class|async\s+function)\s+([A-Za-z_$][\w$]*)/gm;
  for (const m of code.matchAll(decl)) names.add(m[1]);

  // `export default <identifier>;` — an expression default (an inline
  // `circuit(...)` call) is already collected, so only a bare name matters.
  const def = /^[ \t]*export\s+default\s+([A-Za-z_$][\w$]*)[ \t]*;?[ \t]*$/m.exec(code);
  if (def) names.add(def[1]);

  return [...names];
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
  const library: CircuitLibrary & { addCircuit(c: Circuit): void; getAllCircuitNames(): string[] } =
    {
      resolveCircuit: (name) => circuitMap.get(name),
      getAllPrimitiveNames: () =>
        [...circuitMap.entries()]
          .filter(([, c]) => c.implementation.kind === 'primitive')
          .map(([n]) => n),
      addCircuit: (c) => {
        circuitMap.set(c.name, c);
      },
      getAllCircuitNames: () => [...circuitMap.keys()],
    };
  const builtCircuits: BuiltCircuit[] = [];
  const circuits: Circuit[] = [];
  const exportedCircuits: Circuit[] = [];

  try {
    // new Function bodies can't contain import/export — strip both defensively
    // (callers may pass code that carries real imports/exports for tsx/editor use).
    const withoutImports = stripImports(jsCode);
    const cleaned = stripExports(withoutImports);
    // The names the source exported, read before stripping. Collected from
    // inside the block so a re-exported component comes back with the rest.
    const exported = exportedNames(withoutImports);
    const exportedList = exported.map((n) => `(typeof ${n} !== 'undefined' ? ${n} : undefined)`);
    // Wrap: intercept circuit()/component() calls to collect all created circuits
    const wrappedCode = `
      "use strict";
      const __collector = [];
      const __exported = [];
      const __origCircuit = circuit;
      const __trackingCircuit = function(name, config) {
        const result = __origCircuit(name, config);
        __collector.push(result);
        return result;
      };
      {
        const circuit = __trackingCircuit;
        const component = __trackingCircuit;
        ${cleaned}
        __exported.push(${exportedList.join(', ')});
      }
      return { collected: __collector, exported: __exported };
    `;

    const fn = new Function(...allNames, wrappedCode);
    const { collected, exported: exportedValues } = fn(...allValues) as {
      collected: BuiltCircuit[];
      exported: unknown[];
    };

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

    // Exported components the source did not build: `export default FullAdder`
    // and friends. A parameterised component is exported as its factory, so a
    // bare function is called with no arguments to get its default instance.
    const defined = new Set(circuits.map((c) => c.name));
    for (const value of exportedValues) {
      const built = asBuiltCircuit(value);
      if (!built || defined.has(built.circuit.name)) continue;
      defined.add(built.circuit.name);
      exportedCircuits.push(built.circuit);
      library.addCircuit(built.circuit);
      if (built._dependencies) {
        for (const [, dep] of built._dependencies) library.addCircuit(dep.circuit);
      }
    }

    return {
      // What to simulate when the source defined nothing: the exported
      // component. Without it a re-export reads as an empty file.
      circuit:
        circuits.length > 0
          ? circuits[circuits.length - 1]
          : (exportedCircuits[exportedCircuits.length - 1] ?? null),
      circuits,
      exportedCircuits,
      builtCircuits,
      library,
      error: null,
    };
  } catch (e) {
    return {
      circuit: null,
      circuits: [],
      exportedCircuits: [],
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
    stripped = stripImports(stripTypes(code));
  } catch (e) {
    // sucrase parse failure — return an error result without running anything.
    // Reuse executeJsCode's empty-library shape by passing a no-op snippet.
    const empty = executeJsCode('');
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }
  return executeJsCode(stripped);
}

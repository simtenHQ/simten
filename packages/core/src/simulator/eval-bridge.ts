/**
 * Eval Bridge — connects user-defined .eval() functions to the simulator.
 *
 * The simulator dispatches evaluators via:
 *   EVALUATORS[primitiveTypeIndex[nodeIndex]](ctx)
 *
 * User .eval() functions work with named plain objects:
 *   ({ a, b }) => ({ sum: a + b })
 *
 * This module bridges the two by generating wrapper functions that:
 * 1. Read inputs from typed arrays by index → build named input object
 * 2. Merge state values if the component is sequential
 * 3. Call user's .eval() function
 * 4. Write output object properties back to typed arrays by index
 */

import type { NumericEvaluator, EvalContext } from './evaluators/types.js';
import { readInput, writeOutput } from './evaluators/types.js';
import { EVALUATORS } from './evaluators/index.js';
import { PRIMITIVE_TYPE_INDICES, PRIMITIVE_INDEX_TO_NAME } from './numeric-types.js';
import { getCircuitEval, getAllCircuitEvals } from '../circuit/eval-registry.js';

// ============================================================================
// Map-as-array Proxy for memory state
// ============================================================================

/**
 * Wrap a Map<number, number> in a Proxy that supports array-like indexing.
 * This allows eval functions to use `memory[addr]` syntax for reads
 * and `memory[addr] = value` for writes.
 */
function wrapMapAsArray(map: Map<number, number>): any {
  return new Proxy(map, {
    get(target, prop) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        return target.get(Number(prop)) ?? 0;
      }
      // Pass through Map methods (get, set, has, etc.) for backward compat
      const val = (target as any)[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    },
    set(target, prop, value) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        target.set(Number(prop), value);
        return true;
      }
      return false;
    },
  });
}

// ============================================================================
// Dynamic type index allocation
// ============================================================================

/** Starting index for dynamically allocated component types */
const DYNAMIC_INDEX_START = 200;

/** Next available dynamic index */
let nextDynamicIndex = DYNAMIC_INDEX_START;

/** Map from component name to dynamically allocated type index */
const dynamicTypeIndices = new Map<string, number>();

/**
 * Get or allocate a type index for a component.
 * Built-in primitives use their static index from PRIMITIVE_TYPE_INDICES.
 * User-defined components get a dynamic index starting at 200.
 */
export function getOrAllocateTypeIndex(componentName: string): number {
  // Check static indices first
  const staticIdx = PRIMITIVE_TYPE_INDICES[componentName];
  if (staticIdx !== undefined) return staticIdx;

  // Check if already allocated dynamically
  const existing = dynamicTypeIndices.get(componentName);
  if (existing !== undefined) return existing;

  // Allocate new
  const idx = nextDynamicIndex++;
  dynamicTypeIndices.set(componentName, idx);

  // Update reverse mapping for debugging
  PRIMITIVE_INDEX_TO_NAME[idx] = componentName;

  return idx;
}

/**
 * Resolve a type index for a component name. Returns undefined if not registered.
 */
export function resolveTypeIndex(componentName: string): number | undefined {
  return PRIMITIVE_TYPE_INDICES[componentName] ?? dynamicTypeIndices.get(componentName);
}

/**
 * Reset dynamic allocations (for testing).
 */
export function resetDynamicIndices(): void {
  nextDynamicIndex = DYNAMIC_INDEX_START;
  for (const [, idx] of dynamicTypeIndices) {
    EVALUATORS[idx] = null;
    delete PRIMITIVE_INDEX_TO_NAME[idx];
  }
  dynamicTypeIndices.clear();
}

// ============================================================================
// Wrapper generator
// ============================================================================

/**
 * Generate a NumericEvaluator wrapper for a user-defined .eval() function.
 *
 * The wrapper:
 * - Reads inputs from typed arrays → builds plain object with port names
 * - Merges in state values if the component is sequential
 * - Calls user's eval function
 * - Writes output values from returned object → back to typed arrays
 */
export function generateEvalWrapper(
  inputNames: string[],
  outputNames: string[],
  evalFn: (inputs: Record<string, number>) => Record<string, number>,
  stateKeys?: string[],
): NumericEvaluator {
  const numInputs = inputNames.length;
  const numOutputs = outputNames.length;

  // Pre-compute for the common case: no state
  if (!stateKeys || stateKeys.length === 0) {
    return function userEvalWrapper(ctx: EvalContext): void {
      const inputs: Record<string, any> = {};

      // Merge node.arguments first so eval functions can read parameters (value, width, etc.)
      // Port inputs below will overwrite any same-named argument (ports take precedence).
      const nodeArgs = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex]?.arguments;
      if (nodeArgs) {
        for (const key in nodeArgs) inputs[key] = (nodeArgs as Record<string, any>)[key];
      }

      for (let i = 0; i < numInputs; i++) {
        inputs[inputNames[i]] = readInput(ctx, i);
      }

      const outputs = evalFn(inputs);

      for (let i = 0; i < numOutputs; i++) {
        const val = outputs[outputNames[i]];
        if (val !== undefined) writeOutput(ctx, i, val);
      }
    };
  }

  // Sequential: merge state into inputs
  return function userEvalWrapperWithState(ctx: EvalContext): void {
    const inputs: Record<string, any> = {};

    // Merge node.arguments (parameters like value, width)
    const nodeArgs = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex]?.arguments;
    if (nodeArgs) {
      for (const key in nodeArgs) inputs[key] = (nodeArgs as Record<string, any>)[key];
    }

    // Port inputs overwrite arguments
    for (let i = 0; i < numInputs; i++) {
      inputs[inputNames[i]] = readInput(ctx, i);
    }

    // State overwrites everything (current stored value)
    if (ctx.state) {
      const nodeState = ctx.state.currentState[ctx.nodeIndex];
      if (nodeState != null && typeof nodeState === 'object' && !Array.isArray(nodeState) && !(nodeState instanceof Map)) {
        const stateObj = nodeState as Record<string, unknown>;
        for (const key of stateKeys!) {
          const val = stateObj[key];
          // Wrap Map state in Proxy for array-indexable access: memory[addr]
          inputs[key] = val instanceof Map ? wrapMapAsArray(val) : val;
        }
      } else if (nodeState != null) {
        // Wrap Map state in Proxy for array-indexable access
        inputs[stateKeys![0]] = nodeState instanceof Map ? wrapMapAsArray(nodeState) : nodeState;
      }
    }

    const outputs = evalFn(inputs);

    for (let i = 0; i < numOutputs; i++) {
      const val = outputs[outputNames[i]];
      if (val !== undefined) writeOutput(ctx, i, val);
    }
  };
}

// ============================================================================
// EVALUATORS population from eval-registry
// ============================================================================

/**
 * Ensure the EVALUATORS table has an entry for the given component name.
 * Reads from the eval-registry (populated at circuit() definition time).
 * No-op if already registered or no eval exists for this name.
 */
export function ensureEvaluatorRegistered(name: string): number {
  const idx = getOrAllocateTypeIndex(name);

  // Already registered (static stdlib evaluator or previously resolved)
  if (EVALUATORS[idx] != null) return idx;

  const entry = getCircuitEval(name);
  if (!entry) {
    console.warn(`[eval-bridge] No eval-registry entry for '${name}' — getAllCircuitEvals:`, [...(getAllCircuitEvals() as Map<string, any>).keys()]);
    return idx;
  }

  while (EVALUATORS.length <= idx) EVALUATORS.push(null);
  EVALUATORS[idx] = generateEvalWrapper(entry.inputNames, entry.outputNames, entry.evalFn, entry.stateKeys);

  return idx;
}

// ============================================================================
// onTick registry — user-defined state update functions
// ============================================================================

export type OnTickEntry = {
  inputNames: string[];
  stateKeys: string[];
  fn: (inputsAndState: Record<string, any>) => Record<string, any>;
};

/** Registry of user-defined onTick functions, keyed by component name */
const onTickRegistry = new Map<string, OnTickEntry>();

/**
 * Get (or lazily populate) the onTick function for a component name.
 */
export function getOnTickFunction(name: string): OnTickEntry | undefined {
  if (onTickRegistry.has(name)) return onTickRegistry.get(name);

  const entry = getCircuitEval(name);
  if (!entry?.onTickFn) return undefined;

  const onTickEntry: OnTickEntry = {
    inputNames: entry.inputNames,
    stateKeys: entry.stateKeys ?? [],
    fn: entry.onTickFn,
  };
  onTickRegistry.set(name, onTickEntry);
  return onTickEntry;
}

// Keep for backwards compat — simulate.ts still calls these
export function registerEvalFunction(
  name: string,
  inputNames: string[],
  outputNames: string[],
  evalFn: (inputs: Record<string, number>) => Record<string, number>,
  stateKeys?: string[],
): number {
  const idx = getOrAllocateTypeIndex(name);
  if (EVALUATORS[idx] != null) return idx;
  while (EVALUATORS.length <= idx) EVALUATORS.push(null);
  EVALUATORS[idx] = generateEvalWrapper(inputNames, outputNames, evalFn, stateKeys);
  return idx;
}

export function registerOnTickFunction(
  name: string,
  fn: (inputsAndState: Record<string, any>) => Record<string, any>,
  initialState?: Record<string, any>,
): void {
  if (onTickRegistry.has(name)) return;
  onTickRegistry.set(name, {
    inputNames: [],
    stateKeys: initialState ? Object.keys(initialState) : [],
    fn,
  });
}

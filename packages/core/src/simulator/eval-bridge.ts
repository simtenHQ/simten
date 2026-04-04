/**
 * Eval Bridge — connects user-defined .eval() functions to the fast simulation path.
 *
 * The fast simulator dispatches evaluators via:
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
      // Build input object from typed arrays
      const inputs: Record<string, number> = {};
      for (let i = 0; i < numInputs; i++) {
        inputs[inputNames[i]] = readInput(ctx, i);
      }

      // Call user function
      const outputs = evalFn(inputs);

      // Write outputs back to typed arrays
      for (let i = 0; i < numOutputs; i++) {
        const val = outputs[outputNames[i]];
        if (val !== undefined) {
          writeOutput(ctx, i, val);
        }
      }
    };
  }

  // Sequential: merge state into inputs
  return function userEvalWrapperWithState(ctx: EvalContext): void {
    const inputs: Record<string, any> = {};

    // Read port inputs
    for (let i = 0; i < numInputs; i++) {
      inputs[inputNames[i]] = readInput(ctx, i);
    }

    // Merge state values into the input object
    if (ctx.state) {
      const nodeState = ctx.state.currentState[ctx.nodeIndex];
      if (nodeState != null && typeof nodeState === 'object' && !Array.isArray(nodeState) && !(nodeState instanceof Map)) {
        const stateObj = nodeState as Record<string, unknown>;
        for (const key of stateKeys!) {
          inputs[key] = stateObj[key];
        }
      } else if (nodeState != null) {
        // Simple state (single value) — use first state key
        inputs[stateKeys![0]] = nodeState;
      }
    }

    // Call user function
    const outputs = evalFn(inputs);

    // Write outputs
    for (let i = 0; i < numOutputs; i++) {
      const val = outputs[outputNames[i]];
      if (val !== undefined) {
        writeOutput(ctx, i, val);
      }
    }
  };
}

/**
 * Register evaluator functions from a BuiltComponent into the EVALUATORS table.
 *
 * Call this during circuit compilation, before simulation starts.
 * Returns the type index assigned to this component.
 *
 * @param name - Component name
 * @param inputNames - Ordered input port names
 * @param outputNames - Ordered output port names
 * @param evalFn - User's .eval() function (plain objects in/out)
 * @param stateKeys - State property names (if sequential)
 */
export function registerEvalFunction(
  name: string,
  inputNames: string[],
  outputNames: string[],
  evalFn: (inputs: Record<string, number>) => Record<string, number>,
  stateKeys?: string[],
): number {
  const idx = getOrAllocateTypeIndex(name);

  // Don't overwrite existing evaluators (stdlib hand-written fast path)
  if (EVALUATORS[idx] != null) {
    return idx;
  }

  // Ensure EVALUATORS array is large enough
  while (EVALUATORS.length <= idx) {
    EVALUATORS.push(null);
  }

  EVALUATORS[idx] = generateEvalWrapper(inputNames, outputNames, evalFn, stateKeys);

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
 * Register a user-defined onTick function.
 */
export function registerOnTickFunction(
  name: string,
  fn: (inputsAndState: Record<string, any>) => Record<string, any>,
  initialState?: Record<string, any>,
): void {
  if (onTickRegistry.has(name)) return;
  onTickRegistry.set(name, {
    inputNames: [], // filled lazily from the circuit
    stateKeys: initialState ? Object.keys(initialState) : [],
    fn,
  });
}

/**
 * Get a registered onTick function by component name.
 */
export function getOnTickFunction(name: string): OnTickEntry | undefined {
  return onTickRegistry.get(name);
}

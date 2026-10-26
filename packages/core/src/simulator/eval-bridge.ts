/**
 * Eval Bridge — connects `eval`/`onTick` behavior to the simulator.
 *
 * The engine dispatches through a per-compile evaluator table:
 *   circuit.evaluators[circuit.primitiveTypeIndex[nodeIndex]](ctx)
 *
 * Behavior works with named plain objects:
 *   ({ a, b }) => ({ sum: a + b })
 *
 * This module builds that table from one compile's `BehaviorTable`, by
 * wrapping each eval in a function that:
 * 1. Reads inputs from typed arrays by index → builds a named input object
 * 2. Merges state values if the component is sequential
 * 3. Calls the eval
 * 4. Writes output object properties back to typed arrays by index
 */

import type { BehaviorFn, BehaviorTable } from '../circuit/behavior.js';
import type { EvalContext, NumericEvaluator } from './evaluators/types.js';
import { readInput, writeOutput } from './evaluators/types.js';

// ============================================================================
// Map-as-array Proxy for memory state
// ============================================================================

/**
 * Wrap a Map<number, number> in a Proxy that supports array-like indexing.
 * This allows eval functions to use `memory[addr]` syntax for reads
 * and `memory[addr] = value` for writes.
 */
function wrapMapAsArray(map: Map<number, number>): Map<number, number> {
  return new Proxy(map, {
    get(target, prop) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        return target.get(Number(prop)) ?? 0;
      }
      // Pass through Map methods (get, set, has, etc.) for backward compat
      const val: unknown = Reflect.get(target, prop);
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
// Wrapper generator
// ============================================================================

/** The current stored state, merged over the inputs (state overwrites everything). */
function mergeState(ctx: EvalContext, stateKeys: string[], inputs: Record<string, unknown>) {
  if (!ctx.state) return;
  const nodeState = ctx.state.currentState[ctx.nodeIndex];
  if (
    nodeState != null &&
    typeof nodeState === 'object' &&
    !Array.isArray(nodeState) &&
    !(nodeState instanceof Map)
  ) {
    const stateObj = nodeState as Record<string, unknown>;
    for (const key of stateKeys) {
      const val = stateObj[key];
      // Wrap Map state in Proxy for array-indexable access: memory[addr]
      inputs[key] = val instanceof Map ? wrapMapAsArray(val) : val;
    }
  } else if (nodeState != null) {
    inputs[stateKeys[0]] = nodeState instanceof Map ? wrapMapAsArray(nodeState) : nodeState;
  }
}

/**
 * Generate a NumericEvaluator wrapper for an `eval` function.
 *
 * The wrapper:
 * - Reads inputs from typed arrays → builds plain object with port names
 * - Merges in state values if the component is sequential
 * - Calls the eval
 * - Writes output values from returned object → back to typed arrays
 *
 * The two wrappers repeat their read and write loops rather than share helpers:
 * this is the per-node dispatch on every evaluation.
 */
export function generateEvalWrapper(
  inputNames: string[],
  outputNames: string[],
  evalFn: BehaviorFn,
  stateKeys?: string[],
): NumericEvaluator {
  const numInputs = inputNames.length;
  const numOutputs = outputNames.length;

  if (!stateKeys || stateKeys.length === 0) {
    return function userEvalWrapper(ctx: EvalContext): void {
      const inputs: Record<string, unknown> = {};

      // Node arguments first so eval can read parameters (value, width, etc.);
      // a port of the same name overwrites its argument below.
      const args = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex]?.arguments;
      if (args) {
        for (const key in args) inputs[key] = args[key];
      }

      for (let i = 0; i < numInputs; i++) {
        inputs[inputNames[i]] = readInput(ctx, i);
      }

      const outputs = evalFn(inputs);

      for (let i = 0; i < numOutputs; i++) {
        const val = outputs[outputNames[i]];
        if (val !== undefined) writeOutput(ctx, i, val as number);
      }
    };
  }

  return function userEvalWrapperWithState(ctx: EvalContext): void {
    const inputs: Record<string, unknown> = {};

    const args = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex]?.arguments;
    if (args) {
      for (const key in args) inputs[key] = args[key];
    }

    for (let i = 0; i < numInputs; i++) {
      inputs[inputNames[i]] = readInput(ctx, i);
    }

    mergeState(ctx, stateKeys, inputs);

    const outputs = evalFn(inputs);

    for (let i = 0; i < numOutputs; i++) {
      const val = outputs[outputNames[i]];
      if (val !== undefined) writeOutput(ctx, i, val as number);
    }
  };
}

// ============================================================================
// Per-compile dispatch tables
// ============================================================================

export type OnTickEntry = {
  inputNames: string[];
  stateKeys: string[];
  fn: BehaviorFn;
};

/** One compile's dispatch: an evaluator and an onTick per primitive type, by type index. */
export interface DispatchTables {
  /** Primitive type name for each type index. */
  typeNames: string[];
  /** Null when the compile has no behavior for that type; dispatching it throws. */
  evaluators: (NumericEvaluator | null)[];
  onTicks: (OnTickEntry | undefined)[];
  /** Type index for each name in `typeNames`. */
  typeIndex: Map<string, number>;
}

/** Start an empty set of tables; `typeIndexFor` fills it as types are seen. */
export function createDispatchTables(): DispatchTables {
  return { typeNames: [], evaluators: [], onTicks: [], typeIndex: new Map() };
}

/**
 * The type index for a primitive type in this compile, building its evaluator
 * and onTick from the behavior table the first time the type is seen.
 */
export function typeIndexFor(
  tables: DispatchTables,
  name: string,
  behaviors: BehaviorTable,
): number {
  const existing = tables.typeIndex.get(name);
  if (existing !== undefined) return existing;
  const idx = tables.typeNames.length;
  tables.typeIndex.set(name, idx);
  tables.typeNames.push(name);
  const entry = behaviors.get(name);
  tables.evaluators.push(
    entry
      ? generateEvalWrapper(entry.inputNames, entry.outputNames, entry.evalFn, entry.stateKeys)
      : null,
  );
  tables.onTicks.push(
    entry?.onTickFn
      ? { inputNames: entry.inputNames, stateKeys: entry.stateKeys ?? [], fn: entry.onTickFn }
      : undefined,
  );
  return idx;
}

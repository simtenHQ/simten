/**
 * Numeric Evaluator Types for Fast Simulation
 *
 * Defines the evaluation context and evaluator function signature used by
 * the evaluator table. No Map allocations in the hot path.
 */

import type { NumericCircuit } from '../numeric-types.js';
import type { NumericPortValues } from '../numeric-values.js';
import type { NumericEventQueue } from '../numeric-event-queue.js';
import type { PrimitiveState } from '../../types/simulator.js';

/**
 * Numeric sequential state for fast simulation.
 * Uses arrays indexed by node index for O(1) access.
 * Memory components still use Map for sparse storage.
 */
export interface NumericSequentialState {
  /** Current state values indexed by node index */
  currentState: (PrimitiveState | undefined)[];

  /** Next state values indexed by node index */
  nextState: (PrimitiveState | undefined)[];

  /** Clock state for each clock (indexed by clock key string) */
  clocks: Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>;

  /** Cycle count */
  cycleCount: number;
}

/**
 * Evaluation context passed to all evaluators.
 *
 * The hot loop sets per-node fields before calling each evaluator.
 * Evaluators read inputs directly from values.values via circuit.inputSourcePort.
 */
export interface EvalContext {
  // Circuit data (constant after init)
  readonly circuit: NumericCircuit;
  readonly values: NumericPortValues;
  readonly state: NumericSequentialState | undefined;
  readonly queue: NumericEventQueue;

  // Per-node fields (set by hot loop before calling evaluator)
  nodeIndex: number;
  portStart: number;
  inputCount: number;
  outputCount: number;
}

/**
 * Numeric evaluator function signature.
 * Evaluators read inputs directly from ctx.values and write outputs.
 * No Map allocations - all data access is via typed arrays.
 */
export type NumericEvaluator = (ctx: EvalContext) => void;

/**
 * Helper to read an input value from the evaluation context.
 * Returns 0 for unconnected inputs.
 */
export function readInput(ctx: EvalContext, inputIndex: number): number {
  const portIdx = ctx.circuit.inputSourcePort[ctx.portStart + inputIndex];
  return portIdx >= 0 ? ctx.values.values[portIdx] : 0;
}

/**
 * Helper to write an output value in the evaluation context. Always marks
 * the port as initialized so first-eval propagation fires even when the
 * canonical output value equals the zero default.
 */
export function writeOutput(ctx: EvalContext, outputIndex: number, value: number): void {
  const idx = ctx.portStart + ctx.inputCount + outputIndex;
  ctx.values.values[idx] = value;
  ctx.values.initialized[idx] = 1;
}

/**
 * Create a bitmask for the given width. Handles width=32 where (1 << 32) === 0 in JS.
 */
export function bitMask(width: number): number {
  return width >= 32 ? 0xffffffff : (1 << width) - 1;
}

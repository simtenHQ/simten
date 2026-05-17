/**
 * Evaluator Table for Fast Simulation
 *
 * Maps primitive type indices to evaluator functions. Hot path does a single
 * array lookup: EVALUATORS[typeIndex](ctx).
 *
 * Slots are populated lazily by the eval-bridge from registered circuit()
 * definitions. The bridge's ensureEvaluatorRegistered() runs once per
 * primitive type at simulator compile time and installs a wrapper around
 * that primitive's `eval` lambda.
 *
 * Hand-written entries can be installed manually for hot primitives that
 * the bridge dispatches expensively. Don't override on vibes — only when a
 * profiler shows that primitive's bridge dispatch is a measurable fraction
 * of frame time (e.g. >5% on a representative workload). Otherwise the
 * table just refills with overrides that re-create the maintenance and
 * drift problems we deleted hand-written entries for. See git history
 * before commit <pending> for examples of the previous hand-written form.
 */

import type { NumericEvaluator } from './types.js';
import { PRIMITIVE_TYPE_INDICES } from '../numeric-types.js';

const maxIndex = Math.max(...Object.values(PRIMITIVE_TYPE_INDICES)) + 1;
export const EVALUATORS: (NumericEvaluator | null)[] = new Array(maxIndex).fill(null);

export type { EvalContext, NumericEvaluator, NumericSequentialState } from './types.js';
export { readInput, writeOutput } from './types.js';

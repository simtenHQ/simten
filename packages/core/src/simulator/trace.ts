/**
 * Propagation Tracing
 *
 * Runs a combinational propagation and records every step:
 * which node evaluated, whether its output changed, what dependents were enqueued.
 *
 * This uses its own propagation loop (not fastPropagate) so the hot path
 * has zero tracing overhead.
 */

import type { FlatCircuit } from '../types/simulator.js';
import type { ComponentLibrary } from '../types/circuit.js';
import type { NumericCircuit } from './numeric-types.js';
import type { NumericPortValues } from './numeric-values.js';
import { compileForSimulation } from './compile-circuit.js';
import { NumericEventQueue } from './numeric-event-queue.js';
import { createNumericPortValues } from './numeric-values.js';
import { seedInitialQueue } from './fast-simulator.js';
import { EVALUATORS, type EvalContext } from './evaluators/index.js';

/** A single step in the propagation trace */
export interface PropagationStep {
  /** Node index that was evaluated */
  nodeIndex: number;
  /** Node ID (mangled, from flat circuit) */
  nodeId: string;
  /** Whether any output changed */
  changed: boolean;
  /** Node IDs that were enqueued as a result */
  enqueued: string[];
  /** Queue contents (as node IDs) after this step */
  queueSnapshot: string[];
}

const MAX_ITERATIONS = 10000;
const oldValuesScratch = new Int32Array(64);

/**
 * Run a propagation loop identical to fastPropagate, but recording every step.
 * This is a separate function to keep the hot path (fastPropagate) clean.
 */
function propagateWithTrace(
  circuit: NumericCircuit,
  queue: NumericEventQueue,
  values: NumericPortValues,
): PropagationStep[] {
  const trace: PropagationStep[] = [];
  let evalCount = 0;

  const ctx: EvalContext = {
    circuit,
    values,
    state: undefined,
    queue,
    nodeIndex: 0,
    portStart: 0,
    inputCount: 0,
    outputCount: 0,
  };

  while (!queue.isEmpty()) {
    if (++evalCount > MAX_ITERATIONS) break;

    const nodeIndex = queue.dequeue();

    const portStart = circuit.nodePortStart[nodeIndex];
    const inputCount = circuit.nodeInputCount[nodeIndex];
    const outputCount = circuit.nodeOutputCount[nodeIndex];
    const outputStart = portStart + inputCount;

    ctx.nodeIndex = nodeIndex;
    ctx.portStart = portStart;
    ctx.inputCount = inputCount;
    ctx.outputCount = outputCount;

    // Capture old outputs
    const oldValues = outputCount <= 64 ? oldValuesScratch : new Int32Array(outputCount);
    for (let i = 0; i < outputCount; i++) {
      oldValues[i] = values.values[outputStart + i];
    }

    // Evaluate
    const typeIdx = circuit.primitiveTypeIndex[nodeIndex];
    const evaluator = EVALUATORS[typeIdx];
    if (evaluator) evaluator(ctx);

    // Check for changes
    let anyChanged = false;
    for (let i = 0; i < outputCount; i++) {
      if (values.values[outputStart + i] !== oldValues[i]) {
        anyChanged = true;
        break;
      }
    }

    // Enqueue dependents
    if (anyChanged) {
      queue.enqueueAll(circuit.dependents[nodeIndex]);
    }

    // Record step
    const enqueued = anyChanged
      ? Array.from(circuit.dependents[nodeIndex]).map(idx => circuit.indexToNodeId[idx])
      : [];
    const queueSnapshot = queue.toArray().map(idx => circuit.indexToNodeId[idx]);

    trace.push({
      nodeIndex,
      nodeId: circuit.indexToNodeId[nodeIndex],
      changed: anyChanged,
      enqueued,
      queueSnapshot,
    });
  }

  return trace;
}

/**
 * Run a combinational propagation on a flat circuit and return the full trace.
 */
export function tracePropagation(
  flatCircuit: FlatCircuit,
  library: ComponentLibrary,
): PropagationStep[] {
  const numeric = compileForSimulation(flatCircuit, library);
  const values = createNumericPortValues(numeric.portCount);
  const queue = new NumericEventQueue(numeric.nodeCount);

  seedInitialQueue(numeric, queue);

  // Insert a "seed" step showing the initial queue before any evaluation
  const seededNodes = queue.toArray().map(idx => numeric.indexToNodeId[idx]);
  const seedStep: PropagationStep = {
    nodeIndex: -1,
    nodeId: '__seed__',
    changed: false,
    enqueued: seededNodes,
    queueSnapshot: seededNodes,
  };

  const trace = propagateWithTrace(numeric, queue, values);
  return [seedStep, ...trace];
}

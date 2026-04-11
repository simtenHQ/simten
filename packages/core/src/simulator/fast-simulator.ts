/**
 * Fast Simulation Engine
 *
 * High-performance simulation using numeric circuits and typed arrays.
 * Hot path uses evaluator table lookup - no switch statements or Map allocations.
 */

import type { BitValue, BusValue } from '../types/circuit.js';
import type { FlatPortValueMap, PrimitiveState } from '../types/simulator.js';
import { TOP_LEVEL_NODE } from '../types/simulator.js';
import type { NumericCircuit, NumericSequentialState } from './numeric-types.js';
import type { NumericPortValues } from './numeric-values.js';
import { UNINITIALIZED_VALUE } from './numeric-values.js';
import { NumericEventQueue } from './numeric-event-queue.js';
import { getOnTickFunction } from './eval-bridge.js';
import type { ClockEdges } from './primitive-interface.js';
import { EVALUATORS, type EvalContext } from './evaluators/index.js';

/** Maximum iterations before assuming unstable feedback loop */
const MAX_PROPAGATION_ITERATIONS = 10000;

/** Scratch buffer for old output values (reused to avoid allocation) */
const oldValuesScratch = new Int32Array(64);

/**
 * Fast propagation using numeric circuit with evaluator table.
 * No string operations or Map allocations in the hot path.
 *
 * @returns Number of node evaluations performed
 */
export function fastPropagate(
  circuit: NumericCircuit,
  queue: NumericEventQueue,
  values: NumericPortValues,
  seqState: NumericSequentialState | undefined,
  topLevelInputs?: FlatPortValueMap
): number {
  let evalCount = 0;
  let changedCount = 0;

  // Sync top-level inputs into numeric values array
  // This is required for readInput() to see the current input values
  if (topLevelInputs) {
    for (const [key, value] of topLevelInputs) {
      const portIdx = circuit.portKeyToIndex.get(key);
      if (portIdx !== undefined) {
        values.values[portIdx] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
      }
    }
  }

  // Create evaluation context (reused for all evaluations)
  const ctx: EvalContext = {
    circuit,
    values,
    state: seqState,
    queue,
    nodeIndex: 0,
    portStart: 0,
    inputCount: 0,
    outputCount: 0,
  };

  while (!queue.isEmpty()) {
    if (++evalCount > MAX_PROPAGATION_ITERATIONS) {
      throw new Error(
        `Propagation did not stabilize after ${MAX_PROPAGATION_ITERATIONS} iterations. ` +
        `Possible unstable feedback loop in circuit.`
      );
    }

    const nodeIndex = queue.dequeue();

    // Set per-node context fields
    const portStart = circuit.nodePortStart[nodeIndex];
    const inputCount = circuit.nodeInputCount[nodeIndex];
    const outputCount = circuit.nodeOutputCount[nodeIndex];
    const outputStart = portStart + inputCount;

    ctx.nodeIndex = nodeIndex;
    ctx.portStart = portStart;
    ctx.inputCount = inputCount;
    ctx.outputCount = outputCount;

    // Capture old output values for change detection
    // Use scratch buffer if possible, otherwise allocate
    const oldValues = outputCount <= 64 ? oldValuesScratch : new Int32Array(outputCount);
    for (let i = 0; i < outputCount; i++) {
      oldValues[i] = values.values[outputStart + i];
    }

    // Get evaluator from table
    const typeIdx = circuit.primitiveTypeIndex[nodeIndex];
    const evaluator = EVALUATORS[typeIdx];

    if (evaluator) {
      // Fast path: use evaluator table (no Map allocation)
      evaluator(ctx);
    } else {
      // Fallback for unknown primitives (should not happen)
      evaluateNodeFallback(circuit, nodeIndex, values, seqState, topLevelInputs);
    }

    // Check for changes and enqueue dependents
    let anyChanged = false;
    for (let i = 0; i < outputCount; i++) {
      if (values.values[outputStart + i] !== oldValues[i]) {
        anyChanged = true;
        break;
      }
    }

    if (anyChanged) {
      changedCount++;
      queue.enqueueAll(circuit.dependents[nodeIndex]);
    }
  }

  if (DEBUG_STATE_UPDATE) {
    console.log(`[fastPropagate] ${evalCount} evals, ${changedCount} changed`);
  }

  return evalCount;
}

/**
 * Fallback: zero outputs for unknown primitives.
 * Should not be reached if all circuits have evals registered via circuit().
 */
function evaluateNodeFallback(
  circuit: NumericCircuit,
  nodeIndex: number,
  values: NumericPortValues,
  _seqState: NumericSequentialState | undefined,
  _topLevelInputs: FlatPortValueMap | undefined
): void {
  const node = circuit.flatCircuit.nodes[nodeIndex];
  const portStart = circuit.nodePortStart[nodeIndex];
  const inputCount = circuit.nodeInputCount[nodeIndex];
  const outputCount = circuit.nodeOutputCount[nodeIndex];
  const outputStart = portStart + inputCount;
  console.warn(`[fastSimulator] No evaluator for '${node.primitiveType}' — outputs zeroed`);
  for (let i = 0; i < outputCount; i++) {
    values.values[outputStart + i] = 0;
  }
}

/**
 * Seed the event queue with initial nodes for full evaluation.
 */
export function seedInitialQueue(
  circuit: NumericCircuit,
  queue: NumericEventQueue
): void {
  let sourceCount = 0, stateOutputCount = 0, topLevelCount = 0;
  for (let i = 0; i < circuit.nodeCount; i++) {
    if (circuit.isSourceNode[i] || circuit.isStateOutputNode[i] || circuit.readsTopLevelInput[i]) {
      queue.enqueue(i);
      if (circuit.isSourceNode[i]) sourceCount++;
      if (circuit.isStateOutputNode[i]) stateOutputCount++;
      if (circuit.readsTopLevelInput[i]) topLevelCount++;
    }
  }
  if (DEBUG_STATE_UPDATE) {
    console.log(`[seedInitialQueue] Seeded ${queue.size()} nodes (source=${sourceCount}, stateOutput=${stateOutputCount}, topLevel=${topLevelCount})`);
  }
}

/**
 * Seed the event queue with state-output nodes only.
 */
export function seedStateOutputNodes(
  circuit: NumericCircuit,
  queue: NumericEventQueue
): void {
  for (let i = 0; i < circuit.nodeCount; i++) {
    if (circuit.isStateOutputNode[i]) {
      queue.enqueue(i);
    }
  }
}

/**
 * Update clock states for all clocks in the circuit.
 */
export function updateClockStates(
  _circuit: NumericCircuit,
  seqState: NumericSequentialState
): void {
  for (const [_clockKey, clockState] of seqState.clocks) {
    clockState.edge = 'rising';
    clockState.value = true;
  }
}

// Debug flag - set to true to enable state update logging
let DEBUG_STATE_UPDATE = false;
export function setDebugStateUpdate(enabled: boolean) {
  DEBUG_STATE_UPDATE = enabled;
}

/**
 * Update sequential states for all stateful nodes.
 */
export function updateSequentialStates(
  circuit: NumericCircuit,
  values: NumericPortValues,
  seqState: NumericSequentialState,
  topLevelInputs?: FlatPortValueMap
): void {
  for (let nodeIdx = 0; nodeIdx < circuit.nodeCount; nodeIdx++) {
    if (!circuit.hasState[nodeIdx]) continue;

    const node = circuit.flatCircuit.nodes[nodeIdx];
    const onTick = getOnTickFunction(node.primitiveType);
    if (!onTick) continue;

    // Build inputs Map (same as evaluateNode fallback path)
    const inputs = new Map<string, BitValue | BusValue>();
    const portStart = circuit.nodePortStart[nodeIdx];
    const inputCount = circuit.nodeInputCount[nodeIdx];

    for (let i = 0; i < inputCount; i++) {
      const portIdx = portStart + i;
      const srcNodeIdx = circuit.inputSourceNode[portIdx];
      const srcPortIdx = circuit.inputSourcePort[portIdx];
      const portName = circuit.inputPortNames[portIdx];

      if (srcNodeIdx === -1) {
        if (topLevelInputs && srcPortIdx >= 0) {
          const topKey = circuit.indexToPortKey[srcPortIdx];
          const val = topLevelInputs.get(topKey);
          if (val !== undefined) {
            inputs.set(portName, val);
          }
        }
      } else if (srcPortIdx >= 0) {
        const value = values.values[srcPortIdx];
        inputs.set(portName, value);

        // Debug logging
        if (DEBUG_STATE_UPDATE && node.id.includes('pc_lo') && !node.id.includes('temp') && portName === 'data') {
          const srcKey = circuit.indexToPortKey[srcPortIdx];
          console.log(`  [data input] srcPortIdx=${srcPortIdx}, srcKey=${srcKey}, value=${value}`);
        }
      }
    }

    // Add arguments
    if (node.arguments) {
      for (const [key, value] of Object.entries(node.arguments)) {
        inputs.set(`__${key}`, value as BitValue | BusValue);
      }
    }

    // Build clock edges
    const clockEdges: ClockEdges = {};
    for (const clockPort of node.clocks) {
      const clockKey = `${node.id}.${clockPort.name}`;
      const clockState = seqState.clocks.get(clockKey);
      if (clockState) {
        clockEdges[clockPort.name] = clockState.edge;
      }
    }

    // Update state via onTick
    const currentState = seqState.currentState[nodeIdx];
    const obj: Record<string, any> = {};
    for (const [k, v] of inputs) obj[k] = v;
    if (currentState != null && typeof currentState === 'object' && !(currentState instanceof Map)) {
      for (const key of onTick.stateKeys) obj[key] = (currentState as any)[key];
    } else if (currentState != null && onTick.stateKeys.length === 1) {
      obj[onTick.stateKeys[0]] = currentState;
    }
    const result = onTick.fn(obj);
    const nextState: PrimitiveState = onTick.stateKeys.length === 1 ? result[onTick.stateKeys[0]] : result;

    seqState.nextState[nodeIdx] = nextState;
  }
}

/**
 * Commit next state to current state.
 */
export function commitSequentialState(seqState: NumericSequentialState): void {
  for (let i = 0; i < seqState.currentState.length; i++) {
    const nextVal = seqState.nextState[i];
    if (nextVal !== undefined) {
      if (nextVal instanceof Map) {
        seqState.currentState[i] = new Map(nextVal);
        seqState.nextState[i] = new Map(nextVal);
      } else {
        seqState.currentState[i] = nextVal;
        seqState.nextState[i] = nextVal;
      }
    }
  }
  seqState.cycleCount++;
}

/**
 * Convert numeric port values to FlatPortValueMap for API compatibility.
 */
export function toFlatPortValueMap(
  circuit: NumericCircuit,
  values: NumericPortValues,
  topLevelInputs?: FlatPortValueMap
): Map<string, BitValue | BusValue> {
  const result = new Map<string, BitValue | BusValue>();

  // Copy top-level inputs
  if (topLevelInputs) {
    for (const [key, value] of topLevelInputs) {
      result.set(key, value);
    }
  }

  // Convert numeric values to map
  // Return booleans for bit ports to maintain API compatibility
  for (let i = 0; i < circuit.portCount; i++) {
    const key = circuit.indexToPortKey[i];
    const isOutput = circuit.portIsOutput[i] === 1;
    const isBit = circuit.portIsBus[i] === 0;

    let numVal: number;
    if (isOutput) {
      // Output port - read directly from values array
      numVal = values.values[i];
    } else {
      // Input port - look up from source output port
      const srcPortIdx = circuit.inputSourcePort[i];
      if (srcPortIdx >= 0) {
        numVal = values.values[srcPortIdx];
      } else {
        numVal = 0; // Unconnected input defaults to 0
      }
    }

    // Safety: treat uninitialized as 0
    if (numVal === UNINITIALIZED_VALUE) {
      numVal = 0;
    }

    // Return boolean for true 1-bit values, number for multi-bit values
    // If value > 1 or < 0, it needs more than 1 bit, so return as number
    const needsMultiBit = numVal > 1 || numVal < 0;
    result.set(key, (isBit && !needsMultiBit) ? (numVal !== 0) : numVal);
  }

  return result;
}

/**
 * Initialize numeric port values from flat port values.
 */
export function fromFlatPortValueMap(
  circuit: NumericCircuit,
  values: NumericPortValues,
  flatValues: FlatPortValueMap
): void {
  for (const [key, value] of flatValues) {
    const portIdx = circuit.portKeyToIndex.get(key);
    if (portIdx !== undefined) {
      values.values[portIdx] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
    }
  }
}

/**
 * Propagate to top-level outputs.
 */
export function propagateToTopLevelOutputs(
  circuit: NumericCircuit,
  values: NumericPortValues,
  result: Map<string, BitValue | BusValue>
): void {
  for (const conn of circuit.flatCircuit.connections) {
    if (conn.target.nodeId === TOP_LEVEL_NODE || conn.target.nodeId === '') {
      const sourceKey = `${conn.source.nodeId}.${conn.source.portName}`;
      const sourcePortIdx = circuit.portKeyToIndex.get(sourceKey);
      if (sourcePortIdx !== undefined) {
        const targetKey = `${conn.target.nodeId || TOP_LEVEL_NODE}.${conn.target.portName}`;
        const isBit = circuit.portIsBus[sourcePortIdx] === 0;
        const numVal = values.values[sourcePortIdx];
        result.set(targetKey, isBit ? (numVal !== 0) : numVal);
      }
    }
  }
}

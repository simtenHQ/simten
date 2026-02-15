/**
 * Fast Simulation Engine
 *
 * High-performance simulation using numeric circuits and typed arrays.
 * Hot path with minimal string operations and no allocations.
 */

import type { BitValue, BusValue, FlatPortValueMap, PrimitiveState } from './types';
import { TOP_LEVEL_NODE } from './types';
import type { NumericCircuit, NumericSequentialState } from './numeric-types';
import { PRIMITIVE_TYPE_INDICES } from './numeric-types';
import type { NumericPortValues } from './numeric-values';
import { NumericEventQueue } from './numeric-event-queue';
import { getPrimitiveEvaluator } from './primitives';
import type { ClockEdges } from './primitive-interface';

/** Maximum iterations before assuming unstable feedback loop */
const MAX_PROPAGATION_ITERATIONS = 10000;

/**
 * Evaluate a single node and store outputs in the numeric values array.
 * Uses the existing Map-based evaluators with a thin wrapper.
 */
function evaluateNode(
  circuit: NumericCircuit,
  nodeIndex: number,
  values: NumericPortValues,
  seqState: NumericSequentialState | undefined,
  topLevelInputs: FlatPortValueMap | undefined
): void {
  const node = circuit.flatCircuit.nodes[nodeIndex];
  const portStart = circuit.nodePortStart[nodeIndex];
  const inputCount = circuit.nodeInputCount[nodeIndex];
  const outputCount = circuit.nodeOutputCount[nodeIndex];
  const primitiveType = node.primitiveType;

  // ============================================================================
  // Fast path for common primitives (inline evaluation, no Map creation)
  // ============================================================================

  const typeIdx = circuit.primitiveTypeIndex[nodeIndex];
  const outputStart = portStart + inputCount;

  switch (typeIdx) {
    // Logic Gates - inline for maximum speed
    case PRIMITIVE_TYPE_INDICES.And: {
      const aPortIdx = circuit.inputSourcePort[portStart];
      const bPortIdx = circuit.inputSourcePort[portStart + 1];
      const a = aPortIdx >= 0 ? values.values[aPortIdx] : 0;
      const b = bPortIdx >= 0 ? values.values[bPortIdx] : 0;
      values.values[outputStart] = (a && b) ? 1 : 0;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.Or: {
      const aPortIdx = circuit.inputSourcePort[portStart];
      const bPortIdx = circuit.inputSourcePort[portStart + 1];
      const a = aPortIdx >= 0 ? values.values[aPortIdx] : 0;
      const b = bPortIdx >= 0 ? values.values[bPortIdx] : 0;
      values.values[outputStart] = (a || b) ? 1 : 0;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.Not: {
      const inPortIdx = circuit.inputSourcePort[portStart];
      const inVal = inPortIdx >= 0 ? values.values[inPortIdx] : 0;
      values.values[outputStart] = inVal ? 0 : 1;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.Nand: {
      const aPortIdx = circuit.inputSourcePort[portStart];
      const bPortIdx = circuit.inputSourcePort[portStart + 1];
      const a = aPortIdx >= 0 ? values.values[aPortIdx] : 0;
      const b = bPortIdx >= 0 ? values.values[bPortIdx] : 0;
      values.values[outputStart] = (a && b) ? 0 : 1;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.Nor: {
      const aPortIdx = circuit.inputSourcePort[portStart];
      const bPortIdx = circuit.inputSourcePort[portStart + 1];
      const a = aPortIdx >= 0 ? values.values[aPortIdx] : 0;
      const b = bPortIdx >= 0 ? values.values[bPortIdx] : 0;
      values.values[outputStart] = (a || b) ? 0 : 1;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.Xor: {
      const aPortIdx = circuit.inputSourcePort[portStart];
      const bPortIdx = circuit.inputSourcePort[portStart + 1];
      const a = aPortIdx >= 0 ? values.values[aPortIdx] : 0;
      const b = bPortIdx >= 0 ? values.values[bPortIdx] : 0;
      values.values[outputStart] = (a !== b) ? 1 : 0;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.Xnor: {
      const aPortIdx = circuit.inputSourcePort[portStart];
      const bPortIdx = circuit.inputSourcePort[portStart + 1];
      const a = aPortIdx >= 0 ? values.values[aPortIdx] : 0;
      const b = bPortIdx >= 0 ? values.values[bPortIdx] : 0;
      values.values[outputStart] = (a === b) ? 1 : 0;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.Buffer: {
      const inPortIdx = circuit.inputSourcePort[portStart];
      const inVal = inPortIdx >= 0 ? values.values[inPortIdx] : 0;
      values.values[outputStart] = inVal;
      return;
    }

    // I/O Components
    case PRIMITIVE_TYPE_INDICES.Switch:
    case PRIMITIVE_TYPE_INDICES.Button: {
      const val = Boolean(node.arguments.value ?? false);
      values.values[outputStart] = val ? 1 : 0;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.Input:
    case PRIMITIVE_TYPE_INDICES.Constant: {
      const val = typeof node.arguments.value === 'number' ? node.arguments.value : 0;
      values.values[outputStart] = val;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.Led:
    case PRIMITIVE_TYPE_INDICES.Output:
    case PRIMITIVE_TYPE_INDICES.SevenSegment:
    case PRIMITIVE_TYPE_INDICES.HexDisplay:
      // Sinks - no outputs
      return;

    // Bus operations - fast path
    case PRIMITIVE_TYPE_INDICES.BusAnd: {
      const aPortIdx = circuit.inputSourcePort[portStart];
      const bPortIdx = circuit.inputSourcePort[portStart + 1];
      const a = aPortIdx >= 0 ? values.values[aPortIdx] : 0;
      const b = bPortIdx >= 0 ? values.values[bPortIdx] : 0;
      values.values[outputStart] = a & b;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.BusOr: {
      const aPortIdx = circuit.inputSourcePort[portStart];
      const bPortIdx = circuit.inputSourcePort[portStart + 1];
      const a = aPortIdx >= 0 ? values.values[aPortIdx] : 0;
      const b = bPortIdx >= 0 ? values.values[bPortIdx] : 0;
      values.values[outputStart] = a | b;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.BusNot: {
      const inPortIdx = circuit.inputSourcePort[portStart];
      const inVal = inPortIdx >= 0 ? values.values[inPortIdx] : 0;
      values.values[outputStart] = ~inVal;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.BusXor: {
      const aPortIdx = circuit.inputSourcePort[portStart];
      const bPortIdx = circuit.inputSourcePort[portStart + 1];
      const a = aPortIdx >= 0 ? values.values[aPortIdx] : 0;
      const b = bPortIdx >= 0 ? values.values[bPortIdx] : 0;
      values.values[outputStart] = a ^ b;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.Incrementer: {
      const inPortIdx = circuit.inputSourcePort[portStart];
      const inVal = inPortIdx >= 0 ? values.values[inPortIdx] : 0;
      values.values[outputStart] = (inVal + 1) & 0xFF;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.Probe: {
      const inPortIdx = circuit.inputSourcePort[portStart];
      const inVal = inPortIdx >= 0 ? values.values[inPortIdx] : 0;
      values.values[outputStart] = inVal;
      return;
    }

    case PRIMITIVE_TYPE_INDICES.AddressCombiner: {
      const loPortIdx = circuit.inputSourcePort[portStart];
      const hiPortIdx = circuit.inputSourcePort[portStart + 1];
      const lo = loPortIdx >= 0 ? values.values[loPortIdx] : 0;
      const hi = hiPortIdx >= 0 ? values.values[hiPortIdx] : 0;
      values.values[outputStart] = ((hi & 0xFF) << 8) | (lo & 0xFF);
      return;
    }
  }

  // ============================================================================
  // Fallback: Use existing evaluator with Map conversion
  // ============================================================================

  const inputs = new Map<string, BitValue | BusValue>();

  // Gather inputs from numeric arrays
  for (let i = 0; i < inputCount; i++) {
    const portIdx = portStart + i;
    const srcNodeIdx = circuit.inputSourceNode[portIdx];
    const srcPortIdx = circuit.inputSourcePort[portIdx];
    const portName = circuit.inputPortNames[portIdx];

    if (srcNodeIdx === -1) {
      // Top-level input
      if (topLevelInputs && srcPortIdx >= 0) {
        const topKey = circuit.indexToPortKey[srcPortIdx];
        const val = topLevelInputs.get(topKey);
        if (val !== undefined) {
          inputs.set(portName, val);
        }
      }
    } else if (srcPortIdx >= 0) {
      // Regular input from another node
      // Always pass numbers - evaluators handle truthy/falsy for booleans
      const value = values.values[srcPortIdx];
      inputs.set(portName, value);
    }
  }

  // Provide default values for unconnected inputs (always 0)
  for (let i = 0; i < inputCount; i++) {
    const portIdx = portStart + i;
    const portName = circuit.inputPortNames[portIdx];
    if (!inputs.has(portName)) {
      inputs.set(portName, 0);
    }
  }

  // Add arguments with __ prefix
  if (node.arguments && Object.keys(node.arguments).length > 0) {
    for (const [key, value] of Object.entries(node.arguments)) {
      inputs.set(`__${key}`, value as BitValue | BusValue);
    }
  }

  // Get evaluator and current state
  const evaluator = getPrimitiveEvaluator(primitiveType);
  if (!evaluator) {
    // Set default outputs
    for (let i = 0; i < outputCount; i++) {
      values.values[outputStart + i] = 0;
    }
    return;
  }

  const currentState = seqState?.currentState[nodeIndex];

  // Debug Mux evaluation
  if (DEBUG_MUX && primitiveType === 'Mux' && node.id.includes('pc_lo_after_reset')) {
    console.log(`[Mux] ${node.id}`);
    console.log(`  inputs: ${JSON.stringify(Array.from(inputs.entries()))}`);
    console.log(`  node.inputs: ${node.inputs.map(i => i.name).join(', ')}`);
    // Show where inputs come from
    for (let i = 0; i < inputCount; i++) {
      const srcNodeIdx = circuit.inputSourceNode[portStart + i];
      const srcPortIdx = circuit.inputSourcePort[portStart + i];
      const portName = circuit.inputPortNames[portStart + i];
      if (srcPortIdx >= 0) {
        const srcKey = circuit.indexToPortKey[srcPortIdx];
        const value = values.values[srcPortIdx];
        // Extract just the node name and port
        const parts = srcKey.split('.');
        const nodeName = parts[parts.length - 2]?.substring(0, 30) || '';
        const portNm = parts[parts.length - 1] || '';
        console.log(`  ${portName}: srcPortIdx=${srcPortIdx}, src=${nodeName}.${portNm}, value=${value}`);
      }
    }
  }

  const outputsMap = evaluator.evaluate(inputs, currentState);

  // Write outputs back to numeric array
  let outIdx = 0;
  for (const output of node.outputs) {
    const outputVal = outputsMap.get(output.name);
    if (outputVal !== undefined) {
      const numVal = typeof outputVal === 'boolean' ? (outputVal ? 1 : 0) : outputVal;
      values.values[outputStart + outIdx] = numVal;
    }
    outIdx++;
  }
}

/**
 * Fast propagation using numeric circuit.
 * No string operations or allocations in the hot path.
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

  while (!queue.isEmpty()) {
    if (++evalCount > MAX_PROPAGATION_ITERATIONS) {
      throw new Error(
        `Propagation did not stabilize after ${MAX_PROPAGATION_ITERATIONS} iterations. ` +
        `Possible unstable feedback loop in circuit.`
      );
    }

    const nodeIndex = queue.dequeue();

    // Store old output values for change detection
    const portStart = circuit.nodePortStart[nodeIndex];
    const inputCount = circuit.nodeInputCount[nodeIndex];
    const outputCount = circuit.nodeOutputCount[nodeIndex];
    const outputStart = portStart + inputCount;

    // Capture old values (inline for speed)
    const oldValues = new Int32Array(outputCount);
    for (let i = 0; i < outputCount; i++) {
      oldValues[i] = values.values[outputStart + i];
    }

    // Evaluate node
    evaluateNode(circuit, nodeIndex, values, seqState, topLevelInputs);

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
let DEBUG_MUX = false;
export function setDebugStateUpdate(enabled: boolean) {
  DEBUG_STATE_UPDATE = enabled;
}
export function setDebugMux(enabled: boolean) {
  DEBUG_MUX = enabled;
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
    const evaluator = getPrimitiveEvaluator(node.primitiveType);
    if (!evaluator || !evaluator.updateState) continue;

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
        // Always pass numbers - evaluators handle truthy/falsy for booleans
        // This avoids issues with parameterized-width primitives (Mux, Constant, etc.)
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

    // Update state
    const currentState = seqState.currentState[nodeIdx];
    const nextState = evaluator.updateState(inputs, currentState as PrimitiveState, clockEdges);

    // Debug logging for Register nodes
    if (DEBUG_STATE_UPDATE && node.primitiveType === 'Register' && node.id.includes('pc_lo')) {
      console.log(`[updateSequentialStates] ${node.id}:`);
      console.log(`  inputs: data=${inputs.get('data')}, we=${inputs.get('we')}`);
      console.log(`  clockEdges: ${JSON.stringify(clockEdges)}`);
      console.log(`  currentState=${currentState}, nextState=${nextState}`);
    }

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
): FlatPortValueMap {
  const result: FlatPortValueMap = new Map();

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
    const numVal = values.values[i];
    const isBit = circuit.portIsBus[i] === 0;
    result.set(key, isBit ? (numVal !== 0) : numVal);
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
  result: FlatPortValueMap
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

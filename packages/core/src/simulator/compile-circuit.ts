/**
 * Circuit Compilation for Fast Simulation
 *
 * Compiles a FlatCircuit to a NumericCircuit for fast simulation.
 * This is a one-time operation during initialization.
 */

import type { CircuitLibrary } from '../types/circuit.js';
import type { FlatCircuit, PrimitiveState } from '../types/simulator.js';
import { TOP_LEVEL_NODE } from '../types/simulator.js';
import type { NumericCircuit, NumericSequentialState } from './numeric-types.js';
import { ensureEvaluatorRegistered } from './eval-bridge.js';

/**
 * Compile a FlatCircuit to a NumericCircuit for fast simulation.
 *
 * @param flatCircuit - The flattened circuit to compile
 * @param library - Component library for resolving component definitions
 * @returns Compiled numeric circuit
 */
export function compileForSimulation(
  flatCircuit: FlatCircuit,
  library: CircuitLibrary
): NumericCircuit {
  const nodeCount = flatCircuit.nodes.length;

  // ============================================================================
  // Step 1: Assign numeric indices to all nodes
  // ============================================================================

  const nodeIdToIndex = new Map<string, number>();
  const indexToNodeId: string[] = new Array(nodeCount);

  for (let i = 0; i < nodeCount; i++) {
    const node = flatCircuit.nodes[i];
    nodeIdToIndex.set(node.id, i);
    indexToNodeId[i] = node.id;
  }

  // Also map TOP_LEVEL_NODE to a special index (-1 or separate handling)
  // We'll use -1 as a sentinel for top-level

  // ============================================================================
  // Step 2: Count total ports and assign port indices
  // ============================================================================

  let totalPorts = 0;
  const nodePortStart = new Uint32Array(nodeCount);
  const nodeInputCount = new Uint8Array(nodeCount);
  const nodeOutputCount = new Uint8Array(nodeCount);

  for (let i = 0; i < nodeCount; i++) {
    const node = flatCircuit.nodes[i];
    nodePortStart[i] = totalPorts;
    nodeInputCount[i] = node.inputs.length;
    nodeOutputCount[i] = node.outputs.length;
    totalPorts += node.inputs.length + node.outputs.length;
  }

  // ============================================================================
  // Step 3: Build port index mappings
  // ============================================================================

  // Count top-level ports too (they need indices for input source lookup)
  const topLevelInputCount = flatCircuit.topLevelInputs.length;
  const topLevelOutputCount = flatCircuit.topLevelOutputs.length;
  const totalPortsWithTopLevel = totalPorts + topLevelInputCount + topLevelOutputCount;

  const portKeyToIndex = new Map<string, number>();
  const indexToPortKey: string[] = new Array(totalPortsWithTopLevel);
  const portIsOutput = new Uint8Array(totalPortsWithTopLevel);
  const portIsBus = new Uint8Array(totalPortsWithTopLevel);
  const inputPortNames: string[] = new Array(totalPortsWithTopLevel);

  // Add top-level inputs first (they act as sources for nodes)
  let topLevelPortIdx = totalPorts;
  for (const input of flatCircuit.topLevelInputs) {
    const key = `${TOP_LEVEL_NODE}.${input.name}`;
    portKeyToIndex.set(key, topLevelPortIdx);
    indexToPortKey[topLevelPortIdx] = key;
    portIsOutput[topLevelPortIdx] = 1; // Top-level inputs are outputs from the boundary
    portIsBus[topLevelPortIdx] = input.portType.kind === 'bus' ? 1 : 0;
    topLevelPortIdx++;
  }

  // Add top-level outputs
  for (const output of flatCircuit.topLevelOutputs) {
    const key = `${TOP_LEVEL_NODE}.${output.name}`;
    portKeyToIndex.set(key, topLevelPortIdx);
    indexToPortKey[topLevelPortIdx] = key;
    portIsOutput[topLevelPortIdx] = 0; // Top-level outputs are inputs to the boundary
    portIsBus[topLevelPortIdx] = output.portType.kind === 'bus' ? 1 : 0;
    topLevelPortIdx++;
  }

  for (let nodeIdx = 0; nodeIdx < nodeCount; nodeIdx++) {
    const node = flatCircuit.nodes[nodeIdx];
    let portIdx = nodePortStart[nodeIdx];

    // Input ports first
    for (const input of node.inputs) {
      const key = `${node.id}.${input.name}`;
      portKeyToIndex.set(key, portIdx);
      indexToPortKey[portIdx] = key;
      portIsOutput[portIdx] = 0;
      portIsBus[portIdx] = input.portType.kind === 'bus' ? 1 : 0;
      inputPortNames[portIdx] = input.name;
      portIdx++;
    }

    // Output ports second
    for (const output of node.outputs) {
      const key = `${node.id}.${output.name}`;
      portKeyToIndex.set(key, portIdx);
      indexToPortKey[portIdx] = key;
      portIsOutput[portIdx] = 1;

      // Determine if output is a bus based on port type
      // Some primitives (Constant, Input, Mux) have parameterized width that
      // isn't always in node.arguments, so we need to infer from inputs
      let isBus = output.portType.kind === 'bus';
      if (!isBus) {
        // Check width argument
        const width = node.arguments.width;
        if (typeof width === 'number' && width > 1) {
          isBus = true;
        }
        // For Mux: if any input port (except sel) is a bus, output is bus
        if (!isBus && node.primitiveType === 'Mux') {
          for (const input of node.inputs) {
            if (input.name !== 'sel' && input.portType.kind === 'bus') {
              isBus = true;
              break;
            }
          }
        }
      }
      portIsBus[portIdx] = isBus ? 1 : 0;
      portIdx++;
    }
  }

  // ============================================================================
  // Step 4: Build primitive type indices
  // ============================================================================

  const primitiveTypeIndex = new Uint16Array(nodeCount);

  for (let i = 0; i < nodeCount; i++) {
    const node = flatCircuit.nodes[i];
    // Always call ensureEvaluatorRegistered: for built-ins it returns the
    // static index and lazily populates the EVALUATORS slot from the registry
    // if it's null; for user primitives it allocates a dynamic index and
    // wraps their eval lambda. Idempotent — no-op when the slot is already set.
    primitiveTypeIndex[i] = ensureEvaluatorRegistered(node.primitiveType);
  }

  // ============================================================================
  // Step 5: Convert string dependents to numeric
  // ============================================================================

  const dependents: Uint32Array[] = new Array(nodeCount);

  for (let i = 0; i < nodeCount; i++) {
    const node = flatCircuit.nodes[i];
    const deps = node.dependents
      .map(depId => nodeIdToIndex.get(depId))
      .filter((idx): idx is number => idx !== undefined);
    dependents[i] = new Uint32Array(deps);
  }

  // ============================================================================
  // Step 6: Build input source arrays
  // ============================================================================

  const inputSourceNode = new Int32Array(totalPorts);
  const inputSourcePort = new Int32Array(totalPorts);

  // Initialize to -1 (unconnected)
  inputSourceNode.fill(-1);
  inputSourcePort.fill(-1);

  for (let nodeIdx = 0; nodeIdx < nodeCount; nodeIdx++) {
    const node = flatCircuit.nodes[nodeIdx];
    const portStart = nodePortStart[nodeIdx];

    for (let i = 0; i < node.inputSources.length; i++) {
      const src = node.inputSources[i];
      const inputIdx = node.inputs.findIndex(p => p.name === src.portName);
      if (inputIdx === -1) continue;

      const portIdx = portStart + inputIdx;

      // Handle top-level inputs specially
      if (src.sourceNodeId === TOP_LEVEL_NODE) {
        // Use -1 as sentinel for top-level
        inputSourceNode[portIdx] = -1;
        // Store the port key for top-level lookup
        const topLevelKey = `${TOP_LEVEL_NODE}.${src.sourcePortName}`;
        inputSourcePort[portIdx] = portKeyToIndex.get(topLevelKey) ?? -1;
      } else {
        const srcNodeIdx = nodeIdToIndex.get(src.sourceNodeId);
        if (srcNodeIdx === undefined) continue;

        const srcNode = flatCircuit.nodes[srcNodeIdx];
        const srcPortIdx = srcNode.outputs.findIndex(p => p.name === src.sourcePortName);
        if (srcPortIdx === -1) continue;

        inputSourceNode[portIdx] = srcNodeIdx;
        inputSourcePort[portIdx] = nodePortStart[srcNodeIdx] + srcNode.inputs.length + srcPortIdx;
      }
    }
  }

  // ============================================================================
  // Step 7: Classify nodes
  // ============================================================================

  const isSourceNode = new Uint8Array(nodeCount);
  const isStateOutputNode = new Uint8Array(nodeCount);
  const hasState = new Uint8Array(nodeCount);
  const readsTopLevelInput = new Uint8Array(nodeCount);

  for (let i = 0; i < nodeCount; i++) {
    const node = flatCircuit.nodes[i];

    // Source node: no inputs
    isSourceNode[i] = node.inputs.length === 0 ? 1 : 0;

    // Has state: check if the component has state blocks
    const resolvedComp = library.resolveCircuit(node.primitiveType);
    if (resolvedComp?.state && resolvedComp.state.length > 0) {
      hasState[i] = 1;
      // Any node with state needs re-evaluation after clock edge
      isStateOutputNode[i] = 1;
    }

    // Reads top-level input
    for (const src of node.inputSources) {
      if (src.sourceNodeId === TOP_LEVEL_NODE) {
        readsTopLevelInput[i] = 1;
        break;
      }
    }
  }

  return {
    nodeCount,
    portCount: totalPortsWithTopLevel,
    nodeIdToIndex,
    indexToNodeId,
    portKeyToIndex,
    indexToPortKey,
    primitiveTypeIndex,
    nodePortStart,
    nodeInputCount,
    nodeOutputCount,
    dependents,
    inputSourceNode,
    inputSourcePort,
    inputPortNames,
    portIsOutput,
    portIsBus,
    isSourceNode,
    isStateOutputNode,
    hasState,
    readsTopLevelInput,
    flatCircuit,
  };
}

/**
 * Create numeric sequential state from flat sequential state.
 *
 * @param flatCircuit - The flat circuit
 * @param circuit - The compiled numeric circuit
 * @param flatState - The flat sequential state to convert
 */
export function createNumericSequentialState(
  circuit: NumericCircuit,
  flatState: { currentState: Map<string, PrimitiveState>; nextState: Map<string, PrimitiveState>; clocks: Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>; cycleCount: number }
): NumericSequentialState {
  const currentState: (PrimitiveState | undefined)[] = new Array(circuit.nodeCount);
  const nextState: (PrimitiveState | undefined)[] = new Array(circuit.nodeCount);

  // Copy state from flat to numeric (indexed by node index)
  for (const [nodeId, state] of flatState.currentState) {
    const idx = circuit.nodeIdToIndex.get(nodeId);
    if (idx !== undefined) {
      currentState[idx] = state;
    }
  }

  for (const [nodeId, state] of flatState.nextState) {
    const idx = circuit.nodeIdToIndex.get(nodeId);
    if (idx !== undefined) {
      nextState[idx] = state;
    }
  }

  return {
    currentState,
    nextState,
    clocks: flatState.clocks, // Keep clocks as Map (low count, rarely accessed)
    cycleCount: flatState.cycleCount,
  };
}

/**
 * Convert numeric sequential state back to flat sequential state.
 */
export function toFlatSequentialState(
  circuit: NumericCircuit,
  numericState: NumericSequentialState
): { currentState: Map<string, PrimitiveState>; nextState: Map<string, PrimitiveState>; clocks: Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>; cycleCount: number } {
  const currentState = new Map<string, PrimitiveState>();
  const nextState = new Map<string, PrimitiveState>();

  for (let i = 0; i < circuit.nodeCount; i++) {
    const nodeId = circuit.indexToNodeId[i];
    if (numericState.currentState[i] !== undefined) {
      currentState.set(nodeId, numericState.currentState[i]!);
    }
    if (numericState.nextState[i] !== undefined) {
      nextState.set(nodeId, numericState.nextState[i]!);
    }
  }

  return {
    currentState,
    nextState,
    clocks: numericState.clocks,
    cycleCount: numericState.cycleCount,
  };
}

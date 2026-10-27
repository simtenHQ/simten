/**
 * Circuit Compilation for Fast Simulation
 *
 * Compiles a FlatCircuit to a NumericCircuit for fast simulation.
 * This is a one-time operation during initialization.
 */

import type { Library } from '../circuit/behavior.js';
import type { CircuitIR, PortType } from '../ir/circuit-ir.js';
import { createDispatchTables, typeIndexFor } from './eval-bridge.js';
import type { NumericCircuit, NumericSequentialState } from './numeric-types.js';
import type { FlatCircuit, FlatNode, PrimitiveState } from './types.js';
import { TOP_LEVEL_NODE } from './types.js';

/**
 * Compile a FlatCircuit to a NumericCircuit for fast simulation.
 *
 * @param flatCircuit - The flattened circuit to compile
 * @param library - The definitions and behavior this compile runs
 * @returns Compiled numeric circuit
 */
export function compileForSimulation(flatCircuit: FlatCircuit, library: Library): NumericCircuit {
  const { definitions, behaviors } = library;
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
  const portMask = new Uint32Array(totalPortsWithTopLevel);
  const inputPortNames: string[] = new Array(totalPortsWithTopLevel);

  // Add top-level inputs first (they act as sources for nodes)
  let topLevelPortIdx = totalPorts;
  for (const input of flatCircuit.topLevelInputs) {
    const key = `${TOP_LEVEL_NODE}.${input.name}`;
    portKeyToIndex.set(key, topLevelPortIdx);
    indexToPortKey[topLevelPortIdx] = key;
    portIsOutput[topLevelPortIdx] = 1; // Top-level inputs are outputs from the boundary
    portIsBus[topLevelPortIdx] = input.portType.kind === 'bus' ? 1 : 0;
    portMask[topLevelPortIdx] = maskFor(input.portType, `input '${input.name}'`);
    topLevelPortIdx++;
  }

  // Add top-level outputs
  for (const output of flatCircuit.topLevelOutputs) {
    const key = `${TOP_LEVEL_NODE}.${output.name}`;
    portKeyToIndex.set(key, topLevelPortIdx);
    indexToPortKey[topLevelPortIdx] = key;
    portIsOutput[topLevelPortIdx] = 0; // Top-level outputs are inputs to the boundary
    portIsBus[topLevelPortIdx] = output.portType.kind === 'bus' ? 1 : 0;
    portMask[topLevelPortIdx] = maskFor(output.portType, `output '${output.name}'`);
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
      portMask[portIdx] = maskFor(input.portType, `port '${key}'`);
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
      portMask[portIdx] = maskFor(output.portType, `port '${key}'`);
      portIdx++;
    }
  }

  // ============================================================================
  // Step 4: Build primitive type indices
  // ============================================================================

  // One type index per primitive type in this circuit, into dispatch tables
  // built from this compile's behavior and nothing else.
  const primitiveTypeIndex = new Uint16Array(nodeCount);
  const dispatch = createDispatchTables();

  for (let i = 0; i < nodeCount; i++) {
    primitiveTypeIndex[i] = typeIndexFor(dispatch, flatCircuit.nodes[i].primitiveType, behaviors);
  }

  // ============================================================================
  // Step 5: Convert string dependents to numeric
  // ============================================================================

  const dependents: Uint32Array[] = new Array(nodeCount);

  for (let i = 0; i < nodeCount; i++) {
    const node = flatCircuit.nodes[i];
    const deps = node.dependents
      .map((depId) => nodeIdToIndex.get(depId))
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
      const inputIdx = node.inputs.findIndex((p) => p.name === src.portName);
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
        const srcPortIdx = srcNode.outputs.findIndex((p) => p.name === src.sourcePortName);
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
    const resolvedComp = definitions.resolveCircuit(node.primitiveType);
    if (resolvedComp) checkClocking(node, resolvedComp);
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
    primitiveTypeNames: dispatch.typeNames,
    evaluators: dispatch.evaluators,
    onTicks: dispatch.onTicks,
    nodePortStart,
    nodeInputCount,
    nodeOutputCount,
    dependents,
    inputSourceNode,
    inputSourcePort,
    inputPortNames,
    portIsOutput,
    portIsBus,
    portMask,
    isSourceNode,
    isStateOutputNode,
    hasState,
    readsTopLevelInput,
    flatCircuit,
  };
}

/** Widest bus the simulator stores. Values live in a Uint32Array. */
export const MAX_BUS_WIDTH = 32;

/**
 * The mask every value written to a port of this type is ANDed with. Throws for
 * a width the simulator can't hold, so a too-wide bus fails at compile time
 * rather than losing its high bits on the first write.
 */
function maskFor(portType: PortType, where: string): number {
  if (portType.kind !== 'bus') return 1;
  const width = portType.width;
  if (!Number.isInteger(width) || width < 1 || width > MAX_BUS_WIDTH) {
    throw new Error(
      `${where} is bus(${width}); buses must be 1 to ${MAX_BUS_WIDTH} bits wide. ` +
        `Split a wider value into several buses of ${MAX_BUS_WIDTH} bits or fewer.`,
    );
  }
  return width === MAX_BUS_WIDTH ? 0xffffffff : 2 ** width - 1;
}

/**
 * The simulator has one global clock and every state block updates on its
 * rising edge. A component that asks for anything else (a falling edge, a
 * clock of its own, or a second clock) would otherwise be run on that rising
 * edge without a word, so it is rejected here, naming the node.
 */
function checkClocking(node: FlatNode, component: CircuitIR): void {
  const where = `Node '${node.id}' (${node.primitiveType})`;
  const clockNames = (component.clocks ?? []).map((c) => c.name);
  if (clockNames.length > 1) {
    throw new Error(
      `${where} declares ${clockNames.length} clocks (${clockNames.join(', ')}). ` +
        `The simulator runs one global rising-edge clock; multiple clock domains are not supported.`,
    );
  }
  for (const block of component.state ?? []) {
    if (block.edge !== undefined && block.edge !== 'rising') {
      throw new Error(
        `${where} updates state '${block.name}' on the ${block.edge} clock edge. ` +
          `The simulator only supports the rising edge of the one global clock.`,
      );
    }
    if (block.clockRef !== undefined && !clockNames.includes(block.clockRef)) {
      throw new Error(
        `${where} clocks state '${block.name}' from '${block.clockRef}', which is not its clock. ` +
          `Gated or derived clocks are not supported; use an enable input on the global clock instead.`,
      );
    }
  }
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
  flatState: {
    currentState: Map<string, PrimitiveState>;
    nextState: Map<string, PrimitiveState>;
    clocks: Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>;
    cycleCount: number;
  },
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
    clocks: copyClocks(flatState.clocks),
    cycleCount: flatState.cycleCount,
  };
}

/**
 * Convert numeric sequential state back to flat sequential state.
 */
export function toFlatSequentialState(
  circuit: NumericCircuit,
  numericState: NumericSequentialState,
): {
  currentState: Map<string, PrimitiveState>;
  nextState: Map<string, PrimitiveState>;
  clocks: Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>;
  cycleCount: number;
} {
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
    clocks: copyClocks(numericState.clocks),
    cycleCount: numericState.cycleCount,
  };
}

type ClockMap = Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>;

/** Clock entries are mutable objects; a snapshot has to own its copy. */
function copyClocks(clocks: ClockMap): ClockMap {
  const copy: ClockMap = new Map();
  for (const [key, state] of clocks) copy.set(key, { ...state });
  return copy;
}

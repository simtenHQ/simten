/**
 * Flat Circuit Simulator
 *
 * Simulates flattened circuits (primitives only).
 * This is MUCH simpler than the hierarchical simulator because:
 * - No recursive composite evaluation
 * - No scope remapping
 * - No prefix stripping/adding
 * - State keys match node IDs exactly
 */

import type { BitValue, BusValue } from '../types/ir-v0.1';
import type { PrimitiveState, ClockEdges } from './primitive-interface';
import type { FlatCircuit, FlatNode, FlatConnection } from './elaboration';
import { getPrimitiveEvaluator, PRIMITIVE_DEFINITIONS } from './primitives';
import { topologicalSortFlat, TOP_LEVEL_NODE } from './elaboration';
import { useComponentLibraryStore, type ComponentLibraryStore } from '../stores/component-library-store';

/**
 * Port value storage using full paths
 * Key format: "nodeId.portName" (e.g., "cpu.alu.adder1.out")
 * Top-level ports use TOP_LEVEL_NODE: "__top__.inputA"
 */
export type FlatPortValueMap = Map<string, BitValue | BusValue>;

/**
 * Sequential state for flat circuits
 * State keys are full paths (e.g., "cpu.alu.reg1")
 */
export interface FlatSequentialState {
  // Node state: full path -> current state value
  currentState: Map<string, PrimitiveState>;
  nextState: Map<string, PrimitiveState>;

  // Clock signals: "fullPath.clockName" -> edge
  clocks: Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>;

  // Simulation cycle counter
  cycleCount: number;
}

/**
 * Simulation result
 */
export interface FlatSimulationResult {
  portValues: FlatPortValueMap;
  sequentialState?: FlatSequentialState;
  error?: string;
}

/**
 * Create port key from node ID and port name
 */
function portKey(nodeId: string, portName: string): string {
  return `${nodeId}.${portName}`;
}

/**
 * Initialize sequential state for all stateful primitives in flat circuit
 */
export function initializeFlatSequentialState(
  flatCircuit: FlatCircuit
): FlatSequentialState {
  const currentState = new Map<string, PrimitiveState>();
  const nextState = new Map<string, PrimitiveState>();
  const clocks = new Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>();

  const library = useComponentLibraryStore.getState();

  for (const node of flatCircuit.nodes) {
    const component = library.resolveComponent(node.primitiveType);
    if (!component) continue;

    // Check if this primitive has state
    if (component.implementation.kind === 'primitive' && component.state.length > 0) {
      const stateBlock = component.state[0];

      // Check for instance-specific initial value in node.arguments
      let initialValue = stateBlock.initialValue;

      if ('initial' in node.arguments && node.arguments.initial !== undefined) {
        // Register/DFlipFlop initial value
        initialValue = node.arguments.initial as number | boolean;
      } else if ('init' in node.arguments && node.arguments.init !== undefined) {
        // RAM initial values (array or object)
        const initData = node.arguments.init;
        const memory = new Map<number, number>();

        if (Array.isArray(initData)) {
          initData.forEach((value, index) => {
            if (typeof value === 'number') {
              memory.set(index, value);
            }
          });
        } else if (typeof initData === 'object') {
          for (const [key, value] of Object.entries(initData)) {
            const addr = parseInt(key, 10);
            if (!isNaN(addr) && typeof value === 'number') {
              memory.set(addr, value);
            }
          }
        }

        initialValue = { data: memory, addressWidth: 8, dataWidth: 8 };
      } else if ('data' in node.arguments && node.arguments.data !== undefined) {
        // ROM initialization
        const romData = node.arguments.data;
        const memory = new Map<number, number>();

        if (Array.isArray(romData)) {
          romData.forEach((value, index) => {
            if (typeof value === 'number') {
              memory.set(index, Math.floor(value));
            }
          });
        } else if (typeof romData === 'object' && !Array.isArray(romData)) {
          Object.entries(romData).forEach(([addrStr, value]) => {
            const addr = Number(addrStr);
            if (Number.isInteger(addr) && typeof value === 'number') {
              memory.set(addr, Math.floor(value as number));
            }
          });
        }

        initialValue = { data: memory, addressWidth: 8, dataWidth: 8 };
      }

      // Convert StateValue to PrimitiveState
      let primitiveState: PrimitiveState;
      if (typeof initialValue === 'object' && 'data' in initialValue) {
        primitiveState = initialValue.data;
      } else {
        primitiveState = initialValue as BitValue | BusValue;
      }

      currentState.set(node.id, primitiveState);
      nextState.set(node.id, primitiveState);
    }

    // Initialize clocks
    for (const clock of node.clocks) {
      clocks.set(portKey(node.id, clock.name), {
        value: false,
        edge: 'none'
      });
    }

  }

  return {
    currentState,
    nextState,
    clocks,
    cycleCount: 0
  };
}

/**
 * Get input values for a flat node from port values
 */
function getNodeInputsFlat(
  node: FlatNode,
  connections: FlatConnection[],
  portValues: FlatPortValueMap,
  library: ComponentLibraryStore
): Map<string, BitValue | BusValue> {
  const inputs = new Map<string, BitValue | BusValue>();

  // NO SILENT DEFAULTS! Unconnected inputs will be undefined.
  // This makes wiring bugs loud and obvious during elaboration.

  // Fill in actual values from connections
  for (const conn of connections) {
    if (conn.target.nodeId === node.id) {
      const sourceKey = portKey(conn.source.nodeId, conn.source.portName);
      const value = portValues.get(sourceKey);

      if (value !== undefined) {
        inputs.set(conn.target.portName, value);
      }
    }
  }

  // Provide default values for unconnected inputs
  // Sequential nodes (registers, etc.) only use their inputs during sequential update,
  // not during combinational evaluation, so they don't need defaults here.
  const primitiveDef = PRIMITIVE_DEFINITIONS[node.primitiveType];
  const isStateOnly = primitiveDef?.outputDependency === 'state-only';
  const hasState = primitiveDef?.state && primitiveDef.state.length > 0;

  if (!isStateOnly && !hasState) {
    for (const inputPort of node.inputs) {
      if (!inputs.has(inputPort.name)) {
        // Provide sensible default: false for Bit, 0 for Bus
        // Many primitives (like Adder's carry_in) expect optional inputs with defaults
        const defaultValue = inputPort.portType.kind === 'bit' ? false : 0;
        inputs.set(inputPort.name, defaultValue);
      }
    }
  }

  return inputs;
}

/**
 * Evaluate a single flat node (always a primitive)
 */
function evaluateFlatNode(
  node: FlatNode,
  inputs: Map<string, BitValue | BusValue>,
  seqState?: FlatSequentialState
): Map<string, BitValue | BusValue> {
  // Special handling for source components
  if (node.primitiveType === 'Switch' || node.primitiveType === 'Button') {
    const value = Boolean(node.arguments.value ?? false);
    return new Map([['out', value]]);
  }

  if (node.primitiveType === 'Input') {
    const value = typeof node.arguments.value === 'number' ? node.arguments.value : 0;
    return new Map([['out', value]]);
  }

  if (node.primitiveType === 'Constant') {
    const value = typeof node.arguments.value === 'number' ? node.arguments.value : 0;
    return new Map([['out', value]]);
  }

  // General mechanism: pass all node arguments to evaluate function with __ prefix
  if (node.arguments && Object.keys(node.arguments).length > 0) {
    const extendedInputs = new Map(inputs);
    for (const [key, value] of Object.entries(node.arguments)) {
      extendedInputs.set(`__${key}`, value as any);
    }
    inputs = extendedInputs;
  }

  const evaluator = getPrimitiveEvaluator(node.primitiveType);

  if (!evaluator) {
    console.warn(`No evaluator found for primitive: ${node.primitiveType}`);
    const outputs = new Map<string, BitValue | BusValue>();
    for (const outputPort of node.outputs) {
      outputs.set(outputPort.name, outputPort.portType.kind === 'bit' ? false : 0);
    }
    return outputs;
  }

  // Get current state (using full path as key - no scope remapping!)
  const currentState = seqState?.currentState.get(node.id);

  // Evaluate primitive
  const outputs = evaluator.evaluate(inputs, currentState);

  return outputs;
}

/**
 * Run flat combinational simulation
 * MUCH simpler than hierarchical version - no recursion, no scope remapping!
 */
export function runFlatCombinationalSimulation(
  flatCircuit: FlatCircuit,
  seqState?: FlatSequentialState,
  initialPortValues?: FlatPortValueMap
): FlatSimulationResult {
  const portValues: FlatPortValueMap = new Map();

  // Copy initial port values (for top-level inputs)
  if (initialPortValues) {
    for (const [key, value] of initialPortValues.entries()) {
      portValues.set(key, value);
    }
  }

  // Initialize top-level inputs with default values if not provided
  for (const input of flatCircuit.topLevelInputs) {
    const inputKey = portKey(TOP_LEVEL_NODE, input.name);
    if (!portValues.has(inputKey)) {
      const defaultValue = input.portType.kind === 'bit' ? false : 0;
      portValues.set(inputKey, defaultValue);
    }
  }

  const library = useComponentLibraryStore.getState();

  // Get evaluation order using flat topological sort
  const evalOrder = topologicalSortFlat(flatCircuit.nodes, flatCircuit.connections, library);

  if (!evalOrder) {
    return {
      portValues,
      sequentialState: seqState,
      error: 'Cycle detected in circuit'
    };
  }

  // Build node lookup map
  const nodeMap = new Map(flatCircuit.nodes.map(n => [n.id, n]));

  // Evaluate each primitive in order
  for (const nodeId of evalOrder) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    // Get input values
    const inputs = getNodeInputsFlat(node, flatCircuit.connections, portValues, library);

    // Store input values
    for (const [portName, value] of inputs.entries()) {
      portValues.set(portKey(nodeId, portName), value);
    }

    // Evaluate primitive (no composite recursion!)
    const outputs = evaluateFlatNode(node, inputs, seqState);

    // Store output values
    for (const [portName, value] of outputs.entries()) {
      portValues.set(portKey(nodeId, portName), value);
    }

  }

  // Propagate to top-level outputs
  for (const conn of flatCircuit.connections) {
    if (conn.target.nodeId === TOP_LEVEL_NODE || conn.target.nodeId === '') {
      const sourceKey = portKey(conn.source.nodeId, conn.source.portName);
      const targetKey = portKey(conn.target.nodeId, conn.target.portName);
      const sourceValue = portValues.get(sourceKey);
      if (sourceValue !== undefined) {
        portValues.set(targetKey, sourceValue);
      }
    }
  }

  return {
    portValues,
    sequentialState: seqState
  };
}

/**
 * Update clock states for flat circuit
 * MUCH simpler - just iterate flat list, no recursion!
 */
function updateFlatClockStates(
  flatCircuit: FlatCircuit,
  seqState: FlatSequentialState
): void {
  for (const node of flatCircuit.nodes) {
    for (const clockPort of node.clocks) {
      const clockKey = portKey(node.id, clockPort.name);
      const clockState = seqState.clocks.get(clockKey);
      if (!clockState) continue;

      // Always set rising edge on every tick (global clock)
      clockState.edge = 'rising';
      clockState.value = true;
    }
  }
}

/**
 * Update sequential states for flat circuit
 * MUCH simpler - no recursion, no scope remapping!
 */
function updateFlatSequentialStates(
  flatCircuit: FlatCircuit,
  portValues: FlatPortValueMap,
  seqState: FlatSequentialState
): void {
  const library = useComponentLibraryStore.getState();

  for (const node of flatCircuit.nodes) {
    const component = library.resolveComponent(node.primitiveType);
    if (!component) continue;

    // Check if this primitive has state
    if (component.implementation.kind === 'primitive' && component.state.length > 0) {
      const evaluator = getPrimitiveEvaluator(node.primitiveType);
      if (!evaluator || !evaluator.updateState) continue;

      // Get node inputs
      const inputs = getNodeInputsFlat(node, flatCircuit.connections, portValues, library);

      // Build clock edges map
      const clockEdges: ClockEdges = {};
      for (const clockPort of node.clocks) {
        const clockKey = portKey(node.id, clockPort.name);
        const clockState = seqState.clocks.get(clockKey);
        if (clockState) {
          clockEdges[clockPort.name] = clockState.edge;
        }
      }

      // Update state (using full path - no scope remapping!)
      const currentState = seqState.currentState.get(node.id);
      const nextState = evaluator.updateState(inputs, currentState, clockEdges);
      seqState.nextState.set(node.id, nextState);
    }
  }
}

/**
 * Commit next state to current state
 */
function commitFlatSequentialState(seqState: FlatSequentialState): void {
  // Copy next state to current state
  for (const [nodeId, value] of seqState.nextState.entries()) {
    if (value instanceof Map) {
      seqState.currentState.set(nodeId, new Map(value));
    } else {
      seqState.currentState.set(nodeId, value);
    }
  }

  // Copy current state to next state for next cycle
  for (const [nodeId, value] of seqState.currentState.entries()) {
    if (value instanceof Map) {
      seqState.nextState.set(nodeId, new Map(value));
    } else {
      seqState.nextState.set(nodeId, value);
    }
  }

  seqState.cycleCount++;
}

/**
 * Run full flat simulation tick (combinational + sequential phases)
 */
export function runFlatSimulationTick(
  flatCircuit: FlatCircuit,
  seqState: FlatSequentialState
): FlatSimulationResult {
  // Phase 1: Combinational evaluation (reads current state)
  const combResult = runFlatCombinationalSimulation(flatCircuit, seqState);

  if (combResult.error) {
    return combResult;
  }

  // Phase 2: Update clock states
  updateFlatClockStates(flatCircuit, seqState);

  // Phase 3: Sequential state update
  updateFlatSequentialStates(flatCircuit, combResult.portValues, seqState);

  // Phase 4: Commit state
  commitFlatSequentialState(seqState);

  // Phase 5: Re-evaluate with new state
  const finalResult = runFlatCombinationalSimulation(flatCircuit, seqState);

  return finalResult;
}

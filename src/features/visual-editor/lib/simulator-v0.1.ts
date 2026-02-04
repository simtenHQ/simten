/**
 * Circuit Simulator (IR v0.1)
 *
 * Executes circuit logic using the IR v0.1 format with name-based ports.
 * This replaces the legacy index-based simulator.
 *
 * Key differences from legacy simulator:
 * - Works with Circuit/Node instead of Component
 * - Uses name-based ports (PortPath) instead of index-based ports
 * - Cleaner port lookup (no index mapping needed)
 * - Direct integration with ComponentLibrary for resolving component specs
 */

import type {
  Circuit,
  Node,
  Connection,
  PortPath,
  BitValue,
  BusValue,
  ClockState,
} from '../types/ir-v0.1';
import type { ClockEdges, PrimitiveState, EvaluationContext } from './primitive-interface';
import { getPrimitiveEvaluator } from './primitives';
import { useComponentLibraryStore } from '../stores/component-library-store';

/**
 * Port value storage using PortPath keys
 * Key format: "nodeId.portName" (e.g., "and1.out", "switch1.out")
 * Circuit-level ports use empty nodeId: ".inputA", ".outputZ"
 */
export type PortValueMap = Map<string, BitValue | BusValue>;

/**
 * Sequential state for all stateful nodes
 */
export interface SequentialState {
  // Node state: nodeId -> current state value
  currentState: Map<string, PrimitiveState>;
  nextState: Map<string, PrimitiveState>;

  // Clock signals: nodeId.clockName -> clock state
  clocks: Map<string, ClockState>;

  // Simulation cycle counter
  cycleCount: number;
}

/**
 * Simulation result
 */
export interface SimulationResult {
  portValues: PortValueMap;
  sequentialState?: SequentialState;
  error?: string;
}

/**
 * Create port key from PortPath
 */
function portPathKey(path: PortPath): string {
  return path.nodeId === '' ? `.${path.portName}` : `${path.nodeId}.${path.portName}`;
}

/**
 * Initialize sequential state for all stateful nodes (recursive for composites)
 */
export function initializeSequentialState(circuit: Circuit): SequentialState {
  const currentState = new Map<string, PrimitiveState>();
  const nextState = new Map<string, PrimitiveState>();
  const clocks = new Map<string, ClockState>();

  const library = useComponentLibraryStore.getState();

  /**
   * Recursively initialize state for a circuit and all its nested composites
   * @param nodeIdPrefix - Prefix for node IDs (e.g., "toggler1." for nodes inside toggler1)
   */
  function initCircuit(circuit: Circuit, nodeIdPrefix: string = '') {
    for (const node of circuit.nodes) {
      const componentDef = library.resolveComponent(node.componentRef);
      if (!componentDef) continue;

      // Full node ID including prefix (e.g., "toggler1.ff" for ff inside toggler1)
      const fullNodeId = nodeIdPrefix + node.id;

      // Check if this is a primitive with state
      if (componentDef.implementation.kind === 'primitive' && componentDef.state.length > 0) {
        // Initialize state for primitive sequential components
        const stateBlock = componentDef.state[0];

        // Check for instance-specific initial value in node.arguments
        // For Register: node myReg: Register(initial=4)
        // For RAM: node ram: RAM(init=[3,4,5]) or RAM(init={64:3, 65:4})
        let initialValue = stateBlock.initialValue;

        if ('initial' in node.arguments && node.arguments.initial !== undefined) {
          // Register/DFlipFlop initial value
          initialValue = node.arguments.initial as number | boolean;
        } else if ('init' in node.arguments && node.arguments.init !== undefined) {
          // RAM initial values (array or object)
          const initData = node.arguments.init;
          const memory = new Map<number, number>();

          if (Array.isArray(initData)) {
            // Array format: [val0, val1, val2, ...]
            initData.forEach((value, index) => {
              if (typeof value === 'number') {
                memory.set(index, value);
              }
            });
          } else if (typeof initData === 'object') {
            // Object format: {addr0: val0, addr1: val1, ...}
            for (const [key, value] of Object.entries(initData)) {
              const addr = parseInt(key, 10);
              if (!isNaN(addr) && typeof value === 'number') {
                memory.set(addr, value);
              }
            }
          }

          // Create MemoryValue structure
          initialValue = { data: memory, addressWidth: 8, dataWidth: 8 };
        } else if ('data' in node.arguments && node.arguments.data !== undefined) {
          // ROM initialization from 'data' argument
          const romData = node.arguments.data;
          const memory = new Map<number, number>();
          const maxAddress = 255; // ROM is 256 addresses (0-255)
          const maxValue = 255; // 8-bit data (0-255)

          if (Array.isArray(romData)) {
            // Dense initialization: [val0, val1, val2, ...]
            if (romData.length > 256) {
              throw new Error(
                `ROM '${node.label}' data array exceeds 256 bytes (got ${romData.length}). ` +
                  `ROM size is fixed at 256 addresses. Consider splitting data or using RAM.`
              );
            }

            romData.forEach((value, index) => {
              if (typeof value !== 'number') {
                throw new Error(
                  `ROM '${node.label}' data at index ${index} must be a number (got ${typeof value})`
                );
              }
              if (value < 0) {
                throw new Error(
                  `ROM '${node.label}' data value at index ${index} is negative (got ${value}). ` +
                    `Values must be 0-255.`
                );
              }
              if (value > maxValue) {
                throw new Error(
                  `ROM '${node.label}' data value at index ${index} exceeds 8-bit range ` +
                    `(got ${value}, max ${maxValue}). Truncate value or use larger data width.`
                );
              }
              memory.set(index, Math.floor(value)); // Ensure integer
            });
          } else if (typeof romData === 'object' && !Array.isArray(romData)) {
            // Sparse initialization: {addr: value, ...}
            Object.entries(romData).forEach(([addrStr, value]) => {
              const addr = Number(addrStr);

              if (!Number.isInteger(addr) || addr < 0) {
                throw new Error(
                  `ROM '${node.label}' data address ${addrStr} is invalid. ` +
                    `Addresses must be non-negative integers.`
                );
              }
              if (addr > maxAddress) {
                throw new Error(
                  `ROM '${node.label}' data address ${addr} exceeds address range ` +
                    `(max ${maxAddress}). ROM is 256 addresses (0-255).`
                );
              }
              if (typeof value !== 'number') {
                throw new Error(
                  `ROM '${node.label}' data value at address ${addr} must be a number ` +
                    `(got ${typeof value})`
                );
              }
              if (value < 0) {
                throw new Error(
                  `ROM '${node.label}' data value at address ${addr} is negative (got ${value}). ` +
                    `Values must be 0-255.`
                );
              }
              if (value > maxValue) {
                throw new Error(
                  `ROM '${node.label}' data value at address ${addr} exceeds 8-bit range ` +
                    `(got ${value}, max ${maxValue}).`
                );
              }
              memory.set(addr, Math.floor(value as number));
            });
          } else {
            throw new Error(
              `ROM '${node.label}' data argument must be an array [0, 1, 2, ...] ` +
                `or object {0: 1, 64: 2, ...} (got ${typeof romData})`
            );
          }

          // Create MemoryValue structure
          initialValue = { data: memory, addressWidth: 8, dataWidth: 8 };
        }

        // Convert StateValue to PrimitiveState
        let primitiveState: PrimitiveState;
        if (typeof initialValue === 'object' && 'data' in initialValue) {
          // MemoryValue -> Map<number, number>
          primitiveState = initialValue.data;
        } else {
          // BitValue or BusValue
          primitiveState = initialValue as BitValue | BusValue;
        }

        currentState.set(fullNodeId, primitiveState);
        nextState.set(fullNodeId, primitiveState);
      }

      // Check if this is a composite - recurse into it
      if (componentDef.implementation.kind === 'composite') {
        // Recursively initialize state for nodes inside this composite
        initCircuit(componentDef, fullNodeId + '.');
      }

      // Initialize clocks for nodes with clock inputs
      for (const clock of node.clocks) {
        const clockKey = `${fullNodeId}.${clock.name}`;
        clocks.set(clockKey, {
          value: false,
          edge: 'none',
        });
      }
    }
  }

  // Start recursion from top-level circuit
  initCircuit(circuit);

  return {
    currentState,
    nextState,
    clocks,
    cycleCount: 0,
  };
}

/**
 * Topological sort to determine evaluation order
 * Returns node IDs in dependency order, or null if cycle detected
 *
 * Sequential nodes with state-only outputs (DFlipFlop, Register) are evaluated FIRST
 * because their outputs come from stored state, not computed from inputs.
 *
 * Sequential nodes with input-dependent outputs (RAM) are evaluated in dependency order
 * because their outputs depend on their inputs (e.g., RAM read is combinational).
 */
function topologicalSort(circuit: Circuit): string[] | null {
  const library = useComponentLibraryStore.getState();

  const stateOnlyNodes: string[] = []; // DFlipFlop, Register - outputs from state only
  const sinkNodes: string[] = [];      // Screen, audio, UART - consume but don't feed back
  const dependentNodes: string[] = []; // All other nodes (including RAM)

  // Separate nodes into state-only, sink, and input-dependent
  for (const node of circuit.nodes) {
    const componentDef = library.resolveComponent(node.componentRef);
    if (!componentDef) continue;

    // Check if this is a sink node (Screen, audio devices, etc.)
    // Sink nodes' outputs don't participate in combinational feedback
    const isSink = componentDef.metadata?.kind === 'sink';

    // Check if this is a state-only node (outputs come from state, not inputs)
    // These nodes' outputs are state-dependent, so they don't create combinational cycles
    const isStateOnly = componentDef.metadata?.outputDependency === 'state-only';

    if (isSink) {
      sinkNodes.push(node.id);
    } else if (isStateOnly) {
      stateOnlyNodes.push(node.id);
    } else {
      dependentNodes.push(node.id);
    }
  }

  // Build dependency graph for all dependent nodes (combinational + RAM)
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  // Initialize graph
  for (const nodeId of dependentNodes) {
    graph.set(nodeId, new Set());
    inDegree.set(nodeId, 0);
  }

  // Build edges: for each connection, source -> target
  const nodeSet = new Set(dependentNodes);
  const sinkSet = new Set(sinkNodes);

  for (const conn of circuit.connections) {
    const source = conn.source.nodeId;
    const target = conn.target.nodeId;

    // Skip circuit-level ports (empty nodeId)
    if (source === '' || target === '') continue;

    // Skip connections FROM sink nodes (their outputs don't feed back)
    if (sinkSet.has(source)) continue;

    // Only consider dependent nodes (not state-only or sink nodes)
    if (!nodeSet.has(source) || !nodeSet.has(target)) continue;

    if (!graph.get(source)?.has(target)) {
      graph.get(source)?.add(target);
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  const result: string[] = [];

  // Start with nodes that have no dependencies
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    for (const neighbor of graph.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for cycles
  if (result.length !== dependentNodes.length) {
    return null; // Cycle detected
  }

  // Return evaluation order:
  // 1. State-only nodes (DFlipFlop, Register) - outputs from state
  // 2. Dependent nodes (combinational + RAM) - in topological order
  // 3. Sink nodes (Screen, audio, UART) - evaluated last, outputs don't feed back
  return [...stateOnlyNodes, ...result, ...sinkNodes];
}

/**
 * Get input values for a node from port values
 */
function getNodeInputs(
  node: Node,
  connections: Connection[],
  portValues: PortValueMap
): Map<string, BitValue | BusValue> {
  const inputs = new Map<string, BitValue | BusValue>();

  // Initialize all inputs to default values
  for (const inputPort of node.inputs) {
    inputs.set(inputPort.name, inputPort.portType.kind === 'bit' ? false : 0);
  }

  // Fill in actual values from connections
  for (const conn of connections) {
    if (conn.target.nodeId === node.id) {
      const sourceKey = portPathKey(conn.source);
      const value = portValues.get(sourceKey);

      // DEBUG: Log when reading reset/enable for muxes in Counter
      if (node.id.includes('mux') && (conn.target.portName === 'sel' || conn.target.portName === 'in0' || conn.target.portName === 'in1')) {
        console.log('[getNodeInputs] Mux connection:', {
          nodeId: node.id,
          targetPort: conn.target.portName,
          sourceKey,
          value,
          availableKeys: Array.from(portValues.keys()).filter(k => k.includes('reset') || k.includes('enable') || k === sourceKey),
        });
      }

      if (value !== undefined) {
        inputs.set(conn.target.portName, value);
      }
    }
  }

  return inputs;
}

/**
 * Evaluate a single node
 */
function evaluateNode(
  node: Node,
  inputs: Map<string, BitValue | BusValue>,
  seqState?: SequentialState,
  nodeIdPrefix: string = ''
): Map<string, BitValue | BusValue> {
  // Special handling for source components (Switch, Input, Button, Constant)
  // These read their values from node.arguments, not from inputs
  if (node.componentRef === 'Switch' || node.componentRef === 'Button') {
    const value = Boolean(node.arguments.value ?? false);
    return new Map([['out', value]]);
  }

  if (node.componentRef === 'Input') {
    const value = typeof node.arguments.value === 'number' ? node.arguments.value : 0;
    return new Map([['out', value]]);
  }

  if (node.componentRef === 'Constant') {
    const value = typeof node.arguments.value === 'number' ? node.arguments.value : 0;
    return new Map([['out', value]]);
  }

  // Special handling for BitSlice: pass parameters as special inputs
  if (node.componentRef === 'BitSlice') {
    const low = (node.arguments.low as number) ?? 0;
    const high = (node.arguments.high as number) ?? 2;
    // Add parameters to inputs map
    const extendedInputs = new Map(inputs);
    extendedInputs.set('__low', low);
    extendedInputs.set('__high', high);
    inputs = extendedInputs;
  }

  // General mechanism: pass all node arguments to evaluate function with __ prefix
  // This allows primitives to access parameterization (e.g., width, value, etc.)
  if (node.arguments && Object.keys(node.arguments).length > 0) {
    const extendedInputs = new Map(inputs);
    for (const [key, value] of Object.entries(node.arguments)) {
      // Pass arguments as-is - primitives will handle type checking
      extendedInputs.set(`__${key}`, value as any);
    }
    inputs = extendedInputs;
  }

  const evaluator = getPrimitiveEvaluator(node.componentRef);

  if (!evaluator) {
    // No primitive evaluator - check if it's a composite component
    const library = useComponentLibraryStore.getState();
    const componentDef = library.resolveComponent(node.componentRef);

    if (componentDef && componentDef.implementation.kind === 'composite') {
      // Evaluate composite component by simulating its internal circuit
      // Pass the node ID as prefix so internal nodes can find their state
      return evaluateComposite(componentDef, inputs, seqState, nodeIdPrefix + node.id);
    }

    console.warn(`No evaluator found for component: ${node.componentRef}`);
    // Return default values for all outputs
    const outputs = new Map<string, BitValue | BusValue>();
    for (const outputPort of node.outputs) {
      outputs.set(outputPort.name, outputPort.portType.kind === 'bit' ? false : 0);
    }
    return outputs;
  }

  // Get current state for sequential components
  // Use prefixed node ID to look up state
  const fullNodeId = nodeIdPrefix + node.id;
  const currentState = seqState?.currentState.get(fullNodeId);

  // Create evaluation context for DMA-like state access
  const context: EvaluationContext = {
    seqState,
    nodeId: fullNodeId,
  };

  // Evaluate
  return evaluator.evaluate(inputs, currentState, context);
}

/**
 * Evaluate a composite component by simulating its internal circuit
 * @param parentNodeId - The ID of the parent node (e.g., "toggler1") used to scope internal state
 */
function evaluateComposite(
  componentDef: Circuit,
  inputs: Map<string, BitValue | BusValue>,
  seqState?: SequentialState,
  parentNodeId?: string
): Map<string, BitValue | BusValue> {
  // Create initial port values with circuit-level inputs
  const initialPortValues: PortValueMap = new Map();

  // DEBUG: Log Counter composite inputs
  if (componentDef.name === 'Counter') {
    console.log('[evaluateComposite] Counter inputs:', Object.fromEntries(inputs));
  }

  // Map node inputs to circuit-level input ports
  for (const [inputName, inputValue] of inputs.entries()) {
    const inputKey = portPathKey({ nodeId: '', portName: inputName });
    initialPortValues.set(inputKey, inputValue);
  }

  // DEBUG: Log Counter initial port values
  if (componentDef.name === 'Counter') {
    console.log('[evaluateComposite] Counter initialPortValues:', Object.fromEntries(initialPortValues));
  }

  // Create scoped sequential state for this composite instance
  // Maps internal node IDs (e.g., "ff") to prefixed keys in global state (e.g., "toggler1.ff")
  let scopedSeqState: SequentialState | undefined = undefined;
  if (seqState && parentNodeId) {
    const prefix = parentNodeId + '.';
    scopedSeqState = {
      currentState: new Map(),
      nextState: new Map(),
      clocks: new Map(),
      cycleCount: seqState.cycleCount,
    };

    // Remap state keys: "toggler1.ff" -> "ff" for internal circuit evaluation
    for (const [fullKey, value] of seqState.currentState.entries()) {
      if (fullKey.startsWith(prefix)) {
        const localKey = fullKey.slice(prefix.length);
        scopedSeqState.currentState.set(localKey, value);
      }
    }
    for (const [fullKey, value] of seqState.nextState.entries()) {
      if (fullKey.startsWith(prefix)) {
        const localKey = fullKey.slice(prefix.length);
        scopedSeqState.nextState.set(localKey, value);
      }
    }
    for (const [fullKey, value] of seqState.clocks.entries()) {
      if (fullKey.startsWith(prefix)) {
        const localKey = fullKey.slice(prefix.length);
        scopedSeqState.clocks.set(localKey, value);
      }
    }
  }

  // Simulate the internal circuit with initial input values and scoped state
  const result = runCombinationalSimulation(componentDef, scopedSeqState, initialPortValues);

  if (result.error) {
    console.error(`Error simulating composite ${componentDef.name}:`, result.error);
    // Return default values
    const outputs = new Map<string, BitValue | BusValue>();
    for (const outputPort of componentDef.outputs) {
      outputs.set(outputPort.name, outputPort.portType.kind === 'bit' ? false : 0);
    }
    return outputs;
  }

  // Extract outputs from the simulation result
  const outputs = new Map<string, BitValue | BusValue>();
  for (const outputPort of componentDef.outputs) {
    const outputKey = portPathKey({ nodeId: '', portName: outputPort.name });
    const outputValue = result.portValues.get(outputKey);
    outputs.set(
      outputPort.name,
      outputValue ?? (outputPort.portType.kind === 'bit' ? false : 0)
    );
  }

  return outputs;
}

/**
 * Update clock states using GLOBAL CLOCK approach (recursive for composites).
 * Each call to runSimulationTick represents one clock cycle,
 * so all clocks get a rising edge on each tick.
 *
 * This matches the behavior of Turing Complete and Logisim - users don't
 * wire clocks manually. The Step/Run/Pause buttons control the global clock.
 */
function updateClockStates(
  circuit: Circuit,
  seqState: SequentialState
): void {
  const library = useComponentLibraryStore.getState();

  /**
   * Recursively update clocks for circuit and nested composites
   */
  function updateCircuitClocks(circuit: Circuit, nodeIdPrefix: string = '') {
    for (const node of circuit.nodes) {
      const fullNodeId = nodeIdPrefix + node.id;

      // Update clocks for this node
      for (const clockPort of node.clocks) {
        const clockKey = `${fullNodeId}.${clockPort.name}`;
        const clockState = seqState.clocks.get(clockKey);
        if (!clockState) continue;

        // Always set rising edge on every tick
        // (The value doesn't matter for a global clock, only the edge matters)
        clockState.edge = 'rising';
        clockState.value = true; // Keep it high (doesn't affect behavior)
      }

      // If this is a composite, recurse into it
      const componentDef = library.resolveComponent(node.componentRef);
      if (componentDef && componentDef.implementation.kind === 'composite') {
        updateCircuitClocks(componentDef, fullNodeId + '.');
      }
    }
  }

  // Start recursion from top-level circuit
  updateCircuitClocks(circuit);
}

/**
 * Update sequential node states based on inputs and clock edges (recursive for composites)
 */
function updateSequentialStates(
  circuit: Circuit,
  portValues: PortValueMap,
  seqState: SequentialState
): void {
  const library = useComponentLibraryStore.getState();

  /**
   * Recursively update state for circuit and nested composites
   * @param nodeIdPrefix - Prefix for node IDs (e.g., "toggler1." for nodes inside toggler1)
   */
  function updateCircuitStates(circuit: Circuit, portValues: PortValueMap, nodeIdPrefix: string = '') {
    for (const node of circuit.nodes) {
      const componentDef = library.resolveComponent(node.componentRef);
      if (!componentDef) continue;

      const fullNodeId = nodeIdPrefix + node.id;

      // Check if this is a primitive with state
      if (componentDef.implementation.kind === 'primitive' && componentDef.state.length > 0) {
        const evaluator = getPrimitiveEvaluator(node.componentRef);
        if (!evaluator || !evaluator.updateState) continue;

        // Get node inputs
        const inputs = getNodeInputs(node, circuit.connections, portValues);

        // Build clock edges map
        const clockEdges: ClockEdges = {};
        for (const clockPort of node.clocks) {
          const clockKey = `${fullNodeId}.${clockPort.name}`;
          const clockState = seqState.clocks.get(clockKey);
          if (clockState) {
            clockEdges[clockPort.name] = clockState.edge;
          }
        }

        // Update state using full node ID
        const currentState = seqState.currentState.get(fullNodeId);

        // DEBUG: Log Register updateState calls
        if (node.componentRef === 'Register') {
          console.log('[updateSequentialState] Register updateState:', {
            nodeId: fullNodeId,
            inputs: Object.fromEntries(inputs),
            currentState,
            clockEdges,
          });
        }

        const nextState = evaluator.updateState(inputs, currentState, clockEdges);

        // DEBUG: Log Register next state
        if (node.componentRef === 'Register') {
          console.log('[updateSequentialState] Register nextState:', {
            nodeId: fullNodeId,
            nextState,
          });
        }

        seqState.nextState.set(fullNodeId, nextState);
      }

      // Check if this is a composite - recurse into it
      if (componentDef.implementation.kind === 'composite') {
        // Get inputs for this composite node
        const compositeInputs = getNodeInputs(node, circuit.connections, portValues);

        // Create scoped port values for internal circuit evaluation
        const internalPortValues: PortValueMap = new Map();

        // Map composite inputs to internal circuit-level inputs
        for (const [inputName, inputValue] of compositeInputs.entries()) {
          const inputKey = portPathKey({ nodeId: '', portName: inputName });
          internalPortValues.set(inputKey, inputValue);
        }

        // Create scoped sequential state for this composite instance
        const prefix = fullNodeId + '.';
        const scopedSeqState: SequentialState = {
          currentState: new Map(),
          nextState: new Map(),
          clocks: new Map(),
          cycleCount: seqState.cycleCount,
        };

        // Remap state keys: "toggler1.ff" -> "ff" for internal circuit evaluation
        for (const [fullKey, value] of seqState.currentState.entries()) {
          if (fullKey.startsWith(prefix)) {
            const localKey = fullKey.slice(prefix.length);
            scopedSeqState.currentState.set(localKey, value);
          }
        }
        for (const [fullKey, value] of seqState.nextState.entries()) {
          if (fullKey.startsWith(prefix)) {
            const localKey = fullKey.slice(prefix.length);
            scopedSeqState.nextState.set(localKey, value);
          }
        }
        for (const [fullKey, value] of seqState.clocks.entries()) {
          if (fullKey.startsWith(prefix)) {
            const localKey = fullKey.slice(prefix.length);
            scopedSeqState.clocks.set(localKey, value);
          }
        }

        // Simulate internal circuit to get port values for sequential state updates
        // Pass scoped state so internal sequential nodes can access their current state
        const internalResult = runCombinationalSimulation(componentDef, scopedSeqState, internalPortValues);

        // Recursively update state for nodes inside this composite
        updateCircuitStates(componentDef, internalResult.portValues, fullNodeId + '.');
      }
    }
  }

  // Start recursion from top-level circuit
  updateCircuitStates(circuit, portValues);
}

/**
 * Commit next state to current state
 */
function commitSequentialState(seqState: SequentialState): void {
  // Copy next state to current state
  for (const [nodeId, value] of seqState.nextState.entries()) {
    if (value instanceof Map) {
      // Deep copy for Map (memory)
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
 * Run combinational simulation (single evaluation pass)
 */
export function runCombinationalSimulation(
  circuit: Circuit,
  seqState?: SequentialState,
  initialPortValues?: PortValueMap
): SimulationResult {
  const portValues: PortValueMap = new Map();

  // Copy initial port values (used for composite component inputs)
  if (initialPortValues) {
    for (const [key, value] of initialPortValues.entries()) {
      portValues.set(key, value);
    }
  }

  // Get evaluation order
  const evalOrder = topologicalSort(circuit);

  if (!evalOrder) {
    return {
      portValues,
      sequentialState: seqState,
      error: 'Cycle detected in circuit',
    };
  }

  // Build node lookup map
  const nodeMap = new Map(circuit.nodes.map((n) => [n.id, n]));

  // Evaluate each node in dependency order
  for (const nodeId of evalOrder) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    // Get input values
    const inputs = getNodeInputs(node, circuit.connections, portValues);

    // Store input values in portValues (needed for LED and other output components)
    for (const [portName, value] of inputs.entries()) {
      const portKey = portPathKey({ nodeId, portName });
      portValues.set(portKey, value);
    }

    // Evaluate node
    // Note: nodeIdPrefix defaults to '' which is correct here since:
    // - For top-level circuits, nodes have direct IDs
    // - For composites, seqState is already scoped with local keys
    const outputs = evaluateNode(node, inputs, seqState, '');

    // Store output values
    for (const [portName, value] of outputs.entries()) {
      const portKey = portPathKey({ nodeId, portName });
      portValues.set(portKey, value);
    }
  }

  // Propagate values FROM circuit-level inputs TO internal nodes
  // (needed for composite component evaluation - inputs are mapped to nodeId: '')
  for (const conn of circuit.connections) {
    if (conn.source.nodeId === '' && conn.target.nodeId !== '') {
      const sourceKey = portPathKey(conn.source);
      const targetKey = portPathKey(conn.target);
      const sourceValue = portValues.get(sourceKey);
      if (sourceValue !== undefined) {
        portValues.set(targetKey, sourceValue);
      }
    }
  }

  // Propagate values to circuit-level outputs
  // (needed for composite component evaluation)
  for (const conn of circuit.connections) {
    // Check if target is a circuit-level output (empty nodeId)
    if (conn.target.nodeId === '') {
      const sourceKey = portPathKey(conn.source);
      const targetKey = portPathKey(conn.target);
      const sourceValue = portValues.get(sourceKey);
      if (sourceValue !== undefined) {
        portValues.set(targetKey, sourceValue);
      }
    }
  }

  return {
    portValues,
    sequentialState: seqState,
  };
}

/**
 * Run full simulation tick (combinational + sequential phases)
 */
export function runSimulationTick(circuit: Circuit, seqState: SequentialState): SimulationResult {
  // Phase 1: Combinational evaluation (reads current state)
  const combResult = runCombinationalSimulation(circuit, seqState);

  if (combResult.error) {
    return combResult;
  }

  // Phase 2: Update clock states (global clock - all clocks pulse on each tick)
  updateClockStates(circuit, seqState);

  // Phase 3: Sequential state update (computes next state)
  updateSequentialStates(circuit, combResult.portValues, seqState);

  // Phase 4: Commit state
  commitSequentialState(seqState);

  // Phase 5: Re-evaluate with new state
  const finalResult = runCombinationalSimulation(circuit, seqState);

  return finalResult;
}

/**
 * Get port value by path
 */
export function getPortValue(portValues: PortValueMap, path: PortPath): BitValue | BusValue {
  const key = portPathKey(path);
  return portValues.get(key) ?? false;
}

/**
 * Circuit Simulator
 *
 * Executes circuit logic by propagating values through components.
 * Uses topological sort to determine evaluation order and avoid cycles.
 *
 * Sequential Circuit Support:
 * - Two-phase execution: Combinational phase + State update phase
 * - Double buffering for state to prevent race conditions
 * - Clock edge detection for triggering state updates
 *
 * Architecture (Post-Refactoring):
 * - Uses unified PrimitiveEvaluator interface for all primitives
 * - All component-specific evaluation logic lives in primitives.ts
 * - Simulator is now generic - no hardcoded component type checks for logic
 * - Remaining type checks are only for data marshalling (array ↔ map conversion)
 *
 * Benefits of the unified interface:
 * 1. Single source of truth for primitive behavior
 * 2. Easy to add new primitives without modifying simulator
 * 3. Clean separation: primitives define WHAT, simulator defines WHEN
 * 4. Testable primitive logic in isolation
 * 5. Consistent execution model across all component types
 */

import type { Component, Connection, ComponentType, SequentialState, ClockSignal } from '../types';
import { getComponentSpec, isSequentialComponent, detectClockEdge } from '../types';
import { getPrimitiveEvaluator } from './primitives';
import type { ClockEdges } from './primitive-interface';

/**
 * Map old IR component types to new primitive names
 * Old IR: 'AND_GATE', 'D_FLIP_FLOP', etc.
 * New primitives: 'And', 'DFlipFlop', etc.
 */
function getComponentTypeToPrimitiveName(type: ComponentType): string | null {
  const mapping: Record<string, string> = {
    'SWITCH': 'Switch',
    'INPUT': 'Input',
    'LED': 'Led',
    'AND_GATE': 'And',
    'OR_GATE': 'Or',
    'NOT_GATE': 'Not',
    'NAND_GATE': 'Nand',
    'NOR_GATE': 'Nor',
    'XOR_GATE': 'Xor',
    'XNOR_GATE': 'Xnor',
    'BUFFER': 'Buffer',
    'D_FLIP_FLOP': 'DFlipFlop',
    'REGISTER': 'Register',
    'RAM': 'RAM',
    // New primitives (use primitive name directly as ComponentType)
    'Splitter8to8': 'Splitter8to8',
    'Splitter': 'Splitter',
    'BusAnd': 'BusAnd',
    'BusOr': 'BusOr',
    'BusNot': 'BusNot',
    'BusXor': 'BusXor',
    'Adder': 'Adder',
    'Multiplier': 'Multiplier',
    'Comparator': 'Comparator',
    'Mux': 'Mux',
    'Decoder': 'Decoder',
    'ROM': 'ROM',
    'Constant': 'Constant',
    'Probe': 'Probe',
    'Button': 'Button',
    'SevenSegment': 'SevenSegment',
    'HexDisplay': 'HexDisplay',
  };

  return mapping[type] ?? null;
}

/**
 * Port value map: componentId.portType.portIndex -> value
 * Example: "comp1.output.0" -> true (for single-bit)
 * Example: "comp1.output.0" -> 42 (for multi-bit bus)
 */
export type PortValueMap = Map<string, boolean | number>;

/**
 * Component output values: componentId -> output values array
 * Supports both boolean (single-bit) and number (multi-bit bus) values
 */
export type ComponentOutputs = Map<string, (boolean | number)[]>;

/**
 * Get port key for value lookup
 */
function getPortKey(
  componentId: string,
  portType: 'input' | 'output',
  portIndex: number
): string {
  return `${componentId}.${portType}.${portIndex}`;
}

// ===========================
// Sequential State Management
// ===========================

/**
 * Initialize sequential state for the circuit
 */
export function initializeSequentialState(
  components: Record<string, Component>
): SequentialState {
  const currentState = new Map<string, boolean | number | Map<number, number>>();
  const nextState = new Map<string, boolean | number | Map<number, number>>();

  // Initialize state for all sequential components
  for (const [compId, component] of Object.entries(components)) {
    if (isSequentialComponent(component.type)) {
      if (component.type === 'D_FLIP_FLOP' && 'state' in component) {
        currentState.set(compId, component.state);
        nextState.set(compId, component.state);
      } else if (component.type === 'REGISTER' && 'state' in component) {
        currentState.set(compId, component.state);
        nextState.set(compId, component.state);
      } else if (component.type === 'RAM' && 'memory' in component) {
        // For RAM, we store the entire Map
        currentState.set(compId, component.memory);
        nextState.set(compId, new Map(component.memory));
      }
    }
  }

  return {
    clocks: new Map(),
    currentState,
    nextState,
    cycleCount: 0,
  };
}

/**
 * Commit next state to current state (end of clock cycle)
 */
export function commitSequentialState(seqState: SequentialState): void {
  // Copy next state to current state
  for (const [compId, value] of seqState.nextState.entries()) {
    if (value instanceof Map) {
      // Deep copy for Map (RAM)
      seqState.currentState.set(compId, new Map(value));
    } else {
      seqState.currentState.set(compId, value);
    }
  }

  // Copy current state to next state for the next cycle
  // This ensures nextState starts with current values
  for (const [compId, value] of seqState.currentState.entries()) {
    if (value instanceof Map) {
      seqState.nextState.set(compId, new Map(value));
    } else {
      seqState.nextState.set(compId, value);
    }
  }

  seqState.cycleCount++;
}

/**
 * Topological sort to determine evaluation order
 * Returns component IDs in dependency order, or null if cycle detected
 *
 * IMPORTANT: Sequential components (flip-flops, registers, RAM) are evaluated FIRST
 * because their outputs are from stored state, not computed from inputs.
 * This ensures combinational logic sees the current state values.
 */
function topologicalSort(
  components: Record<string, Component>,
  connections: Record<string, Connection>
): string[] | null {
  const sequentialComponents: string[] = [];
  const combinationalComponents: string[] = [];

  // Separate sequential and combinational components
  for (const [compId, component] of Object.entries(components)) {
    if (isSequentialComponent(component.type)) {
      sequentialComponents.push(compId);
    } else {
      combinationalComponents.push(compId);
    }
  }

  // Build dependency graph ONLY for combinational components
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  // Initialize graph with combinational components only
  for (const compId of combinationalComponents) {
    graph.set(compId, new Set());
    inDegree.set(compId, 0);
  }

  // Build dependency graph: source -> targets
  // Only include connections between combinational components
  for (const conn of Object.values(connections)) {
    const source = conn.sourceComponentId;
    const target = conn.targetComponentId;
    const sourceComponent = components[source];
    const targetComponent = components[target];

    // Skip if source or target is sequential
    if (
      (sourceComponent && isSequentialComponent(sourceComponent.type)) ||
      (targetComponent && isSequentialComponent(targetComponent.type))
    ) {
      continue;
    }

    if (!graph.get(source)?.has(target)) {
      graph.get(source)?.add(target);
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
  }

  // Kahn's algorithm for topological sort (combinational components only)
  const queue: string[] = [];
  const combinationalResult: string[] = [];

  // Start with nodes that have no dependencies (inputs)
  for (const [compId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(compId);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    combinationalResult.push(current);

    for (const neighbor of graph.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for cycles in combinational logic
  if (combinationalResult.length !== combinationalComponents.length) {
    return null; // Cycle detected in combinational logic
  }

  // Return sequential components FIRST, then combinational components
  // This ensures sequential outputs are available before combinational logic evaluates
  return [...sequentialComponents, ...combinationalResult];
}

/**
 * Evaluate a single component's logic
 * Returns output values based on input values
 *
 * For sequential components, this returns the CURRENT state (not next state)
 * State updates happen in the sequential phase
 *
 * Now uses the unified PrimitiveEvaluator interface for all components
 */
function evaluateComponent(
  component: Component,
  inputValues: (boolean | number)[],
  componentType: ComponentType,
  seqState?: SequentialState
): (boolean | number)[] {
  const specs = getComponentSpec(componentType);

  // SWITCH: output is component's current value (user-controlled)
  if (component.type === 'SWITCH') {
    // Type guard: SWITCH components have a boolean value property
    if ('value' in component) {
      const value = component.value as boolean;
      return [value];
    }
    return [false];
  }

  // INPUT: output is component's current numeric value (user-controlled)
  if (component.type === 'INPUT') {
    // Type guard: INPUT components have a value property
    if ('value' in component && 'width' in component) {
      const value = component.value as number;
      const width = component.width as number;
      const mask = (1 << width) - 1;
      return [value & mask]; // Ensure value is masked to width
    }
    return [0];
  }

  // Try to use the unified primitive evaluator interface
  const primitiveName = getComponentTypeToPrimitiveName(componentType);
  if (primitiveName) {
    const evaluator = getPrimitiveEvaluator(primitiveName);
    if (evaluator) {
      // Build input map from inputValues array
      // NOTE: These type checks are for DATA MARSHALLING only, not logic.
      // They convert between the simulator's array-based interface and
      // the evaluator's map-based interface. The actual logic lives in
      // the evaluator, not here.
      const inputMap = new Map<string, boolean | number>();

      if (component.type === 'D_FLIP_FLOP') {
        // D Flip-Flop: inputs are [d, clk]
        inputMap.set('d', inputValues[0] ?? false);
        inputMap.set('clk', inputValues[1] ?? false);
      } else if (component.type === 'REGISTER') {
        // Register: inputs are [data, we]
        // Data can be a number (multi-bit bus) or boolean (single bit)
        const data = inputValues[0];
        inputMap.set('data', typeof data === 'number' ? data : (data ? 1 : 0));
        inputMap.set('we', inputValues[1] ?? false);
      } else if (component.type === 'RAM') {
        // RAM: inputs are [addr, data_in, we, clk]
        // Addr and data_in can be numbers (multi-bit buses) or booleans
        const addr = inputValues[0];
        const dataIn = inputValues[1];
        inputMap.set('addr', typeof addr === 'number' ? addr : (addr ? 1 : 0));
        inputMap.set('data_in', typeof dataIn === 'number' ? dataIn : (dataIn ? 1 : 0));
        inputMap.set('we', inputValues[2] ?? false);
        inputMap.set('clk', inputValues[3] ?? false);
      } else if (component.type === 'NOT_GATE' || component.type === 'BUFFER') {
        // Single input gates
        inputMap.set('in', inputValues[0] ?? false);
      } else if (component.type === 'LED') {
        // LED has input but no output
        inputMap.set('in', inputValues[0] ?? false);
      } else if (component.type === 'Splitter8to8') {
        // Splitter8to8: input is an 8-bit number
        const inputValue = inputValues[0];
        inputMap.set('in', typeof inputValue === 'number' ? inputValue : (inputValue ? 1 : 0));
      } else if (component.type === 'HexDisplay') {
        // HexDisplay: input is an n-bit number (default: 8-bit)
        const inputValue = inputValues[0];
        inputMap.set('in', typeof inputValue === 'number' ? inputValue : (inputValue ? 1 : 0));
      } else if (component.type === 'SevenSegment') {
        // SevenSegment: input is a 4-bit number for hex display
        const inputValue = inputValues[0];
        inputMap.set('in', typeof inputValue === 'number' ? inputValue : (inputValue ? 1 : 0));
      } else {
        // Two-input gates (AND, OR, NAND, NOR, XOR, XNOR)
        inputMap.set('a', inputValues[0] ?? false);
        inputMap.set('b', inputValues[1] ?? false);
      }

      // Get current state for sequential components
      const currentState = isSequentialComponent(componentType)
        ? seqState?.currentState.get(component.id)
        : undefined;

      // Evaluate using the unified interface
      const outputMap = evaluator.evaluate(inputMap, currentState);

      // Convert output map back to array
      if (component.type === 'D_FLIP_FLOP') {
        const q = outputMap.get('q') as boolean;
        const qBar = outputMap.get('q_bar') as boolean;
        console.log(`[DFF-EVAL] Component ${component.id}: state=${currentState}, outputs=[${q}, ${qBar}]`);
        return [q, qBar];
      } else if (component.type === 'REGISTER') {
        const q = outputMap.get('q') as number;
        return [q]; // Return the number directly (multi-bit bus)
      } else if (component.type === 'RAM') {
        const dataOut = outputMap.get('data_out') as number;
        return [dataOut]; // Return the number directly (multi-bit bus)
      } else if (component.type === 'LED') {
        return []; // LED has no outputs
      } else if (component.type === 'HexDisplay' || component.type === 'SevenSegment') {
        return []; // Display components have no outputs
      } else if (component.type === 'Splitter8to8') {
        // Splitter8to8: 8 bit outputs (bit0 to bit7)
        return [
          outputMap.get('bit0') as boolean,
          outputMap.get('bit1') as boolean,
          outputMap.get('bit2') as boolean,
          outputMap.get('bit3') as boolean,
          outputMap.get('bit4') as boolean,
          outputMap.get('bit5') as boolean,
          outputMap.get('bit6') as boolean,
          outputMap.get('bit7') as boolean,
        ];
      } else {
        // Single output gate
        const out = outputMap.get('out');
        return [out as boolean | number];
      }
    }
  }

  // FALLBACK: use evaluate function from spec (for backward compatibility)
  if (specs?.evaluate) {
    return specs.evaluate(inputValues);
  }

  return [];
}

/**
 * Get input values for a component from the port value map
 */
function getComponentInputs(
  componentId: string,
  componentType: ComponentType,
  connections: Record<string, Connection>,
  portValues: PortValueMap
): (boolean | number)[] {
  const specs = getComponentSpec(componentType);
  const inputs: (boolean | number)[] = new Array(specs?.inputCount ?? 0).fill(false);

  // Find all connections targeting this component's inputs
  for (const conn of Object.values(connections)) {
    if (conn.targetComponentId === componentId) {
      const sourcePortKey = getPortKey(
        conn.sourceComponentId,
        'output',
        conn.sourcePortIndex
      );
      const value = portValues.get(sourcePortKey);
      // Default to false for boolean, 0 for number - but we'll use false as universal default
      inputs[conn.targetPortIndex] = value ?? false;
    }
  }

  return inputs;
}

/**
 * Update sequential component states based on clock edges
 * This is Phase 2 of the two-phase execution model
 *
 * Now uses the unified PrimitiveEvaluator interface - all hardcoded logic removed!
 */
function updateSequentialStates(
  components: Record<string, Component>,
  connections: Record<string, Connection>,
  portValues: PortValueMap,
  seqState: SequentialState
): void {
  // Process each sequential component
  for (const [compId, component] of Object.entries(components)) {
    if (!isSequentialComponent(component.type)) continue;

    const inputs = getComponentInputs(compId, component.type, connections, portValues);

    // Get the unified primitive evaluator
    const primitiveName = getComponentTypeToPrimitiveName(component.type);
    if (!primitiveName) continue;

    const evaluator = getPrimitiveEvaluator(primitiveName);
    if (!evaluator || !evaluator.updateState) continue;

    // Build input map from inputs array
    // NOTE: These type checks are for DATA MARSHALLING and CLOCK TRACKING only.
    // The actual state update logic lives in the evaluator.updateState() method.
    // We only track clock signals here and convert between array ↔ map interfaces.
    const inputMap = new Map<string, boolean | number>();

    if (component.type === 'D_FLIP_FLOP') {
      // D Flip-Flop: inputs are [d, clk]
      const d = inputs[0] ?? false;
      const clk = Boolean(inputs[1] ?? false); // Coerce to boolean for clock signal
      inputMap.set('d', d);
      inputMap.set('clk', clk);

      console.log(`[DFF-UPDATE] Component ${compId}: d=${d}, clk=${clk}, inputs=[${inputs.join(', ')}]`);

      // Update clock signal state
      const clockSignal = seqState.clocks.get(`${compId}.clk`) ?? { previousValue: clk, currentValue: clk };
      if (!seqState.clocks.has(`${compId}.clk`)) {
        seqState.clocks.set(`${compId}.clk`, clockSignal);
        console.log(`[DFF-UPDATE] Component ${compId}: Created new clock signal, prev=${clk}, curr=${clk}`);
      } else {
        clockSignal.previousValue = clockSignal.currentValue;
        clockSignal.currentValue = clk;
        console.log(`[DFF-UPDATE] Component ${compId}: Updated clock signal, prev=${clockSignal.previousValue}, curr=${clockSignal.currentValue}`);
      }

      const edge = detectClockEdge(clockSignal);
      console.log(`[DFF-UPDATE] Component ${compId}: Detected edge=${edge}`);

      // Build clock edges map
      const clockEdges: ClockEdges = { 'clk': edge };

      // Call updateState from the evaluator
      const currentState = seqState.currentState.get(compId);
      const nextState = evaluator.updateState(inputMap, currentState, clockEdges);
      seqState.nextState.set(compId, nextState);

      if (edge === 'rising') {
        console.log(`[DFF-UPDATE] Component ${compId}: RISING EDGE! Setting nextState from ${currentState} to ${nextState}`);
      }
    } else if (component.type === 'REGISTER') {
      // Register: inputs are [data, we]
      const data = inputs[0];
      const we = inputs[1] ?? false;
      inputMap.set('data', typeof data === 'number' ? data : (data ? 1 : 0));
      inputMap.set('we', we);

      // Call updateState from the evaluator
      const currentState = seqState.currentState.get(compId);
      const clockEdges: ClockEdges = {}; // Register doesn't use clock edges
      const nextState = evaluator.updateState(inputMap, currentState, clockEdges);
      seqState.nextState.set(compId, nextState);
    } else if (component.type === 'RAM') {
      // RAM: inputs are [addr, data_in, we, clk]
      const addr = inputs[0];
      const dataIn = inputs[1];
      const we = inputs[2] ?? false;
      const clk = Boolean(inputs[3] ?? false); // Coerce to boolean for clock signal
      inputMap.set('addr', typeof addr === 'number' ? addr : (addr ? 1 : 0));
      inputMap.set('data_in', typeof dataIn === 'number' ? dataIn : (dataIn ? 1 : 0));
      inputMap.set('we', we);
      inputMap.set('clk', clk);

      // Update clock signal state
      const clockSignal = seqState.clocks.get(`${compId}.clk`) ?? { previousValue: clk, currentValue: clk };
      if (!seqState.clocks.has(`${compId}.clk`)) {
        seqState.clocks.set(`${compId}.clk`, clockSignal);
      } else {
        clockSignal.previousValue = clockSignal.currentValue;
        clockSignal.currentValue = clk;
      }

      const edge = detectClockEdge(clockSignal);

      // Build clock edges map
      const clockEdges: ClockEdges = { 'clk': edge };

      // Call updateState from the evaluator
      const currentState = seqState.currentState.get(compId);
      const nextState = evaluator.updateState(inputMap, currentState, clockEdges);
      seqState.nextState.set(compId, nextState);
    }
  }
}

/**
 * Run simulation step (combinational phase only - for backward compatibility)
 * Propagates values through the circuit in topological order
 *
 * Returns:
 * - portValues: Map of all port values after propagation
 * - componentOutputs: Map of component outputs
 * - error: Error message if cycle detected
 */
export function runSimulation(
  components: Record<string, Component>,
  connections: Record<string, Connection>,
  seqState?: SequentialState
): {
  portValues: PortValueMap;
  componentOutputs: ComponentOutputs;
  error?: string;
} {
  const portValues: PortValueMap = new Map();
  const componentOutputs: ComponentOutputs = new Map();

  // Get evaluation order
  const evalOrder = topologicalSort(components, connections);

  if (!evalOrder) {
    return {
      portValues,
      componentOutputs,
      error: 'Cycle detected in circuit',
    };
  }

  // PHASE 1: Combinational evaluation
  // Evaluate each component in dependency order
  for (const compId of evalOrder) {
    const component = components[compId];
    if (!component) continue;

    // Get input values from connected sources
    const inputs = getComponentInputs(compId, component.type, connections, portValues);

    // Evaluate component logic (sequential components return current state)
    const outputs = evaluateComponent(component, inputs, component.type, seqState);

    // Store output values in port map
    outputs.forEach((value, index) => {
      const portKey = getPortKey(compId, 'output', index);
      portValues.set(portKey, value);
      if (component.type === 'D_FLIP_FLOP') {
        console.log(`[DFF-PORT] Set port ${portKey} = ${value}`);
      }
    });

    // Store component outputs
    componentOutputs.set(compId, outputs);
    if (component.type === 'D_FLIP_FLOP') {
      console.log(`[DFF-OUTPUT] Component ${compId} outputs: [${outputs.join(', ')}]`);
    }
  }

  return { portValues, componentOutputs };
}

/**
 * Run full simulation tick (combinational + sequential phases)
 * This is the main entry point for sequential circuits
 */
export function runSimulationTick(
  components: Record<string, Component>,
  connections: Record<string, Connection>,
  seqState: SequentialState
): {
  portValues: PortValueMap;
  componentOutputs: ComponentOutputs;
  error?: string;
} {
  // PHASE 1: Combinational evaluation (reads current state)
  const result = runSimulation(components, connections, seqState);

  if (result.error) {
    return result;
  }

  // PHASE 2: Sequential state update (computes next state based on inputs and clock edges)
  updateSequentialStates(components, connections, result.portValues, seqState);

  // PHASE 3: Commit next state to current state
  commitSequentialState(seqState);

  // PHASE 4: Re-run combinational evaluation to propagate new state through circuit
  // This ensures outputs reflect the newly committed state
  const finalResult = runSimulation(components, connections, seqState);

  return finalResult;
}

/**
 * Get the value of a specific port
 * Returns boolean for single-bit ports, number for multi-bit buses
 */
export function getPortValue(
  portValues: PortValueMap,
  componentId: string,
  portType: 'input' | 'output',
  portIndex: number
): boolean | number {
  const key = getPortKey(componentId, portType, portIndex);
  return portValues.get(key) ?? false;
}

/**
 * Get LED component value updates based on simulation results
 * Returns a map of component IDs to their new values
 */
export function getLEDUpdates(
  components: Record<string, Component>,
  connections: Record<string, Connection>,
  portValues: PortValueMap
): Map<string, boolean> {
  const updates = new Map<string, boolean>();

  for (const component of Object.values(components)) {
    // Get LED values based on their input
    if (component.type === 'LED') {
      const inputs = getComponentInputs(component.id, component.type, connections, portValues);
      updates.set(component.id, Boolean(inputs[0] ?? false));
    }
  }

  return updates;
}

/**
 * Get display component value updates based on simulation results
 * Returns a map of component IDs to their numeric input values
 * Supports: HexDisplay, SevenSegment
 */
export function getDisplayUpdates(
  components: Record<string, Component>,
  connections: Record<string, Connection>,
  portValues: PortValueMap
): Map<string, number> {
  const updates = new Map<string, number>();

  for (const component of Object.values(components)) {
    // Get display component values based on their input
    if (component.type === 'HexDisplay' || component.type === 'SevenSegment') {
      const inputs = getComponentInputs(component.id, component.type, connections, portValues);
      const inputValue = inputs[0];
      // Convert to number: if it's already a number, use it; if boolean, convert to 0/1
      const numericValue = typeof inputValue === 'number' ? inputValue : (inputValue ? 1 : 0);
      updates.set(component.id, numericValue);
    }
  }

  return updates;
}

/**
 * Update LED component values based on simulation results
 * This mutates the components object to update LED states
 * @deprecated Use getLEDUpdates instead
 */
export function updateComponentStates(
  components: Record<string, Component>,
  connections: Record<string, Connection>,
  portValues: PortValueMap
): void {
  for (const component of Object.values(components)) {
    // Update LED values based on their input
    if (component.type === 'LED') {
      // Type guard: LED components have a boolean value property
      if ('value' in component) {
        const inputs = getComponentInputs(component.id, component.type, connections, portValues);
        const ledComponent = component as { value: boolean };
        ledComponent.value = Boolean(inputs[0] ?? false);
      }
    }
  }
}

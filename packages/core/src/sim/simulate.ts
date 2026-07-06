/**
 * Typed Simulation API
 *
 * Wraps the existing SimulationSession with a typed interface.
 * Users call simulate(component) and get back a typed object with
 * .set(), .get(), .tick(), .run(), .stop(), etc.
 *
 * Usage:
 *   const sim = simulate(HalfAdder)
 *   sim.set({ a: 1, b: 1 })
 *   sim.tick()
 *   sim.get('sum')  // 0
 */

import { isSequentialCircuit } from '../circuit/is-sequential.js';
import type { BuiltCircuit, PortMap } from '../circuit/types.js';
import { createSimulatorFromCircuit } from '../simulator/index.js';
import { SimulationSession } from '../simulator/simulation-session.js';
import type {
  BitValue,
  BusValue,
  Circuit,
  CircuitLibrary,
  MutableCircuitLibrary,
} from '../types/circuit.js';
import type { SimulatorSnapshot } from '../types/simulator.js';

function isMutable(lib: CircuitLibrary): lib is MutableCircuitLibrary {
  return 'addCircuit' in lib && typeof (lib as MutableCircuitLibrary).addCircuit === 'function';
}

// ============================================================================
// Simulation handle type
// ============================================================================

export interface SimulationHandle<Ins extends PortMap = PortMap, Outs extends PortMap = PortMap> {
  /** Set input values. For combinational circuits, outputs update immediately. */
  set(values: Partial<{ [K in keyof Ins]: number }>): void;

  /** Read an output value by name. */
  get<K extends keyof Outs & string>(name: K): number;

  /** Read all output values. */
  read(): { [K in keyof Outs]: number };

  /** Advance one clock cycle (sequential) or propagate (combinational). */
  tick(): void;

  /** Run N ticks. */
  tickN(count: number): void;

  /** Start auto-running at the given speed (ticks per second). */
  run(options: { speed: number; displayRate?: number }): void;

  /** Stop auto-running. */
  stop(): void;

  /** Get current cycle count. */
  readonly cycle: number;

  /** Whether the circuit is sequential (has state). */
  readonly isSequential: boolean;

  /** Whether auto-run is active. */
  readonly isRunning: boolean;

  /** Save current state for later restoration. */
  snapshot(): SimulatorSnapshot;

  /** Restore a previously saved snapshot. */
  restore(snap: SimulatorSnapshot): void;

  /** Reset simulation to initial state. */
  reset(): void;

  /** Subscribe to state changes. Returns unsubscribe function. */
  watch(callback: () => void): () => void;

  /** Subscribe to a specific output port. Returns unsubscribe function. */
  watchPort<K extends keyof Outs & string>(name: K, callback: (value: number) => void): () => void;

  /** Set a node's internal state (ROM data, register value, switch toggle). */
  setNode(nodeId: string, value: any): void;

  /** Access the underlying session (for advanced use). */
  readonly session: SimulationSession;

  /** Clean up resources. */
  dispose(): void;
}

// ============================================================================
// simulate() implementation
// ============================================================================

/**
 * Create a simulation from a component.
 *
 * @param comp - A BuiltCircuit (from circuit().build() or stdlib)
 * @param options - Optional: custom library, initial memory data
 */
export function simulate<Ins extends PortMap, Outs extends PortMap>(
  comp: BuiltCircuit<Ins, Outs>,
  options?: {
    library?: CircuitLibrary;
  },
): SimulationHandle<Ins, Outs> {
  const rawCircuit = comp.circuit;

  // Build component library from the circuit + all transitive dependencies
  const circuitMap = new Map<string, Circuit>();
  const defaultLibrary: CircuitLibrary & { addCircuit(c: Circuit): void } = {
    resolveCircuit: (name) => circuitMap.get(name),
    getAllPrimitiveNames: () =>
      [...circuitMap.entries()]
        .filter(([, c]) => c.implementation.kind === 'primitive')
        .map(([n]) => n),
    addCircuit: (c) => {
      circuitMap.set(c.name, c);
    },
  };
  const library = options?.library ?? defaultLibrary;
  if (isMutable(library)) {
    library.addCircuit(rawCircuit);
    if (comp._dependencies) {
      for (const [, dep] of comp._dependencies) {
        library.addCircuit(dep.circuit);
      }
    }
  }

  // If the component is a primitive (leaf), wrap it in a composite shell
  // so the elaboration pipeline can handle it properly
  const circuit = wrapIfPrimitive(rawCircuit, library);

  // Detect sequential
  const isSequential = isSequentialCircuit(circuit, library.resolveCircuit);

  // Create engine and session
  const engine = createSimulatorFromCircuit(circuit, library);

  // Run initial combinational propagation
  engine.runCombinational();

  const session = new SimulationSession(engine, { isSequential });

  // Output port names for get/read
  const outputNames = circuit.outputs.map((p) => p.name);

  // Build the handle
  const handle: SimulationHandle<Ins, Outs> = {
    set(values) {
      for (const [name, value] of Object.entries(values)) {
        if (value !== undefined) {
          // Convert number to boolean for bit ports
          const portDef = circuit.inputs.find((p) => p.name === name);
          const isBit = portDef?.portType.kind === 'bit';
          const converted = isBit ? Boolean(value) : value;
          session.setNode(name, converted as BitValue | BusValue);
        }
      }
      // For combinational circuits, auto-propagate
      if (!isSequential) {
        session.runCombinational();
      }
    },

    get(name) {
      const portValues = session.getState().portValues;
      const key = `__top__.${name as string}`;
      const val = portValues.get(key);
      if (val !== undefined) {
        return typeof val === 'boolean' ? (val ? 1 : 0) : (val as number);
      }
      // Fallback: search port values (for composite circuits where outputs may be nested)
      for (const [k, v] of portValues) {
        if (k.endsWith(`.${name as string}`)) {
          return typeof v === 'boolean' ? (v ? 1 : 0) : (v as number);
        }
      }
      return 0;
    },

    read() {
      const result: Record<string, number> = {};
      for (const name of outputNames) {
        result[name] = handle.get(name as any);
      }
      return result as any;
    },

    tick() {
      if (isSequential) {
        session.tick();
      } else {
        session.runCombinational();
      }
    },

    tickN(count) {
      for (let i = 0; i < count; i++) {
        session.tick();
      }
    },

    run({ speed, displayRate }) {
      session.startAutoRun(speed, { displayRate });
    },

    stop() {
      session.stopAutoRun();
    },

    get cycle() {
      return session.getState().cycle;
    },

    get isSequential() {
      return isSequential;
    },

    get isRunning() {
      return session.getState().isRunning;
    },

    snapshot() {
      return engine.snapshot();
    },

    restore(snap) {
      engine.restore(snap);
      session.runCombinational();
    },

    reset() {
      session.reset();
    },

    watch(callback) {
      return session.subscribe(callback);
    },

    watchPort(name, callback) {
      let lastValue: number | undefined;
      return session.subscribe(() => {
        const current = handle.get(name as any);
        if (current !== lastValue) {
          lastValue = current;
          callback(current);
        }
      });
    },

    setNode(nodeId, value) {
      engine.setNode(nodeId, value);
    },

    get session() {
      return session;
    },

    dispose() {
      session.dispose();
    },
  };

  return handle;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Wrap a primitive component in a composite shell for simulation.
 * The elaboration pipeline expects a composite top-level circuit with nodes.
 * Bare primitives need a wrapper that instantiates them and wires through.
 */
function wrapIfPrimitive(circuit: Circuit, _library: CircuitLibrary): Circuit {
  if (circuit.implementation.kind !== 'primitive') return circuit;

  const nodeId = '_inner';
  const nodes = [
    {
      id: nodeId,
      componentRef: circuit.name,
      arguments: {},
      inputs: circuit.inputs.map((p) => ({
        id: `${nodeId}.${p.name}`,
        name: p.name,
        portType: p.portType,
      })),
      outputs: circuit.outputs.map((p) => ({
        id: `${nodeId}.${p.name}`,
        name: p.name,
        portType: p.portType,
      })),
      clocks: circuit.clocks.map((c) => ({
        id: `${nodeId}.${c.name}`,
        name: c.name,
      })),
    },
  ];

  // Wire circuit inputs → node inputs, node outputs → circuit outputs
  const connections: import('../types/circuit.js').Connection[] = [];
  let connIdx = 0;
  for (const p of circuit.inputs) {
    connections.push({
      id: `conn_${connIdx++}`,
      source: { nodeId: '', portName: p.name },
      target: { nodeId, portName: p.name },
      portType: p.portType,
    });
  }
  for (const p of circuit.outputs) {
    connections.push({
      id: `conn_${connIdx++}`,
      source: { nodeId, portName: p.name },
      target: { nodeId: '', portName: p.name },
      portType: p.portType,
    });
  }

  return {
    version: 1,
    name: `__sim_${circuit.name}`,
    inputs: circuit.inputs.map((p) => ({ ...p })),
    outputs: circuit.outputs.map((p) => ({ ...p })),
    clocks: [],
    state: [],
    nodes,
    connections,
    implementation: { kind: 'composite' },
    metadata: circuit.metadata,
  };
}

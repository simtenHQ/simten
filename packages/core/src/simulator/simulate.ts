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

import { libraryOf } from '../circuit/behavior.js';
import type { Circuit, PortMap } from '../circuit/builder-types.js';
import { isSequentialCircuit } from '../circuit/is-sequential.js';
import type {
  ArgumentValue,
  BitValue,
  BusValue,
  CircuitIR,
  MemoryContents,
} from '../ir/circuit-ir.js';
import { memoryContentsShapeError, memoryContentsToMap } from '../ir/memory-contents.js';
import { createEngine, elaborate } from './index.js';
import { SimulationSession } from './simulation-session.js';
import type { SimulatorSnapshot } from './types.js';

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

  /**
   * Set a node's internal state: a number for a register or switch, or
   * `{ address: value }` contents for a memory (ROM data). Memory contents
   * replace the memory's current contents.
   */
  setNode(nodeId: string, value: BitValue | BusValue | MemoryContents): void;

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
 * @param comp - A Circuit (from circuit().build() or stdlib)
 */
export function simulate<Ins extends PortMap, Outs extends PortMap>(
  comp: Circuit<Ins, Outs>,
): SimulationHandle<Ins, Outs> {
  const rawCircuit = comp.circuit;

  // The definitions and behavior for this circuit and its dependencies.
  const library = libraryOf(comp);
  const { definitions } = library;

  // If the component is a primitive (leaf), wrap it in a composite shell
  // so the elaboration pipeline can handle it properly
  const circuit = wrapIfPrimitive(rawCircuit, comp._args ?? {});

  // Detect sequential
  const isSequential = isSequentialCircuit(circuit, definitions.resolveCircuit);

  // Create engine and session
  const engine = createEngine(elaborate(circuit, definitions), { library });

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
          // Values are numeric for every port width. This used to convert bit
          // ports with `Boolean(value)`, from when `BitValue` was `boolean` —
          // which fed a raw boolean into `topLevelInputs`, and from there
          // straight into `onTick` (propagate.ts reads that map directly for
          // top-level-driven inputs), so sequential state came out boolean.
          session.setNode(name, value as BitValue | BusValue);
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
        result[name] = handle.get(name);
      }
      return result as { [K in keyof Outs]: number };
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
        const current = handle.get(name);
        if (current !== lastValue) {
          lastValue = current;
          callback(current);
        }
      });
    },

    setNode(nodeId, value) {
      if (typeof value === 'number') {
        engine.setNode(nodeId, value);
        return;
      }
      const shapeError = memoryContentsShapeError(value);
      if (shapeError) throw new Error(`setNode('${nodeId}'): ${shapeError}`);
      engine.setNode(nodeId, memoryContentsToMap(value));
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
 * The wrapper's node carries the instance's arguments, as a parent's would, so
 * `simulate(Register({ value: 5 }))` starts at 5 (#428).
 */
function wrapIfPrimitive(circuit: CircuitIR, args: Record<string, ArgumentValue>): CircuitIR {
  if (circuit.implementation.kind !== 'primitive') return circuit;

  const nodeId = '_inner';
  const nodes = [
    {
      id: nodeId,
      componentRef: circuit.name,
      arguments: args,
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
  const connections: import('../ir/circuit-ir.js').Connection[] = [];
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

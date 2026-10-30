/**
 * `Simulation`: one running circuit, driven synchronously.
 *
 * `simulate(top)` (in `simulate.ts`) returns one for a built circuit; the
 * sandbox and tests that start from IR use `createSimulation`. There are no
 * timers and nothing to dispose: a `Simulation` is plain objects the garbage
 * collector frees.
 *
 * The public type covers the circuit's top-level ports, the clock, history and
 * opaque snapshots. Internal nodes, by dotted path, are reached through
 * `nodesOf(sim)` in `@simten/core/internal`; the paths are elaboration details,
 * not a contract.
 */

import type { Library } from '../circuit/behavior.js';
import type { PortMap } from '../circuit/builder-types.js';
import { isSequentialCircuit } from '../circuit/is-sequential.js';
import {
  type CircuitDefinitions,
  type CircuitIR,
  type MemoryContents,
  TOP_LEVEL_NODE,
} from '../ir/circuit-ir.js';
import { memoryContentsShapeError, memoryContentsToMap } from '../ir/memory-contents.js';
import { elaborate } from './elaboration.js';
import { createEngine } from './engine.js';
import { isControlType, type KeyScope, type ResolvedKey, resolveKey } from './input-keys.js';
import type { FlatCircuit, SimulatorEngine, SimulatorSnapshot } from './types.js';

// ============================================================================
// Public types
// ============================================================================

declare const snapshotBrand: unique symbol;

/** A saved simulation state from `snapshot()`. Opaque: pass it to `restore()`. */
export interface Snapshot {
  readonly [snapshotBrand]: true;
}

export interface SimulateOptions {
  /** Cycles of history kept for stepBack/stepForward/seek. Default 0: off. */
  history?: number;
  /**
   * Memory contents by node path (`imem`, `cpu.rom`), loaded before cycle 0.
   * They survive `reset`, as flash does. A new program is a new simulation.
   */
  memory?: Record<string, MemoryContents>;
}

/**
 * A circuit simulation. `Keys` are what `set` takes: the circuit's input port
 * names and the paths of its Switch and Input nodes.
 */
export interface Simulation<
  Ins extends PortMap = PortMap,
  Outs extends PortMap = PortMap,
  Keys extends string = keyof Ins & string,
> {
  /** True if the circuit has state (registers, memories). */
  readonly isSequential: boolean;
  /** Clock cycles since the start or the last reset. */
  readonly cycle: number;

  /**
   * Drive the circuit's inputs: input ports by name, and Switch and Input
   * nodes by path (`d`, `cpu.kbd`). Every value is written before the circuit
   * settles, so outputs read afterwards see them all at once. A key that is
   * neither, that names any other node, or that names both a port and a
   * Switch throws, and then nothing is written.
   */
  set(values: Partial<Record<Keys, number>>): void;
  /**
   * Read an output port, an input port, or a Switch or Input by path: what
   * `read` returns, and anything `set` can write. Any other name throws.
   */
  get<K extends (keyof Outs & string) | Keys>(name: K): number;
  /** Read every top-level output port. */
  read(): { [K in keyof Outs]: number };

  /** Advance `count` rising clock edges (default 1). On a combinational circuit, settles. */
  tick(count?: number): void;
  /**
   * The reset line: back to cycle 0, registers to their initial values, history
   * restarted. Memory contents survive, as flash does, and inputs and switches
   * stay where they are.
   */
  reset(): void;

  /** Where the history cursor is. `{ length: 0, index: -1 }` when history is off. */
  readonly history: { readonly length: number; readonly index: number };
  /** Each returns false, and changes nothing, when there is nothing to step to (always, with history 0). */
  stepBack(): boolean;
  stepForward(): boolean;
  seek(index: number): boolean;

  /** Opaque saved state, for tests that branch from a point. */
  snapshot(): Snapshot;
  restore(snapshot: Snapshot): void;
}

// ============================================================================
// Internal node access
// ============================================================================

/** State of a peripheral-bus node: a register value, console text or memory contents. */
export type PeripheralValue = number | string | ReadonlyMap<number, number>;

/** The flat, untyped view of a simulation. For the sandbox, the canvas and tests. */
export interface SimulationNodes {
  /**
   * Write a node by exact dotted instance path: a Switch/Input value, a register, or memory
   * contents. Unknown paths throw, and a top-level input name isn't a path: drive those with `sim.set`.
   */
  set(path: string, value: number | MemoryContents): void;
  /** Tick without recording history; then `record()` once. For the sandbox's sliced ticks. */
  advance(count: number): void;
  /** Add the current state to history as one step. Does nothing with history off. */
  record(): void;
  /** Every port value, keyed `nodePath.port` (top-level ports under `__top__`). */
  ports(): ReadonlyMap<string, number>;
  /** State of nodes on a peripheral bus (screens, consoles, UARTs), by node path. */
  peripherals(): ReadonlyMap<string, PeripheralValue>;
  /** The primitive type of the node at `path` (`'Switch'`, `'Register'`), or undefined when no node has that path. */
  primitiveOf(path: string): string | undefined;
}

const nodesBySimulation = new WeakMap<Simulation, SimulationNodes>();

/** The node-level view of `simulation`. Throws for anything `simulate()` didn't make. */
export function nodesOf(simulation: Simulation): SimulationNodes {
  const nodes = nodesBySimulation.get(simulation);
  if (!nodes) throw new Error("nodesOf: this isn't a Simulation made by simulate()");
  return nodes;
}

/** A simulation of `circuit`, a composite, running the behavior in `library`. */
export function createSimulation(
  circuit: CircuitIR,
  library: Library,
  options?: SimulateOptions,
): Simulation {
  const flat = elaborate(circuit, library.definitions);
  const engine = createEngine(flat, { library });
  const simulation = new EngineSimulation(engine, {
    isSequential: isSequentialCircuit(circuit, library.definitions.resolveCircuit),
    historySize: Math.max(0, Math.floor(options?.history ?? 0)),
    circuitName: circuit.name,
    inputNames: circuit.inputs.map((p) => p.name),
    outputNames: circuit.outputs.map((p) => p.name),
    peripheralNodes: () => peripheralBusNodes(flat, library.definitions),
    primitiveTypes: () => new Map(flat.nodes.map((n) => [n.id, n.primitiveType])),
    isControl: (type) => isControlType(type, library.definitions),
  });
  nodesBySimulation.set(simulation, simulation.nodes);
  const memory = Object.entries(options?.memory ?? {});
  if (memory.length > 0) {
    for (const [path, contents] of memory) simulation.nodes.set(path, contents);
    // Cycle 0 and the start of history are with the program in place, and
    // `reset` comes back to it.
    simulation.reset();
  }
  return simulation;
}

// ============================================================================
// Implementation
// ============================================================================

interface EngineSimulationOptions {
  isSequential: boolean;
  historySize: number;
  circuitName: string;
  inputNames: readonly string[];
  outputNames: readonly string[];
  peripheralNodes: () => ReadonlySet<string>;
  primitiveTypes: () => ReadonlyMap<string, string>;
  /** Whether nodes of this primitive type are Switches or Inputs. */
  isControl: (primitiveType: string) => boolean;
}

class EngineSimulation implements Simulation {
  readonly isSequential: boolean;
  readonly nodes: SimulationNodes;

  private readonly engine: SimulatorEngine;
  private readonly historySize: number;
  private readonly inputNames: ReadonlySet<string>;
  private readonly outputNames: readonly string[];
  private readonly outputNameSet: ReadonlySet<string>;
  private readonly findPeripheralNodes: () => ReadonlySet<string>;
  private peripheralNodes: ReadonlySet<string> | null = null;
  private readonly findPrimitiveTypes: () => ReadonlyMap<string, string>;
  private primitiveTypes: ReadonlyMap<string, string> | null = null;
  /** What the names `set` and `get` take refer to. */
  private readonly keys: KeyScope;

  private cycleCount = 0;
  /** An input changed since the logic last settled. Reads settle first. */
  private dirty = false;
  private entries: SimulatorSnapshot[] = [];
  private index = -1;

  constructor(engine: SimulatorEngine, options: EngineSimulationOptions) {
    this.engine = engine;
    this.isSequential = options.isSequential;
    this.historySize = options.historySize;
    this.inputNames = new Set(options.inputNames);
    this.outputNames = options.outputNames;
    this.outputNameSet = new Set(options.outputNames);
    this.findPeripheralNodes = options.peripheralNodes;
    this.findPrimitiveTypes = options.primitiveTypes;
    this.keys = {
      circuitName: options.circuitName,
      inputs: this.inputNames,
      outputs: this.outputNameSet,
      primitives: () => this.primitiveTypesOf(),
      isControl: options.isControl,
    };

    engine.runCombinational();
    this.startHistory();

    this.nodes = {
      set: (path, value) => this.setNode(path, value),
      advance: (count) => this.advance(count),
      record: () => this.record(),
      ports: () => {
        this.settle();
        return this.engine.getPortValues();
      },
      peripherals: () => this.peripherals(),
      primitiveOf: (path) => this.primitiveOf(path),
    };
  }

  get cycle(): number {
    return this.cycleCount;
  }

  get history(): { readonly length: number; readonly index: number } {
    return { length: this.entries.length, index: this.index };
  }

  set(values: Partial<Record<string, number>>): void {
    // Resolve every key before writing any, so a typo leaves the inputs as they were.
    const writes: Array<{ input: ResolvedKey; value: number }> = [];
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) writes.push({ input: resolveKey('set', key, this.keys), value });
    }
    for (const { input, value } of writes) {
      if (input.kind === 'port') this.engine.setInput(input.name, value);
      else if (input.kind === 'path') this.engine.setNode(input.path, value);
    }
    this.dirty = true;
  }

  get(name: string): number {
    const { key } = resolveKey('get', name, this.keys);
    return this.nodes.ports().get(key) ?? 0;
  }

  read(): Record<string, number> {
    const portValues = this.nodes.ports();
    const result: Record<string, number> = {};
    for (const name of this.outputNames)
      result[name] = portValues.get(`${TOP_LEVEL_NODE}.${name}`) ?? 0;
    return result;
  }

  tick(count = 1): void {
    this.advance(count);
    this.record();
  }

  reset(): void {
    this.engine.reset();
    this.cycleCount = 0;
    this.dirty = false;
    this.startHistory();
  }

  stepBack(): boolean {
    return this.index > 0 && this.seekTo(this.index - 1);
  }

  stepForward(): boolean {
    return this.index < this.entries.length - 1 && this.seekTo(this.index + 1);
  }

  seek(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && this.seekTo(index);
  }

  // The engine's snapshot, typed opaque so its shape stays internal.
  snapshot(): Snapshot {
    this.settle();
    return this.engine.snapshot() as unknown as Snapshot;
  }

  restore(snapshot: Snapshot): void {
    const saved = snapshot as unknown as SimulatorSnapshot;
    this.engine.restore(saved);
    this.engine.runCombinational();
    this.cycleCount = saved.cycleCount;
    this.dirty = false;
  }

  private primitiveTypesOf(): ReadonlyMap<string, string> {
    this.primitiveTypes ??= this.findPrimitiveTypes();
    return this.primitiveTypes;
  }

  private primitiveOf(path: string): string | undefined {
    return this.primitiveTypesOf().get(path);
  }

  private setNode(path: string, value: number | MemoryContents): void {
    if (typeof value === 'number') {
      this.engine.setNode(path, value);
    } else {
      const shapeError = memoryContentsShapeError(value);
      if (shapeError) throw new Error(`set('${path}'): ${shapeError}`);
      this.engine.setNode(path, memoryContentsToMap(value));
    }
    this.dirty = true;
  }

  private settle(): void {
    if (!this.dirty) return;
    this.engine.runCombinational();
    this.dirty = false;
  }

  /** A clock edge propagates from the current inputs, so it settles too. */
  private advance(count: number): void {
    if (!this.isSequential) {
      this.settle();
      return;
    }
    for (let i = 0; i < count; i++) this.engine.tick();
    this.cycleCount += count;
    this.dirty = false;
  }

  private get recording(): boolean {
    return this.historySize > 0 && this.isSequential;
  }

  /** History restarts from the current state, as its only entry. */
  private startHistory(): void {
    this.entries = this.recording ? [this.engine.snapshot()] : [];
    this.index = this.entries.length - 1;
  }

  private record(): void {
    if (!this.recording) return;
    // Recording after a step back drops the steps ahead of it.
    this.entries.length = this.index + 1;
    this.entries.push(this.engine.snapshot());
    if (this.entries.length > this.historySize) this.entries.shift();
    this.index = this.entries.length - 1;
  }

  private seekTo(index: number): boolean {
    const entry = this.entries[index];
    if (!entry) return false;
    this.engine.restore(entry);
    this.cycleCount = entry.cycleCount;
    this.dirty = false;
    this.index = index;
    return true;
  }

  private peripherals(): ReadonlyMap<string, PeripheralValue> {
    this.peripheralNodes ??= this.findPeripheralNodes();
    const result = new Map<string, PeripheralValue>();
    if (this.peripheralNodes.size === 0) return result;
    const state = this.engine.getState();
    if (!state) return result;
    for (const id of this.peripheralNodes) {
      const value = state.currentState.get(id);
      if (value !== undefined) result.set(id, value);
    }
    return result;
  }
}

/**
 * Nodes whose state a page shows: anything wired directly to a component
 * tagged `meta.synthesizable: false` (a peripheral), plus the peripherals
 * themselves. Models memory-mapped I/O: a RAM wired to a Screen is
 * observable, a register with no peripheral connection stays internal.
 */
function peripheralBusNodes(flat: FlatCircuit, definitions: CircuitDefinitions): Set<string> {
  const isPeripheral = (primitiveType: string | undefined): boolean =>
    primitiveType !== undefined &&
    definitions.resolveCircuit(primitiveType)?.metadata?.synthesizable === false;

  const typeByNode = new Map<string, string>();
  for (const node of flat.nodes) typeByNode.set(node.id, node.primitiveType);

  const exposed = new Set<string>();
  for (const conn of flat.connections) {
    if (
      isPeripheral(typeByNode.get(conn.source.nodeId)) ||
      isPeripheral(typeByNode.get(conn.target.nodeId))
    ) {
      exposed.add(conn.source.nodeId);
      exposed.add(conn.target.nodeId);
    }
  }
  return exposed;
}

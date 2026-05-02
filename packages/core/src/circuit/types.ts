/**
 * Builder Type System
 *
 * Generic types that enable:
 * - Port name autocomplete in connect() callbacks
 * - Type errors on width mismatches
 * - Typed sim.set() / sim.get()
 *
 * The object config pattern infers all types from a single object literal,
 * so TypeScript resolves everything in one pass — fast at any circuit size.
 */

import type { PortType, BitType, BusType, Circuit, ArgumentValue } from '../types/circuit.js';

// ============================================================================
// Port types
// ============================================================================

/** A typed port reference used in connect() callbacks */
export interface PortRef<_T extends PortType = PortType> {
  /** Connect this port to one or more destination ports */
  to(...targets: PortRef[]): ConnectionDef;
  /** Internal: port path for IR generation */
  readonly _path: { nodeId: string; portName: string };
  /** Internal: port type for validation */
  readonly _type: PortType;
}

/** A connection definition produced by PortRef.to() */
export interface ConnectionDef {
  readonly source: { nodeId: string; portName: string };
  readonly targets: { nodeId: string; portName: string }[];
  readonly portType: PortType;
}

// ============================================================================
// Component shape
// ============================================================================

/** Map of port names to their types */
export type PortMap = Record<string, PortType>;

/** Describes a circuit's port interface */
export interface CircuitShape {
  inputs: PortMap;
  outputs: PortMap;
}

// ============================================================================
// Connect callback types (generic)
// ============================================================================

/** Convert a port map to PortRef accessors */
type PortRefs<M> = {
  readonly [K in keyof M]: PortRef;
};

/** Extract port refs from a BuiltCircuit's shape */
type NodePortRefs<C extends BuiltCircuit> = PortRefs<C['_shape']['inputs']> & PortRefs<C['_shape']['outputs']>;

/** The connect callback argument — typed from the config's inputs/outputs/nodes.
 *
 * Shape mirrors the config object the user wrote: `{ inputs, outputs, nodes }`.
 * Destructure `nodes` inline (`nodes: { xor1, and1 }`) for terseness on small
 * circuits, or access via `nodes.xor1` for clarity on larger ones.
 */
export type ConnectArg<
  Ins extends Record<string, PortType | number>,
  Outs extends Record<string, PortType | number>,
  Nodes extends Record<string, BuiltCircuit>,
> = {
  readonly inputs: PortRefs<Ins>;
  readonly outputs: PortRefs<Outs>;
  readonly nodes: { readonly [K in keyof Nodes]: NodePortRefs<Nodes[K]> };
};

// ============================================================================
// Eval function types
// ============================================================================

/** Convert a port map to numeric values (for eval input/output) */
export type PortValues<M> = {
  [K in keyof M]: number;
};

/** State value types: number (bus), boolean (bit), Map (memory), string (text buffers), or new declarative types */
export type StateValue = number | boolean | Map<number, number> | string | import('./bit-bus.js').RegState | import('./bit-bus.js').MemState;

/** State shape — plain object where each field is a state value */
export type StateShape = Record<string, StateValue>;

// ============================================================================
// Component metadata
// ============================================================================

export interface CircuitMeta {
  category?: string;
  description?: string;
  icon?: string;
  tags?: string[];
  author?: string;
  version?: string;
  /** Key in node.arguments that holds the user-interactive value (Switch, Button, Input) */
  interactiveArg?: string;
  /**
   * Marks this component as a non-synthesizable peripheral (display, console,
   * UART, NIC, segment display). Defaults to `true` when omitted.
   *
   * Two downstream effects:
   * - The synth checker / Verilog emitter treats these as module boundaries,
   *   not logic to transpile.
   * - The sandbox exposes the simulation state of any node on a peripheral's
   *   bus across postMessage — the sim analog of memory-mapped I/O (x86 VGA
   *   at 0xA0000, Game Boy VRAM at 0x8000). A RAM wired to a Screen has its
   *   contents exposed because, in real hardware, the display controller
   *   physically shares that RAM's bus. Internal logic state (registers,
   *   FSMs, pipeline latches) with no connection to any peripheral pin
   *   stays sandbox-internal.
   */
  synthesizable?: boolean;
}

// ============================================================================
// Built component
// ============================================================================

/** A fully built circuit that can be used as a node or simulated */
export interface BuiltCircuit<
  Ins extends PortMap = PortMap,
  Outs extends PortMap = PortMap,
  Ns extends Record<string, unknown> = Record<string, unknown>,
> {
  /** The Circuit IR for this circuit */
  readonly circuit: Circuit;
  /** Type-level shape for generic propagation. Includes node names so that
   *  consumers (e.g., the canvas `layout` prop) can constrain keys at compile time. */
  readonly _shape: { inputs: Ins; outputs: Outs; nodes: Ns };
  /** Sub-circuit definitions needed for simulation (transitive) */
  readonly _dependencies: ReadonlyMap<string, BuiltCircuit>;
  /** Circuit name */
  readonly name: string;
}

// ============================================================================
// Component config (generic)
// ============================================================================

/** Configuration object for circuit() */
export interface CircuitConfig<
  Ins extends Record<string, PortType | number> = Record<string, PortType | number>,
  Outs extends Record<string, PortType | number> = Record<string, PortType | number>,
  Nodes extends Record<string, BuiltCircuit> = Record<string, BuiltCircuit>,
  S extends StateShape = StateShape,
> {
  inputs?: Ins;
  outputs?: Outs;
  nodes?: Nodes;
  nodeArgs?: { [K in keyof Nodes]?: Record<string, ArgumentValue> };
  connect?: (arg: ConnectArg<Ins, Outs, Nodes>) => ConnectionDef[];
  eval?: (inputs: PortValues<Ins> & S) => PortValues<Outs>;
  state?: S;
  onTick?: (inputsAndState: PortValues<Ins> & S) => S;
  meta?: CircuitMeta;
}


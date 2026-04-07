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

/** The connect callback argument — typed from the config's in/out/nodes */
export type ConnectArg<
  Ins extends Record<string, PortType | number>,
  Outs extends Record<string, PortType | number>,
  Nodes extends Record<string, BuiltCircuit>,
> = {
  readonly in: PortRefs<Ins>;
  readonly out: PortRefs<Outs>;
} & {
  readonly [K in keyof Nodes]: NodePortRefs<Nodes[K]>;
};

// ============================================================================
// Eval function types
// ============================================================================

/** Convert a port map to numeric values (for eval input/output) */
export type PortValues<M> = {
  [K in keyof M]: number;
};

/** State value types: number (bus), boolean (bit), or Map (memory) */
export type StateValue = number | boolean | Map<number, number>;

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
}

// ============================================================================
// Built component
// ============================================================================

/** A fully built circuit that can be used as a node or simulated */
export interface BuiltCircuit<
  Ins extends PortMap = PortMap,
  Outs extends PortMap = PortMap,
> {
  /** The Circuit IR for this circuit */
  readonly circuit: Circuit;
  /** Type-level shape for generic propagation */
  readonly _shape: { inputs: Ins; outputs: Outs };
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
  in?: Ins;
  out?: Outs;
  nodes?: Nodes;
  nodeArgs?: { [K in keyof Nodes]?: Record<string, ArgumentValue> };
  connect?: (arg: ConnectArg<Ins, Outs, Nodes>) => ConnectionDef[];
  eval?: (inputs: PortValues<Ins> & Partial<S>) => PortValues<Outs>;
  state?: S;
  onTick?: (inputsAndState: PortValues<Ins> & S) => S;
  meta?: CircuitMeta;
}


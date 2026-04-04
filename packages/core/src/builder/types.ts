/**
 * Builder Type System
 *
 * Generic types that enable:
 * - Port name autocomplete in .connect() callbacks
 * - Type errors on width mismatches
 * - Typed sim.set() / sim.get()
 *
 * Design: each builder method returns a new type that accumulates
 * port/node information. The .connect() callback receives a typed
 * proxy object with all declared nodes and their ports.
 */

import type { PortType, BitType, BusType, Circuit } from '../types/circuit.js';

// ============================================================================
// Port width tracking (type-level)
// ============================================================================

/** Brand type to track port width at the type level */
export type PortWidth<T extends PortType> = T extends BusType ? number : 0 | 1;

/** A typed port reference used in .connect() callbacks */
export interface PortRef<T extends PortType = PortType> {
  /** Connect this port to one or more destination ports */
  to(...targets: PortRef<T>[]): ConnectionDef;
  /** For bus ports: extract a single bit */
  bit?(index: number): PortRef<BitType>;
  /** For bus ports: extract a range of bits */
  bits?(high: number, low: number): PortRef<BusType>;
  /** Internal: port path for IR generation */
  readonly _path: { nodeId: string; portName: string };
  /** Internal: port type for validation */
  readonly _type: T;
}

/** A connection definition produced by PortRef.to() */
export interface ConnectionDef {
  readonly source: { nodeId: string; portName: string };
  readonly targets: { nodeId: string; portName: string }[];
  readonly portType: PortType;
}

// ============================================================================
// Component shape descriptors (type-level)
// ============================================================================

/** Map of port names to their types */
export type PortMap = Record<string, PortType>;

/** Describes a component's port interface for type checking */
export interface ComponentShape {
  inputs: PortMap;
  outputs: PortMap;
}

/** Extract the shape from a built component */
export type ShapeOf<C> = C extends { readonly _shape: infer S extends ComponentShape } ? S : ComponentShape;

// ============================================================================
// Connect callback types
// ============================================================================

/** Convert a PortMap to PortRef object (for use in .connect() callback) */
export type PortRefs<M extends PortMap> = {
  readonly [K in keyof M]: PortRef<M[K]>;
};

/** The 'in' proxy in a connect callback — exposes circuit-level input ports as PortRefs */
export type InputRefs<Ins extends PortMap> = PortRefs<Ins>;

/** The 'out' proxy in a connect callback — exposes circuit-level output ports as PortRefs */
export type OutputRefs<Outs extends PortMap> = PortRefs<Outs>;

/**
 * A node proxy in a connect callback — exposes the node's output ports for reading
 * and input ports for writing (as connection targets).
 *
 * In a connect callback, you read from outputs and write to inputs:
 *   nodeA.out.to(nodeB.in)  // nodeA's output connects to nodeB's input
 *
 * But for circuit-level 'in' and 'out', the directions are flipped:
 *   in.a.to(nodeA.a)   // circuit input feeds into node input
 *   nodeA.out.to(out.sum)  // node output feeds into circuit output
 */
export type NodeRefs<S extends ComponentShape> =
  PortRefs<S['inputs']> & PortRefs<S['outputs']>;

/** Nodes map: node name → component shape */
export type NodesMap = Record<string, ComponentShape>;

/** The full connect callback argument */
export type ConnectArg<
  Ins extends PortMap,
  Outs extends PortMap,
  Nodes extends NodesMap,
> = {
  readonly in: InputRefs<Ins>;
  readonly out: OutputRefs<Outs>;
} & {
  readonly [K in keyof Nodes]: NodeRefs<Nodes[K]>;
};

/** Connect callback function type */
export type ConnectFn<
  Ins extends PortMap,
  Outs extends PortMap,
  Nodes extends NodesMap,
> = (arg: ConnectArg<Ins, Outs, Nodes>) => ConnectionDef[];

// ============================================================================
// Eval function types
// ============================================================================

/** Value type for a port: bit → 0|1, bus → number */
export type PortValue<T extends PortType> = T extends BitType ? number : number;

/** Convert a PortMap to a values object (for .eval() input/output) */
export type PortValues<M extends PortMap> = {
  [K in keyof M]: PortValue<M[K]>;
};

/** State shape — plain object with numeric/boolean values */
export type StateShape = Record<string, number | boolean | object>;

/**
 * Eval function for combinational components.
 * Receives inputs (and state if present) as one flat object, returns outputs.
 */
export type EvalFn<
  Ins extends PortMap,
  Outs extends PortMap,
  State extends StateShape | never = never,
> = [State] extends [never]
  ? (inputs: PortValues<Ins>) => PortValues<Outs>
  : (inputsAndState: PortValues<Ins> & State) => PortValues<Outs>;

/**
 * OnTick function for sequential components.
 * Receives inputs + state, returns next state.
 */
export type OnTickFn<
  Ins extends PortMap,
  State extends StateShape,
> = (inputsAndState: PortValues<Ins> & State) => State;

// ============================================================================
// Component metadata
// ============================================================================

export interface ComponentMeta {
  category?: string;
  description?: string;
  icon?: string;
  tags?: string[];
  author?: string;
  version?: string;
}

// ============================================================================
// Built component — the final product
// ============================================================================

/** A fully built component that can be used as a node or simulated */
export interface BuiltComponent<
  Ins extends PortMap = PortMap,
  Outs extends PortMap = PortMap,
> {
  /** The Circuit IR for this component */
  readonly circuit: Circuit;
  /** Type-level shape for generic propagation */
  readonly _shape: { inputs: Ins; outputs: Outs };
  /** Component name */
  readonly name: string;
}

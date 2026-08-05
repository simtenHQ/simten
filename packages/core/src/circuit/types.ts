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

import type {
  ArgumentValue,
  BitType,
  BusType,
  Circuit,
  Node,
  PortDescriptor,
  PortType,
} from '../types/circuit.js';

export type { ArgumentValue };

// ============================================================================
// Port types
// ============================================================================

/** Brand keeping SourcePortRef and SinkPortRef disjoint at the type level
 *  even though they share structural fields. Erased at runtime. */
declare const __portDir: unique symbol;

/** A source-direction port reference — values flow OUT of it.
 *  Outer-circuit inputs and inner-node outputs are sources.
 *  Has `.to(...)` to connect downstream into sinks.
 *
 *  NOTE: `.to()` accepts any `SinkPortRef` regardless of `T` to permit bit↔bus
 *  connections (e.g. tying a 1-bit signal into a wider control word). Width
 *  mismatch checking is deferred to #108 — once `BusType<W>` carries a literal
 *  width, this signature can tighten to `SinkPortRef<T>[]` for free. */
export interface SourcePortRef<T extends PortType = PortType> {
  /** Direction brand — keeps SourcePortRef and SinkPortRef disjoint at the
   *  type level. Must survive `stripInternal` in the published `.d.ts` or the
   *  empty bundled SinkPortRef becomes structurally assignable from SourcePortRef. */
  readonly [__portDir]: 'source';
  /** Connect this source to one or more sink ports */
  to(...targets: SinkPortRef[]): ConnectionDef;
  /** @internal port path for IR generation */
  readonly _path: { nodeId: string; portName: string };
  /** @internal port type for validation */
  readonly _type: T;
}

/** A sink-direction port reference — values flow INTO it.
 *  Outer-circuit outputs and inner-node inputs are sinks.
 *  Sinks are passive: they appear as `.to(...)` arguments, never as receivers. */
export interface SinkPortRef<T extends PortType = PortType> {
  /** Direction brand — see SourcePortRef. Must survive `stripInternal` so
   *  bundled SinkPortRef stays distinguishable from SourcePortRef. */
  readonly [__portDir]: 'sink';
  /** @internal port path for IR generation */
  readonly _path: { nodeId: string; portName: string };
  /** @internal port type for validation */
  readonly _type: T;
}

/** Unnarrowable at runtime by design — every port object carries `.to`,
 *  so duck-typing would silently invert direction. Refine via the
 *  `ConnectArg`-typed slots in your `connect` callback instead. */
export type PortRef<T extends PortType = PortType> = SourcePortRef<T> | SinkPortRef<T>;

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

/** Resolve a port-map value (PortType or legacy `number` bus-width shorthand)
 *  to a concrete PortType. Single source of truth for port-map normalization;
 *  also re-used by circuit.ts for the public `circuit()` signature. */
export type NormalizePort<T> = T extends number ? BusType : T extends PortType ? T : PortType;
export type NormalizePorts<M> = { [K in keyof M]: NormalizePort<M[K]> };

type SourceRefs<M> = { readonly [K in keyof M]: SourcePortRef<NormalizePort<M[K]>> };
type SinkRefs<M> = { readonly [K in keyof M]: SinkPortRef<NormalizePort<M[K]>> };

/** The connect callback argument — typed from the config's inputs/outputs/nodes.
 *
 * Shape mirrors the config object the user wrote: `{ inputs, outputs, nodes }`.
 * Destructure `nodes` inline (`nodes: { xor1, and1 }`) for terseness on small
 * circuits, or access via `nodes.xor1` for clarity on larger ones.
 *
 * Direction is encoded in the types so that `inputs.a.to(xor1.a, and1.out)`
 * is rejected (and1.out is a source, not a sink) and `xor1.a.to(...)` is
 * rejected (xor1.a is a sink, has no `.to`). See SourcePortRef / SinkPortRef.
 *
 * The conditional on `Nodes[K]` is inlined inside the mapped type so the
 * `infer` substitution happens per-key. Hoisting the conditional out into a
 * named alias causes TS to evaluate the `infer` against `BuiltCircuit`'s
 * default generic constraints — yielding an open index signature that made
 * `nodes.xor1.bogusPort` silently typecheck.
 */
export type ConnectArg<
  Ins extends Record<string, PortType | number>,
  Outs extends Record<string, PortType | number>,
  Nodes extends Record<string, BuiltCircuit>,
> = {
  readonly inputs: SourceRefs<Ins>;
  readonly outputs: SinkRefs<Outs>;
  readonly nodes: {
    readonly [K in keyof Nodes]: Nodes[K] extends BuiltCircuit<infer NIns, infer NOuts, infer _NNs>
      ? SinkRefs<NIns> & SourceRefs<NOuts>
      : never;
  };
};

// ============================================================================
// Eval function types
// ============================================================================

/** Port map → numeric values. What `eval` receives; always numbers. */
export type PortValues<M> = {
  [K in keyof M]: number;
};

/**
 * What `eval` may return: numbers everywhere, booleans on 1-bit ports (they
 * coerce to 1/0 in the typed array, so `{ out: !(a | b) }` is legal).
 *
 * Widened only for `bit`. The exporter emits JS `!` as Verilog `~`, which
 * matches at one bit and diverges above it, so requiring a number on `bus`
 * ports is what keeps that unreachable.
 */
export type PortOutputValues<M> = {
  [K in keyof M]: M[K] extends BitType ? number | boolean : number;
};

/**
 * What a `state:` field may hold as authored — number (bus), boolean (bit),
 * Map (memory), string (text buffers), or a declarative `reg()` / `mem()`.
 *
 * Distinct from the `StateValue` in ../types/circuit.ts, which is the same
 * concept *after* elaboration into the serialized IR: there, memory is a
 * `MemoryValue` carrying its address/data widths rather than a bare Map, and
 * the declarative forms have already been resolved. circuit() converts this
 * into that. Pairs with `StateFieldType` in ./bit-bus.ts.
 */
export type StateFieldValue =
  | number
  | boolean
  | Map<number, number>
  | string
  | import('./bit-bus.js').RegState
  | import('./bit-bus.js').MemState;

/** State shape — plain object where each field is a state value */
export type StateShape = Record<string, StateFieldValue>;

// ============================================================================
// Component metadata
// ============================================================================

export interface CircuitMeta {
  /** Grouping label for the canvas component picker (e.g. `'logic-gates'`,
   *  `'arithmetic'`, `'sequential'`). Free-form — components with the same
   *  category appear together. */
  category?: string;
  /** Short, one-line description of what the component does. Surfaced in
   *  the canvas component picker as a tooltip. For IDE hover docs, write
   *  JSDoc above the `circuit(...)` declaration — the two have different
   *  consumers (runtime UI vs IDE) and a CI test keeps them in sync. */
  description?: string;
  /** Short visual marker for the canvas (Unicode glyph, emoji, or 1–4
   *  characters). Examples: `'&'` for And, `'+'` for Adder, `'📀'` for ROM. */
  icon?: string;
  /** Free-form tags for search/filter in the component picker. */
  tags?: string[];
  /** Component author (informational; mainly for user-published components). */
  author?: string;
  /** Component version (informational). */
  version?: string;
  /** Key in node.arguments that holds the user-interactive value (Switch, Input) */
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
  /** The Circuit IR for this circuit. Contains the canonical representation
   *  used by the simulator, Verilog exporter, and serialization — name, port
   *  descriptors, node list, connection list, etc. Pass this (rather than
   *  the `BuiltCircuit` wrapper) to APIs that consume IR. */
  readonly circuit: Circuit;
  /** Input ports keyed by name. Use this instead of
   *  `circuit.inputs.find(p => p.name === '…')` when you need a specific
   *  port descriptor — autocompletes against the actual port names. */
  readonly inputs: { readonly [K in keyof Ins]: PortDescriptor };
  /** Output ports keyed by name. Same shape and use case as `inputs`. */
  readonly outputs: { readonly [K in keyof Outs]: PortDescriptor };
  /** Sub-nodes keyed by their local id from the `nodes` config. Empty for
   *  primitives (circuits defined with `eval` but no `nodes`); populated for
   *  composite circuits. Useful for inspecting structure or driving
   *  hierarchical UIs. */
  readonly nodes: { readonly [K in keyof Ns]: Node };
  /** @internal Type-level shape for generic propagation. Carries the
   *  per-instance generic parameters so other generic helpers (`ConnectArg`,
   *  `NodePortRefs`) can recover them via `infer`. Not for runtime use. */
  readonly _shape: { inputs: Ins; outputs: Outs; nodes: Ns };
  /** Sub-circuit definitions needed for simulation (transitive). Walk this
   *  map to collect every component needed to register in a `CircuitLibrary`
   *  before simulating or rendering this circuit. */
  readonly _dependencies: ReadonlyMap<string, BuiltCircuit>;
  /** @internal Per-instance arguments baked in by a factory call. Populated
   *  when this BuiltCircuit was produced by calling a parameterized factory
   *  (e.g. `Register({ width: 16, value: 100 })`); undefined for bare
   *  singletons. The parent `circuit()` reads this to populate
   *  `irNodes[i].arguments`, where the simulator picks it up.
   *  Structural args (e.g. `width`) have already done their job by the time
   *  this is read (port widths baked in); state-initial / interactive args
   *  (`value`, `init`, etc.) flow through to the simulator. */
  readonly _args?: Record<string, ArgumentValue>;
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
  /** Input ports — a map of port names to types (`bit`, `bus(n)`, or a raw
   *  number as shorthand for `bus(n)`). Port names autocomplete inside
   *  `connect`/`eval` callbacks. */
  inputs?: Ins;
  /** Output ports — same shape as `inputs`. */
  outputs?: Outs;
  /** Sub-components used inside this circuit. Map a local name to a
   *  `BuiltCircuit` (from the stdlib or another `circuit(...)` call), then
   *  wire them up in `connect`. Parameterized components (e.g. `Register`,
   *  `ROM`, `Constant`) are factories — call them with options to specialize:
   *  `nodes: { reg: Register({ width: 16, value: 100 }) }`. Singletons
   *  (e.g. gates) are used bare: `nodes: { g: And }`. */
  nodes?: Nodes;
  /** Wire sub-nodes and ports together. Receives `{ inputs, outputs, nodes }`
   *  with destructurable port refs and returns an array of connections built
   *  via `port.to(...targets)`. Use this for composite circuits — the
   *  alternative is `eval` for primitives. */
  connect?: (arg: ConnectArg<Ins, Outs, Nodes>) => ConnectionDef[];
  /** Combinational behavior — given input values (and current state), return
   *  output values. Use for primitives (gates, ALUs, decoders) whose output
   *  is a pure function of inputs. Pair with `onTick` for sequential logic. */
  eval?: (inputs: PortValues<Ins> & S) => PortOutputValues<Outs>;
  /** Sequential state. Map of named state fields, each a `reg(width)` or
   *  `mem(depth, width)` declaration (for synthesizable Verilog), or a raw
   *  number / boolean / Map for simulation-only state. Read inside `eval`,
   *  updated by `onTick`. */
  state?: S;
  /** Clock-edge state update — given inputs and current state, return the
   *  next state. Runs once per clock tick. Sequential components (registers,
   *  memories, counters) use this in tandem with `state`. */
  onTick?: (inputsAndState: PortValues<Ins> & S) => S;
  /** Component metadata — category, description, icon, etc. Used by the
   *  canvas component picker and by tooling. See `CircuitMeta` for fields. */
  meta?: CircuitMeta;
}

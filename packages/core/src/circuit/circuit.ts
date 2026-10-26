/**
 * Circuit Definition — Object Syntax Only
 *
 * Creates hardware circuits using a single object configuration.
 * Produces Circuit IR compatible with the simulation pipeline.
 *
 * Usage:
 *   const HalfAdder = circuit('HalfAdder', {
 *     inputs:  { a: bit, b: bit },
 *     outputs: { sum: bit, carry: bit },
 *     nodes:   { xor1: Xor, and1: And },
 *     connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
 *       inputs.a.to(xor1.a, and1.a),
 *       inputs.b.to(xor1.b, and1.b),
 *       xor1.out.to(outputs.sum),
 *       and1.out.to(outputs.carry),
 *     ],
 *   })
 */

import type {
  ArgumentValue,
  Circuit,
  CircuitMetadata,
  CircuitTiming,
  ClockDescriptor,
  Connection,
  Implementation,
  Node,
  PortDescriptor,
  PortType,
  StateBlock,
} from '../types/circuit.js';
import { isMemState, isRegState, normalizePortType } from './bit-bus.js';
import { type EvalEntry, noteDefinition, registerCircuitEval } from './eval-registry.js';
import type {
  BuiltCircuit,
  CircuitConfig,
  CircuitMeta,
  ConnectArg,
  ConnectionDef,
  NodeEntry,
  NormalizePorts,
  SinkPortRef,
  SourcePortRef,
  StateShape,
} from './types.js';

// ============================================================================
// Port reference creation (for connect callbacks)
// ============================================================================

// IMPORTANT runtime/type asymmetry: every port object carries `.to` at
// runtime, including the ones the type system presents as SinkPortRef
// (via ConnectArg's mapped types). The type system catches a reversed
// connection at edit time (#110), but the editor runs type-stripped code, so
// `checkDirection` below rejects one at build time as well (#428).
/** Which side of the circuit boundary a top-level port sits on, for advice. */
type CircuitPortRole = 'input' | 'output';

/** Probed by promise resolution and JSON.stringify; must not throw. */
const PASSTHROUGH_PROPS = new Set(['then', 'toJSON']);

function createPortRef(
  nodeId: string,
  portName: string,
  portType: PortType,
  role?: CircuitPortRole,
): SourcePortRef {
  const ref = {
    _path: { nodeId, portName },
    _type: portType,
    to(...targets: SinkPortRef[]): ConnectionDef {
      return {
        source: { nodeId, portName },
        targets: targets.map((t) => ({ nodeId: t._path.nodeId, portName: t._path.portName })),
        portType,
      };
    },
  };
  // A port is already the end of a wire, so `.out` or `.in` on one is the
  // habit carried over from Switch and Led. Without this, `a.out` is undefined
  // and `.to` on it throws a bare TypeError that names neither port.
  return new Proxy(ref, {
    get(target, prop) {
      if (typeof prop === 'symbol' || prop in target) return Reflect.get(target, prop);
      if (prop.startsWith('_') || PASSTHROUGH_PROPS.has(prop)) return undefined;
      const label = nodeId === '' ? portName : `${nodeId}.${portName}`;
      const advice =
        role === 'input'
          ? ` Use it directly: \`${portName}.to(...)\``
          : role === 'output'
            ? ` Use it directly: \`x.out.to(${portName})\``
            : '';
      throw new Error(`\`${label}\` is a port, not a node, so it has no \`.${prop}\`.${advice}`);
    },
  }) as unknown as SourcePortRef;
}

function createNodeProxy(
  nodeId: string,
  ports: Map<string, PortType>,
  componentName?: string,
  role?: CircuitPortRole,
): Record<string, SourcePortRef> {
  const refs: Record<string, SourcePortRef> = {};
  for (const [name, type] of ports) {
    refs[name] = createPortRef(nodeId, name, type, role);
  }
  return new Proxy(refs, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol' || prop.startsWith('_')) return undefined;
      const label =
        nodeId === '' ? 'circuit' : `node '${nodeId}'${componentName ? ` (${componentName})` : ''}`;
      const available = Object.keys(target).join(', ');
      throw new Error(
        `Port '${prop}' does not exist on ${label}. Available ports: ${available || 'none'}`,
      );
    },
  });
}

// ============================================================================
// circuit() — single entry point
// ============================================================================

/**
 * Create a hardware circuit from a single object configuration.
 *
 * `name` is the circuit's identifier; the second arg is either:
 * - A configuration object (for unparameterized circuits) — returns a
 *   `BuiltCircuit` directly.
 * - A factory function `(opts) => config` (for parameterized circuits) —
 *   returns a callable `(opts?) => BuiltCircuit`. Call it to specialize:
 *   `Register({ width: 16, value: 100 })`.
 *
 * Singletons are used bare: `nodes: { g: And }`. Parameterized components
 * are always called: `nodes: { r: Register() }` for defaults,
 * `nodes: { r: Register({ width: 16 }) }` to specialize.
 *
 * TypeScript infers port and node names from the object literal, so
 * destructuring inside `connect` and `eval` callbacks autocompletes.
 *
 * **Example — unparameterized:**
 * ```ts
 * const HalfAdder = circuit('HalfAdder', {
 *   inputs:  { a: bit, b: bit },
 *   outputs: { sum: bit, carry: bit },
 *   nodes:   { xor1: Xor, and1: And },
 *   connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
 *     inputs.a.to(xor1.a, and1.a),
 *     inputs.b.to(xor1.b, and1.b),
 *     xor1.out.to(outputs.sum),
 *     and1.out.to(outputs.carry),
 *   ],
 * })
 * ```
 *
 * **Example — parameterized:**
 * ```ts
 * const Register = circuit('Register', ({ width = 8, value = 0 } = {}) => ({
 *   inputs:  { data: bus(width), we: bit },
 *   outputs: { q: bus(width) },
 *   state:   { value },
 *   eval:    ({ value }) => ({ q: value }),
 *   onTick:  ({ data, we, value }) => ({ value: we ? data : value }),
 * }))
 * ```
 */
// `Ins`/`Outs` default to `{}` rather than falling back to their constraint.
// `inputs`/`outputs` are optional, so a port-less component (Switch has no
// inputs, Led no outputs) gives TypeScript nothing to infer from — and without
// a default it substitutes the constraint, `Record<string, PortType | number>`.
// That is an OPEN INDEX SIGNATURE: `sw.banana` type-checks, and inside a
// `connect` callback the editor can offer no completions on `sw.` because
// every key is equally valid. `= {}` closes it, so port names autocomplete and
// a typo is an error. See ConnectArg's note on the same hazard.
export function circuit<
  Opts extends Record<string, ArgumentValue>,
  Ins extends Record<string, PortType | number> = Record<never, never>,
  Outs extends Record<string, PortType | number> = Record<never, never>,
  Nodes extends Record<string, NodeEntry> = Record<string, NodeEntry>,
  S extends StateShape = StateShape,
>(
  name: string,
  factory: (opts?: Opts) => CircuitConfig<Ins, Outs, Nodes, S>,
): (opts?: Opts) => BuiltCircuit<NormalizePorts<Ins>, NormalizePorts<Outs>, Nodes>;
export function circuit<
  Ins extends Record<string, PortType | number> = Record<never, never>,
  Outs extends Record<string, PortType | number> = Record<never, never>,
  Nodes extends Record<string, NodeEntry> = Record<string, NodeEntry>,
  S extends StateShape = StateShape,
>(
  name: string,
  config?: CircuitConfig<Ins, Outs, Nodes, S>,
): BuiltCircuit<NormalizePorts<Ins>, NormalizePorts<Outs>, Nodes>;
export function circuit(
  name: string,
  configOrFactory: AnyCircuitConfig | CircuitFactory = {},
): BuiltCircuit | ((opts?: FactoryOptions) => BuiltCircuit) {
  assertCircuitName(name);
  if (typeof configOrFactory === 'function') return specializeFactory(name, configOrFactory);
  return buildCircuit(name, configOrFactory);
}

// ============================================================================
// Steps
// ============================================================================

/** A config with every generic at its default, as the implementation sees it. */
type AnyCircuitConfig = CircuitConfig;
type FactoryOptions = Record<string, ArgumentValue>;
type CircuitFactory = (opts?: FactoryOptions) => AnyCircuitConfig;

/** A circuit's own ports after `bus(n)` shorthand is resolved. */
interface Ports {
  inputs: Map<string, PortType>;
  outputs: Map<string, PortType>;
}

type PortPath = { nodeId: string; portName: string };

/**
 * Runtime guard: typescript would catch `circuit(SomeObject, {...})` at
 * typecheck time, but in the in-browser editor user code is type-stripped
 * and run via new Function() — types are gone by the time it executes, so
 * a misspelled / mis-pasted import like `circuit(React, {...})` just
 * accepts the object and stashes it as the circuit's name. That object
 * then percolates through to UI render paths that expect a string, where
 * React eventually throws a cryptic "Objects are not valid as a React
 * child" error with no hint that the actual problem is in the user's
 * circuit() call. Catch it at the call site with a useful message.
 */
function assertCircuitName(name: unknown): asserts name is string {
  if (typeof name === 'string') return;
  const got = name === null ? 'null' : Array.isArray(name) ? 'array' : typeof name;
  throw new Error(
    `circuit() expects a string name as the first argument, got ${got}. ` +
      `Usage: circuit('MyCircuit', { inputs, outputs, nodes, connect }). ` +
      `(A common cause is a stray import / variable being passed by mistake, ` +
      `e.g. circuit(React, {...}) — the first argument must be a literal string name.)`,
  );
}

/**
 * Factory form: return a callable that builds a per-instance BuiltCircuit
 * with `_args` attached. The factory closes over the original `name`, so
 * every specialized instance shares the same component name (and registry
 * entry) — shape can differ per call (e.g. port widths), but the eval/
 * onTick logic is parameter-agnostic and registers equivalently each time.
 */
function specializeFactory(name: string, factory: CircuitFactory) {
  return (opts?: FactoryOptions): BuiltCircuit => {
    const built = buildCircuit(name, factory(opts)) as {
      -readonly [K in keyof BuiltCircuit]: BuiltCircuit[K];
    };
    built._args = withResolvedStateInitials(built.circuit.state, opts ?? {});
    resetStateInitials(built.circuit.state);
    return built;
  };
}

/**
 * The instance's arguments, plus the state initial the factory resolved for
 * every state field the caller did not pass. Without this, a default written
 * in the factory (`({ value = 7 } = {}) => ({ state: { value } })`) was lost
 * when `resetStateInitials` cleared it, and `C()` started at 0 (#428). The
 * simulator reads a node's state initial from `node.arguments[block.name]`
 * (sequential-init.ts), as does the Verilog exporter's Register mapping, so
 * recording it there is all they need. Type defaults (0, empty memory) are
 * left out so `Register()` keeps empty args.
 */
function withResolvedStateInitials(state: StateBlock[], opts: FactoryOptions): FactoryOptions {
  const args: FactoryOptions = { ...opts };
  for (const sb of state) {
    if (sb.name in args) continue;
    const iv = sb.initialValue;
    if (sb.stateType.kind === 'memory') {
      const data = (iv as { data?: Map<number, number> } | undefined)?.data;
      if (data && data.size > 0) args[sb.name] = Object.fromEntries(data);
    } else if (typeof iv === 'number' && iv !== 0) {
      args[sb.name] = iv;
    }
  }
  return args;
}

/**
 * Strip per-instance state initials baked in by ES6-shorthand
 * declarations like `state: { value }`. Dep-merging (`collectDependencies`)
 * picks the FIRST node's BuiltCircuit as the canonical
 * library entry; if state initials varied per instance, every
 * instance without an explicit args override would inherit whichever
 * value happened to come first. Per-instance values flow through
 * `node.arguments[block.name]` and are applied by sequential-init.ts;
 * here we normalize the IR's state initials to type defaults.
 */
function resetStateInitials(state: StateBlock[]): void {
  for (const sb of state) {
    if (sb.stateType.kind === 'bit') {
      // 0, not `false`: this writes into the serialized IR, which crosses
      // the sandbox boundary and feeds the Verilog exporter. Every
      // factory-built primitive with bit state — DFlipFlop among them —
      // carried `initialValue: false` here, which is what made
      // sequential-init's defensive coercion load-bearing.
      sb.initialValue = 0;
    } else if (sb.stateType.kind === 'bus') {
      // Preserve string state (e.g. Console buffers) — only numeric
      // bus initials get reset to 0.
      if (typeof sb.initialValue === 'number') sb.initialValue = 0;
    } else if (sb.stateType.kind === 'memory') {
      const iv = sb.initialValue as { addressWidth: number; dataWidth: number } | undefined;
      sb.initialValue = {
        data: new Map<number, number>(),
        addressWidth: iv?.addressWidth ?? sb.stateType.addressWidth,
        dataWidth: iv?.dataWidth ?? sb.stateType.dataWidth,
      };
    }
  }
}

/** Object form: validate the config, then build its IR and register its behaviour. */
function buildCircuit(name: string, config: AnyCircuitConfig): BuiltCircuit {
  const ports = normalizePorts(config);
  const declaredNodes = (config.nodes ?? {}) as Record<string, NodeEntry>;
  const errors: string[] = [];

  const nodes = expandNodes(declaredNodes, errors);
  validateConfig(config, ports, declaredNodes, errors);
  const defs = evaluateConnect(config, ports, declaredNodes, errors);
  const connectionDefs = validateNetlist(name, defs, ports, nodes, errors);
  const dependencies = collectDependencies(nodes, errors);

  if (errors.length > 0) {
    throw new Error(`Circuit '${name}' validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  const built = buildIR(name, config, ports, nodes, connectionDefs, dependencies);
  registerBehaviour(name, config, built.circuit);
  return built;
}

function normalizePorts(config: AnyCircuitConfig): Ports {
  const inputs = new Map<string, PortType>();
  if (config.inputs) {
    for (const [portName, portType] of Object.entries(config.inputs)) {
      inputs.set(portName, normalizePortType(portType as PortType | number));
    }
  }

  const outputs = new Map<string, PortType>();
  if (config.outputs) {
    for (const [portName, portType] of Object.entries(config.outputs)) {
      outputs.set(portName, normalizePortType(portType as PortType | number));
    }
  }
  return { inputs, outputs };
}

/**
 * `{ n: [Nand, Nand] }` becomes `{ n0: Nand, n1: Nand }`. Everything after
 * this point — validation, IR, dependencies, sequential detection — sees a
 * plain flat map and needs no knowledge of arrays. Only `connect` is handed
 * the original shape, so `n[i]` still resolves to the i-th instance.
 */
function expandNodes(
  declaredNodes: Record<string, NodeEntry>,
  errors: string[],
): Record<string, BuiltCircuit> {
  const nodes: Record<string, BuiltCircuit> = {};
  for (const [key, entry] of Object.entries(declaredNodes)) {
    if (!Array.isArray(entry)) {
      if (key in nodes) errors.push(`Node name '${key}' is declared twice`);
      nodes[key] = entry as BuiltCircuit;
      continue;
    }
    entry.forEach((comp: BuiltCircuit, i: number) => {
      const id = `${key}${i}`;
      // An expanded id can land on a name someone also wrote by hand. Silent
      // overwrite would drop a node from the netlist with nothing to show for
      // it, so it is an error rather than a surprise.
      if (id in nodes) errors.push(`Node name '${id}' is declared twice`);
      nodes[id] = comp;
    });
  }
  return nodes;
}

/** Checks on the config itself, before `connect` runs. */
function validateConfig(
  config: AnyCircuitConfig,
  { inputs, outputs }: Ports,
  declaredNodes: Record<string, NodeEntry>,
  errors: string[],
): void {
  // Duplicate port names
  const allPortNames = new Set<string>();
  for (const n of inputs.keys()) {
    if (allPortNames.has(n)) errors.push(`Duplicate port name: '${n}'`);
    allPortNames.add(n);
  }
  for (const n of outputs.keys()) {
    if (allPortNames.has(n)) errors.push(`Port name '${n}' used for both input and output`);
    allPortNames.add(n);
  }

  // State name collisions
  if (config.state) {
    for (const key of Object.keys(config.state)) {
      if (inputs.has(key)) errors.push(`State name '${key}' collides with input port name`);
      if (outputs.has(key)) errors.push(`State name '${key}' collides with output port name`);
    }
  }

  // Reserved node names — these would shadow the connect callback's
  // top-level destructure keys (`inputs`, `outputs`, `nodes`).
  // Checked against the *declared* keys, not the expanded ones: an array named
  // `inputs` expands to `inputs0`, which is harmless, but `nodes.inputs` is
  // what the callback would have to destructure.
  for (const nodeName of Object.keys(declaredNodes)) {
    if (nodeName === 'inputs' || nodeName === 'outputs' || nodeName === 'nodes') {
      errors.push(`Node name '${nodeName}' is reserved`);
    }
  }

  // onTick without state
  if (config.onTick && !config.state) {
    errors.push('.onTick() requires state to be defined');
  }
}

/** Run `connect` against port refs and return the connections it built. */
function evaluateConnect(
  config: AnyCircuitConfig,
  { inputs, outputs }: Ports,
  declaredNodes: Record<string, NodeEntry>,
  errors: string[],
): ConnectionDef[] {
  if (!config.connect) return [];

  const refsFor = (nodeId: string, comp: BuiltCircuit) => {
    const allPorts = new Map<string, PortType>();
    for (const pd of comp.circuit.inputs) allPorts.set(pd.name, pd.portType);
    for (const pd of comp.circuit.outputs) allPorts.set(pd.name, pd.portType);
    return createNodeProxy(nodeId, allPorts, comp.circuit.name);
  };

  // An array entry hands `connect` an array of refs, each bound to the id it
  // was expanded to — so `n[3]` writes connections against node `n3`.
  const nodeRefs: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(declaredNodes)) {
    nodeRefs[key] = Array.isArray(entry)
      ? entry.map((comp: BuiltCircuit, i: number) => refsFor(`${key}${i}`, comp))
      : refsFor(key, entry as BuiltCircuit);
  }

  const arg = {
    inputs: createNodeProxy('', inputs, undefined, 'input'),
    outputs: createNodeProxy('', outputs, undefined, 'output'),
    nodes: nodeRefs,
  };

  let result: unknown;
  try {
    result = config.connect(arg as unknown as ConnectArg<any, any, any>);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return [];
  }
  return checkConnectResult(result, errors);
}

/**
 * `connect` has to return a flat array of `port.to(...)` results. Untyped
 * editor code can return anything, and iterating something else used to throw
 * a bare TypeError that named nothing in the user's code (#428).
 */
function checkConnectResult(result: unknown, errors: string[]): ConnectionDef[] {
  if (!Array.isArray(result)) {
    errors.push(
      `connect must return an array of connections, got ${describeValue(result)}. ` +
        'Return the list from the callback: `connect: ({ inputs, outputs, nodes }) => [a.to(b)]`',
    );
    return [];
  }
  const defs: ConnectionDef[] = [];
  result.forEach((item: unknown, i: number) => {
    if (isConnectionDef(item)) {
      defs.push(item);
    } else if (Array.isArray(item)) {
      errors.push(
        `connect returned a nested array at index ${i}. The list must be flat: ` +
          'spread the inner array with `...`, e.g. `...bits.map((b) => b.to(x))`',
      );
    } else {
      errors.push(
        `connect returned ${describeValue(item)} at index ${i}, which is not a connection. ` +
          'Every entry must come from `port.to(...)`',
      );
    }
  });
  return defs;
}

function isPortPath(value: unknown): value is PortPath {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p.nodeId === 'string' && typeof p.portName === 'string';
}

function isConnectionDef(value: unknown): value is ConnectionDef {
  if (typeof value !== 'object' || value === null) return false;
  const def = value as Record<string, unknown>;
  return isPortPath(def.source) && Array.isArray(def.targets) && def.targets.every(isPortPath);
}

function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return 'an object';
  return typeof value === 'undefined' ? 'undefined' : `a ${typeof value}`;
}

/**
 * Checks on the connections `connect` built: every end exists and points the
 * right way, each sink has one driver, and bus widths agree. Returns the
 * connections with identical duplicates removed.
 */
function validateNetlist(
  name: string,
  defs: ConnectionDef[],
  { inputs, outputs }: Ports,
  nodes: Record<string, BuiltCircuit>,
  errors: string[],
): ConnectionDef[] {
  // Validate connection port references, then their direction
  for (const conn of defs) {
    const sourceExists = validatePortRef(conn.source, inputs, outputs, nodes, errors);
    for (const target of conn.targets) {
      const targetExists = validatePortRef(target, inputs, outputs, nodes, errors);
      if (sourceExists && targetExists) {
        checkDirection(conn.source, target, inputs, nodes, errors);
      }
    }
  }

  const { connectionDefs, conflictsByTarget } = dedupeDrivers(defs);

  checkBusWidths(name, connectionDefs, inputs, outputs, nodes, errors);

  // Sort conflict keys for deterministic error ordering across runs.
  const sortedConflictKeys = [...conflictsByTarget.keys()].sort();
  for (const key of sortedConflictKeys) {
    const sources = [...conflictsByTarget.get(key)!].join(', ');
    errors.push(`${key} has multiple drivers: ${sources}`);
  }

  return connectionDefs;
}

/**
 * Multi-driver detection. Every driver of every node-port pair is declared
 * inside one circuit's connect callback — flattening never introduces a new
 * driver — so per-circuit scanning is complete. (If parameterized
 * instantiation lands, this check would need to re-run post-substitution.)
 *
 * Identical (target, source) triples → silently dedupe.
 * Same target with different source → multi-driver error.
 */
function dedupeDrivers(defs: ConnectionDef[]): {
  connectionDefs: ConnectionDef[];
  conflictsByTarget: Map<string, Set<string>>;
} {
  const seenByTarget = new Map<string, PortPath>();
  const conflictsByTarget = new Map<string, Set<string>>();
  const dedupedDefs: ConnectionDef[] = [];
  for (const def of defs) {
    const newTargets: typeof def.targets = [];
    for (const target of def.targets) {
      const targetKey = formatPath(target);
      const existing = seenByTarget.get(targetKey);
      if (existing) {
        if (existing.nodeId === def.source.nodeId && existing.portName === def.source.portName) {
          continue; // identical duplicate
        }
        let set = conflictsByTarget.get(targetKey);
        if (!set) {
          set = new Set([formatPath(existing)]);
          conflictsByTarget.set(targetKey, set);
        }
        set.add(formatPath(def.source));
        continue; // drop conflicting target; error pushed by the caller
      }
      seenByTarget.set(targetKey, { nodeId: def.source.nodeId, portName: def.source.portName });
      newTargets.push(target);
    }
    if (newTargets.length > 0) {
      dedupedDefs.push({ ...def, targets: newTargets });
    }
  }
  return { connectionDefs: dedupedDefs, conflictsByTarget };
}

function checkBusWidths(
  name: string,
  connectionDefs: ConnectionDef[],
  inputs: Map<string, PortType>,
  outputs: Map<string, PortType>,
  nodes: Record<string, BuiltCircuit>,
  errors: string[],
): void {
  // Bus width validation, split by direction because the two directions are not
  // the same kind of event.
  //
  // Truncation (bus(16) -> bus(8)) is an error: elaboration propagates the
  // *source* type, so the high bits are simply gone with nothing recording that
  // they were dropped. Every width bug this check was written for was one of
  // these.
  //
  // Widening (bus(3) -> bus(8)) is a warning, not an error. A port here is
  // uninterpreted `Bits` — `PortType` is bit | bus(n), with signedness carried
  // by the *component* (SignedAdder, SignedComparator, ...) rather than the
  // type. With no sign in the type there is only one meaning a widening can
  // have, so requiring the author to spell it out states nothing the type does
  // not already fix. It stays a warning because the widths still disagree and
  // that is worth seeing. (SpinalHDL's `Bits.resize` zero-extends for exactly
  // this reason; Verilog and Amaranth widen implicitly off declared signedness.)
  //
  // If signedness moves into PortType, a widening starts carrying a real choice
  // and this warning should become an error — or disappear, resolved by type.
  //
  // Scoped to bus->bus. Crossing bit<->bus is a *kind* change, not a width
  // mismatch, and stays a documented affordance (see SourcePortRef, #144) —
  // `bit` is its own PortType kind here, not `bus(1)`.
  //
  // Runs after the multi-driver dedupe so a duplicated identical connection is
  // reported once, and re-resolves both endpoints because ConnectionDef carries
  // only the source's type.
  const wideningWarnings: string[] = [];
  for (const conn of connectionDefs) {
    const sourceType = resolvePortRef(conn.source, inputs, outputs, nodes);
    if (sourceType?.kind !== 'bus') continue;
    for (const target of conn.targets) {
      const targetType = resolvePortRef(target, inputs, outputs, nodes);
      if (targetType?.kind !== 'bus') continue;
      if (targetType.width === sourceType.width) continue;
      const describe =
        `${formatPath(conn.source)} bus(${sourceType.width}) ` +
        `into ${formatPath(target)} bus(${targetType.width})`;
      if (sourceType.width > targetType.width) {
        errors.push(`truncates ${describe}`);
      } else {
        wideningWarnings.push(`widens ${describe}`);
      }
    }
  }
  if (wideningWarnings.length > 0) {
    // Deduped by message: circuit() runs in hot loops (the property-test
    // harnesses build thousands of wrappers per run), so warning per
    // construction would bury the output it is trying to surface.
    const warning = `Circuit '${name}' widens bus connections:\n  - ${wideningWarnings.join('\n  - ')}`;
    if (!reportedWideningWarnings.has(warning)) {
      reportedWideningWarnings.add(warning);
      console.warn(warning);
    }
  }
}

/** Assemble the Circuit IR and the BuiltCircuit wrapper around it. */
function buildIR(
  name: string,
  config: AnyCircuitConfig,
  { inputs, outputs }: Ports,
  nodes: Record<string, BuiltCircuit>,
  connectionDefs: ConnectionDef[],
  dependencies: Map<string, BuiltCircuit>,
): BuiltCircuit {
  const inputDescs: PortDescriptor[] = Array.from(inputs, ([n, t]) => ({ name: n, portType: t }));
  const outputDescs: PortDescriptor[] = Array.from(outputs, ([n, t]) => ({ name: n, portType: t }));
  const { implementation, timing } = classifyImplementation(config, nodes);

  const clocks: ClockDescriptor[] = [];
  if (config.state != null || config.onTick != null) {
    clocks.push({ name: 'clk' });
  }

  const irNodes = buildIrNodes(nodes);
  const circuitIR: Circuit = {
    version: 1,
    name,
    inputs: inputDescs,
    outputs: outputDescs,
    clocks,
    state: buildStateBlocks(name, config.state),
    nodes: irNodes,
    connections: buildIrConnections(connectionDefs),
    implementation,
    metadata: buildMetadata(timing, config.meta),
  };

  const inputsByName: Record<string, PortDescriptor> = {};
  for (const p of inputDescs) inputsByName[p.name] = p;
  const outputsByName: Record<string, PortDescriptor> = {};
  for (const p of outputDescs) outputsByName[p.name] = p;
  const nodesById: Record<string, Node> = {};
  for (const n of irNodes) nodesById[n.id] = n;

  const built = {
    circuit: circuitIR,
    inputs: inputsByName,
    outputs: outputsByName,
    nodes: nodesById,
    _dependencies: dependencies,
  } as unknown as BuiltCircuit;

  // Map serializes as `{}` by default — define a non-enumerable toJSON so
  // JSON.stringify emits dependencies as a plain object without polluting
  // `console.log` / `Object.keys` output.
  Object.defineProperty(built, 'toJSON', {
    value: function () {
      const dependencies: Record<string, unknown> = {};
      for (const [n, d] of this._dependencies) dependencies[n] = d;
      return { circuit: this.circuit, _dependencies: dependencies };
    },
    enumerable: false,
  });
  return built;
}

function classifyImplementation(
  config: AnyCircuitConfig,
  nodes: Record<string, BuiltCircuit>,
): { implementation: Implementation; timing: CircuitTiming } {
  const hasEval = config.eval != null;
  const hasNodes = Object.keys(nodes).length > 0;

  // A circuit with inputs and outputs but neither nodes nor an eval has nothing
  // that could ever drive its outputs: it is an empty composite, not an opaque
  // primitive. A part declared for someone to fill in looks like this until they
  // do. Inputs only (a display) or outputs only (a switch) still mean a
  // primitive the simulator or the host drives.
  const isEmptyBody =
    !hasEval &&
    !hasNodes &&
    Object.keys(config.inputs ?? {}).length > 0 &&
    Object.keys(config.outputs ?? {}).length > 0;

  if (hasEval && !hasNodes) {
    return {
      implementation: { kind: 'primitive' },
      timing: config.state != null ? 'sequential' : 'combinational',
    };
  }
  if (hasNodes || isEmptyBody) {
    return {
      implementation: { kind: 'composite' },
      timing: detectSequential(nodes, config.state) ? 'sequential' : 'combinational',
    };
  }
  return { implementation: { kind: 'primitive' }, timing: 'combinational' };
}

/**
 * One state block per state field. A plain number is always `bus(32)` and a
 * plain Map always a 16-bit-address, 8-bit-data memory: neither form says its
 * width, so these are fixed defaults rather than inferred. Use `reg(width)` and
 * `mem(depth, width)` to declare the width (#428).
 */
function buildStateBlocks(name: string, state: StateShape | undefined): StateBlock[] {
  const stateBlocks: StateBlock[] = [];
  if (state == null) return stateBlocks;
  for (const [key, value] of Object.entries(state)) {
    const block = { id: `${name}-${key}`, name: key, clockRef: 'clk', edge: 'rising' } as const;
    if (isMemState(value)) {
      // Declarative memory: mem(depth, width)
      const addrWidth = Math.ceil(Math.log2(value.depth)) || 1;
      stateBlocks.push({
        ...block,
        stateType: { kind: 'memory', addressWidth: addrWidth, dataWidth: value.width },
        initialValue: {
          data: new Map(value.initial),
          addressWidth: addrWidth,
          dataWidth: value.width,
        },
      });
    } else if (isRegState(value)) {
      // Declarative register: reg(width)
      stateBlocks.push({
        ...block,
        stateType: value.width === 1 ? { kind: 'bit' } : { kind: 'bus', width: value.width },
        initialValue: value.initial,
      });
    } else if (value instanceof Map) {
      // Legacy: Map<number, number> → { kind: 'memory' }
      stateBlocks.push({
        ...block,
        stateType: { kind: 'memory', addressWidth: 16, dataWidth: 8 },
        initialValue: { data: new Map(value), addressWidth: 16, dataWidth: 8 },
      });
    } else if (typeof value === 'boolean') {
      // Defensive only: `StateFieldValue` no longer permits boolean, so this
      // is unreachable from typed code. Kept for untyped (plain JS) callers —
      // without it a boolean would fall through to the bus branch below and
      // land in the IR verbatim, which is worse than coercing.
      stateBlocks.push({ ...block, stateType: { kind: 'bit' }, initialValue: value ? 1 : 0 });
    } else {
      // Bus state (number)
      stateBlocks.push({ ...block, stateType: { kind: 'bus', width: 32 }, initialValue: value });
    }
  }
  return stateBlocks;
}

function buildIrNodes(nodes: Record<string, BuiltCircuit>): Node[] {
  const irNodes: Node[] = [];
  for (const [nodeId, comp] of Object.entries(nodes)) {
    irNodes.push({
      id: nodeId,
      componentRef: comp.circuit.name,
      arguments: comp._args ?? {},
      inputs: comp.circuit.inputs.map((p: PortDescriptor) => ({
        id: `${nodeId}.${p.name}`,
        name: p.name,
        portType: p.portType,
      })),
      outputs: comp.circuit.outputs.map((p: PortDescriptor) => ({
        id: `${nodeId}.${p.name}`,
        name: p.name,
        portType: p.portType,
      })),
      clocks: comp.circuit.clocks.map((c: ClockDescriptor) => ({
        id: `${nodeId}.${c.name}`,
        name: c.name,
      })),
    });
  }
  return irNodes;
}

function buildIrConnections(connectionDefs: ConnectionDef[]): Connection[] {
  const connections: Connection[] = [];
  let connIdx = 0;
  for (const def of connectionDefs) {
    for (const target of def.targets) {
      connections.push({
        id: `conn_${connIdx++}`,
        source: { nodeId: def.source.nodeId, portName: def.source.portName },
        target: { nodeId: target.nodeId, portName: target.portName },
        portType: def.portType,
      });
    }
  }
  return connections;
}

/** Metadata fields copied from `meta`, omitting undefined keys for cleaner introspection. */
const META_KEYS = [
  'description',
  'category',
  'icon',
  'tags',
  'author',
  'version',
  'synthesizable',
  // Needed for time-travel to restore Switch/Input values alongside
  // engine state — captureEnvironmentalState reads this to know which
  // node.arguments key to snapshot. Omitting silently broke rewind.
  'interactiveArg',
] as const satisfies readonly (keyof CircuitMetadata & keyof CircuitMeta)[];

function buildMetadata(timing: CircuitTiming, meta: CircuitMeta | undefined): CircuitMetadata {
  const metadata: CircuitMetadata = { timing };
  if (!meta) return metadata;
  for (const key of META_KEYS) {
    if (meta[key] !== undefined) (metadata as Record<string, unknown>)[key] = meta[key];
  }
  return metadata;
}

/**
 * Sub-circuit definitions for the direct BuiltCircuit → simulator path, keyed
 * by component name. The library this feeds holds one definition per name and
 * composites are flattened from it, so two composites under one name with
 * different insides would both simulate as whichever was seen first (#428).
 * That is reported as an error. Primitives are safe to share: each node
 * carries its own port widths and arguments.
 */
function collectDependencies(
  nodes: Record<string, BuiltCircuit>,
  errors: string[],
): Map<string, BuiltCircuit> {
  const deps = new Map<string, BuiltCircuit>();
  const reported = new Set<string>();
  const add = (depName: string, depComp: BuiltCircuit) => {
    const existing = deps.get(depName);
    if (!existing) {
      deps.set(depName, depComp);
    } else if (!reported.has(depName) && !sameStructure(existing.circuit, depComp.circuit)) {
      reported.add(depName);
      errors.push(
        `Two different definitions of '${depName}' are used here (their nodes, ports or ` +
          'connections differ, e.g. a factory called with options that change its insides). ' +
          'A component name maps to one definition, so name each variant, e.g. ' +
          `\`const ${depName} = (n) => circuit(\`${depName}\${n}\`, { ... })\``,
      );
    }
  };
  for (const comp of Object.values(nodes)) {
    add(comp.circuit.name, comp);
    // Merge transitive dependencies
    if (comp._dependencies) {
      for (const [depName, depComp] of comp._dependencies) add(depName, depComp);
    }
  }
  return deps;
}

/**
 * Register eval/onTick in the shared registry at definition time.
 * Every primitive defined via circuit() gets an entry — display-only
 * primitives like HexDisplay/Screen have no `eval` of their own (no
 * computation, no outputs) but still need a registered no-op so the
 * simulator's eval-bridge can dispatch through them instead of falling
 * into evaluateNodeFallback and throwing "no registered evaluator".
 */
function registerBehaviour(name: string, config: AnyCircuitConfig, circuitIR: Circuit): void {
  const entry: EvalEntry = {
    inputNames: circuitIR.inputs.map((p) => p.name),
    outputNames: circuitIR.outputs.map((p) => p.name),
    evalFn: (config.eval ?? (() => ({}))) as EvalEntry['evalFn'],
    stateKeys: config.state ? Object.keys(config.state) : undefined,
    onTickFn: config.onTick as EvalEntry['onTickFn'],
  };
  // Only a primitive's behaviour comes from this entry; a composite is
  // flattened from its IR, and `collectDependencies` checks those.
  if (circuitIR.implementation.kind === 'primitive') {
    noteDefinition(name, () => definitionKey(entry));
  }
  registerCircuitEval(name, entry);
}

/**
 * What makes two primitives under one name the same definition: the port and
 * state names and the behaviour's source text. Port widths are left out, since
 * specialisations of one factory differ there and nowhere else.
 */
function definitionKey(entry: EvalEntry): string {
  return JSON.stringify([
    entry.inputNames,
    entry.outputNames,
    entry.stateKeys ?? [],
    String(entry.evalFn),
    entry.onTickFn ? String(entry.onTickFn) : '',
  ]);
}

// ============================================================================
// Helpers
// ============================================================================

/** Widening warnings already emitted, so repeated construction of the same
 *  circuit reports once rather than once per instantiation. */
const reportedWideningWarnings = new Set<string>();

function formatPath(p: PortPath): string {
  return p.nodeId === '' ? p.portName : `${p.nodeId}.${p.portName}`;
}

/**
 * Resolves a port reference to its declared type, or undefined when the node or
 * port does not exist. Pure — `validatePortRef` wraps it to report the misses.
 */
function resolvePortRef(
  ref: PortPath,
  inputs: Map<string, PortType>,
  outputs: Map<string, PortType>,
  nodes: Record<string, BuiltCircuit>,
): PortType | undefined {
  if (ref.nodeId === '') {
    return inputs.get(ref.portName) ?? outputs.get(ref.portName);
  }
  const comp = nodes[ref.nodeId];
  if (!comp) return undefined;
  return (
    comp.circuit.inputs.find((p) => p.name === ref.portName) ??
    comp.circuit.outputs.find((p) => p.name === ref.portName)
  )?.portType;
}

/** Reports a port reference that names no port. Returns whether it exists. */
function validatePortRef(
  ref: PortPath,
  inputs: Map<string, PortType>,
  outputs: Map<string, PortType>,
  nodes: Record<string, BuiltCircuit>,
  errors: string[],
): boolean {
  if (ref.nodeId === '') {
    if (!inputs.has(ref.portName) && !outputs.has(ref.portName)) {
      errors.push(`Circuit port '${ref.portName}' does not exist`);
      return false;
    }
    return true;
  }
  const comp = nodes[ref.nodeId];
  if (!comp) {
    errors.push(`Node '${ref.nodeId}' does not exist`);
    return false;
  }
  if (resolvePortRef(ref, inputs, outputs, nodes) === undefined) {
    errors.push(
      `Port '${ref.portName}' does not exist on node '${ref.nodeId}' (${comp.circuit.name})`,
    );
    return false;
  }
  return true;
}

/**
 * Which way a port can be used, seen from inside the circuit: its own inputs
 * drive and its own outputs are driven, and a node's ports are the other way
 * round. A node port listed as both is accepted either way.
 */
function portSides(
  ref: PortPath,
  inputs: Map<string, PortType>,
  nodes: Record<string, BuiltCircuit>,
): { drives: boolean; driven: boolean } {
  if (ref.nodeId === '') {
    const isInput = inputs.has(ref.portName);
    return { drives: isInput, driven: !isInput };
  }
  const { circuit } = nodes[ref.nodeId];
  return {
    drives: circuit.outputs.some((p) => p.name === ref.portName),
    driven: circuit.inputs.some((p) => p.name === ref.portName),
  };
}

/** e.g. "circuit output `q`" or "input `a` of node 'n' (Not)", for errors. */
function portLabel(ref: PortPath, isInput: boolean, nodes: Record<string, BuiltCircuit>): string {
  const side = isInput ? 'input' : 'output';
  if (ref.nodeId === '') return `circuit ${side} \`${ref.portName}\``;
  return `${side} \`${ref.portName}\` of node '${ref.nodeId}' (${nodes[ref.nodeId].circuit.name})`;
}

/**
 * Rejects a connection that runs the wrong way. The types stop
 * `outputs.q.to(...)` and `x.to(n.out)`, but the editor runs type-stripped
 * code, so without this the IR got a reversed connection and no error (#428).
 * Both ends must already exist.
 */
function checkDirection(
  source: PortPath,
  target: PortPath,
  inputs: Map<string, PortType>,
  nodes: Record<string, BuiltCircuit>,
  errors: string[],
): void {
  const from = portSides(source, inputs, nodes);
  const to = portSides(target, inputs, nodes);
  if (from.drives && to.driven) return;
  // A source that cannot drive is a circuit output or a node input; a target
  // that cannot be driven is a circuit input or a node output.
  const problems: string[] = [];
  if (!from.drives) {
    const label = portLabel(source, source.nodeId !== '', nodes);
    problems.push(`${label} can only be driven, so it cannot call \`.to\``);
  }
  if (!to.driven) {
    const label = portLabel(target, target.nodeId === '', nodes);
    problems.push(`${label} is a driver, so it cannot be a \`.to\` target`);
  }
  errors.push(
    `Connection ${formatPath(source)} -> ${formatPath(target)} runs the wrong way: ` +
      `${problems.join('; ')}. Call \`.to\` on the driving port and pass the ports it drives.`,
  );
}

/** Whether two IRs under one name can share a library entry. */
function sameStructure(a: Circuit, b: Circuit): boolean {
  if (a === b) return true;
  if (a.implementation.kind !== 'composite' && b.implementation.kind !== 'composite') return true;
  return structureKey(a) === structureKey(b);
}

/** Memoised per IR object: composites are compared often and rebuilt rarely. */
const structureKeys = new WeakMap<Circuit, string>();

/** The parts of a composite's IR that flattening reads: its ports, nodes and wiring. */
function structureKey(ir: Circuit): string {
  let key = structureKeys.get(ir);
  if (key === undefined) {
    key = JSON.stringify([
      ir.implementation.kind,
      ir.inputs.map((p) => [p.name, p.portType]),
      ir.outputs.map((p) => [p.name, p.portType]),
      ir.nodes.map((n) => [n.id, n.componentRef, n.arguments]),
      ir.connections.map((c) => [c.source, c.target]),
    ]);
    structureKeys.set(ir, key);
  }
  return key;
}

function detectSequential(nodes: Record<string, BuiltCircuit>, state?: StateShape | null): boolean {
  if (state != null) return true;
  for (const comp of Object.values(nodes)) {
    if (comp.circuit.clocks.length > 0 || comp.circuit.state.length > 0) return true;
  }
  return false;
}

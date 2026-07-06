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
  Circuit,
  PortDescriptor,
  PortType,
  Node,
  Connection,
  ClockDescriptor,
  StateBlock,
  Implementation,
  CircuitMetadata,
  CircuitTiming,
  ArgumentValue,
} from '../types/circuit.js';
import { normalizePortType, isRegState, isMemState } from './bit-bus.js';
import { registerCircuitEval } from './eval-registry.js';
import type {
  PortMap,
  ConnectionDef,
  ConnectArg,
  SourcePortRef,
  SinkPortRef,
  NormalizePorts,
  StateShape,
  BuiltCircuit,
  CircuitConfig,
} from './types.js';

// ============================================================================
// Port reference creation (for connect callbacks)
// ============================================================================

// IMPORTANT runtime/type asymmetry: every port object carries `.to` at
// runtime, including the ones the type system presents as SinkPortRef
// (via ConnectArg's mapped types). A `(sink as any).to(…)` would silently
// produce an inverted connection. Don't add such casts; runtime direction
// validation is deliberately deferred — the type system catches it at edit
// time, which is the whole point of #110.
function createPortRef(nodeId: string, portName: string, portType: PortType): SourcePortRef {
  return {
    _path: { nodeId, portName },
    _type: portType,
    to(...targets: SinkPortRef[]): ConnectionDef {
      return {
        source: { nodeId, portName },
        targets: targets.map((t) => ({ nodeId: t._path.nodeId, portName: t._path.portName })),
        portType,
      };
    },
  } as SourcePortRef;
}

function createNodeProxy(
  nodeId: string,
  ports: Map<string, PortType>,
  componentName?: string,
): Record<string, SourcePortRef> {
  const refs: Record<string, SourcePortRef> = {};
  for (const [name, type] of ports) {
    refs[name] = createPortRef(nodeId, name, type);
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
export function circuit<
  Opts extends Record<string, ArgumentValue>,
  Ins extends Record<string, PortType | number>,
  Outs extends Record<string, PortType | number>,
  Nodes extends Record<string, BuiltCircuit>,
  S extends StateShape,
>(
  name: string,
  factory: (opts?: Opts) => CircuitConfig<Ins, Outs, Nodes, S>,
): (opts?: Opts) => BuiltCircuit<NormalizePorts<Ins>, NormalizePorts<Outs>, Nodes>;
export function circuit<
  Ins extends Record<string, PortType | number>,
  Outs extends Record<string, PortType | number>,
  Nodes extends Record<string, BuiltCircuit>,
  S extends StateShape,
>(
  name: string,
  config?: CircuitConfig<Ins, Outs, Nodes, S>,
): BuiltCircuit<NormalizePorts<Ins>, NormalizePorts<Outs>, Nodes>;
export function circuit(name: string, configOrFactory: any = {} as any): any {
  // Runtime guard: typescript would catch `circuit(SomeObject, {...})` at
  // typecheck time, but in the in-browser editor user code is type-stripped
  // and run via new Function() — types are gone by the time it executes, so
  // a misspelled / mis-pasted import like `circuit(React, {...})` just
  // accepts the object and stashes it as the circuit's name. That object
  // then percolates through to UI render paths that expect a string, where
  // React eventually throws a cryptic "Objects are not valid as a React
  // child" error with no hint that the actual problem is in the user's
  // circuit() call. Catch it at the call site with a useful message.
  if (typeof name !== 'string') {
    const got = name === null ? 'null' : Array.isArray(name) ? 'array' : typeof name;
    throw new Error(
      `circuit() expects a string name as the first argument, got ${got}. ` +
        `Usage: circuit('MyCircuit', { inputs, outputs, nodes, connect }). ` +
        `(A common cause is a stray import / variable being passed by mistake, ` +
        `e.g. circuit(React, {...}) — the first argument must be a literal string name.)`,
    );
  }

  // Factory form: return a callable that builds a per-instance BuiltCircuit
  // with `_args` attached. The factory closes over the original `name`, so
  // every specialized instance shares the same component name (and registry
  // entry) — shape can differ per call (e.g. port widths), but the eval/
  // onTick logic is parameter-agnostic and registers equivalently each time.
  if (typeof configOrFactory === 'function') {
    const factory = configOrFactory as (opts?: Record<string, ArgumentValue>) => CircuitConfig;
    return (opts?: Record<string, ArgumentValue>) => {
      const innerConfig = factory(opts);
      const built = circuit(name, innerConfig as any) as any;
      built._args = opts ?? {};
      // Strip per-instance state initials baked in by ES6-shorthand
      // declarations like `state: { value }`. Dep-merging in this same
      // function picks the FIRST node's BuiltCircuit as the canonical
      // library entry; if state initials varied per instance, every
      // instance without an explicit args override would inherit whichever
      // value happened to come first. Per-instance values flow through
      // `node.arguments[block.name]` and are applied by sequential-init.ts;
      // here we normalize the IR's state initials to type defaults.
      for (const sb of built.circuit.state) {
        if (sb.stateType.kind === 'bit') {
          sb.initialValue = false;
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
      return built;
    };
  }
  const config = configOrFactory as CircuitConfig;
  // ── Normalize inputs/outputs ──

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

  const nodes = config.nodes ?? {};

  // ── Validate ──

  const errors: string[] = [];

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
  for (const nodeName of Object.keys(nodes)) {
    if (nodeName === 'inputs' || nodeName === 'outputs' || nodeName === 'nodes') {
      errors.push(`Node name '${nodeName}' is reserved`);
    }
  }

  // onTick without state
  if (config.onTick && !config.state) {
    errors.push('.onTick() requires state to be defined');
  }

  // ── Resolve connections ──

  let connectionDefs: ConnectionDef[] = [];
  if (config.connect) {
    const nodeRefs: Record<string, Record<string, SourcePortRef>> = {};
    for (const [nodeName, comp] of Object.entries(nodes) as [string, BuiltCircuit][]) {
      const allPorts = new Map<string, PortType>();
      for (const pd of comp.circuit.inputs) allPorts.set(pd.name, pd.portType);
      for (const pd of comp.circuit.outputs) allPorts.set(pd.name, pd.portType);
      nodeRefs[nodeName] = createNodeProxy(nodeName, allPorts, comp.circuit.name);
    }

    const arg = {
      inputs: createNodeProxy('', inputs),
      outputs: createNodeProxy('', outputs),
      nodes: nodeRefs,
    };

    try {
      connectionDefs = config.connect(arg as unknown as ConnectArg<any, any, any>);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // Validate connection port references
  for (const conn of connectionDefs) {
    validatePortRef(conn.source, inputs, outputs, nodes, errors);
    for (const target of conn.targets) {
      validatePortRef(target, inputs, outputs, nodes, errors);
    }
  }

  // Multi-driver detection. Every driver of every node-port pair is declared
  // inside one circuit's connect callback — flattening never introduces a new
  // driver — so per-circuit scanning is complete. (If parameterized
  // instantiation lands, this check would need to re-run post-substitution.)
  //
  // Identical (target, source) triples → silently dedupe.
  // Same target with different source → multi-driver error.
  const formatPath = (p: { nodeId: string; portName: string }) =>
    p.nodeId === '' ? p.portName : `${p.nodeId}.${p.portName}`;
  const seenByTarget = new Map<string, { nodeId: string; portName: string }>();
  const conflictsByTarget = new Map<string, Set<string>>();
  const dedupedDefs: ConnectionDef[] = [];
  for (const def of connectionDefs) {
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
        continue; // drop conflicting target; error pushed below
      }
      seenByTarget.set(targetKey, { nodeId: def.source.nodeId, portName: def.source.portName });
      newTargets.push(target);
    }
    if (newTargets.length > 0) {
      dedupedDefs.push({ ...def, targets: newTargets });
    }
  }
  connectionDefs = dedupedDefs;

  // Sort conflict keys for deterministic error ordering across runs.
  const sortedConflictKeys = [...conflictsByTarget.keys()].sort();
  for (const key of sortedConflictKeys) {
    const sources = [...conflictsByTarget.get(key)!].join(', ');
    errors.push(`${key} has multiple drivers: ${sources}`);
  }

  // ── Validate read/write config ──

  if (errors.length > 0) {
    throw new Error(`Circuit '${name}' validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  // ── Determine implementation kind ──

  const hasEval = config.eval != null;
  const hasNodes = Object.keys(nodes).length > 0;
  let implementation: Implementation;
  let timing: CircuitTiming;

  if (hasEval && !hasNodes) {
    implementation = { kind: 'primitive' };
    timing = config.state != null ? 'sequential' : 'combinational';
  } else if (hasNodes) {
    implementation = { kind: 'composite' };
    timing = detectSequential(nodes, config.state) ? 'sequential' : 'combinational';
  } else {
    implementation = { kind: 'primitive' };
    timing = 'combinational';
  }

  // ── Build port descriptors ──

  const inputDescs: PortDescriptor[] = Array.from(inputs, ([n, t]) => ({ name: n, portType: t }));
  const outputDescs: PortDescriptor[] = Array.from(outputs, ([n, t]) => ({ name: n, portType: t }));

  // ── Build clocks ──

  const clocks: ClockDescriptor[] = [];
  if (config.state != null || config.onTick != null) {
    clocks.push({ name: 'clk' });
  }

  // ── Build state blocks ──

  const stateBlocks: StateBlock[] = [];
  if (config.state != null) {
    for (const [key, value] of Object.entries(config.state)) {
      if (isMemState(value)) {
        // Declarative memory: mem(depth, width)
        const addrWidth = Math.ceil(Math.log2(value.depth)) || 1;
        stateBlocks.push({
          id: `${name}-${key}`,
          name: key,
          stateType: { kind: 'memory', addressWidth: addrWidth, dataWidth: value.width },
          initialValue: {
            data: new Map(value.initial),
            addressWidth: addrWidth,
            dataWidth: value.width,
          },
          clockRef: 'clk',
          edge: 'rising',
        });
      } else if (isRegState(value)) {
        // Declarative register: reg(width)
        stateBlocks.push({
          id: `${name}-${key}`,
          name: key,
          stateType: value.width === 1 ? { kind: 'bit' } : { kind: 'bus', width: value.width },
          initialValue: value.initial,
          clockRef: 'clk',
          edge: 'rising',
        });
      } else if (value instanceof Map) {
        // Legacy: Map<number, number> → { kind: 'memory' }
        stateBlocks.push({
          id: `${name}-${key}`,
          name: key,
          stateType: { kind: 'memory', addressWidth: 16, dataWidth: 8 },
          initialValue: { data: new Map(value), addressWidth: 16, dataWidth: 8 },
          clockRef: 'clk',
          edge: 'rising',
        });
      } else if (typeof value === 'boolean') {
        // Bit state
        stateBlocks.push({
          id: `${name}-${key}`,
          name: key,
          stateType: { kind: 'bit' },
          initialValue: value,
          clockRef: 'clk',
          edge: 'rising',
        });
      } else {
        // Bus state (number)
        stateBlocks.push({
          id: `${name}-${key}`,
          name: key,
          stateType: { kind: 'bus', width: 32 },
          initialValue: value,
          clockRef: 'clk',
          edge: 'rising',
        });
      }
    }
  }

  // ── Build nodes ──

  const irNodes: Node[] = [];
  for (const [nodeId, comp] of Object.entries(nodes) as [string, BuiltCircuit][]) {
    const args = comp._args ?? {};
    irNodes.push({
      id: nodeId,
      componentRef: comp.circuit.name,
      arguments: args,
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

  // ── Build connections ──

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

  // ── Build metadata (omit undefined keys for cleaner introspection) ──

  const metadata: CircuitMetadata = { timing };
  const meta = config.meta;
  if (meta) {
    if (meta.description !== undefined) metadata.description = meta.description;
    if (meta.category !== undefined) metadata.category = meta.category;
    if (meta.icon !== undefined) metadata.icon = meta.icon;
    if (meta.tags !== undefined) metadata.tags = meta.tags;
    if (meta.author !== undefined) metadata.author = meta.author;
    if (meta.version !== undefined) metadata.version = meta.version;
    if (meta.synthesizable !== undefined) metadata.synthesizable = meta.synthesizable;
    // Needed for time-travel to restore Switch/Button/Input values alongside
    // engine state — captureEnvironmentalState reads this to know which
    // node.arguments key to snapshot. Omitting silently broke rewind.
    if (meta.interactiveArg !== undefined) metadata.interactiveArg = meta.interactiveArg;
  }

  const circuitIR: Circuit = {
    version: 1,
    name,
    inputs: inputDescs,
    outputs: outputDescs,
    clocks,
    state: stateBlocks,
    nodes: irNodes,
    connections,
    implementation,
    metadata,
  };

  // ── Build shape ──

  const inputMap: PortMap = {};
  for (const [n, t] of inputs) inputMap[n] = t;
  const outputMap: PortMap = {};
  for (const [n, t] of outputs) outputMap[n] = t;

  // ── Collect dependencies (for direct BuiltCircuit → simulator path) ──

  const deps = new Map<string, BuiltCircuit>();
  for (const [, comp] of Object.entries(nodes) as [string, BuiltCircuit][]) {
    if (!deps.has(comp.circuit.name)) {
      deps.set(comp.circuit.name, comp);
    }
    // Merge transitive dependencies
    if (comp._dependencies) {
      for (const [depName, depComp] of comp._dependencies) {
        if (!deps.has(depName)) deps.set(depName, depComp);
      }
    }
  }

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
    _dependencies: deps,
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

  // Register eval/onTick in the shared registry at definition time.
  // Every primitive defined via circuit() gets an entry — display-only
  // primitives like HexDisplay/Screen have no `eval` of their own (no
  // computation, no outputs) but still need a registered no-op so the
  // simulator's eval-bridge can dispatch through them instead of falling
  // into evaluateNodeFallback and throwing "no registered evaluator".
  const stateKeys = config.state ? Object.keys(config.state) : undefined;
  registerCircuitEval(name, {
    inputNames: circuitIR.inputs.map((p) => p.name),
    outputNames: circuitIR.outputs.map((p) => p.name),
    evalFn: (config.eval ?? (() => ({}))) as (inputs: Record<string, any>) => Record<string, any>,
    stateKeys,
    onTickFn: config.onTick as ((inputs: Record<string, any>) => Record<string, any>) | undefined,
  });

  return built;
}

// ============================================================================
// Helpers
// ============================================================================

function validatePortRef(
  ref: { nodeId: string; portName: string },
  inputs: Map<string, PortType>,
  outputs: Map<string, PortType>,
  nodes: Record<string, BuiltCircuit>,
  errors: string[],
): void {
  if (ref.nodeId === '') {
    if (!inputs.has(ref.portName) && !outputs.has(ref.portName)) {
      errors.push(`Circuit port '${ref.portName}' does not exist`);
    }
  } else {
    const comp = nodes[ref.nodeId];
    if (!comp) {
      errors.push(`Node '${ref.nodeId}' does not exist`);
      return;
    }
    const hasPort =
      comp.circuit.inputs.some((p) => p.name === ref.portName) ||
      comp.circuit.outputs.some((p) => p.name === ref.portName);
    if (!hasPort) {
      errors.push(
        `Port '${ref.portName}' does not exist on node '${ref.nodeId}' (${comp.circuit.name})`,
      );
    }
  }
}

function detectSequential(nodes: Record<string, BuiltCircuit>, state?: StateShape | null): boolean {
  if (state != null) return true;
  for (const comp of Object.values(nodes)) {
    if (comp.circuit.clocks.length > 0 || comp.circuit.state.length > 0) return true;
  }
  return false;
}

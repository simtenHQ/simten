/**
 * Component Builder
 *
 * The core `component()` function that creates hardware components.
 * Supports chained and object-style syntax, producing Circuit IR.
 *
 * Usage:
 *   // Chained (small circuits)
 *   const HalfAdder = component('HalfAdder')
 *     .in('a', bit).in('b', bit)
 *     .out('sum', bit).out('carry', bit)
 *     .node('x', Xor).node('a', And)
 *     .connect(({ in, out, x, a }) => [...])
 *
 *   // Object style (large circuits)
 *   const CPU = component('CPU', { in: {...}, out: {...}, nodes: {...}, connect: ... })
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
  ComponentKind,
} from '../types/circuit.js';
import { normalizePortType } from './bit-bus.js';
import type {
  PortMap,
  NodesMap,
  ComponentShape,
  ConnectFn,
  ConnectionDef,
  PortRef,
  StateShape,
  ComponentMeta,
  BuiltComponent,
  EvalFn,
  OnTickFn,
} from './types.js';

// ============================================================================
// Internal builder state (mutable during construction, frozen on build)
// ============================================================================

interface BuilderState {
  name: string;
  inputs: Map<string, PortType>;
  outputs: Map<string, PortType>;
  nodes: Map<string, BuiltComponent>;
  nodeArgs: Map<string, Record<string, import('../types/circuit.js').ArgumentValue>>;
  connections: ConnectionDef[];
  evalFn: ((inputs: Record<string, number>) => Record<string, number>) | null;
  state: StateShape | null;
  onTickFn: ((inputsAndState: Record<string, unknown>) => StateShape) | null;
  implFn: ((c: ComponentBuilder<any, any, any, any>) => ComponentBuilder<any, any, any, any>) | null;
  meta: ComponentMeta;
  /** Errors collected during building (before .build() validation) */
  _errors: string[];
}

// ============================================================================
// Port reference creation (for connect callbacks)
// ============================================================================

function createPortRef(nodeId: string, portName: string, portType: PortType): PortRef {
  return {
    _path: { nodeId, portName },
    _type: portType,
    to(...targets: PortRef[]): ConnectionDef {
      return {
        source: { nodeId, portName },
        targets: targets.map(t => ({ nodeId: t._path.nodeId, portName: t._path.portName })),
        portType,
      };
    },
  };
}

/** Create a proxy that exposes port names as PortRef properties */
function createNodeProxy(nodeId: string, ports: Map<string, PortType>, componentName?: string): Record<string, PortRef> {
  const refs: Record<string, PortRef> = {};
  for (const [name, type] of ports) {
    refs[name] = createPortRef(nodeId, name, type);
  }
  // Return a Proxy that throws a clear error for nonexistent ports
  return new Proxy(refs, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      // Allow internal properties
      if (typeof prop === 'symbol' || prop.startsWith('_')) return undefined;
      const label = nodeId === '' ? 'circuit' : `node '${nodeId}'${componentName ? ` (${componentName})` : ''}`;
      const available = Object.keys(target).join(', ');
      throw new Error(
        `Port '${prop}' does not exist on ${label}. Available ports: ${available || 'none'}`
      );
    },
  });
}

// ============================================================================
// Builder class
// ============================================================================

class ComponentBuilder<
  Ins extends PortMap = {},
  Outs extends PortMap = {},
  Nodes extends NodesMap = {},
  State extends StateShape | never = never,
> {
  private readonly s: BuilderState;

  constructor(name: string, state?: BuilderState) {
    this.s = state ?? {
      name,
      inputs: new Map(),
      outputs: new Map(),
      nodes: new Map(),
      nodeArgs: new Map(),
      connections: [],
      evalFn: null,
      state: null,
      onTickFn: null,
      implFn: null,
      meta: {},
      _errors: [],
    };
  }

  // --------------------------------------------------------------------------
  // Port declarations
  // --------------------------------------------------------------------------

  in<N extends string, T extends PortType | number>(
    name: N,
    type: T,
  ): ComponentBuilder<
    Ins & Record<N, T extends number ? (T extends 1 ? import('../types/circuit.js').BitType : import('../types/circuit.js').BusType) : T extends PortType ? T : never>,
    Outs,
    Nodes,
    State
  > {
    if (this.s.inputs.has(name)) {
      this.s._errors.push(`Duplicate input port name: '${name}'`);
    }
    const normalized = normalizePortType(type as PortType | number);
    this.s.inputs.set(name, normalized);
    return this as any;
  }

  out<N extends string, T extends PortType | number>(
    name: N,
    type: T,
  ): ComponentBuilder<
    Ins,
    Outs & Record<N, T extends number ? (T extends 1 ? import('../types/circuit.js').BitType : import('../types/circuit.js').BusType) : T extends PortType ? T : never>,
    Nodes,
    State
  > {
    if (this.s.outputs.has(name)) {
      this.s._errors.push(`Duplicate output port name: '${name}'`);
    }
    const normalized = normalizePortType(type as PortType | number);
    this.s.outputs.set(name, normalized);
    return this as any;
  }

  // --------------------------------------------------------------------------
  // Node declarations
  // --------------------------------------------------------------------------

  node<N extends string, C extends BuiltComponent>(
    name: N,
    comp: C | ComponentBuilder<any, any, any, any>,
    args?: Record<string, import('../types/circuit.js').ArgumentValue>,
  ): ComponentBuilder<
    Ins,
    Outs,
    Nodes & Record<N, ShapeOf<C>>,
    State
  > {
    // Auto-build if a builder is passed instead of a BuiltComponent
    const built = comp instanceof ComponentBuilder ? comp.build() : comp;
    this.s.nodes.set(name, built);
    if (args) {
      this.s.nodeArgs.set(name, args);
    }
    return this as any;
  }

  // --------------------------------------------------------------------------
  // Connections
  // --------------------------------------------------------------------------

  connect(fn: ConnectFn<Ins, Outs, Nodes>): ComponentBuilder<Ins, Outs, Nodes, State> {
    // Build the proxy argument for the callback
    const arg: Record<string, Record<string, PortRef>> = {};

    // Circuit-level inputs: when used in connect, they act as sources
    arg['in'] = createNodeProxy('', this.s.inputs);

    // Circuit-level outputs: when used in connect, they act as targets
    arg['out'] = createNodeProxy('', this.s.outputs);

    // Nodes: expose all ports (inputs as targets, outputs as sources)
    for (const [nodeName, comp] of this.s.nodes) {
      const allPorts = new Map<string, PortType>();
      for (const pd of comp.circuit.inputs) {
        allPorts.set(pd.name, pd.portType);
      }
      for (const pd of comp.circuit.outputs) {
        allPorts.set(pd.name, pd.portType);
      }
      arg[nodeName] = createNodeProxy(nodeName, allPorts, comp.name);
    }

    const connections = (fn as any)(arg);
    this.s.connections.push(...connections);
    return this as any;
  }

  // --------------------------------------------------------------------------
  // Eval (leaf behavior)
  // --------------------------------------------------------------------------

  eval(fn: [State] extends [never]
    ? (inputs: Record<string, number>) => Record<string, number>
    : (inputsAndState: Record<string, unknown>) => Record<string, number>
  ): ComponentBuilder<Ins, Outs, Nodes, State> {
    this.s.evalFn = fn as any;
    return this as any;
  }

  // --------------------------------------------------------------------------
  // Sequential state
  // --------------------------------------------------------------------------

  state<S extends StateShape>(
    initial: S,
  ): ComponentBuilder<Ins, Outs, Nodes, S> {
    this.s.state = initial;
    return this as any;
  }

  onTick(fn: (inputsAndState: Record<string, unknown>) => StateShape): ComponentBuilder<Ins, Outs, Nodes, State> {
    this.s.onTickFn = fn as any;
    return this as any;
  }

  // --------------------------------------------------------------------------
  // Structural implementation (for dual-mode: fast eval + structural export)
  // --------------------------------------------------------------------------

  impl(
    fn: (c: ComponentBuilder<Ins, Outs, {}, never>) => ComponentBuilder<any, any, any, any>,
  ): ComponentBuilder<Ins, Outs, Nodes, State> {
    this.s.implFn = fn;
    return this as any;
  }

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  meta(meta: ComponentMeta): ComponentBuilder<Ins, Outs, Nodes, State> {
    Object.assign(this.s.meta, meta);
    return this as any;
  }

  // --------------------------------------------------------------------------
  // Build → Circuit IR
  // --------------------------------------------------------------------------

  build(): BuiltComponent<Ins, Outs> {
    const s = this.s;

    // Validate
    validate(s);

    // Determine implementation kind
    const hasEval = s.evalFn !== null;
    const hasNodes = s.nodes.size > 0;
    let implementation: Implementation;
    let kind: ComponentKind;

    if (hasEval && !hasNodes) {
      implementation = { kind: 'primitive' };
      kind = s.state !== null ? 'sequential' : 'combinational';
    } else if (hasNodes) {
      implementation = { kind: 'composite' };
      kind = detectSequential(s) ? 'sequential' : 'combinational';
    } else {
      // No eval, no nodes — source component (Switch, Button, etc.)
      implementation = { kind: 'primitive' };
      kind = 'combinational';
    }

    // Build port descriptors
    const inputs: PortDescriptor[] = [];
    for (const [name, portType] of s.inputs) {
      inputs.push({ name, portType });
    }

    const outputs: PortDescriptor[] = [];
    for (const [name, portType] of s.outputs) {
      outputs.push({ name, portType });
    }

    // Build clock descriptors
    const clocks: ClockDescriptor[] = [];
    if (s.state !== null || s.onTickFn !== null) {
      clocks.push({ name: 'clk' });
    }

    // Build state blocks
    const stateBlocks: StateBlock[] = [];
    if (s.state !== null) {
      // For simple state, create a single state block
      const initialValue = s.state;
      const firstKey = Object.keys(initialValue)[0];
      const firstValue = firstKey ? initialValue[firstKey] : 0;

      if (typeof firstValue === 'boolean') {
        stateBlocks.push({
          id: `${s.name}-state`,
          name: 'value',
          stateType: { kind: 'bit' },
          initialValue: firstValue,
          clockRef: 'clk',
          edge: 'rising',
        });
      } else if (typeof firstValue === 'number') {
        stateBlocks.push({
          id: `${s.name}-state`,
          name: 'value',
          stateType: { kind: 'bus', width: 32 },
          initialValue: firstValue,
          clockRef: 'clk',
          edge: 'rising',
        });
      } else {
        // Complex state (object) — store as-is
        stateBlocks.push({
          id: `${s.name}-state`,
          name: 'value',
          stateType: { kind: 'bus', width: 32 },
          initialValue: 0,
          clockRef: 'clk',
          edge: 'rising',
        });
      }
    }

    // Build nodes
    const nodes: Node[] = [];
    for (const [nodeId, comp] of s.nodes) {
      const nodeArguments = s.nodeArgs.get(nodeId) ?? {};
      nodes.push({
        id: nodeId,
        componentRef: comp.name,
        arguments: nodeArguments,
        inputs: comp.circuit.inputs.map(p => ({
          id: `${nodeId}.${p.name}`,
          name: p.name,
          portType: p.portType,
        })),
        outputs: comp.circuit.outputs.map(p => ({
          id: `${nodeId}.${p.name}`,
          name: p.name,
          portType: p.portType,
        })),
        clocks: comp.circuit.clocks.map(c => ({
          id: `${nodeId}.${c.name}`,
          name: c.name,
        })),
      });
    }

    // Build connections
    const connections: Connection[] = [];
    let connIdx = 0;
    for (const def of s.connections) {
      for (const target of def.targets) {
        connections.push({
          id: `conn_${connIdx++}`,
          source: {
            nodeId: def.source.nodeId,
            portName: def.source.portName,
          },
          target: {
            nodeId: target.nodeId,
            portName: target.portName,
          },
          portType: def.portType,
        });
      }
    }

    // Build metadata
    const metadata: CircuitMetadata = {
      kind,
      description: s.meta.description,
      tags: s.meta.tags,
      author: s.meta.author,
      version: s.meta.version,
    };

    const circuit: Circuit = {
      id: `component:${s.name}`,
      name: s.name,
      parameters: [],
      inputs,
      outputs,
      clocks,
      state: stateBlocks,
      nodes,
      connections,
      implementation,
      metadata,
    };

    const built: BuiltComponent<Ins, Outs> = {
      circuit,
      _shape: {
        inputs: Object.fromEntries(s.inputs) as Ins,
        outputs: Object.fromEntries(s.outputs) as Outs,
      },
      name: s.name,
    };

    // Attach eval/onTick functions for the simulator bridge to pick up
    if (s.evalFn) {
      (built as any)._evalFn = s.evalFn;
    }
    if (s.onTickFn) {
      (built as any)._onTickFn = s.onTickFn;
    }
    if (s.state) {
      (built as any)._initialState = s.state;
    }
    if (s.meta.category) {
      (built as any)._category = s.meta.category;
    }
    if (s.meta.icon) {
      (built as any)._icon = s.meta.icon;
    }

    return built;
  }
}

// ============================================================================
// Type helper for extracting shape from BuiltComponent
// ============================================================================

type ShapeOf<C> = C extends BuiltComponent<infer I, infer O>
  ? { inputs: I; outputs: O }
  : ComponentShape;

// ============================================================================
// Validation
// ============================================================================

function validate(s: BuilderState): void {
  // Start with any errors collected during building
  const errors: string[] = [...s._errors];

  // Check for duplicate input/output names
  const inputNames = new Set<string>(s.inputs.keys());

  const outputNames = new Set<string>();
  for (const [name] of s.outputs) {
    if (outputNames.has(name)) {
      errors.push(`Duplicate output port name: '${name}'`);
    }
    if (inputNames.has(name)) {
      errors.push(`Port name '${name}' used for both input and output`);
    }
    outputNames.add(name);
  }

  // Check state names don't collide with port names
  if (s.state) {
    for (const key of Object.keys(s.state)) {
      if (inputNames.has(key)) {
        errors.push(`State name '${key}' collides with input port name`);
      }
      if (outputNames.has(key)) {
        errors.push(`State name '${key}' collides with output port name`);
      }
    }
  }

  // Check for duplicate node names
  const nodeNames = new Set<string>();
  for (const [name] of s.nodes) {
    if (nodeNames.has(name)) {
      errors.push(`Duplicate node name: '${name}'`);
    }
    if (name === 'in' || name === 'out') {
      errors.push(`Node name '${name}' is reserved`);
    }
    nodeNames.add(name);
  }

  // Validate connections: check port existence and width compatibility
  for (const conn of s.connections) {
    validatePortRef(s, conn.source, 'source', errors);
    for (const target of conn.targets) {
      validatePortRef(s, target, 'target', errors);
    }
  }

  // Check for onTick without state
  if (s.onTickFn && !s.state) {
    errors.push('.onTick() requires .state() to be defined first');
  }

  if (errors.length > 0) {
    throw new Error(
      `Component '${s.name}' validation failed:\n  - ${errors.join('\n  - ')}`
    );
  }
}

function validatePortRef(
  s: BuilderState,
  ref: { nodeId: string; portName: string },
  role: 'source' | 'target',
  errors: string[],
): void {
  if (ref.nodeId === '') {
    // Circuit-level port
    const isInput = s.inputs.has(ref.portName);
    const isOutput = s.outputs.has(ref.portName);
    if (!isInput && !isOutput) {
      errors.push(`Connection ${role}: circuit port '${ref.portName}' does not exist`);
    }
  } else {
    // Node port
    const comp = s.nodes.get(ref.nodeId);
    if (!comp) {
      errors.push(`Connection ${role}: node '${ref.nodeId}' does not exist`);
      return;
    }
    const hasInput = comp.circuit.inputs.some(p => p.name === ref.portName);
    const hasOutput = comp.circuit.outputs.some(p => p.name === ref.portName);
    if (!hasInput && !hasOutput) {
      errors.push(
        `Connection ${role}: port '${ref.portName}' does not exist on node '${ref.nodeId}' (${comp.name})`
      );
    }
  }
}

function detectSequential(s: BuilderState): boolean {
  if (s.state !== null) return true;
  for (const [, comp] of s.nodes) {
    if (comp.circuit.clocks.length > 0 || comp.circuit.state.length > 0) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// Public API: component()
// ============================================================================

/** Object-style component definition */
export interface ComponentConfig<
  Ins extends Record<string, PortType | number>,
  Outs extends Record<string, PortType | number>,
  N extends Record<string, BuiltComponent>,
> {
  in?: Ins;
  out?: Outs;
  nodes?: N;
  connect?: (arg: any) => ConnectionDef[];
  eval?: (inputs: any) => any;
  state?: StateShape;
  onTick?: (inputsAndState: any) => any;
  meta?: ComponentMeta;
}

/**
 * Create a hardware component.
 *
 * @param name - Component name (must be unique in its scope)
 * @param config - Optional object-style configuration for large circuits
 * @returns A builder (chained style) or a BuiltComponent (object style)
 */
export function component(name: string): ComponentBuilder;
export function component<
  Ins extends Record<string, PortType | number>,
  Outs extends Record<string, PortType | number>,
  N extends Record<string, BuiltComponent>,
>(name: string, config: ComponentConfig<Ins, Outs, N>): BuiltComponent;
export function component(name: string, config?: ComponentConfig<any, any, any>): any {
  if (!config) {
    // Chained style — return builder
    return new ComponentBuilder(name);
  }

  // Object style — build immediately
  let builder = new ComponentBuilder(name) as ComponentBuilder<any, any, any, any>;

  if (config.in) {
    for (const [portName, portType] of Object.entries(config.in)) {
      builder = builder.in(portName, portType as any) as any;
    }
  }

  if (config.out) {
    for (const [portName, portType] of Object.entries(config.out)) {
      builder = builder.out(portName, portType as any) as any;
    }
  }

  if (config.nodes) {
    for (const [nodeName, comp] of Object.entries(config.nodes)) {
      builder = builder.node(nodeName, comp as BuiltComponent) as any;
    }
  }

  if (config.state) {
    builder = builder.state(config.state) as any;
  }

  if (config.eval) {
    builder = builder.eval(config.eval as any) as any;
  }

  if (config.onTick) {
    builder = builder.onTick(config.onTick as any) as any;
  }

  if (config.connect) {
    builder = builder.connect(config.connect as any) as any;
  }

  if (config.meta) {
    builder = builder.meta(config.meta) as any;
  }

  return builder.build();
}

// Re-export for implicit build: calling .build() is optional in most contexts,
// but needed when passing to simulate() or .node(). The BuiltComponent type
// doubles as the component reference.
export { ComponentBuilder };

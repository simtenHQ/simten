/**
 * Component Definition — Object Syntax Only
 *
 * Creates hardware components using a single object configuration.
 * Produces Circuit IR compatible with the simulation pipeline.
 *
 * Usage:
 *   const HalfAdder = component('HalfAdder', {
 *     in: { a: bit, b: bit },
 *     out: { sum: bit, carry: bit },
 *     nodes: { x: Xor, a: And },
 *     connect: ({ in: inp, out, x, a }) => [
 *       inp.a.to(x.a, a.a),
 *       inp.b.to(x.b, a.b),
 *       x.out.to(out.sum),
 *       a.out.to(out.carry),
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
  ComponentKind,
  ArgumentValue,
} from '../types/circuit.js';
import { normalizePortType } from './bit-bus.js';
import type {
  PortMap,
  ConnectionDef,
  ConnectArg,
  PortRef,
  StateShape,
  ComponentMeta,
  BuiltComponent,
  ComponentConfig,
} from './types.js';

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

function createNodeProxy(nodeId: string, ports: Map<string, PortType>, componentName?: string): Record<string, PortRef> {
  const refs: Record<string, PortRef> = {};
  for (const [name, type] of ports) {
    refs[name] = createPortRef(nodeId, name, type);
  }
  return new Proxy(refs, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
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
// component() — single entry point
// ============================================================================

/**
 * Create a hardware component.
 *
 * @param name - Component name
 * @param config - Component configuration (generic — TypeScript infers port/node names)
 * @returns A BuiltComponent ready for simulation or use as a node
 */
/** Normalize port type at the type level: number → BusType, PortType → PortType */
type NormalizePort<T> = T extends number ? import('../types/circuit.js').BusType : T extends PortType ? T : PortType;
type NormalizePorts<M> = { [K in keyof M]: NormalizePort<M[K]> };

export function component<
  Ins extends Record<string, PortType | number>,
  Outs extends Record<string, PortType | number>,
  Nodes extends Record<string, BuiltComponent>,
  S extends StateShape,
>(name: string, config: ComponentConfig<Ins, Outs, Nodes, S> = {} as any): BuiltComponent<NormalizePorts<Ins>, NormalizePorts<Outs>> {
  // ── Normalize inputs/outputs ──

  const inputs = new Map<string, PortType>();
  if (config.in) {
    for (const [portName, portType] of Object.entries(config.in)) {
      inputs.set(portName, normalizePortType(portType as PortType | number));
    }
  }

  const outputs = new Map<string, PortType>();
  if (config.out) {
    for (const [portName, portType] of Object.entries(config.out)) {
      outputs.set(portName, normalizePortType(portType as PortType | number));
    }
  }

  const nodes = config.nodes ?? {};
  const nodeArgs = config.nodeArgs ?? {};

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

  // Reserved node names
  for (const nodeName of Object.keys(nodes)) {
    if (nodeName === 'in' || nodeName === 'out') {
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
    const arg: Record<string, Record<string, PortRef>> = {};

    arg['in'] = createNodeProxy('', inputs);
    arg['out'] = createNodeProxy('', outputs);

    for (const [nodeName, comp] of Object.entries(nodes) as [string, BuiltComponent][]) {
      const allPorts = new Map<string, PortType>();
      for (const pd of comp.circuit.inputs) allPorts.set(pd.name, pd.portType);
      for (const pd of comp.circuit.outputs) allPorts.set(pd.name, pd.portType);
      arg[nodeName] = createNodeProxy(nodeName, allPorts, comp.name);
    }

    try {
      connectionDefs = config.connect(arg as ConnectArg<Ins, Outs, Nodes>);
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

  if (errors.length > 0) {
    throw new Error(`Component '${name}' validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  // ── Determine implementation kind ──

  const hasEval = config.eval != null;
  const hasNodes = Object.keys(nodes).length > 0;
  let implementation: Implementation;
  let kind: ComponentKind;

  if (hasEval && !hasNodes) {
    implementation = { kind: 'primitive' };
    kind = config.state != null ? 'sequential' : 'combinational';
  } else if (hasNodes) {
    implementation = { kind: 'composite' };
    kind = detectSequential(nodes, config.state) ? 'sequential' : 'combinational';
  } else {
    implementation = { kind: 'primitive' };
    kind = 'combinational';
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
      if (value instanceof Map) {
        // Memory state: Map<number, number> → { kind: 'memory' }
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
  for (const [nodeId, comp] of Object.entries(nodes) as [string, BuiltComponent][]) {
    const args = (nodeArgs as Record<string, Record<string, ArgumentValue>>)[nodeId] ?? {};
    irNodes.push({
      id: nodeId,
      componentRef: comp.name,
      arguments: args,
      inputs: comp.circuit.inputs.map((p: PortDescriptor) => ({
        id: `${nodeId}.${p.name}`, name: p.name, portType: p.portType,
      })),
      outputs: comp.circuit.outputs.map((p: PortDescriptor) => ({
        id: `${nodeId}.${p.name}`, name: p.name, portType: p.portType,
      })),
      clocks: comp.circuit.clocks.map((c: ClockDescriptor) => ({
        id: `${nodeId}.${c.name}`, name: c.name,
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

  // ── Build metadata ──

  const metadata: CircuitMetadata = {
    kind,
    description: config.meta?.description,
    tags: config.meta?.tags,
    author: config.meta?.author,
    version: config.meta?.version,
  };

  const circuit: Circuit = {
    id: `component:${name}`,
    name,
    parameters: [],
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

  const built = {
    circuit,
    _shape: { inputs: inputMap as NormalizePorts<Ins>, outputs: outputMap as NormalizePorts<Outs> },
    name,
  } as BuiltComponent<NormalizePorts<Ins>, NormalizePorts<Outs>>;

  // Attach eval/onTick/state for the simulator bridge
  if (config.eval) (built as any)._evalFn = config.eval;
  if (config.onTick) (built as any)._onTickFn = config.onTick;
  if (config.state) (built as any)._initialState = config.state;
  if (config.meta?.category) (built as any)._category = config.meta.category;
  if (config.meta?.icon) (built as any)._icon = config.meta.icon;

  return built;
}

// ============================================================================
// Helpers
// ============================================================================

function validatePortRef(
  ref: { nodeId: string; portName: string },
  inputs: Map<string, PortType>,
  outputs: Map<string, PortType>,
  nodes: Record<string, BuiltComponent>,
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
    const hasPort = comp.circuit.inputs.some(p => p.name === ref.portName)
      || comp.circuit.outputs.some(p => p.name === ref.portName);
    if (!hasPort) {
      errors.push(`Port '${ref.portName}' does not exist on node '${ref.nodeId}' (${comp.name})`);
    }
  }
}

function detectSequential(nodes: Record<string, BuiltComponent>, state?: StateShape | null): boolean {
  if (state != null) return true;
  for (const comp of Object.values(nodes)) {
    if (comp.circuit.clocks.length > 0 || comp.circuit.state.length > 0) return true;
  }
  return false;
}

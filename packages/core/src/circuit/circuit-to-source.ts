/**
 * IR → TypeScript source serializer.
 *
 * Given a `BuiltCircuit`, emit a TypeScript string that the editor can compile
 * back into the same circuit (modulo comments and code outside `circuit()`
 * calls). Powers the Fork button on `<CircuitEmbed />`, where the embed has
 * a compiled `BuiltCircuit` but no original source.
 *
 * Supported:
 * - Composite circuits that compose stdlib components and other user circuits
 * - bit / bus(N) ports
 * - Per-node factory args inlined as `Comp({ ... })` calls
 * - Simple state (bit / bus / memory with default widths)
 *
 * NOT supported (throws with a clear message — Fork button surfaces it):
 * - Primitives with custom `eval` / `onTick` callbacks (would need eval-registry
 *   walking; defer to a follow-up if blog circuits ever need it)
 * - Intrinsic implementations
 *
 * Comments and any code outside `circuit()` calls are not preserved.
 */

import type {
  Circuit,
  Node,
  PortType,
  PortDescriptor,
  StateBlock,
  ArgumentValue,
} from '../types/circuit.js';
import type { BuiltCircuit } from './types.js';
import { STDLIB_CIRCUITS } from '../std/index.js';
import { getCircuitEval } from './eval-registry.js';

const STDLIB_NAMES: ReadonlySet<string> = new Set(STDLIB_CIRCUITS.map((c) => c.circuit.name));

export class CircuitToSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitToSourceError';
  }
}

/**
 * Serialize a `BuiltCircuit` (plus its transitive dependencies) to a TypeScript
 * source string.
 */
export function circuitToSource(built: BuiltCircuit): string {
  // Collect user-defined (non-stdlib) deps. Stdlib is pre-injected into the
  // editor sandbox, so we don't need to track or emit it.
  const userCircuits = new Map<string, Circuit>();
  for (const [name, dep] of built._dependencies) {
    if (!STDLIB_NAMES.has(name)) {
      userCircuits.set(name, dep.circuit);
    }
  }
  for (const node of built.circuit.nodes) {
    if (!STDLIB_NAMES.has(node.componentRef) && !userCircuits.has(node.componentRef)) {
      const dep = built._dependencies.get(node.componentRef);
      if (dep) userCircuits.set(node.componentRef, dep.circuit);
    }
  }

  // No imports emitted: the editor's sandbox pre-injects circuit/bit/bus, all
  // stdlib components, and stdlib helpers (per execute.ts:54-77). Emitting
  // `import` lines would also flip the file into ES-module scope, hiding
  // Monaco's ambient `declare function circuit()` declarations and turning
  // every typed circuit into `any` in the editor.
  const lines: string[] = [];

  // Emit user-defined dependencies in topological order (dep → dependents).
  const ordered = topoSort(userCircuits);
  for (const c of ordered) {
    lines.push(emitCircuit(c));
    lines.push('');
  }

  // Emit entry circuit. No `export` — the editor's sandbox evaluates source as
  // a script body via `new Function(...)`, which rejects ES module syntax.
  lines.push(emitCircuit(built.circuit));

  return lines.join('\n');
}

// ──────────────────────────────────────────────────────────────────────────
// Topological sort: a circuit's dependencies (other user circuits it uses
// in its `nodes`) must come before it.
// ──────────────────────────────────────────────────────────────────────────
function topoSort(circuits: Map<string, Circuit>): Circuit[] {
  const visited = new Set<string>();
  const result: Circuit[] = [];
  const visit = (name: string) => {
    if (visited.has(name)) return;
    visited.add(name);
    const c = circuits.get(name);
    if (!c) return;
    for (const node of c.nodes) {
      if (circuits.has(node.componentRef)) visit(node.componentRef);
    }
    result.push(c);
  };
  for (const name of circuits.keys()) visit(name);
  return result;
}

// ──────────────────────────────────────────────────────────────────────────
// Per-circuit emission
// ──────────────────────────────────────────────────────────────────────────
function emitCircuit(c: Circuit): string {
  if (c.implementation.kind === 'intrinsic') {
    throw new CircuitToSourceError(
      `Cannot serialize circuit '${c.name}': intrinsic implementations are not supported.`,
    );
  }
  if (c.implementation.kind === 'primitive') {
    // A primitive with a registered eval/onTick relies on a callback we can't
    // recover from the IR alone. (Bare primitives — pure port-shape declarations
    // with no eval — are fine to round-trip.)
    if (getCircuitEval(c.name)) {
      throw new CircuitToSourceError(
        `Cannot serialize circuit '${c.name}': primitives with eval/onTick callbacks aren't supported by the v1 fork serializer.`,
      );
    }
  }

  const parts: string[] = [];
  if (c.inputs.length > 0) parts.push(`  inputs: ${emitPortMap(c.inputs)},`);
  if (c.outputs.length > 0) parts.push(`  outputs: ${emitPortMap(c.outputs)},`);
  if (c.state.length > 0) parts.push(`  state: ${emitState(c.state, c.name)},`);
  if (c.nodes.length > 0) parts.push(`  nodes: ${emitNodes(c.nodes)},`);
  if (c.connections.length > 0) {
    parts.push(`  connect: ${emitConnect(c)},`);
  }

  return `const ${c.name} = circuit('${c.name}', {\n${parts.join('\n')}\n});`;
}

function emitPortMap(ports: PortDescriptor[]): string {
  const entries = ports.map((p) => `${p.name}: ${emitPortType(p.portType)}`);
  return `{ ${entries.join(', ')} }`;
}

function emitPortType(t: PortType): string {
  if (t.kind === 'bit') return 'bit';
  if (t.kind === 'bus') return `bus(${t.width})`;
  // Should be unreachable for port types.
  throw new CircuitToSourceError(`Unsupported port type kind: ${(t as { kind: string }).kind}`);
}

function emitState(state: StateBlock[], circuitName: string): string {
  const entries = state.map((s) => {
    if (s.stateType.kind === 'bit') {
      return `${s.name}: ${jsLiteral(s.initialValue as boolean | number)}`;
    }
    if (s.stateType.kind === 'bus') {
      const init = s.initialValue as number;
      return init === 0
        ? `${s.name}: reg(${s.stateType.width})`
        : `${s.name}: reg(${s.stateType.width}, ${init})`;
    }
    if (s.stateType.kind === 'memory') {
      const mem = s.initialValue as {
        data: Map<number, number>;
        addressWidth: number;
        dataWidth: number;
      };
      const depth = 1 << s.stateType.addressWidth;
      const initArg = mem.data.size > 0 ? `, ${emitInitMap(mem.data)}` : '';
      return `${s.name}: mem(${depth}, ${s.stateType.dataWidth}${initArg})`;
    }
    throw new CircuitToSourceError(
      `Cannot serialize state '${s.name}' on circuit '${circuitName}': unsupported state type.`,
    );
  });
  return `{ ${entries.join(', ')} }`;
}

function emitInitMap(data: Map<number, number>): string {
  const entries = [...data.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `[${k}, ${v}]`);
  return `new Map([${entries.join(', ')}])`;
}

// Soft callable convention: parameterized stdlib components must be called
// (factory invocation form). The serializer doesn't know which user-defined
// components are parameterized — for those, we emit the bare ref when args
// are empty and a call when args are present.
const PARAMETERIZED_STDLIB = new Set<string>([
  'Constant',
  'Switch',
  'Button',
  'Input',
  'Register',
  'DFlipFlop',
  'ROM',
  'RAM',
  'DualPortRAM',
  'DualPortROM',
  'BitSlice',
  'Adder',
  'Subtractor',
  'Comparator',
  'LeftShifter',
  'RightShifter',
  'BusAnd',
  'BusOr',
  'BusXor',
  'Mux',
  'Screen',
  'RasterDisplay',
]);

function emitNodes(nodes: Node[]): string {
  const entries = nodes.map((n) => {
    const hasArgs = n.arguments && Object.keys(n.arguments).length > 0;
    if (hasArgs) {
      return `${n.id}: ${n.componentRef}(${emitArgs(n.arguments)})`;
    }
    // Parameterized stdlib components must always be called, even when no
    // args were specified — bare refs would be a TS error.
    if (PARAMETERIZED_STDLIB.has(n.componentRef)) {
      return `${n.id}: ${n.componentRef}()`;
    }
    return `${n.id}: ${n.componentRef}`;
  });
  return `{ ${entries.join(', ')} }`;
}

function emitArgs(args: Record<string, ArgumentValue>): string {
  const entries = Object.entries(args).map(([k, v]) => `${k}: ${jsLiteral(v)}`);
  return `{ ${entries.join(', ')} }`;
}

function jsLiteral(v: ArgumentValue | boolean): string {
  if (v == null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  // Sparse object map like ROM init.
  const entries = Object.entries(v).map(([k, val]) => `${k}: ${val}`);
  return `{ ${entries.join(', ')} }`;
}

function emitConnect(c: Circuit): string {
  // Group connections by source port path so we can emit
  //   src.to(t1, t2, t3)
  // matching the canonical DSL form.
  const groups = new Map<
    string,
    {
      source: { nodeId: string; portName: string };
      targets: { nodeId: string; portName: string }[];
    }
  >();
  for (const conn of c.connections) {
    const key = `${conn.source.nodeId}|${conn.source.portName}`;
    const existing = groups.get(key);
    if (existing) {
      existing.targets.push(conn.target);
    } else {
      groups.set(key, { source: conn.source, targets: [conn.target] });
    }
  }

  const lines: string[] = [];
  for (const { source, targets } of groups.values()) {
    const src = portRef(source, 'source');
    const tgts = targets.map((t) => portRef(t, 'target')).join(', ');
    lines.push(`    ${src}.to(${tgts}),`);
  }

  return `({ inputs, outputs, nodes }) => [\n${lines.join('\n')}\n  ]`;
}

function portRef(p: { nodeId: string; portName: string }, role: 'source' | 'target'): string {
  if (p.nodeId === '') {
    // At the top level: sources are the circuit's own inputs (driving outward),
    // targets are the circuit's own outputs (consuming inward). The DSL forbids
    // the inverse, so role is sufficient to disambiguate.
    return role === 'source' ? `inputs.${p.portName}` : `outputs.${p.portName}`;
  }
  return `nodes.${p.nodeId}.${p.portName}`;
}

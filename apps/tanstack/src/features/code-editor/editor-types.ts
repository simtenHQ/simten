/**
 * Type declarations for the Monaco editor's TypeScript language service.
 *
 * These are loaded via addExtraLib to give users autocomplete for
 * circuit(), bit, bus, and all stdlib components.
 *
 * The types mirror the actual builder API from @simten/core/circuit.
 * The generic CircuitConfig type enables autocomplete for port names
 * inside connect() callbacks.
 */

import type { BuiltCircuit } from '@simten/core/circuit';
import * as std from '@simten/core/std';

/** Convert a port type to its TypeScript type string */
function portTypeStr(portType: { kind: string; width?: number }): string {
  return portType.kind === 'bit' ? 'BitType' : `BusType`;
}

/** Generate a typed BuiltCircuit declaration from a BuiltCircuit */
function typedDecl(comp: BuiltCircuit): string {
  const c = comp.circuit;
  const ins = c.inputs.map(p => `${p.name}: ${portTypeStr(p.portType)}`).join('; ');
  const outs = c.outputs.map(p => `${p.name}: ${portTypeStr(p.portType)}`).join('; ');
  const insType = ins ? `{ ${ins} }` : '{}';
  const outsType = outs ? `{ ${outs} }` : '{}';
  return `declare const ${comp.name}: BuiltCircuit<${insType}, ${outsType}>;`;
}

/** Generate stdlib declarations with typed port shapes from actual stdlib circuits */
function generateStdlibDeclarations(): string {
  const lines: string[] = ['// Standard Library Components (auto-generated with port shapes)'];
  const circuits = (Object.values(std) as unknown[]).filter(
    (v): v is BuiltCircuit => !!v && typeof v === 'object' && 'name' in v && 'circuit' in v,
  );
  for (const comp of circuits) {
    lines.push(typedDecl(comp));
  }
  return lines.join('\n');
}

export const EDITOR_TYPE_DECLARATIONS = `
// ============================================================================
// Port Types
// ============================================================================

interface BitType { readonly kind: 'bit'; }
interface BusType { readonly kind: 'bus'; readonly width: number; }
type PortType = BitType | BusType;

declare const bit: BitType;
declare function bus(width: number): BusType;

// ============================================================================
// Port References (for connect callbacks)
// ============================================================================

interface PortRef {
  to(...targets: PortRef[]): ConnectionDef;
  readonly _path: { nodeId: string; portName: string };
  readonly _type: PortType;
}

interface ConnectionDef {
  readonly source: { nodeId: string; portName: string };
  readonly targets: { nodeId: string; portName: string }[];
  readonly portType: PortType;
}

// ============================================================================
// Built Component
// ============================================================================

interface BuiltCircuit<
  Ins extends Record<string, PortType> = Record<string, PortType>,
  Outs extends Record<string, PortType> = Record<string, PortType>,
> {
  readonly circuit: any;
  readonly _shape: { inputs: Ins; outputs: Outs };
  readonly name: string;
}

// ============================================================================
// Connect Callback Typing
// ============================================================================

/** Convert a port map to PortRef accessors */
type PortRefs<M> = {
  readonly [K in keyof M]: PortRef;
};

/** Extract all port refs from a BuiltCircuit */
type NodePortRefs<C extends BuiltCircuit> =
  PortRefs<C['_shape']['inputs']> & PortRefs<C['_shape']['outputs']>;

/** The connect callback argument — typed from config's in/out/nodes */
type ConnectArg<
  Ins extends Record<string, PortType | number>,
  Outs extends Record<string, PortType | number>,
  Nodes extends Record<string, BuiltCircuit>,
> = {
  readonly in: PortRefs<Ins>;
  readonly out: PortRefs<Outs>;
} & {
  readonly [K in keyof Nodes]: NodePortRefs<Nodes[K]>;
};

/** Convert port map to numeric values for eval */
type PortValues<M> = { [K in keyof M]: number };

// ============================================================================
// Component Config (generic — enables autocomplete)
// ============================================================================

interface CircuitConfig<
  Ins extends Record<string, PortType | number> = Record<string, PortType | number>,
  Outs extends Record<string, PortType | number> = Record<string, PortType | number>,
  Nodes extends Record<string, BuiltCircuit> = Record<string, BuiltCircuit>,
  S extends Record<string, number | boolean | object> = Record<string, number | boolean | object>,
> {
  in?: Ins;
  out?: Outs;
  nodes?: Nodes;
  nodeArgs?: { [K in keyof Nodes]?: Record<string, any> };
  connect?: (arg: ConnectArg<Ins, Outs, Nodes>) => ConnectionDef[];
  eval?: (inputs: PortValues<Ins> & Partial<S>) => PortValues<Outs>;
  state?: S;
  onTick?: (inputsAndState: PortValues<Ins> & S) => S;
  meta?: { category?: string; description?: string; icon?: string; tags?: string[] };
}

// ============================================================================
// circuit() function
// ============================================================================

declare function circuit<
  Ins extends Record<string, PortType | number>,
  Outs extends Record<string, PortType | number>,
  Nodes extends Record<string, BuiltCircuit>,
  S extends Record<string, number | boolean | object>,
>(name: string, config?: CircuitConfig<Ins, Outs, Nodes, S>): BuiltCircuit;

// ============================================================================
// Standard Library
// ============================================================================

${generateStdlibDeclarations()}
`;

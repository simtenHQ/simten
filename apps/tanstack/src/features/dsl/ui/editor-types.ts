/**
 * Type declarations for the Monaco editor's TypeScript language service.
 *
 * These are loaded via addExtraLib to give users autocomplete for
 * component(), bit, bus, and all stdlib components.
 *
 * The types mirror the actual builder API from @turing-incomplete/core/builder.
 * The generic ComponentConfig type enables autocomplete for port names
 * inside connect() callbacks.
 */

import { PRIMITIVE_DEFINITIONS, type CorePrimitiveDefinition } from '@turing-incomplete/core/simulator';

/** Convert a port type to its TypeScript type string */
function portTypeStr(portType: { kind: string; width?: number }): string {
  return portType.kind === 'bit' ? 'BitType' : `BusType`;
}

/** Generate a typed BuiltComponent declaration for a primitive */
function typedDecl(def: CorePrimitiveDefinition): string {
  const ins = def.inputs.map(p => `${p.name}: ${portTypeStr(p.portType)}`).join('; ');
  const outs = def.outputs.map(p => `${p.name}: ${portTypeStr(p.portType)}`).join('; ');
  const insType = ins ? `{ ${ins} }` : '{}';
  const outsType = outs ? `{ ${outs} }` : '{}';
  return `declare const ${def.name}: BuiltComponent<${insType}, ${outsType}>;`;
}

/** Generate stdlib declarations with typed port shapes from actual primitive definitions */
function generateStdlibDeclarations(): string {
  const lines: string[] = ['// Standard Library Components (auto-generated with port shapes)'];
  for (const def of Object.values(PRIMITIVE_DEFINITIONS)) {
    lines.push(typedDecl(def));
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

interface BuiltComponent<
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

/** Extract all port refs from a BuiltComponent */
type NodePortRefs<C extends BuiltComponent> =
  PortRefs<C['_shape']['inputs']> & PortRefs<C['_shape']['outputs']>;

/** The connect callback argument — typed from config's in/out/nodes */
type ConnectArg<
  Ins extends Record<string, PortType | number>,
  Outs extends Record<string, PortType | number>,
  Nodes extends Record<string, BuiltComponent>,
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

interface ComponentConfig<
  Ins extends Record<string, PortType | number> = Record<string, PortType | number>,
  Outs extends Record<string, PortType | number> = Record<string, PortType | number>,
  Nodes extends Record<string, BuiltComponent> = Record<string, BuiltComponent>,
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
// component() function
// ============================================================================

declare function component<
  Ins extends Record<string, PortType | number>,
  Outs extends Record<string, PortType | number>,
  Nodes extends Record<string, BuiltComponent>,
  S extends Record<string, number | boolean | object>,
>(name: string, config?: ComponentConfig<Ins, Outs, Nodes, S>): BuiltComponent;

// ============================================================================
// Standard Library
// ============================================================================

${generateStdlibDeclarations()}
`;

/**
 * Bridge: Convert existing CorePrimitiveDefinition to BuiltComponent.
 *
 * This allows the existing PRIMITIVE_DEFINITIONS to be used with the
 * new builder API without rewriting them. Each converted component:
 * - Has the same ports, parameters, and metadata
 * - Uses the existing hand-written fast evaluators (no wrapper overhead)
 * - Is a valid BuiltComponent that works with .node() and simulate()
 *
 * Over time, primitives can be rewritten using component() directly.
 * This bridge ensures the stdlib works from day one.
 */

import type { Circuit, PortDescriptor, ClockDescriptor, StateBlock, Parameter } from '../types/circuit.js';
import type { CorePrimitiveDefinition } from '../simulator/primitives.js';
import type { BuiltComponent, PortMap } from '../builder/types.js';

/**
 * Convert a CorePrimitiveDefinition to a BuiltComponent.
 */
export function fromPrimitive(def: CorePrimitiveDefinition): BuiltComponent {
  const inputs: PortDescriptor[] = def.inputs.map(p => ({ ...p }));
  const outputs: PortDescriptor[] = def.outputs.map(p => ({ ...p }));
  const clocks: ClockDescriptor[] = (def.clocks ?? []).map(c => ({ ...c }));
  const state: StateBlock[] = (def.state ?? []).map(s => ({ ...s }));
  const parameters: Parameter[] = (def.parameters ?? []).map(p => ({ ...p }));

  const isSequential = clocks.length > 0 || state.length > 0;

  const circuit: Circuit = {
    id: `component:${def.name}`,
    name: def.name,
    parameters,
    inputs,
    outputs,
    clocks,
    state,
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: {
      kind: isSequential ? 'sequential' : (outputs.length === 0 ? 'combinational' : 'combinational'),
      description: def.description,
      outputDependency: def.outputDependency,
    },
  };

  // Build type-level port maps
  const inputMap: PortMap = {};
  for (const p of inputs) {
    inputMap[p.name] = p.portType;
  }
  const outputMap: PortMap = {};
  for (const p of outputs) {
    outputMap[p.name] = p.portType;
  }

  const built: BuiltComponent = {
    circuit,
    _shape: { inputs: inputMap, outputs: outputMap },
    name: def.name,
  };

  // Attach metadata for UI
  if (def.category) (built as any)._category = def.category;
  if (def.icon) (built as any)._icon = def.icon;
  if (def.environmentalState) (built as any)._environmentalState = def.environmentalState;

  return built;
}

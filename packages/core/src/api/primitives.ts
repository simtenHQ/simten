/**
 * Primitives Handler
 *
 * Pure function to get primitive component catalog.
 */

import type { CircuitLibrary } from '../types/circuit.js';

export function getPrimitivesHandler(
  params: {
    kind?: 'combinational' | 'sequential' | 'sink';
    source?: string;
    sourceName?: string;
    compact?: boolean;
  },
  library: CircuitLibrary
): string {
  const compact = params.compact ?? true;

  // Get all primitives from the library
  const primitiveNames = library.getAllPrimitiveNames?.() ?? [];
  const components: Array<{
    name: string;
    kind?: string;
    description?: string;
    inputs: Array<{ name: string; type: string }>;
    outputs: Array<{ name: string; type: string }>;
    clocks: Array<{ name: string }>;
  }> = [];

  for (const name of primitiveNames) {
    const circuit = library.resolveCircuit(name);
    if (!circuit) continue;

    const kind = circuit.metadata?.timing;
    if (params.kind && kind !== params.kind) continue;

    components.push({
      name: circuit.name,
      kind,
      description: circuit.metadata?.description,
      inputs: circuit.inputs.map((p) => ({
        name: p.name,
        type: p.portType.kind === 'bit' ? 'Bit' : `Bus[${(p.portType as any).width ?? '?'}]`,
      })),
      outputs: circuit.outputs.map((p) => ({
        name: p.name,
        type: p.portType.kind === 'bit' ? 'Bit' : `Bus[${(p.portType as any).width ?? '?'}]`,
      })),
      clocks: circuit.clocks.map((c) => ({ name: c.name })),
    });
  }

  components.sort((a, b) => a.name.localeCompare(b.name));

  const formatter = compact ? formatCompact : formatDetailed;
  const separator = compact ? '\n' : '\n\n---\n\n';

  return components.map((c) => formatter(c)).join(separator) || 'No components found.';
}

function formatCompact(c: {
  name: string;
  kind?: string;
  description?: string;
  inputs: Array<{ name: string; type: string }>;
  outputs: Array<{ name: string; type: string }>;
  clocks: Array<{ name: string }>;
}): string {
  let sig = c.name;
  sig += `(${c.inputs.map((p) => `${p.name}:${p.type}`).join(', ')})`;
  sig += ` -> (${c.outputs.map((p) => `${p.name}:${p.type}`).join(', ')})`;
  if (c.clocks.length > 0) sig += ` [clk:${c.clocks.map((cl) => cl.name).join(',')}]`;
  if (c.kind) sig += ` [${c.kind}]`;
  if (c.description) sig += ` // ${c.description}`;
  return sig;
}

function formatDetailed(c: {
  name: string;
  kind?: string;
  description?: string;
  inputs: Array<{ name: string; type: string }>;
  outputs: Array<{ name: string; type: string }>;
  clocks: Array<{ name: string }>;
}): string {
  const lines: string[] = [];
  lines.push(`Component: ${c.name}`);
  if (c.description) lines.push(`Description: ${c.description}`);
  if (c.kind) lines.push(`Kind: ${c.kind}`);
  lines.push('');
  lines.push('Inputs:');
  for (const input of c.inputs) lines.push(`  ${input.name}: ${input.type}`);
  lines.push('');
  lines.push('Outputs:');
  for (const output of c.outputs) lines.push(`  ${output.name}: ${output.type}`);
  if (c.clocks.length > 0) {
    lines.push('');
    lines.push('Clocks:');
    for (const clock of c.clocks) lines.push(`  ${clock.name}`);
  }
  return lines.join('\n');
}

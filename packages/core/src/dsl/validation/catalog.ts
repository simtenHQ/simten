/**
 * Component Catalog Builder
 *
 * Builds component catalogs for autocomplete and LLM context.
 * Provides searchable component interfaces and grammar summaries.
 *
 * Design Principles:
 * - All output is deterministically sorted
 * - Component interfaces are normalized for consistent LLM consumption
 * - Grammar summary is kept concise for context efficiency
 */

import type { Circuit, ComponentLibrary } from '../../types/circuit.js';
import type { ComponentInterface } from './types.js';
import { formatPortType } from './types.js';

// ============================================================================
// Component Catalog Types
// ============================================================================

/**
 * A searchable component catalog.
 */
export interface ComponentCatalog {
  /** All components in the catalog */
  components: ComponentInterface[];
  /** Total number of components */
  count: number;
  /** Component kinds available */
  kinds: Set<'combinational' | 'sequential' | 'sink'>;
}

// ============================================================================
// Catalog Building
// ============================================================================

/**
 * Build a component catalog from a library.
 */
export function getComponentCatalog(library: ComponentLibrary): ComponentCatalog {
  const components: ComponentInterface[] = [];
  const kinds = new Set<'combinational' | 'sequential' | 'sink'>();

  // Get all primitive names
  const primitiveNames = library.getAllPrimitiveNames?.() ?? [];

  for (const name of primitiveNames) {
    const circuit = library.resolveComponent(name);
    if (circuit) {
      const iface = circuitToInterface(circuit);
      components.push(iface);
      if (iface.kind) {
        kinds.add(iface.kind);
      }
    }
  }

  // Sort for deterministic output
  components.sort((a, b) => a.name.localeCompare(b.name));

  return {
    components,
    count: components.length,
    kinds,
  };
}

/**
 * Format a port type, showing parameterized widths (e.g. "Bus[width]", "Bus[width*2]").
 */
function formatParametricPortType(port: { portType: { kind: string; width?: number }; widthParam?: string; widthMultiplier?: number }): string {
  if (port.widthParam) {
    const multiplier = port.widthMultiplier && port.widthMultiplier !== 1
      ? `${port.widthParam}*${port.widthMultiplier}`
      : port.widthParam;
    return `Bus[${multiplier}]`;
  }
  return formatPortType(port.portType);
}

/**
 * Convert a Circuit to a ComponentInterface.
 */
function circuitToInterface(circuit: Circuit): ComponentInterface {
  return {
    name: circuit.name,
    inputs: circuit.inputs.map((p) => ({
      name: p.name,
      type: formatParametricPortType(p),
    })),
    outputs: circuit.outputs.map((p) => ({
      name: p.name,
      type: formatParametricPortType(p),
    })),
    clocks: circuit.clocks.map((c) => ({ name: c.name })),
    parameters: circuit.parameters.length > 0
      ? circuit.parameters.map((p) => ({
          name: p.name,
          type: p.paramType,
          defaultValue: p.defaultValue?.toString(),
          options: p.options,
        }))
      : undefined,
    kind: circuit.metadata?.kind,
    description: circuit.metadata?.description,
  };
}

// ============================================================================
// Component Search
// ============================================================================

/**
 * Search components by name or description.
 * Supports fuzzy matching.
 */
export function searchComponents(
  catalog: ComponentCatalog,
  query: string
): ComponentInterface[] {
  if (!query.trim()) {
    return catalog.components;
  }

  const lowerQuery = query.toLowerCase();
  const results: Array<{ component: ComponentInterface; score: number }> = [];

  for (const component of catalog.components) {
    const score = calculateSearchScore(component, lowerQuery);
    if (score > 0) {
      results.push({ component, score });
    }
  }

  // Sort by score (descending), then by name
  results.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.component.name.localeCompare(b.component.name);
  });

  return results.map((r) => r.component);
}

/**
 * Calculate search relevance score.
 */
function calculateSearchScore(
  component: ComponentInterface,
  query: string
): number {
  let score = 0;

  // Exact name match
  if (component.name.toLowerCase() === query) {
    score += 100;
  }
  // Name starts with query
  else if (component.name.toLowerCase().startsWith(query)) {
    score += 50;
  }
  // Name contains query
  else if (component.name.toLowerCase().includes(query)) {
    score += 25;
  }

  // Description contains query
  if (component.description?.toLowerCase().includes(query)) {
    score += 10;
  }

  // Port names contain query
  for (const input of component.inputs) {
    if (input.name.toLowerCase().includes(query)) {
      score += 5;
    }
  }
  for (const output of component.outputs) {
    if (output.name.toLowerCase().includes(query)) {
      score += 5;
    }
  }

  return score;
}

/**
 * Get components by kind.
 */
export function getComponentsByKind(
  catalog: ComponentCatalog,
  kind: 'combinational' | 'sequential' | 'sink'
): ComponentInterface[] {
  return catalog.components.filter((c) => c.kind === kind);
}

// ============================================================================
// LLM Context Generation
// ============================================================================

/**
 * Generate a concise grammar summary for LLM context.
 * Includes both template and concrete example for clarity.
 */
export function getGrammarSummary(): string {
  return `// Template syntax:
circuit <Name> {
  description "<one-sentence description>"
  input <name>: Bit | Bus[N]
  output <name>: Bit | Bus[N]
  clock <name>
  impl {
    node <instance>: <ComponentType>
    node <instance>: <ComponentType>(<param>=<value>, ...)
    connect <source> -> <target>
  }
}

// Concrete example:
circuit SwitchToLed {
  description "Connects a switch directly to an LED"
  impl {
    node sw: Switch
    node led: Led
    connect sw.out -> led.in
  }
}

// Parametric example: pass parameters to configure component width, initial value, etc.
circuit Counter16 {
  description "16-bit counter with enable"
  input enable: Bit
  output count: Bus[16]
  clock clk
  impl {
    node reg: Register(width=16)
    node adder: Adder(width=16)
    node one: Constant(value=1)
    node zero: Constant(value=0)
    connect reg.q -> adder.a
    connect one.out -> adder.b
    connect zero.out -> adder.carry_in
    connect adder.sum -> reg.data
    connect enable -> reg.we
    connect reg.q -> count
  }
}

// Composite: define a circuit, then use it as a component in another.
// Circuits defined earlier in the file can be referenced by later circuits.
circuit HalfAdder {
  description "Adds two 1-bit values, producing sum and carry"
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit
  impl {
    node xor1: Xor
    node and1: And
    connect a -> xor1.a
    connect b -> xor1.b
    connect a -> and1.a
    connect b -> and1.b
    connect xor1.out -> sum
    connect and1.out -> carry
  }
}

circuit FullAdder {
  description "Adds two 1-bit values with carry-in, using two HalfAdders"
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit
  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder
    node or1: Or
    connect a -> ha1.a
    connect b -> ha1.b
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}

// WRONG: Do NOT use this syntax:
// Switch sw;        <- WRONG (not valid DSL)
// sw.out -> led.in; <- WRONG (not valid DSL)`;
}

/**
 * Generate LLM context string for component catalog.
 */
export function getLLMContext(library: ComponentLibrary): string {
  const catalog = getComponentCatalog(library);
  const lines: string[] = [];

  lines.push('=== Available Components ===\n');

  // Group by kind
  const combinational = catalog.components.filter((c) => c.kind === 'combinational' || !c.kind);
  const sequential = catalog.components.filter((c) => c.kind === 'sequential');
  const sinks = catalog.components.filter((c) => c.kind === 'sink');

  if (combinational.length > 0) {
    lines.push('Combinational:');
    for (const c of combinational) {
      lines.push(`  ${formatComponentSignature(c)}`);
    }
    lines.push('');
  }

  if (sequential.length > 0) {
    lines.push('Sequential:');
    for (const c of sequential) {
      lines.push(`  ${formatComponentSignature(c)}`);
    }
    lines.push('');
  }

  if (sinks.length > 0) {
    lines.push('Sinks:');
    for (const c of sinks) {
      lines.push(`  ${formatComponentSignature(c)}`);
    }
    lines.push('');
  }

  lines.push('=== Grammar ===\n');
  lines.push(getGrammarSummary());

  return lines.join('\n');
}

/**
 * Format a component signature for display.
 */
function formatComponentSignature(component: ComponentInterface): string {
  const inputs = component.inputs.map((p) => `${p.name}: ${p.type}`).join(', ');
  const outputs = component.outputs.map((p) => `${p.name}: ${p.type}`).join(', ');

  let sig = `${component.name}`;

  // Add parameters if any
  if (component.parameters && component.parameters.length > 0) {
    const params = component.parameters
      .map((p) => `${p.name}: ${p.type}${p.defaultValue ? ` = ${p.defaultValue}` : ''}`)
      .join(', ');
    sig += `<${params}>`;
  }

  sig += `(${inputs})`;
  sig += ` -> (${outputs})`;

  // Add clocks if any
  if (component.clocks.length > 0) {
    sig += ` [clk: ${component.clocks.map((c) => c.name).join(', ')}]`;
  }

  return sig;
}

// ============================================================================
// Component Details
// ============================================================================

/**
 * Get detailed information about a specific component.
 */
export function getComponentDetails(
  library: ComponentLibrary,
  componentName: string
): ComponentInterface | undefined {
  const circuit = library.resolveComponent(componentName);
  if (!circuit) return undefined;
  return circuitToInterface(circuit);
}

/**
 * Format component details for display.
 */
export function formatComponentDetails(component: ComponentInterface): string {
  const lines: string[] = [];

  lines.push(`Component: ${component.name}`);

  if (component.description) {
    lines.push(`Description: ${component.description}`);
  }

  if (component.kind) {
    lines.push(`Kind: ${component.kind}`);
  }

  lines.push('');
  lines.push('Inputs:');
  for (const input of component.inputs) {
    lines.push(`  ${input.name}: ${input.type}`);
  }

  lines.push('');
  lines.push('Outputs:');
  for (const output of component.outputs) {
    lines.push(`  ${output.name}: ${output.type}`);
  }

  if (component.clocks.length > 0) {
    lines.push('');
    lines.push('Clocks:');
    for (const clock of component.clocks) {
      lines.push(`  ${clock.name}`);
    }
  }

  if (component.parameters && component.parameters.length > 0) {
    lines.push('');
    lines.push('Parameters:');
    for (const param of component.parameters) {
      const defaultStr = param.defaultValue ? ` (default: ${param.defaultValue})` : '';
      const optionsStr = param.options ? ` [${param.options.join(', ')}]` : '';
      lines.push(`  ${param.name}: ${param.type}${defaultStr}${optionsStr}`);
    }
  }

  return lines.join('\n');
}

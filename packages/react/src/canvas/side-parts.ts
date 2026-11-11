/**
 * Peripherals nested out of sight, inside a composite or inside the box the
 * top circuit is drawn as, which the canvas draws at the side so their output
 * shows without drilling in: consoles, UARTs and pixel displays.
 */

import type { CircuitDefinitions, CircuitIR, PeripheralValue } from '@simten/core/internal';

/** The parts drawn at the side, by the std part each one is. */
export type SideKind = 'Console' | 'UART_TX' | 'PaletteDisplay';

export interface SidePart {
  /** Its session path, which keys its peripheral state. */
  path: string;
  kind: SideKind;
  /** Its constructor options (a display's size and palette). */
  arguments?: CircuitIR['nodes'][number]['arguments'];
}

const isSideKind = (ref: string): ref is SideKind =>
  ref === 'Console' || ref === 'UART_TX' || ref === 'PaletteDisplay';

/** The node at `path` (node ids joined by dots) inside `circuit`. */
export function nodeAt(
  circuit: CircuitIR,
  definitions: CircuitDefinitions,
  path: string,
): CircuitIR['nodes'][number] | undefined {
  let at: CircuitIR | undefined = circuit;
  let node: CircuitIR['nodes'][number] | undefined;
  for (const id of path.split('.')) {
    node = at?.nodes.find((n) => n.id === id);
    if (!node) return undefined;
    at = definitions.resolveCircuit(node.componentRef);
  }
  return node;
}

/**
 * The peripherals in `peripherals` the canvas doesn't already draw (`onCanvas`
 * holds the drawn nodes' ids), each with the part it is. A path that doesn't
 * resolve but holds text is taken for a console, as before the parts were
 * looked up.
 */
export function sideParts(
  peripherals: ReadonlyMap<string, PeripheralValue>,
  onCanvas: ReadonlySet<string>,
  circuit: CircuitIR | null,
  definitions: CircuitDefinitions | null,
): SidePart[] {
  const parts: SidePart[] = [];
  for (const [path, value] of peripherals) {
    if (onCanvas.has(path)) continue;
    const node = circuit && definitions ? nodeAt(circuit, definitions, path) : undefined;
    if (node && isSideKind(node.componentRef)) {
      parts.push({ path, kind: node.componentRef, arguments: node.arguments });
    } else if (!node && typeof value === 'string') {
      parts.push({ path, kind: path.toLowerCase().includes('uart') ? 'UART_TX' : 'Console' });
    }
  }
  return parts;
}

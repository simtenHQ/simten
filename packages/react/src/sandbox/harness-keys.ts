/**
 * The hook's keys, in the session's terms.
 *
 * `useSimulation` always opens a harnessed session (decision 0010): a circuit
 * with ports is wrapped as node `dut`, with a Switch or Input named after each
 * input port it reads and a lamp or display named after each output. Users name
 * things in the circuit's own terms: `a` for an input port, `d` for a Switch
 * inside it, `cpu.kbd` deeper down. In the session a port's Switch keeps the
 * port's name, and everything inside the circuit is under `dut.`.
 *
 * A circuit with no ports isn't wrapped, so its keys are already the session's.
 * Removed with the harness by #531.
 */

import type { CircuitDefinitions, CircuitIR } from '@simten/core/internal';

/** The components a person at the board could change. */
const CONTROLS = new Set(['Switch', 'Input']);
/** The harness's node for the circuit it wraps. */
const DUT = 'dut';

export interface HarnessKeys {
  /** Whether the session wraps the circuit in a harness. */
  readonly harnessed: boolean;
  /**
   * The session's key for an input. A port nothing reads has no Switch in the
   * harness and gives null: there is nothing to set. Throws for a key that names
   * both an input port and a Switch or Input of the circuit.
   */
  input(key: string): string | null;
  /** The session's path for a node of the circuit, such as a memory. */
  node(path: string): string;
}

/** The component at dotted `path` inside `circuit`, or undefined when no node has that path. */
function componentAt(
  circuit: CircuitIR,
  path: string,
  definitions: CircuitDefinitions,
): string | undefined {
  let current: CircuitIR | undefined = circuit;
  let component: string | undefined;
  for (const id of path.split('.')) {
    const node = current?.nodes.find((n) => n.id === id);
    if (!node) return undefined;
    component = node.componentRef;
    current = definitions.resolveCircuit(node.componentRef);
  }
  return component;
}

/**
 * How `circuit`'s keys map onto its session. A key inside a harnessed circuit
 * is checked here, against `definitions`, so a mistake is reported in the
 * circuit's terms rather than the harness's. `session`, the circuit the session
 * runs, says which ports got a Switch; before it opens, every port is taken to
 * have one, as the host drops starting values for ports that didn't.
 */
export function harnessKeys(
  circuit: CircuitIR,
  definitions: CircuitDefinitions,
  session?: CircuitIR,
): HarnessKeys {
  const harnessed = circuit.inputs.length > 0 || circuit.outputs.length > 0;
  if (!harnessed) return { harnessed, input: (key) => key, node: (path) => path };
  const ports = new Set(circuit.inputs.map((p) => p.name));
  const controls = new Set(
    circuit.nodes.filter((n) => CONTROLS.has(n.componentRef)).map((n) => n.id),
  );
  const switched = session
    ? new Set(session.nodes.filter((n) => n.harness).map((n) => n.id))
    : null;
  return {
    harnessed,
    input(key) {
      if (ports.has(key) && controls.has(key)) {
        throw new Error(
          `set('${key}'): ${circuit.name} has both an input port and a Switch or Input named '${key}', so the key is ambiguous. Rename one of them.`,
        );
      }
      if (ports.has(key)) return !switched || switched.has(key) ? key : null;
      const component = componentAt(circuit, key, definitions);
      if (component === undefined) {
        throw new Error(
          `set('${key}'): ${circuit.name} has no input port, Switch or Input named '${key}'. Its inputs: ${[...ports].join(', ')}`,
        );
      }
      if (!CONTROLS.has(component)) {
        throw new Error(
          `set('${key}'): '${key}' is a ${component}, not an input. Only input ports and Switch and Input nodes can be set; load a memory's contents with the memory option.`,
        );
      }
      return `${DUT}.${key}`;
    },
    node: (path) => `${DUT}.${path}`,
  };
}

/** `values` with each key in the session's terms; inputs nothing reads are dropped. */
export function sessionInputs(
  keys: HarnessKeys,
  values: Partial<Record<string, number>>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const path = keys.input(key);
    if (path !== null) result[path] = value;
  }
  return result;
}

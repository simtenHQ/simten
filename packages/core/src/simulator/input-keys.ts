/**
 * The names `Simulation.set` and `get` take, and what each one names: input
 * ports by name, Switch and Input nodes by path, and for `get` the output
 * ports too. Core's `Simulation` and the sandbox's `SimulationClient` both
 * resolve names here, so a name means the same thing on either side of the
 * sandbox.
 */

import { type CircuitDefinitions, type CircuitIR, TOP_LEVEL_NODE } from '../ir/circuit-ir.js';

/** The components `set` writes by path: what a person at the board could change. */
const CONTROLS = new Set(['Switch', 'Input']);

/** Whether `ir` is the Switch or Input primitive. */
export function isControlCircuit(ir: CircuitIR): boolean {
  return CONTROLS.has(ir.name) && !!ir.metadata?.interactiveArg;
}

/** Whether nodes of primitive type `type` are Switches or Inputs. */
export function isControlType(type: string, definitions: CircuitDefinitions): boolean {
  const ir = definitions.resolveCircuit(type);
  return ir !== undefined && isControlCircuit(ir);
}

/**
 * The primitive nodes of `circuit` by dotted path, walked from the IR: the
 * paths a flattened simulation gives its nodes, without flattening.
 */
export function primitivePaths(
  circuit: CircuitIR,
  definitions: CircuitDefinitions,
): Map<string, string> {
  const paths = new Map<string, string>();
  const walk = (ir: CircuitIR, prefix: string) => {
    for (const node of ir.nodes) {
      const path = prefix + node.id;
      const inner = definitions.resolveCircuit(node.componentRef);
      if (inner?.implementation.kind === 'composite') walk(inner, `${path}.`);
      else paths.set(path, node.componentRef);
    }
  };
  walk(circuit, '');
  return paths;
}

/** What a circuit's names can refer to. */
export interface KeyScope {
  circuitName: string;
  inputs: ReadonlySet<string>;
  outputs: ReadonlySet<string>;
  /** The primitive types of the circuit's nodes, by path. */
  primitives(): ReadonlyMap<string, string>;
  /** Whether nodes of this primitive type are Switches or Inputs. */
  isControl(type: string): boolean;
}

/** What a name resolved to. `key` is where its value is in the port map. */
export type ResolvedKey =
  | { kind: 'output'; key: string }
  | { kind: 'port'; name: string; key: string }
  | { kind: 'path'; path: string; key: string };

const list = (names: Iterable<string>) => [...names].join(', ') || '(none)';

/**
 * What `name` names for `method`. One name must mean one thing: a port and a
 * Switch or Input with the same name is ambiguous, for `set` as for `get`, so
 * a toggle never reads one and writes the other. `circuit()` rejects that
 * clash when the circuit is defined; the check here covers IR that didn't
 * come through it (an import, or IR built by hand). A node that isn't a
 * Switch or Input, or a name that is nothing, throws.
 */
export function resolveKey(method: 'set' | 'get', name: string, scope: KeyScope): ResolvedKey {
  const isInput = scope.inputs.has(name);
  const isOutput = scope.outputs.has(name);
  const type = scope.primitives().get(name);
  const isControl = type !== undefined && scope.isControl(type);
  if ((isInput || isOutput) && isControl) {
    throw new Error(
      `${method}('${name}'): ${scope.circuitName} has both an ${isInput ? 'input' : 'output'} port and a ${type} named '${name}', so the key is ambiguous. Rename one of them.`,
    );
  }
  if (isInput) return { kind: 'port', name, key: `${TOP_LEVEL_NODE}.${name}` };
  if (isControl) return { kind: 'path', path: name, key: `${name}.out` };
  if (method === 'get' && isOutput) return { kind: 'output', key: `${TOP_LEVEL_NODE}.${name}` };
  if (type !== undefined) {
    const hint =
      method === 'set'
        ? "not an input. Only input ports and Switch and Input nodes can be set; load a memory's contents with the memory option."
        : 'not a port, Switch or Input. Only ports and Switch and Input nodes can be read.';
    throw new Error(`${method}('${name}'): '${name}' is a ${type}, ${hint}`);
  }
  if (method === 'set') {
    throw new Error(
      `${method}('${name}'): ${scope.circuitName} has no input port, Switch or Input named '${name}'. Its inputs: ${list(scope.inputs)}`,
    );
  }
  const controls = [...scope.primitives()]
    .filter(([, t]) => scope.isControl(t))
    .map(([path]) => path);
  throw new Error(
    `${method}('${name}'): ${scope.circuitName} has no port, Switch or Input named '${name}'. Its inputs: ${list(scope.inputs)}. Its Switches and Inputs: ${list(controls)}. Its outputs: ${list(scope.outputs)}`,
  );
}

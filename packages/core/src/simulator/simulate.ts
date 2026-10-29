/**
 * `simulate(top)`: run a built circuit.
 *
 * Usage:
 *   const sim = simulate(HalfAdder)
 *   sim.set({ a: 1, b: 1 })
 *   sim.get('sum')  // 0
 *
 * `set` takes input port names and the paths of Switch and Input nodes, so a
 * circuit driven by switches is driven the same way: `sim.set({ d: 0, en: 0 })`.
 *
 * See `simulation.ts` for the `Simulation` it returns.
 */

import { libraryOf } from '../circuit/behavior.js';
import type { Circuit, InputKey, PortMap } from '../circuit/builder-types.js';
import { internalsOf } from '../circuit/internals.js';
import type { ArgumentValue, CircuitIR, Connection } from '../ir/circuit-ir.js';
import { createSimulation, type SimulateOptions, type Simulation } from './simulation.js';

/**
 * Create a simulation from a component.
 *
 * @param top - A Circuit (from circuit() or std)
 * @param options - `history`: cycles kept for stepBack/stepForward/seek (default 0, off).
 *   `memory`: contents by node path, loaded before cycle 0.
 */
export function simulate<
  Ins extends PortMap,
  Outs extends PortMap,
  Ns extends Record<string, unknown> = Record<string, unknown>,
>(
  top: Circuit<Ins, Outs, Ns>,
  options?: SimulateOptions,
): Simulation<Ins, Outs, InputKey<Circuit<Ins, Outs, Ns>>> {
  const { ir, args } = internalsOf(top);
  // A primitive runs inside a composite shell, which elaboration needs.
  return createSimulation(wrapIfPrimitive(ir, args), libraryOf(top), options) as Simulation<
    Ins,
    Outs,
    InputKey<Circuit<Ins, Outs, Ns>>
  >;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Wrap a primitive component in a composite shell for simulation.
 * The elaboration pipeline expects a composite top-level circuit with nodes.
 * Bare primitives need a wrapper that instantiates them and wires through.
 * The wrapper's node carries the instance's arguments, as a parent's would, so
 * `simulate(Register({ value: 5 }))` starts at 5 (#428).
 */
function wrapIfPrimitive(circuit: CircuitIR, args: Record<string, ArgumentValue>): CircuitIR {
  if (circuit.implementation.kind !== 'primitive') return circuit;

  const nodeId = '_inner';
  const nodes = [
    {
      id: nodeId,
      componentRef: circuit.name,
      arguments: args,
      inputs: circuit.inputs.map((p) => ({
        id: `${nodeId}.${p.name}`,
        name: p.name,
        portType: p.portType,
      })),
      outputs: circuit.outputs.map((p) => ({
        id: `${nodeId}.${p.name}`,
        name: p.name,
        portType: p.portType,
      })),
      clocks: circuit.clocks.map((c) => ({
        id: `${nodeId}.${c.name}`,
        name: c.name,
      })),
    },
  ];

  // Wire circuit inputs → node inputs, node outputs → circuit outputs
  const connections: Connection[] = [];
  let connIdx = 0;
  for (const p of circuit.inputs) {
    connections.push({
      id: `conn_${connIdx++}`,
      source: { nodeId: '', portName: p.name },
      target: { nodeId, portName: p.name },
      portType: p.portType,
    });
  }
  for (const p of circuit.outputs) {
    connections.push({
      id: `conn_${connIdx++}`,
      source: { nodeId, portName: p.name },
      target: { nodeId: '', portName: p.name },
      portType: p.portType,
    });
  }

  return {
    version: 1,
    name: `__sim_${circuit.name}`,
    inputs: circuit.inputs.map((p) => ({ ...p })),
    outputs: circuit.outputs.map((p) => ({ ...p })),
    clocks: [],
    state: [],
    nodes,
    connections,
    implementation: { kind: 'composite' },
    metadata: circuit.metadata,
  };
}

/**
 * Switch and Input: the components a person at the board could change, and
 * the only nodes `Simulation.set` and `get` take by path.
 */

import type { CircuitIR } from './circuit-ir.js';

const CONTROLS = new Set(['Switch', 'Input']);

/** Whether `ir` is the Switch or Input primitive. */
export function isControlCircuit(ir: CircuitIR): boolean {
  return CONTROLS.has(ir.name) && !!ir.metadata?.interactiveArg;
}

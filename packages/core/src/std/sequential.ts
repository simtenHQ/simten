/**
 * Standard Library — Sequential Components
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';

/**
 * D Flip-Flop — stores 1 bit on rising clock edge. Whatever value is on
 * `d` at the clock edge is latched and held until the next edge.
 *
 * **Input:** `d` — `bit`
 * **Outputs:** `q` (stored value), `q_bar` (its complement) — `bit`
 *
 * D flip-flops are the basic unit of state. Chains of them make shift
 * registers; arrays of them make multi-bit registers (see `Register`).
 *
 * **Example:** one-tick delay
 * ```ts
 * circuit('Delay', {
 *   inputs:  { signal: bit },
 *   outputs: { delayed: bit },
 *   nodes:   { ff: DFlipFlop },
 *   connect: ({ inputs, outputs, nodes: { ff } }) => [
 *     inputs.signal.to(ff.d),
 *     ff.q.to(outputs.delayed),
 *   ],
 * })
 * ```
 */
export const DFlipFlop = circuit('DFlipFlop', ({ value = false }: { value?: boolean | number } = {}) => ({
  inputs: { d: bit },
  outputs: { q: bit, q_bar: bit },
  state: { value: value as (boolean | number) },
  meta: { category: 'sequential', icon: 'D', description: 'D Flip-Flop — stores 1 bit on rising clock edge' },
  eval: ({ value }) => ({ q: value ? 1 : 0, q_bar: value ? 0 : 1 }),
  onTick: ({ d }) => ({ value: Boolean(d) }),
}));

/**
 * N-bit register — stores data on rising clock edge when write-enable is high.
 * Holds its previous value when `we` is low. The workhorse of synchronous
 * digital logic: program counters, accumulators, pipeline stages, all
 * built from registers.
 *
 * **Inputs:** `data` — `bus(8)`; `we` (write-enable) — `bit`
 * **Output:** `q` (stored value) — `bus(8)`
 *
 * **Example:** simple accumulator
 * ```ts
 * circuit('Acc', {
 *   inputs:  { incoming: bus(8), load: bit },
 *   outputs: { value: bus(8) },
 *   nodes:   { r: Register },
 *   connect: ({ inputs, outputs, nodes: { r } }) => [
 *     inputs.incoming.to(r.data),
 *     inputs.load.to(r.we),
 *     r.q.to(outputs.value),
 *   ],
 * })
 * ```
 */
export const Register = circuit('Register', ({ width = 8, value = 0 }: { width?: number; value?: number } = {}) => ({
  inputs: { data: bus(width), we: bit },
  outputs: { q: bus(width) },
  state: { value },
  meta: { category: 'sequential', icon: 'REG', description: 'N-bit register — stores data on rising clock edge when write-enable is high' },
  eval: ({ value }) => ({ q: value as number }),
  onTick: ({ data, we, value }) => ({
    value: we ? (data as number) : (value as number),
  }),
}));

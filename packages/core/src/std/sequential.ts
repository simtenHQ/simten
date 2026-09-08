/**
 * Standard Library — Sequential Components
 */

import { bit, bus, reg } from '../circuit/bit-bus.js';
import { circuit } from '../circuit/circuit.js';

/**
 * D Flip-Flop — stores 1 bit on rising clock edge. Whatever value is on
 * `d` at the clock edge is latched and held until the next edge.
 *
 * **Input:** `d` — `bit`
 * **Outputs:** `q` (stored value), `q_bar` (its complement) — `bit`
 * **Reset:** on Verilog export, the exporter auto-emits a synchronous
 * active-low `rst_n` port at the module level; when low, `q` snaps to
 * the constructor-time `value` arg. In simulation, `sim.reset()` does
 * the same.
 *
 * D flip-flops are the basic unit of state. Chains of them make shift
 * registers; arrays of them make multi-bit registers (see `Register`).
 *
 * **Example:** one-tick delay
 * ```ts
 * circuit('Delay', {
 *   inputs:  { signal: bit },
 *   outputs: { delayed: bit },
 *   nodes:   { ff: DFlipFlop() },
 *   connect: ({ inputs, outputs, nodes: { ff } }) => [
 *     inputs.signal.to(ff.d),
 *     ff.q.to(outputs.delayed),
 *   ],
 * })
 * ```
 */
export const DFlipFlop = circuit(
  'DFlipFlop',
  // A bit is 0 or 1, not a boolean — including here, in the option. This used
  // to be `value?: boolean | number` defaulting to `false`, with
  // `onTick: ({ d }) => ({ value: Boolean(d) })`, which made DFlipFlop — the
  // most-used sequential primitive in the stdlib — the one place boolean state
  // survived. Nothing caught it, because tests were not type-checked.
  //
  // The width is declared with `reg(1)` rather than left to inference.
  // `circuit()` classifies bare state values by their JS type — boolean → bit,
  // number → bus — so simply swapping `false` for `0` turned this into a
  // 32-bit bus, and the Verilog exporter emits `reg` widths from that.
  ({ value = 0 }: { value?: number } = {}) => ({
    inputs: { d: bit },
    outputs: { q: bit, q_bar: bit },
    state: { value: reg(1, value) },
    meta: {
      category: 'sequential',
      icon: 'D',
      description: 'D Flip-Flop — stores 1 bit on rising clock edge',
    },
    eval: ({ value }) => ({ q: value ? 1 : 0, q_bar: value ? 0 : 1 }),
    onTick: ({ d }) => ({ value: d ? 1 : 0 }),
  }),
);

/**
 * N-bit register — stores data on the rising clock edge when write-enable is high. Optional synchronous reset (rst): when high, q clears to 0 on the next edge, overriding data/we. Leaving rst unconnected (reads 0) gives a plain no-reset register.
 *
 * Holds its previous value when `we` is low. The workhorse of synchronous
 * digital logic: program counters, accumulators, pipeline stages, all
 * built from registers.
 *
 * **Inputs:** `data` — `bus(8)`; `we` (write-enable) — `bit`; `rst` (synchronous
 * reset to 0, optional) — `bit`
 * **Output:** `q` (stored value) — `bus(8)`
 * **Reset:** the optional `rst` input is a per-register synchronous reset to 0 —
 * wire a design reset signal to it, or leave it unconnected for a plain
 * no-reset register. Separately, on Verilog export the exporter auto-emits a
 * module-level active-low `rst_n` that snaps `q` to the constructor `value`;
 * `sim.reset()` does the same.
 *
 * **Example:** simple accumulator
 * ```ts
 * circuit('Acc', {
 *   inputs:  { incoming: bus(8), load: bit },
 *   outputs: { value: bus(8) },
 *   nodes:   { r: Register() },
 *   connect: ({ inputs, outputs, nodes: { r } }) => [
 *     inputs.incoming.to(r.data),
 *     inputs.load.to(r.we),
 *     r.q.to(outputs.value),
 *   ],
 * })
 * ```
 */
export const Register = circuit(
  'Register',
  ({ width = 8, value = 0 }: { width?: number; value?: number } = {}) => ({
    inputs: { data: bus(width), we: bit, rst: bit },
    outputs: { q: bus(width) },
    // Declared, not inferred. `circuit()` classifies a bare state value by its
    // JS type — a number becomes bus(32) regardless of the register's actual
    // width — so `state: { value }` recorded `bus(32)` for a `Register({width:8})`.
    // The exporter derives `reg` widths from the port, so the emitted Verilog
    // was always correct; the wrong width lived only in the IR's stateType.
    state: { value: reg(width, value) },
    meta: {
      category: 'sequential',
      icon: 'REG',
      description:
        'N-bit register — stores data on the rising clock edge when write-enable is high. Optional synchronous reset (rst): when high, q clears to 0 on the next edge, overriding data/we. Leaving rst unconnected (reads 0) gives a plain no-reset register.',
    },
    eval: ({ value }) => ({ q: value as number }),
    // rst is a synchronous reset to 0, taking priority over the write-enable.
    // Unconnected rst reads 0, so existing (no-reset) registers are unchanged.
    onTick: ({ data, we, rst, value }) => ({
      value: rst ? 0 : we ? (data as number) : (value as number),
    }),
  }),
);

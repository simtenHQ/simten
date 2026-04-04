/**
 * Standard Library — Sequential Components
 */

import { component } from '../builder/component.js';
import { bit, bus } from '../builder/bit-bus.js';

export const DFlipFlop = component('DFlipFlop', {
  in: { d: bit },
  out: { q: bit, q_bar: bit },
  state: { value: false as (boolean | number) },
  meta: { category: 'sequential', icon: 'D', description: 'D Flip-Flop — stores 1 bit on rising clock edge' },
  eval: ({ value }) => ({ q: value ? 1 : 0, q_bar: value ? 0 : 1 }),
  onTick: ({ d }) => ({ value: Boolean(d) }),
});

export const Register = component('Register', {
  in: { data: bus(8), we: bit },
  out: { q: bus(8) },
  state: { value: 0 },
  meta: { category: 'sequential', icon: 'REG', description: 'N-bit register — stores data on rising clock edge when write-enable is high' },
  eval: ({ value }) => ({ q: value as number }),
  onTick: ({ data, we, value }) => ({
    value: we ? (data as number) : (value as number),
  }),
});

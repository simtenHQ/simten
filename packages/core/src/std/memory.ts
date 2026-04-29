/**
 * Standard Library — Memory Components
 *
 * Uses mem() state with array-indexed eval/onTick for auto-synthesizable Verilog.
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus, mem } from '../circuit/bit-bus.js';

export const ROM = circuit('ROM', {
  inputs: { addr: bus(16) },
  outputs: { data_out: bus(8) },
  state: { memory: mem(65536, 8) },
  meta: { category: 'memory', icon: '📀', description: 'Read-only memory with address decoding' },
  eval: ({ addr, memory }) => ({
    data_out: memory[addr],
  }),
  onTick: ({ memory }) => ({ memory }),
});

export const RAM = circuit('RAM', {
  inputs: { addr: bus(8), data_in: bus(8), we: bit },
  outputs: { data_out: bus(8) },
  state: { memory: mem(256, 8) },
  meta: { category: 'memory', icon: '📝', description: 'Random access memory' },
  eval: ({ addr, memory }) => ({
    data_out: memory[addr],
  }),
  onTick: ({ addr, data_in, we, memory }) => {
    if (we) memory[addr] = data_in;
    return { memory };
  },
});

export const DualPortRAM = circuit('DualPortRAM', {
  inputs: { addrA: bus(8), dataA: bus(8), weA: bit, addrB: bus(8) },
  outputs: { outA: bus(8), outB: bus(8) },
  state: { memory: mem(256, 8) },
  meta: { category: 'memory', icon: '📝×2', description: 'Dual-port RAM' },
  eval: ({ addrA, addrB, memory }) => ({
    outA: memory[addrA],
    outB: memory[addrB],
  }),
  onTick: ({ addrA, dataA, weA, memory }) => {
    if (weA) memory[addrA] = dataA;
    return { memory };
  },
});

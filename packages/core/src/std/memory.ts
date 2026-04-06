/**
 * Standard Library — Memory Components
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';

export const ROM = circuit('ROM', {
  in: { addr: bus(16) },
  out: { data_out: bus(8) },
  state: { memory: new Map<number, number>() },
  meta: { category: 'memory', icon: '📀', description: 'Read-only memory with address decoding' },
  eval: ({ addr, memory }) => ({
    data_out: (memory as any)?.get?.(addr) ?? 0,
  }),
});

export const RAM = circuit('RAM', {
  in: { addr: bus(8), data_in: bus(8), we: bit },
  out: { data_out: bus(8) },
  state: { memory: new Map<number, number>() },
  meta: { category: 'memory', icon: '📝', description: 'Random access memory' },
  eval: ({ addr, memory }) => ({
    data_out: (memory as any)?.get?.(addr) ?? 0,
  }),
  onTick: ({ addr, data_in, we, memory }) => {
    if (!we) return { memory };
    const m = new Map<number, number>(memory as Map<number, number>);
    m.set(addr as number, data_in as number);
    return { memory: m };
  },
});

export const DualPortRAM = circuit('DualPortRAM', {
  in: { addrA: bus(8), dataA: bus(8), weA: bit, addrB: bus(8) },
  out: { outA: bus(8), outB: bus(8) },
  state: { memory: new Map<number, number>() },
  meta: { category: 'memory', icon: '📝×2', description: 'Dual-port RAM' },
  eval: ({ addrA, addrB, memory }) => ({
    outA: (memory as any)?.get?.(addrA) ?? 0,
    outB: (memory as any)?.get?.(addrB) ?? 0,
  }),
  onTick: ({ addrA, dataA, weA, memory }) => {
    if (!weA) return { memory };
    const m = new Map<number, number>(memory as Map<number, number>);
    m.set(addrA as number, dataA as number);
    return { memory: m };
  },
});

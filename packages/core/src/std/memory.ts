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

// ============================================================================
// ROM init helpers
// ============================================================================
//
// Convenience builders that turn JS data (typed arrays, plain arrays, sparse
// entries) into the format accepted by `nodeArgs.<rom>.init`. Lets callers do:
//
//   import bytes from 'some-npm-package/data.json'
//   nodeArgs: { rom: { init: romFromBytes(bytes) } }
//
// Output is always a sparse Record<number, number>. Zero entries are omitted
// since ROM addresses default to 0 — keeps the IR small for sparse data and
// is functionally identical to a dense array for the consumer in
// simulator/sequential-init.ts.

/**
 * Build ROM init data from byte values.
 *
 * Each value is masked to 8 bits. Use for fonts, sprites, audio samples,
 * file blobs, or anything that fits in a Uint8Array.
 */
export function romFromBytes(bytes: Uint8Array | ArrayLike<number>): Record<number, number> {
  const out: Record<number, number> = {};
  for (let i = 0; i < bytes.length; i++) {
    const v = bytes[i] & 0xff;
    if (v !== 0) out[i] = v;
  }
  return out;
}

/**
 * Build ROM init data from words of arbitrary bit-width (1..32).
 *
 * Each word is masked to `width` bits. Use for instruction memories, wide
 * lookup tables, or any data wider than a byte.
 */
export function romFromWords(words: ArrayLike<number>, width: number): Record<number, number> {
  if (!Number.isInteger(width) || width < 1 || width > 32) {
    throw new Error(`ROM word width must be an integer in 1..32, got ${width}`);
  }
  const mask = width === 32 ? 0xffffffff : ((1 << width) - 1) >>> 0;
  const out: Record<number, number> = {};
  for (let i = 0; i < words.length; i++) {
    const v = ((words[i] >>> 0) & mask) >>> 0;
    if (v !== 0) out[i] = v;
  }
  return out;
}

/**
 * Build ROM init data from explicit [address, value] pairs.
 *
 * Use when data is naturally sparse (e.g. a few patched opcodes, scattered
 * lookup entries). Throws on negative or non-integer addresses.
 */
export function romFromEntries(
  entries: Iterable<readonly [number, number]>,
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [addr, value] of entries) {
    if (!Number.isInteger(addr) || addr < 0) {
      throw new Error(`ROM address must be a non-negative integer, got ${addr}`);
    }
    if (value !== 0) out[addr] = value;
  }
  return out;
}

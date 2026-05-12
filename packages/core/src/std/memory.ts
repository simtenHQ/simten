/**
 * Standard Library — Memory Components
 *
 * Uses mem() state with array-indexed eval/onTick for auto-synthesizable Verilog.
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus, mem } from '../circuit/bit-bus.js';

/**
 * Read-only memory with address decoding. 64K × 8-bit by default. Initialize
 * via the `memory` factory option using one of `romFromBytes` / `romFromWords`
 * / `romFromEntries`. Uninitialized addresses read as 0.
 *
 * **Input:** `addr` — `bus(16)`
 * **Output:** `data_out` — `bus(8)`
 *
 * **Example:** instruction-memory pattern
 * ```ts
 * circuit('CodeFetch', {
 *   inputs:  { pc: bus(16) },
 *   outputs: { instr: bus(8) },
 *   nodes:   { rom: ROM({ memory: romFromBytes([0x80, 0x12, 0x34]) }) },
 *   connect: ({ inputs, outputs, nodes: { rom } }) => [
 *     inputs.pc.to(rom.addr),
 *     rom.data_out.to(outputs.instr),
 *   ],
 * })
 * ```
 */
export const ROM = circuit('ROM', (_opts?: { memory?: Record<number, number> | number[]; baseAddress?: number }) => ({
  inputs: { addr: bus(16) },
  outputs: { data_out: bus(8) },
  state: { memory: mem(65536, 8) },
  meta: { category: 'memory', icon: '📀', description: 'Read-only memory with address decoding' },
  eval: ({ addr, memory }) => ({
    data_out: memory[addr],
  }),
  onTick: ({ memory }) => ({ memory }),
}));

/**
 * Random access memory. 256 × 8-bit synchronous read/write. Reads
 * combinationally from the current `addr`; writes the `data_in` value
 * back to `memory[addr]` on the clock tick when `we` is high.
 *
 * **Inputs:** `addr`, `data_in` — `bus(8)`; `we` (write-enable) — `bit`
 * **Output:** `data_out` — `bus(8)`
 *
 * **Example:** scratchpad memory
 * ```ts
 * circuit('Scratchpad', {
 *   inputs:  { address: bus(8), writeData: bus(8), writeEnable: bit },
 *   outputs: { readData: bus(8) },
 *   nodes:   { ram: RAM },
 *   connect: ({ inputs, outputs, nodes: { ram } }) => [
 *     inputs.address.to(ram.addr),
 *     inputs.writeData.to(ram.data_in),
 *     inputs.writeEnable.to(ram.we),
 *     ram.data_out.to(outputs.readData),
 *   ],
 * })
 * ```
 */
export const RAM = circuit('RAM', (_opts?: { memory?: Record<number, number> | number[] }) => ({
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
}));

/**
 * Dual-port RAM — two independent read ports plus one write port. Use port A
 * for read/write (`addrA` + `weA` + `dataA`) and port B for a simultaneous
 * independent read (`addrB`). Classic register-file shape.
 *
 * **Inputs:** `addrA`, `dataA`, `addrB` — `bus(8)`; `weA` — `bit`
 * **Outputs:** `outA`, `outB` — `bus(8)`
 *
 * **Example:** two-port register file
 * ```ts
 * circuit('RegFile', {
 *   inputs:  { rs1: bus(8), rs2: bus(8), rd: bus(8), wdata: bus(8), wen: bit },
 *   outputs: { val1: bus(8), val2: bus(8) },
 *   nodes:   { regs: DualPortRAM },
 *   connect: ({ inputs, outputs, nodes: { regs } }) => [
 *     inputs.rd.to(regs.addrA),
 *     inputs.wdata.to(regs.dataA),
 *     inputs.wen.to(regs.weA),
 *     inputs.rs1.to(regs.addrB), // read port for rs1
 *     regs.outA.to(outputs.val1),
 *     regs.outB.to(outputs.val2),
 *   ],
 * })
 * ```
 */
export const DualPortRAM = circuit('DualPortRAM', (_opts?: { memory?: Record<number, number> | number[] }) => ({
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
}));

// ============================================================================
// ROM init helpers
// ============================================================================
//
// Convenience builders that turn JS data (typed arrays, plain arrays, sparse
// entries) into the format accepted by `ROM({ memory: … })`. Lets callers do:
//
//   import bytes from 'some-npm-package/data.json'
//   nodes: { rom: ROM({ memory: romFromBytes(bytes) }) }
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

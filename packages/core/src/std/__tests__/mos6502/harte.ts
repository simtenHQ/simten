/**
 * Runs Tom Harte's SingleStepTests (github.com/SingleStepTests/65x02, 6502/v1)
 * against MOS6502_Core.
 *
 * Each case gives the CPU state and the RAM contents before one instruction,
 * every bus cycle the instruction makes (address, data, read or write), and
 * the state and RAM after it. The runner loads the starting state into the
 * core's registers, serves memory from the case's RAM one cycle per tick, and
 * compares every cycle and the final state.
 */

import { type BusCycle, type CpuState, createMachine } from './machine.js';

export interface HarteState extends CpuState {
  ram: [number, number][];
}

export interface HarteCase {
  name: string;
  initial: HarteState;
  final: HarteState;
  cycles: BusCycle[];
}

/** The documented NMOS 6502 opcodes. */
export const DOCUMENTED_OPCODES = [
  0x00, 0x01, 0x05, 0x06, 0x08, 0x09, 0x0a, 0x0d, 0x0e, 0x10, 0x11, 0x15, 0x16, 0x18, 0x19, 0x1d,
  0x1e, 0x20, 0x21, 0x24, 0x25, 0x26, 0x28, 0x29, 0x2a, 0x2c, 0x2d, 0x2e, 0x30, 0x31, 0x35, 0x36,
  0x38, 0x39, 0x3d, 0x3e, 0x40, 0x41, 0x45, 0x46, 0x48, 0x49, 0x4a, 0x4c, 0x4d, 0x4e, 0x50, 0x51,
  0x55, 0x56, 0x58, 0x59, 0x5d, 0x5e, 0x60, 0x61, 0x65, 0x66, 0x68, 0x69, 0x6a, 0x6c, 0x6d, 0x6e,
  0x70, 0x71, 0x75, 0x76, 0x78, 0x79, 0x7d, 0x7e, 0x81, 0x84, 0x85, 0x86, 0x88, 0x8a, 0x8c, 0x8d,
  0x8e, 0x90, 0x91, 0x94, 0x95, 0x96, 0x98, 0x99, 0x9a, 0x9d, 0xa0, 0xa1, 0xa2, 0xa4, 0xa5, 0xa6,
  0xa8, 0xa9, 0xaa, 0xac, 0xad, 0xae, 0xb0, 0xb1, 0xb4, 0xb5, 0xb6, 0xb8, 0xb9, 0xba, 0xbc, 0xbd,
  0xbe, 0xc0, 0xc1, 0xc4, 0xc5, 0xc6, 0xc8, 0xc9, 0xca, 0xcc, 0xcd, 0xce, 0xd0, 0xd1, 0xd5, 0xd6,
  0xd8, 0xd9, 0xdd, 0xde, 0xe0, 0xe1, 0xe4, 0xe5, 0xe6, 0xe8, 0xe9, 0xea, 0xec, 0xed, 0xee, 0xf0,
  0xf1, 0xf5, 0xf6, 0xf8, 0xf9, 0xfd, 0xfe,
];

const hex = (v: number, digits = 2) => `$${v.toString(16).padStart(digits, '0')}`;

/** A reusable runner: one machine, reloaded for every case. */
export function createHarteRunner() {
  const m = createMachine();

  /** Runs one case. Returns null on a match, or a description of the first mismatch. */
  function run(c: HarteCase): string | null {
    m.mem.fill(0);
    for (const [addr, value] of c.initial.ram) m.mem[addr] = value;
    m.load(c.initial);

    for (let i = 0; i < c.cycles.length; i++) {
      const [eAddr, eData, eKind] = c.cycles[i];
      const [addr, data, kind] = m.step();
      if (addr !== eAddr || data !== eData || kind !== eKind) {
        return `cycle ${i + 1}: got ${hex(addr, 4)} ${hex(data)} ${kind}, expected ${hex(eAddr, 4)} ${hex(eData)} ${eKind}`;
      }
    }

    const got = m.state();
    for (const reg of ['pc', 's', 'a', 'x', 'y', 'p'] as const) {
      if (got[reg] !== c.final[reg]) {
        const digits = reg === 'pc' ? 4 : 2;
        return `final ${reg}: got ${hex(got[reg], digits)}, expected ${hex(c.final[reg], digits)}`;
      }
    }
    for (const [addr, value] of c.final.ram) {
      if (m.mem[addr] !== value) {
        return `final ram ${hex(addr, 4)}: got ${hex(m.mem[addr])}, expected ${hex(value)}`;
      }
    }
    return null;
  }

  return { run };
}

#!/usr/bin/env tsx
/**
 * run-dut.ts — run one arch-test ELF on the UNCHANGED simten RV32I core and
 * print the signature region (the DUT side of the conformance diff).
 *
 * Usage: tsx run-dut.ts <elf> <begin_sig_hex> <end_sig_hex> <tohost_hex> [maxCycles]
 *
 * The DUT resets to PC=0x0, so the ELF passed here is the 0x0-based build
 * (link.ld). It loads ELF PT_LOAD segments by virtual address into a flat
 * IMEM ([0,0x10000)) and DMEM ([0x10000,0x50000)) — the same two-memory split
 * the core's production wrapper uses, just larger. Enlarging the sim memory is
 * netlist-neutral: the core is address-bare (no address mask lives in the
 * circuit), so this changes no hardware and `pnpm fpga:test` is unaffected.
 *
 * Halt: the test's RVMODEL_HALT stores to `tohost` then spins. We treat the
 * store to the tohost address as the done signal (drain a few cycles, then
 * read the signature). A hard cycle cap is the backstop.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { simulate } from '@simten/core/sim';
import { buildCPUCore } from '../index.js';

// Must match link.ld: IMEM 4M @ 0x0, DMEM 1M @ 0x400000. IMEM is large because
// branch/jump arch-tests emit megabytes of nop padding (jal-01 .text ~1.75MB).
const IMEM_BASE = 0x00000000;
const IMEM_END = 0x00400000; // 4M — abuts DMEM
const DMEM_BASE = 0x00400000;
const DMEM_END = 0x00500000; // 1M

const u32 = (n: number) => n >>> 0;

interface Loaded {
  imem: Uint8Array;
  dmem: Uint8Array;
  tohost: number | null;
}

/** Minimal ELF32 little-endian PT_LOAD loader. */
function loadElf(path: string, tohostAddr: number | null): Loaded {
  const b = readFileSync(path);
  if (!(b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46))
    throw new Error('not an ELF');
  if (b[4] !== 1 || b[5] !== 1) throw new Error('expected ELF32 little-endian');

  const phoff = b.readUInt32LE(0x1c);
  const phentsize = b.readUInt16LE(0x2a);
  const phnum = b.readUInt16LE(0x2c);

  const imem = new Uint8Array(IMEM_END - IMEM_BASE);
  const dmem = new Uint8Array(DMEM_END - DMEM_BASE);

  const place = (vaddr: number, byte: number) => {
    if (vaddr >= IMEM_BASE && vaddr < IMEM_END) imem[vaddr - IMEM_BASE] = byte;
    else if (vaddr >= DMEM_BASE && vaddr < DMEM_END) dmem[vaddr - DMEM_BASE] = byte;
    else throw new Error(`segment byte at 0x${vaddr.toString(16)} outside IMEM/DMEM`);
  };

  for (let i = 0; i < phnum; i++) {
    const off = phoff + i * phentsize;
    const ptype = b.readUInt32LE(off);
    if (ptype !== 1) continue; // PT_LOAD
    const poff = b.readUInt32LE(off + 4);
    const pvaddr = b.readUInt32LE(off + 8);
    const pfilesz = b.readUInt32LE(off + 16);
    for (let j = 0; j < pfilesz; j++) place(pvaddr + j, b[poff + j]);
  }
  return { imem, dmem, tohost: tohostAddr };
}

function fetchWord(mem: Uint8Array, base: number, addr: number): number {
  const o = addr - base;
  return u32(mem[o] | (mem[o + 1] << 8) | (mem[o + 2] << 16) | (mem[o + 3] << 24));
}

export function runDut(
  elf: string,
  beginSig: number,
  endSig: number,
  tohostAddr: number,
  maxCycles = 200000,
  mutate?: (imem: Uint8Array) => void,
): string[] {
  const { imem, dmem } = loadElf(elf, tohostAddr);
  if (mutate) mutate(imem); // fault injection: perturb the DUT's instruction memory

  const { built } = buildCPUCore();
  const cpu = simulate(built);
  cpu.set({ instruction: 0, data_read: 0 });

  let haltCountdown = -1;

  for (let cycle = 0; cycle < maxCycles; cycle++) {
    const instrAddr = u32(cpu.get('instr_addr'));
    const dataAddr = u32(cpu.get('data_addr'));
    const memWrite = cpu.get('data_mem_write') as unknown as number;
    const dataWrite = u32(cpu.get('data_write'));
    const funct3 = (cpu.get('data_funct3') as unknown as number) & 0x7;

    // Instruction fetch from IMEM.
    const instr = instrAddr < IMEM_END ? fetchWord(imem, IMEM_BASE, instrAddr) : 0;

    // Data read (loads): DMEM aligned word, or IMEM-region rodata.
    let dataRead = 0;
    if (dataAddr >= DMEM_BASE && dataAddr < DMEM_END) {
      dataRead = fetchWord(dmem, DMEM_BASE, dataAddr & ~3);
    } else if (dataAddr < IMEM_END) {
      dataRead = fetchWord(imem, IMEM_BASE, dataAddr & ~3);
    }

    // Data write (stores) into DMEM, byte-lane by funct3 (SB/SH/SW).
    if (memWrite && dataAddr >= DMEM_BASE && dataAddr < DMEM_END) {
      const o = dataAddr - DMEM_BASE;
      dmem[o] = dataWrite & 0xff;
      if (funct3 >= 1) dmem[o + 1] = (dataWrite >> 8) & 0xff;
      if (funct3 >= 2) {
        dmem[o + 2] = (dataWrite >> 16) & 0xff;
        dmem[o + 3] = (dataWrite >> 24) & 0xff;
      }
    }

    // Halt detection: RVMODEL_HALT stores to `tohost` then spins (sw; j ...).
    // The store to tohost is the done signal (mirrors Spike's HTIF). Drain a
    // few cycles so any in-flight signature store retires, then stop.
    if (memWrite && dataAddr === tohostAddr && haltCountdown < 0) haltCountdown = 8;
    if (haltCountdown >= 0 && haltCountdown-- === 0) break;

    cpu.set({ instruction: instr, data_read: dataRead });
    cpu.tick();
  }

  // Dump signature region as 4-byte LE lowercase hex words.
  const out: string[] = [];
  for (let a = beginSig; a < endSig; a += 4) {
    out.push(fetchWord(dmem, DMEM_BASE, a).toString(16).padStart(8, '0'));
  }
  cpu.dispose();
  return out;
}

// CLI entry — only when invoked directly (not when imported by run-suite.ts).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [elf, beginHex, endHex, tohostHex, cyclesArg] = process.argv.slice(2);
  if (!elf || !beginHex || !endHex || !tohostHex) {
    console.error(
      'usage: tsx run-dut.ts <elf> <begin_sig_hex> <end_sig_hex> <tohost_hex> [maxCycles]',
    );
    process.exit(2);
  }
  const sig = runDut(
    elf,
    parseInt(beginHex, 16),
    parseInt(endHex, 16),
    parseInt(tohostHex, 16),
    cyclesArg ? Number(cyclesArg) : 200000,
  );
  process.stdout.write(sig.join('\n') + '\n');
}

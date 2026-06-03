#!/usr/bin/env tsx
/**
 * RTL simulation of RV32I CPU with raw5/raw7 firmware.
 *
 * Reproduces the hardware bug: instruction immediately after a NOT-TAKEN
 * conditional branch is being skipped.
 *
 * raw5: beqz a6 (NOT taken, a6=1) → li a4, 65 → ... → sw a4, 0(a5)
 *   Expected: sw writes 0x41 (65)
 *   Bug:      sw writes 0x00 (li a4 was flushed)
 *
 * raw7: beqz a6 (NOT taken) → sw a4, 0(a5) immediately after
 *   Expected: sw fires
 *   Bug:      sw is skipped entirely
 *
 * The CPU circuit itself is defined once in `./index.ts` (the production
 * build path). This script imports `buildCPUCore` from there to avoid
 * duplicating ~200 lines of node wiring.
 */

import { simulate } from '@simten/core/sim';
import { buildCPUCore } from './index.js';
import { fileURLToPath } from 'node:url';

// ── raw5 firmware ─────────────────────────────────────────────────────────────
// lui a5, 0x80000
// lw a6, 0(a5)        ; load uart_ready → a6
// nop×5
// beqz a6, -24        ; if a6==0, loop back to lw
// li a4, 65           ; ← THIS should execute when a6=1 (beqz NOT taken)
// nop×5
// sw a4, 0(a5)        ; write 'A' to UART
// (delay loop, j 0x00)
const RAW5: number[] = [
  0x800007b7, // [0x00] lui  a5, 0x80000
  0x0007a803, // [0x04] lw   a6, 0(a5)
  0x00000013, // [0x08] nop
  0x00000013, // [0x0C] nop
  0x00000013, // [0x10] nop
  0x00000013, // [0x14] nop
  0x00000013, // [0x18] nop
  0xfe0804e3, // [0x1C] beqz a6, -24 (→ 0x04)
  0x04100713, // [0x20] li   a4, 65  ← must execute when beqz not taken
  0x00000013, // [0x24] nop
  0x00000013, // [0x28] nop
  0x00000013, // [0x2C] nop
  0x00000013, // [0x30] nop
  0x00000013, // [0x34] nop
  0x00e7a023, // [0x38] sw   a4, 0(a5)
  0x000402b7, // [0x3C] lui  t0, 0x40
  0xfff28293, // [0x40] addi t0, t0, -1
  0xfe029ee3, // [0x44] bne  t0, x0, -4
  0xfb9ff06f, // [0x48] j    0x00
];

// ── raw7 firmware ─────────────────────────────────────────────────────────────
// Like raw5 but li a4 is done BEFORE the poll loop.
// sw a4, 0(a5) is immediately after beqz (no NOPs between).
// If sw fires, we see a UART write; if flushed, nothing.
const RAW7: number[] = [
  0x800007b7, // [0x00] lui  a5, 0x80000
  0x04100713, // [0x04] li   a4, 65
  0x00000013, // [0x08] nop
  0x00000013, // [0x0C] nop
  0x00000013, // [0x10] nop
  0x00000013, // [0x14] nop
  0x0007a803, // [0x18] lw   a6, 0(a5)
  0x00000013, // [0x1C] nop
  0x00000013, // [0x20] nop
  0x00000013, // [0x24] nop
  0x00000013, // [0x28] nop
  0x00000013, // [0x2C] nop
  0xfe0804e3, // [0x30] beqz a6, -24 (→ 0x18)
  0x00e7a023, // [0x34] sw   a4, 0(a5)  ← immediately after beqz
  0x000402b7, // [0x38] lui  t0, 0x40
  0xfff28293, // [0x3C] addi t0, t0, -1
  0xfe029ee3, // [0x40] bne  t0, x0, -4
  0xfbdff06f, // [0x44] j    0x00
];

// ── Simulation harness ────────────────────────────────────────────────────────

const UART_ADDR = 0x80000000;

function toU32(n: number): number {
  return n >>> 0;
}

const IMEM_BASE = 0x00000000;
const DMEM_BASE = 0x00010000;
const DMEM_SIZE = 0x1000; // 4KB

// The CPU core embeds its own RV32I_LoadAlignFull on the load path, so the
// memory model here must return the raw aligned 32-bit word — matching the
// iverilog testbench (verify.ts). Earlier this code pre-aligned via a local
// loadAlign() helper, which silently double-aligned LBU/LH loads (the byte
// got shifted into the LSB twice for byte_offset > 0, blanking it out).
// The "LBU all byte offsets" suite test exposed this once the upstream
// sentinel bug was fixed and execution actually reached the second LBU.

export function runFirmware(imem: number[], maxCycles = 200): number[] {
  const { built } = buildCPUCore();
  const cpu = simulate(built);
  const dmem = new Uint8Array(DMEM_SIZE);
  cpu.set({ instruction: 0, data_read: 0 });

  const uartBytes: number[] = [];

  for (let cycle = 0; cycle < maxCycles; cycle++) {
    const instrAddr = toU32(cpu.get('instr_addr'));
    const dataAddr  = toU32(cpu.get('data_addr'));
    const memWrite  = cpu.get('data_mem_write') as unknown as number;
    const dataWrite = toU32(cpu.get('data_write'));
    const funct3    = cpu.get('data_funct3') as unknown as number;

    const wordIdx = (instrAddr >>> 2) & 0x1ff;
    const instr = imem[wordIdx] ?? 0;

    let dataRead = 0;
    if (toU32(dataAddr) === UART_ADDR) {
      dataRead = 1;
    } else if (dataAddr >= DMEM_BASE && dataAddr < DMEM_BASE + DMEM_SIZE) {
      const alignedOff = (dataAddr - DMEM_BASE) & ~3;
      dataRead = (dmem[alignedOff] | (dmem[alignedOff+1] << 8) | (dmem[alignedOff+2] << 16) | (dmem[alignedOff+3] << 24)) >>> 0;
    } else if (dataAddr < 0x800) {
      const wi = (dataAddr >>> 2) & 0x1ff;
      dataRead = (imem[wi] ?? 0) >>> 0;
    }
    void funct3;  // CPU's LoadAlignFull uses funct3 internally; we just pass the raw word.

    if (memWrite && dataAddr >= DMEM_BASE && dataAddr < DMEM_BASE + DMEM_SIZE) {
      const off = dataAddr - DMEM_BASE;
      const f3 = funct3 & 0x7;
      if (f3 === 0) {
        dmem[off] = dataWrite & 0xFF;
      } else if (f3 === 1) {
        dmem[off]   = dataWrite & 0xFF;
        dmem[off+1] = (dataWrite >> 8) & 0xFF;
      } else {
        dmem[off]   = dataWrite & 0xFF;
        dmem[off+1] = (dataWrite >> 8)  & 0xFF;
        dmem[off+2] = (dataWrite >> 16) & 0xFF;
        dmem[off+3] = (dataWrite >> 24) & 0xFF;
      }
    }

    if (memWrite && toU32(dataAddr) === UART_ADDR) {
      uartBytes.push(dataWrite & 0xff);
    }

    cpu.set({ instruction: instr, data_read: dataRead });
    cpu.tick();
  }

  cpu.dispose();
  return uartBytes;
}

function runSim(name: string, imem: number[], maxCycles = 200): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Simulating: ${name}`);
  console.log('='.repeat(60));

  const { built } = buildCPUCore();
  const cpu = simulate(built);
  const dmem = new Uint8Array(DMEM_SIZE);
  cpu.set({ instruction: 0, data_read: 0 });

  let uartWrites: { cycle: number; byte: number }[] = [];

  for (let cycle = 0; cycle < maxCycles; cycle++) {
    const instrAddr = toU32(cpu.get('instr_addr'));
    const dataAddr  = toU32(cpu.get('data_addr'));
    const memRead   = cpu.get('data_mem_read') as unknown as number;
    const memWrite  = cpu.get('data_mem_write') as unknown as number;
    const dataWrite = toU32(cpu.get('data_write'));
    const funct3    = cpu.get('data_funct3') as unknown as number;

    const wordIdx = (instrAddr >>> 2) & 0x1ff;
    const instr = imem[wordIdx] ?? 0;

    let dataRead = 0;
    if (toU32(dataAddr) === UART_ADDR) {
      dataRead = 1;
    } else if (dataAddr >= DMEM_BASE && dataAddr < DMEM_BASE + DMEM_SIZE) {
      const alignedOff = (dataAddr - DMEM_BASE) & ~3;
      dataRead = (dmem[alignedOff] | (dmem[alignedOff+1] << 8) | (dmem[alignedOff+2] << 16) | (dmem[alignedOff+3] << 24)) >>> 0;
    } else if (dataAddr < 0x800) {
      const wi = (dataAddr >>> 2) & 0x1ff;
      dataRead = (imem[wi] ?? 0) >>> 0;
    }
    // Raw word out — CPU's LoadAlignFull handles byte/halfword selection.

    if (memWrite && dataAddr >= DMEM_BASE && dataAddr < DMEM_BASE + DMEM_SIZE) {
      const off = dataAddr - DMEM_BASE;
      const f3 = funct3 & 0x7;
      if (f3 === 0) {
        dmem[off] = dataWrite & 0xFF;
      } else if (f3 === 1) {
        dmem[off]   = dataWrite & 0xFF;
        dmem[off+1] = (dataWrite >> 8) & 0xFF;
      } else {
        dmem[off]   = dataWrite & 0xFF;
        dmem[off+1] = (dataWrite >> 8)  & 0xFF;
        dmem[off+2] = (dataWrite >> 16) & 0xFF;
        dmem[off+3] = (dataWrite >> 24) & 0xFF;
      }
    }

    if (memWrite && toU32(dataAddr) === UART_ADDR) {
      console.log(`  [cycle ${cycle}] UART WRITE: 0x${(dataWrite & 0xff).toString(16).padStart(2,'0')} ('${String.fromCharCode(dataWrite & 0xff)}')`);
      uartWrites.push({ cycle, byte: dataWrite & 0xff });
    }

    const h = (v: number) => '0x' + v.toString(16).padStart(8, '0');
    if (cycle < 80) {
      console.log(`  [${cycle}] PC=${h(instrAddr)} instr=${h(instr)} data_addr=${h(dataAddr)} mem_r=${memRead} mem_w=${memWrite} data_write=${h(dataWrite & 0xff)} data_read=${h(dataRead)}`);
    }

    cpu.set({ instruction: instr, data_read: dataRead });
    cpu.tick();
  }

  console.log(`\nResult: ${uartWrites.length} UART write(s)`);
  if (uartWrites.length > 0) {
    for (const w of uartWrites.slice(0, 5)) {
      console.log(`  cycle ${w.cycle}: 0x${w.byte.toString(16).padStart(2,'0')} (${w.byte === 65 ? 'CORRECT' : 'WRONG - expected 65'})`);
    }
  } else {
    console.log('  (no UART writes — sw was skipped)');
  }

  cpu.dispose();
}

// ── raw36 firmware ────────────────────────────────────────────────────────────
// Simplified: addi a4=65, lui a4=UART (overwrites), poll, reload a4=65, send.
const RAW36: number[] = [
  0x00010437, // [0x00] lui  s0, 0x10           s0 = 0x10000
  0x04100713, // [0x04] addi a4, x0, 65         a4 = 'A'
  0x00e42023, // [0x08] sw   a4, 0(s0)          dmem[0x10000] = 'A'
  0x00000013, // [0x0C] nop
  0x00000013, // [0x10] nop
  0x00000013, // [0x14] nop
  0x00000013, // [0x18] nop
  0x00000013, // [0x1C] nop
  0x00042783, // [0x20] lw   a5, 0(s0)          a5 = 65  ← load
  0x00f00733, // [0x24] add  a4, x0, a5         a4 = a5  (a5 is rs2! load-use hazard)
  0x00000013, // [0x28] nop
  0x00000013, // [0x2C] nop
  0x00000013, // [0x30] nop
  0x800007b7, // [0x34] lui  a5, 0x80000        a5 = UART
  0x0007a283, // [0x38] lw   t0, 0(a5)          poll
  0x0012f293, // [0x3C] andi t0, t0, 1
  0xfe028ae3, // [0x40] beqz t0, -12             → 0x34
  0x00e7a023, // [0x44] sw   a4, 0(a5)          send a4
  0x000402b7, // [0x48] lui  t0, 0x40           delay
  0xfff28293, // [0x4C] addi t0, t0, -1
  0xfe029ee3, // [0x50] bne  t0, x0, -4         → 0x4C
  0xfcdff06f, // [0x54] j    0x20               loop back to lw
];

// ── raw34 firmware ────────────────────────────────────────────────────────────
// raw31 with lui s0 instead of auipc chain. Loop prints ABCDE from DMEM.
// NOTE: sim has no DMEM model so lw returns 0, but control flow is still traceable.
const RAW34: number[] = [
  0x00011437, // [0x00] lui  s0, 0x11            s0 = 0x11000
  0xfe042623, // [0x04] sw   zero, -20(s0)        i = 0  ← reset
  0x03c0006f, // [0x08] j    0x44                 jump to loop check
  // loop body @ 0x0C
  0xfec42783, // [0x0C] lw   a5, -20(s0)          a5 = i
  0x04178713, // [0x10] addi a4, a5, 65            a4 = 'A'+i
  0xfee405a3, // [0x14] sb   a4, -21(s0)           store c
  0x00000013, // [0x18] nop
  // poll
  0x800007b7, // [0x1C] lui  a5, 0x80000
  0x0007a783, // [0x20] lw   a5, 0(a5)
  0x0017f793, // [0x24] andi a5, a5, 1
  0xfe078ae3, // [0x28] beqz a5, -12               → 0x1C
  0x800007b7, // [0x2C] lui  a5, 0x80000
  0xfeb44703, // [0x30] lbu  a4, -21(s0)           reload c
  0x00e7a023, // [0x34] sw   a4, 0(a5)             send
  // i++
  0xfec42783, // [0x38] lw   a5, -20(s0)
  0x00178793, // [0x3C] addi a5, a5, 1
  0xfef42623, // [0x40] sw   a5, -20(s0)
  // loop check @ 0x44
  0xfec42703, // [0x44] lw   a4, -20(s0)           ← j lands here
  0x00400793, // [0x48] addi a5, x0, 4             limit = 4
  0xfce7d0e3, // [0x4C] bge  a5, a4, -64           → 0x0C if 4>=i
  0xfb5ff06f, // [0x50] j    0x04                  reset
];

// ── Main ──────────────────────────────────────────────────────────────────────

// Only run CLI when invoked directly (not when imported from cpu_tests.ts)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === '--raw7') {
    runSim('raw7 (li before poll, sw immediately after beqz)', RAW7, 300);
  } else if (mode === '--raw36') {
    runSim('raw36 (rs2 load-use hazard)', RAW36, 300);
  } else if (mode === '--raw34') {
    runSim('raw34 (lui s0 + loop, DMEM not modeled → expect 0x41 writes)', RAW34, 500);
  } else {
    runSim('raw5 (polling: beqz NOT taken → li a4,65 → sw)', RAW5, 300);
  }
}

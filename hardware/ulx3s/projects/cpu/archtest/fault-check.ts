#!/usr/bin/env tsx
/**
 * fault-check.ts — proves the conformance harness can actually FAIL.
 *
 * Compiles add-01, gets the Spike reference, then runs the DUT with one real
 * `add` instruction flipped to `sub` (set funct7 bit 30) in its instruction
 * memory. The corrupted result flows through the core's real ALU + pipeline
 * into the signature, which must then DIVERGE from Spike. If it still matches,
 * the harness is blind and we exit non-zero.
 *
 * This is distinct from the env-macro blind spot (which fault injection does
 * NOT cover): it shows a wrong datapath result is caught, not that the shared
 * boot/halt macros are independently verified.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDut } from './run-dut.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = resolve(HERE, 'build');
mkdirSync(BUILD, { recursive: true });
const GCC_BIN = process.env.ARCHTEST_GCC_BIN ??
  `${process.env.HOME}/Library/xPacks/@xpack-dev-tools/riscv-none-elf-gcc/13.2.0-2.1/.content/bin`;
const GCC = `${GCC_BIN}/riscv-none-elf-gcc`;
const NM = `${GCC_BIN}/riscv-none-elf-nm`;
const SPIKE = process.env.SPIKE ?? 'spike';
const GFLAGS = ['-march=rv32i', '-mabi=ilp32', '-static', '-nostdlib', '-nostartfiles',
  '-DXLEN=32', '-I', HERE, '-I', resolve(HERE, 'vendor/env')];

const src = resolve(HERE, 'vendor/rv32i_m/I/src/add-01.S');
const dutElf = resolve(BUILD, 'fault.elf');
const spkElf = resolve(BUILD, 'fault.spike.elf');
const spkSig = resolve(BUILD, 'fault.spike.sig');
const spikeLd = resolve(BUILD, 'link.spike.ld');
writeFileSync(spikeLd, readFileSync(resolve(HERE, 'link.ld'), 'utf8')
  .replace('ORIGIN = 0x00000000', 'ORIGIN = 0x80000000')
  .replace('ORIGIN = 0x00400000', 'ORIGIN = 0x80400000'));

execFileSync(GCC, [...GFLAGS, '-T', resolve(HERE, 'link.ld'), src, '-o', dutElf]);
execFileSync(GCC, [...GFLAGS, '-T', spikeLd, src, '-o', spkElf]);
execFileSync(SPIKE, ['--isa=rv32i', '-m0x80000000:0x500000', `+signature=${spkSig}`, '+signature-granularity=4', spkElf]);
const ref = readFileSync(spkSig, 'utf8').trim().split('\n').map((s) => s.trim());

const sym = (name: string): number => {
  const line = execFileSync(NM, [dutElf]).toString().split('\n').find((l) => l.split(/\s+/)[2] === name);
  if (!line) throw new Error(`symbol ${name} not found`);
  return parseInt(line.split(/\s+/)[0], 16);
};

// Flip the first R-type ADD (opcode 0x33, funct3 0, funct7 0) into SUB.
let flipped = false;
const injectSubForAdd = (imem: Uint8Array) => {
  for (let i = 0; i + 3 < imem.length; i += 4) {
    const w = (imem[i] | (imem[i + 1] << 8) | (imem[i + 2] << 16) | (imem[i + 3] << 24)) >>> 0;
    if ((w & 0x7f) === 0x33 && ((w >>> 12) & 7) === 0 && ((w >>> 25) & 0x7f) === 0) {
      const bug = (w | 0x40000000) >>> 0; // set funct7 bit 30 → SUB
      imem[i] = bug & 0xff; imem[i + 1] = (bug >>> 8) & 0xff;
      imem[i + 2] = (bug >>> 16) & 0xff; imem[i + 3] = (bug >>> 24) & 0xff;
      flipped = true;
      console.log(`injected: add→sub at IMEM byte 0x${i.toString(16)} (0x${w.toString(16)} → 0x${bug.toString(16)})`);
      return;
    }
  }
};

const dut = runDut(dutElf, sym('begin_signature'), sym('end_signature'), sym('tohost'), 200000, injectSubForAdd);
if (!flipped) { console.error('❌ no ADD found to corrupt — check failed to inject'); process.exit(1); }

const diverged = dut.length !== ref.length || dut.some((w, i) => w !== ref[i]);
if (diverged) {
  const at = dut.findIndex((w, i) => w !== ref[i]);
  console.log(`✅ harness is valid: injected add→sub DIVERGES from Spike (first at word ${at}: dut ${dut[at]} vs spike ${ref[at]})`);
  process.exit(0);
} else {
  console.error('❌ harness is BLIND: a corrupted ADD still matched Spike');
  process.exit(1);
}

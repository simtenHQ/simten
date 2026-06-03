/**
 * suite-lib.ts — shared engine for the RV32I-I arch-test conformance harness.
 *
 * `runOneTest(t)` compiles one test twice (DUT @0x0 + Spike @0x80000000 from the
 * same .S), checks it's trap-free, runs Spike for the reference signature, runs
 * the unchanged simten core, and diffs. Used by both the CLI (run-suite.ts) and
 * the Tier-A testbench (conformance.verify.ts).
 *
 * Tools: riscv-none-elf-gcc/nm/objdump (local xPack; override dir via
 * ARCHTEST_GCC_BIN) + spike (PATH; override via SPIKE). DUT runs the 0x0 ELF
 * (its reset vector); Spike runs the 0x80000000 copy (it reserves [0,0x1000)).
 * Signatures match by arch-test's position-independence.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDut } from './run-dut.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENVDIR = resolve(HERE, 'vendor/env');
const SRC = resolve(HERE, 'vendor/rv32i_m/I/src');
export const BUILD = resolve(HERE, 'build');

const GCC_BIN = process.env.ARCHTEST_GCC_BIN ??
  `${process.env.HOME}/Library/xPacks/@xpack-dev-tools/riscv-none-elf-gcc/15.2.0-1.1/.content/bin`;
const GCC = `${GCC_BIN}/riscv-none-elf-gcc`;
const NM = `${GCC_BIN}/riscv-none-elf-nm`;
const OBJDUMP = `${GCC_BIN}/riscv-none-elf-objdump`;
const SPIKE = process.env.SPIKE ?? 'spike';
const GFLAGS = ['-march=rv32i', '-mabi=ilp32', '-static', '-nostdlib',
  '-nostartfiles', '-DXLEN=32', '-I', HERE, '-I', ENVDIR];
const BIGBUF = { maxBuffer: 1 << 30 }; // branch/jal disassembly is tens of MB

export const TESTS = [
  'add-01', 'addi-01', 'and-01', 'andi-01', 'auipc-01', 'beq-01', 'bge-01',
  'bgeu-01', 'blt-01', 'bltu-01', 'bne-01', 'fence-01', 'jal-01', 'jalr-01',
  'lb-align-01', 'lbu-align-01', 'lh-align-01', 'lhu-align-01', 'lui-01',
  'lw-align-01', 'or-01', 'ori-01', 'sb-align-01', 'sh-align-01', 'sll-01',
  'slli-01', 'slt-01', 'slti-01', 'sltiu-01', 'sltu-01', 'sra-01', 'srai-01',
  'srl-01', 'srli-01', 'sub-01', 'sw-align-01', 'xor-01', 'xori-01',
];

// Tests we cannot assemble with the local toolchain (logged, never silently
// dropped). jalr-01 inst_7 uses rd=x0 → the macro emits `la x0, 5b`, which
// binutils 2.45 rejects (newer gas disallows la/li to x0). Toolchain vintage,
// NOT a DUT failure.
export const SKIP: Record<string, string> = {
  'jalr-01': 'binutils 2.45 rejects `la x0,5b` (inst_7 rd=x0); toolchain vintage, not a DUT failure',
};

let spikeLdReady = false;
function spikeLd(): string {
  const p = resolve(BUILD, 'link.spike.ld');
  if (!spikeLdReady) {
    mkdirSync(BUILD, { recursive: true });
    writeFileSync(p, readFileSync(resolve(HERE, 'link.ld'), 'utf8')
      .replace('ORIGIN = 0x00000000', 'ORIGIN = 0x80000000')
      .replace('ORIGIN = 0x00400000', 'ORIGIN = 0x80400000'));
    spikeLdReady = true;
  }
  return p;
}

const sym = (elf: string, name: string): number => {
  const line = execFileSync(NM, [elf]).toString().split('\n').find((l) => l.split(/\s+/)[2] === name);
  if (!line) throw new Error(`symbol ${name} not found in ${elf}`);
  return parseInt(line.split(/\s+/)[0], 16);
};
const trapOps = (elf: string): number =>
  (execFileSync(OBJDUMP, ['-d', elf], BIGBUF).toString()
    .match(/\t(csrr?[wsci]?|ecall|ebreak|mret|sret|wfi)\b/g) ?? []).length;

export interface Result { test: string; pass: boolean; trapFree: boolean; skipped: boolean; note: string }

export function runOneTest(t: string): Result {
  if (SKIP[t]) return { test: t, pass: false, trapFree: false, skipped: true, note: SKIP[t] };
  mkdirSync(BUILD, { recursive: true });
  const dutElf = resolve(BUILD, `${t}.elf`);
  const spkElf = resolve(BUILD, `${t}.spike.elf`);
  const spkSig = resolve(BUILD, `${t}.spike.sig`);
  try {
    execFileSync(GCC, [...GFLAGS, '-T', resolve(HERE, 'link.ld'), `${SRC}/${t}.S`, '-o', dutElf]);
    execFileSync(GCC, [...GFLAGS, '-T', spikeLd(), `${SRC}/${t}.S`, '-o', spkElf]);

    const traps = trapOps(dutElf);
    execFileSync(SPIKE, ['--isa=rv32i', '-m0x80000000:0x500000',
      `+signature=${spkSig}`, '+signature-granularity=4', spkElf]);
    const ref = readFileSync(spkSig, 'utf8').trim().split('\n').map((s) => s.trim());
    const dut = runDut(dutElf, sym(dutElf, 'begin_signature'), sym(dutElf, 'end_signature'), sym(dutElf, 'tohost'));

    const lenOk = dut.length === ref.length;
    const eq = lenOk && dut.every((w, i) => w === ref[i]);
    const at = lenOk ? dut.findIndex((w, i) => w !== ref[i]) : -1;
    return {
      test: t, pass: eq, trapFree: traps === 0, skipped: false,
      note: eq ? `${dut.length} words`
        : !lenOk ? `len ${dut.length} vs ${ref.length}`
          : `word ${at}: dut ${dut[at]} vs spike ${ref[at]}`,
    };
  } catch (e) {
    return { test: t, pass: false, trapFree: false, skipped: false, note: `ERROR: ${(e as Error).message.split('\n')[0]}` };
  }
}

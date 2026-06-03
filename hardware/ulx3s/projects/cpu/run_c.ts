#!/usr/bin/env bun
/**
 * Run a compiled C (or Rust) firmware through the TypeScript RTL simulator.
 * Uses the same CPU circuit as cpu_tests.ts — if this produces "Hello, World!\r\n"
 * in sim but the FPGA doesn't, the bug is downstream (Verilog export, wrapper, synth).
 *
 * Usage: bun hardware/ulx3s/cpu_run_c.ts [path/to/firmware.hex]
 *        (default: ./firmware.hex)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runFirmware } from './sim.js';

// Run `pnpm --filter @simten/compiler dev` first, or override with COMPILER_URL.
const COMPILER_URL = process.env.COMPILER_URL ?? 'http://localhost:55001/compile';

const LINKER_SCRIPT = `
OUTPUT_ARCH(riscv)
ENTRY(_start)
MEMORY {
    IMEM (rx)  : ORIGIN = 0x00000000, LENGTH = 2K
    DMEM (rwx) : ORIGIN = 0x00010000, LENGTH = 4K
}
SECTIONS {
    .text : {
        *(.text._start)
        *(.text*)
        *(.rodata*)
    } > IMEM
    .data : { *(.data*) } > DMEM
    .bss : {
        __bss_start = .;
        *(.bss*)
        *(COMMON)
        __bss_end = .;
    } > DMEM
    __stack_top = ORIGIN(DMEM) + LENGTH(DMEM);
}
`;

async function compileC(source: string): Promise<number[]> {
  console.log('Compiling hello.c via compiler service...');
  const resp = await fetch(COMPILER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, language: 'c', linkerScript: LINKER_SCRIPT, disassemble: true }),
  }).then(r => r.json()) as { success: boolean; binary?: string; disassembly?: string; error?: string; stderr?: string };

  if (!resp.success || !resp.binary) {
    console.error('Compile failed:', resp.error ?? resp.stderr);
    process.exit(1);
  }

  if (resp.disassembly && process.env.DISASM) {
    console.log('\n--- Disassembly ---');
    console.log(resp.disassembly);
    console.log('---');
  }

  const bin = Uint8Array.from(atob(resp.binary), c => c.charCodeAt(0));
  const words: number[] = [];
  const padded = new Uint8Array(512 * 4);
  padded.set(bin.slice(0, Math.min(bin.length, 512 * 4)));
  for (let i = 0; i < 512; i++) {
    words.push(((padded[i*4+3] << 24) | (padded[i*4+2] << 16) | (padded[i*4+1] << 8) | padded[i*4]) >>> 0);
  }
  console.log(`  Compiled: ${bin.length} bytes`);
  return words;
}

const arg = process.argv[2];
let words: number[];

if (arg?.endsWith('.c')) {
  const src = readFileSync(resolve(arg), 'utf8');
  words = await compileC(src);
} else if (arg?.endsWith('.hex')) {
  const hex = readFileSync(resolve(arg), 'utf8');
  words = hex.split('\n').map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('//') && !l.startsWith('@'))
    .map(l => parseInt(l, 16) >>> 0);
} else {
  // Default: compile hello.c
  const src = readFileSync(resolve(import.meta.dirname, 'firmware/hello.c'), 'utf8');
  words = await compileC(src);
}

console.log(`  ${words.length} words (${words.length * 4} bytes)`);

const nonZero = words.filter(w => w !== 0).length;
console.log(`  ${nonZero} non-zero words (firmware size: ~${nonZero * 4} bytes)`);

const maxCycles = parseInt(process.env.MAX_CYCLES ?? '50000', 10);
console.log(`Running for up to ${maxCycles} cycles...\n`);

const start = Date.now();
const uartBytes = runFirmware(words, maxCycles);
const elapsed = Date.now() - start;

const asString = uartBytes.map(b =>
  b === 0x0a ? '\\n' : b === 0x0d ? '\\r' : b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : `\\x${b.toString(16).padStart(2,'0')}`
).join('');

console.log(`\n─── UART output (${uartBytes.length} bytes in ${elapsed}ms) ───`);
console.log(asString);
console.log('───────────────────────────────────────────────');

// Compare against expected for hello.c
const expected = 'Hello, World!\r\n';
const actualStr = uartBytes.map(b => String.fromCharCode(b)).join('');
const firstMatch = actualStr.indexOf(expected);

if (firstMatch >= 0) {
  console.log(`\n✓ Found "Hello, World!\\r\\n" at byte offset ${firstMatch}`);
  if (actualStr.startsWith(expected)) {
    console.log('✓ Output starts cleanly with expected string');
  }
  process.exit(0);
} else if (uartBytes.length === 0) {
  console.log('\n✗ No UART output — firmware likely hung at startup');
  process.exit(1);
} else {
  console.log(`\n✗ Expected "${expected.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}" not found in output`);
  console.log('  First 15 bytes as hex:', uartBytes.slice(0, 15).map(b => '0x' + b.toString(16).padStart(2,'0')).join(' '));
  process.exit(1);
}

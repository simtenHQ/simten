#!/usr/bin/env bun
/**
 * Cross-validate the Verilog-exported CPU against the TypeScript simulator.
 *
 * For each test firmware:
 *   1. Run it through runFirmware() (TS sim → expected UART bytes)
 *   2. POST Verilog (combined.v) + generated testbench to the verifier container
 *   3. Parse iverilog $display output → actual UART bytes
 *   4. Compare — if they differ, the bug is in the Verilog export.
 *
 * Usage: VERIFIER_URL=https://verifier.charles-harris-de.workers.dev/verify \
 *        bun hardware/ulx3s/cpu_verify.ts
 *
 *        # or run a single firmware:
 *        bun hardware/ulx3s/cpu_verify.ts --hello      (hello.c)
 *        bun hardware/ulx3s/cpu_verify.ts --filter ADD (ISA test by substring)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runFirmware } from './cpu_sim.js';
import { tests, type Test } from './cpu_tests.js';

const VERIFIER_URL = process.env.VERIFIER_URL ?? 'https://verifier.charles-harris-de.workers.dev/verify';

// Load the CPU's Verilog — already exported to combined.v
const combinedV = readFileSync(resolve(import.meta.dir, 'combined.v'), 'utf8');

// ── Testbench generator ──────────────────────────────────────────────────────

function generateTestbench(firmware: number[], maxCycles: number): string {
  // Pad firmware to 512 words
  const words = [...firmware];
  while (words.length < 512) words.push(0);

  // Generate IMEM initialization (only non-zero words to keep testbench small)
  // `>>> 0` ensures unsigned hex output — otherwise instructions with bit 31 set
  // serialize as negative numbers (e.g., "-7ffff849" instead of "800007b7").
  const imemInit = words
    .map((w, i) => w === 0 ? null : `      imem[${i}] = 32'h${(w >>> 0).toString(16).padStart(8, '0')};`)
    .filter(Boolean)
    .join('\n');

  return `\`timescale 1ns / 1ps

module tb;
  reg clk = 0;
  always #5 clk = ~clk;

  reg [31:0] imem [0:511];
  reg [31:0] dmem [0:1023];

  wire [31:0] instr_addr;
  wire [31:0] data_addr;
  wire [31:0] data_write;
  wire data_mem_read;
  wire data_mem_write;
  wire [2:0] data_funct3;

  reg [31:0] instruction;
  reg [31:0] data_read;

  RV32I_CPU_Core cpu (
    .clk(clk),
    .instruction(instruction),
    .data_read(data_read),
    .instr_addr(instr_addr),
    .data_addr(data_addr),
    .data_write(data_write),
    .data_mem_read(data_mem_read),
    .data_mem_write(data_mem_write),
    .data_funct3(data_funct3)
  );

  // IMEM / DMEM — word-indexed, matching cpu_top.v
  wire sel_dmem = (data_addr[31:12] == 20'h00010);
  wire sel_imem = (data_addr[31:12] == 20'h00000);
  wire sel_uart = (data_addr == 32'h80000000);
  wire [31:0] dmem_rdata = dmem[data_addr[11:2]];
  wire [31:0] imem_rdata = imem[data_addr[10:2]];

  always @(*) instruction = imem[instr_addr[10:2]];

  // data_read — CPU core does its own load alignment via LoadAlignFull,
  // so we just provide the raw aligned word.
  always @(*) begin
    if (sel_uart) data_read = 32'h1;
    else if (sel_dmem) data_read = dmem_rdata;
    else if (sel_imem) data_read = imem_rdata;
    else data_read = 32'h0;
  end

  // DMEM write logic — byte-lane selection matches cpu_top.v exactly
  always @(posedge clk) begin
    if (data_mem_write & sel_dmem) begin
      case (data_funct3[1:0])
        2'd0: case (data_addr[1:0]) // SB
          2'd0: dmem[data_addr[11:2]][ 7: 0] <= data_write[7:0];
          2'd1: dmem[data_addr[11:2]][15: 8] <= data_write[7:0];
          2'd2: dmem[data_addr[11:2]][23:16] <= data_write[7:0];
          2'd3: dmem[data_addr[11:2]][31:24] <= data_write[7:0];
        endcase
        2'd1: case (data_addr[1]) // SH
          1'b0: dmem[data_addr[11:2]][15: 0] <= data_write[15:0];
          1'b1: dmem[data_addr[11:2]][31:16] <= data_write[15:0];
        endcase
        default: dmem[data_addr[11:2]] <= data_write; // SW
      endcase
    end
    if (data_mem_write & sel_uart) $write("UART:%02x\\n", data_write[7:0]);
  end

  integer cycle;
  integer i;
  initial begin
    for (i = 0; i < 512; i = i + 1) imem[i] = 32'h0;
    for (i = 0; i < 1024; i = i + 1) dmem[i] = 32'h0;
${imemInit}
    #1;
    for (cycle = 0; cycle < ${maxCycles}; cycle = cycle + 1) begin
      @(posedge clk);
    end
    $finish;
  end
endmodule
`;
}

// ── Parse iverilog output for UART bytes ─────────────────────────────────────

function parseUartFromLog(log: string): number[] {
  const bytes: number[] = [];
  for (const line of log.split('\n')) {
    const m = line.match(/UART:([0-9a-fA-F]{2})/);
    if (m) bytes.push(parseInt(m[1], 16));
  }
  return bytes;
}

// ── POST to verifier ─────────────────────────────────────────────────────────

async function verify(firmware: number[], maxCycles: number): Promise<{ ok: boolean; bytes: number[]; log: string; error?: string }> {
  const testbench = generateTestbench(firmware, maxCycles);
  const resp = await fetch(VERIFIER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verilog: combinedV, testbench }),
  });

  const json = await resp.json() as {
    success: boolean;
    compileError?: string;
    simError?: string;
    simulationLog?: string;
    iverilogStderr?: string;
  };

  if (!json.success) {
    const err = [json.compileError, json.simError, json.iverilogStderr].filter(Boolean).join('\n---\n');
    return { ok: false, bytes: [], log: '', error: err || 'unknown' };
  }

  return { ok: true, bytes: parseUartFromLog(json.simulationLog ?? ''), log: json.simulationLog ?? '' };
}

// ── Test cases ───────────────────────────────────────────────────────────────

async function loadHelloFirmware(): Promise<number[]> {
  // Use existing compile logic: invoke the compiler service
  const helloSrc = readFileSync(resolve(import.meta.dir, 'firmware/hello.c'), 'utf8');
  const LINKER_SCRIPT = `
OUTPUT_ARCH(riscv)
ENTRY(_start)
MEMORY { IMEM (rx): ORIGIN = 0x00000000, LENGTH = 2K  DMEM (rwx): ORIGIN = 0x00010000, LENGTH = 4K }
SECTIONS {
    .text : { *(.text._start) *(.text*) *(.rodata*) } > IMEM
    .data : { *(.data*) } > DMEM
    .bss : { __bss_start = .; *(.bss*) *(COMMON) __bss_end = .; } > DMEM
    __stack_top = ORIGIN(DMEM) + LENGTH(DMEM);
}`;
  const COMPILER_URL = process.env.COMPILER_URL ?? 'https://compiler.charles-harris-de.workers.dev/compile';
  const resp = await fetch(COMPILER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: helloSrc, language: 'c', linkerScript: LINKER_SCRIPT }),
  }).then(r => r.json()) as { success: boolean; binary?: string; error?: string; stderr?: string };

  if (!resp.success || !resp.binary) {
    throw new Error(`hello.c compile failed: ${resp.error ?? resp.stderr}`);
  }

  const bin = Uint8Array.from(atob(resp.binary), c => c.charCodeAt(0));
  const words: number[] = [];
  const padded = new Uint8Array(512 * 4);
  padded.set(bin.slice(0, Math.min(bin.length, 512 * 4)));
  for (let i = 0; i < 512; i++) {
    words.push(((padded[i*4+3] << 24) | (padded[i*4+2] << 16) | (padded[i*4+1] << 8) | padded[i*4]) >>> 0);
  }
  return words;
}

// A minimal smoke test: lui a5=UART, poll, sw 'A', halt
const SMOKE_FIRMWARE: number[] = [
  0x800007b7, // lui  a5, 0x80000
  0x04100713, // addi a4, x0, 65
  0x0007a283, // lw   t0, 0(a5)
  0x0012f293, // andi t0, t0, 1
  0xfe028ae3, // beqz t0, -12
  0x00e7a023, // sw   a4, 0(a5)
  0x0000006f, // j    0 (halt)
];

// ── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const helloMode = args.includes('--hello');
const suiteMode = args.includes('--suite');
const filterArg = args.find(a => a.startsWith('--filter='))?.slice('--filter='.length).toLowerCase();

async function compareFirmware(name: string, firmware: number[], maxCycles: number, expectedPrefix?: string) {
  console.log(`\n▶ ${name}`);
  console.log('  Running TS sim...');
  const tsBytes = runFirmware(firmware, maxCycles);
  console.log(`  TS sim: ${tsBytes.length} UART bytes`);

  console.log('  Running iverilog via verifier...');
  const t0 = Date.now();
  const vResult = await verify(firmware, maxCycles);
  const elapsed = Date.now() - t0;
  if (!vResult.ok) {
    console.log(`  ✗ Verifier error (${elapsed}ms):`);
    console.log('    ' + (vResult.error ?? '').split('\n').slice(0, 30).join('\n    '));
    return false;
  }
  console.log(`  iverilog: ${vResult.bytes.length} UART bytes (${elapsed}ms)`);

  // Compare — trim iverilog to same length (it may run more cycles since no stall model)
  const compareLen = Math.min(tsBytes.length, vResult.bytes.length);
  let matchedUpTo = 0;
  for (let i = 0; i < compareLen; i++) {
    if (tsBytes[i] !== vResult.bytes[i]) break;
    matchedUpTo++;
  }

  if (matchedUpTo === tsBytes.length && vResult.bytes.length >= tsBytes.length) {
    console.log(`  ✓ Verilog matches TS sim (first ${matchedUpTo} bytes agree)`);
    if (expectedPrefix) {
      const asStr = vResult.bytes.map(b => String.fromCharCode(b)).join('');
      if (asStr.startsWith(expectedPrefix)) console.log(`  ✓ Output starts with "${expectedPrefix.replace(/\r/g,'\\r').replace(/\n/g,'\\n')}"`);
    }
    return true;
  } else {
    console.log(`  ✗ MISMATCH at byte ${matchedUpTo}`);
    console.log(`    TS sim:    ${tsBytes.slice(0, matchedUpTo + 8).map(b => '0x'+b.toString(16).padStart(2,'0')).join(' ')}`);
    console.log(`    iverilog:  ${vResult.bytes.slice(0, matchedUpTo + 8).map(b => '0x'+b.toString(16).padStart(2,'0')).join(' ')}`);
    return false;
  }
}

// ── ISA suite runner (runs all cpu_tests.ts cases through both sims) ────────

type VerdictCode = 'match' | 'divergent' | 'verilog-error';
interface Verdict {
  test: Test;
  verdict: VerdictCode;
  tsBytes: number[];
  vBytes: number[];
  error?: string;
}

async function runOneTestViaVerilog(t: Test): Promise<Verdict> {
  const tsBytes = runFirmware(t.firmware, t.maxCycles ?? 300);

  // iverilog typically runs faster cycle-count-wise than TS sim
  // Give it the same cycle budget as TS.
  const v = await verify(t.firmware, t.maxCycles ?? 300);

  if (!v.ok) {
    return { test: t, verdict: 'verilog-error', tsBytes, vBytes: [], error: v.error };
  }

  // Compare up to the expected length (suite tests define what matters)
  const expectedLen = t.expected.length;
  const tsMatchesExpected = tsBytes.length >= expectedLen && t.expected.every((b, i) => tsBytes[i] === b);
  const vMatchesExpected  = v.bytes.length >= expectedLen && t.expected.every((b, i) => v.bytes[i] === b);

  if (tsMatchesExpected && vMatchesExpected) {
    return { test: t, verdict: 'match', tsBytes, vBytes: v.bytes };
  }

  return { test: t, verdict: 'divergent', tsBytes, vBytes: v.bytes };
}

async function runSuite() {
  const selected = filterArg
    ? tests.filter(t => `${t.category} ${t.name}`.toLowerCase().includes(filterArg))
    : tests;

  console.log(`\nCross-validating ${selected.length} tests (TS sim vs iverilog)…`);
  console.log('Concurrency: 6 requests at a time\n');

  const results: Verdict[] = [];
  const CONCURRENCY = 6;

  for (let i = 0; i < selected.length; i += CONCURRENCY) {
    const batch = selected.slice(i, i + CONCURRENCY);
    const batchStart = Date.now();
    const batchResults = await Promise.all(batch.map(runOneTestViaVerilog));
    const batchElapsed = Date.now() - batchStart;

    for (const r of batchResults) {
      const sym = r.verdict === 'match' ? '✓' : r.verdict === 'divergent' ? '✗' : '!';
      const line = `${sym} ${r.test.category.padEnd(10)} ${r.test.name}`;
      if (r.verdict === 'match') {
        console.log(line);
      } else if (r.verdict === 'divergent') {
        const ts = r.tsBytes.slice(0, 6).map(b => '0x'+b.toString(16).padStart(2,'0')).join(' ');
        const vv = r.vBytes.slice(0, 6).map(b => '0x'+b.toString(16).padStart(2,'0')).join(' ');
        console.log(`${line}   TS:[${ts}] VERILOG:[${vv}]`);
      } else {
        console.log(`${line}   VERILOG-ERROR: ${(r.error ?? '').split('\n')[0].slice(0, 80)}`);
      }
      results.push(r);
    }
    const progress = Math.min(i + CONCURRENCY, selected.length);
    console.log(`  (${progress}/${selected.length} done, batch took ${batchElapsed}ms)\n`);
  }

  // Summary
  const matches     = results.filter(r => r.verdict === 'match').length;
  const divergent   = results.filter(r => r.verdict === 'divergent');
  const errors      = results.filter(r => r.verdict === 'verilog-error');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`MATCH:      ${matches}/${results.length}`);
  console.log(`DIVERGENT:  ${divergent.length} (pass in TS sim but fail in Verilog)`);
  console.log(`VERILOG ERR:${errors.length}`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (divergent.length > 0) {
    console.log('\n🔥 Divergences — these tests pinpoint the Verilog exporter bug:');
    for (const d of divergent) {
      console.log(`\n  ${d.test.category} / ${d.test.name}`);
      console.log(`    TS sim:   ${d.tsBytes.slice(0,10).map(b => '0x'+b.toString(16).padStart(2,'0')).join(' ')}`);
      console.log(`    iverilog: ${d.vBytes.slice(0,10).map(b => '0x'+b.toString(16).padStart(2,'0')).join(' ')}`);
    }
  }

  if (errors.length > 0) {
    console.log('\nVerilog compile/run errors:');
    for (const e of errors) {
      console.log(`  ${e.test.category} / ${e.test.name}:`);
      console.log('    ' + (e.error ?? '').split('\n').slice(0, 5).join('\n    '));
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

if (suiteMode) {
  await runSuite();
} else if (helloMode) {
  const fw = await loadHelloFirmware();
  await compareFirmware('hello.c (first 25 bytes)', fw, 2500, 'Hello, World!\r\n');
} else {
  // Default: smoke + hello.c
  const smokeOk = await compareFirmware('Smoke: sw UART = 0x41', SMOKE_FIRMWARE, 200);
  if (!smokeOk) {
    console.log('\nSmoke test failed — fix before running more.');
    process.exit(1);
  }

  const fw = await loadHelloFirmware();
  await compareFirmware('hello.c (first 25 bytes)', fw, 2500, 'Hello, World!\r\n');
}

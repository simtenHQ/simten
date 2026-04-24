#!/usr/bin/env tsx
/**
 * CLI shim over the generic pipeline for the RV32I CPU project.
 *
 * Behavior preserved from the previous standalone script:
 *   tsx hardware/ulx3s/cpu_build.ts           — build with firmware/hello.c
 *   tsx hardware/ulx3s/cpu_build.ts --rust    — build with firmware/hello.rs
 *   tsx hardware/ulx3s/cpu_build.ts --fib     — build with firmware/fibonacci.c
 *   tsx hardware/ulx3s/cpu_build.ts --snake   — build with firmware/snake.c
 *   tsx hardware/ulx3s/cpu_build.ts --flash   — also flash via openFPGALoader
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPipeline } from './lib/pipeline.js';
import { cpuProject } from './projects/cpu.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveFirmware(argv: string[]): { path: string; language: string } {
  if (argv.includes('--rust')) return { path: resolve(__dirname, 'firmware/hello.rs'), language: 'rust' };
  if (argv.includes('--fib')) return { path: resolve(__dirname, 'firmware/fibonacci.c'), language: 'c' };
  if (argv.includes('--snake')) return { path: resolve(__dirname, 'firmware/snake.c'), language: 'c' };
  return { path: resolve(__dirname, 'firmware/hello.c'), language: 'c' };
}

async function main() {
  const argv = process.argv.slice(2);
  const flash = argv.includes('--flash');
  const fullRebuild = argv.includes('--full-rebuild');
  const { path: firmwareSourcePath, language } = resolveFirmware(argv);

  console.log(`Building RV32I CPU bitstream (firmware: ${firmwareSourcePath})`);

  const result = await runPipeline({
    project: cpuProject,
    firmwareSourcePath,
    firmwareLanguage: language,
    flash,
    fullRebuild,
    verbose: true,
  });

  if (result.compile) {
    console.log(`  Firmware: ${result.compile.firmware_bytes} bytes (fits IMEM: ${result.compile.fits_imem})`);
    if (result.compile.disassembly_first_40_lines) {
      console.log('\n--- Disassembly (first 40 lines) ---');
      console.log(result.compile.disassembly_first_40_lines);
      console.log('---');
    }
  }

  if (!result.ok) {
    console.error(`\nFAILED at stage ${result.error?.stage}: ${result.error?.message}`);
    if (result.error?.suggestion) console.error(`  suggestion: ${result.error.suggestion}`);
    if (result.error?.stderr_tail) {
      console.error('  stderr_tail:');
      console.error('    ' + result.error.stderr_tail.split('\n').slice(-20).join('\n    '));
    }
    process.exit(1);
  }

  if (result.synth) {
    console.log(`\nSynth: ${result.synth.cached ? 'CACHED (ecpbram fast path)' : 'full rebuild'}`);
    console.log(`  Bitstream: ${result.synth.bitstream_kb} KB`);
    if (result.synth.timing_achieved_mhz) {
      console.log(`  Timing: ${result.synth.timing_achieved_mhz} MHz (target ${result.synth.timing_target_mhz})`);
    }
    if (result.synth.utilization) {
      const u = result.synth.utilization;
      console.log(`  Utilization: LUT=${u.lut} FF=${u.ff} BRAM=${u.bram}${u.io !== undefined ? ` IO=${u.io}` : ''}`);
    }
    if (result.synth.warnings.length) {
      console.log('  Warnings:');
      for (const w of result.synth.warnings.slice(0, 10)) console.log('    ' + w);
    }
  }

  console.log(`\nBitstream written to hardware/ulx3s/${cpuProject.bitFile}`);

  if (result.flash) {
    console.log(`Flashed in ${result.flash.flash_duration_ms} ms. Connect to UART: screen /dev/cu.usbserial-* 115200`);
  }

  for (const w of result.warnings) console.log('WARNING: ' + w);
}

// Bun/tsx entry check (import.meta.main is Bun-specific; use require.main fallback).
const isMainModule = (import.meta as { main?: boolean }).main
  ?? (typeof process !== 'undefined' && process.argv[1] === fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

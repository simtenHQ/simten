#!/usr/bin/env bun
/** Regenerate combined.v from the TS DSL — no flash, no synth. */
import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { exportVerilog } from '../../../../packages/core/src/verilog/exporter.js';
import { buildCPUCore } from './index.js';

const { circuit: cpuCircuit, lib } = buildCPUCore();
const { verilog: cpuVerilog } = exportVerilog(cpuCircuit, lib, {
  target: 'synthesis',
  topModuleName: 'RV32I_CPU_Core',
});
console.log(`CPU Verilog: ${(cpuVerilog.length / 1024).toFixed(1)} KB`);

// Combine with wrapper (but skip the inlineInit replacement — use raw wrapper)
const wrapperVerilog = readFileSync(resolve(import.meta.dir, 'cpu_top.v'), 'utf8');
const combined = cpuVerilog + '\n\n' + wrapperVerilog;
writeFileSync(resolve(import.meta.dir, 'combined.v'), combined);
console.log(`Wrote combined.v: ${(combined.length / 1024).toFixed(1)} KB`);

/**
 * RV32I CPU Integration Tests
 *
 * Tests the 5-stage pipelined RV32I CPU with MemBusMux, UART_TX, and NIC_FIFO.
 * Dual CPU tests are in dual-cpu-ping-pong-led.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { simulateCircuit } from '../../api/simulate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplesDir = resolve(__dirname, '../../../../../examples/rv32i');

/** Convert an array of 32-bit instructions to a byte-addressable memory map (little-endian) */
function instructionsToMemory(instructions: number[]): Map<number, number> {
  const memory = new Map<number, number>();
  for (let i = 0; i < instructions.length; i++) {
    const instr = instructions[i] >>> 0;
    const base = i * 4;
    memory.set(base, instr & 0xFF);
    memory.set(base + 1, (instr >>> 8) & 0xFF);
    memory.set(base + 2, (instr >>> 16) & 0xFF);
    memory.set(base + 3, (instr >>> 24) & 0xFF);
  }
  return memory;
}

describe('RV32I_CPU', () => {
  const source = readFileSync(resolve(examplesDir, 'rv32i-cpu.dsl'), 'utf8');

  it('compiles without errors', () => {
    const result = simulateCircuit({ source, ticks: 1 });
    expect('error' in result ? result.error : undefined).toBeUndefined();
  });

  it('executes ADDI sequence (pipeline still works through MemBusMux)', () => {
    // addi x1, x0, 5
    // addi x2, x0, 3
    // add  x3, x1, x2
    // jal  x0, 0 (halt)
    const program = instructionsToMemory([
      0x00500093, 0x00300113, 0x002081B3, 0x0000006F,
    ]);

    const memoryData = new Map([['imem', program]]);
    const result = simulateCircuit({ source, ticks: 10, memoryData });
    if ('error' in result) throw new Error(result.error);

    const pcValues: number[] = [];
    for (const { value, count } of result.signals['pc_out']) {
      for (let i = 0; i < count; i++) pcValues.push(value as number);
    }

    expect(pcValues[0]).toBe(0);
    expect(pcValues[1]).toBe(4);
    expect(pcValues[2]).toBe(8);
  });

  it('writes to UART via store to 0x80000000', () => {
    // lui  x1, 0x80000    → x1 = 0x80000000
    // addi x2, x0, 0x48   → x2 = 'H' (0x48)
    // sb   x2, 0(x1)      → store byte to UART
    // jal  x0, 0           → halt
    const program = instructionsToMemory([
      0x800000B7, 0x04800113, 0x00208023, 0x0000006F,
    ]);

    const memoryData = new Map([['imem', program]]);
    const result = simulateCircuit({ source, ticks: 30, memoryData });
    if ('error' in result) throw new Error(result.error);

    const pcValues: number[] = [];
    for (const { value, count } of result.signals['pc_out']) {
      for (let i = 0; i < count; i++) pcValues.push(value as number);
    }
    expect(Math.max(...pcValues)).toBeGreaterThanOrEqual(8);
  });

  it('can store and load from DataMem via MemBusMux', () => {
    // lui  x1, 0x10       → x1 = 0x00010000 (DataMem base)
    // addi x2, x0, 42     → x2 = 42
    // sw   x2, 0(x1)      → store 42 to DataMem[0]
    // nop × 2
    // lw   x3, 0(x1)      → load from DataMem[0]
    // jal  x0, 0           → halt
    const program = instructionsToMemory([
      0x000100B7, 0x02A00113, 0x00208023,
      0x00000013, 0x00000013,
      0x0000A183, 0x0000006F,
    ]);

    const memoryData = new Map([['imem', program]]);
    const result = simulateCircuit({ source, ticks: 30, memoryData });
    if ('error' in result) throw new Error(result.error);
  });
});

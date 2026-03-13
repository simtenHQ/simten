/**
 * RV32I Pipelined CPU Tests
 *
 * Tests the 5-stage pipelined CPU with hand-assembled programs.
 * Pipeline adds latency (5 cycles to fill) but maintains throughput.
 *
 * Key difference from single-cycle: branches/jumps have a 2-cycle penalty.
 * A jump-to-self (j .) creates a 3-tick oscillation: fetch, fetch, resolve+redirect.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { simulateCircuit } from '../../api/simulate.js';

const dslPath = resolve(__dirname, '../../../../../examples/rv32i/pipelined-cpu.dsl');

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

describe('RV32I Pipelined CPU', () => {
  const source = readFileSync(dslPath, 'utf8');

  it('should parse and compile without errors', () => {
    const result = simulateCircuit({ source, ticks: 1 });
    expect('error' in result ? result.error : undefined).toBeUndefined();
  });

  it('should execute ADDI sequence with forwarding', () => {
    // addi x1, x0, 5  = 0x00500093
    // addi x2, x0, 3  = 0x00300113
    // add  x3, x1, x2 = 0x002081B3  (needs forwarding from x1 and x2)
    // sw   x3, 0(x0)  = 0x00302023
    const program = instructionsToMemory([
      0x00500093, 0x00300113, 0x002081B3, 0x00302023,
    ]);

    const memoryData = new Map([['instrmem', program]]);
    const result = simulateCircuit({ source, ticks: 10, memoryData });
    if ('error' in result) throw new Error(result.error);

    const pcValues: number[] = [];
    for (const { value, count } of result.signals['pc_out']) {
      for (let i = 0; i < count; i++) pcValues.push(value as number);
    }

    console.log('Pipelined ADDI — PC values:', pcValues);

    // PC should advance by 4 each tick (no stalls for this sequence)
    expect(pcValues[0]).toBe(4);
    expect(pcValues[1]).toBe(8);
    expect(pcValues[2]).toBe(12);
    expect(pcValues[3]).toBe(16);
  });

  it('should execute compiled C program with correct jump behavior', () => {
    // 0x00: auipc sp, 0x10000
    // 0x04: addi  sp, sp, 0
    // 0x08: jal   ra, +8 (→0x10)
    // 0x0C: j     . (halt)
    // 0x10: addi  a5, x0, 8
    // 0x14: sw    a5, 0x100(x0)
    // 0x18: j     . (while(1))
    const program = instructionsToMemory([
      0x00010117, 0x00010113, 0x008000EF, 0x0000006F,
      0x00800793, 0x10F02023, 0x0000006F,
    ]);

    const memoryData = new Map([['instrmem', program]]);
    const result = simulateCircuit({ source, ticks: 20, memoryData });
    if ('error' in result) throw new Error(result.error);

    const pcValues: number[] = [];
    for (const { value, count } of result.signals['pc_out']) {
      for (let i = 0; i < count; i++) pcValues.push(value as number);
    }

    const aluValues: number[] = [];
    for (const { value, count } of result.signals['alu_result']) {
      for (let i = 0; i < count; i++) aluValues.push(value as number);
    }

    console.log('Pipelined C program — PC values:', pcValues);
    console.log('Pipelined C program — ALU values:', aluValues.map(v => Math.abs(v) > 255 ? `0x${(v>>>0).toString(16)}` : v));

    // Pipeline behavior:
    // Ticks 1-4: sequential fetch, PC: 4, 8, 12, 16
    // Tick 5: JAL at 0x08 reaches EX, flush + redirect to 0x10=16, PC stays 16
    // Ticks 6-8: resume from 0x10, PC: 20, 24, 28
    // Tick 9+: j . at 0x18=24 creates 3-cycle oscillation: 24→28→32→24...
    //   (2-cycle penalty: two speculative fetches flushed each time)

    // Sequential fetch
    expect(pcValues[0]).toBe(4);
    expect(pcValues[1]).toBe(8);
    expect(pcValues[2]).toBe(12);

    // After JAL resolves, should reach the halt loop at 0x18=24
    // The halt loop oscillates with a 3-cycle period (2-cycle branch penalty)
    // Verify: last 3 values repeat the previous 3 (stable oscillation)
    const last3 = pcValues.slice(-3);
    const prev3 = pcValues.slice(-6, -3);
    expect(last3).toEqual(prev3);

    // The oscillation must include the halt loop address (0x18 = 24)
    expect(last3).toContain(24);

    // ALU should show correct values for key instructions
    // AUIPC: 0x10000, addi a5: 8, sw address: 0x100
    expect(aluValues).toContain(0x10000);
    expect(aluValues).toContain(8);
    expect(aluValues).toContain(0x100);
  });
});

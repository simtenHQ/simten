/**
 * Dual CPU Ping-Pong LED test
 *
 * Minimal programs with NO printing — just NIC send/receive and a single
 * UART write as an "LED" indicator. Shows actual communication latency.
 *
 * CPU0: Send one word ("PING" = 0x50494E47) → wait for reply → write 'A' to UART
 * CPU1: Wait for frame → read it → send one word ("PONG" = 0x504F4E47) → write 'B' to UART
 *
 * Memory map:
 *   0x80000000  UART (write byte)
 *   0x80001000  NIC TX data (write word)
 *   0x8000100C  NIC TX frame-end (write to trigger send)
 *   0x80002000  NIC RX data (read front word)
 *   0x80002004  NIC RX pop (write to pop)
 *   0x80002008  NIC RX count (read)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createSimulatorFromCircuit,
  createCircuitLibrary,
  generatePrimitives,
  PRIMITIVE_DEFINITIONS,
  TOP_LEVEL_NODE,
} from '../index.js';
import { compileDSL } from '../../dsl/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplesDir = resolve(__dirname, '../../../../../examples/rv32i');

/** Read a DSL file, resolving `include` directives */
function readDSLWithIncludes(filePath: string): string {
  const source = readFileSync(filePath, 'utf8');
  return source.replace(/^include\s+"([^"]+)"\s*$/gm, (_match, relPath) => {
    const includedPath = resolve(dirname(filePath), relPath);
    return readFileSync(includedPath, 'utf8');
  });
}

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

// RV32I instruction encoders
function lui(rd: number, imm20: number) {
  return ((imm20 & 0xFFFFF) << 12) | (rd << 7) | 0x37;
}
function addi(rd: number, rs1: number, imm12: number) {
  return ((imm12 & 0xFFF) << 20) | (rs1 << 15) | (0b000 << 12) | (rd << 7) | 0x13;
}
function sw(rs2: number, rs1: number, imm12: number) {
  const imm11_5 = (imm12 >> 5) & 0x7F;
  const imm4_0 = imm12 & 0x1F;
  return (imm11_5 << 25) | (rs2 << 20) | (rs1 << 15) | (0b010 << 12) | (imm4_0 << 7) | 0x23;
}
function lw(rd: number, rs1: number, imm12: number) {
  return ((imm12 & 0xFFF) << 20) | (rs1 << 15) | (0b010 << 12) | (rd << 7) | 0x03;
}
function beq(rs1: number, rs2: number, offset: number) {
  // B-type encoding
  const imm12 = (offset >> 12) & 1;
  const imm11 = (offset >> 11) & 1;
  const imm10_5 = (offset >> 5) & 0x3F;
  const imm4_1 = (offset >> 1) & 0xF;
  return (imm12 << 31) | (imm10_5 << 25) | (rs2 << 20) | (rs1 << 15) |
    (0b000 << 12) | (imm4_1 << 8) | (imm11 << 7) | 0x63;
}
function bne(rs1: number, rs2: number, offset: number) {
  const imm12 = (offset >> 12) & 1;
  const imm11 = (offset >> 11) & 1;
  const imm10_5 = (offset >> 5) & 0x3F;
  const imm4_1 = (offset >> 1) & 0xF;
  return (imm12 << 31) | (imm10_5 << 25) | (rs2 << 20) | (rs1 << 15) |
    (0b001 << 12) | (imm4_1 << 8) | (imm11 << 7) | 0x63;
}
function jal(rd: number, offset: number) {
  const imm20 = (offset >> 20) & 1;
  const imm19_12 = (offset >> 12) & 0xFF;
  const imm11 = (offset >> 11) & 1;
  const imm10_1 = (offset >> 1) & 0x3FF;
  return (imm20 << 31) | (imm10_1 << 21) | (imm11 << 20) | (imm19_12 << 12) | (rd << 7) | 0x6F;
}

// Register aliases
const x0 = 0, x5 = 5, x6 = 6, x7 = 7, x10 = 10, x11 = 11;

describe('Dual CPU Ping-Pong LED', () => {
  it('should exchange frames and light LEDs with minimal tick count', () => {
    // --- CPU0 program: send PING, wait for PONG, write 'A' to UART ---
    // Use x5 for NIC TX base (0x80001000), x6 for NIC RX base (0x80002000), x7 for UART (0x80000000)
    const cpu0 = [
      // Load peripheral base addresses
      lui(x5, 0x80001),         // 0x00: x5 = 0x80001000 (NIC TX base)
      lui(x6, 0x80002),         // 0x04: x6 = 0x80002000 (NIC RX base)
      lui(x7, 0x80000),         // 0x08: x7 = 0x80000000 (UART base)

      // Write "PING" (0x50494E47) to NIC TX
      lui(x10, 0x50495),        // 0x0C: x10 = 0x50495000
      addi(x10, x10, -0x1B9),   // 0x10: x10 = 0x50494E47 (adjust: 0x50495000 - 0x1B9 = 0x50494E47)
      sw(x10, x5, 0x0),         // 0x14: store word to NIC TX FIFO (0x80001000)

      // Trigger frame-end
      sw(x0, x5, 0xC),          // 0x18: write to 0x8000100C (frame-end)

      // Poll NIC RX count until != 0
      lw(x10, x6, 0x8),         // 0x1C: x10 = NIC RX count (0x80002008)
      beq(x10, x0, -4),         // 0x20: if count==0, loop back to 0x1C

      // Read the reply word
      lw(x10, x6, 0x0),         // 0x24: x10 = NIC RX front word (0x80002000)

      // Write 'A' (0x41) to UART = "LED on"
      addi(x11, x0, 0x41),      // 0x28: x11 = 'A'
      sw(x11, x7, 0x0),         // 0x2C: write to UART (0x80000000)

      // Halt
      jal(x0, 0),               // 0x30: infinite loop
    ];

    // --- CPU1 program: wait for PING, send PONG, write 'B' to UART ---
    const cpu1 = [
      // Load peripheral base addresses
      lui(x5, 0x80001),         // 0x00: x5 = 0x80001000 (NIC TX base)
      lui(x6, 0x80002),         // 0x04: x6 = 0x80002000 (NIC RX base)
      lui(x7, 0x80000),         // 0x08: x7 = 0x80000000 (UART base)

      // Poll NIC RX count until != 0
      lw(x10, x6, 0x8),         // 0x0C: x10 = NIC RX count
      beq(x10, x0, -4),         // 0x10: if count==0, loop back to 0x0C

      // Read the received word
      lw(x10, x6, 0x0),         // 0x14: x10 = NIC RX front word

      // Send "PONG" (0x504F4E47) back
      lui(x10, 0x504F5),        // 0x18: x10 = 0x504F5000
      addi(x10, x10, -0x1B9),   // 0x1C: x10 = 0x504F4E47
      sw(x10, x5, 0x0),         // 0x20: store word to NIC TX FIFO

      // Trigger frame-end
      sw(x0, x5, 0xC),          // 0x24: write to 0x8000100C

      // Write 'B' (0x42) to UART = "LED on"
      addi(x11, x0, 0x42),      // 0x28: x11 = 'B'
      sw(x11, x7, 0x0),         // 0x2C: write to UART

      // Halt
      jal(x0, 0),               // 0x30: infinite loop
    ];

    // Build circuit — need addCircuit so the compiler can register RV32I_CPU
    // before compiling RV32I_DualCPU which references it
    const dslPath = resolve(examplesDir, 'rv32i-dual-cpu.dsl');
    const source = readDSLWithIncludes(dslPath);
    const primitiveCircuits = generatePrimitives(PRIMITIVE_DEFINITIONS);
    const allCircuits = [...primitiveCircuits];
    const compLib = createCircuitLibrary(allCircuits) as any;
    compLib.addCircuit = (c: any) => { allCircuits.push(c); compLib.resolveCircuit = (name: string) => allCircuits.find((cc: any) => cc.name === name); };
    // Rebuild resolveCircuit to use allCircuits array (which grows as circuits compile)
    compLib.resolveCircuit = (name: string) => allCircuits.find((c: any) => c.name === name);
    const { circuits: compiled, errors } = compileDSL(source, compLib, dslPath);
    if (errors.length > 0) throw new Error(errors.map(e => e.message).join('\n'));
    allCircuits.push(...compiled);
    const target = compiled[compiled.length - 1];
    const fullLib = createCircuitLibrary(allCircuits);

    // Load programs into each CPU's instruction memory
    const cpu0Mem = instructionsToMemory(cpu0);
    const cpu1Mem = instructionsToMemory(cpu1);
    const memoryData = new Map([
      ['cpu0*imem', cpu0Mem],
      ['cpu1*imem', cpu1Mem],
    ]);

    const sim = createSimulatorFromCircuit(target, fullLib, memoryData);

    // Run simulation and track when each CPU halts
    const MAX_TICKS = 200;
    let cpu0HaltTick = -1;
    let cpu1HaltTick = -1;
    let lastPC0 = -1, lastPC1 = -1;
    let haltCount0 = 0, haltCount1 = 0;
    const pc0Trace: number[] = [];
    const pc1Trace: number[] = [];

    for (let i = 0; i < MAX_TICKS; i++) {
      const result = sim.tick();
      const pc0 = result.portValues.get(`${TOP_LEVEL_NODE}.cpu0_pc`) as number;
      const pc1 = result.portValues.get(`${TOP_LEVEL_NODE}.cpu1_pc`) as number;
      pc0Trace.push(pc0);
      pc1Trace.push(pc1);

      // Detect CPU0 halt (PC repeats = stuck on jal x0, 0)
      if (pc0 === lastPC0) {
        haltCount0++;
        if (haltCount0 === 3 && cpu0HaltTick === -1) cpu0HaltTick = i - 2;
      } else {
        haltCount0 = 0;
      }

      // Detect CPU1 halt
      if (pc1 === lastPC1) {
        haltCount1++;
        if (haltCount1 === 3 && cpu1HaltTick === -1) cpu1HaltTick = i - 2;
      } else {
        haltCount1 = 0;
      }

      lastPC0 = pc0;
      lastPC1 = pc1;

      // Both halted
      if (cpu0HaltTick !== -1 && cpu1HaltTick !== -1) break;
    }

    // Find first tick each CPU reaches halt address (0x30)
    const haltAddr = 0x30;
    const cpu0FirstHalt = pc0Trace.findIndex(p => p === haltAddr);
    const cpu1FirstHalt = pc1Trace.findIndex(p => p === haltAddr);

    console.log('PC0 trace (first 30):', pc0Trace.slice(0, 30).map(p => '0x' + (p ?? 0).toString(16)));
    console.log('PC1 trace (first 30):', pc1Trace.slice(0, 30).map(p => '0x' + (p ?? 0).toString(16)));
    console.log(`CPU0 reached halt (0x30) at tick: ${cpu0FirstHalt + 1}`);
    console.log(`CPU1 reached halt (0x30) at tick: ${cpu1FirstHalt + 1}`);

    // Read UART outputs
    const state = sim.getState()!;
    let cpu0Uart = '', cpu1Uart = '';
    for (const [key, val] of state.currentState) {
      if (key.includes('cpu0') && key.includes('uart') && typeof val === 'string') {
        cpu0Uart = val;
      }
      if (key.includes('cpu1') && key.includes('uart') && typeof val === 'string') {
        cpu1Uart = val;
      }
    }

    console.log(`CPU0 halted at tick ${cpu0HaltTick}`);
    console.log(`CPU1 halted at tick ${cpu1HaltTick}`);
    console.log(`CPU0 UART: "${cpu0Uart}"`);
    console.log(`CPU1 UART: "${cpu1Uart}"`);
    console.log(`Total ticks: ${Math.max(cpu0HaltTick, cpu1HaltTick)}`);

    // Verify LEDs lit
    expect(cpu1Uart).toBe('B');  // CPU1 receives PING, lights LED
    expect(cpu0Uart).toBe('A');  // CPU0 receives PONG, lights LED

    // Both should reach halt well under 100 ticks
    expect(cpu0FirstHalt).toBeGreaterThan(0);
    expect(cpu0FirstHalt).toBeLessThan(100);
    expect(cpu1FirstHalt).toBeGreaterThan(0);
    expect(cpu1FirstHalt).toBeLessThan(100);
  });
});

/**
 * RV32I CPU Integration Tests
 *
 * Tests the reference single-cycle CPU circuit with hand-assembled programs
 * injected via memoryData (runtime loading, not DSL-embedded).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { simulateCircuit } from '../../api/simulate.js';

const dslPath = resolve(__dirname, '../../../../../examples/rv32i/single-cycle-cpu.dsl');

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

describe('RV32I Single-Cycle CPU', () => {
  const source = readFileSync(dslPath, 'utf8');

  it('should parse and compile without errors', () => {
    const result = simulateCircuit({ source, ticks: 1 });
    expect('error' in result ? result.error : undefined).toBeUndefined();
  });

  it('should execute ADDI sequence with memoryData injection', () => {
    // addi x1, x0, 5  = 0x00500093
    // addi x2, x0, 3  = 0x00300113
    // add  x3, x1, x2 = 0x002081B3
    // sw   x3, 0(x0)  = 0x00302023
    // lw   x4, 0(x0)  = 0x00002203
    const program = instructionsToMemory([
      0x00500093, 0x00300113, 0x002081B3, 0x00302023, 0x00002203,
    ]);

    // "instrmem" pattern matches RV32I_InstrMem via primitiveType
    const memoryData = new Map([['instrmem', program]]);

    const result = simulateCircuit({ source, ticks: 6, memoryData });
    if ('error' in result) throw new Error(result.error);

    // PC should advance by 4 each tick
    const pcValues: number[] = [];
    for (const { value, count } of result.signals['pc_out']) {
      for (let i = 0; i < count; i++) pcValues.push(value as number);
    }
    expect(pcValues[0]).toBe(4);
    expect(pcValues[1]).toBe(8);
    expect(pcValues[2]).toBe(12);
    expect(pcValues[3]).toBe(16);
    expect(pcValues[4]).toBe(20);
  });
});

describe('RV32I CPU — jump/branch debugging', () => {
  const source = readFileSync(dslPath, 'utf8');

  it('JAL should update PC to jump target', () => {
    // Program:
    //   0x00: jal x0, +8      → jump to 0x08 (skip next instruction)
    //   0x04: addi x1, x0, 99 → should be SKIPPED
    //   0x08: addi x2, x0, 42 → should execute
    const program = instructionsToMemory([
      0x0080006F, // jal x0, +8
      0x06300093, // addi x1, x0, 99
      0x02A00113, // addi x2, x0, 42
    ]);

    const memoryData = new Map([['instrmem', program]]);
    const result = simulateCircuit({ source, ticks: 3, memoryData });
    if ('error' in result) throw new Error(result.error);

    const pcValues: number[] = [];
    for (const { value, count } of result.signals['pc_out']) {
      for (let i = 0; i < count; i++) pcValues.push(value as number);
    }

    console.log('JAL test — PC values:', pcValues);

    // Tick 0: executes JAL at PC=0 → PC should become 8 (not 4)
    // Tick 1: executes instruction at PC=8
    expect(pcValues[0]).toBe(8);  // JAL jumped
    expect(pcValues[1]).toBe(12); // continued from 8
  });

  it('BEQ should branch when equal', () => {
    // Program:
    //   0x00: addi x1, x0, 5   → x1 = 5
    //   0x04: addi x2, x0, 5   → x2 = 5
    //   0x08: beq x1, x2, +8   → branch to 0x10 (skip next)
    //   0x0C: addi x3, x0, 99  → should be SKIPPED
    //   0x10: addi x4, x0, 42  → should execute
    const program = instructionsToMemory([
      0x00500093, // addi x1, x0, 5
      0x00500113, // addi x2, x0, 5
      0x00208463, // beq x1, x2, +8
      0x06300193, // addi x3, x0, 99
      0x02A00213, // addi x4, x0, 42
    ]);

    const memoryData = new Map([['instrmem', program]]);
    const result = simulateCircuit({ source, ticks: 5, memoryData });
    if ('error' in result) throw new Error(result.error);

    const pcValues: number[] = [];
    for (const { value, count } of result.signals['pc_out']) {
      for (let i = 0; i < count; i++) pcValues.push(value as number);
    }

    console.log('BEQ test — PC values:', pcValues);

    // Tick 0: addi x1, x0, 5 → PC=4
    // Tick 1: addi x2, x0, 5 → PC=8
    // Tick 2: beq x1, x2, +8 → PC=16 (branch taken)
    // Tick 3: addi x4 at 0x10 → PC=20
    expect(pcValues[0]).toBe(4);
    expect(pcValues[1]).toBe(8);
    expect(pcValues[2]).toBe(16); // branch taken, skip 0x0C
    expect(pcValues[3]).toBe(20);
  });
});

describe('RV32I CPU — compiled C program (crt0 + main)', () => {
  const source = readFileSync(dslPath, 'utf8');

  it('should execute the crt0→main flow correctly', () => {
    // This is the exact binary from:
    //   int main() { volatile int *out = (volatile int *)0x100; *out = 8; while(1); }
    // Compiled with crt0: auipc sp, jal main, halt loop
    //
    // 0x00: 0x00010117  auipc sp, 0x10000
    // 0x04: 0x00010113  addi  sp, sp, 0
    // 0x08: 0x008000EF  jal   ra, +8 (→0x10)
    // 0x0C: 0x0000006F  j     . (halt)
    // 0x10: 0x00800793  addi  a5, x0, 8
    // 0x14: 0x10F02023  sw    a5, 0x100(x0)
    // 0x18: 0x0000006F  j     . (while(1))
    const program = instructionsToMemory([
      0x00010117, 0x00010113, 0x008000EF, 0x0000006F,
      0x00800793, 0x10F02023, 0x0000006F,
    ]);

    const memoryData = new Map([['instrmem', program]]);
    const result = simulateCircuit({ source, ticks: 10, memoryData });
    if ('error' in result) throw new Error(result.error);

    const pcValues: number[] = [];
    for (const { value, count } of result.signals['pc_out']) {
      for (let i = 0; i < count; i++) pcValues.push(value as number);
    }

    const aluValues: number[] = [];
    for (const { value, count } of result.signals['alu_result']) {
      for (let i = 0; i < count; i++) aluValues.push(value as number);
    }

    console.log('C program — PC values:', pcValues);
    console.log('C program — ALU values:', aluValues.map(v => v > 255 ? `0x${(v>>>0).toString(16)}` : v));

    // Tick 0: auipc sp, 0x10000 at PC=0 → PC should be 4
    expect(pcValues[0]).toBe(4);
    // Tick 1: addi sp, sp, 0 at PC=4 → PC should be 8
    expect(pcValues[1]).toBe(8);
    // Tick 2: jal ra, +8 at PC=8 → PC should JUMP to 16
    expect(pcValues[2]).toBe(16);
    // Tick 3: addi a5, x0, 8 at PC=16 → PC=20
    expect(pcValues[3]).toBe(20);
    // Tick 4: sw a5, 0x100(x0) at PC=20 → PC=24
    expect(pcValues[4]).toBe(24);
    // Tick 5: j . at PC=24 → PC should LOOP back to 24
    expect(pcValues[5]).toBe(24);
    expect(pcValues[6]).toBe(24); // still looping
  });
});

describe('RV32I CPU — inline programs', () => {
  it('ADDI counting to 3', () => {
    // Self-contained test circuit with data={} for simplicity
    const circuit = `circuit T {
      output pc_out: Bus[32]
      impl {
        node imem: RV32I_InstrMem(data={
          0: 0x93, 1: 0x00, 2: 0x10, 3: 0x00,
          4: 0x93, 5: 0x80, 6: 0x10, 7: 0x00,
          8: 0x93, 9: 0x80, 10: 0x10, 11: 0x00
        })
        node pc: Register(width=32)
        node pc_plus4: Adder(width=32)
        node four: Constant(value=4, width=32)
        node pc_we: Constant(value=1, width=1)
        connect pc.q -> pc_plus4.a
        connect four.out -> pc_plus4.b
        connect pc_we.out -> pc.we
        connect pc_plus4.sum -> pc.data
        connect pc.q -> imem.addr
        connect pc.q -> pc_out

        node decode: RV32I_Decode
        connect imem.instruction -> decode.instruction

        node immgen: RV32I_ImmGen
        connect imem.instruction -> immgen.instruction

        node control: RV32I_Control
        connect decode.opcode -> control.opcode
        connect decode.funct3 -> control.funct3
        node funct7_splitter: BitSlice(low=5, high=5)
        connect decode.funct7 -> funct7_splitter.in
        connect funct7_splitter.out -> control.funct7_bit

        node regfile: RV32I_RegisterFile
        connect decode.rs1 -> regfile.rs1
        connect decode.rs2 -> regfile.rs2
        connect decode.rd -> regfile.rd
        connect control.reg_write -> regfile.we

        node alu_src_mux: Mux(width=32)
        connect regfile.read2 -> alu_src_mux.in0
        connect immgen.immediate -> alu_src_mux.in1
        connect control.alu_src -> alu_src_mux.sel

        node alu: RV32I_ALU
        connect regfile.read1 -> alu.a
        connect alu_src_mux.out -> alu.b
        connect control.alu_op -> alu.alu_op

        // Writeback — simplified (no mem, no LUI/AUIPC/jump)
        connect alu.result -> regfile.write_data
      }
    }`;

    const result = simulateCircuit({ source: circuit, ticks: 4 });
    if ('error' in result) throw new Error(result.error);

    const pcValues: number[] = [];
    for (const { value, count } of result.signals['pc_out']) {
      for (let i = 0; i < count; i++) pcValues.push(value as number);
    }
    // PC is sampled after each tick's rising edge
    expect(pcValues[0]).toBe(4);
    expect(pcValues[1]).toBe(8);
    expect(pcValues[2]).toBe(12);
  });
});

#!/usr/bin/env tsx
/**
 * Systematic RV32I ISA test suite.
 * Each test runs firmware through the TypeScript RTL simulator and checks UART output.
 * No FPGA needed — runs in ~1 second total.
 *
 * Usage: bun hardware/ulx3s/cpu_tests.ts
 *        bun hardware/ulx3s/cpu_tests.ts --filter "ADD"   (run matching tests only)
 */

import { runFirmware } from './cpu_sim.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

// UART address for sw (write byte) and lw (poll ready)
const UART = 0x80000000;
const DMEM = 0x00010000;

// Encode a 32-bit value as 4 words (little-endian bytes, packed into words).
// Not needed directly — just a reminder that DMEM writes happen via the CPU.

// Send byte B via UART (assumes a5 = UART base already set).
// Uses: a5=UART, t0=scratch. Clobbers t0.
function poll_and_send(b: number): number[] {
  return [
    0x0007a283, // lw   t0, 0(a5)       ; poll
    0x0012f293, // andi t0, t0, 1
    0xfe028ae3, // beqz t0, -12          ; → lw
    b & 0x1ff_fff ? encode_addi(14, 0, b) : encode_addi(14, 0, b), // li a4, b
    0x00e7a023, // sw   a4, 0(a5)        ; send
  ];
}

// Minimal poll+send using pre-loaded a4
function poll_send_a4(): number[] {
  return [
    0x0007a283, // lw   t0, 0(a5)
    0x0012f293, // andi t0, t0, 1
    0xfe028ae3, // beqz t0, -12
    0x00e7a023, // sw   a4, 0(a5)
  ];
}

function encode_lui(rd: number, imm20: number): number {
  return ((imm20 & 0xfffff) << 12) | ((rd & 0x1f) << 7) | 0x37;
}

function encode_auipc(rd: number, imm20: number): number {
  return ((imm20 & 0xfffff) << 12) | ((rd & 0x1f) << 7) | 0x17;
}

function encode_addi(rd: number, rs1: number, imm12: number): number {
  return ((imm12 & 0xfff) << 20) | ((rs1 & 0x1f) << 15) | (0 << 12) | ((rd & 0x1f) << 7) | 0x13;
}

function encode_add(rd: number, rs1: number, rs2: number): number {
  return (0 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (0 << 12) | ((rd & 0x1f) << 7) | 0x33;
}

function encode_sub(rd: number, rs1: number, rs2: number): number {
  return (0x20 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (0 << 12) | ((rd & 0x1f) << 7) | 0x33;
}

function encode_and(rd: number, rs1: number, rs2: number): number {
  return (0 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (7 << 12) | ((rd & 0x1f) << 7) | 0x33;
}

function encode_or(rd: number, rs1: number, rs2: number): number {
  return (0 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (6 << 12) | ((rd & 0x1f) << 7) | 0x33;
}

function encode_xor(rd: number, rs1: number, rs2: number): number {
  return (0 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (4 << 12) | ((rd & 0x1f) << 7) | 0x33;
}

function encode_sll(rd: number, rs1: number, rs2: number): number {
  return (0 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (1 << 12) | ((rd & 0x1f) << 7) | 0x33;
}

function encode_srl(rd: number, rs1: number, rs2: number): number {
  return (0 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (5 << 12) | ((rd & 0x1f) << 7) | 0x33;
}

function encode_sra(rd: number, rs1: number, rs2: number): number {
  return (0x20 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (5 << 12) | ((rd & 0x1f) << 7) | 0x33;
}

function encode_slt(rd: number, rs1: number, rs2: number): number {
  return (0 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (2 << 12) | ((rd & 0x1f) << 7) | 0x33;
}

function encode_sltu(rd: number, rs1: number, rs2: number): number {
  return (0 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (3 << 12) | ((rd & 0x1f) << 7) | 0x33;
}

function encode_slli(rd: number, rs1: number, shamt: number): number {
  return (0 << 25) | ((shamt & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (1 << 12) | ((rd & 0x1f) << 7) | 0x13;
}

function encode_srli(rd: number, rs1: number, shamt: number): number {
  return (0 << 25) | ((shamt & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (5 << 12) | ((rd & 0x1f) << 7) | 0x13;
}

function encode_srai(rd: number, rs1: number, shamt: number): number {
  return (0x20 << 25) | ((shamt & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (5 << 12) | ((rd & 0x1f) << 7) | 0x13;
}

function encode_slti(rd: number, rs1: number, imm12: number): number {
  return ((imm12 & 0xfff) << 20) | ((rs1 & 0x1f) << 15) | (2 << 12) | ((rd & 0x1f) << 7) | 0x13;
}

function encode_sltiu(rd: number, rs1: number, imm12: number): number {
  return ((imm12 & 0xfff) << 20) | ((rs1 & 0x1f) << 15) | (3 << 12) | ((rd & 0x1f) << 7) | 0x13;
}

function encode_ori(rd: number, rs1: number, imm12: number): number {
  return ((imm12 & 0xfff) << 20) | ((rs1 & 0x1f) << 15) | (6 << 12) | ((rd & 0x1f) << 7) | 0x13;
}

function encode_andi(rd: number, rs1: number, imm12: number): number {
  return ((imm12 & 0xfff) << 20) | ((rs1 & 0x1f) << 15) | (7 << 12) | ((rd & 0x1f) << 7) | 0x13;
}

function encode_xori(rd: number, rs1: number, imm12: number): number {
  return ((imm12 & 0xfff) << 20) | ((rs1 & 0x1f) << 15) | (4 << 12) | ((rd & 0x1f) << 7) | 0x13;
}

function encode_lw(rd: number, rs1: number, imm12: number): number {
  return ((imm12 & 0xfff) << 20) | ((rs1 & 0x1f) << 15) | (2 << 12) | ((rd & 0x1f) << 7) | 0x03;
}

function encode_lh(rd: number, rs1: number, imm12: number): number {
  return ((imm12 & 0xfff) << 20) | ((rs1 & 0x1f) << 15) | (1 << 12) | ((rd & 0x1f) << 7) | 0x03;
}

function encode_lhu(rd: number, rs1: number, imm12: number): number {
  return ((imm12 & 0xfff) << 20) | ((rs1 & 0x1f) << 15) | (5 << 12) | ((rd & 0x1f) << 7) | 0x03;
}

function encode_lb(rd: number, rs1: number, imm12: number): number {
  return ((imm12 & 0xfff) << 20) | ((rs1 & 0x1f) << 15) | (0 << 12) | ((rd & 0x1f) << 7) | 0x03;
}

function encode_lbu(rd: number, rs1: number, imm12: number): number {
  return ((imm12 & 0xfff) << 20) | ((rs1 & 0x1f) << 15) | (4 << 12) | ((rd & 0x1f) << 7) | 0x03;
}

function encode_sw(rs1: number, rs2: number, imm12: number): number {
  const imm = imm12 & 0xfff;
  return ((imm >> 5) << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (2 << 12) | ((imm & 0x1f) << 7) | 0x23;
}

function encode_sh(rs1: number, rs2: number, imm12: number): number {
  const imm = imm12 & 0xfff;
  return ((imm >> 5) << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (1 << 12) | ((imm & 0x1f) << 7) | 0x23;
}

function encode_sb(rs1: number, rs2: number, imm12: number): number {
  const imm = imm12 & 0xfff;
  return ((imm >> 5) << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) | (0 << 12) | ((imm & 0x1f) << 7) | 0x23;
}

// Branch: imm is byte offset (must be even, ±4096)
function encode_beq(rs1: number, rs2: number, imm: number): number {
  return encode_branch(rs1, rs2, imm, 0);
}
function encode_bne(rs1: number, rs2: number, imm: number): number {
  return encode_branch(rs1, rs2, imm, 1);
}
function encode_blt(rs1: number, rs2: number, imm: number): number {
  return encode_branch(rs1, rs2, imm, 4);
}
function encode_bge(rs1: number, rs2: number, imm: number): number {
  return encode_branch(rs1, rs2, imm, 5);
}
function encode_bltu(rs1: number, rs2: number, imm: number): number {
  return encode_branch(rs1, rs2, imm, 6);
}
function encode_bgeu(rs1: number, rs2: number, imm: number): number {
  return encode_branch(rs1, rs2, imm, 7);
}
function encode_branch(rs1: number, rs2: number, imm: number, funct3: number): number {
  const i = imm & 0x1ffe; // 13-bit signed, bit0 always 0
  const b12 = (i >> 12) & 1;
  const b11 = (i >> 11) & 1;
  const b10_5 = (i >> 5) & 0x3f;
  const b4_1 = (i >> 1) & 0xf;
  return (b12 << 31) | (b10_5 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) |
    (funct3 << 12) | (b4_1 << 8) | (b11 << 7) | 0x63;
}

// JAL: imm is byte offset (±1MiB)
function encode_jal(rd: number, imm: number): number {
  const i = imm & 0x1fffff; // 21-bit signed, bit0 always 0
  const b20    = (i >> 20) & 1;
  const b10_1  = (i >> 1)  & 0x3ff;
  const b11    = (i >> 11) & 1;
  const b19_12 = (i >> 12) & 0xff;
  return (b20 << 31) | (b10_1 << 21) | (b11 << 20) | (b19_12 << 12) | ((rd & 0x1f) << 7) | 0x6f;
}

// JALR: next PC = (rs1 + imm) & ~1
function encode_jalr(rd: number, rs1: number, imm12: number): number {
  return ((imm12 & 0xfff) << 20) | ((rs1 & 0x1f) << 15) | (0 << 12) | ((rd & 0x1f) << 7) | 0x67;
}

// FENCE: treated as NOP by bare-metal CPU
const FENCE  = 0x0000000f;
const ECALL  = 0x00000073;
const EBREAK = 0x00100073;
const NOP    = 0x00000013;

// Register aliases
const x0=0, ra=1, sp=2, a0=10, a1=11, a2=12, a3=13, a4=14, a5=15, a6=16, t0=5, t1=6, s0=8;

// Standard preamble: set a5 = UART base
const SET_UART_A5 = encode_lui(a5, 0x80000); // lui a5, 0x80000

// Standard send sequence: poll + sw a4, 0(a5)
// Assumes a5=UART, a4=byte to send
const POLL_SEND = [
  encode_lw(t0, a5, 0),          // lw  t0, 0(a5)
  encode_andi(t0, t0, 1),        // andi t0, t0, 1
  encode_beq(t0, x0, -8),        // beqz t0, -8  → lw
  encode_sw(a5, a4, 0),          // sw  a4, 0(a5)
];

// Infinite loop (j 0) — halt after last send
const HALT = [encode_jal(x0, 0)]; // j 0 (infinite loop)

// Build firmware: [preamble] + [test body] + [halt]
function fw(...words: (number | number[])[]): number[] {
  return words.flat();
}

// ── Test infrastructure ───────────────────────────────────────────────────────

type Test = {
  name: string;
  category: string;
  firmware: number[];
  expected: number[];
  maxCycles?: number;
};

export const tests: Test[] = [];
export type { Test };

function test(category: string, name: string, firmware: number[], expected: number[], maxCycles?: number) {
  tests.push({ category, name, firmware, expected, maxCycles });
}

// ── Test definitions ──────────────────────────────────────────────────────────
// Convention: send 'P' (0x50) for pass, 'F' (0x46) for fail.
// For sequence tests, send specific bytes.

const P = 0x50; // 'P'
const F = 0x46; // 'F'

// ── R-Type ALU ────────────────────────────────────────────────────────────────

// ADD basic: 10 + 20 = 30 → send 'P' if correct
test('R-Type', 'ADD basic', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 10),       // a0 = 10
  encode_addi(a1, x0, 20),       // a1 = 20
  encode_add(a4, a0, a1),        // a4 = 30
  encode_addi(a2, x0, 30),       // a2 = expected
  encode_beq(a4, a2, 12),         // if a4==30 skip fail
  encode_addi(a4, x0, F),        // a4 = 'F'
  encode_jal(x0, 8),             // jump to send
  encode_addi(a4, x0, P),        // a4 = 'P'
  POLL_SEND,
  HALT,
), [P]);

// ADD overflow wraps: 0x7FFFFFFF + 1 = 0x80000000 (negative in 2s complement)
test('R-Type', 'ADD overflow wraps', fw(
  SET_UART_A5,
  encode_lui(a0, 0x80000),        // a0 = 0x80000000
  encode_addi(a0, a0, -1),        // a0 = 0x7FFFFFFF
  encode_addi(a1, x0, 1),         // a1 = 1
  encode_add(a4, a0, a1),         // a4 = 0x80000000
  encode_lui(a2, 0x80000),        // a2 = 0x80000000
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F),
  encode_jal(x0, 8),
  encode_addi(a4, x0, P),
  POLL_SEND,
  HALT,
), [P]);

// SUB basic: 30 - 10 = 20
test('R-Type', 'SUB basic', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 30),
  encode_addi(a1, x0, 10),
  encode_sub(a4, a0, a1),         // a4 = 20
  encode_addi(a2, x0, 20),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F),
  encode_jal(x0, 8),
  encode_addi(a4, x0, P),
  POLL_SEND,
  HALT,
), [P]);

// SUB result negative: 5 - 10 = -5 = 0xFFFFFFFB
test('R-Type', 'SUB result negative', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 5),
  encode_addi(a1, x0, 10),
  encode_sub(a4, a0, a1),         // a4 = -5
  encode_addi(a2, x0, -5),        // a2 = -5 (sign-extended)
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F),
  encode_jal(x0, 8),
  encode_addi(a4, x0, P),
  POLL_SEND,
  HALT,
), [P]);

// AND: 0xFF & 0x0F = 0x0F
test('R-Type', 'AND', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 0xFF),
  encode_addi(a1, x0, 0x0F),
  encode_and(a4, a0, a1),
  encode_addi(a2, x0, 0x0F),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// OR: 0xF0 | 0x0F = 0xFF
test('R-Type', 'OR', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 0xF0 | 0), // ADDI sign-extends so 0xF0 = 240
  encode_addi(a1, x0, 0x0F),
  encode_or(a4, a0, a1),
  encode_addi(a2, x0, 0xFF),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// XOR: 0xFF ^ 0xFF = 0
test('R-Type', 'XOR', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 0x7f),
  encode_xor(a4, a0, a0),         // XOR with itself = 0
  encode_beq(a4, x0, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// SLL: 1 << 4 = 16
test('R-Type', 'SLL', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 1),
  encode_addi(a1, x0, 4),
  encode_sll(a4, a0, a1),
  encode_addi(a2, x0, 16),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// SLL only uses low 5 bits of rs2: shift by 36 = shift by 4
test('R-Type', 'SLL uses only low 5 bits of rs2', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 1),
  encode_addi(a1, x0, 36),        // 36 & 31 = 4
  encode_sll(a4, a0, a1),         // should be 1<<4 = 16
  encode_addi(a2, x0, 16),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// SRL: 0x80 >> 3 = 0x10 (zero fill)
test('R-Type', 'SRL zero-fills', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 0x80),
  encode_addi(a1, x0, 3),
  encode_srl(a4, a0, a1),
  encode_addi(a2, x0, 0x10),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// SRA: -1 >> 1 = -1 (sign fills)
test('R-Type', 'SRA sign-fills', fw(
  SET_UART_A5,
  encode_addi(a0, x0, -1),        // a0 = 0xFFFFFFFF
  encode_addi(a1, x0, 1),
  encode_sra(a4, a0, a1),         // a4 = 0xFFFFFFFF (-1)
  encode_addi(a2, x0, -1),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// SLT: -1 < 0 = 1 (signed)
test('R-Type', 'SLT signed -1 < 0', fw(
  SET_UART_A5,
  encode_addi(a0, x0, -1),        // a0 = -1
  encode_slt(a4, a0, x0),         // a4 = (-1 < 0) = 1
  encode_addi(a2, x0, 1),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// SLT: 0x7FFFFFFF not < -1 (unsigned large but signed small)
test('R-Type', 'SLT signed: large pos not < -1', fw(
  SET_UART_A5,
  encode_lui(a0, 0x7ffff),
  encode_addi(a0, a0, 0x7ff),     // a0 = 0x7FFFFFFF (MAX_INT)
  encode_addi(a1, x0, -1),        // a1 = -1
  encode_slt(a4, a0, a1),         // 0x7FFFFFFF < -1? No → a4 = 0
  encode_beq(a4, x0, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// SLTU: 0xFFFFFFFF > 1 unsigned → sltu(1, 0xFFFFFFFF) = 1
test('R-Type', 'SLTU unsigned', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 1),
  encode_addi(a1, x0, -1),        // a1 = 0xFFFFFFFF
  encode_sltu(a4, a0, a1),        // 1 <u 0xFFFFFFFF → 1
  encode_addi(a2, x0, 1),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// ── I-Type ALU ────────────────────────────────────────────────────────────────

// ADDI negative immediate: imm=-1 sign-extended
test('I-Type', 'ADDI negative imm', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 5),
  encode_addi(a4, a0, -1),        // a4 = 4
  encode_addi(a2, x0, 4),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// ADDI imm=-2048 (most negative 12-bit signed)
test('I-Type', 'ADDI imm min', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 0),
  encode_addi(a4, a0, -2048),     // a4 = -2048
  encode_addi(a2, x0, -2048),     // a2 = -2048 (sign extended from 12 bit)
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// SLTI: signed compare with negative immediate
test('I-Type', 'SLTI signed', fw(
  SET_UART_A5,
  encode_addi(a0, x0, -5),        // a0 = -5
  encode_slti(a4, a0, -1),        // -5 < -1 → 1
  encode_addi(a2, x0, 1),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// SLTIU: unsigned — 0 <u 0xFFF (sign-extended to 0xFFFFFFFF) → 1
test('I-Type', 'SLTIU unsigned', fw(
  SET_UART_A5,
  encode_sltiu(a4, x0, -1),       // 0 <u 0xFFFFFFFF → 1
  encode_addi(a2, x0, 1),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// XORI with -1 (all ones) = bitwise NOT
test('I-Type', 'XORI bitwise NOT', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 0x55),
  encode_xori(a4, a0, -1),        // ~0x55 = 0xFFFFFFAA
  encode_lui(a2, 0xfffff),
  encode_ori(a2, a2, 0xfaa),      // a2 = 0xffffffaa
  // Actually: 0xFFFFFFAA. Let's do: a4 should equal ~0x55 = 0xffffffaa
  // But 0xffffffaa is too complex to construct with ADDI. Use XOR to verify instead.
  encode_xor(a4, a4, a0),         // should give 0xffffffff = -1
  encode_addi(a2, x0, -1),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// SLLI/SRLI/SRAI
test('I-Type', 'SLLI', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 1),
  encode_slli(a4, a0, 7),         // a4 = 128
  encode_addi(a2, x0, 128),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

test('I-Type', 'SRLI zero-fills', fw(
  SET_UART_A5,
  encode_addi(a0, x0, -1),        // 0xFFFFFFFF
  encode_srli(a4, a0, 28),        // 0x0000000F
  encode_addi(a2, x0, 15),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

test('I-Type', 'SRAI sign-fills', fw(
  SET_UART_A5,
  encode_addi(a0, x0, -1),        // 0xFFFFFFFF
  encode_srai(a4, a0, 4),         // stays 0xFFFFFFFF
  encode_addi(a2, x0, -1),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// ── U-Type ────────────────────────────────────────────────────────────────────

// LUI: lower 12 bits are zero
test('U-Type', 'LUI lower 12 zero', fw(
  SET_UART_A5,
  encode_lui(a4, 1),              // a4 = 0x00001000
  // Use SLLI by 20 then SRLI by 20 to isolate lower 12 bits (ANDI sign-extends imm)
  encode_slli(a0, a4, 20),        // shift lower 12 up
  encode_srli(a0, a0, 20),        // back down = low 12 bits of a4
  encode_beq(a0, x0, 12),         // should be 0
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// LUI imm=0: rd = 0
test('U-Type', 'LUI imm=0', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 42),        // preload a0
  encode_lui(a0, 0),              // a0 = 0
  encode_beq(a0, x0, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// LUI rd=x0: write discarded
test('U-Type', 'LUI rd=x0 discarded', fw(
  SET_UART_A5,
  encode_lui(x0, 0xfffff),        // attempt to write x0
  encode_beq(x0, x0, 12),          // x0==0 should be true
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// AUIPC imm=0: rd = PC of the instruction
// AUIPC is at word index 1 (after SET_UART_A5), so PC = 4
test('U-Type', 'AUIPC imm=0 = PC', fw(
  SET_UART_A5,                    // [0x00]
  encode_auipc(a0, 0),            // [0x04] a0 = 0x04
  encode_addi(a2, x0, 4),
  encode_beq(a0, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// AUIPC: rd = PC + (imm << 12)
// AUIPC at [0x04], imm=1 → rd = 0x04 + 0x1000 = 0x1004
test('U-Type', 'AUIPC basic', fw(
  SET_UART_A5,                    // [0x00]
  encode_auipc(a0, 1),            // [0x04] a0 = 0x1004
  encode_lui(a2, 1),              // a2 = 0x1000
  encode_addi(a2, a2, 4),         // a2 = 0x1004
  encode_beq(a0, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// ── Loads ─────────────────────────────────────────────────────────────────────
// Store a known word to DMEM, then load subword and verify.
// DMEM base = 0x10000

// LW round-trip
test('Load', 'LW aligned', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),           // t0 = 0x10000 (DMEM)
  encode_addi(a0, x0, 0x42),
  encode_sw(t0, a0, 0),           // dmem[0] = 0x42
  encode_lw(a4, t0, 0),           // load it back
  NOP, NOP, NOP,
  encode_beq(a4, a0, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// LH sign-extends bit 15: store 0x8000, load as LH → should be -32768 (0xFFFF8000)
test('Load', 'LH sign-extends negative halfword', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_lui(a0, 0x80000),        // a0 = 0x80000000... no. Need 0x8000 in low 16.
  // Store the word 0x00008000 to dmem
  encode_addi(a0, x0, 1),
  encode_slli(a0, a0, 15),        // a0 = 0x8000
  encode_sw(t0, a0, 0),
  encode_lh(a4, t0, 0),           // LH → sign-extend bit15 → 0xFFFF8000
  NOP, NOP, NOP,
  // a4 should be negative: check via SLT a4, x0 (a4 < 0 → 1)
  encode_slt(a2, a4, x0),         // a4 < 0? yes → a2=1
  encode_addi(a3, x0, 1),
  encode_beq(a2, a3, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// LHU zero-extends: 0x8000 → 0x00008000 (positive)
test('Load', 'LHU zero-extends', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(a0, x0, 1),
  encode_slli(a0, a0, 15),        // a0 = 0x8000
  encode_sw(t0, a0, 0),
  encode_lhu(a4, t0, 0),
  NOP, NOP, NOP,
  // a4 should be positive (0x8000)
  encode_slt(a2, x0, a4),         // 0 < a4? yes → 1
  encode_addi(a3, x0, 1),
  encode_beq(a2, a3, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// LB sign-extends bit 7: 0x80 → -128
test('Load', 'LB sign-extends', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(a0, x0, 1),
  encode_slli(a0, a0, 7),         // a0 = 0x80
  encode_sw(t0, a0, 0),
  encode_lb(a4, t0, 0),
  NOP, NOP, NOP,
  encode_slt(a2, a4, x0),         // a4 < 0 → 1
  encode_addi(a3, x0, 1),
  encode_beq(a2, a3, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// LBU zero-extends: 0x80 → 0x80 (positive)
test('Load', 'LBU zero-extends', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(a0, x0, 0x80),
  encode_sw(t0, a0, 0),
  encode_lbu(a4, t0, 0),
  NOP, NOP, NOP,
  encode_slt(a2, x0, a4),         // 0 < a4 → 1
  encode_addi(a3, x0, 1),
  encode_beq(a2, a3, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// LBU byte offsets 0/1/2/3: store bytes A/B/C/D, load each back, send via UART
// Use s0 for DMEM base because POLL_SEND clobbers t0
test('Load', 'LBU all byte offsets', fw(
  SET_UART_A5,
  encode_lui(s0, 0x10),           // s0 = DMEM (0x10000)
  encode_addi(a0, x0, 0x41),
  encode_sw(s0, a0, 0),           // dmem[0] = 0x00000041 (clears word, byte0='A')
  encode_addi(a0, x0, 0x42),
  encode_sb(s0, a0, 1),           // byte1='B'
  encode_addi(a0, x0, 0x43),
  encode_sb(s0, a0, 2),           // byte2='C'
  encode_addi(a0, x0, 0x44),
  encode_sb(s0, a0, 3),           // byte3='D'
  encode_lbu(a4, s0, 0), NOP, NOP, NOP, POLL_SEND,
  encode_lbu(a4, s0, 1), NOP, NOP, NOP, POLL_SEND,
  encode_lbu(a4, s0, 2), NOP, NOP, NOP, POLL_SEND,
  encode_lbu(a4, s0, 3), NOP, NOP, NOP, POLL_SEND,
  HALT,
), [0x41, 0x42, 0x43, 0x44], 800);

// LBU negative offset
test('Load', 'LBU negative offset', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(t0, t0, 4),         // t0 = 0x10004
  encode_addi(a0, x0, 0x55),
  encode_sb(t0, a0, -1),          // dmem[0x10003] = 0x55
  encode_lbu(a4, t0, -1),         // load byte at -1(t0) = dmem[0x10003]
  NOP, NOP, NOP,
  encode_addi(a2, x0, 0x55),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// ── Stores ────────────────────────────────────────────────────────────────────

// SH stores only lower 16 bits, leaves upper 16 untouched
test('Store', 'SH preserves upper bytes', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  // Init word to 0xDEADBEEF
  encode_lui(a0, 0xdeadc),        // upper bits
  encode_addi(a0, a0, -273),      // ~0xBEEF offset (signed: 0xEEF = -273? Let's be simpler)
  // Actually just use 0x12345678 which is easier
  encode_lui(a0, 0x12345),
  encode_ori(a0, a0, 0x678),      // a0 = 0x12345678
  encode_sw(t0, a0, 0),           // store full word
  // Now SH with 0xABCD
  encode_addi(a1, x0, 1),
  encode_slli(a1, a1, 11),
  encode_ori(a1, a1, 0x7cd),      // a1 = 0xABCD? Let's just use a simple value
  // Simpler: store 0x00FF with SH
  encode_addi(a1, x0, 0xFF),
  encode_sh(t0, a1, 0),           // overwrite lower 16 bits with 0x00FF
  encode_lw(a4, t0, 0),           // load full word back
  NOP, NOP, NOP,
  // Upper 16 should still be 0x1234, lower 16 = 0x00FF → 0x123400FF
  encode_lui(a2, 0x12340),        // a2 = 0x12340000
  encode_ori(a2, a2, 0x0ff),      // a2 = 0x123400FF
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// SB: all 4 lanes — verify each byte individually (avoid ORI sign-extension pitfalls)
test('Store', 'SB all byte lanes', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_sw(t0, x0, 0),           // clear word
  encode_addi(a0, x0, 0x1A),
  encode_sb(t0, a0, 0),
  encode_addi(a0, x0, 0x2B),
  encode_sb(t0, a0, 1),
  encode_addi(a0, x0, 0x3C),
  encode_sb(t0, a0, 2),
  encode_addi(a0, x0, 0x4D),
  encode_sb(t0, a0, 3),
  // Verify byte 0 = 0x1A
  encode_lbu(a4, t0, 0),
  NOP, NOP, NOP,
  encode_addi(a2, x0, 0x1A),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// ── Branches ─────────────────────────────────────────────────────────────────

// BEQ taken
test('Branch', 'BEQ taken', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 5),
  encode_addi(a1, x0, 5),
  encode_beq(a0, a1, 12),          // taken: skip F
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// BEQ not-taken: instruction after BEQ executes
test('Branch', 'BEQ not-taken: next instr executes', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 5),
  encode_addi(a1, x0, 6),
  encode_beq(a0, a1, 12),         // not-taken: skip next 2 words
  encode_addi(a4, x0, P),         // THIS should execute
  POLL_SEND,
  encode_addi(a4, x0, F),         // this should be skipped
  POLL_SEND,
  HALT,
), [P]);

// BNE taken
test('Branch', 'BNE taken', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 1),
  encode_addi(a1, x0, 2),
  encode_bne(a0, a1, 12),          // taken: skip F
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// BLT: signed -1 < 0
test('Branch', 'BLT signed', fw(
  SET_UART_A5,
  encode_addi(a0, x0, -1),        // -1
  encode_blt(a0, x0, 12),          // -1 < 0: taken
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// BLT: 0x7FFFFFFF not < -1 (signed)
test('Branch', 'BLT signed: large positive not < -1', fw(
  SET_UART_A5,
  encode_lui(a0, 0x7ffff),
  encode_addi(a0, a0, 0x7ff),     // a0 = 0x7FFFFFFF
  encode_addi(a1, x0, -1),
  encode_blt(a0, a1, 12),         // not taken — skip P, land on F
  encode_addi(a4, x0, P), encode_jal(x0, 8), encode_addi(a4, x0, F),
  POLL_SEND, HALT,
), [P]);

// BGE: equal case (taken)
test('Branch', 'BGE equal', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 3),
  encode_bge(a0, a0, 12),          // 3 >= 3: taken
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// BLTU: 0 <u 0xFFFFFFFF
test('Branch', 'BLTU unsigned', fw(
  SET_UART_A5,
  encode_addi(a1, x0, -1),        // 0xFFFFFFFF
  encode_bltu(x0, a1, 12),         // 0 <u 0xFFFFFFFF: taken
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// BGEU: 0xFFFFFFFF >=u 0
test('Branch', 'BGEU unsigned', fw(
  SET_UART_A5,
  encode_addi(a0, x0, -1),
  encode_bgeu(a0, x0, 12),         // 0xFFFFFFFF >=u 0: taken
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// Backward branch loop: count 3 times, send 'P' each
test('Branch', 'Backward branch loop', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 3),         // counter
  // loop: [word N]
  encode_addi(a4, x0, P),
  POLL_SEND,                       // send 'P'
  encode_addi(a0, a0, -1),
  encode_bne(a0, x0, -(4 * (POLL_SEND.length + 3))), // back to addi a4
  HALT,
), [P, P, P], 600);

// Max-range forward branch (+4094 bytes = 1023 instructions * 4 + 2, but we need ≤512 words)
// We'll test +1022 bytes (255 nops + 1 branch) to stay within IMEM
// Actually IMEM is 512 words = 2048 bytes, so max forward is ~+2040
// Let's test a branch that skips a large block
test('Branch', 'Forward branch max range (skip large block)', fw(
  SET_UART_A5,
  encode_beq(x0, x0, 4 * 40),    // skip 40 words forward
  ...Array(40).fill(encode_addi(a4, x0, F)), // 40 fail instructions
  encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// Max-range backward branch (−4096 bytes): pad with nops so branch lands at a valid address
// We'll just test a backward branch of -8 (minimum backward, already tested above)
// For -4096 we'd need 1024 nops — too big for IMEM. Test -200 bytes instead.
test('Branch', 'Backward branch large offset', (() => {
  const nopCount = 48; // 48 nops = 192 bytes, branch offset = -(4*(nopCount+2))
  const offset = -(4 * (nopCount + 2)); // backward over nops + beq + addi
  return fw(
    SET_UART_A5,
    encode_addi(a0, x0, 1),       // first pass flag
    ...Array(nopCount).fill(NOP),
    // On first pass a0=1, bne taken → skip F, go back before nops
    encode_bne(a0, x0, 8),        // if a0!=0 skip next
    encode_jal(x0, 12),           // jump to F (shouldn't execute first pass)
    encode_addi(a0, x0, 0),       // clear flag so second pass falls through
    encode_bne(a0, x0, offset),   // backward branch (a0==0 now: not taken)
    encode_addi(a4, x0, P),
    POLL_SEND, HALT,
  );
})(), [P]);

// ── Jumps ─────────────────────────────────────────────────────────────────────

// JAL: rd = PC+4, correct jump target
test('Jump', 'JAL basic', fw(
  SET_UART_A5,                    // [0x00]
  encode_jal(a0, 12),             // [0x04] jump to [0x10], a0 = 0x08
  encode_addi(a4, x0, F),         // [0x08] should be skipped
  encode_jal(x0, 16),             // [0x0C] should be skipped
  encode_addi(a2, x0, 8),         // [0x10] check a0 == 8
  encode_beq(a0, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// JAL rd=x0: jump with no return (x0 stays 0)
test('Jump', 'JAL rd=x0', fw(
  SET_UART_A5,
  encode_jal(x0, 8),              // pc=0x04: jump to pc=0x0C (skip 1 instr)
  encode_addi(a4, x0, F),         // pc=0x08: skipped
  encode_addi(a4, x0, P),         // pc=0x0C: a4=P, then fall through to POLL_SEND
  POLL_SEND, HALT,
), [P]);

// JALR: next PC = (rs1 + imm) & ~1
test('Jump', 'JALR basic', fw(
  SET_UART_A5,
  // Compute target address: instruction at [0x14] (word 5)
  encode_addi(a1, x0, 0x10),      // [0x04] a1 = 0x10
  encode_jalr(a0, a1, 4),         // [0x08] jump to 0x14, a0 = 0x0C
  encode_addi(a4, x0, F),         // [0x0C] skipped
  encode_jal(x0, 16),             // [0x10] skipped
  encode_addi(a2, x0, 0x0C),      // [0x14] check a0 == 0x0C
  encode_beq(a0, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// JALR forces LSB to 0 (odd target → rounded down)
test('Jump', 'JALR LSB forced to 0', fw(
  SET_UART_A5,                    // pc=0x00
  encode_addi(a1, x0, 0x11),      // pc=0x04: a1 = 0x11 (odd)
  encode_jalr(a0, a1, -1),        // pc=0x08: target = (0x11-1) & ~1 = 0x10
  encode_addi(a4, x0, F),         // pc=0x0C: skipped
  encode_addi(a4, x0, P),         // pc=0x10: lands here
  POLL_SEND, HALT,
), [P]);

// JALR with rs1 == rd: target must use OLD rs1 before rd is written
// jalr ra, ra, 0: target = ra_old, then rd=ra = PC+4 (but we jumped away first)
test('Jump', 'JALR rs1==rd uses old rs1', fw(
  SET_UART_A5,                    // pc=0x00
  encode_addi(ra, x0, 0x10),      // pc=0x04: ra = 0x10 (jalr target)
  encode_jalr(ra, ra, 0),         // pc=0x08: target = 0x10 from OLD ra; rd writes 0x0C to ra
  encode_addi(a4, x0, F),         // pc=0x0C: skipped
  encode_addi(a4, x0, P),         // pc=0x10: lands here if old rs1 was used
  POLL_SEND, HALT,
), [P]);

// JALR with negative immediate
test('Jump', 'JALR negative imm', fw(
  SET_UART_A5,
  encode_addi(a1, x0, 0x20),      // [0x04] a1 = 0x20
  encode_jalr(a0, a1, -4),        // [0x08] target = 0x1C
  encode_addi(a4, x0, F),         // [0x0C]
  encode_jal(x0, 16),             // [0x10]
  encode_addi(a4, x0, F),         // [0x14]
  encode_addi(a4, x0, F),         // [0x18]
  encode_addi(a4, x0, P),         // [0x1C] ← jumped here
  POLL_SEND, HALT,
), [P]);

// ── x0 hardwiring ─────────────────────────────────────────────────────────────

test('x0', 'Write x0 via ADDI is ignored', fw(
  SET_UART_A5,
  encode_addi(x0, x0, 1),         // try to set x0 = 1
  encode_beq(x0, x0, 12),          // x0 should still be 0
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

test('x0', 'Write x0 via LW is ignored', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(a0, x0, 42),
  encode_sw(t0, a0, 0),
  encode_lw(x0, t0, 0),           // try to load into x0
  NOP, NOP, NOP,
  encode_beq(x0, x0, 12),          // x0 == 0 still
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// ── Hazards ───────────────────────────────────────────────────────────────────

// Load-use stall: LW then use as rs1
test('Hazard', 'Load-use stall rs1', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(a0, x0, 0x42),
  encode_sw(t0, a0, 0),
  encode_lw(a1, t0, 0),           // load a1 = 0x42
  encode_addi(a4, a1, 0),         // use a1 as rs1 immediately (load-use hazard)
  NOP, NOP, NOP,
  encode_addi(a2, x0, 0x42),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// Load-use stall: LW then use as rs2
test('Hazard', 'Load-use stall rs2', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(a0, x0, 10),
  encode_sw(t0, a0, 0),
  encode_lw(a1, t0, 0),           // a1 = 10
  encode_add(a4, x0, a1),         // a1 is rs2 — load-use hazard on rs2
  NOP, NOP, NOP,
  encode_addi(a2, x0, 10),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// EX/MEM forward rs1: result of previous ALU op used immediately
test('Hazard', 'EX/MEM forward rs1', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 10),
  encode_addi(a0, a0, 5),         // a0 = 15 (forwarded from EX/MEM)
  encode_addi(a4, a0, 0),         // use a0 immediately
  NOP, NOP, NOP,
  encode_addi(a2, x0, 15),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// EX/MEM forward rs2: result used as rs2
test('Hazard', 'EX/MEM forward rs2', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 10),
  encode_addi(a1, x0, 5),         // a1 = 5
  encode_add(a4, a0, a1),         // a4 = 15, a1 forwarded as rs2
  NOP, NOP, NOP,
  encode_addi(a2, x0, 15),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// MEM/WB forward: result 2 cycles back
test('Hazard', 'MEM/WB forward rs1', fw(
  SET_UART_A5,
  encode_addi(a0, x0, 10),
  NOP,                             // 1 nop between
  encode_addi(a4, a0, 0),         // use a0 (MEM/WB forward)
  NOP, NOP, NOP,
  encode_addi(a2, x0, 10),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// WB bypass to ID: LUI in WB, branch uses result
test('Hazard', 'WB bypass LUI to branch', fw(
  SET_UART_A5,
  encode_lui(a0, 1),              // a0 = 0x1000
  NOP, NOP,                        // 2 nops: LUI reaches WB
  encode_bne(a0, x0, 12),          // a0 should be 0x1000 ≠ 0: taken
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// Jump flush: instruction after JAL does NOT execute
test('Hazard', 'JAL flush: instruction after JAL skipped', fw(
  SET_UART_A5,
  encode_jal(x0, 8),              // pc=0x04: jump to pc=0x0C
  encode_addi(a4, x0, F),         // pc=0x08: must be flushed/skipped
  encode_addi(a4, x0, P),         // pc=0x0C: jump lands here
  POLL_SEND, HALT,
), [P]);

// Branch-taken flush: instruction fetched after taken branch does NOT execute
test('Hazard', 'Branch-taken flush', fw(
  SET_UART_A5,
  encode_beq(x0, x0, 8),          // taken: jump +8 bytes (skip 1 instr)
  encode_addi(a4, x0, F),         // must NOT execute
  encode_addi(a4, x0, P),         // lands here
  POLL_SEND, HALT,
), [P]);

// Load-use stall + forwarding combo
test('Hazard', 'Load-use stall then forward', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(a0, x0, 7),
  encode_sw(t0, a0, 0),
  encode_lw(a1, t0, 0),           // a1 = 7 (stall)
  encode_addi(a1, a1, 3),         // a1 = 10 (forward from stall result)
  encode_addi(a4, a1, 0),         // a4 = 10 (forward again)
  NOP, NOP, NOP,
  encode_addi(a2, x0, 10),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// ── System instructions ───────────────────────────────────────────────────────

// FENCE: should not corrupt surrounding stores
test('System', 'FENCE does not corrupt pipeline', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(a0, x0, 0x41),
  encode_sw(t0, a0, 0),           // store 'A'
  FENCE,
  encode_addi(a0, x0, 0x42),
  encode_sw(t0, a0, 0),           // store 'B' (overwrites)
  encode_lw(a4, t0, 0),           // load: should be 'B'
  NOP, NOP, NOP,
  encode_addi(a2, x0, 0x42),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// ECALL: surrounding stores must both land (ECALL treated as NOP or halts — test pre-ECALL only)
test('System', 'ECALL does not corrupt state before it', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(a0, x0, P),
  encode_sw(t0, a0, 0),           // dmem[0] = 'P'
  ECALL,                           // whatever this does
  encode_lw(a4, t0, 0),           // if ECALL was NOP, load still works
  NOP, NOP, NOP,
  encode_addi(a2, x0, P),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P], 100); // short cycle limit: if ECALL loops forever this fails fast

// EBREAK: same contract as ECALL
test('System', 'EBREAK does not corrupt state before it', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(a0, x0, P),
  encode_sw(t0, a0, 0),
  EBREAK,
  encode_lw(a4, t0, 0),
  NOP, NOP, NOP,
  encode_addi(a2, x0, P),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P], 100);

// ── Misalignment ─────────────────────────────────────────────────────────────
// Goal: pin behavior (doesn't corrupt surrounding stores, doesn't crash pipeline)

// Misaligned LW: address % 4 != 0 — verify surrounding stores unaffected
test('Misalign', 'Misaligned LW does not corrupt pipeline', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(a0, x0, P),
  encode_sw(t0, a0, 0),           // store P at aligned addr
  encode_lw(a1, t0, 1),           // misaligned load (byte offset 1)
  NOP, NOP, NOP,
  // We don't check a1's value (undefined), just that the next store lands
  encode_lw(a4, t0, 0),           // load aligned: should still be P
  NOP, NOP, NOP,
  encode_addi(a2, x0, P),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// Misaligned SW: address % 4 != 0
test('Misalign', 'Misaligned SW does not corrupt aligned neighbor', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(a0, x0, P),
  encode_sw(t0, a0, 0),           // aligned store P at 0x10000
  encode_addi(a0, x0, 0x99),
  encode_sw(t0, a0, 1),           // misaligned sw to 0x10001
  encode_lbu(a4, t0, 0),          // byte0 of 0x10000 should still be P (0x50)
  NOP, NOP, NOP,
  encode_addi(a2, x0, P),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// Misaligned LH: address % 2 != 0
test('Misalign', 'Misaligned LH does not corrupt pipeline', fw(
  SET_UART_A5,
  encode_lui(t0, 0x10),
  encode_addi(a0, x0, P),
  encode_sw(t0, a0, 0),
  encode_lh(a1, t0, 1),           // misaligned halfword load
  NOP, NOP, NOP,
  encode_lw(a4, t0, 0),           // aligned load should still work
  NOP, NOP, NOP,
  encode_addi(a2, x0, P),
  encode_beq(a4, a2, 12),
  encode_addi(a4, x0, F), encode_jal(x0, 8), encode_addi(a4, x0, P),
  POLL_SEND, HALT,
), [P]);

// ── Run (CLI only — not executed when imported) ──────────────────────────────

if (import.meta.main) {
  const filter = process.argv[2]?.startsWith('--filter=')
    ? process.argv[2].slice('--filter='.length).toLowerCase()
    : null;

  const selected = filter
    ? tests.filter(t => `${t.category} ${t.name}`.toLowerCase().includes(filter))
    : tests;

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  let lastCategory = '';

  console.log('\nRV32I Test Suite');
  console.log('================');

  for (const t of selected) {
    if (t.category !== lastCategory) {
      console.log(`\n${t.category}`);
      lastCategory = t.category;
    }

    const label = `  ${t.name}`;
    let actual: number[];
    try {
      actual = runFirmware(t.firmware, t.maxCycles ?? 300);
    } catch (e) {
      console.log(`${label.padEnd(52)} ERROR: ${e}`);
      failed++;
      failures.push(`${t.category} / ${t.name}: threw ${e}`);
      continue;
    }

    const ok = actual.length >= t.expected.length &&
      t.expected.every((b, i) => actual[i] === b);

    if (ok) {
      console.log(`${label.padEnd(52)} PASS`);
      passed++;
    } else {
      const exp = t.expected.map(b => `0x${b.toString(16).padStart(2,'0')}`).join(' ');
      const got = actual.slice(0, t.expected.length + 2).map(b => `0x${b.toString(16).padStart(2,'0')}`).join(' ');
      console.log(`${label.padEnd(52)} FAIL  expected [${exp}] got [${got}]`);
      failed++;
      failures.push(`${t.category} / ${t.name}`);
    }
  }

  console.log(`\n${passed}/${passed + failed} passed`);
  if (failures.length) {
    console.log('\nFailed:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

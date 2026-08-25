/**
 * RV32I instruction explainer.
 * Given a disassembly line like "li a4,10" or "bnez a4,1c <main+0xc>",
 * returns a plain-English explanation.
 */

import { ABI_NAMES } from './useRV32IDebugger';

/** Format a register name nicely, e.g. "a0", "sp", "zero" */
function reg(r: string): string {
  // Already an ABI name (a0, sp, ra, etc.), so just return it
  // In case of x0-x31 numeric form, convert
  const numMatch = r.match(/^x(\d+)$/);
  if (numMatch) {
    return ABI_NAMES[parseInt(numMatch[1])] ?? r;
  }
  return r;
}

/** Strip label suffix from branch targets, e.g. "1c <main+0xc>" → "0x1c" */
function addr(a: string): string {
  const raw = a.split(' ')[0];
  return '0x' + raw.replace(/^0x/, '');
}

/** Parse comma-separated operands, ignoring label suffixes on the last one */
function ops(operands: string): string[] {
  return operands.split(',').map((o) => o.trim());
}

export function explainInstruction(instruction: string): string | null {
  if (!instruction) return null;

  const match = instruction.match(/^(\S+)\s+(.*)/s);
  if (!match) {
    return NOARG[instruction.trim()] ?? null;
  }

  const mnemonic = match[1];
  const operandStr = match[2].trim();
  const o = ops(operandStr);

  // Try exact mnemonic match first, then prefix match
  const handler = HANDLERS[mnemonic] ?? findPrefixHandler(mnemonic);
  if (!handler) return null;
  return handler(mnemonic, o);
}

// No-operand instructions
const NOARG: Record<string, string> = {
  ret: 'Return from function: jump to the address in ra (return address register).',
  nop: 'No operation; does nothing for one cycle.',
  ecall: 'Environment call: requests a service from the operating system.',
  ebreak: 'Breakpoint: transfers control to the debugger.',
  fence: 'Memory fence: ensures all memory operations before this complete before those after.',
  wfi: 'Wait for interrupt: halts the CPU until an interrupt occurs.',
};

type Handler = (mnemonic: string, o: string[]) => string;

const HANDLERS: Record<string, Handler> = {
  // --- Loads ---
  li: (_, o) => `Load immediate: set ${reg(o[0])} = ${o[1]}.`,
  la: (_, o) => `Load address: set ${reg(o[0])} to the address of ${o[1]}.`,
  lw: (_, o) => `Load word: read 32 bits from memory at [${o[1]}] into ${reg(o[0])}.`,
  lh: (_, o) => `Load halfword: read 16 bits (sign-extended) from [${o[1]}] into ${reg(o[0])}.`,
  lhu: (_, o) =>
    `Load halfword unsigned: read 16 bits (zero-extended) from [${o[1]}] into ${reg(o[0])}.`,
  lb: (_, o) => `Load byte: read 8 bits (sign-extended) from [${o[1]}] into ${reg(o[0])}.`,
  lbu: (_, o) =>
    `Load byte unsigned: read 8 bits (zero-extended) from [${o[1]}] into ${reg(o[0])}.`,

  // --- Stores ---
  sw: (_, o) => `Store word: write 32 bits from ${reg(o[0])} to memory at [${o[1]}].`,
  sh: (_, o) => `Store halfword: write low 16 bits of ${reg(o[0])} to memory at [${o[1]}].`,
  sb: (_, o) => `Store byte: write low 8 bits of ${reg(o[0])} to memory at [${o[1]}].`,

  // --- Moves / copies ---
  mv: (_, o) => `Move: copy ${reg(o[1])} into ${reg(o[0])}.`,

  // --- Arithmetic ---
  add: (_, o) => `Add: ${reg(o[0])} = ${reg(o[1])} + ${reg(o[2])}.`,
  addi: (_, o) => `Add immediate: ${reg(o[0])} = ${reg(o[1])} + ${o[2]}.`,
  sub: (_, o) => `Subtract: ${reg(o[0])} = ${reg(o[1])} - ${reg(o[2])}.`,
  mul: (_, o) => `Multiply: ${reg(o[0])} = ${reg(o[1])} × ${reg(o[2])} (lower 32 bits).`,
  mulh: (_, o) =>
    `Multiply high: ${reg(o[0])} = upper 32 bits of ${reg(o[1])} × ${reg(o[2])} (signed).`,
  div: (_, o) => `Divide: ${reg(o[0])} = ${reg(o[1])} ÷ ${reg(o[2])} (signed).`,
  divu: (_, o) => `Divide unsigned: ${reg(o[0])} = ${reg(o[1])} ÷ ${reg(o[2])} (unsigned).`,
  rem: (_, o) => `Remainder: ${reg(o[0])} = ${reg(o[1])} mod ${reg(o[2])} (signed).`,
  remu: (_, o) => `Remainder unsigned: ${reg(o[0])} = ${reg(o[1])} mod ${reg(o[2])} (unsigned).`,
  neg: (_, o) => `Negate: ${reg(o[0])} = −${reg(o[1])}.`,

  // --- Logic ---
  and: (_, o) => `Bitwise AND: ${reg(o[0])} = ${reg(o[1])} & ${reg(o[2])}.`,
  andi: (_, o) => `Bitwise AND immediate: ${reg(o[0])} = ${reg(o[1])} & ${o[2]}.`,
  or: (_, o) => `Bitwise OR: ${reg(o[0])} = ${reg(o[1])} | ${reg(o[2])}.`,
  ori: (_, o) => `Bitwise OR immediate: ${reg(o[0])} = ${reg(o[1])} | ${o[2]}.`,
  xor: (_, o) => `Bitwise XOR: ${reg(o[0])} = ${reg(o[1])} ^ ${reg(o[2])}.`,
  xori: (_, o) => `Bitwise XOR immediate: ${reg(o[0])} = ${reg(o[1])} ^ ${o[2]}.`,
  not: (_, o) => `Bitwise NOT: ${reg(o[0])} = ~${reg(o[1])}.`,

  // --- Shifts ---
  sll: (_, o) => `Shift left logical: ${reg(o[0])} = ${reg(o[1])} << ${reg(o[2])}.`,
  slli: (_, o) => `Shift left logical immediate: ${reg(o[0])} = ${reg(o[1])} << ${o[2]}.`,
  srl: (_, o) => `Shift right logical: ${reg(o[0])} = ${reg(o[1])} >> ${reg(o[2])} (zero-fill).`,
  srli: (_, o) =>
    `Shift right logical immediate: ${reg(o[0])} = ${reg(o[1])} >> ${o[2]} (zero-fill).`,
  sra: (_, o) =>
    `Shift right arithmetic: ${reg(o[0])} = ${reg(o[1])} >> ${reg(o[2])} (sign-extend).`,
  srai: (_, o) =>
    `Shift right arithmetic immediate: ${reg(o[0])} = ${reg(o[1])} >> ${o[2]} (sign-extend).`,

  // --- Comparisons ---
  slt: (_, o) =>
    `Set if less than: ${reg(o[0])} = 1 if ${reg(o[1])} < ${reg(o[2])} (signed), else 0.`,
  slti: (_, o) =>
    `Set if less than immediate: ${reg(o[0])} = 1 if ${reg(o[1])} < ${o[2]} (signed), else 0.`,
  sltu: (_, o) =>
    `Set if less than unsigned: ${reg(o[0])} = 1 if ${reg(o[1])} < ${reg(o[2])} (unsigned), else 0.`,
  sltiu: (_, o) =>
    `Set if less than immediate unsigned: ${reg(o[0])} = 1 if ${reg(o[1])} < ${o[2]} (unsigned), else 0.`,
  seqz: (_, o) => `Set if equal to zero: ${reg(o[0])} = 1 if ${reg(o[1])} == 0, else 0.`,
  snez: (_, o) => `Set if not equal to zero: ${reg(o[0])} = 1 if ${reg(o[1])} ≠ 0, else 0.`,
  sltz: (_, o) => `Set if less than zero: ${reg(o[0])} = 1 if ${reg(o[1])} < 0, else 0.`,
  sgtz: (_, o) => `Set if greater than zero: ${reg(o[0])} = 1 if ${reg(o[1])} > 0, else 0.`,

  // --- Branches ---
  beq: (_, o) => `Branch if equal: jump to ${addr(o[2])} if ${reg(o[0])} == ${reg(o[1])}.`,
  bne: (_, o) => `Branch if not equal: jump to ${addr(o[2])} if ${reg(o[0])} ≠ ${reg(o[1])}.`,
  blt: (_, o) =>
    `Branch if less than: jump to ${addr(o[2])} if ${reg(o[0])} < ${reg(o[1])} (signed).`,
  bge: (_, o) =>
    `Branch if greater or equal: jump to ${addr(o[2])} if ${reg(o[0])} ≥ ${reg(o[1])} (signed).`,
  bltu: (_, o) =>
    `Branch if less than unsigned: jump to ${addr(o[2])} if ${reg(o[0])} < ${reg(o[1])} (unsigned).`,
  bgeu: (_, o) =>
    `Branch if greater or equal unsigned: jump to ${addr(o[2])} if ${reg(o[0])} ≥ ${reg(o[1])} (unsigned).`,
  beqz: (_, o) => `Branch if zero: jump to ${addr(o[1])} if ${reg(o[0])} == 0.`,
  bnez: (_, o) => `Branch if not zero: jump to ${addr(o[1])} if ${reg(o[0])} ≠ 0.`,
  bltz: (_, o) => `Branch if negative: jump to ${addr(o[1])} if ${reg(o[0])} < 0.`,
  bgtz: (_, o) => `Branch if positive: jump to ${addr(o[1])} if ${reg(o[0])} > 0.`,
  blez: (_, o) => `Branch if ≤ zero: jump to ${addr(o[1])} if ${reg(o[0])} ≤ 0.`,
  bgez: (_, o) => `Branch if ≥ zero: jump to ${addr(o[1])} if ${reg(o[0])} ≥ 0.`,

  // --- Jumps ---
  jal: (_, o) =>
    o.length === 1
      ? `Jump: unconditionally jump to ${addr(o[0])}.`
      : `Jump and link: set ${reg(o[0])} = PC+4 (return address), then jump to ${addr(o[1])}.`,
  jalr: (_, o) => `Jump and link register: set ${reg(o[0])} = PC+4, then jump to ${o[1]}.`,
  j: (_, o) => `Jump: unconditionally jump to ${addr(o[0])}.`,
  jr: (_, o) => `Jump register: jump to the address in ${reg(o[0])}.`,
  call: (_, o) => `Call function at ${addr(o[0])}, saving the return address in ra.`,
  tail: (_, o) => `Tail call to ${addr(o[0])}, which does not save a return address.`,

  // --- Upper immediates ---
  lui: (_, o) => `Load upper immediate: set ${reg(o[0])} = ${o[1]} shifted left 12 bits.`,
  auipc: (_, o) =>
    `Add upper immediate to PC: ${reg(o[0])} = PC + (${o[1]} << 12). Used to compute addresses relative to the current instruction.`,
};

function findPrefixHandler(mnemonic: string): Handler | null {
  // Handle fence.i, etc.
  if (mnemonic.startsWith('fence'))
    return () => 'Memory fence: enforces ordering of memory operations.';
  return null;
}

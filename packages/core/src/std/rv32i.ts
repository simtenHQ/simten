/**
 * Standard Library — RISC-V (RV32I) Components
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';

export const RV32I_Decode = circuit('RV32I_Decode', {
  in: { instruction: bus(32) },
  out: { opcode: bus(7), rd: bus(5), funct3: bus(3), rs1: bus(5), rs2: bus(5), funct7: bus(7) },
  meta: { category: 'rv32i', description: 'RISC-V instruction decoder' },
});

export const RV32I_ALU = circuit('RV32I_ALU', {
  in: { a: bus(32), b: bus(32), alu_op: bus(4) },
  out: { result: bus(32), zero: bit },
  meta: { category: 'rv32i', description: 'RISC-V ALU' },
});

export const RV32I_ImmGen = circuit('RV32I_ImmGen', {
  in: { instruction: bus(32) },
  out: { immediate: bus(32) },
  meta: { category: 'rv32i', description: 'RISC-V immediate generator' },
});

export const RV32I_Control = circuit('RV32I_Control', {
  in: { opcode: bus(7), funct3: bus(3), funct7_bit: bit },
  out: { alu_op: bus(4), alu_src: bit, mem_read: bit, mem_write: bit, reg_write: bit, mem_to_reg: bit, branch: bit, jump: bit, lui: bit, auipc: bit, is_jalr: bit },
  meta: { category: 'rv32i', description: 'RISC-V control unit' },
});

export const RV32I_BranchComp = circuit('RV32I_BranchComp', {
  in: { a: bus(32), b: bus(32), funct3: bus(3) },
  out: { take_branch: bit },
  meta: { category: 'rv32i', description: 'RISC-V branch comparator' },
});

export const RV32I_RegisterFile = circuit('RV32I_RegisterFile', {
  in: { rs1: bus(5), rs2: bus(5), rd: bus(5), write_data: bus(32), we: bit },
  out: { read1: bus(32), read2: bus(32) },
  state: { memory: new Map<number, number>() },
  meta: { category: 'rv32i', description: 'RISC-V 32-register file' },
});

export const RV32I_InstrMem = circuit('RV32I_InstrMem', {
  in: { addr: bus(32) },
  out: { instruction: bus(32) },
  state: { memory: new Map<number, number>() },
  meta: { category: 'rv32i', description: 'RISC-V instruction memory' },
});

export const RV32I_DataMem = circuit('RV32I_DataMem', {
  in: { addr: bus(32), write_data: bus(32), mem_read: bit, mem_write: bit, funct3: bus(3) },
  out: { read_data: bus(32), misalign: bit },
  state: { memory: new Map<number, number>() },
  meta: { category: 'rv32i', description: 'RISC-V data memory with byte/half/word access' },
});

export const RV32I_WritebackMux = circuit('RV32I_WritebackMux', {
  in: { alu_result: bus(32), load_data: bus(32), pc_plus4: bus(32), immediate: bus(32), pc_plus_imm: bus(32), mem_to_reg: bit, lui: bit, auipc: bit, jump: bit },
  out: { write_data: bus(32) },
  meta: { category: 'rv32i', description: 'RISC-V writeback mux' },
});

export const RV32I_NextPCMux = circuit('RV32I_NextPCMux', {
  in: { pc_plus4: bus(32), branch_target: bus(32), jal_target: bus(32), jalr_target: bus(32), branch: bit, take_branch: bit, jump: bit, is_jalr: bit },
  out: { next_pc: bus(32) },
  meta: { category: 'rv32i', description: 'RISC-V next PC mux' },
});

export const RV32I_ForwardingUnit = circuit('RV32I_ForwardingUnit', {
  in: { id_rs1: bus(5), id_rs2: bus(5), ex_rd: bus(5), ex_reg_write: bit, mem_rd: bus(5), mem_reg_write: bit },
  out: { forward_a: bus(2), forward_b: bus(2) },
  meta: { category: 'rv32i', description: 'RISC-V data forwarding unit' },
});

export const RV32I_WBBypass = circuit('RV32I_WBBypass', {
  in: { rs_val: bus(32), rs_addr: bus(5), wb_val: bus(32), wb_rd: bus(5), wb_we: bit },
  out: { out: bus(32) },
  meta: { category: 'rv32i', description: 'RISC-V writeback bypass' },
});

export const RV32I_LoadAlign = circuit('RV32I_LoadAlign', {
  in: { data: bus(32), funct3: bus(3) },
  out: { out: bus(32) },
  meta: { category: 'rv32i', description: 'RISC-V load alignment (byte/half/word)' },
});

export const RV32I_HazardUnit = circuit('RV32I_HazardUnit', {
  in: { if_rs1: bus(5), if_rs2: bus(5), id_rd: bus(5), id_mem_read: bit, branch_taken: bit, jump: bit },
  out: { stall: bit, flush: bit },
  meta: { category: 'rv32i', description: 'RISC-V hazard detection unit' },
});

export const DualPortROM = circuit('DualPortROM', {
  in: { addrA: bus(32), addrB: bus(32) },
  out: { dataA: bus(32), dataB: bus(32) },
  state: { memory: new Map<number, number>() },
  meta: { category: 'memory', description: 'Dual-port read-only memory' },
});

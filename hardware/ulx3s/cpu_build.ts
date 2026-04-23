#!/usr/bin/env tsx
/**
 * Build RV32I CPU → UART bitstream for ULX3S 85K.
 *
 * Pipeline:
 *   1. Compile firmware/hello.c via compiler service → flat binary
 *   2. Convert binary to $readmemh hex format
 *   3. Export RV32I_CPU_Core to Verilog
 *   4. Combine with cpu_top.v wrapper
 *   5. Synthesise (Yosys synth_ecp5)
 *   6. Place-and-route + bitstream (nextpnr-ecp5 + ecppack)
 *   7. Flash if --flash
 *
 * Usage:
 *   tsx hardware/ulx3s/cpu_build.ts           — build only, writes cpu.bit
 *   tsx hardware/ulx3s/cpu_build.ts --flash   — build + flash via openFPGALoader
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import { exportVerilog } from '../../packages/core/src/verilog/exporter.js';
import { circuit, bit, bus } from '../../packages/core/src/circuit/index.js';
import {
  Constant, Register, Adder, BitSlice, Mux, And, Or, Not, BusAnd,
  RV32I_HazardUnit, RV32I_Decode, RV32I_ImmGen, RV32I_Control,
  RV32I_RegisterFile, RV32I_WBBypass, RV32I_ForwardingUnit, RV32I_ALU,
  RV32I_BranchComp, RV32I_WritebackMux, RV32I_NextPCMux, RV32I_LoadAlignFull,
} from '../../packages/core/src/std/index.js';
import type { CircuitLibrary } from '../../packages/core/src/types/circuit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COMPILER_URL = process.env.COMPILER_URL ?? 'https://compiler.charles-harris-de.workers.dev/compile';
const SYNTH_URL    = process.env.SYNTH_URL    ?? 'http://localhost:8792/synth';
const BUILD_URL    = process.env.BUILD_URL    ?? 'http://localhost:8792/build';

// Custom linker script: 2KB IMEM + 4KB DMEM (matches cpu_top.v declarations)
const LINKER_SCRIPT = `
OUTPUT_ARCH(riscv)
ENTRY(_start)

MEMORY {
    IMEM (rx)  : ORIGIN = 0x00000000, LENGTH = 2K
    DMEM (rwx) : ORIGIN = 0x00010000, LENGTH = 4K
}

SECTIONS {
    .text : {
        *(.text._start)
        *(.text*)
        *(.rodata*)
    } > IMEM

    .data : { *(.data*) } > DMEM

    .bss : {
        __bss_start = .;
        *(.bss*)
        *(COMMON)
        __bss_end = .;
    } > DMEM

    __stack_top = ORIGIN(DMEM) + LENGTH(DMEM);
}
`;

// ── Firmware compilation ────────────────────────────────────────────────────

async function compileFirmware(source: string, language: string = 'c'): Promise<Uint8Array> {
  console.log(`Compiling firmware (${language}) via compiler service...`);
  const resp = await fetch(COMPILER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source,
      language,
      linkerScript: LINKER_SCRIPT,
      disassemble: true,
    }),
  }).then(r => r.json()) as {
    success: boolean;
    binary?: string;   // base64-encoded flat binary
    disassembly?: string;
    stderr?: string;
    error?: string;
  };

  if (!resp.success) {
    console.error('Compilation failed:', resp.error ?? resp.stderr);
    process.exit(1);
  }

  if (resp.disassembly) {
    console.log('\n--- Disassembly ---');
    console.log(resp.disassembly.slice(0, 2000));
    console.log('---');
  }

  // Binary is base64-encoded flat binary from objcopy -O binary
  const binaryB64 = resp.binary!;
  const binary = Buffer.from(binaryB64, 'base64');
  console.log(`  Firmware: ${binary.length} bytes`);
  return new Uint8Array(binary);
}

// ── Flat binary → $readmemh hex ─────────────────────────────────────────────

function binaryToReadmemh(binary: Uint8Array, numWords: number = 512): string {
  const padded = new Uint8Array(numWords * 4);
  padded.set(binary.slice(0, Math.min(binary.length, numWords * 4)));

  const lines: string[] = [];
  for (let i = 0; i < numWords; i++) {
    const b0 = padded[i * 4 + 0];
    const b1 = padded[i * 4 + 1];
    const b2 = padded[i * 4 + 2];
    const b3 = padded[i * 4 + 3];
    const word = (b3 << 24 | b2 << 16 | b1 << 8 | b0) >>> 0;
    lines.push(word.toString(16).padStart(8, '0'));
  }
  return lines.join('\n') + '\n';
}

// ── Flat binary → Verilog inline initial block ───────────────────────────────
// More reliable than $readmemh: firmware is baked directly into the netlist.

function binaryToInlineInit(binary: Uint8Array, numWords: number = 512): string {
  const padded = new Uint8Array(numWords * 4);
  padded.set(binary.slice(0, Math.min(binary.length, numWords * 4)));

  const lines: string[] = ['    initial begin'];
  for (let i = 0; i < numWords; i++) {
    const b0 = padded[i * 4 + 0];
    const b1 = padded[i * 4 + 1];
    const b2 = padded[i * 4 + 2];
    const b3 = padded[i * 4 + 3];
    const word = (b3 << 24 | b2 << 16 | b1 << 8 | b0) >>> 0;
    if (word !== 0) {
      lines.push(`        imem[${i}] = 32'h${word.toString(16).padStart(8, '0')};`);
    }
  }
  lines.push('    end');
  return lines.join('\n');
}

// ── Circuit definition ──────────────────────────────────────────────────────

export function buildCPUCore() {
  // Full RV32I 5-stage pipelined core (copied from rv32i-board.circuit.ts)
  const RV32I_Core = circuit('RV32I_Core', {
    in: { instruction: bus(32), data_read: bus(32), net_rx_data: bus(32), net_rx_valid: bit, net_rx_frame: bit },
    out: { instr_addr: bus(32), data_addr: bus(32), data_write: bus(32), data_mem_read: bit, data_mem_write: bit, data_funct3: bus(3), net_tx_data: bus(32), net_tx_valid: bit, net_tx_frame: bit, pc_out: bus(32) },
    nodes: { four: Constant, zero32: Constant, zero5: Constant, zero4: Constant, zero3: Constant, zero1: Constant, one1: Constant, hazard: RV32I_HazardUnit, stall_inv: Not, pc: Register, pc_plus4: Adder, ifid_instr_mux: Mux, ifid_instr: Register, ifid_pc_mux: Mux, ifid_pc: Register, ifid_pc4_mux: Mux, ifid_pc4: Register, decode: RV32I_Decode, immgen: RV32I_ImmGen, control: RV32I_Control, funct7_splitter: BitSlice, regfile: RV32I_RegisterFile, ifid_decode_for_hazard: RV32I_Decode, idex_flush: Or, idex_pc: Register, idex_pc4: Register, wb_bypass1: RV32I_WBBypass, wb_bypass2: RV32I_WBBypass, idex_read1: Register, idex_read2: Register, idex_imm: Register, idex_rs1_mux: Mux, idex_rs1: Register, idex_rs2_mux: Mux, idex_rs2: Register, idex_rd_mux: Mux, idex_rd: Register, idex_funct3_mux: Mux, idex_funct3: Register, idex_alu_op_mux: Mux, idex_alu_op: Register, idex_alu_src_mux: Mux, idex_alu_src: Register, idex_mem_read_mux: Mux, idex_mem_read: Register, idex_mem_write_mux: Mux, idex_mem_write: Register, idex_reg_write_mux: Mux, idex_reg_write: Register, idex_mem_to_reg_mux: Mux, idex_mem_to_reg: Register, idex_branch_mux: Mux, idex_branch: Register, idex_jump_mux: Mux, idex_jump: Register, idex_lui_mux: Mux, idex_lui: Register, idex_auipc_mux: Mux, idex_auipc: Register, idex_is_jalr_mux: Mux, idex_is_jalr: Register, forward: RV32I_ForwardingUnit, fwd_a_bit0: BitSlice, fwd_a_bit1: BitSlice, fwd_a_mux1: Mux, fwd_a_mux2: Mux, fwd_b_bit0: BitSlice, fwd_b_bit1: BitSlice, fwd_b_mux1: Mux, fwd_b_mux2: Mux, alu_src_mux: Mux, alu: RV32I_ALU, branch_comp: RV32I_BranchComp, branch_target: Adder, jalr_target: BusAnd, jalr_mask: Constant, pc_plus_imm: Adder, ex_result: RV32I_WritebackMux, branch_and: And, next_pc: RV32I_NextPCMux, pc_src_taken: Or, pc_next_mux: Mux, exmem_alu_result: Register, exmem_result: Register, exmem_read2: Register, exmem_rd: Register, exmem_funct3: Register, exmem_pc4: Register, exmem_imm: Register, exmem_pc_plus_imm: Register, exmem_mem_read: Register, exmem_mem_write: Register, exmem_reg_write: Register, exmem_mem_to_reg: Register, exmem_lui: Register, exmem_auipc: Register, exmem_jump: Register, memwb_alu_result: Register, memwb_load_data: Register, memwb_rd: Register, memwb_pc4: Register, memwb_imm: Register, memwb_pc_plus_imm: Register, memwb_reg_write: Register, memwb_mem_to_reg: Register, memwb_lui: Register, memwb_auipc: Register, memwb_jump: Register, exmem_lo2: BitSlice, memwb_byte_offset: Register, memwb_funct3: Register, load_align: RV32I_LoadAlignFull, wb_mux: RV32I_WritebackMux },
    nodeArgs: { four: { value: 4, width: 32 }, zero32: { value: 0, width: 32 }, zero5: { value: 0, width: 5 }, zero4: { value: 0, width: 4 }, zero3: { value: 0, width: 3 }, zero1: { value: 0, width: 1 }, one1: { value: 1, width: 1 }, pc: { width: 32 }, pc_plus4: { width: 32 }, ifid_instr_mux: { width: 32 }, ifid_instr: { width: 32 }, ifid_pc_mux: { width: 32 }, ifid_pc: { width: 32 }, ifid_pc4_mux: { width: 32 }, ifid_pc4: { width: 32 }, funct7_splitter: { low: 5, high: 5 }, idex_pc: { width: 32 }, idex_pc4: { width: 32 }, idex_read1: { width: 32 }, idex_read2: { width: 32 }, idex_imm: { width: 32 }, idex_rs1_mux: { width: 5 }, idex_rs1: { width: 5 }, idex_rs2_mux: { width: 5 }, idex_rs2: { width: 5 }, idex_rd_mux: { width: 5 }, idex_rd: { width: 5 }, idex_funct3_mux: { width: 3 }, idex_funct3: { width: 3 }, idex_alu_op_mux: { width: 4 }, idex_alu_op: { width: 4 }, idex_alu_src_mux: { width: 1 }, idex_alu_src: { width: 1 }, idex_mem_read_mux: { width: 1 }, idex_mem_read: { width: 1 }, idex_mem_write_mux: { width: 1 }, idex_mem_write: { width: 1 }, idex_reg_write_mux: { width: 1 }, idex_reg_write: { width: 1 }, idex_mem_to_reg_mux: { width: 1 }, idex_mem_to_reg: { width: 1 }, idex_branch_mux: { width: 1 }, idex_branch: { width: 1 }, idex_jump_mux: { width: 1 }, idex_jump: { width: 1 }, idex_lui_mux: { width: 1 }, idex_lui: { width: 1 }, idex_auipc_mux: { width: 1 }, idex_auipc: { width: 1 }, idex_is_jalr_mux: { width: 1 }, idex_is_jalr: { width: 1 }, fwd_a_bit0: { low: 0, high: 0 }, fwd_a_bit1: { low: 1, high: 1 }, fwd_a_mux1: { width: 32 }, fwd_a_mux2: { width: 32 }, fwd_b_bit0: { low: 0, high: 0 }, fwd_b_bit1: { low: 1, high: 1 }, fwd_b_mux1: { width: 32 }, fwd_b_mux2: { width: 32 }, alu_src_mux: { width: 32 }, branch_target: { width: 32 }, jalr_target: { width: 32 }, jalr_mask: { value: 4294967294, width: 32 }, pc_plus_imm: { width: 32 }, pc_next_mux: { width: 32 }, exmem_alu_result: { width: 32 }, exmem_result: { width: 32 }, exmem_read2: { width: 32 }, exmem_rd: { width: 5 }, exmem_funct3: { width: 3 }, exmem_pc4: { width: 32 }, exmem_imm: { width: 32 }, exmem_pc_plus_imm: { width: 32 }, exmem_mem_read: { width: 1 }, exmem_mem_write: { width: 1 }, exmem_reg_write: { width: 1 }, exmem_mem_to_reg: { width: 1 }, exmem_lui: { width: 1 }, exmem_auipc: { width: 1 }, exmem_jump: { width: 1 }, memwb_alu_result: { width: 32 }, memwb_load_data: { width: 32 }, memwb_rd: { width: 5 }, memwb_pc4: { width: 32 }, memwb_imm: { width: 32 }, memwb_pc_plus_imm: { width: 32 }, memwb_reg_write: { width: 1 }, memwb_mem_to_reg: { width: 1 }, memwb_lui: { width: 1 }, memwb_auipc: { width: 1 }, memwb_jump: { width: 1 }, exmem_lo2: { low: 0, high: 1 }, memwb_byte_offset: { width: 2 }, memwb_funct3: { width: 3 } },
    connect: ({ in: inp, out, four, zero32, zero5, zero4, zero3, zero1, one1, hazard, stall_inv, pc, pc_plus4, ifid_instr_mux, ifid_instr, ifid_pc_mux, ifid_pc, ifid_pc4_mux, ifid_pc4, decode, immgen, control, funct7_splitter, regfile, ifid_decode_for_hazard, idex_flush, idex_pc, idex_pc4, wb_bypass1, wb_bypass2, idex_read1, idex_read2, idex_imm, idex_rs1_mux, idex_rs1, idex_rs2_mux, idex_rs2, idex_rd_mux, idex_rd, idex_funct3_mux, idex_funct3, idex_alu_op_mux, idex_alu_op, idex_alu_src_mux, idex_alu_src, idex_mem_read_mux, idex_mem_read, idex_mem_write_mux, idex_mem_write, idex_reg_write_mux, idex_reg_write, idex_mem_to_reg_mux, idex_mem_to_reg, idex_branch_mux, idex_branch, idex_jump_mux, idex_jump, idex_lui_mux, idex_lui, idex_auipc_mux, idex_auipc, idex_is_jalr_mux, idex_is_jalr, forward, fwd_a_bit0, fwd_a_bit1, fwd_a_mux1, fwd_a_mux2, fwd_b_bit0, fwd_b_bit1, fwd_b_mux1, fwd_b_mux2, alu_src_mux, alu, branch_comp, branch_target, jalr_target, jalr_mask, pc_plus_imm, ex_result, branch_and, next_pc, pc_src_taken, pc_next_mux, exmem_alu_result, exmem_result, exmem_read2, exmem_rd, exmem_funct3, exmem_pc4, exmem_imm, exmem_pc_plus_imm, exmem_mem_read, exmem_mem_write, exmem_reg_write, exmem_mem_to_reg, exmem_lui, exmem_auipc, exmem_jump, memwb_alu_result, memwb_load_data, memwb_rd, memwb_pc4, memwb_imm, memwb_pc_plus_imm, memwb_reg_write, memwb_mem_to_reg, memwb_lui, memwb_auipc, memwb_jump, exmem_lo2, memwb_byte_offset, memwb_funct3, load_align, wb_mux }) => [
      hazard.stall.to(stall_inv.in, idex_flush.b),
      pc.q.to(pc_plus4.a, out.instr_addr, ifid_pc_mux.in0, out.pc_out),
      four.out.to(pc_plus4.b),
      stall_inv.out.to(pc.we, ifid_instr.we, ifid_pc.we, ifid_pc4.we),
      inp.instruction.to(ifid_instr_mux.in0),
      zero32.out.to(ifid_instr_mux.in1, ifid_pc_mux.in1, ifid_pc4_mux.in1, ex_result.load_data),
      hazard.flush.to(ifid_instr_mux.sel, ifid_pc_mux.sel, ifid_pc4_mux.sel, idex_flush.a),
      ifid_instr_mux.out.to(ifid_instr.data),
      ifid_pc_mux.out.to(ifid_pc.data),
      pc_plus4.sum.to(ifid_pc4_mux.in0, pc_next_mux.in0),
      ifid_pc4_mux.out.to(ifid_pc4.data),
      ifid_instr.q.to(decode.instruction, immgen.instruction, ifid_decode_for_hazard.instruction),
      decode.opcode.to(control.opcode),
      decode.funct3.to(control.funct3, idex_funct3_mux.in0),
      decode.funct7.to(funct7_splitter.in),
      funct7_splitter.out.to(control.funct7_bit),
      decode.rs1.to(regfile.rs1, wb_bypass1.rs_addr, idex_rs1_mux.in0),
      decode.rs2.to(regfile.rs2, wb_bypass2.rs_addr, idex_rs2_mux.in0),
      ifid_decode_for_hazard.rs1.to(hazard.if_rs1),
      ifid_decode_for_hazard.rs2.to(hazard.if_rs2),
      ifid_pc.q.to(idex_pc.data),
      one1.out.to(idex_pc.we, idex_pc4.we, idex_read1.we, idex_read2.we, idex_imm.we, idex_rs1.we, idex_rs2.we, idex_rd.we, idex_funct3.we, idex_alu_op.we, idex_alu_src.we, idex_mem_read.we, idex_mem_write.we, idex_reg_write.we, idex_mem_to_reg.we, idex_branch.we, idex_jump.we, idex_lui.we, idex_auipc.we, idex_is_jalr.we, exmem_alu_result.we, exmem_result.we, exmem_read2.we, exmem_rd.we, exmem_funct3.we, exmem_pc4.we, exmem_imm.we, exmem_pc_plus_imm.we, exmem_mem_read.we, exmem_mem_write.we, exmem_reg_write.we, exmem_mem_to_reg.we, exmem_lui.we, exmem_auipc.we, exmem_jump.we, memwb_alu_result.we, memwb_load_data.we, memwb_rd.we, memwb_pc4.we, memwb_imm.we, memwb_pc_plus_imm.we, memwb_reg_write.we, memwb_mem_to_reg.we, memwb_lui.we, memwb_auipc.we, memwb_jump.we, memwb_byte_offset.we, memwb_funct3.we),
      ifid_pc4.q.to(idex_pc4.data),
      regfile.read1.to(wb_bypass1.rs_val),
      wb_mux.write_data.to(wb_bypass1.wb_val, wb_bypass2.wb_val, regfile.write_data, fwd_a_mux2.in1, fwd_b_mux2.in1),
      memwb_rd.q.to(wb_bypass1.wb_rd, wb_bypass2.wb_rd, forward.mem_rd, regfile.rd),
      memwb_reg_write.q.to(wb_bypass1.wb_we, wb_bypass2.wb_we, forward.mem_reg_write, regfile.we),
      regfile.read2.to(wb_bypass2.rs_val),
      wb_bypass1.out.to(idex_read1.data),
      wb_bypass2.out.to(idex_read2.data),
      immgen.immediate.to(idex_imm.data),
      zero5.out.to(idex_rs1_mux.in1, idex_rs2_mux.in1, idex_rd_mux.in1),
      idex_flush.out.to(idex_rs1_mux.sel, idex_rs2_mux.sel, idex_rd_mux.sel, idex_funct3_mux.sel, idex_alu_op_mux.sel, idex_alu_src_mux.sel, idex_mem_read_mux.sel, idex_mem_write_mux.sel, idex_reg_write_mux.sel, idex_mem_to_reg_mux.sel, idex_branch_mux.sel, idex_jump_mux.sel, idex_lui_mux.sel, idex_auipc_mux.sel, idex_is_jalr_mux.sel),
      idex_rs1_mux.out.to(idex_rs1.data),
      idex_rs2_mux.out.to(idex_rs2.data),
      decode.rd.to(idex_rd_mux.in0),
      idex_rd_mux.out.to(idex_rd.data),
      zero3.out.to(idex_funct3_mux.in1),
      idex_funct3_mux.out.to(idex_funct3.data),
      control.alu_op.to(idex_alu_op_mux.in0),
      zero4.out.to(idex_alu_op_mux.in1),
      idex_alu_op_mux.out.to(idex_alu_op.data),
      control.alu_src.to(idex_alu_src_mux.in0),
      zero1.out.to(idex_alu_src_mux.in1, idex_mem_read_mux.in1, idex_mem_write_mux.in1, idex_reg_write_mux.in1, idex_mem_to_reg_mux.in1, idex_branch_mux.in1, idex_jump_mux.in1, idex_lui_mux.in1, idex_auipc_mux.in1, idex_is_jalr_mux.in1),
      idex_alu_src_mux.out.to(idex_alu_src.data),
      control.mem_read.to(idex_mem_read_mux.in0),
      idex_mem_read_mux.out.to(idex_mem_read.data),
      control.mem_write.to(idex_mem_write_mux.in0),
      idex_mem_write_mux.out.to(idex_mem_write.data),
      control.reg_write.to(idex_reg_write_mux.in0),
      idex_reg_write_mux.out.to(idex_reg_write.data),
      control.mem_to_reg.to(idex_mem_to_reg_mux.in0),
      idex_mem_to_reg_mux.out.to(idex_mem_to_reg.data),
      control.branch.to(idex_branch_mux.in0),
      idex_branch_mux.out.to(idex_branch.data),
      control.jump.to(idex_jump_mux.in0),
      idex_jump_mux.out.to(idex_jump.data),
      control.lui.to(idex_lui_mux.in0),
      idex_lui_mux.out.to(idex_lui.data),
      control.auipc.to(idex_auipc_mux.in0),
      idex_auipc_mux.out.to(idex_auipc.data),
      control.is_jalr.to(idex_is_jalr_mux.in0),
      idex_is_jalr_mux.out.to(idex_is_jalr.data),
      idex_rs1.q.to(forward.id_rs1),
      idex_rs2.q.to(forward.id_rs2),
      forward.forward_a.to(fwd_a_bit0.in, fwd_a_bit1.in),
      idex_read1.q.to(fwd_a_mux1.in0),
      fwd_a_bit0.out.to(fwd_a_mux1.sel),
      fwd_a_mux1.out.to(fwd_a_mux2.in0),
      fwd_a_bit1.out.to(fwd_a_mux2.sel),
      forward.forward_b.to(fwd_b_bit0.in, fwd_b_bit1.in),
      idex_read2.q.to(fwd_b_mux1.in0),
      fwd_b_bit0.out.to(fwd_b_mux1.sel),
      fwd_b_mux1.out.to(fwd_b_mux2.in0),
      fwd_b_bit1.out.to(fwd_b_mux2.sel),
      fwd_b_mux2.out.to(alu_src_mux.in0, branch_comp.b, exmem_read2.data),
      idex_imm.q.to(alu_src_mux.in1, branch_target.b, pc_plus_imm.b, ex_result.immediate, exmem_imm.data),
      idex_alu_src.q.to(alu_src_mux.sel),
      fwd_a_mux2.out.to(alu.a, branch_comp.a),
      alu_src_mux.out.to(alu.b),
      idex_alu_op.q.to(alu.alu_op),
      idex_funct3.q.to(branch_comp.funct3, exmem_funct3.data),
      idex_pc.q.to(branch_target.a, pc_plus_imm.a),
      alu.result.to(jalr_target.a, ex_result.alu_result, exmem_alu_result.data),
      jalr_mask.out.to(jalr_target.b),
      idex_pc4.q.to(ex_result.pc_plus4, next_pc.pc_plus4, exmem_pc4.data),
      pc_plus_imm.sum.to(ex_result.pc_plus_imm, exmem_pc_plus_imm.data),
      idex_mem_to_reg.q.to(ex_result.mem_to_reg, exmem_mem_to_reg.data),
      idex_lui.q.to(ex_result.lui, exmem_lui.data),
      idex_auipc.q.to(ex_result.auipc, exmem_auipc.data),
      idex_jump.q.to(ex_result.jump, next_pc.jump, pc_src_taken.b, hazard.jump, exmem_jump.data),
      idex_branch.q.to(branch_and.a, next_pc.branch),
      branch_comp.take_branch.to(branch_and.b, next_pc.take_branch),
      branch_target.sum.to(next_pc.branch_target, next_pc.jal_target),
      jalr_target.out.to(next_pc.jalr_target),
      idex_is_jalr.q.to(next_pc.is_jalr),
      branch_and.out.to(pc_src_taken.a, hazard.branch_taken),
      next_pc.next_pc.to(pc_next_mux.in1),
      pc_src_taken.out.to(pc_next_mux.sel),
      pc_next_mux.out.to(pc.data),
      idex_rd.q.to(hazard.id_rd, exmem_rd.data),
      idex_mem_read.q.to(hazard.id_mem_read, exmem_mem_read.data),
      ex_result.write_data.to(exmem_result.data),
      idex_mem_write.q.to(exmem_mem_write.data),
      idex_reg_write.q.to(exmem_reg_write.data),
      exmem_rd.q.to(forward.ex_rd, memwb_rd.data),
      exmem_reg_write.q.to(forward.ex_reg_write, memwb_reg_write.data),
      exmem_result.q.to(fwd_a_mux1.in1, fwd_b_mux1.in1),
      exmem_alu_result.q.to(out.data_addr, memwb_alu_result.data, exmem_lo2.in),
      exmem_lo2.out.to(memwb_byte_offset.data),
      exmem_read2.q.to(out.data_write),
      exmem_mem_read.q.to(out.data_mem_read),
      exmem_mem_write.q.to(out.data_mem_write),
      exmem_funct3.q.to(out.data_funct3, memwb_funct3.data),
      inp.data_read.to(memwb_load_data.data),
      exmem_pc4.q.to(memwb_pc4.data),
      exmem_imm.q.to(memwb_imm.data),
      exmem_pc_plus_imm.q.to(memwb_pc_plus_imm.data),
      exmem_mem_to_reg.q.to(memwb_mem_to_reg.data),
      exmem_lui.q.to(memwb_lui.data),
      exmem_auipc.q.to(memwb_auipc.data),
      exmem_jump.q.to(memwb_jump.data),
      memwb_alu_result.q.to(wb_mux.alu_result),
      memwb_load_data.q.to(load_align.data),
      memwb_byte_offset.q.to(load_align.byte_offset),
      memwb_funct3.q.to(load_align.funct3),
      load_align.out.to(wb_mux.load_data),
      memwb_pc4.q.to(wb_mux.pc_plus4),
      memwb_imm.q.to(wb_mux.immediate),
      memwb_pc_plus_imm.q.to(wb_mux.pc_plus_imm),
      memwb_mem_to_reg.q.to(wb_mux.mem_to_reg),
      memwb_lui.q.to(wb_mux.lui),
      memwb_auipc.q.to(wb_mux.auipc),
      memwb_jump.q.to(wb_mux.jump),
    ],
  });

  // Thin wrapper: strip net I/O, expose only instruction/data memory ports
  const RV32I_CPU_Core = circuit('RV32I_CPU_Core', {
    in: { instruction: bus(32), data_read: bus(32) },
    out: {
      instr_addr:    bus(32),
      data_addr:     bus(32),
      data_write:    bus(32),
      data_mem_read:  bit,
      data_mem_write: bit,
      data_funct3:   bus(3),
    },
    nodes: { cpu: RV32I_Core, zero32: Constant, zero1: Constant },
    nodeArgs: { zero32: { value: 0, width: 32 }, zero1: { value: 0, width: 1 } },
    connect: ({ in: inp, out, cpu, zero32, zero1 }) => [
      inp.instruction.to(cpu.instruction),
      inp.data_read.to(cpu.data_read),
      zero32.out.to(cpu.net_rx_data),
      zero1.out.to(cpu.net_rx_valid, cpu.net_rx_frame),
      cpu.instr_addr.to(out.instr_addr),
      cpu.data_addr.to(out.data_addr),
      cpu.data_write.to(out.data_write),
      cpu.data_mem_read.to(out.data_mem_read),
      cpu.data_mem_write.to(out.data_mem_write),
      cpu.data_funct3.to(out.data_funct3),
    ],
  });

  const lib: CircuitLibrary = {
    resolveCircuit: (name) => {
      if (name === 'RV32I_CPU_Core') return RV32I_CPU_Core.circuit;
      if (name === 'RV32I_Core')     return RV32I_Core.circuit;
      return RV32I_CPU_Core._dependencies.get(name)?.circuit
          ?? RV32I_Core._dependencies.get(name)?.circuit;
    },
    getAllPrimitiveNames: () => [
      ...new Set([
        ...RV32I_CPU_Core._dependencies.keys(),
        ...RV32I_Core._dependencies.keys(),
      ]),
    ],
  };

  return { circuit: RV32I_CPU_Core.circuit, lib };
}

// ── Build pipeline ──────────────────────────────────────────────────────────

async function main() {
  // Step 1: Compile firmware (C by default, Rust with --rust)
  let binary: Uint8Array;
  if (process.argv.includes('--rust')) {
    const firmwareSrc = readFileSync(resolve(__dirname, 'firmware/hello.rs'), 'utf8');
    binary = await compileFirmware(firmwareSrc, 'rust');
  } else if (process.argv.includes('--fib')) {
    const firmwareSrc = readFileSync(resolve(__dirname, 'firmware/fibonacci.c'), 'utf8');
    binary = await compileFirmware(firmwareSrc);
  } else if (process.argv.includes('--snake')) {
    const firmwareSrc = readFileSync(resolve(__dirname, 'firmware/snake.c'), 'utf8');
    binary = await compileFirmware(firmwareSrc);
  } else {
    const firmwareSrc = readFileSync(resolve(__dirname, 'firmware/hello.c'), 'utf8');
    binary = await compileFirmware(firmwareSrc);
  }

  // Step 2: Convert to $readmemh hex (saved for reference) + inline init
  const hexContents = binaryToReadmemh(binary, 512);
  const hexPath = resolve(__dirname, 'firmware.hex');
  writeFileSync(hexPath, hexContents);
  console.log(`  Hex file: ${hexPath}`);
  const inlineInit = binaryToInlineInit(binary, 512);

  // Step 3: Export CPU core to Verilog
  console.log('\nExporting RV32I_CPU_Core to Verilog...');
  const { circuit: cpuCircuit, lib } = buildCPUCore();
  const { verilog: cpuVerilog } = exportVerilog(cpuCircuit, lib, {
    target: 'synthesis',
    topModuleName: 'RV32I_CPU_Core',
  });
  console.log(`  CPU Verilog: ${(cpuVerilog.length / 1024).toFixed(1)} KB`);

  // Step 4: Combine with cpu_top.v wrapper, replacing $readmemh with inline init
  const wrapperVerilog = readFileSync(resolve(__dirname, 'cpu_top.v'), 'utf8');
  const lpf            = readFileSync(resolve(__dirname, 'ulx3s_cpu.lpf'), 'utf8');
  const wrapperPatched = wrapperVerilog.replace(
    /\s*initial \$readmemh\("firmware\.hex",\s*imem\);/,
    '\n' + inlineInit,
  );
  const combinedVerilog = cpuVerilog + '\n\n' + wrapperPatched;
  console.log(`  Combined: ${(combinedVerilog.length / 1024).toFixed(1)} KB`);
  writeFileSync(resolve(__dirname, 'combined.v'), combinedVerilog);

  // Step 5: Synthesise
  console.log('\nSynthesising (Yosys synth_ecp5)...');
  const synthResp = await fetch(SYNTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      verilog: combinedVerilog,
      files: { 'firmware.hex': hexContents },
      top: 'cpu_top',
      target: 'ecp5',
    }),
  }).then(r => r.json()) as {
    success: boolean; netlist?: string; stats?: object; log: string; error?: string;
  };

  if (!synthResp.success) {
    console.error('Synthesis failed:', synthResp.error);
    console.error(synthResp.log?.slice(-3000));
    process.exit(1);
  }
  console.log('  OK — stats:', synthResp.stats);
  if (synthResp.log) {
    const warnings = synthResp.log.split('\n').filter((l: string) => l.includes('Warning') || l.includes('readmem'));
    if (warnings.length) console.log('  Synth warnings:\n  ' + warnings.join('\n  '));
  }

  // Step 6: Place-and-route + bitstream
  console.log('\nBuilding bitstream (nextpnr-ecp5 + ecppack)...');
  const buildResp = await fetch(BUILD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      netlist: synthResp.netlist,
      top: 'cpu_top',
      lpf,
      device: 'LFE5U-85F',
      package: 'CABGA381',
    }),
  }).then(r => r.json()) as {
    success: boolean; bitstream?: string; timing?: object; utilization?: object;
    log: string; error?: string;
  };

  if (!buildResp.success) {
    console.error('Build failed:', buildResp.error);
    console.error(buildResp.log?.slice(-3000));
    process.exit(1);
  }

  console.log('  OK');
  console.log('  Timing:      ', buildResp.timing);
  console.log('  Utilization: ', buildResp.utilization);

  // Step 7: Save bitstream
  const bitData = Buffer.from(buildResp.bitstream!, 'base64');
  const bitPath = resolve(__dirname, 'cpu.bit');
  writeFileSync(bitPath, bitData);
  console.log(`\nBitstream written: ${bitPath} (${(bitData.length / 1024).toFixed(0)} KB)`);

  // Step 8: Flash (optional)
  if (process.argv.includes('--flash')) {
    console.log('\nFlashing via openFPGALoader...');
    execSync(`openFPGALoader -b ulx3s ${bitPath}`, { stdio: 'inherit' });
    console.log('Done. Connect to UART: screen /dev/ttyUSB0 115200');
  }
}

if (import.meta.main) {
  main().catch(e => { console.error(e); process.exit(1); });
}

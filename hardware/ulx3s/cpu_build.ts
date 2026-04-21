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

function buildCPUCore() {
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

// ── Raw test firmware (no forwarding: 5 NOPs between li and sw) ─────────────
// lui a5,0x80000; addi a4,x0,65; 5×nop; sw a4,0(a5); delay loop; j loop
function buildRawFirmware(): Uint8Array {
  // Test 1 (--raw): no forwarding — 5 NOPs between addi and sw
  // Test 2 (--raw2): forwarding needed — lui then addi then sw immediately (like polling firmware)
  const useRaw2 = process.argv.includes('--raw2');
  const useRaw3 = process.argv.includes('--raw3');
  const useRaw4 = process.argv.includes('--raw4');
  const useRaw5 = process.argv.includes('--raw5');
  const useRaw6 = process.argv.includes('--raw6');
  const useRaw7 = process.argv.includes('--raw7');

  const useRaw8 = process.argv.includes('--raw8');

  const useRaw9 = process.argv.includes('--raw9');

  const useRaw10 = process.argv.includes('--raw10');

  const useRaw11 = process.argv.includes('--raw11');

  const useRaw13 = process.argv.includes('--raw13');
  const useRaw12 = process.argv.includes('--raw12');

  const useRaw14 = process.argv.includes('--raw14');
  const useRaw15 = process.argv.includes('--raw15');
  const useRaw16 = process.argv.includes('--raw16');
  const useRaw17 = process.argv.includes('--raw17');
  const useRaw18 = process.argv.includes('--raw18');
  const useRaw19 = process.argv.includes('--raw19');
  const useRaw20 = process.argv.includes('--raw20');
  const useRaw21 = process.argv.includes('--raw21');
  const useRaw22 = process.argv.includes('--raw22');

  if (useRaw22) {
    // Constant 'A' output — no DMEM, no LBU. Just li a4=65, poll UART, sw to UART.
    // If this fails: CPU pipeline itself is broken.
    // If this passes: issue is specifically in DMEM loads.
    const words = [
      0x04100713, // [0x00] addi a4, x0, 65        a4 = 0x41 = 'A'
      0x800007b7, // [0x04] lui  a5, 0x80000         a5 = 0x80000000 (UART)
      0x0007a803, // [0x08] lw   a6, 0(a5)          poll UART ← loop target
      0x00000013, // [0x0C] nop
      0x00000013, // [0x10] nop
      0x00000013, // [0x14] nop
      0x00000013, // [0x18] nop
      0x00000013, // [0x1C] nop
      0xfe0804e3, // [0x20] beqz a6, -24            → 0x08
      0x00e7a023, // [0x24] sw   a4, 0(a5)          UART write
      0x000402b7, // [0x28] lui  t0, 0x40
      0xfff28293, // [0x2C] addi t0, t0, -1
      0xfe029ee3, // [0x30] bne  t0, x0, -4         → 0x2C
      0xfd5ff06f, // [0x34] j    0x08               offset = -44 (verified: 0xFD5FF06F)
    ];
    console.log('Using raw22 firmware (constant A, no DMEM):');
    console.log('  Expected clean "A" stream. If garbage: CPU pipeline is broken, not just LBU.');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw21) {
    // Bypass LBU entirely: SW 0x41000000 to DMEM, then LW + SRLI(24) to extract byte-3 arithmetically.
    // If 'A': DMEM write/read is fine, LBU is the bug.
    // If garbage: DMEM write, LW read, or SRLI is broken.
    const jalOffset = (target: number, pc: number) => {
      const off = ((target - pc) << 11) >> 11; // sign-extend 21-bit offset if needed
      const o = (target - pc) & 0x1FFFFF;      // 21-bit (bit0 always 0)
      const imm20   = (o >> 20) & 1;
      const imm1910 = (o >> 10) & 0x3FF; // imm[10:1] → bits[30:21]
      const imm11   = (o >> 11) & 1;
      const imm1912 = (o >> 12) & 0xFF;  // imm[19:12]
      return ((imm20 << 31) | (imm1910 << 21) | (imm11 << 20) | (imm1912 << 12) | 0x6F) >>> 0;
    };
    const words = [
      0x000106b7, // [0x00] lui  a3, 0x10          a3 = 0x10000
      0x410007b7, // [0x04] lui  a5, 0x41000        a5 = 0x41000000
      0x00f6a023, // [0x08] sw   a5, 0(a3)          dmem[0x10000] = 0x41000000
      0x800007b7, // [0x0C] lui  a5, 0x80000         a5 = 0x80000000 (UART)
      0x0007a803, // [0x10] lw   a6, 0(a5)          poll UART ready ← loop target
      0x00000013, // [0x14] nop
      0x00000013, // [0x18] nop
      0x00000013, // [0x1C] nop
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0xfe0804e3, // [0x28] beqz a6, -24            → 0x10
      0x0006a603, // [0x2C] lw   a2, 0(a3)          a2 = 0x41000000 (raw word)
      0x00000013, // [0x30] nop
      0x00000013, // [0x34] nop
      0x00000013, // [0x38] nop
      0x00000013, // [0x3C] nop
      0x00000013, // [0x40] nop
      0x01865713, // [0x44] srli a4, a2, 24         a4 = 0x00000041
      0x00e7a023, // [0x48] sw   a4, 0(a5)          UART write
      0x000402b7, // [0x4C] lui  t0, 0x40
      0xfff28293, // [0x50] addi t0, t0, -1
      0xfe029ee3, // [0x54] bne  t0, x0, -4         → 0x50
    ];
    words.push(jalOffset(0x10, words.length * 4));
    console.log('Using raw21 firmware (SW + LW + SRLI(24) → UART: bypasses LBU):');
    console.log('  Expected "A" if DMEM write/read and SRLI work; garbage = more fundamental issue');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw20) {
    // Like raw19 but uses SW (word store) instead of SB (byte store).
    // Stores 0x41000000 as a full word at 0x10000, then LBU byte-3 at 0x10003.
    // If passes: SB byte-3 write is broken, not LBU read.
    // If fails: LBU byte-3 read itself is fundamentally broken.
    const words = [
      0x000106b7, // [0x00] lui  a3, 0x10         a3 = 0x10000
      0x410007b7, // [0x04] lui  a5, 0x41000      a5 = 0x41000000
      0x00f6a023, // [0x08] sw   a5, 0(a3)        dmem[0x10000] = 0x41000000
      0x800007b7, // [0x0C] lui  a5, 0x80000      a5 = 0x80000000 (UART)
      0x0007a803, // [0x10] lw   a6, 0(a5)        poll UART ← loop target
      0x00000013, // [0x14] nop
      0x00000013, // [0x18] nop
      0x00000013, // [0x1C] nop
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0xfe0804e3, // [0x28] beqz a6, -24          → 0x10
      0x0036c703, // [0x2C] lbu  a4, 3(a3)        load byte-3 at 0x10003
      0x00000013, // [0x30] nop
      0x00000013, // [0x34] nop
      0x00000013, // [0x38] nop
      0x00000013, // [0x3C] nop
      0x00000013, // [0x40] nop
      0x00e7a023, // [0x44] sw   a4, 0(a5)        UART write
      0x000402b7, // [0x48] lui  t0, 0x40
      0xfff28293, // [0x4C] addi t0, t0, -1
      0xfe029ee3, // [0x50] bne  t0, x0, -4
      0xfbdff06f, // [0x54] j    0x10             offset = 0x10-0x54 = -68
    ];
    console.log('Using raw20 firmware (sw word 0x41000000 → lbu byte-3 → 5 NOPs → sw UART):');
    console.log('  SW 0x41000000 to 0x10000; lbu a4, 3(a3) → byte-3 = 0x41; 5 NOPs; sw a4 to UART');
    console.log('  Expected "A" (0x41) if lbu byte-3 reads correctly; garbage = LBU read is broken');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw19) {
    // Same as raw14 but 5 NOPs between lbu and sw (no forwarding needed).
    // If passes: load byte-3 is correct; MEM/WB forwarding is the bug.
    // If fails: lbu byte-3 load itself is broken (alignment or pipeline).
    const words = [
      0x000105b7, // [0x00] lui  a3, 0x10
      0x00358593, // [0x04] addi a3, a3, 3        a3 = 0x10003
      0x04100793, // [0x08] li   a5, 65
      0x00f68023, // [0x0C] sb   a5, 0(a3)        DMEM[0x10003] = 65
      0x800007b7, // [0x10] lui  a5, 0x80000
      0x0007a803, // [0x14] lw   a6, 0(a5)        poll UART ← loop target
      0x00000013, // [0x18] nop
      0x00000013, // [0x1C] nop
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0x00000013, // [0x28] nop
      0xfe0804e3, // [0x2C] beqz a6, -24          → 0x14
      0x0006c703, // [0x30] lbu  a4, 0(a3)        load byte-3
      0x00000013, // [0x34] nop
      0x00000013, // [0x38] nop
      0x00000013, // [0x3C] nop
      0x00000013, // [0x40] nop
      0x00000013, // [0x44] nop
      0x00e7a023, // [0x48] sw   a4, 0(a5)        UART write (no forwarding)
      0x000402b7, // [0x4C] lui  t0, 0x40
      0xfff28293, // [0x50] addi t0, t0, -1
      0xfe029ee3, // [0x54] bne  t0, x0, -4
      0xfbdff06f, // [0x58] j    0x14             offset = 0x14-0x58 = -68
    ];
    console.log('Using raw19 firmware (lbu byte-3 → 5 NOPs → sw: tests load without forwarding):');
    console.log('  sb 65 to 0x10003; lbu a4; 5 NOPs; sw a4 to UART');
    console.log('  Expected "A" if lbu byte-3 load works; garbage = load itself broken');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw18) {
    // Same as raw14 (lbu→nop→sw) but byte address 0x10000 (byte 0, data_addr[1:0]=00).
    // raw14 uses 0x10003 (byte 3, shift=24). raw18 uses 0x10000 (byte 0, shift=0).
    // If raw18 passes but raw14 fails: non-zero barrel shift is the bug.
    // If raw18 also fails: LBU forwarding is broken regardless of byte offset.
    const words = [
      0x000106b7, // [0x00] lui  a3, 0x10       a3 = 0x10000 (byte 0)
      0x04100793, // [0x04] addi a5, x0, 65     a5 = 65
      0x00f68023, // [0x08] sb   a5, 0(a3)      DMEM[0x10000] byte 0 = 65
      0x800007b7, // [0x0C] lui  a5, 0x80000    a5 = 0x80000000
      0x0007a803, // [0x10] lw   a6, 0(a5)      poll UART ← loop target
      0x00000013, // [0x14] nop
      0x00000013, // [0x18] nop
      0x00000013, // [0x1C] nop
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0xfe0804e3, // [0x28] beqz a6, -24        → 0x10
      0x0006c703, // [0x2C] lbu  a4, 0(a3)      a4 = byte 0 at 0x10000 (shift=0)
      0x00000013, // [0x30] nop                  1 NOP gap
      0x00e7a023, // [0x34] sw   a4, 0(a5)      UART write
      0x000402b7, // [0x38] lui  t0, 0x40
      0xfff28293, // [0x3C] addi t0, t0, -1
      0xfe029ee3, // [0x40] bne  t0, x0, -4
      0xfd1ff06f, // [0x44] j    0x10           (offset = -52)
    ];
    console.log('Using raw18 firmware (lbu byte 0→nop→sw: tests LBU with shift=0):');
    console.log('  sb 65 to 0x10000 (byte 0); lbu a4, 0(a3); nop; sw a4 to UART');
    console.log('  Expected "A" if shift=0 LBU works; garbage = LBU broken even with shift=0');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw17) {
    // Tests MEM/WB forward_b for a WORD LOAD (lw) with 1 NOP gap.
    // Same as raw14 but uses lw (funct3=010) instead of lbu (funct3=100).
    // If raw17 passes but raw14 fails: bug is specific to LBU byte alignment.
    // If raw17 also fails: bug is in the load forwarding path generally.
    const words = [
      0x000106b7, // [0x00] lui  a3, 0x10       a3 = 0x10000 (DMEM word addr)
      0x04100793, // [0x04] addi a5, x0, 65     a5 = 65
      0x00f6a023, // [0x08] sw   a5, 0(a3)      DMEM[0x10000] = 65 (word store)
      0x800007b7, // [0x0C] lui  a5, 0x80000    a5 = 0x80000000 (UART)
      0x0007a803, // [0x10] lw   a6, 0(a5)      poll UART ← loop target
      0x00000013, // [0x14] nop
      0x00000013, // [0x18] nop
      0x00000013, // [0x1C] nop
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0xfe0804e3, // [0x28] beqz a6, -24        → 0x10 if not ready
      0x0006a703, // [0x2C] lw   a4, 0(a3)      a4 = DMEM[0x10000] (word load)
      0x00000013, // [0x30] nop                  1 NOP gap
      0x00e7a023, // [0x34] sw   a4, 0(a5)      UART write
      0x000402b7, // [0x38] lui  t0, 0x40       delay
      0xfff28293, // [0x3C] addi t0, t0, -1
      0xfe029ee3, // [0x40] bne  t0, x0, -4     (→ 0x3C)
      0xfd1ff06f, // [0x44] j    0x10           (offset = 0x10-0x44 = -52)
    ];
    console.log('Using raw17 firmware (lw→nop→sw: tests MEM/WB forward_b for word load):');
    console.log('  sw word 65 to DMEM; lw a4, 0(a3); nop; sw a4 to UART');
    console.log('  Expected "A" if lw MEM/WB forwarding works; garbage = load forward broken');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw16) {
    // Tests MEM/WB forward_b for a non-load instruction.
    // addi a4, x0, 65; nop; sw a4, 0(a5) — 1 NOP gap, no load.
    // When sw is in EX, addi is in WB → memwb_alu_result_q=65, forward_b=2.
    // If passes: MEM/WB forward_b works for non-loads → bug is load-specific.
    // If fails: MEM/WB forward_b is broken generally.
    const words = [
      0x800007b7, // [0x00] lui  a5, 0x80000   ← poll
      0x0007a783, // [0x04] lw   a5, 0(a5)
      0x0017f793, // [0x08] andi a5, a5, 1
      0xfe078ae3, // [0x0C] beqz a5, -12       (→ 0x00)
      0x800007b7, // [0x10] lui  a5, 0x80000
      0x04100713, // [0x14] addi a4, x0, 65
      0x00000013, // [0x18] nop               ← 1 NOP gap
      0x00e7a023, // [0x1C] sw   a4, 0(a5)    MEM/WB forward_b
      0x000402b7, // [0x20] lui  t0, 0x40
      0xfff28293, // [0x24] addi t0, t0, -1
      0xfe029ee3, // [0x28] bne  t0, x0, -4
      0xfd5ff06f, // [0x2C] j    0x00          (offset=-44)
    ];
    console.log('Using raw16 firmware (addi→nop→sw: tests MEM/WB forward_b, non-load):');
    console.log('  addi a4, x0, 65; nop; sw a4, 0(a5)');
    console.log('  Expected "A" if MEM/WB forward_b works; garbage = MEM/WB forward_b broken');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw15) {
    // Tests EX/MEM forward_b (rs2 forwarding) with a non-load instruction.
    // addi a4, x0, 65 immediately followed by sw a4, 0(a5) (0 NOPs).
    // When sw is in EX, addi is in MEM → exmem_result_q=65, forward_b=1.
    // If this outputs 'A': EX/MEM forward_b works.
    // If garbage: forward_b is broken entirely.
    const words = [
      0x800007b7, // [0x00] lui  a5, 0x80000   ← poll
      0x0007a783, // [0x04] lw   a5, 0(a5)     C-style poll (same reg)
      0x0017f793, // [0x08] andi a5, a5, 1
      0xfe078ae3, // [0x0C] beqz a5, -12       (→ 0x00)
      0x800007b7, // [0x10] lui  a5, 0x80000   reload UART addr
      0x04100713, // [0x14] addi a4, x0, 65    a4 = 65 (non-load)
      0x00e7a023, // [0x18] sw   a4, 0(a5)     EX/MEM forward_b (0 NOPs)
      0x000402b7, // [0x1C] lui  t0, 0x40      delay
      0xfff28293, // [0x20] addi t0, t0, -1
      0xfe029ee3, // [0x24] bne  t0, x0, -4    (→ 0x20)
      0xfd9ff06f, // [0x28] j    0x00          (offset=-40)
    ];
    console.log('Using raw15 firmware (addi→sw 0 NOPs: tests EX/MEM forward_b):');
    console.log('  addi a4, x0, 65; sw a4, 0(a5)');
    console.log('  Expected "A" if EX/MEM forward_b works; garbage = forward_b entirely broken');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw14) {
    // Tests WB forwarding for lbu: 1 NOP between lbu and sw.
    // With 1 NOP: lbu in MEM when sw is in ID, no load-use hazard.
    // When sw reaches EX, lbu is in WB → WB forwarding provides the loaded value.
    // If this outputs 'A': WB forwarding works; raw13 bug is the stall not firing.
    // If this also outputs garbage: WB forwarding for lbu→sw is broken too.
    //
    // Same as raw13 but with nop at 0x30, sw at 0x34, delay/j shifted by 4.
    const words = [
      0x000105b7, // [0x00] lui  a3, 0x10
      0x00358593, // [0x04] addi a3, a3, 3
      0x04100793, // [0x08] li   a5, 65
      0x00f68023, // [0x0C] sb   a5, 0(a3)
      0x800007b7, // [0x10] lui  a5, 0x80000
      0x0007a803, // [0x14] lw   a6, 0(a5)    ← poll target
      0x00000013, // [0x18] nop
      0x00000013, // [0x1C] nop
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0x00000013, // [0x28] nop
      0xfe0804e3, // [0x2C] beqz a6, -24      (→ 0x14)
      0x0006c703, // [0x30] lbu  a4, 0(a3)
      0x00000013, // [0x34] nop               ← 1 NOP gap (no stall needed)
      0x00e7a023, // [0x38] sw   a4, 0(a5)    (WB forwarding provides a4)
      0x000402b7, // [0x3C] lui  t0, 0x40
      0xfff28293, // [0x40] addi t0, t0, -1
      0xfe029ee3, // [0x44] bne  t0, x0, -4
      0xfd1ff06f, // [0x48] j    0x14         (offset = 0x14-0x48 = -52)
    ];
    console.log('Using raw14 firmware (1 NOP gap: tests WB forwarding without stall):');
    console.log('  lbu a4; nop; sw a4 — WB forward should provide loaded value');
    console.log('  Expected "A" if WB forwarding works; if garbage: WB forward broken');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw13) {
    // Isolates (B): lbu→sw load-use hazard WITHOUT the C-style poll.
    // Uses raw9-style poll (lw a6, separate register + 5 NOPs + beqz),
    // but lbu a4 immediately followed by sw a4 (0 NOPs — load-use hazard).
    // If this outputs 'A': hazard (B) works, raw11 bug is from C-style poll (A).
    // If this outputs garbage: load-use hazard lbu→sw is broken regardless of poll style.
    //
    // 0x00: lui  a3, 0x10003  (DMEM addr)
    // 0x04: addi a3, a3, 3
    // 0x08: li   a5, 65
    // 0x0C: sb   a5, 0(a3)   (store 'A')
    // 0x10: lui  a5, 0x80000 (UART base — fixed in a5)
    // 0x14: lw   a6, 0(a5)   ← poll target (separate register a6)
    // 0x18–0x28: nop×5
    // 0x2C: beqz a6, -24     (→ 0x14)
    // 0x30: lbu  a4, 0(a3)   (load-use hazard with sw below — 0 NOPs)
    // 0x34: sw   a4, 0(a5)   (write to UART — a5 still 0x80000000)
    // 0x38: delay; j 0x14
    const words = [
      0x000105b7, // [0x00] lui  a3, 0x10
      0x00358593, // [0x04] addi a3, a3, 3
      0x04100793, // [0x08] li   a5, 65
      0x00f68023, // [0x0C] sb   a5, 0(a3)
      0x800007b7, // [0x10] lui  a5, 0x80000
      0x0007a803, // [0x14] lw   a6, 0(a5)    ← poll target
      0x00000013, // [0x18] nop
      0x00000013, // [0x1C] nop
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0x00000013, // [0x28] nop
      0xfe0804e3, // [0x2C] beqz a6, -24      (→ 0x14)
      0x0006c703, // [0x30] lbu  a4, 0(a3)    (load-use hazard with sw!)
      0x00e7a023, // [0x34] sw   a4, 0(a5)    (0 NOPs between lbu and sw)
      0x000402b7, // [0x38] lui  t0, 0x40
      0xfff28293, // [0x3C] addi t0, t0, -1
      0xfe029ee3, // [0x40] bne  t0, x0, -4
      0xfd1ff06f, // [0x44] j    0x14         (offset = 0x14-0x44 = -48)
    ];
    console.log('Using raw13 firmware (lbu→sw hazard, raw9-style poll):');
    console.log('  sb A; [lw a6; nop×5; beqz poll]; lbu a4; sw a4 (0 NOPs); delay; j 0x14');
    console.log('  Expected "A" if load-use hazard works; garbage if hazard is broken');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw12) {
    // Isolates (A): C-style poll loop WITHOUT the load-use hazard.
    // Uses C-style poll (lw a5, 0(a5); andi a5, a5, 1; beqz a5),
    // but sends a CONSTANT 'A' (li a4, 65) with 5 NOPs before sw (no hazard).
    // If this outputs 'A': C-style poll is fine, raw11 bug is from lbu→sw hazard (B).
    // If this outputs garbage: C-style poll itself corrupts a5/registers.
    //
    // 0x00: lui  a5, 0x80000  ← poll target
    // 0x04: lw   a5, 0(a5)   (C-style: same register)
    // 0x08: andi a5, a5, 1
    // 0x0C: beqz a5, -12     (→ 0x00)
    // 0x10: lui  a5, 0x80000 (reload UART after poll clobbers a5)
    // 0x14: li   a4, 65      (constant 'A' — no load hazard)
    // 0x18–0x28: nop×5
    // 0x2C: sw   a4, 0(a5)
    // 0x30: delay; j 0x00
    const words = [
      0x800007b7, // [0x00] lui  a5, 0x80000   ← poll target
      0x0007a783, // [0x04] lw   a5, 0(a5)     (C-style: same reg)
      0x0017f793, // [0x08] andi a5, a5, 1
      0xfe078ae3, // [0x0C] beqz a5, -12       (→ 0x00)
      0x800007b7, // [0x10] lui  a5, 0x80000   (reload UART)
      0x04100713, // [0x14] li   a4, 65         (constant 'A', no load hazard)
      0x00000013, // [0x18] nop
      0x00000013, // [0x1C] nop
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0x00000013, // [0x28] nop
      0x00e7a023, // [0x2C] sw   a4, 0(a5)
      0x000402b7, // [0x30] lui  t0, 0x40
      0xfff28293, // [0x34] addi t0, t0, -1
      0xfe029ee3, // [0x38] bne  t0, x0, -4
      0xfc5ff06f, // [0x3C] j    0x00          (offset = 0x00-0x3C = -60)
    ];
    console.log('Using raw12 firmware (C-style poll, constant char, no lbu hazard):');
    console.log('  [lui+lw a5,0(a5)+andi+beqz poll]; lui a5; li a4,65; nop×5; sw a4');
    console.log('  Expected "A" if C-style poll works; garbage if poll corrupts a5');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw11) {
    // Tests the load-use hazard case that C firmware exercises:
    //   lbu a4, 0(a3)   ← load from DMEM
    //   sw  a4, 0(a5)   ← use a4 IMMEDIATELY — hazard unit must stall 1 cycle
    // raw9 had 5 NOPs between lbu and sw (no hazard). This test has 0 NOPs.
    // Also tests C-style poll: lw a5, 0(a5) (same register) + andi + beqz.
    // Expected: 'A' (0x41) if load-use stall works correctly.
    //
    // 0x00: lui  a3, 0x10       (a3 = DMEM base, stays fixed)
    // 0x04: addi a3, a3, 3      (a3 = 0x10003)
    // 0x08: li   a5, 65         (a5 = 'A')
    // 0x0C: sb   a5, 0(a3)      (store 'A' to DMEM)
    // 0x10: lui  a5, 0x80000    ← poll loop target
    // 0x14: lw   a5, 0(a5)      (C-style: same reg; load-use hazard with andi)
    // 0x18: andi a5, a5, 1
    // 0x1C: beqz a5, -12        (→ 0x10)
    // 0x20: lui  a5, 0x80000    (reload UART after poll clobbers a5)
    // 0x24: lbu  a4, 0(a3)      (load char from DMEM — load-use hazard with sw!)
    // 0x28: sw   a4, 0(a5)      (write to UART — needs stall to get correct a4)
    // 0x2C: delay; j 0x10       (loop back to poll for next char — same char each time)
    const words = [
      0x000105b7, // [0x00] lui  a3, 0x10
      0x00358593, // [0x04] addi a3, a3, 3       (a3 = 0x10003)
      0x04100793, // [0x08] li   a5, 65           (a5 = 'A')
      0x00f68023, // [0x0C] sb   a5, 0(a3)        (store 'A' to DMEM[0x10003])
      0x800007b7, // [0x10] lui  a5, 0x80000      ← poll target
      0x0007a783, // [0x14] lw   a5, 0(a5)        (C-style: same reg for base+dest)
      0x0017f793, // [0x18] andi a5, a5, 1
      0xfe078ae3, // [0x1C] beqz a5, -12          (→ 0x10)
      0x800007b7, // [0x20] lui  a5, 0x80000      (reload UART)
      0x0006c703, // [0x24] lbu  a4, 0(a3)        (load-use hazard with next sw!)
      0x00e7a023, // [0x28] sw   a4, 0(a5)        (write — a4 must be stalled in)
      0x000402b7, // [0x2C] lui  t0, 0x40
      0xfff28293, // [0x30] addi t0, t0, -1
      0xfe029ee3, // [0x34] bne  t0, x0, -4
      0xfd9ff06f, // [0x38] j    0x10             (offset = 0x10-0x38 = -40)
    ];
    console.log('Using raw11 firmware (load-use hazard: lbu immediately followed by sw):');
    console.log('  sb A; [lui+lw a5,0(a5)+andi+beqz poll]; lui a5; lbu a4,0(a3); sw a4,0(a5)');
    console.log('  Expected: 0x41 ("A") if load-use stall fires correctly');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw10) {
    // Tests lw→andi load-use hazard in poll loop.
    // C firmware and Rust both use: lw a5, 0(a5); andi a5, a5, 1; beqz a5, poll
    // All passing raw tests used lw + 5×NOPs + beqz (no hazard).
    // This test uses lw a3, 0(a5); andi a3, a3, 1; beqz a3 — same hazard, separate addr reg.
    // If output is 'A' (0x41): load-use + andi forwarding works; bug is elsewhere.
    // If output is garbage: lw→andi load-use hazard is broken in synthesized CPU.
    //
    // 0x00: lui  a5, 0x80000     (UART base — stays fixed)
    // 0x04: li   a4, 65          (char = 'A')
    // 0x08: lw   a3, 0(a5)       ← poll target; load-use hazard: andi follows immediately
    // 0x0C: andi a3, a3, 1
    // 0x10: beqz a3, -8          (→ 0x08)
    // 0x14: sw   a4, 0(a5)
    // 0x18: delay; j 0x00
    const words = [
      0x800007b7, // [0x00] lui  a5, 0x80000
      0x04100713, // [0x04] li   a4, 65           (a4 = 'A')
      0x0007a683, // [0x08] lw   a3, 0(a5)        ← poll target
      0x0016f693, // [0x0C] andi a3, a3, 1        (load-use hazard on a3)
      0xfe068ce3, // [0x10] beqz a3, -8           (→ 0x08 if not ready)
      0x00e7a023, // [0x14] sw   a4, 0(a5)
      0x000402b7, // [0x18] lui  t0, 0x40
      0xfff28293, // [0x1C] addi t0, t0, -1
      0xfe029ee3, // [0x20] bne  t0, x0, -4
      0xfddff06f, // [0x24] j    0x00             (offset = -36)
    ];
    console.log('Using raw10 firmware (lw→andi load-use hazard in poll):');
    console.log('  lui a5; li a4,65; [lw a3; andi a3,1; beqz a3,poll]; sw a4; delay; j 0');
    console.log('  Expected: 0x41 ("A") if load-use hazard works');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw9) {
    // Tests the exact C firmware pattern: SB → long poll loop → LBU from DMEM → SW to UART
    // raw8 proved SB+LBU works when LBU is BEFORE the poll loop.
    // This test puts the LBU AFTER the poll loop, matching the failing C pattern.
    // Expected: 'H' (0x48) if LBU-after-poll works; wrong byte if poll corrupts DMEM read.
    //
    // 0x00: lui  a1, 0x10003   (DMEM byte addr)
    // 0x04: addi a1, a1, 3
    // 0x08: li   a5, 0x48      (a5 = 'H')
    // 0x0C: sb   a5, 0(a1)     (store to DMEM)
    // 0x10: lui  a5, 0x80000   (UART base)
    // 0x14: lw   a6, 0(a5)     ← poll target
    // 0x18–0x28: nop×5
    // 0x2C: beqz a6, -24       (→ 0x14)
    // 0x30: lbu  a4, 0(a1)     (LBU from DMEM AFTER poll — this is what C does)
    // 0x34–0x44: nop×5
    // 0x48: sw   a4, 0(a5)
    // 0x4C: delay; j 0x00
    const words = [
      0x000105b7, // [0x00] lui  a1, 0x10
      0x00358593, // [0x04] addi a1, a1, 3       (a1 = 0x10003)
      0x04800793, // [0x08] li   a5, 0x48
      0x00f58023, // [0x0C] sb   a5, 0(a1)       (store 'H' to DMEM)
      0x800007b7, // [0x10] lui  a5, 0x80000     (UART base)
      0x0007a803, // [0x14] lw   a6, 0(a5)       ← poll target
      0x00000013, // [0x18] nop
      0x00000013, // [0x1C] nop
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0x00000013, // [0x28] nop
      0xfe0804e3, // [0x2C] beqz a6, -24         (→ 0x14)
      0x0005c703, // [0x30] lbu  a4, 0(a1)       (LBU from DMEM AFTER poll — matches C firmware)
      0x00000013, // [0x34] nop
      0x00000013, // [0x38] nop
      0x00000013, // [0x3C] nop
      0x00000013, // [0x40] nop
      0x00000013, // [0x44] nop
      0x00e7a023, // [0x48] sw   a4, 0(a5)
      0x000402b7, // [0x4C] lui  t0, 0x40        (delay)
      0xfff28293, // [0x50] addi t0, t0, -1
      0xfe029ee3, // [0x54] bne  t0, x0, -4
      0xfa9ff06f, // [0x58] j    0x00            (offset = -88)
    ];
    console.log('Using raw9 firmware (LBU after poll — matches C firmware pattern):');
    console.log('  sb H to DMEM; poll UART; lbu from DMEM; sw to UART');
    console.log('  Expected: 0x48 ("H") if LBU-after-poll works');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw8) {
    // Tests DMEM byte-write (SB) + byte-read (LBU) isolation:
    //   1. Store 'H' (0x48) via SB to DMEM addr 0x10003 (byte lane 3 of word 0)
    //   2. 10 NOPs (no forwarding, no pipeline overlap)
    //   3. LBU from same address → a4
    //   4. Poll UART + SW a4 to UART
    // Expected: if DMEM SB/LBU correct → UART outputs 'H' (0x48) repeatedly
    // If DMEM byte-write broken (e.g. wrong byte lane) → wrong char or 0x00
    const words = [
      0x000105b7, // [0x00] lui  a1, 0x10       (a1 = 0x10000, DMEM base)
      0x00358593, // [0x04] addi a1, a1, 3       (a1 = 0x10003, same byte addr as C firmware stack)
      0x04800793, // [0x08] li   a5, 0x48        (a5 = 'H')
      0x00f58023, // [0x0C] sb   a5, 0(a1)       (store 'H' to DMEM byte 3)
      0x00000013, // [0x10] nop
      0x00000013, // [0x14] nop
      0x00000013, // [0x18] nop
      0x00000013, // [0x1C] nop
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0x00000013, // [0x28] nop
      0x00000013, // [0x2C] nop
      0x00000013, // [0x30] nop
      0x00000013, // [0x34] nop
      0x0005c703, // [0x38] lbu  a4, 0(a1)       (reload byte from DMEM; if correct → a4=0x48)
      0x800007b7, // [0x3C] lui  a5, 0x80000     (UART base)
      0x0007a803, // [0x40] lw   a6, 0(a5)       ← poll target
      0x00000013, // [0x44] nop
      0x00000013, // [0x48] nop
      0x00000013, // [0x4C] nop
      0x00000013, // [0x50] nop
      0x00000013, // [0x54] nop
      0xfe0804e3, // [0x58] beqz a6, -24         (→ 0x40 if not ready)
      0x00e7a023, // [0x5C] sw   a4, 0(a5)       (write loaded value to UART)
      0x000402b7, // [0x60] lui  t0, 0x40        (delay ~0x40000 cycles)
      0xfff28293, // [0x64] addi t0, t0, -1
      0xfe029ee3, // [0x68] bne  t0, x0, -4
      0xf95ff06f, // [0x6C] j    0x00            (restart)
    ];
    console.log('Using raw8 firmware (DMEM SB→LBU isolation test):');
    console.log('  lui a1,0x10003; li a5,0x48; sb a5,0(a1); nop×10; lbu a4,0(a1); poll; sw a4; delay; j 0x00');
    console.log('  Expected UART output: 0x48 ("H") if DMEM byte-write works');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw7) {
    // Like raw5 (lw + beqz poll) but li a4,65 is set BEFORE the polling loop
    // Tests hypothesis: instruction immediately after beqz is being skipped
    // If raw7 outputs 'A': li a4 after beqz is skipped (instruction-after-branch bug)
    // If raw7 outputs 0x00: something else is wrong with a4 or addr
    //
    // 0x00: lui  a5, 0x80000
    // 0x04: li   a4, 65        ← set a4 BEFORE polling
    // 0x08: nop×5
    // 0x18: lw   a6, 0(a5)     ← read uart_ready (poll starts here)
    // 0x1C: nop×5
    // 0x2C: beqz a6, poll(0x18) — offset = 0x18-0x2C = -20
    // 0x30: sw   a4, 0(a5)     ← write (a4=65 from before loop)
    // 0x34: delay loop
    // 0x40: bne t0, x0, -4
    // 0x44: j 0x00             — offset = -68
    const words = [
      0x800007b7, // [0x00] lui  a5, 0x80000
      0x04100713, // [0x04] li   a4, 65        ← set BEFORE poll
      0x00000013, // [0x08] nop
      0x00000013, // [0x0C] nop
      0x00000013, // [0x10] nop
      0x00000013, // [0x14] nop
      0x0007a803, // [0x18] lw   a6, 0(a5)     ← poll starts here
      0x00000013, // [0x1C] nop
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0x00000013, // [0x28] nop
      0x00000013, // [0x2C] nop  (5 NOPs after lw)
      0xfe0804e3, // [0x30] beqz a6, -24 (→ 0x18 poll) — if not ready, retry
      0x00e7a023, // [0x34] sw   a4, 0(a5)     ← UART write (a4=65 from before loop)
      0x000402b7, // [0x38] lui  t0, 0x40       ← delay
      0xfff28293, // [0x3C] addi t0, t0, -1
      0xfe029ee3, // [0x40] bne  t0, x0, -4
      0xfbdff06f, // [0x44] j    0x00  (offset=-68)
    ];
    console.log('Using raw7 firmware (li a4 set BEFORE poll loop):');
    console.log('  lui a5; li a4,65; nop×5; [lw a6; nop×5; beqz a6,poll]; sw; delay; j 0x00');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw6) {
    // Like raw5 but WITHOUT the beqz — just lw a6 (ignored), then write path
    // Tests if the lw itself disrupts the store, without any branch complication
    // If raw6 outputs 'A': lw is fine, the beqz is the problem
    // If raw6 outputs 0x00: lw by itself corrupts the store path
    //
    // 0x00: lui  a5, 0x80000
    // 0x04: lw   a6, 0(a5)    (result discarded — a6 not used)
    // 0x08–0x18: nop×5
    // 0x1C: li   a4, 65
    // 0x20–0x30: nop×5
    // 0x34: sw   a4, 0(a5)
    // 0x38: delay loop
    // 0x44: j 0x00             (offset=-68)
    const words = [
      0x800007b7, // [0x00] lui a5, 0x80000
      0x0007a803, // [0x04] lw a6, 0(a5)   — load uart_ready into a6 (unused)
      0x00000013, // [0x08] nop
      0x00000013, // [0x0C] nop
      0x00000013, // [0x10] nop
      0x00000013, // [0x14] nop
      0x00000013, // [0x18] nop
      0x04100713, // [0x1C] li a4, 65
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0x00000013, // [0x28] nop
      0x00000013, // [0x2C] nop
      0x00000013, // [0x30] nop
      0x00e7a023, // [0x34] sw a4, 0(a5)   — UART write
      0x000402b7, // [0x38] lui t0, 0x40   — delay
      0xfff28293, // [0x3C] addi t0, t0, -1
      0xfe029ee3, // [0x40] bne t0, x0, -4
      0xfbdff06f, // [0x44] j 0x00         — offset=-68
    ];
    console.log('Using raw6 firmware (lw without branch — isolates lw vs beqz):');
    console.log('  lui a5; lw a6; nop×5; li a4,65; nop×5; sw; delay; j 0x00');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw5) {
    // Like raw4 (delay loop) but ADDS uart_ready polling before each write
    // No C startup code — pure assembly. Tests if lw→beqz works in hardware.
    // If --raw5 outputs 'A': polling works, C startup was causing the bug
    // If --raw5 outputs 0x00: lw→beqz is broken in synthesized CPU
    //
    // 0x00: lui  a5, 0x80000       (UART base)
    // 0x04: lw   a6, 0(a5)         (read uart_ready)
    // 0x08–0x18: nop×5             (pipeline drain after lw)
    // 0x1C: beqz a6, -24 (→0x04)  (if not ready, poll again)
    // 0x20: li   a4, 65
    // 0x24–0x34: nop×5
    // 0x38: sw   a4, 0(a5)         (UART write)
    // 0x3C: lui  t0, 0x40          (delay)
    // 0x40: addi t0, t0, -1
    // 0x44: bne  t0, x0, -4 (→0x40)
    // 0x48: j    0x00 (→lui a5)
    const words = [
      0x800007b7, // [0x00] lui a5, 0x80000
      0x0007a803, // [0x04] lw a6, 0(a5)   — read uart_ready
      0x00000013, // [0x08] nop
      0x00000013, // [0x0C] nop
      0x00000013, // [0x10] nop
      0x00000013, // [0x14] nop
      0x00000013, // [0x18] nop
      0xfe0804e3, // [0x1C] beqz a6, -24   — poll until ready
      0x04100713, // [0x20] li a4, 65
      0x00000013, // [0x24] nop
      0x00000013, // [0x28] nop
      0x00000013, // [0x2C] nop
      0x00000013, // [0x30] nop
      0x00000013, // [0x34] nop
      0x00e7a023, // [0x38] sw a4, 0(a5)   — UART write
      0x000402b7, // [0x3C] lui t0, 0x40   — delay ~0x40000 cycles
      0xfff28293, // [0x40] addi t0, t0, -1
      0xfe029ee3, // [0x44] bne t0, x0, -4
      0xfb9ff06f, // [0x48] j 0x00         — offset=-72
    ];
    console.log('Using raw5 firmware (polling + delay, no C startup):');
    console.log('  lui a5; [lw a6; nop×5; beqz a6, poll]; li a4,65; nop×5; sw; delay; j 0x00');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw4) {
    // Like raw3 (loop-to-lui) but WITH a delay loop — tests if UART overrun is the cause
    // If --raw4 outputs correct 0x41, overrun is the problem; if wrong, bug is in CPU
    const words = [
      0x800007b7, // [0x00] lui a5, 0x80000
      0x00000013, // [0x04] nop
      0x00000013, // [0x08] nop
      0x00000013, // [0x0C] nop
      0x00000013, // [0x10] nop
      0x00000013, // [0x14] nop
      0x04100713, // [0x18] li a4, 65
      0x00000013, // [0x1C] nop
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0x00000013, // [0x28] nop
      0x00000013, // [0x2C] nop
      0x00e7a023, // [0x30] sw a4, 0(a5)  ← UART write
      0x000402b7, // [0x34] lui t0, 0x40  (delay ~0x40000 cycles)
      0xfff28293, // [0x38] addi t0, t0, -1
      0xfe029ee3, // [0x3C] bne t0, x0, -4  (loop to addi t0)
      0xfc1ff06f, // [0x40] j 0x00  (offset=-64, back to lui a5)
    ];
    console.log('Using raw4 firmware (loop-to-lui WITH delay — isolates UART overrun vs CPU bug):');
    console.log('  lui; nop×5; li a4,65; nop×5; sw; delay; j 0x00');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw3) {
    // Like compiled firmware but NO startup/prologue — loop-to-lui at 0x00
    // lui a5; nop×5; li a4,65; nop×5; sw a4,0(a5); j 0x00 (offset=-52 from 0x34)
    const words = [
      0x800007b7, // [0x00] lui a5, 0x80000
      0x00000013, // [0x04] nop
      0x00000013, // [0x08] nop
      0x00000013, // [0x0C] nop
      0x00000013, // [0x10] nop
      0x00000013, // [0x14] nop
      0x04100713, // [0x18] li a4, 65
      0x00000013, // [0x1C] nop
      0x00000013, // [0x20] nop
      0x00000013, // [0x24] nop
      0x00000013, // [0x28] nop
      0x00000013, // [0x2C] nop
      0x00e7a023, // [0x30] sw a4, 0(a5)  ← UART write
      0xfcdff06f, // [0x34] j 0x00 (offset=-52, same as compiled firmware's j 0x20 from 0x54)
    ];
    console.log('Using raw3 firmware (loop-to-lui, no startup, like compiled structure):');
    console.log('  lui; nop×5; li a4,65; nop×5; sw a4,0(a5); j 0x00');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  if (useRaw2) {
    // Mimics the polling firmware store path: lui a5; li a4,65; sw a4,0(a5); delay; j loop
    // forward_b=1 fires (li→sw, 1 instruction apart)
    const words = [
      0x800007b7, // lui a5, 0x80000
      0x04100713, // li a4, 65   (addi a4, x0, 65)
      0x00e7a023, // sw a4, 0(a5)  ← needs EX/MEM forwarding
      0x000402b7, // lui t0, 0x40
      0xfff28293, // addi t0, t0, -1
      0xfe029ee3, // bne t0, x0, -4
      0xff1ff06f, // j -16 (back to sw at offset 0x08)
    ];
    console.log('Using raw2 firmware (forwarding: li→sw, no NOPs):');
    const bytes = new Uint8Array(words.length * 4);
    const view = new DataView(bytes.buffer);
    words.forEach((w, i) => view.setUint32(i * 4, w, true));
    return bytes;
  }

  const words = [
    0x800007b7, // lui a5, 0x80000
    0x04100713, // addi a4, x0, 65
    0x00000013, // nop
    0x00000013, // nop
    0x00000013, // nop
    0x00000013, // nop
    0x00000013, // nop
    0x00e7a023, // sw a4, 0(a5)  ← UART write (no forwarding needed)
    0x000402b7, // lui t0, 0x40  (delay = 0x40000 cycles)
    0xfff28293, // addi t0, t0, -1
    0xfe029ee3, // bne t0, x0, -4  (loop to addi t0)
    0xff1ff06f, // j -16           (back to sw)
  ];
  console.log('Using raw test firmware (no forwarding):');
  console.log('  lui a5,0x80000; addi a4,x0,65; 5×nop; sw a4,0(a5); delay; j loop');
  const bytes = new Uint8Array(words.length * 4);
  const view = new DataView(bytes.buffer);
  words.forEach((w, i) => view.setUint32(i * 4, w, true));
  return bytes;
}

// ── Build pipeline ──────────────────────────────────────────────────────────

async function main() {
  const useRaw = process.argv.includes('--raw') || process.argv.includes('--raw2') || process.argv.includes('--raw3') || process.argv.includes('--raw4') || process.argv.includes('--raw5') || process.argv.includes('--raw6') || process.argv.includes('--raw7') || process.argv.includes('--raw8') || process.argv.includes('--raw9') || process.argv.includes('--raw10') || process.argv.includes('--raw11') || process.argv.includes('--raw12') || process.argv.includes('--raw13') || process.argv.includes('--raw14') || process.argv.includes('--raw15') || process.argv.includes('--raw16') || process.argv.includes('--raw17') || process.argv.includes('--raw18');

  // Step 1: Compile firmware (or use raw test firmware)
  let binary: Uint8Array;
  if (useRaw) {
    binary = buildRawFirmware();
  } else if (process.argv.includes('--rust')) {
    const firmwareSrc = readFileSync(resolve(__dirname, 'firmware/hello.rs'), 'utf8');
    binary = await compileFirmware(firmwareSrc, 'rust');
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

main().catch(e => { console.error(e); process.exit(1); });

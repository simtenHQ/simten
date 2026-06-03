/**
 * RV32I_Core — the canonical 5-stage pipelined RV32I CPU datapath.
 *
 * Single source of truth: the FPGA build (`hardware/ulx3s/projects/cpu`), the
 * web debugger, and the blog board all import this instead of re-wiring their
 * own copy. The pipeline primitives it composes live in `./rv32i.js`.
 *
 * Bare core: instruction/data memory is external (driven through the
 * `instruction`/`data_read` ports), so a wrapper supplies IMEM/DMEM/UART/etc.
 *
 * `debug` flag (default off): when on, exposes a register-file scan port
 * (`debug_addr`/`debug_value`) and the five pipeline-stage PCs
 * (`if_pc`/`id_pc`/`ex_pc`/`mem_pc4`/`wb_pc4`) as outputs, for the debugger UI.
 * When off, the emitted circuit is byte-identical to the FPGA core — the debug
 * ports are absent from the runtime config (so they never reach the IR) and the
 * connect array is exactly the base sequence. The debug ports are kept present
 * in the *type* (via the cast below) so the flag's consumers and this module's
 * own `connect` can reference them without per-site casts; only the debugger
 * sets `debug: true`, and it's the only consumer that touches them.
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';
import type { BuiltCircuit } from '../circuit/types.js';
import { Constant } from './io.js';
import { Register } from './sequential.js';
import { Adder, BusAnd } from './arithmetic.js';
import { BitSlice, Mux } from './routing.js';
import { And, Or, Not } from './logic.js';
import {
  RV32I_HazardUnit, RV32I_Decode, RV32I_ImmGen, RV32I_Control,
  RV32I_RegisterFile, RV32I_WBBypass, RV32I_ForwardingUnit, RV32I_ALU,
  RV32I_BranchComp, RV32I_WritebackMux, RV32I_NextPCMux, RV32I_LoadAlignFull,
} from './rv32i.js';

type B = ReturnType<typeof bus>;
type Bit = typeof bit;

const RV32I_CoreFactory = circuit('RV32I_Core', ({ debug = false }: { debug?: boolean } = {}) => {
  // Runtime-conditional ports (absent when !debug → byte-identical IR), cast so
  // the debug ports are always present in the inferred type. See module header.
  const inputs = {
    instruction: bus(32), data_read: bus(32), net_rx_data: bus(32), net_rx_valid: bit, net_rx_frame: bit,
    ...(debug ? { debug_addr: bus(5) } : {}),
  } as unknown as {
    instruction: B; data_read: B; net_rx_data: B; net_rx_valid: Bit; net_rx_frame: Bit; debug_addr: B;
  };

  const outputs = {
    instr_addr: bus(32), data_addr: bus(32), data_write: bus(32), data_mem_read: bit, data_mem_write: bit, data_funct3: bus(3), net_tx_data: bus(32), net_tx_valid: bit, net_tx_frame: bit, pc_out: bus(32),
    ...(debug ? { debug_value: bus(32), if_pc: bus(32), id_pc: bus(32), ex_pc: bus(32), mem_pc4: bus(32), wb_pc4: bus(32) } : {}),
  } as unknown as {
    instr_addr: B; data_addr: B; data_write: B; data_mem_read: Bit; data_mem_write: Bit; data_funct3: B; net_tx_data: B; net_tx_valid: Bit; net_tx_frame: Bit; pc_out: B;
    debug_value: B; if_pc: B; id_pc: B; ex_pc: B; mem_pc4: B; wb_pc4: B;
  };

  return {
    inputs,
    outputs,
    nodes: {
      four: Constant({ value: 4, width: 32 }),
      zero32: Constant({ value: 0, width: 32 }),
      zero5: Constant({ value: 0, width: 5 }),
      zero4: Constant({ value: 0, width: 4 }),
      zero3: Constant({ value: 0, width: 3 }),
      zero1: Constant({ value: 0, width: 1 }),
      one1: Constant({ value: 1, width: 1 }),
      hazard: RV32I_HazardUnit,
      stall_inv: Not,
      pc: Register({ width: 32 }),
      pc_plus4: Adder({ width: 32 }),
      ifid_instr_mux: Mux({ width: 32 }),
      ifid_instr: Register({ width: 32 }),
      ifid_pc_mux: Mux({ width: 32 }),
      ifid_pc: Register({ width: 32 }),
      ifid_pc4_mux: Mux({ width: 32 }),
      ifid_pc4: Register({ width: 32 }),
      decode: RV32I_Decode,
      immgen: RV32I_ImmGen,
      control: RV32I_Control,
      funct7_splitter: BitSlice({ low: 5, high: 5 }),
      regfile: RV32I_RegisterFile,
      ifid_decode_for_hazard: RV32I_Decode,
      idex_flush: Or,
      idex_pc: Register({ width: 32 }),
      idex_pc4: Register({ width: 32 }),
      wb_bypass1: RV32I_WBBypass,
      wb_bypass2: RV32I_WBBypass,
      idex_read1: Register({ width: 32 }),
      idex_read2: Register({ width: 32 }),
      idex_imm: Register({ width: 32 }),
      idex_rs1_mux: Mux({ width: 5 }),
      idex_rs1: Register({ width: 5 }),
      idex_rs2_mux: Mux({ width: 5 }),
      idex_rs2: Register({ width: 5 }),
      idex_rd_mux: Mux({ width: 5 }),
      idex_rd: Register({ width: 5 }),
      idex_funct3_mux: Mux({ width: 3 }),
      idex_funct3: Register({ width: 3 }),
      idex_alu_op_mux: Mux({ width: 4 }),
      idex_alu_op: Register({ width: 4 }),
      idex_alu_src_mux: Mux({ width: 1 }),
      idex_alu_src: Register({ width: 1 }),
      idex_mem_read_mux: Mux({ width: 1 }),
      idex_mem_read: Register({ width: 1 }),
      idex_mem_write_mux: Mux({ width: 1 }),
      idex_mem_write: Register({ width: 1 }),
      idex_reg_write_mux: Mux({ width: 1 }),
      idex_reg_write: Register({ width: 1 }),
      idex_mem_to_reg_mux: Mux({ width: 1 }),
      idex_mem_to_reg: Register({ width: 1 }),
      idex_branch_mux: Mux({ width: 1 }),
      idex_branch: Register({ width: 1 }),
      idex_jump_mux: Mux({ width: 1 }),
      idex_jump: Register({ width: 1 }),
      idex_lui_mux: Mux({ width: 1 }),
      idex_lui: Register({ width: 1 }),
      idex_auipc_mux: Mux({ width: 1 }),
      idex_auipc: Register({ width: 1 }),
      idex_is_jalr_mux: Mux({ width: 1 }),
      idex_is_jalr: Register({ width: 1 }),
      forward: RV32I_ForwardingUnit,
      fwd_a_bit0: BitSlice({ low: 0, high: 0 }),
      fwd_a_bit1: BitSlice({ low: 1, high: 1 }),
      fwd_a_mux1: Mux({ width: 32 }),
      fwd_a_mux2: Mux({ width: 32 }),
      fwd_b_bit0: BitSlice({ low: 0, high: 0 }),
      fwd_b_bit1: BitSlice({ low: 1, high: 1 }),
      fwd_b_mux1: Mux({ width: 32 }),
      fwd_b_mux2: Mux({ width: 32 }),
      alu_src_mux: Mux({ width: 32 }),
      alu: RV32I_ALU,
      branch_comp: RV32I_BranchComp,
      branch_target: Adder({ width: 32 }),
      jalr_target: BusAnd({ width: 32 }),
      jalr_mask: Constant({ value: 4294967294, width: 32 }),
      pc_plus_imm: Adder({ width: 32 }),
      ex_result: RV32I_WritebackMux,
      branch_and: And,
      next_pc: RV32I_NextPCMux,
      pc_src_taken: Or,
      pc_next_mux: Mux({ width: 32 }),
      exmem_alu_result: Register({ width: 32 }),
      exmem_result: Register({ width: 32 }),
      exmem_read2: Register({ width: 32 }),
      exmem_rd: Register({ width: 5 }),
      exmem_funct3: Register({ width: 3 }),
      exmem_pc4: Register({ width: 32 }),
      exmem_imm: Register({ width: 32 }),
      exmem_pc_plus_imm: Register({ width: 32 }),
      exmem_mem_read: Register({ width: 1 }),
      exmem_mem_write: Register({ width: 1 }),
      exmem_reg_write: Register({ width: 1 }),
      exmem_mem_to_reg: Register({ width: 1 }),
      exmem_lui: Register({ width: 1 }),
      exmem_auipc: Register({ width: 1 }),
      exmem_jump: Register({ width: 1 }),
      memwb_alu_result: Register({ width: 32 }),
      memwb_load_data: Register({ width: 32 }),
      memwb_rd: Register({ width: 5 }),
      memwb_pc4: Register({ width: 32 }),
      memwb_imm: Register({ width: 32 }),
      memwb_pc_plus_imm: Register({ width: 32 }),
      memwb_reg_write: Register({ width: 1 }),
      memwb_mem_to_reg: Register({ width: 1 }),
      memwb_lui: Register({ width: 1 }),
      memwb_auipc: Register({ width: 1 }),
      memwb_jump: Register({ width: 1 }),
      exmem_lo2: BitSlice({ low: 0, high: 1 }),
      memwb_byte_offset: Register({ width: 2 }),
      memwb_funct3: Register({ width: 3 }),
      load_align: RV32I_LoadAlignFull,
      wb_mux: RV32I_WritebackMux,
    },
    connect: ({ inputs, outputs, nodes: { four, zero32, zero5, zero4, zero3, zero1, one1, hazard, stall_inv, pc, pc_plus4, ifid_instr_mux, ifid_instr, ifid_pc_mux, ifid_pc, ifid_pc4_mux, ifid_pc4, decode, immgen, control, funct7_splitter, regfile, ifid_decode_for_hazard, idex_flush, idex_pc, idex_pc4, wb_bypass1, wb_bypass2, idex_read1, idex_read2, idex_imm, idex_rs1_mux, idex_rs1, idex_rs2_mux, idex_rs2, idex_rd_mux, idex_rd, idex_funct3_mux, idex_funct3, idex_alu_op_mux, idex_alu_op, idex_alu_src_mux, idex_alu_src, idex_mem_read_mux, idex_mem_read, idex_mem_write_mux, idex_mem_write, idex_reg_write_mux, idex_reg_write, idex_mem_to_reg_mux, idex_mem_to_reg, idex_branch_mux, idex_branch, idex_jump_mux, idex_jump, idex_lui_mux, idex_lui, idex_auipc_mux, idex_auipc, idex_is_jalr_mux, idex_is_jalr, forward, fwd_a_bit0, fwd_a_bit1, fwd_a_mux1, fwd_a_mux2, fwd_b_bit0, fwd_b_bit1, fwd_b_mux1, fwd_b_mux2, alu_src_mux, alu, branch_comp, branch_target, jalr_target, jalr_mask, pc_plus_imm, ex_result, branch_and, next_pc, pc_src_taken, pc_next_mux, exmem_alu_result, exmem_result, exmem_read2, exmem_rd, exmem_funct3, exmem_pc4, exmem_imm, exmem_pc_plus_imm, exmem_mem_read, exmem_mem_write, exmem_reg_write, exmem_mem_to_reg, exmem_lui, exmem_auipc, exmem_jump, memwb_alu_result, memwb_load_data, memwb_rd, memwb_pc4, memwb_imm, memwb_pc_plus_imm, memwb_reg_write, memwb_mem_to_reg, memwb_lui, memwb_auipc, memwb_jump, exmem_lo2, memwb_byte_offset, memwb_funct3, load_align, wb_mux } }) => {
      const rows = [
        hazard.stall.to(stall_inv.in, idex_flush.b),
        pc.q.to(pc_plus4.a, outputs.instr_addr, ifid_pc_mux.in0, outputs.pc_out),
        four.out.to(pc_plus4.b),
        stall_inv.out.to(pc.we, ifid_instr.we, ifid_pc.we, ifid_pc4.we),
        inputs.instruction.to(ifid_instr_mux.in0),
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
        exmem_alu_result.q.to(outputs.data_addr, memwb_alu_result.data, exmem_lo2.in),
        exmem_lo2.out.to(memwb_byte_offset.data),
        exmem_read2.q.to(outputs.data_write),
        exmem_mem_read.q.to(outputs.data_mem_read),
        exmem_mem_write.q.to(outputs.data_mem_write),
        exmem_funct3.q.to(outputs.data_funct3, memwb_funct3.data),
        inputs.data_read.to(memwb_load_data.data),
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
      ];

      // Debug-only wiring — appended LAST so the `!debug` connection sequence is
      // exactly the base array above (byte-identical FPGA netlist). The scan port
      // surfaces the regfile's third read port; the five PCs expose pipeline state
      // as documented outputs (vs. fragile internal-node-label reads).
      if (debug) {
        rows.push(
          inputs.debug_addr.to(regfile.debug_rs),
          regfile.debug_read.to(outputs.debug_value),
          pc.q.to(outputs.if_pc),
          ifid_pc.q.to(outputs.id_pc),
          idex_pc.q.to(outputs.ex_pc),
          exmem_pc4.q.to(outputs.mem_pc4),
          memwb_pc4.q.to(outputs.wb_pc4),
        );
      }

      return rows;
    },
  };
});

// The factory's inferred type spells out all ~120 sub-nodes in its `Nodes` type
// parameter — internal detail no consumer uses (wrappers only touch the core's
// ports). Referencing `typeof RV32I_CoreFactory` (even via `ReturnType`) would
// drag that whole type into the shipped `@simten/core` .d.ts bundle and the
// editor's ambient types, past budget. So annotate the public export with the
// ports spelled out explicitly (compact) and drop `Nodes` entirely.
type CoreIns = {
  instruction: B; data_read: B; net_rx_data: B; net_rx_valid: Bit; net_rx_frame: Bit; debug_addr: B;
};
type CoreOuts = {
  instr_addr: B; data_addr: B; data_write: B; data_mem_read: Bit; data_mem_write: Bit; data_funct3: B;
  net_tx_data: B; net_tx_valid: Bit; net_tx_frame: Bit; pc_out: B;
  debug_value: B; if_pc: B; id_pc: B; ex_pc: B; mem_pc4: B; wb_pc4: B;
};

export const RV32I_Core = RV32I_CoreFactory as unknown as (opts?: { debug?: boolean }) => BuiltCircuit<CoreIns, CoreOuts>;

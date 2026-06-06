/**
 * RV32I_Core — the canonical 5-stage pipelined RV32I CPU datapath.
 *
 * Single source of truth: the FPGA build (`hardware/ulx3s/projects/cpu`), the
 * web debugger, and the blog board all import this instead of re-wiring their
 * own copy. The pipeline primitives it composes live in `./rv32i.js`.
 *
 * Structure: each pipeline stage is a composite (`RV32I_IF_Stage`,
 * `RV32I_ID_Stage`, `RV32I_EX_Stage`, `RV32I_WB_Stage`) with the pipeline
 * register banks between them (`RV32I_IFID_Regs`, `RV32I_IDEX_Regs`,
 * `RV32I_EXMEM_Regs`, `RV32I_MEMWB_Regs`), plus the hazard and forwarding
 * units at core level — the textbook diagram, drillable level by level.
 * There is no MEM stage composite: memory is external (see below), so the
 * MEM "stage" is exactly the EXMEM bank's outputs leaving through the
 * `data_*` ports and the read value re-entering at the MEMWB bank.
 * The stage composites are an internal detail (not exported): consumers see
 * only the core's ports, and the canvas reaches the stages through the built
 * circuit's dependency graph.
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

// ─── IF — instruction fetch ─────────────────────────────────────────────────
// PC register (stall-gated), PC+4, and the redirect mux that accepts the
// taken-branch/jump target computed in EX.
const RV32I_IF_Stage = circuit('RV32I_IF_Stage', () => ({
  inputs: { stall_n: bit, redirect_taken: bit, redirect_target: bus(32) },
  outputs: { pc: bus(32), pc4: bus(32) },
  nodes: {
    pc: Register({ width: 32 }),
    four: Constant({ value: 4, width: 32 }),
    pc_plus4: Adder({ width: 32 }),
    pc_next_mux: Mux({ width: 32 }),
  },
  connect: ({ inputs, outputs, nodes: { pc, four, pc_plus4, pc_next_mux } }) => [
    pc.q.to(pc_plus4.a, outputs.pc),
    four.out.to(pc_plus4.b),
    pc_plus4.sum.to(pc_next_mux.in0, outputs.pc4),
    inputs.redirect_target.to(pc_next_mux.in1),
    inputs.redirect_taken.to(pc_next_mux.sel),
    pc_next_mux.out.to(pc.data),
    inputs.stall_n.to(pc.we),
  ],
}));

// ─── IF/ID — fetch→decode pipeline registers ────────────────────────────────
// Stall-gated (we) and flushable (taken branch/jump squashes the fetched
// instruction to a bubble).
const RV32I_IFID_Regs = circuit('RV32I_IFID_Regs', () => ({
  inputs: { instruction_in: bus(32), pc_in: bus(32), pc4_in: bus(32), we: bit, flush: bit },
  outputs: { instruction: bus(32), pc: bus(32), pc4: bus(32) },
  nodes: {
    zero32: Constant({ value: 0, width: 32 }),
    instr_mux: Mux({ width: 32 }),
    instr: Register({ width: 32 }),
    pc_mux: Mux({ width: 32 }),
    pc: Register({ width: 32 }),
    pc4_mux: Mux({ width: 32 }),
    pc4: Register({ width: 32 }),
  },
  connect: ({ inputs, outputs, nodes: { zero32, instr_mux, instr, pc_mux, pc, pc4_mux, pc4 } }) => [
    inputs.instruction_in.to(instr_mux.in0),
    inputs.pc_in.to(pc_mux.in0),
    inputs.pc4_in.to(pc4_mux.in0),
    zero32.out.to(instr_mux.in1, pc_mux.in1, pc4_mux.in1),
    inputs.flush.to(instr_mux.sel, pc_mux.sel, pc4_mux.sel),
    instr_mux.out.to(instr.data),
    pc_mux.out.to(pc.data),
    pc4_mux.out.to(pc4.data),
    inputs.we.to(instr.we, pc.we, pc4.we),
    instr.q.to(outputs.instruction),
    pc.q.to(outputs.pc),
    pc4.q.to(outputs.pc4),
  ],
}));

// ─── ID — decode, control, register read ────────────────────────────────────
// Decode + immgen + control + register file, with the WB bypasses (write-back
// value forwarded combinationally to a same-cycle read of the same register).
// `hazard_decode` is a second decode of the same instruction whose rs1/rs2 feed
// the hazard unit. Debug scan port (`debug_rs`/`debug_read`) follows the same
// runtime-conditional pattern as the core's `debug` flag.
const RV32I_ID_Stage = circuit('RV32I_ID_Stage', ({ debug = false }: { debug?: boolean } = {}) => {
  const inputs = {
    instruction: bus(32), wb_write_data: bus(32), wb_rd: bus(5), wb_we: bit,
    ...(debug ? { debug_rs: bus(5) } : {}),
  } as unknown as { instruction: B; wb_write_data: B; wb_rd: B; wb_we: Bit; debug_rs: B };

  const outputs = {
    read1: bus(32), read2: bus(32), imm: bus(32),
    rs1: bus(5), rs2: bus(5), rd: bus(5), funct3: bus(3),
    alu_op: bus(4), alu_src: bit, mem_read: bit, mem_write: bit, reg_write: bit,
    mem_to_reg: bit, branch: bit, jump: bit, lui: bit, auipc: bit, is_jalr: bit,
    hazard_rs1: bus(5), hazard_rs2: bus(5),
    ...(debug ? { debug_read: bus(32) } : {}),
  } as unknown as {
    read1: B; read2: B; imm: B; rs1: B; rs2: B; rd: B; funct3: B;
    alu_op: B; alu_src: Bit; mem_read: Bit; mem_write: Bit; reg_write: Bit;
    mem_to_reg: Bit; branch: Bit; jump: Bit; lui: Bit; auipc: Bit; is_jalr: Bit;
    hazard_rs1: B; hazard_rs2: B; debug_read: B;
  };

  return {
    inputs,
    outputs,
    nodes: {
      decode: RV32I_Decode,
      immgen: RV32I_ImmGen,
      control: RV32I_Control,
      funct7_splitter: BitSlice({ low: 5, high: 5 }),
      regfile: RV32I_RegisterFile,
      hazard_decode: RV32I_Decode,
      wb_bypass1: RV32I_WBBypass,
      wb_bypass2: RV32I_WBBypass,
    },
    connect: ({ inputs, outputs, nodes: { decode, immgen, control, funct7_splitter, regfile, hazard_decode, wb_bypass1, wb_bypass2 } }) => {
      const rows = [
        inputs.instruction.to(decode.instruction, immgen.instruction, hazard_decode.instruction),
        decode.opcode.to(control.opcode),
        decode.funct3.to(control.funct3, outputs.funct3),
        decode.funct7.to(funct7_splitter.in),
        funct7_splitter.out.to(control.funct7_bit),
        decode.rs1.to(regfile.rs1, wb_bypass1.rs_addr, outputs.rs1),
        decode.rs2.to(regfile.rs2, wb_bypass2.rs_addr, outputs.rs2),
        decode.rd.to(outputs.rd),
        hazard_decode.rs1.to(outputs.hazard_rs1),
        hazard_decode.rs2.to(outputs.hazard_rs2),
        regfile.read1.to(wb_bypass1.rs_val),
        regfile.read2.to(wb_bypass2.rs_val),
        inputs.wb_write_data.to(wb_bypass1.wb_val, wb_bypass2.wb_val, regfile.write_data),
        inputs.wb_rd.to(wb_bypass1.wb_rd, wb_bypass2.wb_rd, regfile.rd),
        inputs.wb_we.to(wb_bypass1.wb_we, wb_bypass2.wb_we, regfile.we),
        wb_bypass1.out.to(outputs.read1),
        wb_bypass2.out.to(outputs.read2),
        immgen.immediate.to(outputs.imm),
        control.alu_op.to(outputs.alu_op),
        control.alu_src.to(outputs.alu_src),
        control.mem_read.to(outputs.mem_read),
        control.mem_write.to(outputs.mem_write),
        control.reg_write.to(outputs.reg_write),
        control.mem_to_reg.to(outputs.mem_to_reg),
        control.branch.to(outputs.branch),
        control.jump.to(outputs.jump),
        control.lui.to(outputs.lui),
        control.auipc.to(outputs.auipc),
        control.is_jalr.to(outputs.is_jalr),
      ];
      if (debug) {
        rows.push(
          inputs.debug_rs.to(regfile.debug_rs),
          regfile.debug_read.to(outputs.debug_read),
        );
      }
      return rows;
    },
  };
}) as unknown as (opts?: { debug?: boolean }) => BuiltCircuit<
  { instruction: B; wb_write_data: B; wb_rd: B; wb_we: Bit; debug_rs: B },
  {
    read1: B; read2: B; imm: B; rs1: B; rs2: B; rd: B; funct3: B;
    alu_op: B; alu_src: Bit; mem_read: Bit; mem_write: Bit; reg_write: Bit;
    mem_to_reg: Bit; branch: Bit; jump: Bit; lui: Bit; auipc: Bit; is_jalr: Bit;
    hazard_rs1: B; hazard_rs2: B; debug_read: B;
  }
>;

// ─── ID/EX — decode→execute pipeline registers ──────────────────────────────
// The bubble-insertion point: flush OR stall zeroes the control signals (and
// rs1/rs2/rd/funct3/alu_op) via the per-path muxes; the data paths (pc, pc4,
// read values, immediate) latch through unmuxed.
const RV32I_IDEX_Regs = circuit('RV32I_IDEX_Regs', () => ({
  inputs: {
    pc_in: bus(32), pc4_in: bus(32), read1_in: bus(32), read2_in: bus(32), imm_in: bus(32),
    rs1_in: bus(5), rs2_in: bus(5), rd_in: bus(5), funct3_in: bus(3),
    alu_op_in: bus(4), alu_src_in: bit, mem_read_in: bit, mem_write_in: bit, reg_write_in: bit,
    mem_to_reg_in: bit, branch_in: bit, jump_in: bit, lui_in: bit, auipc_in: bit, is_jalr_in: bit,
    flush: bit, stall: bit,
  },
  outputs: {
    pc: bus(32), pc4: bus(32), read1: bus(32), read2: bus(32), imm: bus(32),
    rs1: bus(5), rs2: bus(5), rd: bus(5), funct3: bus(3),
    alu_op: bus(4), alu_src: bit, mem_read: bit, mem_write: bit, reg_write: bit,
    mem_to_reg: bit, branch: bit, jump: bit, lui: bit, auipc: bit, is_jalr: bit,
  },
  nodes: {
    one1: Constant({ value: 1, width: 1 }),
    zero5: Constant({ value: 0, width: 5 }),
    zero4: Constant({ value: 0, width: 4 }),
    zero3: Constant({ value: 0, width: 3 }),
    zero1: Constant({ value: 0, width: 1 }),
    flush_or: Or,
    pc: Register({ width: 32 }),
    pc4: Register({ width: 32 }),
    read1: Register({ width: 32 }),
    read2: Register({ width: 32 }),
    imm: Register({ width: 32 }),
    rs1_mux: Mux({ width: 5 }),
    rs1: Register({ width: 5 }),
    rs2_mux: Mux({ width: 5 }),
    rs2: Register({ width: 5 }),
    rd_mux: Mux({ width: 5 }),
    rd: Register({ width: 5 }),
    funct3_mux: Mux({ width: 3 }),
    funct3: Register({ width: 3 }),
    alu_op_mux: Mux({ width: 4 }),
    alu_op: Register({ width: 4 }),
    alu_src_mux: Mux({ width: 1 }),
    alu_src: Register({ width: 1 }),
    mem_read_mux: Mux({ width: 1 }),
    mem_read: Register({ width: 1 }),
    mem_write_mux: Mux({ width: 1 }),
    mem_write: Register({ width: 1 }),
    reg_write_mux: Mux({ width: 1 }),
    reg_write: Register({ width: 1 }),
    mem_to_reg_mux: Mux({ width: 1 }),
    mem_to_reg: Register({ width: 1 }),
    branch_mux: Mux({ width: 1 }),
    branch: Register({ width: 1 }),
    jump_mux: Mux({ width: 1 }),
    jump: Register({ width: 1 }),
    lui_mux: Mux({ width: 1 }),
    lui: Register({ width: 1 }),
    auipc_mux: Mux({ width: 1 }),
    auipc: Register({ width: 1 }),
    is_jalr_mux: Mux({ width: 1 }),
    is_jalr: Register({ width: 1 }),
  },
  connect: ({ inputs, outputs, nodes }) => {
    const { one1, zero5, zero4, zero3, zero1, flush_or } = nodes;
    // The 15 squashable paths share one shape: input → mux.in0, zero → mux.in1,
    // bubble → mux.sel, mux → reg.data, reg.q → output.
    const muxed = [
      { mux: nodes.rs1_mux, reg: nodes.rs1, zero: zero5, in: inputs.rs1_in, out: outputs.rs1 },
      { mux: nodes.rs2_mux, reg: nodes.rs2, zero: zero5, in: inputs.rs2_in, out: outputs.rs2 },
      { mux: nodes.rd_mux, reg: nodes.rd, zero: zero5, in: inputs.rd_in, out: outputs.rd },
      { mux: nodes.funct3_mux, reg: nodes.funct3, zero: zero3, in: inputs.funct3_in, out: outputs.funct3 },
      { mux: nodes.alu_op_mux, reg: nodes.alu_op, zero: zero4, in: inputs.alu_op_in, out: outputs.alu_op },
      { mux: nodes.alu_src_mux, reg: nodes.alu_src, zero: zero1, in: inputs.alu_src_in, out: outputs.alu_src },
      { mux: nodes.mem_read_mux, reg: nodes.mem_read, zero: zero1, in: inputs.mem_read_in, out: outputs.mem_read },
      { mux: nodes.mem_write_mux, reg: nodes.mem_write, zero: zero1, in: inputs.mem_write_in, out: outputs.mem_write },
      { mux: nodes.reg_write_mux, reg: nodes.reg_write, zero: zero1, in: inputs.reg_write_in, out: outputs.reg_write },
      { mux: nodes.mem_to_reg_mux, reg: nodes.mem_to_reg, zero: zero1, in: inputs.mem_to_reg_in, out: outputs.mem_to_reg },
      { mux: nodes.branch_mux, reg: nodes.branch, zero: zero1, in: inputs.branch_in, out: outputs.branch },
      { mux: nodes.jump_mux, reg: nodes.jump, zero: zero1, in: inputs.jump_in, out: outputs.jump },
      { mux: nodes.lui_mux, reg: nodes.lui, zero: zero1, in: inputs.lui_in, out: outputs.lui },
      { mux: nodes.auipc_mux, reg: nodes.auipc, zero: zero1, in: inputs.auipc_in, out: outputs.auipc },
      { mux: nodes.is_jalr_mux, reg: nodes.is_jalr, zero: zero1, in: inputs.is_jalr_in, out: outputs.is_jalr },
    ];
    const plain = [
      { reg: nodes.pc, in: inputs.pc_in, out: outputs.pc },
      { reg: nodes.pc4, in: inputs.pc4_in, out: outputs.pc4 },
      { reg: nodes.read1, in: inputs.read1_in, out: outputs.read1 },
      { reg: nodes.read2, in: inputs.read2_in, out: outputs.read2 },
      { reg: nodes.imm, in: inputs.imm_in, out: outputs.imm },
    ];
    return [
      inputs.flush.to(flush_or.a),
      inputs.stall.to(flush_or.b),
      ...muxed.flatMap((p) => [
        p.in.to(p.mux.in0),
        p.zero.out.to(p.mux.in1),
        flush_or.out.to(p.mux.sel),
        p.mux.out.to(p.reg.data),
        p.reg.q.to(p.out),
      ]),
      ...plain.flatMap((p) => [p.in.to(p.reg.data), p.reg.q.to(p.out)]),
      one1.out.to(
        nodes.pc.we, nodes.pc4.we, nodes.read1.we, nodes.read2.we, nodes.imm.we,
        ...muxed.map((p) => p.reg.we),
      ),
    ];
  },
}));

// ─── EX — execute ───────────────────────────────────────────────────────────
// Forwarding muxes feed the ALU and branch comparator; computes the EX-stage
// writeback candidate (`result`, what MEM-stage forwarding serves), the store
// value, and the branch/jump redirect (target + taken) consumed by IF.
const RV32I_EX_Stage = circuit('RV32I_EX_Stage', () => ({
  inputs: {
    pc: bus(32), pc4: bus(32), read1: bus(32), read2: bus(32), imm: bus(32),
    alu_op: bus(4), alu_src: bit, funct3: bus(3),
    branch: bit, jump: bit, is_jalr: bit, lui: bit, auipc: bit, mem_to_reg: bit,
    forward_a: bus(2), forward_b: bus(2), mem_fwd: bus(32), wb_fwd: bus(32),
  },
  outputs: {
    alu_result: bus(32), result: bus(32), store_data: bus(32), pc_plus_imm: bus(32),
    branch_taken: bit, redirect_taken: bit, redirect_target: bus(32),
  },
  nodes: {
    zero32: Constant({ value: 0, width: 32 }),
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
  },
  connect: ({ inputs, outputs, nodes: { zero32, fwd_a_bit0, fwd_a_bit1, fwd_a_mux1, fwd_a_mux2, fwd_b_bit0, fwd_b_bit1, fwd_b_mux1, fwd_b_mux2, alu_src_mux, alu, branch_comp, branch_target, jalr_target, jalr_mask, pc_plus_imm, ex_result, branch_and, next_pc, pc_src_taken } }) => [
    inputs.forward_a.to(fwd_a_bit0.in, fwd_a_bit1.in),
    inputs.read1.to(fwd_a_mux1.in0),
    inputs.mem_fwd.to(fwd_a_mux1.in1, fwd_b_mux1.in1),
    fwd_a_bit0.out.to(fwd_a_mux1.sel),
    fwd_a_mux1.out.to(fwd_a_mux2.in0),
    inputs.wb_fwd.to(fwd_a_mux2.in1, fwd_b_mux2.in1),
    fwd_a_bit1.out.to(fwd_a_mux2.sel),
    inputs.forward_b.to(fwd_b_bit0.in, fwd_b_bit1.in),
    inputs.read2.to(fwd_b_mux1.in0),
    fwd_b_bit0.out.to(fwd_b_mux1.sel),
    fwd_b_mux1.out.to(fwd_b_mux2.in0),
    fwd_b_bit1.out.to(fwd_b_mux2.sel),
    fwd_b_mux2.out.to(alu_src_mux.in0, branch_comp.b, outputs.store_data),
    inputs.imm.to(alu_src_mux.in1, branch_target.b, pc_plus_imm.b, ex_result.immediate),
    inputs.alu_src.to(alu_src_mux.sel),
    fwd_a_mux2.out.to(alu.a, branch_comp.a),
    alu_src_mux.out.to(alu.b),
    inputs.alu_op.to(alu.alu_op),
    inputs.funct3.to(branch_comp.funct3),
    inputs.pc.to(branch_target.a, pc_plus_imm.a),
    alu.result.to(jalr_target.a, ex_result.alu_result, outputs.alu_result),
    jalr_mask.out.to(jalr_target.b),
    zero32.out.to(ex_result.load_data),
    inputs.pc4.to(ex_result.pc_plus4, next_pc.pc_plus4),
    pc_plus_imm.sum.to(ex_result.pc_plus_imm, outputs.pc_plus_imm),
    inputs.mem_to_reg.to(ex_result.mem_to_reg),
    inputs.lui.to(ex_result.lui),
    inputs.auipc.to(ex_result.auipc),
    inputs.jump.to(ex_result.jump, next_pc.jump, pc_src_taken.b),
    inputs.branch.to(branch_and.a, next_pc.branch),
    branch_comp.take_branch.to(branch_and.b, next_pc.take_branch),
    branch_target.sum.to(next_pc.branch_target, next_pc.jal_target),
    jalr_target.out.to(next_pc.jalr_target),
    inputs.is_jalr.to(next_pc.is_jalr),
    branch_and.out.to(pc_src_taken.a, outputs.branch_taken),
    next_pc.next_pc.to(outputs.redirect_target),
    pc_src_taken.out.to(outputs.redirect_taken),
    ex_result.write_data.to(outputs.result),
  ],
}));

// ─── EX/MEM — execute→memory pipeline registers ─────────────────────────────
const RV32I_EXMEM_Regs = circuit('RV32I_EXMEM_Regs', () => ({
  inputs: {
    alu_result_in: bus(32), result_in: bus(32), store_data_in: bus(32), rd_in: bus(5),
    funct3_in: bus(3), pc4_in: bus(32), imm_in: bus(32), pc_plus_imm_in: bus(32),
    mem_read_in: bit, mem_write_in: bit, reg_write_in: bit, mem_to_reg_in: bit,
    lui_in: bit, auipc_in: bit, jump_in: bit,
  },
  outputs: {
    alu_result: bus(32), result: bus(32), store_data: bus(32), rd: bus(5),
    funct3: bus(3), pc4: bus(32), imm: bus(32), pc_plus_imm: bus(32),
    mem_read: bit, mem_write: bit, reg_write: bit, mem_to_reg: bit,
    lui: bit, auipc: bit, jump: bit,
  },
  nodes: {
    one1: Constant({ value: 1, width: 1 }),
    alu_result: Register({ width: 32 }),
    result: Register({ width: 32 }),
    store_data: Register({ width: 32 }),
    rd: Register({ width: 5 }),
    funct3: Register({ width: 3 }),
    pc4: Register({ width: 32 }),
    imm: Register({ width: 32 }),
    pc_plus_imm: Register({ width: 32 }),
    mem_read: Register({ width: 1 }),
    mem_write: Register({ width: 1 }),
    reg_write: Register({ width: 1 }),
    mem_to_reg: Register({ width: 1 }),
    lui: Register({ width: 1 }),
    auipc: Register({ width: 1 }),
    jump: Register({ width: 1 }),
  },
  connect: ({ inputs, outputs, nodes }) => {
    const paths = [
      { reg: nodes.alu_result, in: inputs.alu_result_in, out: outputs.alu_result },
      { reg: nodes.result, in: inputs.result_in, out: outputs.result },
      { reg: nodes.store_data, in: inputs.store_data_in, out: outputs.store_data },
      { reg: nodes.rd, in: inputs.rd_in, out: outputs.rd },
      { reg: nodes.funct3, in: inputs.funct3_in, out: outputs.funct3 },
      { reg: nodes.pc4, in: inputs.pc4_in, out: outputs.pc4 },
      { reg: nodes.imm, in: inputs.imm_in, out: outputs.imm },
      { reg: nodes.pc_plus_imm, in: inputs.pc_plus_imm_in, out: outputs.pc_plus_imm },
      { reg: nodes.mem_read, in: inputs.mem_read_in, out: outputs.mem_read },
      { reg: nodes.mem_write, in: inputs.mem_write_in, out: outputs.mem_write },
      { reg: nodes.reg_write, in: inputs.reg_write_in, out: outputs.reg_write },
      { reg: nodes.mem_to_reg, in: inputs.mem_to_reg_in, out: outputs.mem_to_reg },
      { reg: nodes.lui, in: inputs.lui_in, out: outputs.lui },
      { reg: nodes.auipc, in: inputs.auipc_in, out: outputs.auipc },
      { reg: nodes.jump, in: inputs.jump_in, out: outputs.jump },
    ];
    return [
      ...paths.flatMap((p) => [p.in.to(p.reg.data), p.reg.q.to(p.out)]),
      nodes.one1.out.to(...paths.map((p) => p.reg.we)),
    ];
  },
}));

// ─── MEM/WB — memory→writeback pipeline registers ───────────────────────────
// `load_data` latches the external memory's read value (the MEM "stage" itself
// is outside the core); `byte_offset` latches the data address's low two bits
// for the WB-stage load aligner.
const RV32I_MEMWB_Regs = circuit('RV32I_MEMWB_Regs', () => ({
  inputs: {
    alu_result_in: bus(32), load_data_in: bus(32), rd_in: bus(5), funct3_in: bus(3),
    pc4_in: bus(32), imm_in: bus(32), pc_plus_imm_in: bus(32),
    reg_write_in: bit, mem_to_reg_in: bit, lui_in: bit, auipc_in: bit, jump_in: bit,
  },
  outputs: {
    alu_result: bus(32), load_data: bus(32), byte_offset: bus(2), rd: bus(5), funct3: bus(3),
    pc4: bus(32), imm: bus(32), pc_plus_imm: bus(32),
    reg_write: bit, mem_to_reg: bit, lui: bit, auipc: bit, jump: bit,
  },
  nodes: {
    one1: Constant({ value: 1, width: 1 }),
    lo2: BitSlice({ low: 0, high: 1 }),
    alu_result: Register({ width: 32 }),
    load_data: Register({ width: 32 }),
    byte_offset: Register({ width: 2 }),
    rd: Register({ width: 5 }),
    funct3: Register({ width: 3 }),
    pc4: Register({ width: 32 }),
    imm: Register({ width: 32 }),
    pc_plus_imm: Register({ width: 32 }),
    reg_write: Register({ width: 1 }),
    mem_to_reg: Register({ width: 1 }),
    lui: Register({ width: 1 }),
    auipc: Register({ width: 1 }),
    jump: Register({ width: 1 }),
  },
  connect: ({ inputs, outputs, nodes }) => {
    const paths = [
      { reg: nodes.alu_result, in: inputs.alu_result_in, out: outputs.alu_result },
      { reg: nodes.load_data, in: inputs.load_data_in, out: outputs.load_data },
      { reg: nodes.rd, in: inputs.rd_in, out: outputs.rd },
      { reg: nodes.funct3, in: inputs.funct3_in, out: outputs.funct3 },
      { reg: nodes.pc4, in: inputs.pc4_in, out: outputs.pc4 },
      { reg: nodes.imm, in: inputs.imm_in, out: outputs.imm },
      { reg: nodes.pc_plus_imm, in: inputs.pc_plus_imm_in, out: outputs.pc_plus_imm },
      { reg: nodes.reg_write, in: inputs.reg_write_in, out: outputs.reg_write },
      { reg: nodes.mem_to_reg, in: inputs.mem_to_reg_in, out: outputs.mem_to_reg },
      { reg: nodes.lui, in: inputs.lui_in, out: outputs.lui },
      { reg: nodes.auipc, in: inputs.auipc_in, out: outputs.auipc },
      { reg: nodes.jump, in: inputs.jump_in, out: outputs.jump },
    ];
    return [
      ...paths.flatMap((p) => [p.in.to(p.reg.data), p.reg.q.to(p.out)]),
      inputs.alu_result_in.to(nodes.lo2.in),
      nodes.lo2.out.to(nodes.byte_offset.data),
      nodes.byte_offset.q.to(outputs.byte_offset),
      nodes.one1.out.to(...paths.map((p) => p.reg.we), nodes.byte_offset.we),
    ];
  },
}));

// ─── WB — writeback ─────────────────────────────────────────────────────────
// Aligns the loaded value (byte/half extraction + sign/zero extension) and
// selects what actually gets written back to the register file.
const RV32I_WB_Stage = circuit('RV32I_WB_Stage', () => ({
  inputs: {
    alu_result: bus(32), load_data: bus(32), byte_offset: bus(2), funct3: bus(3),
    pc4: bus(32), imm: bus(32), pc_plus_imm: bus(32),
    mem_to_reg: bit, lui: bit, auipc: bit, jump: bit,
  },
  outputs: { write_data: bus(32) },
  nodes: {
    load_align: RV32I_LoadAlignFull,
    wb_mux: RV32I_WritebackMux,
  },
  connect: ({ inputs, outputs, nodes: { load_align, wb_mux } }) => [
    inputs.load_data.to(load_align.data),
    inputs.byte_offset.to(load_align.byte_offset),
    inputs.funct3.to(load_align.funct3),
    load_align.out.to(wb_mux.load_data),
    inputs.alu_result.to(wb_mux.alu_result),
    inputs.pc4.to(wb_mux.pc_plus4),
    inputs.imm.to(wb_mux.immediate),
    inputs.pc_plus_imm.to(wb_mux.pc_plus_imm),
    inputs.mem_to_reg.to(wb_mux.mem_to_reg),
    inputs.lui.to(wb_mux.lui),
    inputs.auipc.to(wb_mux.auipc),
    inputs.jump.to(wb_mux.jump),
    wb_mux.write_data.to(outputs.write_data),
  ],
}));

// ─── The core ───────────────────────────────────────────────────────────────
const RV32I_CoreFactory = circuit('RV32I_Core', ({ debug = false }: { debug?: boolean } = {}) => {
  // Runtime-conditional ports (absent when !debug) — cast so the debug ports
  // are always present in the inferred type. See module header.
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
      IF: RV32I_IF_Stage(),
      IFID: RV32I_IFID_Regs(),
      ID: RV32I_ID_Stage({ debug }),
      IDEX: RV32I_IDEX_Regs(),
      EX: RV32I_EX_Stage(),
      EXMEM: RV32I_EXMEM_Regs(),
      MEMWB: RV32I_MEMWB_Regs(),
      WB: RV32I_WB_Stage(),
      hazard: RV32I_HazardUnit,
      forward: RV32I_ForwardingUnit,
      stall_inv: Not,
    },
    connect: ({ inputs, outputs, nodes: { IF, IFID, ID, IDEX, EX, EXMEM, MEMWB, WB, hazard, forward, stall_inv } }) => {
      const rows = [
        // hazard control: stall freezes IF + IF/ID, flush squashes IF/ID,
        // either inserts a bubble at ID/EX
        hazard.stall.to(stall_inv.in, IDEX.stall),
        hazard.flush.to(IFID.flush, IDEX.flush),
        stall_inv.out.to(IF.stall_n, IFID.we),

        // IF → IF/ID (and the fetch/PC ports)
        IF.pc.to(outputs.instr_addr, outputs.pc_out, IFID.pc_in),
        IF.pc4.to(IFID.pc4_in),
        inputs.instruction.to(IFID.instruction_in),

        // IF/ID → ID / ID/EX
        IFID.instruction.to(ID.instruction),
        IFID.pc.to(IDEX.pc_in),
        IFID.pc4.to(IDEX.pc4_in),
        ID.hazard_rs1.to(hazard.if_rs1),
        ID.hazard_rs2.to(hazard.if_rs2),

        // ID → ID/EX
        ID.read1.to(IDEX.read1_in),
        ID.read2.to(IDEX.read2_in),
        ID.imm.to(IDEX.imm_in),
        ID.rs1.to(IDEX.rs1_in),
        ID.rs2.to(IDEX.rs2_in),
        ID.rd.to(IDEX.rd_in),
        ID.funct3.to(IDEX.funct3_in),
        ID.alu_op.to(IDEX.alu_op_in),
        ID.alu_src.to(IDEX.alu_src_in),
        ID.mem_read.to(IDEX.mem_read_in),
        ID.mem_write.to(IDEX.mem_write_in),
        ID.reg_write.to(IDEX.reg_write_in),
        ID.mem_to_reg.to(IDEX.mem_to_reg_in),
        ID.branch.to(IDEX.branch_in),
        ID.jump.to(IDEX.jump_in),
        ID.lui.to(IDEX.lui_in),
        ID.auipc.to(IDEX.auipc_in),
        ID.is_jalr.to(IDEX.is_jalr_in),

        // ID/EX → EX (+ hazard/forwarding taps, + values EX/MEM latches directly)
        IDEX.pc.to(EX.pc),
        IDEX.pc4.to(EX.pc4, EXMEM.pc4_in),
        IDEX.read1.to(EX.read1),
        IDEX.read2.to(EX.read2),
        IDEX.imm.to(EX.imm, EXMEM.imm_in),
        IDEX.rs1.to(forward.id_rs1),
        IDEX.rs2.to(forward.id_rs2),
        IDEX.rd.to(hazard.id_rd, EXMEM.rd_in),
        IDEX.funct3.to(EX.funct3, EXMEM.funct3_in),
        IDEX.alu_op.to(EX.alu_op),
        IDEX.alu_src.to(EX.alu_src),
        IDEX.mem_read.to(hazard.id_mem_read, EXMEM.mem_read_in),
        IDEX.mem_write.to(EXMEM.mem_write_in),
        IDEX.reg_write.to(EXMEM.reg_write_in),
        IDEX.mem_to_reg.to(EX.mem_to_reg, EXMEM.mem_to_reg_in),
        IDEX.branch.to(EX.branch),
        IDEX.jump.to(EX.jump, hazard.jump, EXMEM.jump_in),
        IDEX.lui.to(EX.lui, EXMEM.lui_in),
        IDEX.auipc.to(EX.auipc, EXMEM.auipc_in),
        IDEX.is_jalr.to(EX.is_jalr),

        // forwarding: MEM and WB values back into EX
        forward.forward_a.to(EX.forward_a),
        forward.forward_b.to(EX.forward_b),
        EXMEM.result.to(EX.mem_fwd),
        WB.write_data.to(EX.wb_fwd, ID.wb_write_data),

        // EX → EX/MEM and the branch/jump redirect back to IF
        EX.alu_result.to(EXMEM.alu_result_in),
        EX.result.to(EXMEM.result_in),
        EX.store_data.to(EXMEM.store_data_in),
        EX.pc_plus_imm.to(EXMEM.pc_plus_imm_in),
        EX.branch_taken.to(hazard.branch_taken),
        EX.redirect_taken.to(IF.redirect_taken),
        EX.redirect_target.to(IF.redirect_target),

        // EX/MEM → external memory ports + MEM/WB + forwarding unit
        EXMEM.alu_result.to(outputs.data_addr, MEMWB.alu_result_in),
        EXMEM.store_data.to(outputs.data_write),
        EXMEM.mem_read.to(outputs.data_mem_read),
        EXMEM.mem_write.to(outputs.data_mem_write),
        EXMEM.funct3.to(outputs.data_funct3, MEMWB.funct3_in),
        EXMEM.rd.to(forward.ex_rd, MEMWB.rd_in),
        EXMEM.reg_write.to(forward.ex_reg_write, MEMWB.reg_write_in),
        EXMEM.pc4.to(MEMWB.pc4_in),
        EXMEM.imm.to(MEMWB.imm_in),
        EXMEM.pc_plus_imm.to(MEMWB.pc_plus_imm_in),
        EXMEM.mem_to_reg.to(MEMWB.mem_to_reg_in),
        EXMEM.lui.to(MEMWB.lui_in),
        EXMEM.auipc.to(MEMWB.auipc_in),
        EXMEM.jump.to(MEMWB.jump_in),
        inputs.data_read.to(MEMWB.load_data_in),

        // MEM/WB → WB → register file (in ID) + forwarding unit
        MEMWB.alu_result.to(WB.alu_result),
        MEMWB.load_data.to(WB.load_data),
        MEMWB.byte_offset.to(WB.byte_offset),
        MEMWB.funct3.to(WB.funct3),
        MEMWB.pc4.to(WB.pc4),
        MEMWB.imm.to(WB.imm),
        MEMWB.pc_plus_imm.to(WB.pc_plus_imm),
        MEMWB.mem_to_reg.to(WB.mem_to_reg),
        MEMWB.lui.to(WB.lui),
        MEMWB.auipc.to(WB.auipc),
        MEMWB.jump.to(WB.jump),
        MEMWB.rd.to(ID.wb_rd, forward.mem_rd),
        MEMWB.reg_write.to(ID.wb_we, forward.mem_reg_write),
      ];

      // Debug-only wiring — appended LAST so the `!debug` connection sequence is
      // exactly the base array above. The scan port surfaces the regfile's third
      // read port; the five PCs expose pipeline state as documented outputs.
      if (debug) {
        rows.push(
          inputs.debug_addr.to(ID.debug_rs),
          ID.debug_read.to(outputs.debug_value),
          IF.pc.to(outputs.if_pc),
          IFID.pc.to(outputs.id_pc),
          IDEX.pc.to(outputs.ex_pc),
          EXMEM.pc4.to(outputs.mem_pc4),
          MEMWB.pc4.to(outputs.wb_pc4),
        );
      }

      return rows;
    },
  };
});

// The factory's inferred type spells out all sub-nodes in its `Nodes` type
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

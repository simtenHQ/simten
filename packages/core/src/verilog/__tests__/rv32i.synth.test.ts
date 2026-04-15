/**
 * RV32I component synthesis tests.
 *
 * Runs every RV32I stdlib component through Yosys to prove they're all
 * synthesisable. These are the building blocks of a full RISC-V CPU —
 * if any of them fail synthesis, better to know now.
 *
 * Components under test:
 *
 *   Combinational (eval-synth transpiler path):
 *     RV32I_Decode, RV32I_ALU, RV32I_ImmGen, RV32I_Control,
 *     RV32I_BranchComp, RV32I_WritebackMux, RV32I_NextPCMux,
 *     RV32I_ForwardingUnit, RV32I_WBBypass, RV32I_LoadAlign,
 *     RV32I_HazardUnit
 *
 *   Sequential / Memory:
 *     RV32I_RegisterFile (32×32-bit register file)
 *
 * RV32I_InstrMem and RV32I_DataMem are 64K byte memories — too large for
 * generic synthesis in a unit test (Yosys would try to flatten 65536 FFs).
 * Those are exercised separately when targeting a specific architecture
 * (synth_ecp5 / synth_ice40) where Yosys maps them to block RAM.
 */

import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import {
  RV32I_Decode, RV32I_ALU, RV32I_ImmGen, RV32I_Control,
  RV32I_BranchComp, RV32I_WritebackMux, RV32I_NextPCMux,
  RV32I_ForwardingUnit, RV32I_WBBypass, RV32I_LoadAlign,
  RV32I_HazardUnit, RV32I_RegisterFile,
} from '../../std/index.js';
import type { CircuitLibrary } from '../../types/circuit.js';
import { synthesizeVerilog, hasSynth } from './synth.js';

// ---- helpers ----------------------------------------------------------------

type BuiltCircuit = {
  circuit: import('../../types/circuit.js').Circuit;
  _dependencies: Map<string, { circuit: import('../../types/circuit.js').Circuit }>;
};

function makeLib(top: BuiltCircuit, name: string): CircuitLibrary {
  return {
    resolveCircuit: (n) => (n === name ? top.circuit : top._dependencies.get(n)?.circuit),
    getAllPrimitiveNames: () => [...top._dependencies.keys()],
  };
}

async function synthComponent(top: BuiltCircuit, name: string) {
  const result = exportVerilog(top.circuit, makeLib(top, name), { target: 'synthesis' });
  const resp = await synthesizeVerilog(result, name);
  if (!resp.success) console.error(`[${name}] synth failed:`, JSON.stringify({ error: resp.error, log: resp.log?.slice(-500) }, null, 2));
  return resp;
}

// ---- wrappers ---------------------------------------------------------------
// Each primitive needs a thin composite wrapper so the exporter has a named
// top-level module to work with.

const Decode = circuit('RV32I_Decode_Top', {
  in: { instruction: bus(32) },
  out: { opcode: bus(7), rd: bus(5), funct3: bus(3), rs1: bus(5), rs2: bus(5), funct7: bus(7) },
  nodes: { dec: RV32I_Decode },
  connect: ({ in: i, out: o, dec }) => [
    i.instruction.to(dec.instruction),
    dec.opcode.to(o.opcode), dec.rd.to(o.rd), dec.funct3.to(o.funct3),
    dec.rs1.to(o.rs1), dec.rs2.to(o.rs2), dec.funct7.to(o.funct7),
  ],
});

const ALU = circuit('RV32I_ALU_Top', {
  in: { a: bus(32), b: bus(32), alu_op: bus(4) },
  out: { result: bus(32), zero: bit },
  nodes: { alu: RV32I_ALU },
  connect: ({ in: i, out: o, alu }) => [
    i.a.to(alu.a), i.b.to(alu.b), i.alu_op.to(alu.alu_op),
    alu.result.to(o.result), alu.zero.to(o.zero),
  ],
});

const ImmGen = circuit('RV32I_ImmGen_Top', {
  in: { instruction: bus(32) },
  out: { immediate: bus(32) },
  nodes: { imm: RV32I_ImmGen },
  connect: ({ in: i, out: o, imm }) => [
    i.instruction.to(imm.instruction),
    imm.immediate.to(o.immediate),
  ],
});

const Control = circuit('RV32I_Control_Top', {
  in: { opcode: bus(7), funct3: bus(3), funct7_bit: bit },
  out: { alu_op: bus(4), alu_src: bit, mem_read: bit, mem_write: bit, reg_write: bit, mem_to_reg: bit, branch: bit, jump: bit, lui: bit, auipc: bit, is_jalr: bit },
  nodes: { ctl: RV32I_Control },
  connect: ({ in: i, out: o, ctl }) => [
    i.opcode.to(ctl.opcode), i.funct3.to(ctl.funct3), i.funct7_bit.to(ctl.funct7_bit),
    ctl.alu_op.to(o.alu_op), ctl.alu_src.to(o.alu_src),
    ctl.mem_read.to(o.mem_read), ctl.mem_write.to(o.mem_write),
    ctl.reg_write.to(o.reg_write), ctl.mem_to_reg.to(o.mem_to_reg),
    ctl.branch.to(o.branch), ctl.jump.to(o.jump),
    ctl.lui.to(o.lui), ctl.auipc.to(o.auipc), ctl.is_jalr.to(o.is_jalr),
  ],
});

const BranchComp = circuit('RV32I_BranchComp_Top', {
  in: { a: bus(32), b: bus(32), funct3: bus(3) },
  out: { take_branch: bit },
  nodes: { bc: RV32I_BranchComp },
  connect: ({ in: i, out: o, bc }) => [
    i.a.to(bc.a), i.b.to(bc.b), i.funct3.to(bc.funct3),
    bc.take_branch.to(o.take_branch),
  ],
});

const WritebackMux = circuit('RV32I_WritebackMux_Top', {
  in: { alu_result: bus(32), load_data: bus(32), pc_plus4: bus(32), immediate: bus(32), pc_plus_imm: bus(32), mem_to_reg: bit, lui: bit, auipc: bit, jump: bit },
  out: { write_data: bus(32) },
  nodes: { wb: RV32I_WritebackMux },
  connect: ({ in: i, out: o, wb }) => [
    i.alu_result.to(wb.alu_result), i.load_data.to(wb.load_data),
    i.pc_plus4.to(wb.pc_plus4), i.immediate.to(wb.immediate),
    i.pc_plus_imm.to(wb.pc_plus_imm), i.mem_to_reg.to(wb.mem_to_reg),
    i.lui.to(wb.lui), i.auipc.to(wb.auipc), i.jump.to(wb.jump),
    wb.write_data.to(o.write_data),
  ],
});

const NextPCMux = circuit('RV32I_NextPCMux_Top', {
  in: { pc_plus4: bus(32), branch_target: bus(32), jal_target: bus(32), jalr_target: bus(32), branch: bit, take_branch: bit, jump: bit, is_jalr: bit },
  out: { next_pc: bus(32) },
  nodes: { npc: RV32I_NextPCMux },
  connect: ({ in: i, out: o, npc }) => [
    i.pc_plus4.to(npc.pc_plus4), i.branch_target.to(npc.branch_target),
    i.jal_target.to(npc.jal_target), i.jalr_target.to(npc.jalr_target),
    i.branch.to(npc.branch), i.take_branch.to(npc.take_branch),
    i.jump.to(npc.jump), i.is_jalr.to(npc.is_jalr),
    npc.next_pc.to(o.next_pc),
  ],
});

const ForwardingUnit = circuit('RV32I_ForwardingUnit_Top', {
  in: { id_rs1: bus(5), id_rs2: bus(5), ex_rd: bus(5), ex_reg_write: bit, mem_rd: bus(5), mem_reg_write: bit },
  out: { forward_a: bus(2), forward_b: bus(2) },
  nodes: { fwd: RV32I_ForwardingUnit },
  connect: ({ in: i, out: o, fwd }) => [
    i.id_rs1.to(fwd.id_rs1), i.id_rs2.to(fwd.id_rs2),
    i.ex_rd.to(fwd.ex_rd), i.ex_reg_write.to(fwd.ex_reg_write),
    i.mem_rd.to(fwd.mem_rd), i.mem_reg_write.to(fwd.mem_reg_write),
    fwd.forward_a.to(o.forward_a), fwd.forward_b.to(o.forward_b),
  ],
});

const WBBypass = circuit('RV32I_WBBypass_Top', {
  in: { rs_val: bus(32), rs_addr: bus(5), wb_val: bus(32), wb_rd: bus(5), wb_we: bit },
  out: { out: bus(32) },
  nodes: { byp: RV32I_WBBypass },
  connect: ({ in: i, out: o, byp }) => [
    i.rs_val.to(byp.rs_val), i.rs_addr.to(byp.rs_addr),
    i.wb_val.to(byp.wb_val), i.wb_rd.to(byp.wb_rd), i.wb_we.to(byp.wb_we),
    byp.out.to(o.out),
  ],
});

const LoadAlign = circuit('RV32I_LoadAlign_Top', {
  in: { data: bus(32), funct3: bus(3) },
  out: { out: bus(32) },
  nodes: { la: RV32I_LoadAlign },
  connect: ({ in: i, out: o, la }) => [
    i.data.to(la.data), i.funct3.to(la.funct3),
    la.out.to(o.out),
  ],
});

const HazardUnit = circuit('RV32I_HazardUnit_Top', {
  in: { if_rs1: bus(5), if_rs2: bus(5), id_rd: bus(5), id_mem_read: bit, branch_taken: bit, jump: bit },
  out: { stall: bit, flush: bit },
  nodes: { haz: RV32I_HazardUnit },
  connect: ({ in: i, out: o, haz }) => [
    i.if_rs1.to(haz.if_rs1), i.if_rs2.to(haz.if_rs2),
    i.id_rd.to(haz.id_rd), i.id_mem_read.to(haz.id_mem_read),
    i.branch_taken.to(haz.branch_taken), i.jump.to(haz.jump),
    haz.stall.to(o.stall), haz.flush.to(o.flush),
  ],
});

const RegisterFile = circuit('RV32I_RegisterFile_Top', {
  in: { rs1: bus(5), rs2: bus(5), rd: bus(5), write_data: bus(32), we: bit, debug_rs: bus(5) },
  out: { read1: bus(32), read2: bus(32), debug_read: bus(32) },
  nodes: { rf: RV32I_RegisterFile },
  connect: ({ in: i, out: o, rf }) => [
    i.rs1.to(rf.rs1), i.rs2.to(rf.rs2), i.rd.to(rf.rd),
    i.write_data.to(rf.write_data), i.we.to(rf.we), i.debug_rs.to(rf.debug_rs),
    rf.read1.to(o.read1), rf.read2.to(o.read2), rf.debug_read.to(o.debug_read),
  ],
});

// ---- tests ------------------------------------------------------------------

const d = describe.skipIf(!hasSynth());

d('RV32I combinational components — Yosys synthesis', () => {
  it('RV32I_Decode: instruction field extraction', { timeout: 30000 }, async () => {
    const resp = await synthComponent(Decode as any, 'RV32I_Decode_Top');
    expect(resp.success).toBe(true);
    // Pure bit-slicing (assign opcode = instruction[6:0] etc.) — no gates
    // needed, just wire routing. 0 cells is correct Yosys behaviour here.
    expect(resp.stats!.cells).toBeGreaterThanOrEqual(0);
  });

  it('RV32I_ALU: 32-bit ALU with 10 operations (largest combinational component)', { timeout: 30000 }, async () => {
    const resp = await synthComponent(ALU as any, 'RV32I_ALU_Top');
    expect(resp.success).toBe(true);
    // 32-bit ALU with ADD/SUB/AND/OR/XOR/SLL/SRL/SRA/SLT/SLTU — should be substantial
    expect(resp.stats!.cells).toBeGreaterThan(50);
  });

  it('RV32I_ImmGen: immediate generator (complex bit manipulation)', { timeout: 30000 }, async () => {
    const resp = await synthComponent(ImmGen as any, 'RV32I_ImmGen_Top');
    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);
  });

  it('RV32I_Control: control unit (R/I/S/B/J/U-type decode)', { timeout: 30000 }, async () => {
    const resp = await synthComponent(Control as any, 'RV32I_Control_Top');
    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);
  });

  it('RV32I_BranchComp: branch comparator (BEQ/BNE/BLT/BGE/BLTU/BGEU)', { timeout: 30000 }, async () => {
    const resp = await synthComponent(BranchComp as any, 'RV32I_BranchComp_Top');
    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);
  });

  it('RV32I_WritebackMux: writeback mux (5 sources)', { timeout: 30000 }, async () => {
    const resp = await synthComponent(WritebackMux as any, 'RV32I_WritebackMux_Top');
    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);
  });

  it('RV32I_NextPCMux: next PC mux (seq/branch/jal/jalr)', { timeout: 30000 }, async () => {
    const resp = await synthComponent(NextPCMux as any, 'RV32I_NextPCMux_Top');
    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);
  });

  it('RV32I_ForwardingUnit: data forwarding unit', { timeout: 30000 }, async () => {
    const resp = await synthComponent(ForwardingUnit as any, 'RV32I_ForwardingUnit_Top');
    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);
  });

  it('RV32I_WBBypass: writeback bypass', { timeout: 30000 }, async () => {
    const resp = await synthComponent(WBBypass as any, 'RV32I_WBBypass_Top');
    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);
  });

  it('RV32I_LoadAlign: load alignment (LB/LH/LW/LBU/LHU)', { timeout: 30000 }, async () => {
    const resp = await synthComponent(LoadAlign as any, 'RV32I_LoadAlign_Top');
    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);
  });

  it('RV32I_HazardUnit: hazard detection (stall + flush)', { timeout: 30000 }, async () => {
    const resp = await synthComponent(HazardUnit as any, 'RV32I_HazardUnit_Top');
    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);
  });
});

d('RV32I_RegisterFile — Yosys synthesis', () => {
  it('synthesizes 32×32-bit register file with DFF cells', { timeout: 30000 }, async () => {
    const resp = await synthComponent(RegisterFile as any, 'RV32I_RegisterFile_Top');
    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);

    // 32 registers × 32 bits = 1024 DFFs minimum
    const dffCount = Object.entries(resp.stats!.cellBreakdown)
      .filter(([name]) => name.includes('DFF'))
      .reduce((sum, [, n]) => sum + n, 0);

    expect(dffCount).toBeGreaterThanOrEqual(1024);
  });
});

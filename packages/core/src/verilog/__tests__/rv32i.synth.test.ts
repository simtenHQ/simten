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
  RV32I_Decode,
  RV32I_ALU,
  RV32I_ImmGen,
  RV32I_Control,
  RV32I_BranchComp,
  RV32I_WritebackMux,
  RV32I_NextPCMux,
  RV32I_ForwardingUnit,
  RV32I_WBBypass,
  RV32I_LoadAlign,
  RV32I_HazardUnit,
  RV32I_RegisterFile,
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
  if (!resp.success)
    console.error(
      `[${name}] synth failed:`,
      JSON.stringify({ error: resp.error, log: resp.log?.slice(-500) }, null, 2),
    );
  return resp;
}

// ---- wrappers ---------------------------------------------------------------
// Each primitive needs a thin composite wrapper so the exporter has a named
// top-level module to work with.

const Decode = circuit('RV32I_Decode_Top', {
  inputs: { instruction: bus(32) },
  outputs: { opcode: bus(7), rd: bus(5), funct3: bus(3), rs1: bus(5), rs2: bus(5), funct7: bus(7) },
  nodes: { dec: RV32I_Decode },
  connect: ({ inputs, outputs, nodes: { dec } }) => [
    inputs.instruction.to(dec.instruction),
    dec.opcode.to(outputs.opcode),
    dec.rd.to(outputs.rd),
    dec.funct3.to(outputs.funct3),
    dec.rs1.to(outputs.rs1),
    dec.rs2.to(outputs.rs2),
    dec.funct7.to(outputs.funct7),
  ],
});

const ALU = circuit('RV32I_ALU_Top', {
  inputs: { a: bus(32), b: bus(32), alu_op: bus(4) },
  outputs: { result: bus(32), zero: bit },
  nodes: { alu: RV32I_ALU },
  connect: ({ inputs, outputs, nodes: { alu } }) => [
    inputs.a.to(alu.a),
    inputs.b.to(alu.b),
    inputs.alu_op.to(alu.alu_op),
    alu.result.to(outputs.result),
    alu.zero.to(outputs.zero),
  ],
});

const ImmGen = circuit('RV32I_ImmGen_Top', {
  inputs: { instruction: bus(32) },
  outputs: { immediate: bus(32) },
  nodes: { imm: RV32I_ImmGen },
  connect: ({ inputs, outputs, nodes: { imm } }) => [
    inputs.instruction.to(imm.instruction),
    imm.immediate.to(outputs.immediate),
  ],
});

const Control = circuit('RV32I_Control_Top', {
  inputs: { opcode: bus(7), funct3: bus(3), funct7_bit: bit },
  outputs: {
    alu_op: bus(4),
    alu_src: bit,
    mem_read: bit,
    mem_write: bit,
    reg_write: bit,
    mem_to_reg: bit,
    branch: bit,
    jump: bit,
    lui: bit,
    auipc: bit,
    is_jalr: bit,
  },
  nodes: { ctl: RV32I_Control },
  connect: ({ inputs, outputs, nodes: { ctl } }) => [
    inputs.opcode.to(ctl.opcode),
    inputs.funct3.to(ctl.funct3),
    inputs.funct7_bit.to(ctl.funct7_bit),
    ctl.alu_op.to(outputs.alu_op),
    ctl.alu_src.to(outputs.alu_src),
    ctl.mem_read.to(outputs.mem_read),
    ctl.mem_write.to(outputs.mem_write),
    ctl.reg_write.to(outputs.reg_write),
    ctl.mem_to_reg.to(outputs.mem_to_reg),
    ctl.branch.to(outputs.branch),
    ctl.jump.to(outputs.jump),
    ctl.lui.to(outputs.lui),
    ctl.auipc.to(outputs.auipc),
    ctl.is_jalr.to(outputs.is_jalr),
  ],
});

const BranchComp = circuit('RV32I_BranchComp_Top', {
  inputs: { a: bus(32), b: bus(32), funct3: bus(3) },
  outputs: { take_branch: bit },
  nodes: { bc: RV32I_BranchComp },
  connect: ({ inputs, outputs, nodes: { bc } }) => [
    inputs.a.to(bc.a),
    inputs.b.to(bc.b),
    inputs.funct3.to(bc.funct3),
    bc.take_branch.to(outputs.take_branch),
  ],
});

const WritebackMux = circuit('RV32I_WritebackMux_Top', {
  inputs: {
    alu_result: bus(32),
    load_data: bus(32),
    pc_plus4: bus(32),
    immediate: bus(32),
    pc_plus_imm: bus(32),
    mem_to_reg: bit,
    lui: bit,
    auipc: bit,
    jump: bit,
  },
  outputs: { write_data: bus(32) },
  nodes: { wb: RV32I_WritebackMux },
  connect: ({ inputs, outputs, nodes: { wb } }) => [
    inputs.alu_result.to(wb.alu_result),
    inputs.load_data.to(wb.load_data),
    inputs.pc_plus4.to(wb.pc_plus4),
    inputs.immediate.to(wb.immediate),
    inputs.pc_plus_imm.to(wb.pc_plus_imm),
    inputs.mem_to_reg.to(wb.mem_to_reg),
    inputs.lui.to(wb.lui),
    inputs.auipc.to(wb.auipc),
    inputs.jump.to(wb.jump),
    wb.write_data.to(outputs.write_data),
  ],
});

const NextPCMux = circuit('RV32I_NextPCMux_Top', {
  inputs: {
    pc_plus4: bus(32),
    branch_target: bus(32),
    jal_target: bus(32),
    jalr_target: bus(32),
    branch: bit,
    take_branch: bit,
    jump: bit,
    is_jalr: bit,
  },
  outputs: { next_pc: bus(32) },
  nodes: { npc: RV32I_NextPCMux },
  connect: ({ inputs, outputs, nodes: { npc } }) => [
    inputs.pc_plus4.to(npc.pc_plus4),
    inputs.branch_target.to(npc.branch_target),
    inputs.jal_target.to(npc.jal_target),
    inputs.jalr_target.to(npc.jalr_target),
    inputs.branch.to(npc.branch),
    inputs.take_branch.to(npc.take_branch),
    inputs.jump.to(npc.jump),
    inputs.is_jalr.to(npc.is_jalr),
    npc.next_pc.to(outputs.next_pc),
  ],
});

const ForwardingUnit = circuit('RV32I_ForwardingUnit_Top', {
  inputs: {
    id_rs1: bus(5),
    id_rs2: bus(5),
    ex_rd: bus(5),
    ex_reg_write: bit,
    mem_rd: bus(5),
    mem_reg_write: bit,
  },
  outputs: { forward_a: bus(2), forward_b: bus(2) },
  nodes: { fwd: RV32I_ForwardingUnit },
  connect: ({ inputs, outputs, nodes: { fwd } }) => [
    inputs.id_rs1.to(fwd.id_rs1),
    inputs.id_rs2.to(fwd.id_rs2),
    inputs.ex_rd.to(fwd.ex_rd),
    inputs.ex_reg_write.to(fwd.ex_reg_write),
    inputs.mem_rd.to(fwd.mem_rd),
    inputs.mem_reg_write.to(fwd.mem_reg_write),
    fwd.forward_a.to(outputs.forward_a),
    fwd.forward_b.to(outputs.forward_b),
  ],
});

const WBBypass = circuit('RV32I_WBBypass_Top', {
  inputs: { rs_val: bus(32), rs_addr: bus(5), wb_val: bus(32), wb_rd: bus(5), wb_we: bit },
  outputs: { out: bus(32) },
  nodes: { byp: RV32I_WBBypass },
  connect: ({ inputs, outputs, nodes: { byp } }) => [
    inputs.rs_val.to(byp.rs_val),
    inputs.rs_addr.to(byp.rs_addr),
    inputs.wb_val.to(byp.wb_val),
    inputs.wb_rd.to(byp.wb_rd),
    inputs.wb_we.to(byp.wb_we),
    byp.out.to(outputs.out),
  ],
});

const LoadAlign = circuit('RV32I_LoadAlign_Top', {
  inputs: { data: bus(32), funct3: bus(3) },
  outputs: { out: bus(32) },
  nodes: { la: RV32I_LoadAlign },
  connect: ({ inputs, outputs, nodes: { la } }) => [
    inputs.data.to(la.data),
    inputs.funct3.to(la.funct3),
    la.out.to(outputs.out),
  ],
});

const HazardUnit = circuit('RV32I_HazardUnit_Top', {
  inputs: {
    if_rs1: bus(5),
    if_rs2: bus(5),
    id_rd: bus(5),
    id_mem_read: bit,
    branch_taken: bit,
    jump: bit,
  },
  outputs: { stall: bit, flush: bit },
  nodes: { haz: RV32I_HazardUnit },
  connect: ({ inputs, outputs, nodes: { haz } }) => [
    inputs.if_rs1.to(haz.if_rs1),
    inputs.if_rs2.to(haz.if_rs2),
    inputs.id_rd.to(haz.id_rd),
    inputs.id_mem_read.to(haz.id_mem_read),
    inputs.branch_taken.to(haz.branch_taken),
    inputs.jump.to(haz.jump),
    haz.stall.to(outputs.stall),
    haz.flush.to(outputs.flush),
  ],
});

const RegisterFile = circuit('RV32I_RegisterFile_Top', {
  inputs: { rs1: bus(5), rs2: bus(5), rd: bus(5), write_data: bus(32), we: bit, debug_rs: bus(5) },
  outputs: { read1: bus(32), read2: bus(32), debug_read: bus(32) },
  nodes: { rf: RV32I_RegisterFile },
  connect: ({ inputs, outputs, nodes: { rf } }) => [
    inputs.rs1.to(rf.rs1),
    inputs.rs2.to(rf.rs2),
    inputs.rd.to(rf.rd),
    inputs.write_data.to(rf.write_data),
    inputs.we.to(rf.we),
    inputs.debug_rs.to(rf.debug_rs),
    rf.read1.to(outputs.read1),
    rf.read2.to(outputs.read2),
    rf.debug_read.to(outputs.debug_read),
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

  it('RV32I_ALU: 32-bit ALU with 10 operations (largest combinational component)', {
    timeout: 30000,
  }, async () => {
    const resp = await synthComponent(ALU as any, 'RV32I_ALU_Top');
    expect(resp.success).toBe(true);
    // 32-bit ALU with ADD/SUB/AND/OR/XOR/SLL/SRL/SRA/SLT/SLTU — should be substantial
    expect(resp.stats!.cells).toBeGreaterThan(50);
  });

  it('RV32I_ImmGen: immediate generator (complex bit manipulation)', {
    timeout: 30000,
  }, async () => {
    const resp = await synthComponent(ImmGen as any, 'RV32I_ImmGen_Top');
    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);
  });

  it('RV32I_Control: control unit (R/I/S/B/J/U-type decode)', { timeout: 30000 }, async () => {
    const resp = await synthComponent(Control as any, 'RV32I_Control_Top');
    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);
  });

  it('RV32I_BranchComp: branch comparator (BEQ/BNE/BLT/BGE/BLTU/BGEU)', {
    timeout: 30000,
  }, async () => {
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

/**
 * Standard Library — RISC-V (RV32I) Components
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';

export const RV32I_Decode = circuit('RV32I_Decode', {
  in: { instruction: bus(32) },
  out: { opcode: bus(7), rd: bus(5), funct3: bus(3), rs1: bus(5), rs2: bus(5), funct7: bus(7) },
  eval: ({ instruction }) => {
    const instr = (instruction as number) >>> 0;
    return {
      opcode: instr & 0x7F,
      rd:     (instr >>> 7)  & 0x1F,
      funct3: (instr >>> 12) & 0x7,
      rs1:    (instr >>> 15) & 0x1F,
      rs2:    (instr >>> 20) & 0x1F,
      funct7: (instr >>> 25) & 0x7F,
    };
  },
  meta: { category: 'rv32i', icon: 'DEC', description: 'RISC-V instruction decoder' },
});

export const RV32I_ALU = circuit('RV32I_ALU', {
  in: { a: bus(32), b: bus(32), alu_op: bus(4) },
  out: { result: bus(32), zero: bit },
  eval: ({ a, b, alu_op }) => {
    const au = (a as number) >>> 0;
    const bu = (b as number) >>> 0;
    const op = (alu_op as number) & 0xF;
    let result: number;
    switch (op) {
      case 0: result = (au + bu) >>> 0; break;                         // ADD
      case 1: result = (au - bu) >>> 0; break;                         // SUB
      case 2: result = (au & bu) >>> 0; break;                         // AND
      case 3: result = (au | bu) >>> 0; break;                         // OR
      case 4: result = (au ^ bu) >>> 0; break;                         // XOR
      case 5: result = (au << (bu & 0x1F)) >>> 0; break;               // SLL
      case 6: result = au >>> (bu & 0x1F); break;                      // SRL
      case 7: result = ((au | 0) >> (bu & 0x1F)) >>> 0; break;         // SRA
      case 8: result = ((au | 0) < (bu | 0)) ? 1 : 0; break;          // SLT (signed)
      case 9: result = au < bu ? 1 : 0; break;                         // SLTU (unsigned)
      default: result = 0;
    }
    return { result, zero: result === 0 ? 1 : 0 };
  },
  meta: { category: 'rv32i', icon: 'ALU', description: 'RISC-V ALU' },
});

export const RV32I_ImmGen = circuit('RV32I_ImmGen', {
  in: { instruction: bus(32) },
  out: { immediate: bus(32) },
  eval: ({ instruction }) => {
    const instr = (instruction as number) >>> 0;
    const opcode = instr & 0x7F;
    let imm: number;
    switch (opcode) {
      case 0x13: case 0x03: case 0x67: // I-type
        imm = (instr >> 20) | 0;
        break;
      case 0x23: // S-type
        imm = (((instr >> 25) << 5) | ((instr >>> 7) & 0x1F)) | 0;
        imm = (imm << 20) >> 20;
        break;
      case 0x63: { // B-type
        const b12 = (instr >>> 31) & 1;
        const b11 = (instr >>> 7)  & 1;
        const b10_5 = (instr >>> 25) & 0x3F;
        const b4_1  = (instr >>> 8)  & 0xF;
        imm = (b12 << 12) | (b11 << 11) | (b10_5 << 5) | (b4_1 << 1);
        imm = (imm << 19) >> 19;
        break;
      }
      case 0x37: case 0x17: // U-type
        imm = (instr & 0xFFFFF000) | 0;
        break;
      case 0x6F: { // J-type
        const j20    = (instr >>> 31) & 1;
        const j19_12 = (instr >>> 12) & 0xFF;
        const j11    = (instr >>> 20) & 1;
        const j10_1  = (instr >>> 21) & 0x3FF;
        imm = (j20 << 20) | (j19_12 << 12) | (j11 << 11) | (j10_1 << 1);
        imm = (imm << 11) >> 11;
        break;
      }
      default: imm = 0;
    }
    return { immediate: imm >>> 0 };
  },
  meta: { category: 'rv32i', icon: 'IMM', description: 'RISC-V immediate generator' },
});

export const RV32I_Control = circuit('RV32I_Control', {
  in: { opcode: bus(7), funct3: bus(3), funct7_bit: bit },
  out: { alu_op: bus(4), alu_src: bit, mem_read: bit, mem_write: bit, reg_write: bit, mem_to_reg: bit, branch: bit, jump: bit, lui: bit, auipc: bit, is_jalr: bit },
  eval: ({ opcode, funct3, funct7_bit }) => {
    const op  = (opcode as number) & 0x7F;
    const f3  = (funct3 as number) & 0x7;
    const f7  = funct7_bit ? 1 : 0;
    let alu_op = 0, alu_src = 0, mem_read = 0, mem_write = 0;
    let reg_write = 0, mem_to_reg = 0, branch = 0, jump = 0;
    let lui = 0, auipc = 0, is_jalr = 0;
    switch (op) {
      case 0x33: // R-type
        reg_write = 1;
        switch (f3) {
          case 0: alu_op = f7 ? 1 : 0; break;
          case 1: alu_op = 5; break;
          case 2: alu_op = 8; break;
          case 3: alu_op = 9; break;
          case 4: alu_op = 4; break;
          case 5: alu_op = f7 ? 7 : 6; break;
          case 6: alu_op = 3; break;
          case 7: alu_op = 2; break;
        }
        break;
      case 0x13: // I-type ALU
        reg_write = 1; alu_src = 1;
        switch (f3) {
          case 0: alu_op = 0; break;
          case 1: alu_op = 5; break;
          case 2: alu_op = 8; break;
          case 3: alu_op = 9; break;
          case 4: alu_op = 4; break;
          case 5: alu_op = f7 ? 7 : 6; break;
          case 6: alu_op = 3; break;
          case 7: alu_op = 2; break;
        }
        break;
      case 0x03: reg_write = 1; alu_src = 1; mem_read = 1; mem_to_reg = 1; alu_op = 0; break; // Load
      case 0x23: alu_src = 1; mem_write = 1; alu_op = 0; break;                                // Store
      case 0x63: branch = 1; alu_op = 1; break;                                                // Branch
      case 0x6F: reg_write = 1; jump = 1; break;                                               // JAL
      case 0x67: reg_write = 1; jump = 1; alu_src = 1; is_jalr = 1; alu_op = 0; break;        // JALR
      case 0x37: reg_write = 1; lui = 1; break;                                                // LUI
      case 0x17: reg_write = 1; auipc = 1; break;                                              // AUIPC
    }
    return { alu_op, alu_src, mem_read, mem_write, reg_write, mem_to_reg, branch, jump, lui, auipc, is_jalr };
  },
  meta: { category: 'rv32i', icon: 'CTL', description: 'RISC-V control unit' },
});

export const RV32I_BranchComp = circuit('RV32I_BranchComp', {
  in: { a: bus(32), b: bus(32), funct3: bus(3) },
  out: { take_branch: bit },
  eval: ({ a, b, funct3 }) => {
    const au = (a as number) >>> 0;
    const bu = (b as number) >>> 0;
    const sa = au | 0;
    const sb = bu | 0;
    const f3 = (funct3 as number) & 0x7;
    let take = 0;
    switch (f3) {
      case 0: take = au === bu ? 1 : 0; break;  // BEQ
      case 1: take = au !== bu ? 1 : 0; break;  // BNE
      case 4: take = sa < sb  ? 1 : 0; break;   // BLT
      case 5: take = sa >= sb ? 1 : 0; break;   // BGE
      case 6: take = au < bu  ? 1 : 0; break;   // BLTU
      case 7: take = au >= bu ? 1 : 0; break;   // BGEU
    }
    return { take_branch: take };
  },
  meta: { category: 'rv32i', icon: 'CMP', description: 'RISC-V branch comparator' },
});

export const RV32I_RegisterFile = circuit('RV32I_RegisterFile', {
  in: { rs1: bus(5), rs2: bus(5), rd: bus(5), write_data: bus(32), we: bit },
  out: { read1: bus(32), read2: bus(32) },
  state: { memory: new Map<number, number>() },
  eval: ({ rs1, rs2, memory }) => {
    const regs = (memory as Map<number, number>) ?? new Map();
    const r1 = (rs1 as number) & 0x1F;
    const r2 = (rs2 as number) & 0x1F;
    return {
      read1: r1 === 0 ? 0 : (regs.get(r1) ?? 0) >>> 0,
      read2: r2 === 0 ? 0 : (regs.get(r2) ?? 0) >>> 0,
    };
  },
  onTick: ({ rd, write_data, we, memory }) => {
    const regs = (memory as Map<number, number>) ?? new Map();
    const r = (rd as number) & 0x1F;
    if (we && r !== 0) {
      const newRegs = new Map(regs);
      newRegs.set(r, (write_data as number) >>> 0);
      return { memory: newRegs };
    }
    return { memory: regs };
  },
  meta: { category: 'rv32i', icon: 'RF', description: 'RISC-V 32-register file' },
});

export const RV32I_InstrMem = circuit('RV32I_InstrMem', {
  in: { addr: bus(32) },
  out: { instruction: bus(32) },
  state: { memory: new Map<number, number>() },
  eval: ({ addr, memory }) => {
    const mem = (memory as Map<number, number>) ?? new Map();
    const a = (addr as number) >>> 0;
    const b0 = mem.get(a)       ?? 0;
    const b1 = mem.get(a + 1)   ?? 0;
    const b2 = mem.get(a + 2)   ?? 0;
    const b3 = mem.get(a + 3)   ?? 0;
    return { instruction: ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0 };
  },
  onTick: ({ memory }) => ({ memory }),  // read-only
  meta: { category: 'rv32i', icon: 'IM', description: 'RISC-V instruction memory' },
});

export const RV32I_DataMem = circuit('RV32I_DataMem', {
  in: { addr: bus(32), write_data: bus(32), mem_read: bit, mem_write: bit, funct3: bus(3) },
  out: { read_data: bus(32), misalign: bit },
  state: { memory: new Map<number, number>() },
  eval: ({ addr, mem_read, mem_write, funct3, memory }) => {
    const mem = (memory as Map<number, number>) ?? new Map();
    if (!mem_read && !mem_write) return { read_data: 0, misalign: 0 };
    const a  = (addr as number) >>> 0;
    const f3 = (funct3 as number) & 0x7;
    let misalign = 0;
    if ((f3 === 1 || f3 === 5) && (a & 1) !== 0) misalign = 1;
    else if (f3 === 2 && (a & 3) !== 0) misalign = 1;
    if (!mem_read) return { read_data: 0, misalign };
    let data: number;
    switch (f3) {
      case 0: { const b = mem.get(a) ?? 0; data = ((b << 24) >> 24) >>> 0; break; }              // LB
      case 1: { const lo = mem.get(a) ?? 0; const hi = mem.get(a+1) ?? 0; const hw = (hi<<8)|lo; data = ((hw<<16)>>16)>>>0; break; } // LH
      case 2: { const b0=mem.get(a)??0,b1=mem.get(a+1)??0,b2=mem.get(a+2)??0,b3=mem.get(a+3)??0; data=((b3<<24)|(b2<<16)|(b1<<8)|b0)>>>0; break; } // LW
      case 4: data = mem.get(a) ?? 0; break;                                                      // LBU
      case 5: { const lo=mem.get(a)??0,hi=mem.get(a+1)??0; data=((hi<<8)|lo)>>>0; break; }       // LHU
      default: data = 0;
    }
    return { read_data: data, misalign };
  },
  onTick: ({ addr, write_data, mem_write, funct3, memory }) => {
    const mem = (memory as Map<number, number>) ?? new Map();
    if (!mem_write) return { memory: mem };
    const a  = (addr as number) >>> 0;
    const wd = (write_data as number) >>> 0;
    const f3 = (funct3 as number) & 0x7;
    const newMem = new Map(mem);
    switch (f3) {
      case 0: newMem.set(a, wd & 0xFF); break;                                                                                       // SB
      case 1: newMem.set(a, wd & 0xFF); newMem.set(a+1, (wd>>>8) & 0xFF); break;                                                    // SH
      case 2: newMem.set(a, wd&0xFF); newMem.set(a+1,(wd>>>8)&0xFF); newMem.set(a+2,(wd>>>16)&0xFF); newMem.set(a+3,(wd>>>24)&0xFF); break; // SW
    }
    return { memory: newMem };
  },
  meta: { category: 'rv32i', icon: 'DM', description: 'RISC-V data memory with byte/half/word access' },
});

export const RV32I_WritebackMux = circuit('RV32I_WritebackMux', {
  in: { alu_result: bus(32), load_data: bus(32), pc_plus4: bus(32), immediate: bus(32), pc_plus_imm: bus(32), mem_to_reg: bit, lui: bit, auipc: bit, jump: bit },
  out: { write_data: bus(32) },
  eval: ({ alu_result, load_data, pc_plus4, immediate, pc_plus_imm, mem_to_reg, lui, auipc, jump }) => {
    let write_data: number;
    if (jump)      write_data = pc_plus4 as number;
    else if (auipc) write_data = pc_plus_imm as number;
    else if (lui)   write_data = immediate as number;
    else if (mem_to_reg) write_data = load_data as number;
    else            write_data = alu_result as number;
    return { write_data: (write_data ?? 0) >>> 0 };
  },
  meta: { category: 'rv32i', icon: 'WB', description: 'RISC-V writeback mux' },
});

export const RV32I_NextPCMux = circuit('RV32I_NextPCMux', {
  in: { pc_plus4: bus(32), branch_target: bus(32), jal_target: bus(32), jalr_target: bus(32), branch: bit, take_branch: bit, jump: bit, is_jalr: bit },
  out: { next_pc: bus(32) },
  eval: ({ pc_plus4, branch_target, jal_target, jalr_target, branch, take_branch, jump, is_jalr }) => {
    let next_pc: number;
    if (jump)                  next_pc = is_jalr ? ((jalr_target as number) & ~1) : (jal_target as number);
    else if (branch && take_branch) next_pc = branch_target as number;
    else                       next_pc = pc_plus4 as number;
    return { next_pc: (next_pc ?? 0) >>> 0 };
  },
  meta: { category: 'rv32i', icon: 'PC', description: 'RISC-V next PC mux' },
});

export const RV32I_ForwardingUnit = circuit('RV32I_ForwardingUnit', {
  in: { id_rs1: bus(5), id_rs2: bus(5), ex_rd: bus(5), ex_reg_write: bit, mem_rd: bus(5), mem_reg_write: bit },
  out: { forward_a: bus(2), forward_b: bus(2) },
  eval: ({ id_rs1, id_rs2, ex_rd, ex_reg_write, mem_rd, mem_reg_write }) => {
    const rs1   = (id_rs1 as number) & 0x1F;
    const rs2   = (id_rs2 as number) & 0x1F;
    const exRd  = (ex_rd  as number) & 0x1F;
    const memRd = (mem_rd as number) & 0x1F;
    let forward_a = 0, forward_b = 0;
    if (ex_reg_write  && exRd  !== 0 && exRd  === rs1) forward_a = 1;
    else if (mem_reg_write && memRd !== 0 && memRd === rs1) forward_a = 2;
    if (ex_reg_write  && exRd  !== 0 && exRd  === rs2) forward_b = 1;
    else if (mem_reg_write && memRd !== 0 && memRd === rs2) forward_b = 2;
    return { forward_a, forward_b };
  },
  meta: { category: 'rv32i', icon: 'FWD', description: 'RISC-V data forwarding unit' },
});

export const RV32I_WBBypass = circuit('RV32I_WBBypass', {
  in: { rs_val: bus(32), rs_addr: bus(5), wb_val: bus(32), wb_rd: bus(5), wb_we: bit },
  out: { out: bus(32) },
  eval: ({ rs_val, rs_addr, wb_val, wb_rd, wb_we }) => {
    const rsAddr = (rs_addr as number) & 0x1F;
    const wbRd   = (wb_rd   as number) & 0x1F;
    const bypass = wb_we && wbRd !== 0 && wbRd === rsAddr;
    return { out: (bypass ? (wb_val as number) : (rs_val as number)) >>> 0 };
  },
  meta: { category: 'rv32i', icon: 'BYP', description: 'RISC-V writeback bypass' },
});

export const RV32I_LoadAlign = circuit('RV32I_LoadAlign', {
  in: { data: bus(32), funct3: bus(3) },
  out: { out: bus(32) },
  eval: ({ data, funct3 }) => {
    const raw = (data as number) >>> 0;
    const f3  = (funct3 as number) & 0x7;
    let out: number;
    switch (f3) {
      case 0: { const b = raw & 0xFF; out = ((b << 24) >> 24) >>> 0; break; }    // LB
      case 1: { const hw = raw & 0xFFFF; out = ((hw << 16) >> 16) >>> 0; break; } // LH
      case 4: out = raw & 0xFF; break;                                             // LBU
      case 5: out = raw & 0xFFFF; break;                                           // LHU
      default: out = raw;                                                           // LW
    }
    return { out };
  },
  meta: { category: 'rv32i', icon: 'LA', description: 'RISC-V load alignment (byte/half/word)' },
});

export const RV32I_HazardUnit = circuit('RV32I_HazardUnit', {
  in: { if_rs1: bus(5), if_rs2: bus(5), id_rd: bus(5), id_mem_read: bit, branch_taken: bit, jump: bit },
  out: { stall: bit, flush: bit },
  eval: ({ if_rs1, if_rs2, id_rd, id_mem_read, branch_taken, jump }) => {
    const rs1  = (if_rs1 as number) & 0x1F;
    const rs2  = (if_rs2 as number) & 0x1F;
    const idRd = (id_rd  as number) & 0x1F;
    const stall = id_mem_read && idRd !== 0 && (idRd === rs1 || idRd === rs2) ? 1 : 0;
    const flush = (branch_taken || jump) ? 1 : 0;
    return { stall, flush };
  },
  meta: { category: 'rv32i', icon: 'HAZ', description: 'RISC-V hazard detection unit' },
});

export const DualPortROM = circuit('DualPortROM', {
  in: { addrA: bus(32), addrB: bus(32) },
  out: { dataA: bus(32), dataB: bus(32) },
  state: { memory: new Map<number, number>() },
  eval: ({ addrA, addrB, memory }) => {
    const mem = (memory as Map<number, number>) ?? new Map();
    const readWord = (addr: number) => {
      const a = addr >>> 0;
      const b0 = mem.get(a)   ?? 0;
      const b1 = mem.get(a+1) ?? 0;
      const b2 = mem.get(a+2) ?? 0;
      const b3 = mem.get(a+3) ?? 0;
      return ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
    };
    return {
      dataA: readWord(addrA as number),
      dataB: readWord(addrB as number),
    };
  },
  onTick: ({ memory }) => ({ memory }),  // read-only
  meta: { category: 'memory', description: 'Dual-port read-only memory' },
});

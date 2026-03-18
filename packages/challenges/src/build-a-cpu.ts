import type { ChallengeLevel, ChallengeMetadata } from './types.js';

export const CPU_METADATA: ChallengeMetadata = {
  slug: 'build-a-cpu',
  title: 'Build a CPU That Runs C',
  description: 'From a program counter to a pipelined RISC-V CPU. Thirteen levels — end with Hello World.',
  levels: 13,
  difficulty: 'Advanced',
};

// ================================================================
// Helper: comment out specific connections in a DSL string
// ================================================================
function commentOut(dsl: string, connections: string[]): string {
  let result = dsl;
  for (const conn of connections) {
    result = result.replace(
      `    connect ${conn}\n`,
      `    // connect ${conn}\n`
    );
  }
  return result;
}

// ================================================================
// Composite circuits — each level's completed work becomes a block
// ================================================================

// Level 1 product: a PC that counts 0, 4, 8...
const PC_UNIT = `circuit PCUnit {
  input next_pc: Bus[32]
  input use_next_pc: Bit
  output pc_val: Bus[32]
  output pc_plus4: Bus[32]
  impl {
    node pc: Register(width=32)
    node adder: Adder(width=32)
    node four: Constant(value=4, width=32)
    node we: Constant(value=1, width=1)
    node mux: Mux(width=32)

    connect pc.q -> adder.a
    connect four.out -> adder.b
    connect we.out -> pc.we

    // Default: PC+4. When use_next_pc=1, use next_pc input
    connect adder.sum -> mux.in0
    connect next_pc -> mux.in1
    connect use_next_pc -> mux.sel
    connect mux.out -> pc.data

    connect pc.q -> pc_val
    connect adder.sum -> pc_plus4
  }
}`;

// Level 2 product: fetch + decode
const FETCH_DECODE_UNIT = `circuit FetchDecodeUnit {
  input pc_addr: Bus[32]
  output instruction: Bus[32]
  output opcode: Bus[7]
  output rd: Bus[5]
  output funct3: Bus[3]
  output funct7: Bus[7]
  output rs1: Bus[5]
  output rs2: Bus[5]
  output immediate: Bus[32]
  output alu_op: Bus[4]
  output alu_src: Bit
  output reg_write: Bit
  output mem_read: Bit
  output mem_write: Bit
  output mem_to_reg: Bit
  output branch: Bit
  output jump: Bit
  output is_jalr: Bit
  output lui: Bit
  output auipc: Bit
  impl {
    node imem: RV32I_InstrMem
    connect pc_addr -> imem.addr

    node decode: RV32I_Decode
    connect imem.instruction -> decode.instruction

    node immgen: RV32I_ImmGen
    connect imem.instruction -> immgen.instruction

    node control: RV32I_Control
    connect decode.opcode -> control.opcode
    connect decode.funct3 -> control.funct3
    node funct7_splitter: BitSlice(low=5, high=5)
    connect decode.funct7 -> funct7_splitter.in
    connect funct7_splitter.out -> control.funct7_bit

    connect imem.instruction -> instruction
    connect decode.opcode -> opcode
    connect decode.rd -> rd
    connect decode.funct3 -> funct3
    connect decode.funct7 -> funct7
    connect decode.rs1 -> rs1
    connect decode.rs2 -> rs2
    connect immgen.immediate -> immediate
    connect control.alu_op -> alu_op
    connect control.alu_src -> alu_src
    connect control.reg_write -> reg_write
    connect control.mem_read -> mem_read
    connect control.mem_write -> mem_write
    connect control.mem_to_reg -> mem_to_reg
    connect control.branch -> branch
    connect control.jump -> jump
    connect control.is_jalr -> is_jalr
    connect control.lui -> lui
    connect control.auipc -> auipc
  }
}`;

// Level 3 product: register file + ALU
const REGFILE_ALU_UNIT = `circuit RegfileALUUnit {
  input rs1_addr: Bus[5]
  input rs2_addr: Bus[5]
  input rd_addr: Bus[5]
  input write_enable: Bit
  input write_data: Bus[32]
  input immediate: Bus[32]
  input alu_src_sel: Bit
  input alu_op: Bus[4]
  output read1: Bus[32]
  output read2: Bus[32]
  output alu_result: Bus[32]
  impl {
    node regfile: RV32I_RegisterFile
    connect rs1_addr -> regfile.rs1
    connect rs2_addr -> regfile.rs2
    connect rd_addr -> regfile.rd
    connect write_enable -> regfile.we
    connect write_data -> regfile.write_data

    node alu_src_mux: Mux(width=32)
    connect regfile.read2 -> alu_src_mux.in0
    connect immediate -> alu_src_mux.in1
    connect alu_src_sel -> alu_src_mux.sel

    node alu: RV32I_ALU
    connect regfile.read1 -> alu.a
    connect alu_src_mux.out -> alu.b
    connect alu_op -> alu.alu_op

    connect regfile.read1 -> read1
    connect regfile.read2 -> read2
    connect alu.result -> alu_result
  }
}`;

// Level 1 product simplified: a PC that just counts (no branch inputs)
// Used for levels 2-3 where branches aren't introduced yet
const PC_UNIT_SIMPLE = `circuit PCUnit_Simple {
  output pc_val: Bus[32]
  output pc_plus4: Bus[32]
  impl {
    node pc: Register(width=32)
    node adder: Adder(width=32)
    node four: Constant(value=4, width=32)
    node we: Constant(value=1, width=1)

    connect pc.q -> adder.a
    connect four.out -> adder.b
    connect adder.sum -> pc.data
    connect we.out -> pc.we

    connect pc.q -> pc_val
    connect adder.sum -> pc_plus4
  }
}`;

// ================================================================
// Level 1: The Program Counter — standalone, simple
// ================================================================

const L1_SOLUTION = `circuit ProgramCounter {
  output pc_out: Bus[32]
  impl {
    node pc: Register(width=32)
    node pc_plus4: Adder(width=32)
    node pc_we: Constant(value=1, width=1)
    node four: Constant(value=4, width=32)

    connect pc.q -> pc_plus4.a
    connect four.out -> pc_plus4.b
    connect pc_plus4.sum -> pc.data
    connect pc_we.out -> pc.we
    connect pc.q -> pc_out
  }
}`;

const L1_NEW = [
  'pc.q -> pc_plus4.a',
  'four.out -> pc_plus4.b',
  'pc_plus4.sum -> pc.data',
  'pc_we.out -> pc.we',
  'pc.q -> pc_out',
];

// ================================================================
// Level 2: Instruction Fetch — PC is now a composite
// ================================================================

const L2_PREAMBLE = PC_UNIT_SIMPLE;

const L2_SOLUTION = `circuit InstrFetch {
  output pc_out: Bus[32]
  impl {
    node pc_unit: PCUnit_Simple

    node imem: RV32I_InstrMem
    node decode: RV32I_Decode
    node immgen: RV32I_ImmGen
    node control: RV32I_Control
    node funct7_splitter: BitSlice(low=5, high=5)

    connect pc_unit.pc_val -> imem.addr
    connect imem.instruction -> decode.instruction
    connect imem.instruction -> immgen.instruction
    connect decode.opcode -> control.opcode
    connect decode.funct3 -> control.funct3
    connect decode.funct7 -> funct7_splitter.in
    connect funct7_splitter.out -> control.funct7_bit
    connect pc_unit.pc_val -> pc_out
  }
}`;

const L2_NEW = [
  'pc_unit.pc_val -> imem.addr',
  'imem.instruction -> decode.instruction',
  'imem.instruction -> immgen.instruction',
  'decode.opcode -> control.opcode',
  'decode.funct3 -> control.funct3',
  'decode.funct7 -> funct7_splitter.in',
  'funct7_splitter.out -> control.funct7_bit',
];

// ================================================================
// Level 3: Registers and the ALU — PC+Fetch is now a composite
// ================================================================

const L3_PREAMBLE = `${PC_UNIT_SIMPLE}
${FETCH_DECODE_UNIT}`;

const L3_SOLUTION = `circuit RegfileALU {
  output alu_out: Bus[32]
  impl {
    node pc_unit: PCUnit_Simple
    node fetch: FetchDecodeUnit
    connect pc_unit.pc_val -> fetch.pc_addr

    node regfile: RV32I_RegisterFile
    node alu_src_mux: Mux(width=32)
    node alu: RV32I_ALU

    connect fetch.rs1 -> regfile.rs1
    connect fetch.rs2 -> regfile.rs2
    connect fetch.rd -> regfile.rd
    connect fetch.reg_write -> regfile.we
    connect regfile.read2 -> alu_src_mux.in0
    connect fetch.immediate -> alu_src_mux.in1
    connect fetch.alu_src -> alu_src_mux.sel
    connect regfile.read1 -> alu.a
    connect alu_src_mux.out -> alu.b
    connect fetch.alu_op -> alu.alu_op
    connect alu.result -> alu_out
  }
}`;

const L3_NEW = [
  'fetch.rs1 -> regfile.rs1',
  'fetch.rs2 -> regfile.rs2',
  'fetch.rd -> regfile.rd',
  'fetch.reg_write -> regfile.we',
  'regfile.read2 -> alu_src_mux.in0',
  'fetch.immediate -> alu_src_mux.in1',
  'fetch.alu_src -> alu_src_mux.sel',
  'regfile.read1 -> alu.a',
  'alu_src_mux.out -> alu.b',
  'fetch.alu_op -> alu.alu_op',
];

// ================================================================
// Level 4: Branches and Jumps — PC+Fetch+RegALU composites
// ================================================================

const L456_PREAMBLE = `${PC_UNIT}
${FETCH_DECODE_UNIT}
${REGFILE_ALU_UNIT}`;

const L4_SOLUTION = `circuit Branching {
  output pc_out: Bus[32]
  impl {
    node pc_unit: PCUnit
    node fetch: FetchDecodeUnit
    connect pc_unit.pc_val -> fetch.pc_addr

    node zero32: Constant(value=0, width=32)
    node exec: RegfileALUUnit
    connect fetch.rs1 -> exec.rs1_addr
    connect fetch.rs2 -> exec.rs2_addr
    connect fetch.rd -> exec.rd_addr
    connect fetch.reg_write -> exec.write_enable
    connect zero32.out -> exec.write_data
    connect fetch.immediate -> exec.immediate
    connect fetch.alu_src -> exec.alu_src_sel
    connect fetch.alu_op -> exec.alu_op

    node branch_comp: RV32I_BranchComp
    node branch_target: Adder(width=32)
    node jalr_target: BusAnd(width=32)
    node jalr_mask: Constant(value=4294967294, width=32)
    node next_pc: RV32I_NextPCMux

    connect exec.read1 -> branch_comp.a
    connect exec.read2 -> branch_comp.b
    connect fetch.funct3 -> branch_comp.funct3

    connect pc_unit.pc_val -> branch_target.a
    connect fetch.immediate -> branch_target.b

    connect exec.alu_result -> jalr_target.a
    connect jalr_mask.out -> jalr_target.b

    connect pc_unit.pc_plus4 -> next_pc.pc_plus4
    connect branch_target.sum -> next_pc.branch_target
    connect branch_target.sum -> next_pc.jal_target
    connect jalr_target.out -> next_pc.jalr_target
    connect fetch.branch -> next_pc.branch
    connect branch_comp.take_branch -> next_pc.take_branch
    connect fetch.jump -> next_pc.jump
    connect fetch.is_jalr -> next_pc.is_jalr

    // Feed branch/jump target back to PC
    node pc_should_branch: Or
    node branch_taken: And
    connect fetch.branch -> branch_taken.a
    connect branch_comp.take_branch -> branch_taken.b
    connect branch_taken.out -> pc_should_branch.a
    connect fetch.jump -> pc_should_branch.b
    connect next_pc.next_pc -> pc_unit.next_pc
    connect pc_should_branch.out -> pc_unit.use_next_pc

    connect pc_unit.pc_val -> pc_out
  }
}`;

const L4_NEW = [
  'exec.read1 -> branch_comp.a',
  'exec.read2 -> branch_comp.b',
  'fetch.funct3 -> branch_comp.funct3',
  'pc_unit.pc_val -> branch_target.a',
  'fetch.immediate -> branch_target.b',
  'exec.alu_result -> jalr_target.a',
  'jalr_mask.out -> jalr_target.b',
  'branch_target.sum -> next_pc.branch_target',
  'branch_target.sum -> next_pc.jal_target',
  'jalr_target.out -> next_pc.jalr_target',
];

// ================================================================
// Level 5: Load and Store — just the DataMem wiring
// ================================================================

const L5_SOLUTION = `circuit LoadStore {
  output pc_out: Bus[32]
  impl {
    node pc_unit: PCUnit
    node fetch: FetchDecodeUnit
    connect pc_unit.pc_val -> fetch.pc_addr

    node zero32: Constant(value=0, width=32)
    node exec: RegfileALUUnit
    connect fetch.rs1 -> exec.rs1_addr
    connect fetch.rs2 -> exec.rs2_addr
    connect fetch.rd -> exec.rd_addr
    connect fetch.reg_write -> exec.write_enable
    connect zero32.out -> exec.write_data
    connect fetch.immediate -> exec.immediate
    connect fetch.alu_src -> exec.alu_src_sel
    connect fetch.alu_op -> exec.alu_op

    // Branch logic (pre-wired)
    node branch_comp: RV32I_BranchComp
    connect exec.read1 -> branch_comp.a
    connect exec.read2 -> branch_comp.b
    connect fetch.funct3 -> branch_comp.funct3
    node branch_target: Adder(width=32)
    connect pc_unit.pc_val -> branch_target.a
    connect fetch.immediate -> branch_target.b
    node jalr_target: BusAnd(width=32)
    connect exec.alu_result -> jalr_target.a
    node jalr_mask: Constant(value=4294967294, width=32)
    connect jalr_mask.out -> jalr_target.b
    node next_pc: RV32I_NextPCMux
    connect pc_unit.pc_plus4 -> next_pc.pc_plus4
    connect branch_target.sum -> next_pc.branch_target
    connect branch_target.sum -> next_pc.jal_target
    connect jalr_target.out -> next_pc.jalr_target
    connect fetch.branch -> next_pc.branch
    connect branch_comp.take_branch -> next_pc.take_branch
    connect fetch.jump -> next_pc.jump
    connect fetch.is_jalr -> next_pc.is_jalr
    node pc_should_branch: Or
    node branch_taken: And
    connect fetch.branch -> branch_taken.a
    connect branch_comp.take_branch -> branch_taken.b
    connect branch_taken.out -> pc_should_branch.a
    connect fetch.jump -> pc_should_branch.b
    connect next_pc.next_pc -> pc_unit.next_pc
    connect pc_should_branch.out -> pc_unit.use_next_pc

    // Data Memory — user wires these
    node dmem: RV32I_DataMem
    connect exec.alu_result -> dmem.addr
    connect exec.read2 -> dmem.write_data
    connect fetch.mem_read -> dmem.mem_read
    connect fetch.mem_write -> dmem.mem_write
    connect fetch.funct3 -> dmem.funct3

    connect pc_unit.pc_val -> pc_out
  }
}`;

const L5_NEW = [
  'exec.alu_result -> dmem.addr',
  'exec.read2 -> dmem.write_data',
  'fetch.mem_read -> dmem.mem_read',
  'fetch.mem_write -> dmem.mem_write',
  'fetch.funct3 -> dmem.funct3',
];

// ================================================================
// Level 6: Writeback Mux
// ================================================================

const L6_SOLUTION = `circuit Writeback {
  output pc_out: Bus[32]
  impl {
    node pc_unit: PCUnit
    node fetch: FetchDecodeUnit
    connect pc_unit.pc_val -> fetch.pc_addr

    node zero32: Constant(value=0, width=32)
    node exec: RegfileALUUnit
    connect fetch.rs1 -> exec.rs1_addr
    connect fetch.rs2 -> exec.rs2_addr
    connect fetch.rd -> exec.rd_addr
    connect fetch.reg_write -> exec.write_enable
    connect fetch.immediate -> exec.immediate
    connect fetch.alu_src -> exec.alu_src_sel
    connect fetch.alu_op -> exec.alu_op

    // Branch logic (pre-wired)
    node branch_comp: RV32I_BranchComp
    connect exec.read1 -> branch_comp.a
    connect exec.read2 -> branch_comp.b
    connect fetch.funct3 -> branch_comp.funct3
    node branch_target: Adder(width=32)
    connect pc_unit.pc_val -> branch_target.a
    connect fetch.immediate -> branch_target.b
    node jalr_target: BusAnd(width=32)
    connect exec.alu_result -> jalr_target.a
    node jalr_mask: Constant(value=4294967294, width=32)
    connect jalr_mask.out -> jalr_target.b
    node next_pc: RV32I_NextPCMux
    connect pc_unit.pc_plus4 -> next_pc.pc_plus4
    connect branch_target.sum -> next_pc.branch_target
    connect branch_target.sum -> next_pc.jal_target
    connect jalr_target.out -> next_pc.jalr_target
    connect fetch.branch -> next_pc.branch
    connect branch_comp.take_branch -> next_pc.take_branch
    connect fetch.jump -> next_pc.jump
    connect fetch.is_jalr -> next_pc.is_jalr
    node pc_should_branch: Or
    node branch_taken: And
    connect fetch.branch -> branch_taken.a
    connect branch_comp.take_branch -> branch_taken.b
    connect branch_taken.out -> pc_should_branch.a
    connect fetch.jump -> pc_should_branch.b
    connect next_pc.next_pc -> pc_unit.next_pc
    connect pc_should_branch.out -> pc_unit.use_next_pc

    // Data Memory (pre-wired)
    node dmem: RV32I_DataMem
    connect exec.alu_result -> dmem.addr
    connect exec.read2 -> dmem.write_data
    connect fetch.mem_read -> dmem.mem_read
    connect fetch.mem_write -> dmem.mem_write
    connect fetch.funct3 -> dmem.funct3

    // Writeback Mux — user wires these
    node pc_plus_imm: Adder(width=32)
    connect pc_unit.pc_val -> pc_plus_imm.a
    connect fetch.immediate -> pc_plus_imm.b

    node wb_mux: RV32I_WritebackMux
    connect exec.alu_result -> wb_mux.alu_result
    connect dmem.read_data -> wb_mux.load_data
    connect pc_unit.pc_plus4 -> wb_mux.pc_plus4
    connect fetch.immediate -> wb_mux.immediate
    connect pc_plus_imm.sum -> wb_mux.pc_plus_imm
    connect fetch.mem_to_reg -> wb_mux.mem_to_reg
    connect fetch.lui -> wb_mux.lui
    connect fetch.auipc -> wb_mux.auipc
    connect fetch.jump -> wb_mux.jump
    connect wb_mux.write_data -> exec.write_data

    connect pc_unit.pc_val -> pc_out
  }
}`;

const L6_NEW = [
  'pc_unit.pc_val -> pc_plus_imm.a',
  'fetch.immediate -> pc_plus_imm.b',
  'exec.alu_result -> wb_mux.alu_result',
  'dmem.read_data -> wb_mux.load_data',
  'pc_unit.pc_plus4 -> wb_mux.pc_plus4',
  'fetch.immediate -> wb_mux.immediate',
  'pc_plus_imm.sum -> wb_mux.pc_plus_imm',
  'fetch.mem_to_reg -> wb_mux.mem_to_reg',
  'fetch.lui -> wb_mux.lui',
  'fetch.auipc -> wb_mux.auipc',
  'fetch.jump -> wb_mux.jump',
  'wb_mux.write_data -> exec.write_data',
];

// ================================================================
// Level 7: Your First Program — just connect outputs
// The complete single-cycle CPU uses the real primitives (no composites)
// so the user sees the "unwrapped" CPU they built
// ================================================================

const L7_SOLUTION = `circuit RV32I_CPU {
  output pc_out: Bus[32]
  output alu_result: Bus[32]
  impl {
    node pc: Register(width=32)
    node pc_plus4: Adder(width=32)
    node pc_we: Constant(value=1, width=1)
    node four: Constant(value=4, width=32)

    connect pc.q -> pc_plus4.a
    connect four.out -> pc_plus4.b
    connect pc_we.out -> pc.we

    node imem: RV32I_InstrMem
    node decode: RV32I_Decode
    node immgen: RV32I_ImmGen
    node control: RV32I_Control
    node funct7_splitter: BitSlice(low=5, high=5)

    connect pc.q -> imem.addr
    connect imem.instruction -> decode.instruction
    connect imem.instruction -> immgen.instruction
    connect decode.opcode -> control.opcode
    connect decode.funct3 -> control.funct3
    connect decode.funct7 -> funct7_splitter.in
    connect funct7_splitter.out -> control.funct7_bit

    node regfile: RV32I_RegisterFile
    node alu_src_mux: Mux(width=32)
    node alu: RV32I_ALU

    connect decode.rs1 -> regfile.rs1
    connect decode.rs2 -> regfile.rs2
    connect decode.rd -> regfile.rd
    connect control.reg_write -> regfile.we
    connect regfile.read2 -> alu_src_mux.in0
    connect immgen.immediate -> alu_src_mux.in1
    connect control.alu_src -> alu_src_mux.sel
    connect regfile.read1 -> alu.a
    connect alu_src_mux.out -> alu.b
    connect control.alu_op -> alu.alu_op

    node branch_comp: RV32I_BranchComp
    connect regfile.read1 -> branch_comp.a
    connect regfile.read2 -> branch_comp.b
    connect decode.funct3 -> branch_comp.funct3

    node branch_target: Adder(width=32)
    connect pc.q -> branch_target.a
    connect immgen.immediate -> branch_target.b

    node jalr_target: BusAnd(width=32)
    connect alu.result -> jalr_target.a
    node jalr_mask: Constant(value=4294967294, width=32)
    connect jalr_mask.out -> jalr_target.b

    node next_pc: RV32I_NextPCMux
    connect pc_plus4.sum -> next_pc.pc_plus4
    connect branch_target.sum -> next_pc.branch_target
    connect branch_target.sum -> next_pc.jal_target
    connect jalr_target.out -> next_pc.jalr_target
    connect control.branch -> next_pc.branch
    connect branch_comp.take_branch -> next_pc.take_branch
    connect control.jump -> next_pc.jump
    connect control.is_jalr -> next_pc.is_jalr
    connect next_pc.next_pc -> pc.data

    node dmem: RV32I_DataMem
    connect alu.result -> dmem.addr
    connect regfile.read2 -> dmem.write_data
    connect control.mem_read -> dmem.mem_read
    connect control.mem_write -> dmem.mem_write
    connect decode.funct3 -> dmem.funct3

    node pc_plus_imm: Adder(width=32)
    connect pc.q -> pc_plus_imm.a
    connect immgen.immediate -> pc_plus_imm.b

    node wb_mux: RV32I_WritebackMux
    connect alu.result -> wb_mux.alu_result
    connect dmem.read_data -> wb_mux.load_data
    connect pc_plus4.sum -> wb_mux.pc_plus4
    connect immgen.immediate -> wb_mux.immediate
    connect pc_plus_imm.sum -> wb_mux.pc_plus_imm
    connect control.mem_to_reg -> wb_mux.mem_to_reg
    connect control.lui -> wb_mux.lui
    connect control.auipc -> wb_mux.auipc
    connect control.jump -> wb_mux.jump
    connect wb_mux.write_data -> regfile.write_data

    connect pc.q -> pc_out
    connect alu.result -> alu_result
  }
}`;

const L7_NEW = [
  'pc.q -> pc_out',
  'alu.result -> alu_result',
];

// ================================================================
// Pipeline CPU: Shared Sections
// ================================================================

const PL_BEFORE_MEM = `    // Constants
    node four: Constant(value=4, width=32)
    node zero32: Constant(value=0, width=32)
    node zero5: Constant(value=0, width=5)
    node zero4: Constant(value=0, width=4)
    node zero3: Constant(value=0, width=3)
    node zero1: Constant(value=0, width=1)
    node one1: Constant(value=1, width=1)

    // Hazard Detection
    node hazard: RV32I_HazardUnit
    node stall_inv: Not
    connect hazard.stall -> stall_inv.in

    // ==== STAGE 1: INSTRUCTION FETCH ====
    node pc: Register(width=32)
    node pc_plus4: Adder(width=32)
    node imem: RV32I_InstrMem

    connect pc.q -> pc_plus4.a
    connect four.out -> pc_plus4.b
    connect pc.q -> imem.addr
    connect stall_inv.out -> pc.we

    // IF/ID Pipeline Register
    node ifid_instr_mux: Mux(width=32)
    connect imem.instruction -> ifid_instr_mux.in0
    connect zero32.out -> ifid_instr_mux.in1
    connect hazard.flush -> ifid_instr_mux.sel

    node ifid_instr: Register(width=32)
    connect ifid_instr_mux.out -> ifid_instr.data
    connect stall_inv.out -> ifid_instr.we

    node ifid_pc_mux: Mux(width=32)
    connect pc.q -> ifid_pc_mux.in0
    connect zero32.out -> ifid_pc_mux.in1
    connect hazard.flush -> ifid_pc_mux.sel

    node ifid_pc: Register(width=32)
    connect ifid_pc_mux.out -> ifid_pc.data
    connect stall_inv.out -> ifid_pc.we

    node ifid_pc4_mux: Mux(width=32)
    connect pc_plus4.sum -> ifid_pc4_mux.in0
    connect zero32.out -> ifid_pc4_mux.in1
    connect hazard.flush -> ifid_pc4_mux.sel

    node ifid_pc4: Register(width=32)
    connect ifid_pc4_mux.out -> ifid_pc4.data
    connect stall_inv.out -> ifid_pc4.we

    // ==== STAGE 2: INSTRUCTION DECODE ====
    node decode: RV32I_Decode
    connect ifid_instr.q -> decode.instruction

    node immgen: RV32I_ImmGen
    connect ifid_instr.q -> immgen.instruction

    node control: RV32I_Control
    connect decode.opcode -> control.opcode
    connect decode.funct3 -> control.funct3
    node funct7_splitter: BitSlice(low=5, high=5)
    connect decode.funct7 -> funct7_splitter.in
    connect funct7_splitter.out -> control.funct7_bit

    node regfile: RV32I_RegisterFile
    connect decode.rs1 -> regfile.rs1
    connect decode.rs2 -> regfile.rs2

    // Hazard unit inputs
    node ifid_decode_for_hazard: RV32I_Decode
    connect ifid_instr.q -> ifid_decode_for_hazard.instruction
    connect ifid_decode_for_hazard.rs1 -> hazard.if_rs1
    connect ifid_decode_for_hazard.rs2 -> hazard.if_rs2

    // ID/EX Pipeline Register
    node idex_flush: Or
    connect hazard.flush -> idex_flush.a
    connect hazard.stall -> idex_flush.b

    node idex_pc: Register(width=32)
    connect ifid_pc.q -> idex_pc.data
    connect one1.out -> idex_pc.we

    node idex_pc4: Register(width=32)
    connect ifid_pc4.q -> idex_pc4.data
    connect one1.out -> idex_pc4.we

    // WB-to-ID bypass
    node wb_bypass1: RV32I_WBBypass
    connect regfile.read1 -> wb_bypass1.rs_val
    connect decode.rs1 -> wb_bypass1.rs_addr
    connect wb_mux.write_data -> wb_bypass1.wb_val
    connect memwb_rd.q -> wb_bypass1.wb_rd
    connect memwb_reg_write.q -> wb_bypass1.wb_we

    node wb_bypass2: RV32I_WBBypass
    connect regfile.read2 -> wb_bypass2.rs_val
    connect decode.rs2 -> wb_bypass2.rs_addr
    connect wb_mux.write_data -> wb_bypass2.wb_val
    connect memwb_rd.q -> wb_bypass2.wb_rd
    connect memwb_reg_write.q -> wb_bypass2.wb_we

    node idex_read1: Register(width=32)
    connect wb_bypass1.out -> idex_read1.data
    connect one1.out -> idex_read1.we

    node idex_read2: Register(width=32)
    connect wb_bypass2.out -> idex_read2.data
    connect one1.out -> idex_read2.we

    node idex_imm: Register(width=32)
    connect immgen.immediate -> idex_imm.data
    connect one1.out -> idex_imm.we

    node idex_rs1_mux: Mux(width=5)
    connect decode.rs1 -> idex_rs1_mux.in0
    connect zero5.out -> idex_rs1_mux.in1
    connect idex_flush.out -> idex_rs1_mux.sel

    node idex_rs1: Register(width=5)
    connect idex_rs1_mux.out -> idex_rs1.data
    connect one1.out -> idex_rs1.we

    node idex_rs2_mux: Mux(width=5)
    connect decode.rs2 -> idex_rs2_mux.in0
    connect zero5.out -> idex_rs2_mux.in1
    connect idex_flush.out -> idex_rs2_mux.sel

    node idex_rs2: Register(width=5)
    connect idex_rs2_mux.out -> idex_rs2.data
    connect one1.out -> idex_rs2.we

    node idex_rd_mux: Mux(width=5)
    connect decode.rd -> idex_rd_mux.in0
    connect zero5.out -> idex_rd_mux.in1
    connect idex_flush.out -> idex_rd_mux.sel

    node idex_rd: Register(width=5)
    connect idex_rd_mux.out -> idex_rd.data
    connect one1.out -> idex_rd.we

    node idex_funct3_mux: Mux(width=3)
    connect decode.funct3 -> idex_funct3_mux.in0
    connect zero3.out -> idex_funct3_mux.in1
    connect idex_flush.out -> idex_funct3_mux.sel

    node idex_funct3: Register(width=3)
    connect idex_funct3_mux.out -> idex_funct3.data
    connect one1.out -> idex_funct3.we

    node idex_alu_op_mux: Mux(width=4)
    connect control.alu_op -> idex_alu_op_mux.in0
    connect zero4.out -> idex_alu_op_mux.in1
    connect idex_flush.out -> idex_alu_op_mux.sel

    node idex_alu_op: Register(width=4)
    connect idex_alu_op_mux.out -> idex_alu_op.data
    connect one1.out -> idex_alu_op.we

    node idex_alu_src_mux: Mux(width=1)
    connect control.alu_src -> idex_alu_src_mux.in0
    connect zero1.out -> idex_alu_src_mux.in1
    connect idex_flush.out -> idex_alu_src_mux.sel

    node idex_alu_src: Register(width=1)
    connect idex_alu_src_mux.out -> idex_alu_src.data
    connect one1.out -> idex_alu_src.we

    node idex_mem_read_mux: Mux(width=1)
    connect control.mem_read -> idex_mem_read_mux.in0
    connect zero1.out -> idex_mem_read_mux.in1
    connect idex_flush.out -> idex_mem_read_mux.sel

    node idex_mem_read: Register(width=1)
    connect idex_mem_read_mux.out -> idex_mem_read.data
    connect one1.out -> idex_mem_read.we

    node idex_mem_write_mux: Mux(width=1)
    connect control.mem_write -> idex_mem_write_mux.in0
    connect zero1.out -> idex_mem_write_mux.in1
    connect idex_flush.out -> idex_mem_write_mux.sel

    node idex_mem_write: Register(width=1)
    connect idex_mem_write_mux.out -> idex_mem_write.data
    connect one1.out -> idex_mem_write.we

    node idex_reg_write_mux: Mux(width=1)
    connect control.reg_write -> idex_reg_write_mux.in0
    connect zero1.out -> idex_reg_write_mux.in1
    connect idex_flush.out -> idex_reg_write_mux.sel

    node idex_reg_write: Register(width=1)
    connect idex_reg_write_mux.out -> idex_reg_write.data
    connect one1.out -> idex_reg_write.we

    node idex_mem_to_reg_mux: Mux(width=1)
    connect control.mem_to_reg -> idex_mem_to_reg_mux.in0
    connect zero1.out -> idex_mem_to_reg_mux.in1
    connect idex_flush.out -> idex_mem_to_reg_mux.sel

    node idex_mem_to_reg: Register(width=1)
    connect idex_mem_to_reg_mux.out -> idex_mem_to_reg.data
    connect one1.out -> idex_mem_to_reg.we

    node idex_branch_mux: Mux(width=1)
    connect control.branch -> idex_branch_mux.in0
    connect zero1.out -> idex_branch_mux.in1
    connect idex_flush.out -> idex_branch_mux.sel

    node idex_branch: Register(width=1)
    connect idex_branch_mux.out -> idex_branch.data
    connect one1.out -> idex_branch.we

    node idex_jump_mux: Mux(width=1)
    connect control.jump -> idex_jump_mux.in0
    connect zero1.out -> idex_jump_mux.in1
    connect idex_flush.out -> idex_jump_mux.sel

    node idex_jump: Register(width=1)
    connect idex_jump_mux.out -> idex_jump.data
    connect one1.out -> idex_jump.we

    node idex_lui_mux: Mux(width=1)
    connect control.lui -> idex_lui_mux.in0
    connect zero1.out -> idex_lui_mux.in1
    connect idex_flush.out -> idex_lui_mux.sel

    node idex_lui: Register(width=1)
    connect idex_lui_mux.out -> idex_lui.data
    connect one1.out -> idex_lui.we

    node idex_auipc_mux: Mux(width=1)
    connect control.auipc -> idex_auipc_mux.in0
    connect zero1.out -> idex_auipc_mux.in1
    connect idex_flush.out -> idex_auipc_mux.sel

    node idex_auipc: Register(width=1)
    connect idex_auipc_mux.out -> idex_auipc.data
    connect one1.out -> idex_auipc.we

    node idex_is_jalr_mux: Mux(width=1)
    connect control.is_jalr -> idex_is_jalr_mux.in0
    connect zero1.out -> idex_is_jalr_mux.in1
    connect idex_flush.out -> idex_is_jalr_mux.sel

    node idex_is_jalr: Register(width=1)
    connect idex_is_jalr_mux.out -> idex_is_jalr.data
    connect one1.out -> idex_is_jalr.we

    // ==== STAGE 3: EXECUTE ====

    // Forwarding Unit
    node forward: RV32I_ForwardingUnit
    connect idex_rs1.q -> forward.id_rs1
    connect idex_rs2.q -> forward.id_rs2

    // Forwarding Mux A
    node fwd_a_bit0: BitSlice(low=0, high=0)
    connect forward.forward_a -> fwd_a_bit0.in
    node fwd_a_bit1: BitSlice(low=1, high=1)
    connect forward.forward_a -> fwd_a_bit1.in

    node fwd_a_mux1: Mux(width=32)
    connect idex_read1.q -> fwd_a_mux1.in0
    connect exmem_result.q -> fwd_a_mux1.in1
    connect fwd_a_bit0.out -> fwd_a_mux1.sel

    node fwd_a_mux2: Mux(width=32)
    connect fwd_a_mux1.out -> fwd_a_mux2.in0
    connect fwd_a_bit1.out -> fwd_a_mux2.sel

    // Forwarding Mux B
    node fwd_b_bit0: BitSlice(low=0, high=0)
    connect forward.forward_b -> fwd_b_bit0.in
    node fwd_b_bit1: BitSlice(low=1, high=1)
    connect forward.forward_b -> fwd_b_bit1.in

    node fwd_b_mux1: Mux(width=32)
    connect idex_read2.q -> fwd_b_mux1.in0
    connect exmem_result.q -> fwd_b_mux1.in1
    connect fwd_b_bit0.out -> fwd_b_mux1.sel

    node fwd_b_mux2: Mux(width=32)
    connect fwd_b_mux1.out -> fwd_b_mux2.in0
    connect fwd_b_bit1.out -> fwd_b_mux2.sel

    // ALU source mux
    node alu_src_mux: Mux(width=32)
    connect fwd_b_mux2.out -> alu_src_mux.in0
    connect idex_imm.q -> alu_src_mux.in1
    connect idex_alu_src.q -> alu_src_mux.sel

    // ALU
    node alu: RV32I_ALU
    connect fwd_a_mux2.out -> alu.a
    connect alu_src_mux.out -> alu.b
    connect idex_alu_op.q -> alu.alu_op

    // Branch Comparator
    node branch_comp: RV32I_BranchComp
    connect fwd_a_mux2.out -> branch_comp.a
    connect fwd_b_mux2.out -> branch_comp.b
    connect idex_funct3.q -> branch_comp.funct3

    // Branch/jump targets
    node branch_target: Adder(width=32)
    connect idex_pc.q -> branch_target.a
    connect idex_imm.q -> branch_target.b

    node jalr_target: BusAnd(width=32)
    connect alu.result -> jalr_target.a
    node jalr_mask: Constant(value=4294967294, width=32)
    connect jalr_mask.out -> jalr_target.b

    // PC+imm for AUIPC
    node pc_plus_imm: Adder(width=32)
    connect idex_pc.q -> pc_plus_imm.a
    connect idex_imm.q -> pc_plus_imm.b

    // EX-stage result (for forwarding)
    node ex_result: RV32I_WritebackMux
    connect alu.result -> ex_result.alu_result
    connect zero32.out -> ex_result.load_data
    connect idex_pc4.q -> ex_result.pc_plus4
    connect idex_imm.q -> ex_result.immediate
    connect pc_plus_imm.sum -> ex_result.pc_plus_imm
    connect idex_mem_to_reg.q -> ex_result.mem_to_reg
    connect idex_lui.q -> ex_result.lui
    connect idex_auipc.q -> ex_result.auipc
    connect idex_jump.q -> ex_result.jump

    // Branch taken
    node branch_and: And
    connect idex_branch.q -> branch_and.a
    connect branch_comp.take_branch -> branch_and.b

    // Next PC
    node next_pc: RV32I_NextPCMux
    connect idex_pc4.q -> next_pc.pc_plus4
    connect branch_target.sum -> next_pc.branch_target
    connect branch_target.sum -> next_pc.jal_target
    connect jalr_target.out -> next_pc.jalr_target
    connect idex_branch.q -> next_pc.branch
    connect branch_comp.take_branch -> next_pc.take_branch
    connect idex_jump.q -> next_pc.jump
    connect idex_is_jalr.q -> next_pc.is_jalr

    node pc_src_taken: Or
    connect branch_and.out -> pc_src_taken.a
    connect idex_jump.q -> pc_src_taken.b

    node pc_next_mux: Mux(width=32)
    connect pc_plus4.sum -> pc_next_mux.in0
    connect next_pc.next_pc -> pc_next_mux.in1
    connect pc_src_taken.out -> pc_next_mux.sel

    connect pc_next_mux.out -> pc.data

    // Hazard unit wiring
    connect branch_and.out -> hazard.branch_taken
    connect idex_jump.q -> hazard.jump
    connect idex_rd.q -> hazard.id_rd
    connect idex_mem_read.q -> hazard.id_mem_read

    // EX/MEM Pipeline Register
    node exmem_alu_result: Register(width=32)
    connect alu.result -> exmem_alu_result.data
    connect one1.out -> exmem_alu_result.we

    node exmem_result: Register(width=32)
    connect ex_result.write_data -> exmem_result.data
    connect one1.out -> exmem_result.we

    node exmem_read2: Register(width=32)
    connect fwd_b_mux2.out -> exmem_read2.data
    connect one1.out -> exmem_read2.we

    node exmem_rd: Register(width=5)
    connect idex_rd.q -> exmem_rd.data
    connect one1.out -> exmem_rd.we

    node exmem_funct3: Register(width=3)
    connect idex_funct3.q -> exmem_funct3.data
    connect one1.out -> exmem_funct3.we

    node exmem_pc4: Register(width=32)
    connect idex_pc4.q -> exmem_pc4.data
    connect one1.out -> exmem_pc4.we

    node exmem_imm: Register(width=32)
    connect idex_imm.q -> exmem_imm.data
    connect one1.out -> exmem_imm.we

    node exmem_pc_plus_imm: Register(width=32)
    connect pc_plus_imm.sum -> exmem_pc_plus_imm.data
    connect one1.out -> exmem_pc_plus_imm.we

    node exmem_mem_read: Register(width=1)
    connect idex_mem_read.q -> exmem_mem_read.data
    connect one1.out -> exmem_mem_read.we

    node exmem_mem_write: Register(width=1)
    connect idex_mem_write.q -> exmem_mem_write.data
    connect one1.out -> exmem_mem_write.we

    node exmem_reg_write: Register(width=1)
    connect idex_reg_write.q -> exmem_reg_write.data
    connect one1.out -> exmem_reg_write.we

    node exmem_mem_to_reg: Register(width=1)
    connect idex_mem_to_reg.q -> exmem_mem_to_reg.data
    connect one1.out -> exmem_mem_to_reg.we

    node exmem_lui: Register(width=1)
    connect idex_lui.q -> exmem_lui.data
    connect one1.out -> exmem_lui.we

    node exmem_auipc: Register(width=1)
    connect idex_auipc.q -> exmem_auipc.data
    connect one1.out -> exmem_auipc.we

    node exmem_jump: Register(width=1)
    connect idex_jump.q -> exmem_jump.data
    connect one1.out -> exmem_jump.we

    // Forwarding: EX hazard from EX/MEM
    connect exmem_rd.q -> forward.ex_rd
    connect exmem_reg_write.q -> forward.ex_reg_write`;

// MEM stage: direct DataMem (levels 9-11)
const PL_MEM_DIRECT = `
    // ==== STAGE 4: MEMORY ACCESS ====
    node dmem: RV32I_DataMem
    connect exmem_alu_result.q -> dmem.addr
    connect exmem_read2.q -> dmem.write_data
    connect exmem_mem_read.q -> dmem.mem_read
    connect exmem_mem_write.q -> dmem.mem_write
    connect exmem_funct3.q -> dmem.funct3`;

// MEM stage: MemBusMux + DataMem + UART (levels 12-13)
const PL_MEM_BUS = `
    // ==== STAGE 4: MEMORY ACCESS (via MemBusMux) ====
    node bus_mux: MemBusMux
    connect exmem_alu_result.q -> bus_mux.addr
    connect exmem_read2.q -> bus_mux.write_data
    connect exmem_mem_read.q -> bus_mux.mem_read
    connect exmem_mem_write.q -> bus_mux.mem_write
    connect exmem_funct3.q -> bus_mux.funct3

    // Peripheral 0: DataMem
    node dmem: RV32I_DataMem
    connect bus_mux.local_addr -> dmem.addr
    connect bus_mux.write_data_out -> dmem.write_data
    connect bus_mux.p0_read -> dmem.mem_read
    connect bus_mux.p0_write -> dmem.mem_write
    connect bus_mux.funct3_out -> dmem.funct3
    connect dmem.read_data -> bus_mux.read_data_0

    // Peripheral 1: UART_TX
    node uart: UART_TX
    connect bus_mux.local_addr -> uart.addr
    connect bus_mux.write_data_out -> uart.write_data
    connect bus_mux.p1_read -> uart.mem_read
    connect bus_mux.p1_write -> uart.mem_write
    connect uart.read_data -> bus_mux.read_data_1`;

// MEM/WB + WB + outputs (parameterized by load data source)
function plTail(loadDataSource: string): string {
  return `
    // MEM/WB Pipeline Register
    node memwb_alu_result: Register(width=32)
    connect exmem_alu_result.q -> memwb_alu_result.data
    connect one1.out -> memwb_alu_result.we

    node memwb_load_data: Register(width=32)
    connect ${loadDataSource} -> memwb_load_data.data
    connect one1.out -> memwb_load_data.we

    node memwb_rd: Register(width=5)
    connect exmem_rd.q -> memwb_rd.data
    connect one1.out -> memwb_rd.we

    node memwb_pc4: Register(width=32)
    connect exmem_pc4.q -> memwb_pc4.data
    connect one1.out -> memwb_pc4.we

    node memwb_imm: Register(width=32)
    connect exmem_imm.q -> memwb_imm.data
    connect one1.out -> memwb_imm.we

    node memwb_pc_plus_imm: Register(width=32)
    connect exmem_pc_plus_imm.q -> memwb_pc_plus_imm.data
    connect one1.out -> memwb_pc_plus_imm.we

    node memwb_reg_write: Register(width=1)
    connect exmem_reg_write.q -> memwb_reg_write.data
    connect one1.out -> memwb_reg_write.we

    node memwb_mem_to_reg: Register(width=1)
    connect exmem_mem_to_reg.q -> memwb_mem_to_reg.data
    connect one1.out -> memwb_mem_to_reg.we

    node memwb_lui: Register(width=1)
    connect exmem_lui.q -> memwb_lui.data
    connect one1.out -> memwb_lui.we

    node memwb_auipc: Register(width=1)
    connect exmem_auipc.q -> memwb_auipc.data
    connect one1.out -> memwb_auipc.we

    node memwb_jump: Register(width=1)
    connect exmem_jump.q -> memwb_jump.data
    connect one1.out -> memwb_jump.we

    // Forwarding: MEM hazard from MEM/WB
    connect memwb_rd.q -> forward.mem_rd
    connect memwb_reg_write.q -> forward.mem_reg_write

    // ==== STAGE 5: WRITE BACK ====
    node wb_mux: RV32I_WritebackMux
    connect memwb_alu_result.q -> wb_mux.alu_result
    connect memwb_load_data.q -> wb_mux.load_data
    connect memwb_pc4.q -> wb_mux.pc_plus4
    connect memwb_imm.q -> wb_mux.immediate
    connect memwb_pc_plus_imm.q -> wb_mux.pc_plus_imm
    connect memwb_mem_to_reg.q -> wb_mux.mem_to_reg
    connect memwb_lui.q -> wb_mux.lui
    connect memwb_auipc.q -> wb_mux.auipc
    connect memwb_jump.q -> wb_mux.jump

    // Write back to register file
    connect memwb_rd.q -> regfile.rd
    connect memwb_reg_write.q -> regfile.we
    connect wb_mux.write_data -> regfile.write_data

    // Forwarding mux data from WB
    connect wb_mux.write_data -> fwd_a_mux2.in1
    connect wb_mux.write_data -> fwd_b_mux2.in1

    // Observable outputs
    connect pc.q -> pc_out
    connect alu.result -> alu_out
    connect wb_mux.write_data -> wb_out`;
}

const PL_OUTPUTS = '\n  output pc_out: Bus[32]\n  output alu_out: Bus[32]\n  output wb_out: Bus[32]';

function buildPipeline(memSection: string, loadDataSource: string): string {
  return `circuit RV32I_CPU {${PL_OUTPUTS}
  impl {
${PL_BEFORE_MEM}
${memSection}
${plTail(loadDataSource)}
  }
}`;
}

const PIPELINE_DIRECT = buildPipeline(PL_MEM_DIRECT, 'dmem.read_data');
const PIPELINE_BUS_UART = buildPipeline(PL_MEM_BUS, 'bus_mux.read_data');

// Connection lists for pipeline levels
const FWD_CONNS = [
  'exmem_rd.q -> forward.ex_rd',
  'exmem_reg_write.q -> forward.ex_reg_write',
  'exmem_result.q -> fwd_a_mux1.in1',
  'exmem_result.q -> fwd_b_mux1.in1',
  'memwb_rd.q -> forward.mem_rd',
  'memwb_reg_write.q -> forward.mem_reg_write',
  'wb_mux.write_data -> fwd_a_mux2.in1',
  'wb_mux.write_data -> fwd_b_mux2.in1',
];

const HAZARD_CONNS = [
  'ifid_instr.q -> ifid_decode_for_hazard.instruction',
  'ifid_decode_for_hazard.rs1 -> hazard.if_rs1',
  'ifid_decode_for_hazard.rs2 -> hazard.if_rs2',
  'idex_rd.q -> hazard.id_rd',
  'idex_mem_read.q -> hazard.id_mem_read',
  'branch_and.out -> hazard.branch_taken',
  'idex_jump.q -> hazard.jump',
];

const OUTPUT_CONNS = [
  'pc.q -> pc_out',
  'alu.result -> alu_out',
  'wb_mux.write_data -> wb_out',
];

const BUS_INPUT_CONNS = [
  'exmem_alu_result.q -> bus_mux.addr',
  'exmem_read2.q -> bus_mux.write_data',
  'exmem_mem_read.q -> bus_mux.mem_read',
  'exmem_mem_write.q -> bus_mux.mem_write',
  'exmem_funct3.q -> bus_mux.funct3',
];

const DMEM_BUS_CONNS = [
  'bus_mux.local_addr -> dmem.addr',
  'bus_mux.write_data_out -> dmem.write_data',
  'bus_mux.p0_read -> dmem.mem_read',
  'bus_mux.p0_write -> dmem.mem_write',
  'bus_mux.funct3_out -> dmem.funct3',
  'dmem.read_data -> bus_mux.read_data_0',
];

const UART_CONNS = [
  'bus_mux.local_addr -> uart.addr',
  'bus_mux.write_data_out -> uart.write_data',
  'bus_mux.p1_read -> uart.mem_read',
  'bus_mux.p1_write -> uart.mem_write',
  'uart.read_data -> bus_mux.read_data_1',
];

// ================================================================
// CPU_LEVELS
// ================================================================

export const CPU_LEVELS: ChallengeLevel[] = [
  // ── Level 1: The Program Counter ──
  {
    id: 'program-counter',
    title: 'The Program Counter',
    concept:
      "Everything starts with a counter. The Program Counter (PC) holds the memory address of the current instruction. Each tick, the PC advances by 4 bytes — because RISC-V instructions are 4 bytes wide. Wire the PC register, adder, and constant into a loop that counts 0, 4, 8, 12...",
    objective:
      "Wire the PC loop: the register feeds the adder, the constant 4 feeds the adder, the adder feeds back to the register. Enable the write-enable and connect the output.",
    hints: [
      "The PC register's output port is 'q' and its input port is 'data'.",
      "The Adder takes 'a' and 'b' and outputs 'sum'.",
      "Connect pc.q → pc_plus4.a, four.out → pc_plus4.b, pc_plus4.sum → pc.data.",
      "Don't forget pc_we.out → pc.we (the write enable) and pc.q → pc_out.",
    ],
    scaffold: commentOut(L1_SOLUTION, L1_NEW),
    solution: L1_SOLUTION,
    height: 300,
    checks: [
      { description: 'PC = 0 at tick 0', node: 'pc', port: 'q', expected: 0, ticks: 0 },
      { description: 'PC = 4 at tick 1', node: 'pc', port: 'q', expected: 4, ticks: 1 },
      { description: 'PC = 8 at tick 2', node: 'pc', port: 'q', expected: 8, ticks: 2 },
    ],
  },

  // ── Level 2: Instruction Fetch ──
  {
    id: 'fetch',
    title: 'Instruction Fetch',
    concept:
      "Your PC loop from Level 1 is now packaged as 'PCUnit_Simple' — a single block with a pc_val output. That's hardware abstraction: build it, verify it, box it up.\n\nNow use it. The PC points to an address in instruction memory. The memory returns a 32-bit instruction. The decoder splits it into fields (opcode, register addresses, function codes). The immediate generator sign-extends constants. The control unit decides what the CPU should do.",
    objective:
      "Wire the PC to instruction memory, then wire the instruction through the decoder, immediate generator, and control unit.",
    hints: [
      "Connect pc_unit.pc_val → imem.addr to fetch the instruction at the current PC.",
      "The instruction goes to two places: decode.instruction and immgen.instruction.",
      "The decoder outputs opcode and funct3 which feed the control unit.",
      "funct7 needs a BitSlice to extract bit 5 before feeding control.funct7_bit.",
    ],
    preamble: L2_PREAMBLE,
    scaffold: commentOut(L2_SOLUTION, L2_NEW),
    solution: L2_SOLUTION,
    height: 400,
  },

  // ── Level 3: Registers and the ALU ──
  {
    id: 'regfile-alu',
    title: 'Registers and the ALU',
    concept:
      "Levels 1-2 are now packaged: PCUnit handles counting, FetchDecodeUnit handles instruction memory and decoding. You can see them as single blocks in the circuit.\n\nRISC-V has 32 registers (x0-x31). The decoder extracts two source addresses (rs1, rs2) and one destination (rd). The register file reads two values and writes one. The ALU performs arithmetic — but its second input can come from the register file or an immediate. A mux selects which.",
    objective:
      "Wire the register file (read and write ports), the ALU source mux, and the ALU itself. The inputs come from the fetch block's decoded outputs.",
    hints: [
      "Register addresses: fetch.rs1 → regfile.rs1, fetch.rs2 → regfile.rs2, fetch.rd → regfile.rd.",
      "Write-enable: fetch.reg_write → regfile.we.",
      "ALU source mux: regfile.read2 → in0, fetch.immediate → in1, fetch.alu_src → sel.",
      "ALU: regfile.read1 → alu.a, alu_src_mux.out → alu.b, fetch.alu_op → alu.alu_op.",
    ],
    preamble: L3_PREAMBLE,
    scaffold: commentOut(L3_SOLUTION, L3_NEW),
    solution: L3_SOLUTION,
    height: 400,
  },

  // ── Level 4: Branches and Jumps ──
  {
    id: 'branching',
    title: 'Branches and Jumps',
    concept:
      "The register file and ALU from Level 3 are now the 'exec' block. So far: PCUnit → FetchDecodeUnit → RegfileALUUnit. Three blocks, clean and simple.\n\nBut the PC only increments. Branches compare two registers and jump to PC+offset if the condition holds. JAL jumps unconditionally. JALR jumps to (rs1+imm) & ~1. The NextPCMux selects between PC+4, branch target, JAL target, or JALR target. Wire the branch logic and connect the targets.",
    objective:
      "Wire the branch comparator, branch target adder, JALR target, and the NextPCMux data inputs. Control signals are pre-wired.",
    hints: [
      "Branch comparator: exec.read1 → branch_comp.a, exec.read2 → branch_comp.b, fetch.funct3 → branch_comp.funct3.",
      "Branch target: pc_unit.pc_val → branch_target.a, fetch.immediate → branch_target.b.",
      "JALR target: exec.alu_result → jalr_target.a, jalr_mask.out → jalr_target.b.",
      "NextPCMux data: branch_target.sum → next_pc.branch_target AND next_pc.jal_target, jalr_target.out → next_pc.jalr_target.",
    ],
    preamble: L456_PREAMBLE,
    scaffold: commentOut(L4_SOLUTION, L4_NEW),
    solution: L4_SOLUTION,
    height: 450,
  },

  // ── Level 5: Load and Store ──
  {
    id: 'data-memory',
    title: 'Load and Store',
    concept:
      "Programs need to read and write data in memory. A store instruction (SW) writes a register value to a memory address. A load instruction (LW) reads from memory into a register. The data memory takes the ALU result as address (base + offset), the register value as write data, and control signals for read/write.",
    objective:
      "Wire the data memory: address from the ALU, write data from the register file, and control signals from the decoder.",
    hints: [
      "Address: exec.alu_result → dmem.addr (the ALU computed base + offset).",
      "Write data: exec.read2 → dmem.write_data (the value from rs2).",
      "Control: fetch.mem_read → dmem.mem_read, fetch.mem_write → dmem.mem_write.",
      "Width: fetch.funct3 → dmem.funct3 (selects byte/halfword/word).",
    ],
    preamble: L456_PREAMBLE,
    scaffold: commentOut(L5_SOLUTION, L5_NEW),
    solution: L5_SOLUTION,
    height: 450,
  },

  // ── Level 6: The Writeback Mux ──
  {
    id: 'writeback',
    title: 'The Writeback Mux',
    concept:
      "Different instructions write different values to the destination register: ALU result (ADD), loaded data (LW), PC+4 (JAL return address), an immediate (LUI), or PC+immediate (AUIPC). The WritebackMux selects the right value. This closes the loop — the result flows back into the register file.",
    objective:
      "Wire the WritebackMux with all five data inputs and four control inputs, plus the PC+imm adder. Connect the output back to the exec block's write_data.",
    hints: [
      "PC+imm adder: pc_unit.pc_val → pc_plus_imm.a, fetch.immediate → pc_plus_imm.b.",
      "Data inputs: exec.alu_result, dmem.read_data, pc_unit.pc_plus4, fetch.immediate, pc_plus_imm.sum.",
      "Control inputs: fetch.mem_to_reg, fetch.lui, fetch.auipc, fetch.jump.",
      "Close the loop: wb_mux.write_data → exec.write_data.",
    ],
    preamble: L456_PREAMBLE,
    scaffold: commentOut(L6_SOLUTION, L6_NEW),
    solution: L6_SOLUTION,
    height: 450,
  },

  // ── Level 7: Your First Program ──
  {
    id: 'first-program',
    title: 'Your First Program',
    concept:
      "Your single-cycle CPU is complete. Every component is wired: fetch, decode, register file, ALU, branches, data memory, and writeback. This level shows the full unwrapped CPU — all the primitives you've been building with, laid out as one circuit. Connect the observable outputs so you can watch it run.",
    objective:
      "Connect the two observable outputs: the PC value and the ALU result.",
    hints: [
      "Connect pc.q → pc_out to observe the program counter.",
      "Connect alu.result → alu_result to observe the ALU output.",
    ],
    scaffold: commentOut(L7_SOLUTION, L7_NEW),
    solution: L7_SOLUTION,
    height: 450,
  },

  // ── Level 8: The Critical Path ──
  {
    id: 'critical-path',
    title: 'The Critical Path',
    concept:
      "Look at the CPU you just built. Every instruction passes through InstrMem → Decode → RegisterFile → ALU → DataMem → WritebackMux in a single tick. In real silicon, each block has a propagation delay. The longest combinational path determines the maximum clock speed.\n\nAt 5 GHz, each tick is 0.2 nanoseconds — not enough for signals to propagate through all 5 blocks. The solution: split the datapath into stages with registers between them. Each stage does 1/5th the work per tick.\n\nIF → ID → EX → MEM → WB\n\nNo wiring in this level — study the datapath and understand why it needs to be split.",
    objective:
      "This is a concept level. Study the single-cycle CPU and understand the critical path. Advance when ready.",
    hints: [
      "The critical path goes through: InstrMem → Decode → RegFile → ALU → DataMem → Writeback.",
      "Pipelining adds registers between stages so each stage works independently.",
      "The next level introduces the 5-stage pipeline.",
    ],
    scaffold: L7_SOLUTION,
    solution: L7_SOLUTION,
    height: 450,
  },

  // ── Level 9: The Pipeline (It's Broken) ──
  {
    id: 'pipeline-broken',
    title: "The Pipeline (It's Broken)",
    concept:
      "Welcome to the pipelined CPU. The datapath is split into 5 stages with pipeline registers between them: IF, ID, EX, MEM, WB. Each tick, a new instruction enters IF while previous instructions advance — like an assembly line.\n\nBut forwarding and hazard detection are disconnected. Wire the outputs and observe: the PC advances, but data hazards corrupt results. Try `addi x1, x0, 5; add x2, x1, x0` — x2 should be 5 but will be 0.",
    objective:
      "Wire the three observable outputs to see the pipeline running (but broken).",
    hints: [
      "Connect pc.q → pc_out to see the PC advancing.",
      "Connect alu.result → alu_out to see ALU computations.",
      "Connect wb_mux.write_data → wb_out to see writeback values.",
    ],
    scaffold: commentOut(PIPELINE_DIRECT, [...FWD_CONNS, ...HAZARD_CONNS, ...OUTPUT_CONNS]),
    solution: commentOut(PIPELINE_DIRECT, [...FWD_CONNS, ...HAZARD_CONNS]),
    height: 900,
  },

  // ── Level 10: Data Forwarding ──
  {
    id: 'forwarding',
    title: 'Data Forwarding',
    concept:
      "The pipeline reads registers in ID but writes in WB — 3 stages later. If an ADD follows an ADDI writing the same register, the ADD reads the old value. The fix: forwarding. A forwarding unit detects when a later stage has the value the current stage needs, and a mux bypasses the register file.\n\nTwo paths: from EX/MEM (1 cycle old) and from MEM/WB (2 cycles old).",
    objective:
      "Wire the forwarding unit's 4 inputs and the 4 forwarding mux data connections.",
    hints: [
      "ForwardingUnit from EX/MEM: exmem_rd.q → forward.ex_rd, exmem_reg_write.q → forward.ex_reg_write.",
      "ForwardingUnit from MEM/WB: memwb_rd.q → forward.mem_rd, memwb_reg_write.q → forward.mem_reg_write.",
      "Forward from EX/MEM: exmem_result.q → fwd_a_mux1.in1 AND fwd_b_mux1.in1.",
      "Forward from WB: wb_mux.write_data → fwd_a_mux2.in1 AND fwd_b_mux2.in1.",
    ],
    scaffold: commentOut(PIPELINE_DIRECT, [...FWD_CONNS, ...HAZARD_CONNS]),
    solution: commentOut(PIPELINE_DIRECT, HAZARD_CONNS),
    height: 900,
  },

  // ── Level 11: Load-Use Hazards ──
  {
    id: 'hazard-unit',
    title: 'Load-Use Hazards',
    concept:
      "Forwarding fixes most hazards, but not all. A load (LW) doesn't have its data until the end of MEM — one cycle too late. The hazard unit detects this: if ID reads a register that EX is loading, it stalls for one cycle. It also flushes on branches/jumps.",
    objective:
      "Wire the hazard unit: the decode-for-hazard instruction input, rs1/rs2 outputs, and EX stage signals.",
    hints: [
      "First: ifid_instr.q → ifid_decode_for_hazard.instruction.",
      "Then: ifid_decode_for_hazard.rs1 → hazard.if_rs1, ifid_decode_for_hazard.rs2 → hazard.if_rs2.",
      "From EX: idex_rd.q → hazard.id_rd, idex_mem_read.q → hazard.id_mem_read.",
      "Control: branch_and.out → hazard.branch_taken, idex_jump.q → hazard.jump.",
    ],
    scaffold: commentOut(PIPELINE_DIRECT, HAZARD_CONNS),
    solution: PIPELINE_DIRECT,
    height: 900,
  },

  // ── Level 12: Memory-Mapped I/O ──
  {
    id: 'memory-mapped-io',
    title: 'Memory-Mapped I/O',
    concept:
      "The pipeline is solid — but only talks to one data memory. Real CPUs need peripherals. Instead of special I/O instructions, RISC-V uses memory-mapped I/O: same SW/LW instructions, different address → different hardware.\n\nA MemBusMux decodes addresses: 0x00010000 → DataMem (RAM), 0x80000000 → serial port.",
    objective:
      "Wire the MemBusMux inputs from the pipeline (5) and DataMem as peripheral 0 (6).",
    hints: [
      "Pipeline → MemBusMux: exmem_alu_result.q → bus_mux.addr, exmem_read2.q → bus_mux.write_data, mem_read/write, funct3.",
      "MemBusMux → DataMem: bus_mux.local_addr → dmem.addr, bus_mux.write_data_out → dmem.write_data.",
      "DataMem control: bus_mux.p0_read/write → dmem.mem_read/write, bus_mux.funct3_out → dmem.funct3.",
      "Close the loop: dmem.read_data → bus_mux.read_data_0.",
    ],
    scaffold: commentOut(PIPELINE_BUS_UART, [...BUS_INPUT_CONNS, ...DMEM_BUS_CONNS, ...UART_CONNS]),
    solution: commentOut(PIPELINE_BUS_UART, UART_CONNS),
    height: 900,
  },

  // ── Level 13: Hello World ──
  {
    id: 'hello-world',
    title: 'Hello World',
    concept:
      "The memory bus is live. Now plug in a UART — a serial transmitter that converts memory writes into text. When the CPU executes `sw` to address 0x80000000, the MemBusMux routes it to the UART, which appends the byte to its output buffer.\n\nWire the UART, load Hello World, and watch your CPU print its first words.",
    objective:
      "Wire the UART_TX as peripheral 1 on the MemBusMux (5 connections).",
    hints: [
      "Address: bus_mux.local_addr → uart.addr.",
      "Data: bus_mux.write_data_out → uart.write_data.",
      "Control: bus_mux.p1_read → uart.mem_read, bus_mux.p1_write → uart.mem_write.",
      "Read back: uart.read_data → bus_mux.read_data_1.",
    ],
    scaffold: commentOut(PIPELINE_BUS_UART, UART_CONNS),
    solution: PIPELINE_BUS_UART,
    height: 900,
  },
];

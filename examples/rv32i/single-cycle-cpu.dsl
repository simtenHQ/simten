// Single-Cycle RV32I CPU
//
// Wires all RV32I primitives + PC register into a complete single-cycle CPU.
// Each tick executes one instruction.
//
// Uses RV32I_WritebackMux and RV32I_NextPCMux for clean datapath
// (matches real RTL implementations with unified mux trees).
//
// Programs are loaded at runtime into InstrMem via the memory data store.
// Use the InstrMem node's drag-drop zone or "Compile & Load" button.

circuit RV32I_CPU {
  output pc_out: Bus[32]
  output alu_result: Bus[32]
  impl {
    // ========================================================================
    // Instruction Memory — programs loaded at runtime
    // ========================================================================
    node imem: RV32I_InstrMem

    // ========================================================================
    // Program Counter
    // ========================================================================
    node pc: Register(width=32)
    node pc_plus4: Adder(width=32)
    node pc_we: Constant(value=1, width=1)
    node four: Constant(value=4, width=32)

    connect pc.q -> pc_plus4.a
    connect four.out -> pc_plus4.b
    connect pc_we.out -> pc.we

    // ========================================================================
    // Fetch
    // ========================================================================
    connect pc.q -> imem.addr

    // ========================================================================
    // Decode
    // ========================================================================
    node decode: RV32I_Decode
    connect imem.instruction -> decode.instruction

    // ========================================================================
    // Immediate Generator
    // ========================================================================
    node immgen: RV32I_ImmGen
    connect imem.instruction -> immgen.instruction

    // ========================================================================
    // Control Unit
    // ========================================================================
    node control: RV32I_Control
    connect decode.opcode -> control.opcode
    connect decode.funct3 -> control.funct3

    // funct7 bit 30 — extract from funct7[5] (bit 30 of instruction)
    node funct7_splitter: BitSlice(low=5, high=5)
    connect decode.funct7 -> funct7_splitter.in
    connect funct7_splitter.out -> control.funct7_bit

    // ========================================================================
    // Register File
    // ========================================================================
    node regfile: RV32I_RegisterFile
    connect decode.rs1 -> regfile.rs1
    connect decode.rs2 -> regfile.rs2
    connect decode.rd -> regfile.rd
    connect control.reg_write -> regfile.we

    // ========================================================================
    // ALU Source Mux (register or immediate)
    // ========================================================================
    node alu_src_mux: Mux(width=32)
    connect regfile.read2 -> alu_src_mux.in0
    connect immgen.immediate -> alu_src_mux.in1
    connect control.alu_src -> alu_src_mux.sel

    // ========================================================================
    // ALU
    // ========================================================================
    node alu: RV32I_ALU
    connect regfile.read1 -> alu.a
    connect alu_src_mux.out -> alu.b
    connect control.alu_op -> alu.alu_op

    // ========================================================================
    // Branch Comparator
    // ========================================================================
    node branch_comp: RV32I_BranchComp
    connect regfile.read1 -> branch_comp.a
    connect regfile.read2 -> branch_comp.b
    connect decode.funct3 -> branch_comp.funct3

    // ========================================================================
    // Data Memory
    // ========================================================================
    node dmem: RV32I_DataMem
    connect alu.result -> dmem.addr
    connect regfile.read2 -> dmem.write_data
    connect control.mem_read -> dmem.mem_read
    connect control.mem_write -> dmem.mem_write
    connect decode.funct3 -> dmem.funct3

    // ========================================================================
    // Writeback — unified mux (ALU / load / PC+4 / imm / PC+imm)
    // ========================================================================
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

    // ========================================================================
    // Next PC — unified mux (PC+4 / branch / JAL / JALR)
    // ========================================================================
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

    // Observable outputs
    connect pc.q -> pc_out
    connect alu.result -> alu_result
  }
}

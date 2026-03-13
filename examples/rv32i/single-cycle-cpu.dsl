// Single-Cycle RV32I CPU
//
// Wires all 8 RV32I primitives + PC register + muxes + adder into a complete
// single-cycle CPU. Each tick executes one instruction.
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

    // PC + 4
    connect pc.q -> pc_plus4.a
    node four: Constant(value=4, width=32)
    connect four.out -> pc_plus4.b

    // PC always enabled
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
    // Write-back Mux (ALU result or memory data)
    // ========================================================================
    node wb_mux: Mux(width=32)
    connect alu.result -> wb_mux.in0
    connect dmem.read_data -> wb_mux.in1
    connect control.mem_to_reg -> wb_mux.sel

    // ========================================================================
    // LUI / AUIPC Mux
    // ========================================================================
    // For LUI: write immediate directly
    // For AUIPC: write PC + immediate
    // Otherwise: write wb_mux output
    node lui_mux: Mux(width=32)
    connect wb_mux.out -> lui_mux.in0
    connect immgen.immediate -> lui_mux.in1
    connect control.lui -> lui_mux.sel

    node pc_plus_imm: Adder(width=32)
    connect pc.q -> pc_plus_imm.a
    connect immgen.immediate -> pc_plus_imm.b

    node auipc_mux: Mux(width=32)
    connect lui_mux.out -> auipc_mux.in0
    connect pc_plus_imm.sum -> auipc_mux.in1
    connect control.auipc -> auipc_mux.sel

    // ========================================================================
    // JAL/JALR: write PC+4 to rd
    // ========================================================================
    node jump_wb_mux: Mux(width=32)
    connect auipc_mux.out -> jump_wb_mux.in0
    connect pc_plus4.sum -> jump_wb_mux.in1
    connect control.jump -> jump_wb_mux.sel

    connect jump_wb_mux.out -> regfile.write_data

    // ========================================================================
    // Branch/Jump target calculation
    // ========================================================================
    node branch_target: Adder(width=32)
    connect pc.q -> branch_target.a
    connect immgen.immediate -> branch_target.b

    // Branch taken?
    node branch_and: And
    connect control.branch -> branch_and.a
    connect branch_comp.take_branch -> branch_and.b

    // PC next mux: PC+4 or branch target
    node branch_mux: Mux(width=32)
    connect pc_plus4.sum -> branch_mux.in0
    connect branch_target.sum -> branch_mux.in1
    connect branch_and.out -> branch_mux.sel

    // Jump mux: branch_mux result or jump target
    // JAL: target = PC + imm (same as branch_target)
    // JALR: target = (rs1 + imm) & ~1 = ALU result & ~1
    node jalr_target: BusAnd(width=32)
    connect alu.result -> jalr_target.a
    node jalr_mask: Constant(value=4294967294, width=32)
    connect jalr_mask.out -> jalr_target.b

    // Choose between JAL target (PC+imm) and JALR target (ALU result)
    // For simplicity, use opcode to distinguish: JALR = opcode 0x67
    // We already have jump signal; use alu_src as proxy (JALR has alu_src=true, JAL doesn't)
    node jal_target_mux: Mux(width=32)
    connect branch_target.sum -> jal_target_mux.in0
    connect jalr_target.out -> jal_target_mux.in1
    connect control.alu_src -> jal_target_mux.sel

    node jump_mux: Mux(width=32)
    connect branch_mux.out -> jump_mux.in0
    connect jal_target_mux.out -> jump_mux.in1
    connect control.jump -> jump_mux.sel

    // Feed back to PC
    connect jump_mux.out -> pc.data

    // Observable outputs
    connect pc.q -> pc_out
    connect alu.result -> alu_result
  }
}

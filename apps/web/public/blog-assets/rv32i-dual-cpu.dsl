// RV32I Dual CPU — two pipelined RISC-V CPUs cross-connected via NIC
//
// Each CPU has its own InstrMem, DataMem, UART, and NIC.
// NIC TX of one CPU connects to NIC RX of the other, enabling
// inter-CPU communication via memory-mapped writes/reads.
//
// Memory map (per CPU):
//   0x00000000 - 0x0000FFFF  InstrMem (ROM, 64KB)
//   0x00010000 - 0x0001FFFF  DataMem  (RAM, 64KB)
//   0x80000000              UART TX data (W: write byte, R: tx_ready)
//   0x80001000              NIC TX data (W at +0), TX count (R at +8), TX frame-end (W at +C)
//   0x80002000              NIC RX data (R at +0), RX pop (W at +4), RX count (R at +8)
//
// 23 ticks for a full ping-pong round trip between the two CPUs.

// ============================================================================
// RV32I_CPU: 5-stage pipelined RISC-V CPU with memory-mapped peripherals
// ============================================================================

circuit RV32I_CPU {
  input net_rx_data: Bus[32]
  input net_rx_valid: Bit
  input net_rx_frame: Bit
  output net_tx_data: Bus[32]
  output net_tx_valid: Bit
  output net_tx_frame: Bit
  output pc_out: Bus[32]
  impl {

    // ========================================================================
    // Constants
    // ========================================================================
    node four: Constant(value=4, width=32)
    node zero32: Constant(value=0, width=32)
    node zero5: Constant(value=0, width=5)
    node zero4: Constant(value=0, width=4)
    node zero3: Constant(value=0, width=3)
    node zero1: Constant(value=0, width=1)
    node one1: Constant(value=1, width=1)

    // ========================================================================
    // Hazard Detection (needs forward declaration — wired later)
    // ========================================================================
    node hazard: RV32I_HazardUnit

    // Stall inversion: pipeline registers WE = NOT stall
    node stall_inv: Not
    connect hazard.stall -> stall_inv.in

    // ########################################################################
    //  STAGE 1: INSTRUCTION FETCH (IF)
    // ########################################################################

    node pc: Register(width=32)
    node pc_plus4: Adder(width=32)
    node imem: RV32I_InstrMem

    connect pc.q -> pc_plus4.a
    connect four.out -> pc_plus4.b
    connect pc.q -> imem.addr

    // PC write-enable: update unless stalled
    connect stall_inv.out -> pc.we

    // ========================================================================
    // IF/ID Pipeline Register
    // ========================================================================
    // On flush: zero IF/ID contents (NOP). On stall: hold IF/ID via we=stall_inv.

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

    // ########################################################################
    //  STAGE 2: INSTRUCTION DECODE (ID)
    // ########################################################################

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

    // Wire hazard unit inputs — decode the ID stage instruction (ifid_instr.q)
    // so the hazard unit compares the instruction in ID against the load in EX
    node ifid_decode_for_hazard: RV32I_Decode
    connect ifid_instr.q -> ifid_decode_for_hazard.instruction
    connect ifid_decode_for_hazard.rs1 -> hazard.if_rs1
    connect ifid_decode_for_hazard.rs2 -> hazard.if_rs2

    // ========================================================================
    // ID/EX Pipeline Register
    // ========================================================================
    node idex_flush: Or
    connect hazard.flush -> idex_flush.a
    connect hazard.stall -> idex_flush.b

    node idex_pc: Register(width=32)
    connect ifid_pc.q -> idex_pc.data
    connect one1.out -> idex_pc.we

    node idex_pc4: Register(width=32)
    connect ifid_pc4.q -> idex_pc4.data
    connect one1.out -> idex_pc4.we

    // WB-to-ID bypass: when WB writes the same register ID is reading,
    // forward the WB value instead of the stale register file output.
    // Models real hardware's write-first-read-second register file clocking.
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

    // -- Control signals (zeroed on flush/stall to insert NOP) --
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

    // ########################################################################
    //  STAGE 3: EXECUTE (EX)
    // ########################################################################

    // -- Forwarding Unit --
    node forward: RV32I_ForwardingUnit
    connect idex_rs1.q -> forward.id_rs1
    connect idex_rs2.q -> forward.id_rs2

    // -- Forwarding Mux A (ALU input A) --
    node fwd_a_bit0: BitSlice(low=0, high=0)
    connect forward.forward_a -> fwd_a_bit0.in
    node fwd_a_bit1: BitSlice(low=1, high=1)
    connect forward.forward_a -> fwd_a_bit1.in

    node fwd_a_mux1: Mux(width=32)
    connect idex_read1.q -> fwd_a_mux1.in0
    connect fwd_a_bit0.out -> fwd_a_mux1.sel

    node fwd_a_mux2: Mux(width=32)
    connect fwd_a_mux1.out -> fwd_a_mux2.in0
    connect fwd_a_bit1.out -> fwd_a_mux2.sel

    // -- Forwarding Mux B (ALU input B / store data) --
    node fwd_b_bit0: BitSlice(low=0, high=0)
    connect forward.forward_b -> fwd_b_bit0.in
    node fwd_b_bit1: BitSlice(low=1, high=1)
    connect forward.forward_b -> fwd_b_bit1.in

    node fwd_b_mux1: Mux(width=32)
    connect idex_read2.q -> fwd_b_mux1.in0
    connect fwd_b_bit0.out -> fwd_b_mux1.sel

    node fwd_b_mux2: Mux(width=32)
    connect fwd_b_mux1.out -> fwd_b_mux2.in0
    connect fwd_b_bit1.out -> fwd_b_mux2.sel

    // -- ALU source mux (forwarded rs2 or immediate) --
    node alu_src_mux: Mux(width=32)
    connect fwd_b_mux2.out -> alu_src_mux.in0
    connect idex_imm.q -> alu_src_mux.in1
    connect idex_alu_src.q -> alu_src_mux.sel

    // -- ALU --
    node alu: RV32I_ALU
    connect fwd_a_mux2.out -> alu.a
    connect alu_src_mux.out -> alu.b
    connect idex_alu_op.q -> alu.alu_op

    // -- Branch Comparator --
    node branch_comp: RV32I_BranchComp
    connect fwd_a_mux2.out -> branch_comp.a
    connect fwd_b_mux2.out -> branch_comp.b
    connect idex_funct3.q -> branch_comp.funct3

    // -- Branch/jump target calculation --
    node branch_target: Adder(width=32)
    connect idex_pc.q -> branch_target.a
    connect idex_imm.q -> branch_target.b

    node jalr_target: BusAnd(width=32)
    connect alu.result -> jalr_target.a
    node jalr_mask: Constant(value=4294967294, width=32)
    connect jalr_mask.out -> jalr_target.b

    // -- PC+imm for AUIPC --
    node pc_plus_imm: Adder(width=32)
    connect idex_pc.q -> pc_plus_imm.a
    connect idex_imm.q -> pc_plus_imm.b

    // -- EX-stage result (for forwarding) --
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

    // -- Branch taken signal --
    node branch_and: And
    connect idex_branch.q -> branch_and.a
    connect branch_comp.take_branch -> branch_and.b

    // -- Next PC --
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

    // Wire hazard unit
    connect branch_and.out -> hazard.branch_taken
    connect idex_jump.q -> hazard.jump
    connect idex_rd.q -> hazard.id_rd
    connect idex_mem_read.q -> hazard.id_mem_read

    // ========================================================================
    // EX/MEM Pipeline Register
    // ========================================================================
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

    // Wire forwarding unit: EX hazard from EX/MEM
    connect exmem_rd.q -> forward.ex_rd
    connect exmem_reg_write.q -> forward.ex_reg_write
    connect exmem_result.q -> fwd_a_mux1.in1
    connect exmem_result.q -> fwd_b_mux1.in1

    // ########################################################################
    //  STAGE 4: MEMORY ACCESS (MEM) — via MemBusMux
    // ########################################################################

    // MemBusMux: routes memory operations to correct peripheral
    node bus_mux: MemBusMux
    connect exmem_alu_result.q -> bus_mux.addr
    connect exmem_read2.q -> bus_mux.write_data
    connect exmem_mem_read.q -> bus_mux.mem_read
    connect exmem_mem_write.q -> bus_mux.mem_write
    connect exmem_funct3.q -> bus_mux.funct3

    // --- Peripheral 0: DataMem (0x00010000 - 0x0001FFFF) ---
    node dmem: RV32I_DataMem
    connect bus_mux.local_addr -> dmem.addr
    connect bus_mux.write_data_out -> dmem.write_data
    connect bus_mux.p0_read -> dmem.mem_read
    connect bus_mux.p0_write -> dmem.mem_write
    connect bus_mux.funct3_out -> dmem.funct3
    connect dmem.read_data -> bus_mux.read_data_0

    // --- Peripheral 1: UART_TX (0x80000000) ---
    node uart: UART_TX
    connect bus_mux.local_addr -> uart.addr
    connect bus_mux.write_data_out -> uart.write_data
    connect bus_mux.p1_read -> uart.mem_read
    connect bus_mux.p1_write -> uart.mem_write
    connect uart.read_data -> bus_mux.read_data_1

    // --- Peripheral 2 & 3: NIC_FIFO (TX: 0x80001000, RX: 0x80002000) ---
    node nic: NIC_FIFO
    connect bus_mux.local_addr -> nic.tx_addr
    connect bus_mux.write_data_out -> nic.tx_write_data
    connect bus_mux.p2_read -> nic.tx_mem_read
    connect bus_mux.p2_write -> nic.tx_mem_write
    connect nic.tx_read_data -> bus_mux.read_data_2

    connect bus_mux.local_addr -> nic.rx_addr
    connect bus_mux.p3_read -> nic.rx_mem_read
    connect bus_mux.p3_write -> nic.rx_mem_write
    connect nic.rx_read_data -> bus_mux.read_data_3

    // --- Peripheral 4: InstrMem read port (0x00000000 - 0x0000FFFF) ---
    // Allows CPU data loads (lbu/lw) to read from ROM (.rodata strings)
    node imem_data: RV32I_InstrMem
    connect bus_mux.local_addr -> imem_data.addr
    node imem_load_align: RV32I_LoadAlign
    connect imem_data.instruction -> imem_load_align.data
    connect exmem_funct3.q -> imem_load_align.funct3
    connect imem_load_align.out -> bus_mux.read_data_4

    // Network I/O
    connect net_rx_data -> nic.net_rx_data
    connect net_rx_valid -> nic.net_rx_valid
    connect net_rx_frame -> nic.net_rx_frame
    connect nic.net_tx_data -> net_tx_data
    connect nic.net_tx_valid -> net_tx_valid
    connect nic.net_tx_frame -> net_tx_frame

    // ========================================================================
    // MEM/WB Pipeline Register
    // ========================================================================
    node memwb_alu_result: Register(width=32)
    connect exmem_alu_result.q -> memwb_alu_result.data
    connect one1.out -> memwb_alu_result.we

    node memwb_load_data: Register(width=32)
    connect bus_mux.read_data -> memwb_load_data.data
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

    // Control signals
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

    // Wire forwarding unit: MEM hazard from MEM/WB
    connect memwb_rd.q -> forward.mem_rd
    connect memwb_reg_write.q -> forward.mem_reg_write

    // ########################################################################
    //  STAGE 5: WRITE BACK (WB)
    // ########################################################################

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

    // Wire forwarding mux: MEM/WB write data
    connect wb_mux.write_data -> fwd_a_mux2.in1
    connect wb_mux.write_data -> fwd_b_mux2.in1

    // ========================================================================
    // Observable outputs
    // ========================================================================
    connect pc.q -> pc_out
  }
}

// ============================================================================
// RV32I_DualCPU: Two CPUs cross-connected via NIC
// ============================================================================

circuit RV32I_DualCPU {
  output cpu0_pc: Bus[32]
  output cpu1_pc: Bus[32]
  impl {
    node cpu0: RV32I_CPU
    node cpu1: RV32I_CPU

    // Cross-connect NICs: cpu0 TX -> cpu1 RX, cpu1 TX -> cpu0 RX
    connect cpu0.net_tx_data  -> cpu1.net_rx_data
    connect cpu0.net_tx_valid -> cpu1.net_rx_valid
    connect cpu0.net_tx_frame -> cpu1.net_rx_frame
    connect cpu1.net_tx_data  -> cpu0.net_rx_data
    connect cpu1.net_tx_valid -> cpu0.net_rx_valid
    connect cpu1.net_tx_frame -> cpu0.net_rx_frame

    // Observable outputs
    connect cpu0.pc_out -> cpu0_pc
    connect cpu1.pc_out -> cpu1_pc
  }
}

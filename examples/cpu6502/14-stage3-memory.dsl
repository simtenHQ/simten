// Stage 3 Phase 2: Memory Operations with Zero-Page Addressing
// Adds memory controller and zero-page addressing modes
// New instructions: STA $addr, LDA $addr (zero-page)

// === Simple Memory Controller ===
// For now, simplified to 256 bytes (zero-page only)
// Later will extend to full 64KB address space
circuit SimpleMemory {
  input addr: Bus[8]
  input data_in: Bus[8]
  input write_enable: Bit

  output data_out: Bus[8]

  clock clk

  impl {
    // 256 bytes of RAM using registers
    // In real implementation, would use RAM primitive or external memory
    // For now, just demonstrate with a few registers

    node zero: Constant(value=0)
    node addr_10: Constant(value=16)  // 0x10
    node addr_11: Constant(value=17)  // 0x11
    node addr_12: Constant(value=18)  // 0x12

    // Check which address is being accessed
    node at_10: Comparator
    connect addr -> at_10.a
    connect addr_10.out -> at_10.b

    node at_11: Comparator
    connect addr -> at_11.a
    connect addr_11.out -> at_11.b

    node at_12: Comparator
    connect addr -> at_12.a
    connect addr_12.out -> at_12.b

    // Memory cells
    node mem_10: Register
    node mem_11: Register
    node mem_12: Register

    connect clk -> mem_10.clk
    connect clk -> mem_11.clk
    connect clk -> mem_12.clk

    connect data_in -> mem_10.data
    connect data_in -> mem_11.data
    connect data_in -> mem_12.data

    // Write enable for each cell
    node we_10: And
    connect write_enable -> we_10.a
    connect at_10.eq -> we_10.b
    connect we_10.out -> mem_10.we

    node we_11: And
    connect write_enable -> we_11.a
    connect at_11.eq -> we_11.b
    connect we_11.out -> mem_11.we

    node we_12: And
    connect write_enable -> we_12.a
    connect at_12.eq -> we_12.b
    connect we_12.out -> mem_12.we

    // Read mux
    node mux1: Mux
    connect at_10.eq -> mux1.sel
    connect zero.out -> mux1.in0  // Default: 0
    connect mem_10.q -> mux1.in1

    node mux2: Mux
    connect at_11.eq -> mux2.sel
    connect mux1.out -> mux2.in0
    connect mem_11.q -> mux2.in1

    node mux3: Mux
    connect at_12.eq -> mux3.sel
    connect mux2.out -> mux3.in0
    connect mem_12.q -> mux3.in1

    connect mux3.out -> data_out
  }
}

// === Register File with A, X, Y ===
circuit RegisterFile {
  input write_a: Bit
  input write_x: Bit
  input write_y: Bit
  input data_a: Bus[8]
  input data_x: Bus[8]
  input data_y: Bus[8]

  output reg_a: Bus[8]
  output reg_x: Bus[8]
  output reg_y: Bus[8]

  clock clk

  impl {
    node regA: Register
    node regX: Register
    node regY: Register

    connect clk -> regA.clk
    connect clk -> regX.clk
    connect clk -> regY.clk

    connect data_a -> regA.data
    connect data_x -> regX.data
    connect data_y -> regY.data

    connect write_a -> regA.we
    connect write_x -> regX.we
    connect write_y -> regY.we

    connect regA.q -> reg_a
    connect regX.q -> reg_x
    connect regY.q -> reg_y
  }
}

// === Extended Control FSM ===
// Adds support for memory operations and zero-page addressing
circuit MemoryControl {
  input reset: Bit
  input current_opcode: Bus[8]

  output current_state: Bus[8]
  output exec_subcycle: Bus[8]
  output pc_increment: Bit
  output ir_load: Bit
  output operand_load: Bit       // Load operand register
  output addr_load: Bit          // Load address register
  output mem_read: Bit           // Read from memory
  output mem_write: Bit          // Write to memory

  // Register write controls
  output write_a: Bit
  output write_x: Bit
  output write_y: Bit

  // Instruction decode
  output is_lda_imm: Bit         // LDA #imm (A9)
  output is_lda_zp: Bit          // LDA $addr (A5)
  output is_sta_zp: Bit          // STA $addr (85)
  output is_tax: Bit
  output is_inx: Bit

  clock clk

  impl {
    // State register
    node state_reg: Register
    connect clk -> state_reg.clk

    // Execute sub-cycle counter
    node subcycle_reg: Register
    connect clk -> subcycle_reg.clk

    // State constants
    node STATE_FETCH: Constant(value=0)
    node STATE_DECODE: Constant(value=1)
    node STATE_EXECUTE: Constant(value=2)

    // State comparators
    node is_fetch: Comparator
    connect state_reg.q -> is_fetch.a
    connect STATE_FETCH.out -> is_fetch.b

    node is_decode: Comparator
    connect state_reg.q -> is_decode.a
    connect STATE_DECODE.out -> is_decode.b

    node is_execute: Comparator
    connect state_reg.q -> is_execute.a
    connect STATE_EXECUTE.out -> is_execute.b

    // Instruction decode
    node LDA_IMM: Constant(value=169)  // A9
    node LDA_ZP: Constant(value=165)   // A5
    node STA_ZP: Constant(value=133)   // 85
    node TAX: Constant(value=170)      // AA
    node INX: Constant(value=232)      // E8

    node cmp_lda_imm: Comparator
    connect current_opcode -> cmp_lda_imm.a
    connect LDA_IMM.out -> cmp_lda_imm.b
    connect cmp_lda_imm.eq -> is_lda_imm

    node cmp_lda_zp: Comparator
    connect current_opcode -> cmp_lda_zp.a
    connect LDA_ZP.out -> cmp_lda_zp.b
    connect cmp_lda_zp.eq -> is_lda_zp

    node cmp_sta_zp: Comparator
    connect current_opcode -> cmp_sta_zp.a
    connect STA_ZP.out -> cmp_sta_zp.b
    connect cmp_sta_zp.eq -> is_sta_zp

    node cmp_tax: Comparator
    connect current_opcode -> cmp_tax.a
    connect TAX.out -> cmp_tax.b
    connect cmp_tax.eq -> is_tax

    node cmp_inx: Comparator
    connect current_opcode -> cmp_inx.a
    connect INX.out -> cmp_inx.b
    connect cmp_inx.eq -> is_inx

    // Determine instruction characteristics
    // Immediate mode: LDA #imm (2-cycle, fetch operand)
    node needs_operand_imm: Or
    connect cmp_lda_imm.eq -> needs_operand_imm.a
    connect cmp_lda_imm.eq -> needs_operand_imm.b  // Dummy for now

    // Zero-page mode: LDA $addr, STA $addr (3-cycle: fetch addr, mem access, execute)
    node is_zp_mode: Or
    connect cmp_lda_zp.eq -> is_zp_mode.a
    connect cmp_sta_zp.eq -> is_zp_mode.b

    // 1-cycle instructions (register ops)
    node is_1cycle: Or
    connect cmp_tax.eq -> is_1cycle.a
    connect cmp_inx.eq -> is_1cycle.b

    // Sub-cycle logic
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)

    node inc_subcycle: Incrementer
    connect subcycle_reg.q -> inc_subcycle.in

    // Increment subcycle ONLY during EXECUTE, reset otherwise
    node subcycle_increment: Mux
    connect is_execute.eq -> subcycle_increment.sel
    connect zero.out -> subcycle_increment.in0
    connect inc_subcycle.out -> subcycle_increment.in1

    connect subcycle_increment.out -> subcycle_reg.data

    node always_on: Constant(value=1)
    connect always_on.out -> subcycle_reg.we

    connect subcycle_reg.q -> exec_subcycle

    // Check which subcycle we're on
    node is_subcycle_0: Comparator
    connect subcycle_reg.q -> is_subcycle_0.a
    connect zero.out -> is_subcycle_0.b

    node is_subcycle_1: Comparator
    connect subcycle_reg.q -> is_subcycle_1.a
    connect one.out -> is_subcycle_1.b

    node is_subcycle_2: Comparator
    connect subcycle_reg.q -> is_subcycle_2.a
    connect two.out -> is_subcycle_2.b

    // State transitions
    node next_from_fetch: Mux
    connect is_fetch.eq -> next_from_fetch.sel
    connect state_reg.q -> next_from_fetch.in0
    connect STATE_DECODE.out -> next_from_fetch.in1

    node next_from_decode: Mux
    connect is_decode.eq -> next_from_decode.sel
    connect next_from_fetch.out -> next_from_decode.in0
    connect STATE_EXECUTE.out -> next_from_decode.in1

    // Execute done conditions
    // Immediate mode (2-byte): done at subcycle 1
    node exec_done_imm: And
    connect is_execute.eq -> exec_done_imm.a
    connect is_subcycle_1.eq -> exec_done_imm.b

    node exec_done_imm_check: And
    connect exec_done_imm.out -> exec_done_imm_check.a
    connect needs_operand_imm.out -> exec_done_imm_check.b

    // Zero-page mode (2-byte): done at subcycle 2
    node exec_done_zp: And
    connect is_execute.eq -> exec_done_zp.a
    connect is_subcycle_2.eq -> exec_done_zp.b

    node exec_done_zp_check: And
    connect exec_done_zp.out -> exec_done_zp_check.a
    connect is_zp_mode.out -> exec_done_zp_check.b

    // 1-cycle: done at subcycle 0
    node exec_done_1cycle: And
    connect is_execute.eq -> exec_done_1cycle.a
    connect is_subcycle_0.eq -> exec_done_1cycle.b

    node exec_done_1cycle_check: And
    connect exec_done_1cycle.out -> exec_done_1cycle_check.a
    connect is_1cycle.out -> exec_done_1cycle_check.b

    // Combine done conditions
    node exec_done_temp: Or
    connect exec_done_imm_check.out -> exec_done_temp.a
    connect exec_done_zp_check.out -> exec_done_temp.b

    node exec_done: Or
    connect exec_done_temp.out -> exec_done.a
    connect exec_done_1cycle_check.out -> exec_done.b

    node next_from_execute: Mux
    connect exec_done.out -> next_from_execute.sel
    connect next_from_decode.out -> next_from_execute.in0
    connect STATE_FETCH.out -> next_from_execute.in1

    // Handle reset
    node next_state: Mux
    connect reset -> next_state.sel
    connect next_from_execute.out -> next_state.in0
    connect STATE_FETCH.out -> next_state.in1

    connect next_state.out -> state_reg.data
    connect always_on.out -> state_reg.we

    connect state_reg.q -> current_state

    // Control signals
    // PC increments during FETCH and EXECUTE subcycle 0 (for multi-byte instructions)
    node exec_subcycle_0: And
    connect is_execute.eq -> exec_subcycle_0.a
    connect is_subcycle_0.eq -> exec_subcycle_0.b

    node needs_operand: Or
    connect needs_operand_imm.out -> needs_operand.a
    connect is_zp_mode.out -> needs_operand.b

    node exec_subcycle_0_needs_operand: And
    connect exec_subcycle_0.out -> exec_subcycle_0_needs_operand.a
    connect needs_operand.out -> exec_subcycle_0_needs_operand.b

    node pc_inc_signal: Or
    connect is_fetch.eq -> pc_inc_signal.a
    connect exec_subcycle_0_needs_operand.out -> pc_inc_signal.b
    connect pc_inc_signal.out -> pc_increment

    // IR loads during FETCH
    connect is_fetch.eq -> ir_load

    // Operand loads during EXECUTE subcycle 0 (for all multi-byte instructions)
    node operand_load_signal: And
    connect exec_subcycle_0.out -> operand_load_signal.a
    connect needs_operand.out -> operand_load_signal.b
    connect operand_load_signal.out -> operand_load

    // Address loads during EXECUTE subcycle 0 (for zero-page mode)
    node addr_load_signal: And
    connect exec_subcycle_0.out -> addr_load_signal.a
    connect is_zp_mode.out -> addr_load_signal.b
    connect addr_load_signal.out -> addr_load

    // Memory read during EXECUTE subcycle 1 (for LDA zero-page)
    node exec_subcycle_1: And
    connect is_execute.eq -> exec_subcycle_1.a
    connect is_subcycle_1.eq -> exec_subcycle_1.b

    node mem_read_signal: And
    connect exec_subcycle_1.out -> mem_read_signal.a
    connect cmp_lda_zp.eq -> mem_read_signal.b
    connect mem_read_signal.out -> mem_read

    // Memory write during EXECUTE subcycle 1 (for STA zero-page)
    node mem_write_signal: And
    connect exec_subcycle_1.out -> mem_write_signal.a
    connect cmp_sta_zp.eq -> mem_write_signal.b
    connect mem_write_signal.out -> mem_write

    // Register writes
    // A register writes during:
    // - EXECUTE subcycle 1 for LDA #imm (immediate)
    // - EXECUTE subcycle 2 for LDA $addr (zero-page)
    node write_a_imm: And
    connect exec_subcycle_1.out -> write_a_imm.a
    connect cmp_lda_imm.eq -> write_a_imm.b

    node exec_subcycle_2: And
    connect is_execute.eq -> exec_subcycle_2.a
    connect is_subcycle_2.eq -> exec_subcycle_2.b

    node write_a_zp: And
    connect exec_subcycle_2.out -> write_a_zp.a
    connect cmp_lda_zp.eq -> write_a_zp.b

    node write_a_signal: Or
    connect write_a_imm.out -> write_a_signal.a
    connect write_a_zp.out -> write_a_signal.b
    connect write_a_signal.out -> write_a

    // X register writes during TAX, INX
    node write_x_tax: And
    connect exec_subcycle_0.out -> write_x_tax.a
    connect cmp_tax.eq -> write_x_tax.b

    node write_x_inx: And
    connect exec_subcycle_0.out -> write_x_inx.a
    connect cmp_inx.eq -> write_x_inx.b

    node write_x_signal: Or
    connect write_x_tax.out -> write_x_signal.a
    connect write_x_inx.out -> write_x_signal.b
    connect write_x_signal.out -> write_x

    // Y register (no writes in this subset)
    connect zero.out -> write_y
  }
}

// === CPU with Memory ===
circuit MemoryCPU {
  input reset: Bit

  output pc: Bus[8]
  output instruction: Bus[8]
  output operand: Bus[8]
  output address: Bus[8]
  output mem_data: Bus[8]
  output current_state: Bus[8]
  output subcycle: Bus[8]
  output reg_a: Bus[8]
  output reg_x: Bus[8]

  clock clk

  impl {
    // Program counter
    node pc_reg: Register
    connect clk -> pc_reg.clk
    node always_on: Constant(value=1)
    connect always_on.out -> pc_reg.we

    node pc_inc: Incrementer
    connect pc_reg.q -> pc_inc.in

    // ROM with test program
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)
    node four: Constant(value=4)
    node five: Constant(value=5)
    node six: Constant(value=6)
    node seven: Constant(value=7)
    node eight: Constant(value=8)

    node at_0: Comparator
    connect pc_reg.q -> at_0.a
    connect zero.out -> at_0.b

    node at_1: Comparator
    connect pc_reg.q -> at_1.a
    connect one.out -> at_1.b

    node at_2: Comparator
    connect pc_reg.q -> at_2.a
    connect two.out -> at_2.b

    node at_3: Comparator
    connect pc_reg.q -> at_3.a
    connect three.out -> at_3.b

    node at_4: Comparator
    connect pc_reg.q -> at_4.a
    connect four.out -> at_4.b

    node at_5: Comparator
    connect pc_reg.q -> at_5.a
    connect five.out -> at_5.b

    node at_6: Comparator
    connect pc_reg.q -> at_6.a
    connect six.out -> at_6.b

    node at_7: Comparator
    connect pc_reg.q -> at_7.a
    connect seven.out -> at_7.b

    node at_8: Comparator
    connect pc_reg.q -> at_8.a
    connect eight.out -> at_8.b

    // Program: A9 42 85 10 A5 10 AA E8 (LDA #$42, STA $10, LDA $10, TAX, INX)
    node byte_0: Constant(value=169)  // A9 - LDA #imm
    node byte_1: Constant(value=66)   // 42 - operand
    node byte_2: Constant(value=133)  // 85 - STA zero-page
    node byte_3: Constant(value=16)   // 10 - address
    node byte_4: Constant(value=165)  // A5 - LDA zero-page
    node byte_5: Constant(value=16)   // 10 - address
    node byte_6: Constant(value=170)  // AA - TAX
    node byte_7: Constant(value=232)  // E8 - INX
    node byte_8: Constant(value=0)    // padding

    node mux1: Mux
    connect at_1.eq -> mux1.sel
    connect byte_0.out -> mux1.in0
    connect byte_1.out -> mux1.in1

    node mux2: Mux
    connect at_2.eq -> mux2.sel
    connect mux1.out -> mux2.in0
    connect byte_2.out -> mux2.in1

    node mux3: Mux
    connect at_3.eq -> mux3.sel
    connect mux2.out -> mux3.in0
    connect byte_3.out -> mux3.in1

    node mux4: Mux
    connect at_4.eq -> mux4.sel
    connect mux3.out -> mux4.in0
    connect byte_4.out -> mux4.in1

    node mux5: Mux
    connect at_5.eq -> mux5.sel
    connect mux4.out -> mux5.in0
    connect byte_5.out -> mux5.in1

    node mux6: Mux
    connect at_6.eq -> mux6.sel
    connect mux5.out -> mux6.in0
    connect byte_6.out -> mux6.in1

    node mux7: Mux
    connect at_7.eq -> mux7.sel
    connect mux6.out -> mux7.in0
    connect byte_7.out -> mux7.in1

    node mux8: Mux
    connect at_8.eq -> mux8.sel
    connect mux7.out -> mux8.in0
    connect byte_8.out -> mux8.in1

    // Instruction register
    node ir: Register
    connect clk -> ir.clk
    connect mux8.out -> ir.data

    // Operand register (stores immediate operands and addresses)
    node operand_reg: Register
    connect clk -> operand_reg.clk
    connect mux8.out -> operand_reg.data

    // Address register (for zero-page addresses)
    // Loads directly from ROM on same cycle as operand_reg
    node addr_reg: Register
    connect clk -> addr_reg.clk
    connect mux8.out -> addr_reg.data

    // Control FSM
    node control: MemoryControl
    connect clk -> control.clk
    connect reset -> control.reset
    connect ir.q -> control.current_opcode

    // PC control
    node pc_next: Mux
    connect control.pc_increment -> pc_next.sel
    connect pc_reg.q -> pc_next.in0
    connect pc_inc.out -> pc_next.in1

    connect pc_next.out -> pc_reg.data

    // IR, operand, and address load control
    connect control.ir_load -> ir.we
    connect control.operand_load -> operand_reg.we
    connect control.addr_load -> addr_reg.we

    // Memory
    node memory: SimpleMemory
    connect clk -> memory.clk
    connect addr_reg.q -> memory.addr
    connect control.mem_write -> memory.write_enable

    // Register file
    node registers: RegisterFile
    connect clk -> registers.clk
    connect control.write_a -> registers.write_a
    connect control.write_x -> registers.write_x
    connect control.write_y -> registers.write_y

    // Memory data input (for writes)
    connect registers.reg_a -> memory.data_in

    // Incrementer for INX
    node inc_x: Incrementer
    connect registers.reg_x -> inc_x.in

    // Data source for A register
    // LDA #imm: from operand register
    // LDA $addr: from memory
    node result_a: Mux
    connect control.is_lda_zp -> result_a.sel
    connect operand_reg.q -> result_a.in0        // Immediate (from operand reg)
    connect memory.data_out -> result_a.in1 // Zero-page (from memory)

    connect result_a.out -> registers.data_a

    // Data source for X register
    // TAX: from A, INX: increment
    node result_x: Mux
    connect control.is_tax -> result_x.sel
    connect inc_x.out -> result_x.in0        // INX
    connect registers.reg_a -> result_x.in1  // TAX

    connect result_x.out -> registers.data_x

    // Dummy for Y (not used)
    connect zero.out -> registers.data_y

    // Outputs
    connect pc_reg.q -> pc
    connect ir.q -> instruction
    connect addr_reg.q -> address
    connect memory.data_out -> mem_data
    connect control.current_state -> current_state
    connect control.exec_subcycle -> subcycle
    connect registers.reg_a -> reg_a
    connect registers.reg_x -> reg_x
  }
}

// === TEST CIRCUIT ===
circuit MemoryTest {
  clock clk

  impl {
    node cpu: MemoryCPU
    connect clk -> cpu.clk

    node reset_input: Input
    connect reset_input.out -> cpu.reset

    node d_pc: HexDisplay
    connect cpu.pc -> d_pc.in

    node d_instruction: HexDisplay
    connect cpu.instruction -> d_instruction.in

    node d_address: HexDisplay
    connect cpu.address -> d_address.in

    node d_mem_data: HexDisplay
    connect cpu.mem_data -> d_mem_data.in

    node d_state: HexDisplay
    connect cpu.current_state -> d_state.in

    node d_subcycle: HexDisplay
    connect cpu.subcycle -> d_subcycle.in

    node d_a: HexDisplay
    connect cpu.reg_a -> d_a.in

    node d_x: HexDisplay
    connect cpu.reg_x -> d_x.in
  }
}

// Stage 3 Phase 1: X and Y Registers with Register Operations
// Adds X and Y registers to the CPU
// New instructions: TAX, TAY, TXA, TYA, INX, DEX, INY, DEY

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
// Adds support for register operations
circuit Stage3Control {
  input reset: Bit
  input current_opcode: Bus[8]

  output current_state: Bus[8]
  output exec_subcycle: Bus[8]
  output pc_increment: Bit
  output ir_load: Bit
  output operand_load: Bit

  // Register write controls
  output write_a: Bit
  output write_x: Bit
  output write_y: Bit

  // Instruction decode
  output is_lda: Bit
  output is_adc: Bit
  output is_tax: Bit
  output is_tay: Bit
  output is_txa: Bit
  output is_tya: Bit
  output is_inx: Bit
  output is_dex: Bit
  output is_iny: Bit
  output is_dey: Bit

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
    node ADC_IMM: Constant(value=105)  // 69
    node TAX: Constant(value=170)      // AA
    node TAY: Constant(value=168)      // A8
    node TXA: Constant(value=138)      // 8A
    node TYA: Constant(value=152)      // 98
    node INX: Constant(value=232)      // E8
    node DEX: Constant(value=202)      // CA
    node INY: Constant(value=200)      // C8
    node DEY: Constant(value=136)      // 88

    node cmp_lda: Comparator
    connect current_opcode -> cmp_lda.a
    connect LDA_IMM.out -> cmp_lda.b
    connect cmp_lda.eq -> is_lda

    node cmp_adc: Comparator
    connect current_opcode -> cmp_adc.a
    connect ADC_IMM.out -> cmp_adc.b
    connect cmp_adc.eq -> is_adc

    node cmp_tax: Comparator
    connect current_opcode -> cmp_tax.a
    connect TAX.out -> cmp_tax.b
    connect cmp_tax.eq -> is_tax

    node cmp_tay: Comparator
    connect current_opcode -> cmp_tay.a
    connect TAY.out -> cmp_tay.b
    connect cmp_tay.eq -> is_tay

    node cmp_txa: Comparator
    connect current_opcode -> cmp_txa.a
    connect TXA.out -> cmp_txa.b
    connect cmp_txa.eq -> is_txa

    node cmp_tya: Comparator
    connect current_opcode -> cmp_tya.a
    connect TYA.out -> cmp_tya.b
    connect cmp_tya.eq -> is_tya

    node cmp_inx: Comparator
    connect current_opcode -> cmp_inx.a
    connect INX.out -> cmp_inx.b
    connect cmp_inx.eq -> is_inx

    node cmp_dex: Comparator
    connect current_opcode -> cmp_dex.a
    connect DEX.out -> cmp_dex.b
    connect cmp_dex.eq -> is_dex

    node cmp_iny: Comparator
    connect current_opcode -> cmp_iny.a
    connect INY.out -> cmp_iny.b
    connect cmp_iny.eq -> is_iny

    node cmp_dey: Comparator
    connect current_opcode -> cmp_dey.a
    connect DEY.out -> cmp_dey.b
    connect cmp_dey.eq -> is_dey

    // Determine if instruction needs operand (2-cycle) or not (1-cycle)
    node needs_operand: Or
    connect cmp_lda.eq -> needs_operand.a
    connect cmp_adc.eq -> needs_operand.b

    // Sub-cycle logic
    node zero: Constant(value=0)
    node one: Constant(value=1)

    node inc_subcycle: Incrementer
    connect subcycle_reg.q -> inc_subcycle.in

    // Increment subcycle ONLY during EXECUTE, reset otherwise
    node subcycle_increment: Mux
    connect is_execute.eq -> subcycle_increment.sel
    connect zero.out -> subcycle_increment.in0       // Not EXECUTE: reset to 0
    connect inc_subcycle.out -> subcycle_increment.in1  // EXECUTE: increment

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

    // State transitions
    // FETCH -> DECODE
    node next_from_fetch: Mux
    connect is_fetch.eq -> next_from_fetch.sel
    connect state_reg.q -> next_from_fetch.in0
    connect STATE_DECODE.out -> next_from_fetch.in1

    // DECODE -> EXECUTE
    node next_from_decode: Mux
    connect is_decode.eq -> next_from_decode.sel
    connect next_from_fetch.out -> next_from_decode.in0
    connect STATE_EXECUTE.out -> next_from_decode.in1

    // EXECUTE -> FETCH
    // For 2-cycle instructions (need operand): stay until subcycle 1
    // For 1-cycle instructions (no operand): exit immediately at subcycle 0
    node exec_done_2cycle: And
    connect is_execute.eq -> exec_done_2cycle.a
    connect is_subcycle_1.eq -> exec_done_2cycle.b

    node exec_done_1cycle: And
    connect is_execute.eq -> exec_done_1cycle.a
    connect is_subcycle_0.eq -> exec_done_1cycle.b

    // Check if this is a 1-cycle instruction (register ops)
    node is_1cycle: Or
    connect cmp_tax.eq -> is_1cycle.a
    connect cmp_tay.eq -> is_1cycle.b

    node is_1cycle_2: Or
    connect is_1cycle.out -> is_1cycle_2.a
    connect cmp_txa.eq -> is_1cycle_2.b

    node is_1cycle_3: Or
    connect is_1cycle_2.out -> is_1cycle_3.a
    connect cmp_tya.eq -> is_1cycle_3.b

    node is_1cycle_4: Or
    connect is_1cycle_3.out -> is_1cycle_4.a
    connect cmp_inx.eq -> is_1cycle_4.b

    node is_1cycle_5: Or
    connect is_1cycle_4.out -> is_1cycle_5.a
    connect cmp_dex.eq -> is_1cycle_5.b

    node is_1cycle_6: Or
    connect is_1cycle_5.out -> is_1cycle_6.a
    connect cmp_iny.eq -> is_1cycle_6.b

    node is_1cycle_final: Or
    connect is_1cycle_6.out -> is_1cycle_final.a
    connect cmp_dey.eq -> is_1cycle_final.b

    // Exec done if: (2-cycle AND subcycle=1) OR (1-cycle AND subcycle=0)
    node exec_done_1cycle_check: And
    connect exec_done_1cycle.out -> exec_done_1cycle_check.a
    connect is_1cycle_final.out -> exec_done_1cycle_check.b

    node exec_done: Or
    connect exec_done_2cycle.out -> exec_done.a
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
    // PC increments during FETCH and during EXECUTE subcycle 0 (for 2-cycle instructions)
    node exec_subcycle_0: And
    connect is_execute.eq -> exec_subcycle_0.a
    connect is_subcycle_0.eq -> exec_subcycle_0.b

    node exec_subcycle_0_needs_operand: And
    connect exec_subcycle_0.out -> exec_subcycle_0_needs_operand.a
    connect needs_operand.out -> exec_subcycle_0_needs_operand.b

    node pc_inc_signal: Or
    connect is_fetch.eq -> pc_inc_signal.a
    connect exec_subcycle_0_needs_operand.out -> pc_inc_signal.b
    connect pc_inc_signal.out -> pc_increment

    // IR loads during FETCH
    connect is_fetch.eq -> ir_load

    // Operand loads during EXECUTE subcycle 0 (for 2-cycle instructions)
    node operand_load_signal: And
    connect exec_subcycle_0.out -> operand_load_signal.a
    connect needs_operand.out -> operand_load_signal.b
    connect operand_load_signal.out -> operand_load

    // Register writes
    // A register writes during:
    // - EXECUTE subcycle 1 for LDA/ADC (2-cycle)
    // - EXECUTE subcycle 0 for TXA/TYA (1-cycle)
    node exec_subcycle_1: And
    connect is_execute.eq -> exec_subcycle_1.a
    connect is_subcycle_1.eq -> exec_subcycle_1.b

    node write_a_2cycle: And
    connect exec_subcycle_1.out -> write_a_2cycle.a
    connect needs_operand.out -> write_a_2cycle.b

    node write_a_txa: And
    connect exec_subcycle_0.out -> write_a_txa.a
    connect cmp_txa.eq -> write_a_txa.b

    node write_a_tya: And
    connect exec_subcycle_0.out -> write_a_tya.a
    connect cmp_tya.eq -> write_a_tya.b

    node write_a_transfer: Or
    connect write_a_txa.out -> write_a_transfer.a
    connect write_a_tya.out -> write_a_transfer.b

    node write_a_signal: Or
    connect write_a_2cycle.out -> write_a_signal.a
    connect write_a_transfer.out -> write_a_signal.b
    connect write_a_signal.out -> write_a

    // X register writes during:
    // - EXECUTE subcycle 0 for TAX (1-cycle)
    // - EXECUTE subcycle 0 for INX (1-cycle)
    // - EXECUTE subcycle 0 for DEX (1-cycle)
    node write_x_tax: And
    connect exec_subcycle_0.out -> write_x_tax.a
    connect cmp_tax.eq -> write_x_tax.b

    node write_x_inx: And
    connect exec_subcycle_0.out -> write_x_inx.a
    connect cmp_inx.eq -> write_x_inx.b

    node write_x_dex: And
    connect exec_subcycle_0.out -> write_x_dex.a
    connect cmp_dex.eq -> write_x_dex.b

    node write_x_temp: Or
    connect write_x_tax.out -> write_x_temp.a
    connect write_x_inx.out -> write_x_temp.b

    node write_x_signal: Or
    connect write_x_temp.out -> write_x_signal.a
    connect write_x_dex.out -> write_x_signal.b
    connect write_x_signal.out -> write_x

    // Y register writes during:
    // - EXECUTE subcycle 0 for TAY (1-cycle)
    // - EXECUTE subcycle 0 for INY (1-cycle)
    // - EXECUTE subcycle 0 for DEY (1-cycle)
    node write_y_tay: And
    connect exec_subcycle_0.out -> write_y_tay.a
    connect cmp_tay.eq -> write_y_tay.b

    node write_y_iny: And
    connect exec_subcycle_0.out -> write_y_iny.a
    connect cmp_iny.eq -> write_y_iny.b

    node write_y_dey: And
    connect exec_subcycle_0.out -> write_y_dey.a
    connect cmp_dey.eq -> write_y_dey.b

    node write_y_temp: Or
    connect write_y_tay.out -> write_y_temp.a
    connect write_y_iny.out -> write_y_temp.b

    node write_y_signal: Or
    connect write_y_temp.out -> write_y_signal.a
    connect write_y_dey.out -> write_y_signal.b
    connect write_y_signal.out -> write_y
  }
}

// === CPU with X/Y Registers ===
circuit Stage3CPU {
  input reset: Bit

  output pc: Bus[8]
  output instruction: Bus[8]
  output operand: Bus[8]
  output current_state: Bus[8]
  output subcycle: Bus[8]
  output reg_a: Bus[8]
  output reg_x: Bus[8]
  output reg_y: Bus[8]

  clock clk

  impl {
    // Program counter (simplified - just low byte for now)
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

    // Program: A9 42 AA E8 98 (LDA #$42, TAX, INX, TYA)
    node byte_0: Constant(value=169)  // A9 - LDA #imm
    node byte_1: Constant(value=66)   // 42 - operand
    node byte_2: Constant(value=170)  // AA - TAX
    node byte_3: Constant(value=232)  // E8 - INX
    node byte_4: Constant(value=152)  // 98 - TYA
    node byte_5: Constant(value=0)    // padding
    node byte_6: Constant(value=0)    // padding
    node byte_7: Constant(value=0)    // padding

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

    // Instruction register
    node ir: Register
    connect clk -> ir.clk
    connect mux7.out -> ir.data

    // Operand register
    node operand_reg: Register
    connect clk -> operand_reg.clk
    connect mux7.out -> operand_reg.data

    // Control FSM
    node control: Stage3Control
    connect clk -> control.clk
    connect reset -> control.reset
    connect ir.q -> control.current_opcode

    // PC control
    node pc_next: Mux
    connect control.pc_increment -> pc_next.sel
    connect pc_reg.q -> pc_next.in0
    connect pc_inc.out -> pc_next.in1

    connect pc_next.out -> pc_reg.data

    // IR and operand load control
    connect control.ir_load -> ir.we
    connect control.operand_load -> operand_reg.we

    // Register file
    node registers: RegisterFile
    connect clk -> registers.clk
    connect control.write_a -> registers.write_a
    connect control.write_x -> registers.write_x
    connect control.write_y -> registers.write_y

    // ALU
    node adder: Adder
    connect registers.reg_a -> adder.a
    connect operand_reg.q -> adder.b
    connect zero.out -> adder.carry_in

    // Incrementer for INX
    node inc_x: Incrementer
    connect registers.reg_x -> inc_x.in

    // Decrementer for DEX (implemented as subtractor)
    node dec_x: Subtractor
    connect registers.reg_x -> dec_x.a
    connect one.out -> dec_x.b
    connect zero.out -> dec_x.borrow_in

    // Incrementer for INY
    node inc_y: Incrementer
    connect registers.reg_y -> inc_y.in

    // Decrementer for DEY
    node dec_y: Subtractor
    connect registers.reg_y -> dec_y.a
    connect one.out -> dec_y.b
    connect zero.out -> dec_y.borrow_in

    // Data source for A register
    // LDA: operand, ADC: adder result
    node result_a_lda_adc: Mux
    connect control.is_lda -> result_a_lda_adc.sel
    connect adder.sum -> result_a_lda_adc.in0        // ADC
    connect operand_reg.q -> result_a_lda_adc.in1    // LDA

    // TXA: X register, TYA: Y register, otherwise result_a_lda_adc
    node result_a_txa: Mux
    connect control.is_txa -> result_a_txa.sel
    connect result_a_lda_adc.out -> result_a_txa.in0
    connect registers.reg_x -> result_a_txa.in1

    node result_a: Mux
    connect control.is_tya -> result_a.sel
    connect result_a_txa.out -> result_a.in0
    connect registers.reg_y -> result_a.in1

    connect result_a.out -> registers.data_a

    // Data source for X register
    // TAX: A register, INX: incremented X, DEX: decremented X
    node result_x_inx_dex: Mux
    connect control.is_dex -> result_x_inx_dex.sel
    connect inc_x.out -> result_x_inx_dex.in0        // INX (default)
    connect dec_x.difference -> result_x_inx_dex.in1 // DEX

    node result_x: Mux
    connect control.is_tax -> result_x.sel
    connect result_x_inx_dex.out -> result_x.in0  // INX or DEX
    connect registers.reg_a -> result_x.in1       // TAX

    connect result_x.out -> registers.data_x

    // Data source for Y register
    // TAY: A register, INY: incremented Y, DEY: decremented Y
    node result_y_iny_dey: Mux
    connect control.is_dey -> result_y_iny_dey.sel
    connect inc_y.out -> result_y_iny_dey.in0        // INY (default)
    connect dec_y.difference -> result_y_iny_dey.in1 // DEY

    node result_y: Mux
    connect control.is_tay -> result_y.sel
    connect result_y_iny_dey.out -> result_y.in0  // INY or DEY
    connect registers.reg_a -> result_y.in1       // TAY

    connect result_y.out -> registers.data_y

    // Outputs
    connect pc_reg.q -> pc
    connect ir.q -> instruction
    connect operand_reg.q -> operand
    connect control.current_state -> current_state
    connect control.exec_subcycle -> subcycle
    connect registers.reg_a -> reg_a
    connect registers.reg_x -> reg_x
    connect registers.reg_y -> reg_y
  }
}

// === TEST CIRCUIT ===
circuit Stage3XYTest {
  clock clk

  impl {
    node cpu: Stage3CPU
    connect clk -> cpu.clk

    node reset_input: Input
    connect reset_input.out -> cpu.reset

    node d_pc: HexDisplay
    connect cpu.pc -> d_pc.in

    node d_instruction: HexDisplay
    connect cpu.instruction -> d_instruction.in

    node d_operand: HexDisplay
    connect cpu.operand -> d_operand.in

    node d_state: HexDisplay
    connect cpu.current_state -> d_state.in

    node d_subcycle: HexDisplay
    connect cpu.subcycle -> d_subcycle.in

    node d_a: HexDisplay
    connect cpu.reg_a -> d_a.in

    node d_x: HexDisplay
    connect cpu.reg_x -> d_x.in

    node d_y: HexDisplay
    connect cpu.reg_y -> d_y.in
  }
}

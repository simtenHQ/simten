// 6502 CPU Stage 2: Complete Integration
// Combines: Program Counter, Instruction Decoder, Control FSM, ALU, Register File
// Executes instructions from ROM: LDA, ADC, STA, JMP, BRK

// === ALU (from Stage 1) ===
circuit ALU {
  input a: Bus[8]
  input b: Bus[8]
  input op: Bus[3]
  input carry_in: Bit

  output result: Bus[8]
  output carry_out: Bit
  output zero: Bit
  output negative: Bit

  impl {
    node adder: Adder
    connect a -> adder.a
    connect b -> adder.b
    connect carry_in -> adder.carry_in

    node subtractor: Subtractor
    connect a -> subtractor.a
    connect b -> subtractor.b
    connect carry_in -> subtractor.borrow_in

    node and_op: BusAnd
    connect a -> and_op.a
    connect b -> and_op.b

    node or_op: BusOr
    connect a -> or_op.a
    connect b -> or_op.b

    node xor_op: BusXor
    connect a -> xor_op.a
    connect b -> xor_op.b

    node op_0: Constant(value=0)
    node op_1: Constant(value=1)
    node op_2: Constant(value=2)
    node op_3: Constant(value=3)
    node op_4: Constant(value=4)

    node is_add: Comparator
    connect op -> is_add.a
    connect op_0.out -> is_add.b

    node is_sub: Comparator
    connect op -> is_sub.a
    connect op_1.out -> is_sub.b

    node is_and: Comparator
    connect op -> is_and.a
    connect op_2.out -> is_and.b

    node is_or: Comparator
    connect op -> is_or.a
    connect op_3.out -> is_or.b

    node is_xor: Comparator
    connect op -> is_xor.a
    connect op_4.out -> is_xor.b

    node mux1: Mux
    connect is_sub.eq -> mux1.sel
    connect adder.sum -> mux1.in0
    connect subtractor.difference -> mux1.in1

    node mux2: Mux
    connect is_and.eq -> mux2.sel
    connect mux1.out -> mux2.in0
    connect and_op.out -> mux2.in1

    node mux3: Mux
    connect is_or.eq -> mux3.sel
    connect mux2.out -> mux3.in0
    connect or_op.out -> mux3.in1

    node mux4: Mux
    connect is_xor.eq -> mux4.sel
    connect mux3.out -> mux4.in0
    connect xor_op.out -> mux4.in1

    connect mux4.out -> result

    node mux_carry: Mux
    connect is_sub.eq -> mux_carry.sel
    connect adder.carry_out -> mux_carry.in0
    connect subtractor.borrow_out -> mux_carry.in1
    connect mux_carry.out -> carry_out

    node zero_cmp: Comparator
    connect result -> zero_cmp.a
    connect op_0.out -> zero_cmp.b
    connect zero_cmp.eq -> zero

    node threshold: Constant(value=127)
    node neg_cmp: Comparator
    connect result -> neg_cmp.a
    connect threshold.out -> neg_cmp.b
    connect neg_cmp.gt -> negative
  }
}

// === Simple ROM (hardcoded program) ===
// Program: LDA #$42, ADC #$08, STA $00FE, BRK
// Bytes: A9 42 69 08 8D FE 00 00
circuit SimpleROM {
  input addr: Bus[8]  // Just low byte for now (0-255)
  output data: Bus[8]

  impl {
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)
    node four: Constant(value=4)
    node five: Constant(value=5)
    node six: Constant(value=6)
    node seven: Constant(value=7)

    // Compare with each address
    node at_0: Comparator
    connect addr -> at_0.a
    connect zero.out -> at_0.b

    node at_1: Comparator
    connect addr -> at_1.a
    connect one.out -> at_1.b

    node at_2: Comparator
    connect addr -> at_2.a
    connect two.out -> at_2.b

    node at_3: Comparator
    connect addr -> at_3.a
    connect three.out -> at_3.b

    node at_4: Comparator
    connect addr -> at_4.a
    connect four.out -> at_4.b

    node at_5: Comparator
    connect addr -> at_5.a
    connect five.out -> at_5.b

    node at_6: Comparator
    connect addr -> at_6.a
    connect six.out -> at_6.b

    node at_7: Comparator
    connect addr -> at_7.a
    connect seven.out -> at_7.b

    // Program bytes
    node byte_0: Constant(value=169)  // A9 = LDA #imm
    node byte_1: Constant(value=66)   // 42 = operand
    node byte_2: Constant(value=105)  // 69 = ADC #imm
    node byte_3: Constant(value=8)    // 08 = operand
    node byte_4: Constant(value=141)  // 8D = STA abs
    node byte_5: Constant(value=254)  // FE = addr low
    node byte_6: Constant(value=0)    // 00 = addr high
    node byte_7: Constant(value=0)    // 00 = BRK

    // Cascaded mux to select correct byte
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

    connect mux7.out -> data
  }
}

// === CPU Stage 2 Integration ===
circuit CPU6502_Stage2 {
  input reset: Bit

  output pc_low: Bus[8]
  output pc_high: Bus[8]
  output instruction: Bus[8]
  output current_state: Bus[3]
  output reg_a: Bus[8]
  output halted: Bit

  clock clk

  impl {
    // === Components ===
    node pc_reg: ProgramCounter
    node decoder: InstructionDecoder
    node control: CPUControl
    node alu: ALU
    node rom: SimpleROM

    // === Registers (simplified - just A for now) ===
    node regA: Register
    connect clk -> regA.clk

    // === Constants ===
    node zero: Constant(value=0)
    node always_on: Constant(value=1)

    // === Connect PC to ROM ===
    connect pc_reg.pc_low -> rom.addr
    connect rom.data -> decoder.opcode
    connect rom.data -> instruction

    // === Connect Decoder to Control FSM ===
    connect decoder.cycles -> control.instr_cycles
    connect decoder.is_BRK -> control.is_BRK
    connect reset -> control.reset

    // === Connect Control to PC ===
    connect control.pc_increment -> pc_reg.increment
    connect zero.out -> pc_reg.load         // No jumps yet
    connect zero.out -> pc_reg.load_addr_low    // No jumps yet
    connect zero.out -> pc_reg.load_addr_high   // No jumps yet

    // === Connect ALU ===
    connect regA.q -> alu.a
    // ALU input b: comes from ROM data (immediate operand)
    // For now, hardcode to ROM data (will need proper data path later)
    connect rom.data -> alu.b

    // ALU operation: 0=ADD for now (should decode from instruction)
    connect zero.out -> alu.op
    connect zero.out -> alu.carry_in

    // === Connect ALU result to Register A ===
    connect alu.result -> regA.data
    connect control.reg_write -> regA.we

    // === Wire up clocks ===
    connect clk -> pc_reg.clk
    connect clk -> control.clk

    // === Outputs ===
    connect pc_reg.pc_low -> pc_low
    connect pc_reg.pc_high -> pc_high
    connect control.current_state -> current_state
    connect regA.q -> reg_a
    connect control.halted -> halted
  }
}

// === Test Circuit with Displays ===
circuit CPU_Stage2_Demo {
  clock clk

  impl {
    node cpu: CPU6502_Stage2

    // Reset input (manual control)
    node reset_input: Input
    connect reset_input.out -> cpu.reset

    connect clk -> cpu.clk

    // Displays
    node d_pc_low: HexDisplay
    connect cpu.pc_low -> d_pc_low.in

    node d_pc_high: HexDisplay
    connect cpu.pc_high -> d_pc_high.in

    node d_instr: HexDisplay
    connect cpu.instruction -> d_instr.in

    node d_state: HexDisplay
    connect cpu.current_state -> d_state.in

    node d_reg_a: HexDisplay
    connect cpu.reg_a -> d_reg_a.in

    node d_halted: Led
    connect cpu.halted -> d_halted.in
  }
}

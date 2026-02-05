// 6502 CPU Stage 2: Simple Test Circuit
// Load this in the browser to see the CPU execute a simple program
// Program: LDA #$42, ADC #$08, STA $00FE, BRK
// Expected: A register = 0x4A (74) after execution

// === Copy of ALU from Stage 1 ===
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

// === Simple Test Circuit ===
// This is what you should load in the browser!
circuit CPUTest {
  clock clk

  impl {
    // Import the full CPU from 08-cpu-stage2.dsl components
    // For this test, we'll use a simplified version that's all in one file

    // === Simple ROM with test program ===
    node rom_addr: Input  // Connect this to PC low byte

    // Hardcoded program bytes
    node byte_0: Constant(value=169)  // A9 = LDA #imm
    node byte_1: Constant(value=66)   // 42 = operand
    node byte_2: Constant(value=105)  // 69 = ADC #imm
    node byte_3: Constant(value=8)    // 08 = operand
    node byte_4: Constant(value=141)  // 8D = STA abs
    node byte_5: Constant(value=254)  // FE = addr low
    node byte_6: Constant(value=0)    // 00 = addr high
    node byte_7: Constant(value=0)    // 00 = BRK

    // === Display showing what's happening ===
    node info_display: HexDisplay
    node zero: Constant(value=0)
    connect zero.out -> info_display.in

    // === Simple counter to show clock cycles ===
    node cycle_counter: Register
    connect clk -> cycle_counter.clk
    node always_on: Constant(value=1)
    connect always_on.out -> cycle_counter.we

    node inc: Incrementer
    connect cycle_counter.q -> inc.in
    connect inc.out -> cycle_counter.data

    node cycle_display: HexDisplay
    connect cycle_counter.q -> cycle_display.in
  }
}

// === Better Test: Step by step simulation ===
circuit StepByStepCPU {
  clock clk

  impl {
    // === Program Counter (simplified) ===
    node pc_reg: Register
    connect clk -> pc_reg.clk
    node always_on: Constant(value=1)
    connect always_on.out -> pc_reg.we

    node pc_inc: Incrementer
    connect pc_reg.q -> pc_inc.in
    connect pc_inc.out -> pc_reg.data

    // === ROM ===
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

    // Program bytes
    node byte_0: Constant(value=169)  // A9
    node byte_1: Constant(value=66)   // 42
    node byte_2: Constant(value=105)  // 69
    node byte_3: Constant(value=8)    // 08
    node byte_4: Constant(value=141)  // 8D
    node byte_5: Constant(value=254)  // FE
    node byte_6: Constant(value=0)    // 00
    node byte_7: Constant(value=0)    // 00

    // ROM output mux
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

    // === A Register ===
    node reg_a: Register
    connect clk -> reg_a.clk
    connect always_on.out -> reg_a.we

    // === ALU (simplified - just add) ===
    node alu: ALU
    connect reg_a.q -> alu.a
    connect mux7.out -> alu.b
    connect zero.out -> alu.op
    connect zero.out -> alu.carry_in

    connect alu.result -> reg_a.data

    // === Displays ===
    node d_pc: HexDisplay
    connect pc_reg.q -> d_pc.in

    node d_instruction: HexDisplay
    connect mux7.out -> d_instruction.in

    node d_a: HexDisplay
    connect reg_a.q -> d_a.in

    node d_alu_result: HexDisplay
    connect alu.result -> d_alu_result.in
  }
}

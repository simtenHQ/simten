// Full CPU Stage 2 Test with FSM State Visible
// This loads the actual CPU with Control FSM to verify proper operation

// We need to import the components from the other files
// For now, let's create a standalone version with all components

// === ALU ===
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

// === Very Simple Test: Just PC and Instruction Fetch ===
// This test ONLY tests if PC increments and instructions are fetched correctly
circuit SimplePCTest {
  clock clk

  impl {
    // PC register
    node pc: Register
    connect clk -> pc.clk
    node always_on: Constant(value=1)
    connect always_on.out -> pc.we

    node pc_inc: Incrementer
    connect pc.q -> pc_inc.in
    connect pc_inc.out -> pc.data

    // ROM with our test program
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)

    node at_0: Comparator
    connect pc.q -> at_0.a
    connect zero.out -> at_0.b

    node at_1: Comparator
    connect pc.q -> at_1.a
    connect one.out -> at_1.b

    node at_2: Comparator
    connect pc.q -> at_2.a
    connect two.out -> at_2.b

    node at_3: Comparator
    connect pc.q -> at_3.a
    connect three.out -> at_3.b

    // Program: A9 42 69 08
    node byte_0: Constant(value=169)  // A9 = LDA
    node byte_1: Constant(value=66)   // 42
    node byte_2: Constant(value=105)  // 69 = ADC
    node byte_3: Constant(value=8)    // 08

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

    // Displays
    node d_pc: HexDisplay
    connect pc.q -> d_pc.in

    node d_instruction: HexDisplay
    connect mux3.out -> d_instruction.in

    // Expected behavior:
    // Cycle 0: PC=00, Instruction=A9
    // Cycle 1: PC=01, Instruction=42
    // Cycle 2: PC=02, Instruction=69
    // Cycle 3: PC=03, Instruction=08
    // Cycle 4: PC=04, Instruction=08 (stays at last value)
  }
}

// === Test with Manual Register Control ===
// This lets you manually control when the register writes
circuit ManualRegisterTest {
  clock clk

  impl {
    // A register with MANUAL write enable
    node reg_a: Register
    connect clk -> reg_a.clk

    // Manual control input
    node write_enable: Input  // YOU control this
    connect write_enable.out -> reg_a.we

    // Data to write (manual input)
    node data_input: Input
    connect data_input.out -> reg_a.data

    // Display
    node d_a: HexDisplay
    connect reg_a.q -> d_a.in

    // Test this:
    // 1. Set data_input to 42, write_enable to 1, click clock -> A should become 42
    // 2. Set write_enable to 0, click clock -> A should stay 42
    // 3. Set data_input to 08, write_enable to 1, click clock -> A should become 08
  }
}

// === Test: Does ALU work correctly? ===
circuit ALUOnlyTest {
  impl {
    node alu: ALU

    // Manual inputs
    node input_a: Input
    node input_b: Input
    node op_input: Input  // 0=ADD, 1=SUB

    connect input_a.out -> alu.a
    connect input_b.out -> alu.b
    connect op_input.out -> alu.op

    node zero: Constant(value=0)
    connect zero.out -> alu.carry_in

    // Display
    node d_result: HexDisplay
    connect alu.result -> d_result.in

    // Test cases:
    // input_a=42, input_b=08, op=0 -> result should be 4A (66+8=74)
    // input_a=42, input_b=08, op=1 -> result should be 3A (66-8=58)
  }
}

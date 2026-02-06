// Stage 3.1: CPU with Proper Instruction Execution
// This CPU properly distinguishes opcodes from operands
// LDA loads, ADC adds - they don't both just add!

// === Instruction Register ===
// Stores the fetched opcode while we fetch operands
circuit InstructionRegister {
  input opcode: Bus[8]
  input load: Bit
  output current_opcode: Bus[8]

  clock clk

  impl {
    node ir: Register
    connect clk -> ir.clk
    connect opcode -> ir.data
    connect load -> ir.we

    connect ir.q -> current_opcode
  }
}

// === Enhanced Control FSM ===
// Now tracks sub-cycles within EXECUTE for operand fetching
circuit EnhancedControl {
  input reset: Bit
  input current_opcode: Bus[8]

  output current_state: Bus[3]
  output exec_subcycle: Bus[3]  // Which cycle of execute we're on
  output pc_increment: Bit
  output ir_load: Bit           // Load instruction register
  output operand_load: Bit      // Load operand register
  output reg_write: Bit         // Write to A register
  output is_lda: Bit            // Current instruction is LDA
  output is_adc: Bit            // Current instruction is ADC

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

    node cmp_lda: Comparator
    connect current_opcode -> cmp_lda.a
    connect LDA_IMM.out -> cmp_lda.b
    connect cmp_lda.eq -> is_lda

    node cmp_adc: Comparator
    connect current_opcode -> cmp_adc.a
    connect ADC_IMM.out -> cmp_adc.b
    connect cmp_adc.eq -> is_adc

    // Sub-cycle logic
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)

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

    // EXECUTE -> stay until subcycle 1, then -> FETCH
    node exec_done: And
    connect is_execute.eq -> exec_done.a
    connect is_subcycle_1.eq -> exec_done.b

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
    // PC increments during FETCH and during EXECUTE subcycle 0 (operand fetch)
    node exec_subcycle_0: And
    connect is_execute.eq -> exec_subcycle_0.a
    connect is_subcycle_0.eq -> exec_subcycle_0.b

    node pc_inc_signal: Or
    connect is_fetch.eq -> pc_inc_signal.a
    connect exec_subcycle_0.out -> pc_inc_signal.b
    connect pc_inc_signal.out -> pc_increment

    // IR loads during FETCH
    connect is_fetch.eq -> ir_load

    // Operand loads during EXECUTE subcycle 0
    connect exec_subcycle_0.out -> operand_load

    // Register writes during EXECUTE subcycle 1
    node exec_subcycle_1: And
    connect is_execute.eq -> exec_subcycle_1.a
    connect is_subcycle_1.eq -> exec_subcycle_1.b
    connect exec_subcycle_1.out -> reg_write
  }
}

// === Enhanced CPU ===
circuit EnhancedCPU {
  input reset: Bit

  output pc: Bus[8]
  output instruction: Bus[8]
  output operand: Bus[8]
  output current_state: Bus[3]
  output subcycle: Bus[3]
  output reg_a: Bus[8]

  clock clk

  impl {
    // Program counter (simplified - just low byte for now)
    node pc_reg: Register
    connect clk -> pc_reg.clk
    node always_on: Constant(value=1)
    connect always_on.out -> pc_reg.we

    node pc_inc: Incrementer
    connect pc_reg.q -> pc_inc.in

    // ROM
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)
    node four: Constant(value=4)
    node five: Constant(value=5)

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

    // Program: A9 42 69 08 (LDA #$42, ADC #$08)
    node byte_0: Constant(value=169)  // A9
    node byte_1: Constant(value=66)   // 42
    node byte_2: Constant(value=105)  // 69
    node byte_3: Constant(value=8)    // 08
    node byte_4: Constant(value=0)    // padding
    node byte_5: Constant(value=0)    // padding

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

    // Instruction register
    node ir: Register
    connect clk -> ir.clk
    connect mux5.out -> ir.data

    // Operand register
    node operand_reg: Register
    connect clk -> operand_reg.clk
    connect mux5.out -> operand_reg.data

    // Control FSM
    node control: EnhancedControl
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

    // A register
    node reg_a_internal: Register
    connect clk -> reg_a_internal.clk
    connect control.reg_write -> reg_a_internal.we

    // ALU
    node adder: Adder
    connect reg_a_internal.q -> adder.a
    connect operand_reg.q -> adder.b
    connect zero.out -> adder.carry_in

    // Instruction dispatch: LDA loads operand, ADC adds
    node result: Mux
    connect control.is_lda -> result.sel
    connect adder.sum -> result.in0        // ADC: use sum
    connect operand_reg.q -> result.in1    // LDA: use operand directly

    connect result.out -> reg_a_internal.data

    // Outputs
    connect pc_reg.q -> pc
    connect ir.q -> instruction
    connect operand_reg.q -> operand
    connect control.current_state -> current_state
    connect control.exec_subcycle -> subcycle
    connect reg_a_internal.q -> reg_a
  }
}

// === TEST CIRCUIT ===
circuit Stage3Test {
  clock clk

  impl {
    node cpu: EnhancedCPU
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
  }
}

// ALU Test with Manual Inputs
// You control all inputs with Input components

circuit ALUManualTest {
  output result: Bus[8]
  output carry: Bit
  output zero: Bit
  output negative: Bit

  impl {
    // All inputs are manual - you set them!
    node input_a: Input    // Set this to 66 (0x42)
    node input_b: Input    // Set this to 8
    node input_op: Input   // Try 0=ADD, 1=SUB, 2=AND, 3=OR, 4=XOR
    node input_carry: Input  // Set this to 0

    node alu: ALU
    connect input_a.out -> alu.a
    connect input_b.out -> alu.b
    connect input_op.out -> alu.op
    connect input_carry.out -> alu.carry_in

    connect alu.result -> result
    connect alu.carry_out -> carry
    connect alu.zero -> zero
    connect alu.negative -> negative
  }
}

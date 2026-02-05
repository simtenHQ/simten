// Test circuit for ALU
// Tests different operations by changing the op input
// op=0: ADD (0x42+0x08=0x4A)
// op=1: SUB (0x42-0x08=0x3A)
// op=2: AND (0x42&0x08=0x00)
// op=3: OR  (0x42|0x08=0x4A)
// op=4: XOR (0x42^0x08=0x4A)

circuit ALUTest {
  output result: Bus[8]
  output carry: Bit
  output zero: Bit
  output negative: Bit

  impl {
    // Test inputs
    node val_a: Constant(value=66)    // 0x42
    node val_b: Constant(value=8)     // 0x08
    node op_input: Input              // Change this to test different operations
    node carry_in: Constant(value=0)

    // ALU
    node alu: ALU
    connect val_a.out -> alu.a
    connect val_b.out -> alu.b
    connect op_input.out -> alu.op
    connect carry_in.out -> alu.carry_in

    // Outputs
    connect alu.result -> result
    connect alu.carry_out -> carry
    connect alu.zero -> zero
    connect alu.negative -> negative
  }
}

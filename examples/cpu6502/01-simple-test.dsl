// 6502 CPU Stage 1: Simple Addition Test
// Just tests that we can add two numbers
// ✅ WORKING - Shows 0x4A (74 decimal) correctly

circuit SimpleAddTest {
  output sum: Bus[8]
  output carry: Bit

  impl {
    // Two constant values (decimal notation)
    node val_a: Constant(value=66)    // 0x42 = 66 decimal
    node val_b: Constant(value=8)     // 0x08 = 8 decimal
    node zero: Constant(value=0)

    // Adder
    node adder: Adder
    connect val_a.out -> adder.a
    connect val_b.out -> adder.b
    connect zero.out -> adder.carry_in

    // Outputs
    connect adder.sum -> sum
    connect adder.carry_out -> carry
  }
}

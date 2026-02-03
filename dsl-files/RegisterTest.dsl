// Test if Register can hold a value

circuit RegisterTest {
  clock clk

  impl {
    // Try to store the value 5
    node reg: Register
    node five: Constant(value=5)
    node we: Constant(value=1)

    // LEDs to show output
    node led0: Led
    node led1: Led
    node led2: Led

    node bit0: BitSlice(low=0, high=0)
    node bit1: BitSlice(low=1, high=1)
    node bit2: BitSlice(low=2, high=2)

    // Connect constant to register
    connect five.out -> reg.data
    connect we.out -> reg.we
    connect clk -> reg.clk

    // Show register output on LEDs
    connect reg.q -> bit0.in
    connect reg.q -> bit1.in
    connect reg.q -> bit2.in

    connect bit0.out -> led0.in
    connect bit1.out -> led1.in
    connect bit2.out -> led2.in
  }
}

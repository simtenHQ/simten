// Minimal counter - just increments every cycle
// No reset, no enable - for debugging

circuit SimpleCounter {
  output count: Bus[8]
  clock clk

  impl {
    // Counter register
    node counter_reg: Register

    // Always add 1
    node adder: Adder
    node one: Constant(value=1)
    node we: Constant(value=1)

    // Add 1 to current count
    connect counter_reg.q -> adder.a
    connect one.out -> adder.b

    // Feed back to register
    connect adder.sum -> counter_reg.data
    connect we.out -> counter_reg.we
    connect clk -> counter_reg.clk

    // Output
    connect counter_reg.q -> count
  }
}

// Simple counter with Inputs instead of Constants

circuit SimpleCounter2 {
  input enable: Bit    // Set this to 1 to make it work
  output count: Bus[8]
  clock clk

  impl {
    node reg: Register
    node adder: Adder
    node one: Constant(value=1)

    // Feedback
    connect reg.q -> adder.a
    connect one.out -> adder.b
    connect adder.sum -> reg.data

    // Use input as write enable
    connect enable -> reg.we
    connect clk -> reg.clk

    connect reg.q -> count
  }
}

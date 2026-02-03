// Test feedback: register output feeds back through adder

circuit FeedbackTest {
  clock clk

  impl {
    node reg: Register
    node adder: Adder
    node one: Constant(value=1)
    node we: Constant(value=1)

    // Feedback loop: reg.q -> adder -> reg.data
    connect reg.q -> adder.a
    connect one.out -> adder.b
    connect adder.sum -> reg.data
    connect we.out -> reg.we
    connect clk -> reg.clk

    // Display
    node led0: Led
    node led1: Led
    node led2: Led
    node led3: Led

    node bit0: BitSlice(low=0, high=0)
    node bit1: BitSlice(low=1, high=1)
    node bit2: BitSlice(low=2, high=2)
    node bit3: BitSlice(low=3, high=3)

    connect reg.q -> bit0.in
    connect reg.q -> bit1.in
    connect reg.q -> bit2.in
    connect reg.q -> bit3.in

    connect bit0.out -> led0.in
    connect bit1.out -> led1.in
    connect bit2.out -> led2.in
    connect bit3.out -> led3.in
  }
}

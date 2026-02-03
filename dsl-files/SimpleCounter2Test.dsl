// Test SimpleCounter2

circuit SimpleCounter2Test {
  clock clk

  impl {
    node enable_btn: Button
    node counter: SimpleCounter2

    // LEDs
    node led0: Led
    node led1: Led
    node led2: Led
    node led3: Led

    node bit0: BitSlice(low=0, high=0)
    node bit1: BitSlice(low=1, high=1)
    node bit2: BitSlice(low=2, high=2)
    node bit3: BitSlice(low=3, high=3)

    connect enable_btn.out -> counter.enable
    connect clk -> counter.clk

    connect counter.count -> bit0.in
    connect counter.count -> bit1.in
    connect counter.count -> bit2.in
    connect counter.count -> bit3.in

    connect bit0.out -> led0.in
    connect bit1.out -> led1.in
    connect bit2.out -> led2.in
    connect bit3.out -> led3.in
  }
}

// Test circuit for SimpleCounter

circuit SimpleCounterTest {
  clock clk

  impl {
    // Simple counter
    node counter: SimpleCounter

    // LEDs to display count (just show lower 4 bits)
    node led0: Led
    node led1: Led
    node led2: Led
    node led3: Led

    // Extract bits
    node bit0: BitSlice(low=0, high=0)
    node bit1: BitSlice(low=1, high=1)
    node bit2: BitSlice(low=2, high=2)
    node bit3: BitSlice(low=3, high=3)

    // Connect clock
    connect clk -> counter.clk

    // Extract and display bits
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

// Counter Test Circuit
// Manual testing with buttons and LED display

circuit CounterTest {
  clock clk

  impl {
    // Input controls
    node reset_btn: Button
    node enable_btn: Button

    // Counter under test
    node counter: Counter

    // LED display for the count (8 bits)
    node led0: Led
    node led1: Led
    node led2: Led
    node led3: Led
    node led4: Led
    node led5: Led
    node led6: Led
    node led7: Led

    // Extract individual bits from count
    node bit0: BitSlice(low=0, high=0)
    node bit1: BitSlice(low=1, high=1)
    node bit2: BitSlice(low=2, high=2)
    node bit3: BitSlice(low=3, high=3)
    node bit4: BitSlice(low=4, high=4)
    node bit5: BitSlice(low=5, high=5)
    node bit6: BitSlice(low=6, high=6)
    node bit7: BitSlice(low=7, high=7)

    // Connect buttons to counter inputs
    connect reset_btn.out -> counter.reset
    connect enable_btn.out -> counter.enable
    connect clk -> counter.clk

    // Connect counter output to bit slicers
    connect counter.count -> bit0.in
    connect counter.count -> bit1.in
    connect counter.count -> bit2.in
    connect counter.count -> bit3.in
    connect counter.count -> bit4.in
    connect counter.count -> bit5.in
    connect counter.count -> bit6.in
    connect counter.count -> bit7.in

    // Connect bits to LEDs
    connect bit0.out -> led0.in
    connect bit1.out -> led1.in
    connect bit2.out -> led2.in
    connect bit3.out -> led3.in
    connect bit4.out -> led4.in
    connect bit5.out -> led5.in
    connect bit6.out -> led6.in
    connect bit7.out -> led7.in
  }
}

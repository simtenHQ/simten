// Test if LEDs can light up at all

circuit LedTest {
  impl {
    // Try different ways to turn on an LED

    // Method 1: Button -> LED
    node btn: Button
    node led1: Led
    connect btn.out -> led1.in

    // Method 2: Constant(1) -> LED
    node one: Constant(value=1)
    node led2: Led
    connect one.out -> led2.in

    // Method 3: BitSlice of a constant -> LED
    node five: Constant(value=5)  // Binary 101
    node bit0: BitSlice(low=0, high=0)
    node bit2: BitSlice(low=2, high=2)
    node led3: Led
    node led4: Led

    connect five.out -> bit0.in
    connect five.out -> bit2.in
    connect bit0.out -> led3.in
    connect bit2.out -> led4.in
  }
}

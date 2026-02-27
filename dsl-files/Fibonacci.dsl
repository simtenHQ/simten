// Hardware Fibonacci Sequence Generator
// Pure datapath — no software, no ROM, no instructions.
// Two registers + one adder produce the Fibonacci sequence every clock tick.
// DFlipFlop trick seeds the first value via carry_in on tick 1 only.
// Output: 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, ... (wraps at 8-bit)

circuit Fibonacci {
  description "Hardware Fibonacci generator - pure datapath, no software"
  output fib: Bus[8]
  clock clk
  impl {
    node reg_a: Register
    node reg_b: Register
    node adder: Adder
    node one_bit: Constant(value=1)

    // Seed trick: DFlipFlop starts false, goes true after first tick
    // q_bar is true only on first tick, injecting +1 via carry_in
    node init: DFlipFlop
    connect one_bit.out -> init.d
    connect init.q_bar -> adder.carry_in

    // reg_a + reg_b + (1 on first tick only)
    connect reg_a.q -> adder.a
    connect reg_b.q -> adder.b

    // Shift: reg_a <- reg_b, reg_b <- sum
    connect reg_b.q -> reg_a.data
    connect one_bit.out -> reg_a.we
    connect adder.sum -> reg_b.data
    connect one_bit.out -> reg_b.we

    connect reg_b.q -> fib
  }
}

circuit FibonacciDemo {
  description "Interactive Fibonacci with hex display and 8 LEDs showing binary"
  clock clk
  impl {
    node fib: Fibonacci
    node display: HexDisplay
    node leds: Splitter8to8
    node led0: Led
    node led1: Led
    node led2: Led
    node led3: Led
    node led4: Led
    node led5: Led
    node led6: Led
    node led7: Led

    connect fib.fib -> display.in
    connect fib.fib -> leds.in

    connect leds.bit0 -> led0.in
    connect leds.bit1 -> led1.in
    connect leds.bit2 -> led2.in
    connect leds.bit3 -> led3.in
    connect leds.bit4 -> led4.in
    connect leds.bit5 -> led5.in
    connect leds.bit6 -> led6.in
    connect leds.bit7 -> led7.in
  }
}

// Auto-generated from DSL

const Fibonacci = circuit('Fibonacci', {
  out: { fib: bus(8) },
  meta: { description: "Hardware Fibonacci generator - pure datapath, no software" },
  nodes: { reg_a: Register, reg_b: Register, adder: Adder, one_bit: Constant, init: DFlipFlop },
  nodeArgs: { one_bit: { value: 1 } },
  connect: ({ in: inp, out, reg_a, reg_b, adder, one_bit, init }) => [
    one_bit.out.to(init.d, reg_a.we, reg_b.we),
    init.q_bar.to(adder.carry_in),
    reg_a.q.to(adder.a),
    reg_b.q.to(adder.b, reg_a.data, out.fib),
    adder.sum.to(reg_b.data),
  ],
})

const FibonacciDemo = circuit('FibonacciDemo', {
  meta: { description: "Interactive Fibonacci with hex display and 8 LEDs showing binary" },
  nodes: { fib: Fibonacci, display: HexDisplay, leds: Splitter8to8, led0: Led, led1: Led, led2: Led, led3: Led, led4: Led, led5: Led, led6: Led, led7: Led },
  connect: ({ in: inp, out, fib, display, leds, led0, led1, led2, led3, led4, led5, led6, led7 }) => [
    fib.fib.to(display.in, leds.in),
    leds.bit0.to(led0.in),
    leds.bit1.to(led1.in),
    leds.bit2.to(led2.in),
    leds.bit3.to(led3.in),
    leds.bit4.to(led4.in),
    leds.bit5.to(led5.in),
    leds.bit6.to(led6.in),
    leds.bit7.to(led7.in),
  ],
})

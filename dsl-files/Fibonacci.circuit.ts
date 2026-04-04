// Auto-generated from DSL

const Fibonacci = component('Fibonacci')
  .out('fib', bus(8))
  .node('reg_a', Register)
  .node('reg_b', Register)
  .node('adder', Adder)
  .node('one_bit', Constant, { value: 1 })
  .node('init', DFlipFlop)
  .connect(({ in: inp, out, reg_a, reg_b, adder, one_bit, init }) => [
    one_bit.out.to(init.d, reg_a.we, reg_b.we),
    init.q_bar.to(adder.carry_in),
    reg_a.q.to(adder.a),
    reg_b.q.to(adder.b, reg_a.data, out.fib),
    adder.sum.to(reg_b.data),
  ])
  .build()

const FibonacciDemo = component('FibonacciDemo')
  .node('fib', Fibonacci)
  .node('display', HexDisplay)
  .node('leds', Splitter8to8)
  .node('led0', Led)
  .node('led1', Led)
  .node('led2', Led)
  .node('led3', Led)
  .node('led4', Led)
  .node('led5', Led)
  .node('led6', Led)
  .node('led7', Led)
  .connect(({ in: inp, out, fib, display, leds, led0, led1, led2, led3, led4, led5, led6, led7 }) => [
    fib.fib.to(display.in, leds.in),
    leds.bit0.to(led0.in),
    leds.bit1.to(led1.in),
    leds.bit2.to(led2.in),
    leds.bit3.to(led3.in),
    leds.bit4.to(led4.in),
    leds.bit5.to(led5.in),
    leds.bit6.to(led6.in),
    leds.bit7.to(led7.in),
  ])
  .build()

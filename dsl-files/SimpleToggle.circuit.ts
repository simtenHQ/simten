// Auto-generated from DSL

const SimpleToggle = component('SimpleToggle', {
  nodes: { ff: DFlipFlop, inverter: Not, led: Led },
  connect: ({ in: inp, out, ff, inverter, led }) => [
    ff.q.to(inverter.in, led.in),
    inverter.out.to(ff.d),
  ],
})

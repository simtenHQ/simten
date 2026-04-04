// Auto-generated from DSL

const SimpleFlipFlopChain = component('SimpleFlipFlopChain', {
  nodes: { sw: Switch, ff1: DFlipFlop, ff2: DFlipFlop, led: Led, inverter: Not },
  nodeArgs: { sw: { value: 1 } },
  connect: ({ in: inp, out, sw, ff1, ff2, led, inverter }) => [
    ff2.q.to(inverter.in, led.in),
    inverter.out.to(ff1.d),
    ff1.q.to(ff2.d),
  ],
})

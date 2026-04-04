// Auto-generated from DSL

const SimpleFlipFlopChain = component('SimpleFlipFlopChain')
  .node('sw', Switch, { value: 1 })
  .node('ff1', DFlipFlop)
  .node('ff2', DFlipFlop)
  .node('led', Led)
  .node('inverter', Not)
  .connect(({ in: inp, out, sw, ff1, ff2, led, inverter }) => [
    ff2.q.to(inverter.in, led.in),
    inverter.out.to(ff1.d),
    ff1.q.to(ff2.d),
  ])
  .build()

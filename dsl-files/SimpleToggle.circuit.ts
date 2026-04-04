// Auto-generated from DSL

const SimpleToggle = component('SimpleToggle')
  .node('ff', DFlipFlop)
  .node('inverter', Not)
  .node('led', Led)
  .connect(({ in: inp, out, ff, inverter, led }) => [
    ff.q.to(inverter.in, led.in),
    inverter.out.to(ff.d),
  ])
  .build()

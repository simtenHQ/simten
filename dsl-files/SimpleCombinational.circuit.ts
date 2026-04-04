// Auto-generated from DSL

const SimpleCombinational = component('SimpleCombinational')
  .node('sw1', Switch, { value: 1 })
  .node('sw2', Switch, { value: 0 })
  .node('inverter', Not)
  .node('andGate', And)
  .node('led', Led)
  .connect(({ in: inp, out, sw1, sw2, inverter, andGate, led }) => [
    sw1.out.to(inverter.in),
    inverter.out.to(andGate.a),
    sw2.out.to(andGate.b),
    andGate.out.to(led.in),
  ])
  .build()

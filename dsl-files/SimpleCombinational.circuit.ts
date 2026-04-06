// Auto-generated from DSL

const SimpleCombinational = circuit('SimpleCombinational', {
  nodes: { sw1: Switch, sw2: Switch, inverter: Not, andGate: And, led: Led },
  nodeArgs: { sw1: { value: 1 }, sw2: { value: 0 } },
  connect: ({ in: inp, out, sw1, sw2, inverter, andGate, led }) => [
    sw1.out.to(inverter.in),
    inverter.out.to(andGate.a),
    sw2.out.to(andGate.b),
    andGate.out.to(led.in),
  ],
})

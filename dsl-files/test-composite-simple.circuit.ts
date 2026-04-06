// Auto-generated from DSL

const PassThrough = circuit('PassThrough', {
  in: { x: bit },
  out: { y: bit },
  nodes: { n: Not },
  connect: ({ in: inp, out, n }) => [
    inp.x.to(n.in),
    n.out.to(out.y),
  ],
})

const TestPassThrough = circuit('TestPassThrough', {
  nodes: { sw: Switch, pt: PassThrough, led: Led },
  connect: ({ in: inp, out, sw, pt, led }) => [
    sw.out.to(pt.x),
    pt.y.to(led.in),
  ],
})

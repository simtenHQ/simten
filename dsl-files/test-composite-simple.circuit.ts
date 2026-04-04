// Auto-generated from DSL

const PassThrough = component('PassThrough')
  .in('x', bit)
  .out('y', bit)
  .node('n', Not)
  .connect(({ in: inp, out, n }) => [
    inp.x.to(n.in),
    n.out.to(out.y),
  ])
  .build()

const TestPassThrough = component('TestPassThrough')
  .node('sw', Switch)
  .node('pt', PassThrough)
  .node('led', Led)
  .connect(({ in: inp, out, sw, pt, led }) => [
    sw.out.to(pt.x),
    pt.y.to(led.in),
  ])
  .build()

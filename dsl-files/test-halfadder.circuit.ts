// Auto-generated from DSL

const DirectTest = component('DirectTest')
  .node('sw1', Switch)
  .node('sw2', Switch)
  .node('xor1', Xor)
  .node('and1', And)
  .node('led1', Led)
  .node('led2', Led)
  .connect(({ in: inp, out, sw1, sw2, xor1, and1, led1, led2 }) => [
    sw1.out.to(xor1.a, and1.a),
    sw2.out.to(xor1.b, and1.b),
    xor1.out.to(led1.in),
    and1.out.to(led2.in),
  ])
  .build()

const HalfAdder = component('HalfAdder')
  .in('a', bit)
  .in('b', bit)
  .out('sum', bit)
  .out('carry', bit)
  .node('xor1', Xor)
  .node('and1', And)
  .connect(({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ])
  .build()

const CompositeTest = component('CompositeTest')
  .node('sw1', Switch)
  .node('sw2', Switch)
  .node('ha', HalfAdder)
  .node('led1', Led)
  .node('led2', Led)
  .connect(({ in: inp, out, sw1, sw2, ha, led1, led2 }) => [
    sw1.out.to(ha.a),
    sw2.out.to(ha.b),
    ha.sum.to(led1.in),
    ha.carry.to(led2.in),
  ])
  .build()

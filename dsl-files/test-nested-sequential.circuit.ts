// Auto-generated from DSL

const BitRegister = component('BitRegister')
  .in('data', bit)
  .out('q', bit)
  .node('ff1', DFlipFlop)
  .node('ff2', DFlipFlop)
  .connect(({ in: inp, out, ff1, ff2 }) => [
    inp.data.to(ff1.d),
    ff1.q.to(ff2.d),
    ff2.q.to(out.q),
  ])
  .build()

const WrappedRegister = component('WrappedRegister')
  .in('data', bit)
  .out('q', bit)
  .node('inner', BitRegister)
  .connect(({ in: inp, out, inner }) => [
    inp.data.to(inner.data),
    inner.q.to(out.q),
  ])
  .build()

const TestNestedSequential = component('TestNestedSequential')
  .node('data_sw', Switch)
  .node('wrapped', WrappedRegister)
  .node('led', Led)
  .connect(({ in: inp, out, data_sw, wrapped, led }) => [
    data_sw.out.to(wrapped.data),
    wrapped.q.to(led.in),
  ])
  .build()

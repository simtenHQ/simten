// Auto-generated from DSL

const SimpleRAMWrite = component('SimpleRAMWrite')
  .node('ram', DualPortRAM, { init: {"0":1} })
  .node('counter', Register, { initial: 0 })
  .node('increment', Incrementer)
  .node('one', Constant, { value: 1 })
  .node('screen', Screen)
  .connect(({ in: inp, out, ram, counter, increment, one, screen }) => [
    counter.q.to(increment.in, ram.addrA),
    increment.out.to(counter.data),
    one.out.to(counter.we, ram.dataA, ram.weA),
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
  ])
  .build()

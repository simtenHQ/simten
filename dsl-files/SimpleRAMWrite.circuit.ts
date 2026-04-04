// Auto-generated from DSL

const SimpleRAMWrite = component('SimpleRAMWrite', {
  nodes: { ram: DualPortRAM, counter: Register, increment: Incrementer, one: Constant, screen: Screen },
  nodeArgs: { ram: { init: {"0":1} }, counter: { initial: 0 }, one: { value: 1 } },
  connect: ({ in: inp, out, ram, counter, increment, one, screen }) => [
    counter.q.to(increment.in, ram.addrA),
    increment.out.to(counter.data),
    one.out.to(counter.we, ram.dataA, ram.weA),
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
  ],
})

// Auto-generated from DSL

const SimpleScreen = component('SimpleScreen', {
  nodes: { ram: DualPortRAM, screen: Screen },
  nodeArgs: { ram: { init: {"0":1,"1":1,"9":1,"63":1} } },
  connect: ({ in: inp, out, ram, screen }) => [
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
  ],
})

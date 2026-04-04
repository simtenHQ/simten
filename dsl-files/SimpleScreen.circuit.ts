// Auto-generated from DSL

const SimpleScreen = component('SimpleScreen')
  .node('ram', DualPortRAM, { init: {"0":1,"1":1,"9":1,"63":1} })
  .node('screen', Screen)
  .connect(({ in: inp, out, ram, screen }) => [
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
  ])
  .build()

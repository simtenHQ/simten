// Test RAM writes with a counter that updates screen
circuit SimpleRAMWrite {
  impl {
    // RAM for screen
    node ram: DualPortRAM(init={
      0: 1  // Start with pixel 0 on
    })

    // Counter to cycle through addresses
    node counter: Register(initial=0)
    node increment: Incrementer
    connect counter.q -> increment.in
    connect increment.out -> counter.data

    // Always write (for testing)
    node one: Constant(value=1)
    connect one.out -> counter.we

    // Write counter value to RAM (turns on sequential pixels)
    connect counter.q -> ram.addrA
    connect one.out -> ram.dataA
    connect one.out -> ram.weA

    // Screen
    node screen: Screen
    connect screen.addrB -> ram.addrB
    connect ram.dataB -> screen.dataIn
  }
}

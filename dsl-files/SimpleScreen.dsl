// Simple screen test - just show a few pixels
circuit SimpleScreen {
  impl {
    // RAM with some pixels initialized
    node ram: DualPortRAM(init={
      0: 1,   // Pixel 0 ON
      1: 1,   // Pixel 1 ON
      9: 1,   // Pixel 9 ON (second row, first pixel)
      63: 1   // Pixel 63 ON (last pixel)
    })

    // Screen connected to RAM
    node screen: Screen
    connect screen.addrB -> ram.addrB
    connect ram.dataB -> screen.dataIn
  }
}

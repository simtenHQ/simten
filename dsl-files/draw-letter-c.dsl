circuit DrawLetterC {
  clock clk

  impl {
    // Double-buffered framebuffers
    node fb1: DualPortRAM  // Buffer 1
    node fb2: DualPortRAM  // Buffer 2
    node display: Screen

    // Buffer selection (0 = display reads fb1, write to fb2; 1 = opposite)
    node bufferSelect: DFlipFlop

    // Mux for routing display read to front buffer
    node readDataMux: Mux

    // Drawing state
    node pixelIndex: Register(initial=0)  // Which pixel we're drawing (0-11)
    node drawing: DFlipFlop(initial=1)    // Set to 1 to start drawing
    node done: DFlipFlop(initial=0)       // Set when all pixels drawn

    // Letter C pixel addresses (12 pixels total)
    // Row 1: columns 2,3,4,5 = addresses 10,11,12,13
    // Row 2: columns 1,6 = addresses 17,22
    // Row 3: column 0 = address 24
    // Row 4: column 0 = address 32
    // Row 5: columns 1,6 = addresses 41,46
    // Row 6: columns 2,3,4,5 = addresses 50,51,52,53

    // Constants for pixel addresses
    node addr0: Constant(value=10)   // Row 1, col 2
    node addr1: Constant(value=11)   // Row 1, col 3
    node addr2: Constant(value=12)   // Row 1, col 4
    node addr3: Constant(value=13)   // Row 1, col 5
    node addr4: Constant(value=17)   // Row 2, col 1
    node addr5: Constant(value=22)   // Row 2, col 6
    node addr6: Constant(value=24)   // Row 3, col 0
    node addr7: Constant(value=32)   // Row 4, col 0
    node addr8: Constant(value=41)   // Row 5, col 1
    node addr9: Constant(value=46)   // Row 5, col 6
    node addr10: Constant(value=50)  // Row 6, col 2
    node addr11: Constant(value=51)  // Row 6, col 3

    // Constants
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node twelve: Constant(value=12)

    // Lookup table: pixelIndex -> address
    // Using cascaded muxes to select the correct address
    node mux0: Mux
    node mux1: Mux
    node mux2: Mux
    node mux3: Mux
    node mux4: Mux
    node mux5: Mux
    node mux6: Mux
    node mux7: Mux
    node mux8: Mux
    node mux9: Mux
    node mux10: Mux

    // Build lookup tree (binary tree of muxes)
    node bit0: BitSlice(low=0, high=0)
    node bit1: BitSlice(low=1, high=1)
    node bit2: BitSlice(low=2, high=2)
    node bit3: BitSlice(low=3, high=3)

    connect pixelIndex.q -> bit0.in
    connect pixelIndex.q -> bit1.in
    connect pixelIndex.q -> bit2.in
    connect pixelIndex.q -> bit3.in

    // Layer 1: pairs (0-1, 2-3, 4-5, 6-7, 8-9, 10-11)
    connect bit0.out -> mux0.sel
    connect addr0.out -> mux0.in0
    connect addr1.out -> mux0.in1

    connect bit0.out -> mux1.sel
    connect addr2.out -> mux1.in0
    connect addr3.out -> mux1.in1

    connect bit0.out -> mux2.sel
    connect addr4.out -> mux2.in0
    connect addr5.out -> mux2.in1

    connect bit0.out -> mux3.sel
    connect addr6.out -> mux3.in0
    connect addr7.out -> mux3.in1

    connect bit0.out -> mux4.sel
    connect addr8.out -> mux4.in0
    connect addr9.out -> mux4.in1

    connect bit0.out -> mux5.sel
    connect addr10.out -> mux5.in0
    connect addr11.out -> mux5.in1

    // Layer 2: groups of 4 (0-3, 4-7, 8-11)
    connect bit1.out -> mux6.sel
    connect mux0.out -> mux6.in0
    connect mux1.out -> mux6.in1

    connect bit1.out -> mux7.sel
    connect mux2.out -> mux7.in0
    connect mux3.out -> mux7.in1

    connect bit1.out -> mux8.sel
    connect mux4.out -> mux8.in0
    connect mux5.out -> mux8.in1

    // Layer 3: groups of 8 (0-7, 8-11)
    connect bit2.out -> mux9.sel
    connect mux6.out -> mux9.in0
    connect mux7.out -> mux9.in1

    // Layer 4: final selection (0-11)
    connect bit3.out -> mux10.sel
    connect mux9.out -> mux10.in0
    connect mux8.out -> mux10.in1

    // mux10.out is the current pixel address

    // Check if done (pixelIndex >= 12)
    // Use NOT(pixelIndex < 12) to get >=
    node checkDone: Comparator
    connect pixelIndex.q -> checkDone.a
    connect twelve.out -> checkDone.b

    node isDone: Not
    connect checkDone.lt -> isDone.in

    // Update done flag
    node shouldSetDone: And
    connect isDone.out -> shouldSetDone.a
    connect drawing.q -> shouldSetDone.b

    connect shouldSetDone.out -> done.d

    // Stop drawing when done
    node notDone: Not
    connect done.q -> notDone.in

    node keepDrawing: And
    connect drawing.q -> keepDrawing.a
    connect notDone.out -> keepDrawing.b

    connect keepDrawing.out -> drawing.d

    // Increment pixel index (only when drawing and not done)
    node indexInc: Incrementer
    connect pixelIndex.q -> indexInc.in
    connect indexInc.out -> pixelIndex.data

    node shouldIncrement: And
    connect drawing.q -> shouldIncrement.a
    connect notDone.out -> shouldIncrement.b
    connect shouldIncrement.out -> pixelIndex.we

    // ==== Buffer Swapping ====
    // Swap buffers when done flag is set
    node swapBuffers: Xor
    connect bufferSelect.q -> swapBuffers.a
    connect shouldSetDone.out -> swapBuffers.b
    connect swapBuffers.out -> bufferSelect.d

    // ==== Write to BACK Buffer ====
    // Both buffers get the write address and data, but only one gets write enable
    connect mux10.out -> fb1.addrA
    connect mux10.out -> fb2.addrA
    connect one.out -> fb1.dataA   // Always write 1 (pixel on)
    connect one.out -> fb2.dataA

    // Write enable routing:
    // bufferSelect=0: Screen reads fb1 (front), write to fb2 (back)
    // bufferSelect=1: Screen reads fb2 (front), write to fb1 (back)
    node writeEnable1: Mux
    connect bufferSelect.q -> writeEnable1.sel
    connect zero.out -> writeEnable1.in0      // bufferSelect=0: fb1 is front, don't write
    connect shouldIncrement.out -> writeEnable1.in1    // bufferSelect=1: fb1 is back, write
    connect writeEnable1.out -> fb1.weA

    node writeEnable2: Mux
    connect bufferSelect.q -> writeEnable2.sel
    connect shouldIncrement.out -> writeEnable2.in0    // bufferSelect=0: fb2 is back, write
    connect zero.out -> writeEnable2.in1      // bufferSelect=1: fb2 is front, don't write
    connect writeEnable2.out -> fb2.weA

    // ==== Screen Reads from FRONT Buffer ====
    connect display.addrB -> fb1.addrB
    connect display.addrB -> fb2.addrB

    // Mux selects which buffer's data goes to display
    // bufferSelect=0: read from fb1 (front)
    // bufferSelect=1: read from fb2 (front)
    connect bufferSelect.q -> readDataMux.sel
    connect fb1.outB -> readDataMux.in0
    connect fb2.outB -> readDataMux.in1
    connect readDataMux.out -> display.dataIn

    // ==== Status Display ====
    node statusDisplay: HexDisplay
    connect pixelIndex.q -> statusDisplay.in

    node doneLed: Led
    connect done.q -> doneLed.in

    // ==== Clock connections ====
    connect clk -> pixelIndex.clk
    connect clk -> drawing.clk
    connect clk -> done.clk
    connect clk -> bufferSelect.clk
  }
}

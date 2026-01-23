circuit Snake4PixelsExplicit {
  impl {
  // Dual-Port RAM and Screen
  node ram: DualPortRAM
  node screen: Screen

  // *** NEW: EXPLICIT BUS WIRING ***
  connect screen.addrB -> ram.addrB    // Screen drives RAM read address
  connect ram.dataB -> screen.dataIn   // RAM returns pixel data

  // Keyboard input
  node keyboard: Input

  // Snake positions: pos0 = head, pos3 = tail
  node pos0X: Register
  node pos0Y: Register
  node pos1X: Register
  node pos1Y: Register
  node pos2X: Register
  node pos2Y: Register
  node pos3X: Register
  node pos3Y: Register

  // State: 0 = clear tail, 1 = draw head and shift positions
  node phase: DFlipFlop
  node notPhase: Not
  connect phase.q -> notPhase.in
  connect notPhase.out -> phase.d

  // Direction codes
  node upCode: Input      // 72
  node downCode: Input    // 80
  node leftCode: Input    // 75
  node rightCode: Input   // 77

  // Direction comparators
  node isUp: Comparator
  node isDown: Comparator
  node isLeft: Comparator
  node isRight: Comparator

  connect keyboard.out -> isUp.a
  connect upCode.out -> isUp.b
  connect keyboard.out -> isDown.a
  connect downCode.out -> isDown.b
  connect keyboard.out -> isLeft.a
  connect leftCode.out -> isLeft.b
  connect keyboard.out -> isRight.a
  connect rightCode.out -> isRight.b

  // Constants
  node zero: Input        // 0
  node one: Input         // 1
  node minus1: Input      // 255 (for moving left/up with wraparound)

  // Calculate deltaX and deltaY
  node deltaXTemp: Mux
  node deltaX: Mux
  connect zero.out -> deltaXTemp.in0
  connect minus1.out -> deltaXTemp.in1
  connect isLeft.eq -> deltaXTemp.sel
  connect deltaXTemp.out -> deltaX.in0
  connect one.out -> deltaX.in1
  connect isRight.eq -> deltaX.sel

  node deltaYTemp: Mux
  node deltaY: Mux
  connect zero.out -> deltaYTemp.in0
  connect minus1.out -> deltaYTemp.in1
  connect isUp.eq -> deltaYTemp.sel
  connect deltaYTemp.out -> deltaY.in0
  connect one.out -> deltaY.in1
  connect isDown.eq -> deltaY.sel

  // Calculate new head position
  node newHeadX: Adder
  node newHeadY: Adder
  connect pos0X.q -> newHeadX.a
  connect deltaX.out -> newHeadX.b
  connect pos0Y.q -> newHeadY.a
  connect deltaY.out -> newHeadY.b

  // Wrap coordinates to 0-7 range using bit slicing (modulo 8 for power-of-2)
  // BitSlice extracts bits 0-2, giving range 0-7 automatically
  // Hardware: Just wire routing, zero logic gates!
  // This handles both underflow (255 & 0b111 = 7) and overflow (8 & 0b111 = 0)
  node wrapX: BitSlice
  node wrapY: BitSlice
  connect newHeadX.sum -> wrapX.in
  connect newHeadY.sum -> wrapY.in

  // Mux between tail (to clear) and wrapped new head (to draw)
  // wrapX.out and wrapY.out are guaranteed to be 0-7 (bits 0-2 only)
  node useX: Mux
  node useY: Mux
  connect pos3X.q -> useX.in0           // Phase 0: tail position
  connect wrapX.out -> useX.in1         // Phase 1: wrapped new head (0-7)
  connect phase.q -> useX.sel
  connect pos3Y.q -> useY.in0
  connect wrapY.out -> useY.in1
  connect phase.q -> useY.sel

  // Calculate RAM address: Y * 8 + X
  node y2: Adder
  node y4: Adder
  node y8: Adder
  connect useY.out -> y2.a
  connect useY.out -> y2.b
  connect y2.sum -> y4.a
  connect y2.sum -> y4.b
  connect y4.sum -> y8.a
  connect y4.sum -> y8.b

  node addr: Adder
  connect y8.sum -> addr.a
  connect useX.out -> addr.b

  // Connect to DualPortRAM Port A (write port - Snake controls this)
  connect addr.sum -> ram.addrA

  // Data: 0 in phase 0 (clear), 1 in phase 1 (draw)
  node ramData: Mux
  connect zero.out -> ramData.in0
  connect one.out -> ramData.in1
  connect phase.q -> ramData.sel
  connect ramData.out -> ram.dataA

  // Shift positions in phase 1
  node regEnable: Switch
  node shiftEnable: And
  connect regEnable.out -> shiftEnable.a
  connect phase.q -> shiftEnable.b

  // Connect data inputs for shifting (use wrapped coordinates)
  connect wrapX.out -> pos0X.data
  connect wrapY.out -> pos0Y.data
  connect pos0X.q -> pos1X.data
  connect pos0Y.q -> pos1Y.data
  connect pos1X.q -> pos2X.data
  connect pos1Y.q -> pos2Y.data
  connect pos2X.q -> pos3X.data
  connect pos2Y.q -> pos3Y.data

  // Connect write enables
  connect shiftEnable.out -> pos0X.we
  connect shiftEnable.out -> pos0Y.we
  connect shiftEnable.out -> pos1X.we
  connect shiftEnable.out -> pos1Y.we
  connect shiftEnable.out -> pos2X.we
  connect shiftEnable.out -> pos2Y.we
  connect shiftEnable.out -> pos3X.we
  connect shiftEnable.out -> pos3Y.we

  // Always write to RAM Port A
  node writeEnable: Switch
  connect writeEnable.out -> ram.weA
  }
  }
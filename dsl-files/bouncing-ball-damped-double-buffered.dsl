circuit BouncingBallDampedDoubleBuffered {
  clock clk

  impl {
    // Ball position - X fixed at center, Y bounces
    node ballX: Register(initial=3)  // Fixed at column 3
    node ballY: Register(initial=7)  // Start at ground (bottom)

    // Previous position (for clearing)
    node prevX: Register(initial=3)
    node prevY: Register(initial=7)

    // Direction state
    node dirY: DFlipFlop(initial=0)  // Start moving up (0=up, 1=down)

    // Maximum reach (how high the ball bounces)
    // Starts at 0 (full height), then 1, 2, 3... (losing height each bounce)
    node maxReach: Register(initial=0)

    // Frame state: alternates between 0 (clear old) and 1 (draw new)
    node framePhase: DFlipFlop

    // Y position update logic
    node yInc: Incrementer
    node yDec: Adder
    node yNegOne: Constant(value=255)
    node yNext: Mux

    // Edge detection
    node ground: Constant(value=7)      // Ground is Y=7 (bottom)
    node cmpGround: Comparator
    node cmpMaxReach: Comparator

    // Direction flip logic
    node dirYInv: Not
    node hitGround: And      // Hit ground while moving down
    node hitTop: And         // Hit max reach while moving up
    node shouldFlip: Or
    node flipY: Xor

    // Increment maxReach when hitting ground
    node maxReachInc: Incrementer
    node maxReachNext: Mux

    // Calculate framebuffer address: Y * 8 + X
    node eight: Constant(value=8)
    node yTimes8: Multiplier
    node addr: Adder
    node prevYTimes8: Multiplier
    node prevAddr: Adder

    // Muxes for phase control
    node addrMux: Mux
    node pixelMux: Mux
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node phaseInv: Not

    // Write enable
    node enable: Constant(value=1)

    // Double-buffered framebuffers (VSYNC-style buffer swapping)
    node fb1: DualPortRAM  // Buffer 1
    node fb2: DualPortRAM  // Buffer 2
    node display: Screen  // Screen with explicit dataIn wiring

    // Buffer selection (0 = display reads fb1, write to fb2; 1 = opposite)
    node bufferSelect: DFlipFlop

    // Mux for routing display read to front buffer
    node readDataMux: Mux

    // DEBUG: Show maxReach value on hex display
    node debugMaxReach: HexDisplay

    // Extract lower 3 bits
    node y3bit: BitSlice(low=0, high=2)
    node x3bit: BitSlice(low=0, high=2)
    node prevY3bit: BitSlice(low=0, high=2)
    node prevX3bit: BitSlice(low=0, high=2)
    node maxReach3bit: BitSlice(low=0, high=2)

    // ==== Y Position Update (only on draw phase) ====
    connect ballY.q -> yInc.in
    connect ballY.q -> yDec.a
    connect yNegOne.out -> yDec.b
    connect flipY.out -> yNext.sel
    connect yInc.out -> yNext.in1    // sel=1: increment (move down)
    connect yDec.sum -> yNext.in0    // sel=0: decrement (move up)
    connect yNext.out -> ballY.data
    connect framePhase.q -> ballY.we

    // ==== Store previous position (only on draw phase) ====
    connect ballX.q -> prevX.data
    connect framePhase.q -> prevX.we
    connect ballY.q -> prevY.data
    connect framePhase.q -> prevY.we

    // ==== Extract 3-bit coordinates ====
    connect ballY.q -> y3bit.in
    connect ballX.q -> x3bit.in
    connect prevY.q -> prevY3bit.in
    connect prevX.q -> prevX3bit.in
    connect maxReach.q -> maxReach3bit.in

    // ==== Edge Detection ====
    connect y3bit.out -> cmpGround.a
    connect ground.out -> cmpGround.b
    connect y3bit.out -> cmpMaxReach.a
    connect maxReach3bit.out -> cmpMaxReach.b

    // ==== Direction Flip Logic ====
    connect dirY.q -> dirYInv.in

    // Hit ground: at Y=7 AND moving down (dirY=1)
    connect cmpGround.eq -> hitGround.a
    connect dirY.q -> hitGround.b

    // Hit top: at Y=maxReach AND moving up (dirY=0)
    connect cmpMaxReach.eq -> hitTop.a
    connect dirYInv.out -> hitTop.b

    connect hitGround.out -> shouldFlip.a
    connect hitTop.out -> shouldFlip.b
    connect dirY.q -> flipY.a
    connect shouldFlip.out -> flipY.b
    connect flipY.out -> dirY.d

    // ==== Update maxReach (always enabled, updates when hitting ground) ====
    connect maxReach.q -> maxReachInc.in
    connect hitGround.out -> maxReachNext.sel
    connect maxReach.q -> maxReachNext.in0       // No hit: keep same
    connect maxReachInc.out -> maxReachNext.in1  // Hit ground: increment
    connect maxReachNext.out -> maxReach.data
    connect enable.out -> maxReach.we            // Always enabled

    // ==== Debug Display ====
    connect maxReach.q -> debugMaxReach.in

    // ==== Calculate Addresses ====
    connect y3bit.out -> yTimes8.a
    connect eight.out -> yTimes8.b
    connect yTimes8.product -> addr.a
    connect x3bit.out -> addr.b

    connect prevY3bit.out -> prevYTimes8.a
    connect eight.out -> prevYTimes8.b
    connect prevYTimes8.product -> prevAddr.a
    connect prevX3bit.out -> prevAddr.b

    // ==== Phase Control ====
    connect framePhase.q -> phaseInv.in
    connect phaseInv.out -> framePhase.d

    connect framePhase.q -> addrMux.sel
    connect prevAddr.sum -> addrMux.in0
    connect addr.sum -> addrMux.in1

    connect framePhase.q -> pixelMux.sel
    connect zero.out -> pixelMux.in0
    connect one.out -> pixelMux.in1

    // ==== Buffer Swapping (VSYNC-style) ====
    // Swap buffers when framePhase transitions from 1 -> 0 (after draw completes)
    // This is like VSYNC: we just finished drawing a complete frame to back buffer
    node swapCondition: And
    connect framePhase.q -> swapCondition.a
    connect phaseInv.out -> swapCondition.b

    node bufferFlip: Xor
    connect bufferSelect.q -> bufferFlip.a
    connect swapCondition.out -> bufferFlip.b
    connect bufferFlip.out -> bufferSelect.d

    // ==== Write to BACK Buffer ====
    // Both buffers get the write address and data, but only one gets write enable
    connect addrMux.out -> fb1.addrA
    connect addrMux.out -> fb2.addrA
    connect pixelMux.out -> fb1.dataA
    connect pixelMux.out -> fb2.dataA

    // Write enable routing:
    // bufferSelect=0: Screen reads fb1 (front), write to fb2 (back)
    // bufferSelect=1: Screen reads fb2 (front), write to fb1 (back)
    node writeEnable1: Mux
    connect bufferSelect.q -> writeEnable1.sel
    connect zero.out -> writeEnable1.in0      // bufferSelect=0: fb1 is front, don't write
    connect enable.out -> writeEnable1.in1    // bufferSelect=1: fb1 is back, write
    connect writeEnable1.out -> fb1.weA

    node writeEnable2: Mux
    connect bufferSelect.q -> writeEnable2.sel
    connect enable.out -> writeEnable2.in0    // bufferSelect=0: fb2 is back, write
    connect zero.out -> writeEnable2.in1      // bufferSelect=1: fb2 is front, don't write
    connect writeEnable2.out -> fb2.weA

    // ==== Screen Reads from FRONT Buffer ====
    // Screen outputs addrB (for DMA-style reading)
    // Both buffers get the same read address
    connect display.addrB -> fb1.addrB
    connect display.addrB -> fb2.addrB

    // Mux selects which buffer's data goes to display
    // bufferSelect=0: read from fb1 (front)
    // bufferSelect=1: read from fb2 (front)
    connect bufferSelect.q -> readDataMux.sel
    connect fb1.outB -> readDataMux.in0
    connect fb2.outB -> readDataMux.in1
    connect readDataMux.out -> display.dataIn

    // ==== Clock connections for sequential components ====
    connect clk -> ballX.clk
    connect clk -> ballY.clk
    connect clk -> prevX.clk
    connect clk -> prevY.clk
    connect clk -> dirY.clk
    connect clk -> maxReach.clk
    connect clk -> framePhase.clk
    connect clk -> bufferSelect.clk
  }
}

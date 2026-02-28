circuit BouncingBall2D {
  clock clk

  impl {
    // Ball position (3 bits each for 0-7 range)
    // Start at (1, 1) instead of (0, 0)
    node ballX: Register(initial=1)
    node ballY: Register(initial=1)

    // Previous position (for clearing)
    node prevX: Register(initial=1)
    node prevY: Register(initial=1)

    // Direction states - start moving right (1) and down (1)
    node dirX: DFlipFlop(initial=1)  // 1=right, 0=left
    node dirY: DFlipFlop(initial=1)  // 1=down, 0=up

    // Frame state: alternates between 0 (clear old) and 1 (draw new)
    node framePhase: DFlipFlop

    // X position update logic
    node xInc: Incrementer
    node xDec: Adder
    node xNegOne: Constant(value=255)
    node xNext: Mux

    // Y position update logic
    node yInc: Incrementer
    node yDec: Adder
    node yNegOne: Constant(value=255)
    node yNext: Mux

    // Extract lower 3 bits for 0-7 range
    node x3bit: BitSlice(low=0, high=2)
    node y3bit: BitSlice(low=0, high=2)
    node prevX3bit: BitSlice(low=0, high=2)
    node prevY3bit: BitSlice(low=0, high=2)

    // Edge detection for X (0 and 7)
    node xZero: Constant(value=0)
    node xSeven: Constant(value=7)
    node cmpXZero: Comparator
    node cmpXSeven: Comparator

    // Edge detection for Y (0 and 7)
    node yZero: Constant(value=0)
    node ySeven: Constant(value=7)
    node cmpYZero: Comparator
    node cmpYSeven: Comparator

    // X direction flip logic
    node dirXInv: Not
    node hitXLeft: And
    node hitXRight: And
    node shouldFlipX: Or
    node flipX: Xor

    // Y direction flip logic
    node dirYInv: Not
    node hitYTop: And
    node hitYBottom: And
    node shouldFlipY: Or
    node flipY: Xor

    // Calculate current position address: Y * 8 + X
    node eight: Constant(value=8)
    node yTimes8: Multiplier
    node addr: Adder

    // Calculate previous position address: prevY * 8 + prevX
    node prevYTimes8: Multiplier
    node prevAddr: Adder

    // Mux for address (prev vs current)
    node addrMux: Mux

    // Mux for pixel data (0=clear vs 1=draw)
    node pixelMux: Mux
    node zero: Constant(value=0)
    node one: Constant(value=1)

    // Phase inverter for next frame
    node phaseInv: Not

    // Write enable (always on)
    node enable: Constant(value=1)

    // Framebuffer and display
    node fb: DualPortRAM
    node display: Screen

    // ==== X Position Update (only on draw phase) ====
    connect ballX.q -> xInc.in
    connect ballX.q -> xDec.a
    connect xNegOne.out -> xDec.b
    connect flipX.out -> xNext.sel
    connect xInc.out -> xNext.in1
    connect xDec.sum -> xNext.in0
    connect xNext.out -> ballX.data
    connect framePhase.q -> ballX.we  // Only update on phase=1

    // ==== Y Position Update (only on draw phase) ====
    connect ballY.q -> yInc.in
    connect ballY.q -> yDec.a
    connect yNegOne.out -> yDec.b
    connect flipY.out -> yNext.sel
    connect yInc.out -> yNext.in1
    connect yDec.sum -> yNext.in0
    connect yNext.out -> ballY.data
    connect framePhase.q -> ballY.we  // Only update on phase=1

    // ==== Store previous position (only on draw phase) ====
    connect ballX.q -> prevX.data
    connect framePhase.q -> prevX.we
    connect ballY.q -> prevY.data
    connect framePhase.q -> prevY.we

    // ==== Extract 3-bit coordinates ====
    connect ballX.q -> x3bit.in
    connect ballY.q -> y3bit.in
    connect prevX.q -> prevX3bit.in
    connect prevY.q -> prevY3bit.in

    // ==== X Edge Detection ====
    connect x3bit.out -> cmpXZero.a
    connect xZero.out -> cmpXZero.b
    connect x3bit.out -> cmpXSeven.a
    connect xSeven.out -> cmpXSeven.b

    // ==== Y Edge Detection ====
    connect y3bit.out -> cmpYZero.a
    connect yZero.out -> cmpYZero.b
    connect y3bit.out -> cmpYSeven.a
    connect ySeven.out -> cmpYSeven.b

    // ==== X Direction Flip ====
    connect dirX.q -> dirXInv.in
    connect cmpXZero.eq -> hitXLeft.a
    connect dirXInv.out -> hitXLeft.b
    connect cmpXSeven.eq -> hitXRight.a
    connect dirX.q -> hitXRight.b
    connect hitXLeft.out -> shouldFlipX.a
    connect hitXRight.out -> shouldFlipX.b
    connect dirX.q -> flipX.a
    connect shouldFlipX.out -> flipX.b
    connect flipX.out -> dirX.d

    // ==== Y Direction Flip ====
    connect dirY.q -> dirYInv.in
    connect cmpYZero.eq -> hitYTop.a
    connect dirYInv.out -> hitYTop.b
    connect cmpYSeven.eq -> hitYBottom.a
    connect dirY.q -> hitYBottom.b
    connect hitYTop.out -> shouldFlipY.a
    connect hitYBottom.out -> shouldFlipY.b
    connect dirY.q -> flipY.a
    connect shouldFlipY.out -> flipY.b
    connect flipY.out -> dirY.d

    // ==== Calculate Current Address: Y * 8 + X ====
    connect y3bit.out -> yTimes8.a
    connect eight.out -> yTimes8.b
    connect yTimes8.product -> addr.a
    connect x3bit.out -> addr.b

    // ==== Calculate Previous Address: prevY * 8 + prevX ====
    connect prevY3bit.out -> prevYTimes8.a
    connect eight.out -> prevYTimes8.b
    connect prevYTimes8.product -> prevAddr.a
    connect prevX3bit.out -> prevAddr.b

    // ==== Phase Control ====
    // Phase alternates: 0 (clear) -> 1 (draw) -> 0 -> 1...
    connect framePhase.q -> phaseInv.in
    connect phaseInv.out -> framePhase.d

    // ==== Address Mux: phase=0 -> prev, phase=1 -> current ====
    connect framePhase.q -> addrMux.sel
    connect prevAddr.sum -> addrMux.in0
    connect addr.sum -> addrMux.in1

    // ==== Pixel Mux: phase=0 -> 0 (clear), phase=1 -> 1 (draw) ====
    connect framePhase.q -> pixelMux.sel
    connect zero.out -> pixelMux.in0
    connect one.out -> pixelMux.in1

    // ==== Write to Framebuffer ====
    connect addrMux.out -> fb.addrA
    connect pixelMux.out -> fb.dataA
    connect enable.out -> fb.weA

    // ==== Screen Display (Port B) ====
    connect display.addrB -> fb.addrB
    connect fb.outB -> display.dataIn

    // ==== Clock connections for sequential components ====
    connect clk -> ballX.clk
    connect clk -> ballY.clk
    connect clk -> prevX.clk
    connect clk -> prevY.clk
    connect clk -> dirX.clk
    connect clk -> dirY.clk
    connect clk -> framePhase.clk
  }
}

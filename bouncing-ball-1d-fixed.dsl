circuit BouncingBall1D {
  impl {
    // Position state (8-bit, but we only use lower 2 bits)
    node position: Register
    node direction: DFlipFlop

    // Position arithmetic
    node posInc: Incrementer
    node posDec: Adder
    node negOne: Constant(value=255)  // -1 in unsigned 8-bit
    node posNext: Mux

    // Constants for edge detection
    node zero: Constant(value=0)
    node three: Constant(value=3)

    // Edge detection using Comparator
    node cmpZero: Comparator
    node cmpThree: Comparator

    // Detect when we're AT an edge AND moving toward it
    node dirInv: Not
    node hitLeft: And
    node hitRight: And
    node shouldFlip: Or

    // Direction flip logic
    node flipDir: Xor

    // Extract lower 2 bits for comparison and display
    node pos2bit: BitSlice(low=0, high=1)

    // Display decoder
    node decoder: Decoder
    node led0: Led
    node led1: Led
    node led2: Led
    node led3: Led

    // Write enable
    node enable: Constant(value=1)

    // Position update logic
    connect position.q -> posInc.in
    connect position.q -> posDec.a
    connect negOne.out -> posDec.b

    // KEY FIX: Use the NEW direction (flipDir.out) for mux, not old direction
    connect flipDir.out -> posNext.sel
    connect posInc.out -> posNext.in1    // sel=1: increment (move right)
    connect posDec.sum -> posNext.in0    // sel=0: decrement (move left)
    connect posNext.out -> position.data
    connect enable.out -> position.we

    // Edge detection: compare lower 2 bits with 0 and 3
    connect position.q -> pos2bit.in
    connect pos2bit.out -> cmpZero.a
    connect zero.out -> cmpZero.b
    connect pos2bit.out -> cmpThree.a
    connect three.out -> cmpThree.b

    // Detect edge hits with direction awareness
    connect direction.q -> dirInv.in
    connect cmpZero.eq -> hitLeft.a
    connect dirInv.out -> hitLeft.b
    connect cmpThree.eq -> hitRight.a
    connect direction.q -> hitRight.b

    // Should flip if we hit either edge
    connect hitLeft.out -> shouldFlip.a
    connect hitRight.out -> shouldFlip.b

    // Direction flip: XOR current direction with shouldFlip
    connect direction.q -> flipDir.a
    connect shouldFlip.out -> flipDir.b

    // Save the new direction for next cycle
    connect flipDir.out -> direction.d

    // Display
    connect pos2bit.out -> decoder.in
    connect decoder.out0 -> led0.in
    connect decoder.out1 -> led1.in
    connect decoder.out2 -> led2.in
    connect decoder.out3 -> led3.in
  }
}

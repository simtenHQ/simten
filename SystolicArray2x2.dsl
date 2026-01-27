circuit SystolicArray2x2 {
  // Matrix A inputs (data, streamed)
  input a00: Bus[8]
  input a01: Bus[8]
  input a10: Bus[8]
  input a11: Bus[8]

  // Matrix B inputs (weights, loaded once)
  input b00: Bus[8]
  input b01: Bus[8]
  input b10: Bus[8]
  input b11: Bus[8]

  // Control
  input loadWeights: Bit
  clock clk

  // Result matrix C (16-bit to avoid overflow)
  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]

  impl {
    // === 2×2 Grid of Processing Elements ===
    node pe00: ProcessingElement  // Row 0, Col 0
    node pe01: ProcessingElement  // Row 0, Col 1
    node pe10: ProcessingElement  // Row 1, Col 0
    node pe11: ProcessingElement  // Row 1, Col 1

    // === Input Staging (for diagonal wavefront) ===
    // Row 0 enters immediately, Row 1 delayed by 1 cycle
    node delay_a10: Register  // Delay a10 by 1 cycle
    node delay_a11: Register  // Delay a11 by 1 cycle

    // === Constants ===
    node zero16Low: Constant(value=0)   // For constructing 16-bit zero
    node zero16High: Constant(value=0)
    node one: Constant(value=1)  // For register write enable

    // === Weight Distribution (One-time Load) ===
    connect b00 -> pe00.weightIn
    connect b01 -> pe01.weightIn
    connect b10 -> pe10.weightIn
    connect b11 -> pe11.weightIn

    // Broadcast load signal to all PEs
    connect loadWeights -> pe00.loadWeight
    connect loadWeights -> pe01.loadWeight
    connect loadWeights -> pe10.loadWeight
    connect loadWeights -> pe11.loadWeight

    // Broadcast clock to all PEs
    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // === Input Staging (connect delays) ===
    // Row 1 data delayed by 1 cycle
    connect a10 -> delay_a10.data
    connect a11 -> delay_a11.data
    connect one.out -> delay_a10.we
    connect one.out -> delay_a11.we
    connect clk -> delay_a10.clk
    connect clk -> delay_a11.clk

    // === Horizontal Data Flow (Left → Right) ===
    // Row 0: enters immediately
    //   Cycle 1: a00 → PE(0,0)
    //   Cycle 2: a01 → PE(0,0), a00 → PE(0,1)
    connect a00 -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn

    // Row 1: enters with 1-cycle delay
    //   Cycle 1: (nothing enters, delay buffers a10)
    //   Cycle 2: delayed_a10 → PE(1,0)
    //   Cycle 3: delayed_a11 → PE(1,0), delayed_a10 → PE(1,1)
    connect delay_a10.q -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // === Vertical Partial Sum Flow (Top → Bottom) ===
    // NOTE: We need 16-bit zeros for partialSumIn. Since we can't create a 16-bit constant directly,
    // we'll use Constant(value=0) which outputs 0 that gets interpreted as needed by the PE.

    // Column 0: 0 → PE(0,0) → PE(1,0)
    connect zero16Low.out -> pe00.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn

    // Column 1: 0 → PE(0,1) → PE(1,1)
    connect zero16High.out -> pe01.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn

    // === Result Extraction ===
    // NOTE: In a true systolic array, results accumulate over multiple cycles
    // as data flows through. For a 2x2 array:
    // - c00 accumulates in PE(1,0) over 2 cycles (a00×b00 + a01×b10)
    // - c01 accumulates in PE(1,1) over 2 cycles (a00×b01 + a01×b11)
    // - c10 accumulates in PE(1,0) over different cycles (a10×b00 + a11×b10)
    // - c11 accumulates in PE(1,1) over different cycles (a10×b01 + a11×b11)
    //
    // The challenge: PE(1,0) produces BOTH c00 and c10 at different times
    // This is the fundamental timing issue with our current design.
    //
    // For now, we output the first accumulated results:
    connect pe10.partialSumOut -> c00
    connect pe11.partialSumOut -> c01
    connect pe10.partialSumOut -> c10  // TODO: needs proper sequencing
    connect pe11.partialSumOut -> c11  // TODO: needs proper sequencing
  }
}

// Systolic Array 2×2 - Fixed Version
// Properly captures all 4 output values using result registers

circuit SystolicArray2x2_Fixed {
  // Matrix A inputs (data)
  input a00: Bus[8]
  input a01: Bus[8]
  input a10: Bus[8]
  input a11: Bus[8]

  // Matrix B inputs (weights)
  input b00: Bus[8]
  input b01: Bus[8]
  input b10: Bus[8]
  input b11: Bus[8]

  // Control
  input loadWeights: Bit
  input capture_row0: Bit  // Pulse to capture c00, c01
  input capture_row1: Bit  // Pulse to capture c10, c11
  clock clk

  // Outputs
  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]

  impl {
    // === Processing Element Grid ===
    node pe00: ProcessingElement
    node pe01: ProcessingElement
    node pe10: ProcessingElement
    node pe11: ProcessingElement

    // === Output Capture Registers ===
    // These store results when capture signals are pulsed
    node result_c00: Register(initial=0)  // Captures row 0, col 0
    node result_c01: Register(initial=0)  // Captures row 0, col 1
    node result_c10: Register(initial=0)  // Captures row 1, col 0
    node result_c11: Register(initial=0)  // Captures row 1, col 1

    // === Constants ===
    node zero16: Constant(value=0)

    // === Weight Distribution ===
    connect b00 -> pe00.weightIn
    connect b01 -> pe01.weightIn
    connect b10 -> pe10.weightIn
    connect b11 -> pe11.weightIn

    connect loadWeights -> pe00.loadWeight
    connect loadWeights -> pe01.loadWeight
    connect loadWeights -> pe10.loadWeight
    connect loadWeights -> pe11.loadWeight

    // === Clock Distribution ===
    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // === Horizontal Data Flow ===
    connect a00 -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn

    connect a10 -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // === Vertical Partial Sum Flow ===
    connect zero16.out -> pe00.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn

    connect zero16.out -> pe01.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn

    // === Capture Results ===
    // Row 0 results (captured when first row completes)
    connect pe10.partialSumOut -> result_c00.data
    connect pe11.partialSumOut -> result_c01.data
    connect capture_row0 -> result_c00.we
    connect capture_row0 -> result_c01.we
    connect clk -> result_c00.clk
    connect clk -> result_c01.clk

    // Row 1 results (captured when second row completes)
    connect pe10.partialSumOut -> result_c10.data
    connect pe11.partialSumOut -> result_c11.data
    connect capture_row1 -> result_c10.we
    connect capture_row1 -> result_c11.we
    connect clk -> result_c10.clk
    connect clk -> result_c11.clk

    // === Output the Captured Results ===
    connect result_c00.q -> c00
    connect result_c01.q -> c01
    connect result_c10.q -> c10
    connect result_c11.q -> c11
  }
}

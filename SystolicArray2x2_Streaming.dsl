// Hardware-Accurate Streaming Systolic Array 2×2
// Automatically sequences input data in diagonal wavefront pattern

circuit SystolicArray2x2_Streaming {
  // Matrix A inputs (all provided upfront, sequenced internally)
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
  input start: Bit        // Pulse to start computation
  clock clk

  // Result matrix C (16-bit to avoid overflow)
  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]
  output done: Bit        // High when computation complete

  impl {
    // === Core Systolic Array ===
    node pe00: ProcessingElement
    node pe01: ProcessingElement
    node pe10: ProcessingElement
    node pe11: ProcessingElement

    // === Cycle Counter (tracks computation progress) ===
    node counter: Register
    node counterInc: Incrementer
    node counterReset: Constant(value=0)

    // === Control State ===
    node computing: DFlipFlop  // High during computation
    node counterEnable: Or     // Enable counter when computing

    // === Input Sequencing for Row 0 ===
    // Cycle 1: feed a00, Cycle 2: feed a01, Cycle 3+: feed 0
    node mux_row0_sel: Comparator  // counter == 1 or 2?
    node mux_row0_data: Mux        // Select a00 or a01
    node zero8: Constant(value=0)

    // === Input Sequencing for Row 1 (1-cycle delayed) ===
    // Cycle 2: feed a10, Cycle 3: feed a11, Cycle 4+: feed 0
    node mux_row1_sel: Comparator
    node mux_row1_data: Mux

    // === Constants ===
    node zero16: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)

    // === Cycle Counter Logic ===
    connect counter.q -> counterInc.in
    connect counterInc.out -> counter.data
    connect start -> counterReset.out  // Reset when start pulsed (TODO: needs mux)
    connect one.out -> counter.we
    connect clk -> counter.clk

    // === Computing State ===
    connect start -> computing.d
    connect clk -> computing.clk

    // === Row 0 Input Sequencing ===
    // When counter=1: feed a00
    // When counter=2: feed a01
    // Otherwise: feed 0
    connect counter.q -> mux_row0_sel.a
    connect one.out -> mux_row0_sel.b
    connect mux_row0_sel.eq -> mux_row0_data.sel
    connect a00 -> mux_row0_data.in0
    connect a01 -> mux_row0_data.in1

    // === Row 1 Input Sequencing (delayed) ===
    connect counter.q -> mux_row1_sel.a
    connect two.out -> mux_row1_sel.b
    connect mux_row1_sel.eq -> mux_row1_data.sel
    connect a10 -> mux_row1_data.in0
    connect a11 -> mux_row1_data.in1

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
    connect mux_row0_data.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn

    connect mux_row1_data.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // === Vertical Partial Sum Flow ===
    connect zero16.out -> pe00.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn

    connect zero16.out -> pe01.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn

    // === Results ===
    connect pe10.partialSumOut -> c00
    connect pe11.partialSumOut -> c01
    connect pe10.partialSumOut -> c10  // TODO: proper output sequencing
    connect pe11.partialSumOut -> c11

    // Done signal (TODO: implement properly)
    connect computing.q -> done
  }
}

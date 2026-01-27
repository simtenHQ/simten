// Complete 2×2 WEIGHT-STATIONARY systolic array with TWO k-phases
// Phase k=0: A[:,0] × B[0,:]
// Phase k=1: A[:,1] × B[1,:]
// Accumulates across both phases - each PE(i,j) computes C[i,j]
// No vertical partial sum flow - PEs accumulate independently

circuit ProcessingElement {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input partialSumIn: Bus[16]
  input loadWeight: Bit
  input resetAccum: Bit  // Reset accumulator between matrices
  clock clk
  output dataOut: Bus[8]
  output partialSumOut: Bus[16]

  impl {
    node weightReg: Register
    node mult: Multiplier
    node adder: Adder(width=16)
    node psum_reg: Register
    node dataPipe: Register
    node one: Constant(value=1)
    node zero: Constant(value=0)
    node zero16: Constant(value=0)

    // Reset mux for accumulator
    node accum_mux: Mux

    connect weightIn -> weightReg.data
    connect loadWeight -> weightReg.we
    connect clk -> weightReg.clk

    connect dataIn -> mult.a
    connect weightReg.q -> mult.b
    connect mult.product -> adder.a
    connect partialSumIn -> adder.b
    connect zero.out -> adder.carry_in

    // Accumulator with reset
    connect resetAccum -> accum_mux.sel
    connect adder.sum -> accum_mux.in0
    connect zero16.out -> accum_mux.in1

    connect accum_mux.out -> psum_reg.data
    connect one.out -> psum_reg.we
    connect clk -> psum_reg.clk
    connect psum_reg.q -> partialSumOut

    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}

circuit Systolic2x2Complete {
  // A matrix (will feed different columns per k-phase)
  input a00: Bus[8]
  input a01: Bus[8]
  input a10: Bus[8]
  input a11: Bus[8]

  // B matrix (will reload per k-phase)
  input b_col0: Bus[8]  // B[k,0] - changes per k
  input b_col1: Bus[8]  // B[k,1] - changes per k

  input loadWeights: Bit
  input resetAccum: Bit
  input selectK: Bit  // 0=k0 (feed A[:,0]), 1=k1 (feed A[:,1])

  clock clk

  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]

  impl {
    node pe00: ProcessingElement
    node pe01: ProcessingElement
    node pe10: ProcessingElement
    node pe11: ProcessingElement

    node zero16: Constant(value=0)

    // Muxes to select which A column to feed
    node mux_row0: Mux  // Select a00 or a01
    node mux_row1: Mux  // Select a10 or a11

    // Select A column based on k phase
    connect selectK -> mux_row0.sel
    connect a00 -> mux_row0.in0  // k=0
    connect a01 -> mux_row0.in1  // k=1

    connect selectK -> mux_row1.sel
    connect a10 -> mux_row1.in0  // k=0
    connect a11 -> mux_row1.in1  // k=1

    // Weight distribution - COLUMN-WISE
    connect b_col0 -> pe00.weightIn
    connect b_col0 -> pe10.weightIn  // Same weight!
    connect b_col1 -> pe01.weightIn
    connect b_col1 -> pe11.weightIn  // Same weight!

    connect loadWeights -> pe00.loadWeight
    connect loadWeights -> pe01.loadWeight
    connect loadWeights -> pe10.loadWeight
    connect loadWeights -> pe11.loadWeight

    connect resetAccum -> pe00.resetAccum
    connect resetAccum -> pe01.resetAccum
    connect resetAccum -> pe10.resetAccum
    connect resetAccum -> pe11.resetAccum

    // Data distribution - ROW-WISE
    connect mux_row0.out -> pe00.dataIn
    connect mux_row0.out -> pe01.dataIn  // Row 0 broadcast
    connect mux_row1.out -> pe10.dataIn
    connect mux_row1.out -> pe11.dataIn  // Row 1 broadcast

    // No vertical flow in weight-stationary - each PE accumulates independently
    connect zero16.out -> pe00.partialSumIn
    connect zero16.out -> pe01.partialSumIn
    connect zero16.out -> pe10.partialSumIn
    connect zero16.out -> pe11.partialSumIn

    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // Outputs - each PE outputs its own C[i,j] result
    connect pe00.partialSumOut -> c00
    connect pe01.partialSumOut -> c01
    connect pe10.partialSumOut -> c10
    connect pe11.partialSumOut -> c11
  }
}

circuit TestTwoKPhases {
  clock clk

  impl {
    node sys: Systolic2x2Complete

    node a00: Input(value=1)
    node a01: Input(value=2)
    node a10: Input(value=3)
    node a11: Input(value=4)

    // For k=0: set these to [5, 6]
    // For k=1: change to [7, 8]
    node b_col0: Input(value=5)
    node b_col1: Input(value=6)

    node loadWeights: Switch
    node resetAccum: Switch
    node selectK: Switch  // OFF=k0, ON=k1

    connect a00.out -> sys.a00
    connect a01.out -> sys.a01
    connect a10.out -> sys.a10
    connect a11.out -> sys.a11
    connect b_col0.out -> sys.b_col0
    connect b_col1.out -> sys.b_col1
    connect loadWeights.out -> sys.loadWeights
    connect resetAccum.out -> sys.resetAccum
    connect selectK.out -> sys.selectK
    connect clk -> sys.clk

    node display_c00: HexDisplay
    node display_c01: HexDisplay
    node display_c10: HexDisplay
    node display_c11: HexDisplay

    connect sys.c00 -> display_c00.in
    connect sys.c01 -> display_c01.in
    connect sys.c10 -> display_c10.in
    connect sys.c11 -> display_c11.in
  }
}

// Test ONE k-phase of a systolic array
// Just k=0: A[:,0] × B[0,:]
// Should give first partial results

circuit ProcessingElement {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input partialSumIn: Bus[16]
  input loadWeight: Bit
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

    connect weightIn -> weightReg.data
    connect loadWeight -> weightReg.we
    connect clk -> weightReg.clk

    connect dataIn -> mult.a
    connect weightReg.q -> mult.b
    connect mult.product -> adder.a
    connect partialSumIn -> adder.b
    connect zero.out -> adder.carry_in

    connect adder.sum -> psum_reg.data
    connect one.out -> psum_reg.we
    connect clk -> psum_reg.clk
    connect psum_reg.q -> partialSumOut

    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}

// Test: Just k=0 phase
// A[:,0] = [1, 3]
// B[0,:] = [5, 6]
// Expected partial results:
// C[0,0] = 1×5 = 5
// C[0,1] = 1×6 = 6
// C[1,0] = 3×5 = 15
// C[1,1] = 3×6 = 18

circuit TestOneKPhase {
  clock clk

  impl {
    node pe00: ProcessingElement
    node pe01: ProcessingElement
    node pe10: ProcessingElement
    node pe11: ProcessingElement

    // A[:,0] values
    node a00: Input(value=1)
    node a10: Input(value=3)

    // B[0,:] values - column PEs get same weight!
    node b00: Input(value=5)  // For column 0
    node b01: Input(value=6)  // For column 1

    node loadWeights: Switch
    node zero16: Constant(value=0)

    // Weight loading - SAME weight per column!
    connect b00.out -> pe00.weightIn
    connect b00.out -> pe10.weightIn  // Same as PE00!
    connect b01.out -> pe01.weightIn
    connect b01.out -> pe11.weightIn  // Same as PE01!

    connect loadWeights.out -> pe00.loadWeight
    connect loadWeights.out -> pe01.loadWeight
    connect loadWeights.out -> pe10.loadWeight
    connect loadWeights.out -> pe11.loadWeight

    // Simple: just feed data directly (no staggering yet)
    connect a00.out -> pe00.dataIn
    connect a00.out -> pe01.dataIn  // Row 0 broadcast
    connect a10.out -> pe10.dataIn
    connect a10.out -> pe11.dataIn  // Row 1 broadcast

    // Partial sum flow (vertical)
    connect zero16.out -> pe00.partialSumIn
    connect zero16.out -> pe01.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn

    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // Show all PE outputs
    node display_pe00: HexDisplay
    node display_pe01: HexDisplay
    node display_pe10: HexDisplay
    node display_pe11: HexDisplay

    connect pe00.partialSumOut -> display_pe00.in
    connect pe01.partialSumOut -> display_pe01.in
    connect pe10.partialSumOut -> display_pe10.in
    connect pe11.partialSumOut -> display_pe11.in
  }
}

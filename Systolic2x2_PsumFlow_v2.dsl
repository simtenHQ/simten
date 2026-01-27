// TPU-Style Psum-Flow: Simpler Approach
// Key insight: PE has no accumulator, external edge accumulators handle k-dimension
//
// Difference from local accumulation:
// - PE just does ONE MAC: out = (data × weight) + psum_in
// - No internal k-accumulation feedback loop
// - Accumulation happens at output edge (reduces register pressure in PE)
// - For small K this is overkill, but scales better to large K

circuit ProcessingElement_Simple {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input partialSumIn: Bus[16]  // External psum fed back per k-phase
  input loadWeight: Bit
  clock clk
  output dataOut: Bus[8]
  output partialSumOut: Bus[16]

  impl {
    node weightReg: Register
    node mult: Multiplier
    node adder: Adder(width=16)
    node psum_reg: Register  // Just pipeline, NOT accumulator
    node dataPipe: Register
    node one: Constant(value=1)
    node zero: Constant(value=0)

    // Weight storage
    connect weightIn -> weightReg.data
    connect loadWeight -> weightReg.we
    connect clk -> weightReg.clk

    // Simple MAC: out = (data × weight) + psum_in
    // psum_in comes from EXTERNAL accumulator, not internal feedback!
    connect dataIn -> mult.a
    connect weightReg.q -> mult.b
    connect mult.product -> adder.a
    connect partialSumIn -> adder.b  // External, not self-feedback
    connect zero.out -> adder.carry_in

    // Pipeline register (adds 1 cycle latency, not accumulation)
    connect adder.sum -> psum_reg.data
    connect one.out -> psum_reg.we
    connect clk -> psum_reg.clk
    connect psum_reg.q -> partialSumOut

    // Data passthrough
    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}

// Array with external accumulation (reduces PE register pressure)
circuit Systolic2x2_EdgeAccum {
  input a_row0: Bus[8]
  input a_row1: Bus[8]
  input b_col0: Bus[8]
  input b_col1: Bus[8]

  input loadWeights: Bit
  input resetAccum: Bit
  clock clk

  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]

  impl {
    node pe00: ProcessingElement_Simple
    node pe01: ProcessingElement_Simple
    node pe10: ProcessingElement_Simple
    node pe11: ProcessingElement_Simple

    // EXTERNAL ACCUMULATORS (this is the key difference!)
    // These live OUTSIDE PEs, reducing register pressure inside PE
    node accum_00: Register
    node accum_01: Register
    node accum_10: Register
    node accum_11: Register

    node adder_00: Adder(width=16)
    node adder_01: Adder(width=16)
    node adder_10: Adder(width=16)
    node adder_11: Adder(width=16)

    node mux_00: Mux
    node mux_01: Mux
    node mux_10: Mux
    node mux_11: Mux

    node zero16: Constant(value=0)
    node one: Constant(value=1)

    // Weight distribution (column-wise)
    connect b_col0 -> pe00.weightIn
    connect b_col0 -> pe10.weightIn
    connect b_col1 -> pe01.weightIn
    connect b_col1 -> pe11.weightIn

    connect loadWeights -> pe00.loadWeight
    connect loadWeights -> pe01.loadWeight
    connect loadWeights -> pe10.loadWeight
    connect loadWeights -> pe11.loadWeight

    // Horizontal data flow (spatial chaining)
    connect a_row0 -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect a_row1 -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // Each PE gets its accumulator value as psum_in (external feedback)
    connect accum_00.q -> pe00.partialSumIn
    connect accum_01.q -> pe01.partialSumIn
    connect accum_10.q -> pe10.partialSumIn
    connect accum_11.q -> pe11.partialSumIn

    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // External accumulator for PE(0,0)
    connect pe00.partialSumOut -> adder_00.a
    connect accum_00.q -> adder_00.b
    connect zero16.out -> adder_00.carry_in

    connect resetAccum -> mux_00.sel
    connect adder_00.sum -> mux_00.in0
    connect zero16.out -> mux_00.in1

    connect mux_00.out -> accum_00.data
    connect one.out -> accum_00.we
    connect clk -> accum_00.clk

    // External accumulator for PE(0,1)
    connect pe01.partialSumOut -> adder_01.a
    connect accum_01.q -> adder_01.b
    connect zero16.out -> adder_01.carry_in

    connect resetAccum -> mux_01.sel
    connect adder_01.sum -> mux_01.in0
    connect zero16.out -> mux_01.in1

    connect mux_01.out -> accum_01.data
    connect one.out -> accum_01.we
    connect clk -> accum_01.clk

    // External accumulator for PE(1,0)
    connect pe10.partialSumOut -> adder_10.a
    connect accum_10.q -> adder_10.b
    connect zero16.out -> adder_10.carry_in

    connect resetAccum -> mux_10.sel
    connect adder_10.sum -> mux_10.in0
    connect zero16.out -> mux_10.in1

    connect mux_10.out -> accum_10.data
    connect one.out -> accum_10.we
    connect clk -> accum_10.clk

    // External accumulator for PE(1,1)
    connect pe11.partialSumOut -> adder_11.a
    connect accum_11.q -> adder_11.b
    connect zero16.out -> adder_11.carry_in

    connect resetAccum -> mux_11.sel
    connect adder_11.sum -> mux_11.in0
    connect zero16.out -> mux_11.in1

    connect mux_11.out -> accum_11.data
    connect one.out -> accum_11.we
    connect clk -> accum_11.clk

    // Outputs from external accumulators
    connect accum_00.q -> c00
    connect accum_01.q -> c01
    connect accum_10.q -> c10
    connect accum_11.q -> c11
  }
}

circuit TestSystolic_EdgeAccum {
  clock clk

  impl {
    node sys: Systolic2x2_EdgeAccum

    node a_row0: Input(value=0)
    node a_row1: Input(value=0)
    node b_col0: Input(value=0)
    node b_col1: Input(value=0)

    node loadWeights: Switch
    node resetAccum: Switch

    connect a_row0.out -> sys.a_row0
    connect a_row1.out -> sys.a_row1
    connect b_col0.out -> sys.b_col0
    connect b_col1.out -> sys.b_col1
    connect loadWeights.out -> sys.loadWeights
    connect resetAccum.out -> sys.resetAccum
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

// COMPARISON:
//
// Local Accumulation (Systolic2x2_WeightStationary.dsl):
// - Accumulator INSIDE each PE
// - PE: mult + adder + accumulator register + mux = ~10 components
// - Simple wiring, easy to understand
// - Good for small K
//
// External Accumulation (this file):
// - Accumulator OUTSIDE each PE
// - PE: mult + adder + pipeline register = ~7 components (simpler!)
// - More array-level wiring (accumulators at edge)
// - Better for large K (less register pressure per PE)
// - This is closer to real TPU architecture
//
// Functionally they compute the same result, but:
// - External accum: PE is simpler, array wiring more complex
// - Local accum: PE is more complex, array wiring simpler
//
// For 256×256 array with K=4096:
// - Local accum: 256² = 65K accumulators in PE fabric
// - External accum: Can use smaller accumulator array at edge
//
// That's why TPU uses external accumulation pattern!

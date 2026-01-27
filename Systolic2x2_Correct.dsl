// CORRECT Weight-Stationary Systolic Array (following TinyTPU architecture)
// Key insight: Feed COLUMNS of A (k-dimension), not rows!

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
    node psum_reg: Register  // Register the partial sum output!
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

    // KEY: Register the partial sum output
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

// This computes C = A × B where A is 2×2, B is 2×2
// We need to feed COLUMNS of A sequentially (the k dimension)
// Column 0: [a00, a10]^T at k=0
// Column 1: [a01, a11]^T at k=1

circuit Systolic2x2Correct {
  // Instead of a00, a01, a10, a11 as separate inputs,
  // we need to feed them in the right sequence
  // For simplicity, let's use the same inputs but sequence them correctly

  input a_row0_k0: Bus[8]  // a00 - feed at cycle 0
  input a_row0_k1: Bus[8]  // a01 - feed at cycle 1
  input a_row1_k0: Bus[8]  // a10 - feed at cycle 1 (staggered!)
  input a_row1_k1: Bus[8]  // a11 - feed at cycle 2

  input b00: Bus[8]  // B[0,0]
  input b01: Bus[8]  // B[0,1]
  input b10: Bus[8]  // B[1,0]
  input b11: Bus[8]  // B[1,1]

  input loadWeights: Bit
  input start: Bit
  clock clk

  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]
  output done: Bit

  impl {
    node pe00: ProcessingElement
    node pe01: ProcessingElement
    node pe10: ProcessingElement
    node pe11: ProcessingElement

    // For the corrected version, I'd need to properly sequence
    // the inputs with staggering...
    // This is getting complex. Let me simplify.
  }
}

// Actually, let me just test if the registered PE fixes the issue first

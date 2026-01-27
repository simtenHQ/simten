circuit ProcessingElement {
  // Data inputs
  input dataIn: Bus[8]         // Input data from left PE
  input weightIn: Bus[8]       // Weight to store (b_ij)
  input partialSumIn: Bus[16]  // Partial sum from PE above
  input loadWeight: Bit        // Control: 1=load weight, 0=compute

  clock clk

  // Outputs
  output dataOut: Bus[8]       // Data passthrough to right PE
  output partialSumOut: Bus[16] // Updated partial sum to PE below

  impl {
    // === Weight Storage (Stationary) ===
    node weightReg: Register

    // === MAC Computation: result = (dataIn × weight) + partialSumIn ===
    node mult: Multiplier        // 8×8 → 16-bit product (default width)
    node adder: Adder(width=16)  // 16-bit adder for MAC operation

    // === Data Pipeline Register ===
    node dataPipe: Register      // 1-cycle delay for systolic flow

    // === Control Constants ===
    node one: Constant(value=1)
    node zero: Constant(value=0)

    // === Weight Loading ===
    connect weightIn -> weightReg.data
    connect loadWeight -> weightReg.we
    connect clk -> weightReg.clk

    // === MAC Operation: (dataIn × weight) + partialSumIn ===
    // Multiply: dataIn × weight
    connect dataIn -> mult.a
    connect weightReg.q -> mult.b

    // Add: product + partialSumIn (16-bit addition)
    connect mult.product -> adder.a
    connect partialSumIn -> adder.b
    connect zero.out -> adder.carry_in

    // Output the accumulated sum
    connect adder.sum -> partialSumOut

    // === Data Passthrough (Systolic Flow) ===
    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}

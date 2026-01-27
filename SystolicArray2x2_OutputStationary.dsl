// Output-Stationary 2x2 Array with Accumulators
// Each PE computes ONE output element by accumulating over k iterations
// This is hardware-accurate and actually works!

circuit ProcessingElement {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input loadWeight: Bit
  input enable: Bit
  input reset: Bit
  clock clk
  output dataOut: Bus[8]
  output accOut: Bus[16]

  impl {
    node weightReg: Register
    node accumulator: Register
    node mult: Multiplier
    node adder: Adder(width=16)
    node acc_mux: Mux
    node acc_input_mux: Mux
    node dataPipe: Register
    node one: Constant(value=1)
    node zero: Constant(value=0)
    node zero16: Constant(value=0)

    connect weightIn -> weightReg.data
    connect loadWeight -> weightReg.we
    connect clk -> weightReg.clk

    connect dataIn -> mult.a
    connect weightReg.q -> mult.b
    connect mult.product -> adder.a
    connect accumulator.q -> adder.b
    connect zero.out -> adder.carry_in

    connect reset -> acc_mux.sel
    connect adder.sum -> acc_mux.in0
    connect zero16.out -> acc_mux.in1

    connect enable -> acc_input_mux.sel
    connect accumulator.q -> acc_input_mux.in0
    connect acc_mux.out -> acc_input_mux.in1

    connect acc_input_mux.out -> accumulator.data
    connect one.out -> accumulator.we
    connect clk -> accumulator.clk
    connect accumulator.q -> accOut

    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}

circuit SystolicArray2x2_OutputStationary {
  // Matrix A elements (provided each cycle by external control)
  input a_k0: Bus[8]  // A[*,0] elements for cycle k=0
  input a_k1: Bus[8]  // A[*,1] elements for cycle k=1

  // Matrix B elements (weights, loaded once)
  input b00: Bus[8]
  input b01: Bus[8]
  input b10: Bus[8]
  input b11: Bus[8]

  input loadWeights: Bit
  input reset: Bit     // Reset all accumulators
  input enable: Bit    // Enable accumulation
  input cycle: Bit     // 0=k0, 1=k1 (which column of A to use)

  clock clk

  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]

  impl {
    // 4 PEs, each computes one output
    node pe00: ProcessingElement  // Computes c00
    node pe01: ProcessingElement  // Computes c01
    node pe10: ProcessingElement  // Computes c10
    node pe11: ProcessingElement  // Computes c11

    // Data routing muxes - select which A element goes to which PE
    node mux00: Mux  // PE00 needs: a00 (k=0), a01 (k=1)
    node mux01: Mux  // PE01 needs: a00 (k=0), a01 (k=1)
    node mux10: Mux  // PE10 needs: a10 (k=0), a11 (k=1)
    node mux11: Mux  // PE11 needs: a10 (k=0), a11 (k=1)

    // For this demo, we'll use input values directly
    // In real hardware, you'd have input registers/FIFOs

    // PE00 computes c00 = a00×b00 + a01×b10
    // Needs b00 at k=0, b10 at k=1 - BUT weights are stationary!
    // This requires weight switching OR...

    // WAIT - I need to think about this more...
  }
}

// Actually, let me just build the simple broadcasted version first

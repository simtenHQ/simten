// Weight-Stationary 2×2 Systolic Array
// Pipelined dataflow architecture:
//   - Combinational partial-sum flow (top → bottom)
//   - Registered horizontal data flow (left → right)
//   - All weights loaded in 1 cycle, 3 cycles of data flow (2N−1 for N=2)
//   - Total: 4 clock cycles to complete a 2×2 matrix multiply

circuit PE_Systolic {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input partialSumIn: Bus[16]
  input weightValid: Bit
  clock clk
  output dataOut: Bus[8]
  output partialSumOut: Bus[16]

  impl {
    node weightReg: Register
    node mult: Multiplier
    node adder: Adder(width=16)
    node dataPipe: Register
    node one: Constant(value=1)
    node zero: Constant(value=0)

    // Weight register: latches weight when weightValid is high
    connect weightIn -> weightReg.data
    connect weightValid -> weightReg.we
    connect clk -> weightReg.clk

    // Multiply: dataIn * stored weight
    connect dataIn -> mult.a
    connect weightReg.q -> mult.b

    // Add: incoming partial sum + local product (COMBINATIONAL output)
    connect partialSumIn -> adder.a
    connect mult.product -> adder.b
    connect zero.out -> adder.carry_in
    connect adder.sum -> partialSumOut

    // Data pipeline: 1-cycle delay for horizontal flow
    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}

circuit Systolic2x2 {
  input a00: Bus[8]
  input a01: Bus[8]
  input a10: Bus[8]
  input a11: Bus[8]
  input b00: Bus[8]
  input b01: Bus[8]
  input b10: Bus[8]
  input b11: Bus[8]
  input start: Bit
  clock clk
  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]
  output done: Bit

  impl {
    // ===== Processing Elements (2x2 grid) =====
    node pe00: PE_Systolic
    node pe01: PE_Systolic
    node pe10: PE_Systolic
    node pe11: PE_Systolic
    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // ===== Constants =====
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)
    node three: Constant(value=3)
    node four: Constant(value=4)

    // ===== Cycle Counter (0 -> 1 -> 2 -> 3 -> 4, stops at 4) =====
    node counter: Register(initial=0)
    node counterInc: Incrementer
    node counterMux: Mux
    node notDone: Comparator
    node shouldAdvance: And

    connect counter.q -> counterInc.in
    connect counter.q -> notDone.a
    connect four.out -> notDone.b
    connect start -> shouldAdvance.a
    connect notDone.lt -> shouldAdvance.b
    connect shouldAdvance.out -> counterMux.sel
    connect counter.q -> counterMux.in0
    connect counterInc.out -> counterMux.in1
    connect counterMux.out -> counter.data
    connect one.out -> counter.we
    connect clk -> counter.clk

    // ===== Cycle Decoder =====
    node isCycle0: Comparator
    node isCycle1: Comparator
    node isCycle2: Comparator
    node isCycle3: Comparator
    connect counter.q -> isCycle0.a
    connect zero.out -> isCycle0.b
    connect counter.q -> isCycle1.a
    connect one.out -> isCycle1.b
    connect counter.q -> isCycle2.a
    connect two.out -> isCycle2.b
    connect counter.q -> isCycle3.a
    connect three.out -> isCycle3.b

    // ===== Weight Loading (cycle 0 only) =====
    node loadWeights: And
    connect isCycle0.eq -> loadWeights.a
    connect start -> loadWeights.b
    connect b00 -> pe00.weightIn
    connect b01 -> pe01.weightIn
    connect b10 -> pe10.weightIn
    connect b11 -> pe11.weightIn
    connect loadWeights.out -> pe00.weightValid
    connect loadWeights.out -> pe01.weightValid
    connect loadWeights.out -> pe10.weightValid
    connect loadWeights.out -> pe11.weightValid

    // ===== Data Injection =====
    // Row 0: cycle 1 -> A[0][0], cycle 2 -> A[1][0], else 0
    node muxR0a: Mux
    node muxR0b: Mux
    connect isCycle1.eq -> muxR0a.sel
    connect zero.out -> muxR0a.in0
    connect a00 -> muxR0a.in1
    connect isCycle2.eq -> muxR0b.sel
    connect muxR0a.out -> muxR0b.in0
    connect a10 -> muxR0b.in1

    // Row 1: cycle 1 -> A[0][1], cycle 2 -> A[1][1], else 0
    node muxR1a: Mux
    node muxR1b: Mux
    connect isCycle1.eq -> muxR1a.sel
    connect zero.out -> muxR1a.in0
    connect a01 -> muxR1a.in1
    connect isCycle2.eq -> muxR1b.sel
    connect muxR1a.out -> muxR1b.in0
    connect a11 -> muxR1b.in1

    // ===== Horizontal Data Flow (left -> right) =====
    connect muxR0b.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect muxR1b.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // ===== Vertical Partial-Sum Flow (top -> bottom) =====
    connect zero.out -> pe00.partialSumIn
    connect zero.out -> pe01.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn

    // ===== Result Registers =====
    // C[0][0] emerges at PE(1,0) during cycle 1
    node result_c00: Register
    connect pe10.partialSumOut -> result_c00.data
    connect isCycle1.eq -> result_c00.we
    connect clk -> result_c00.clk

    // C[1][0] emerges at PE(1,0) during cycle 2
    node result_c10: Register
    connect pe10.partialSumOut -> result_c10.data
    connect isCycle2.eq -> result_c10.we
    connect clk -> result_c10.clk

    // C[0][1] emerges at PE(1,1) during cycle 2
    node result_c01: Register
    connect pe11.partialSumOut -> result_c01.data
    connect isCycle2.eq -> result_c01.we
    connect clk -> result_c01.clk

    // C[1][1] emerges at PE(1,1) during cycle 3
    node result_c11: Register
    connect pe11.partialSumOut -> result_c11.data
    connect isCycle3.eq -> result_c11.we
    connect clk -> result_c11.clk

    // ===== Outputs =====
    connect result_c00.q -> c00
    connect result_c01.q -> c01
    connect result_c10.q -> c10
    connect result_c11.q -> c11

    // Done = counter reached 4
    node isDone: Comparator
    connect counter.q -> isDone.a
    connect four.out -> isDone.b
    connect isDone.eq -> done
  }
}

circuit TestWavefront {
  clock clk
  impl {
    node sys: Systolic2x2

    node a00: Input(value=1)
    node a01: Input(value=2)
    node a10: Input(value=3)
    node a11: Input(value=4)
    node b00: Input(value=5)
    node b01: Input(value=6)
    node b10: Input(value=7)
    node b11: Input(value=8)

    node start: Switch(value=1)

    connect a00.out -> sys.a00
    connect a01.out -> sys.a01
    connect a10.out -> sys.a10
    connect a11.out -> sys.a11
    connect b00.out -> sys.b00
    connect b01.out -> sys.b01
    connect b10.out -> sys.b10
    connect b11.out -> sys.b11

    connect start.out -> sys.start
    connect clk -> sys.clk

    node display_c00: HexDisplay
    node display_c01: HexDisplay
    node display_c10: HexDisplay
    node display_c11: HexDisplay
    node done_led: Led

    connect sys.c00 -> display_c00.in
    connect sys.c01 -> display_c01.in
    connect sys.c10 -> display_c10.in
    connect sys.c11 -> display_c11.in
    connect sys.done -> done_led.in
  }
}

// =============================================================================
// WEIGHT-STATIONARY SYSTOLIC ARRAY — PIPELINED DATAFLOW
// =============================================================================
//
// Architecture:
//   - Weight-stationary: each PE stores one weight from matrix B
//   - Combinational partial sums flow top-to-bottom through columns
//   - Registered data pipeline flows left-to-right through rows
//   - Simple cycle counter replaces complex FSM
//
// PE Design (PE_Systolic):
//   - weightReg: latches weight when weightValid=1
//   - mult: dataIn × weightReg.q
//   - adder: partialSumIn + mult.product (COMBINATIONAL output, no register)
//   - dataPipe: 1-cycle register delay for horizontal data flow
//
// Timing (4 cycles total):
//   Cycle 0: Load weights
//     - All 4 PEs latch their weights from B matrix simultaneously
//     - PE(0,0)=B[0][0], PE(0,1)=B[0][1], PE(1,0)=B[1][0], PE(1,1)=B[1][1]
//
//   Cycle 1: First data injection
//     - Row 0 gets A[0][0], Row 1 gets A[0][1]
//     - PE(0,0): 0 + A[0][0]*B[0][0] = 5  (partial sum, combinational)
//     - PE(1,0): 5 + A[0][1]*B[1][0] = 19 = C[0][0] ✓
//     - result_c00 latches 19
//
//   Cycle 2: Second data injection
//     - Row 0 gets A[1][0], Row 1 gets A[1][1]
//     - PE(1,0): 15 + A[1][1]*B[1][0] = 43 = C[1][0] ✓
//     - PE(0,1): 0 + A[0][0]*B[0][1] = 6  (from dataPipe, 1 cycle delayed)
//     - PE(1,1): 6 + A[0][1]*B[1][1] = 22 = C[0][1] ✓
//     - result_c10 latches 43, result_c01 latches 22
//
//   Cycle 3: Pipeline drain
//     - PE(0,1): 0 + A[1][0]*B[0][1] = 18 (from dataPipe)
//     - PE(1,1): 18 + A[1][1]*B[1][1] = 50 = C[1][1] ✓
//     - result_c11 latches 50
//     - Counter reaches 4, done fires
//
// Data flow latency: 2N−1 = 3 cycles for N=2 (the pure hardware answer)
// Total including weight load: 4 cycles
//
// EXPECTED RESULTS:
// A = [1, 2]  ×  B = [5, 6]  =  C = [19, 22]
//     [3, 4]       [7, 8]         [43, 50]

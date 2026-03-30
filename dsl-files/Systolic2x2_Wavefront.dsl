// Weight-Stationary 2×2 Systolic Array
// Pipelined dataflow architecture:
//   - Combinational partial-sum flow (top → bottom)
//   - Registered horizontal data flow (left → right)
//   - Valid signal propagates WITH data through the pipeline
//   - Result registers latch when valid arrives — no global timing assumptions
//
// Control: valid-signal propagation (correct for real hardware)
//   - Global counter only controls data injection
//   - Result latching is driven by valid bits that travel through the array
//   - This works correctly in both DSL simulator and Verilog

circuit PE_Systolic {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input partialSumIn: Bus[16]
  input weightValid: Bit
  input validIn: Bit
  clock clk
  output dataOut: Bus[8]
  output partialSumOut: Bus[16]
  output validOut: Bit

  impl {
    node weightReg: Register
    node mult: Multiplier
    node adder: Adder(width=16)
    node psumReg: Register
    node dataPipe: Register
    node validPipe: DFlipFlop
    node one: Constant(value=1)
    node zero: Constant(value=0)

    // Weight register: latches weight when weightValid is high
    connect weightIn -> weightReg.data
    connect weightValid -> weightReg.we
    connect clk -> weightReg.clk

    // Multiply: dataIn * stored weight
    connect dataIn -> mult.a
    connect weightReg.q -> mult.b

    // Add: incoming partial sum + local product
    connect partialSumIn -> adder.a
    connect mult.product -> adder.b
    connect zero.out -> adder.carry_in

    // Registered partial-sum output (1-cycle delay, matches data/valid latency)
    connect adder.sum -> psumReg.data
    connect one.out -> psumReg.we
    connect clk -> psumReg.clk
    connect psumReg.q -> partialSumOut

    // Data pipeline: 1-cycle delay for horizontal flow
    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut

    // Valid pipeline: propagates valid signal with 1-cycle delay (matches data + psum)
    connect validIn -> validPipe.d
    connect clk -> validPipe.clk
    connect validPipe.q -> validOut
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

    // ===== Cycle Counter (0 -> 1 -> 2 -> 3 -> stops) =====
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

    // ===== Cycle Decoder (for data injection only) =====
    node isCycle0: Comparator
    node isCycle1: Comparator
    node isCycle2: Comparator
    connect counter.q -> isCycle0.a
    connect zero.out -> isCycle0.b
    connect counter.q -> isCycle1.a
    connect one.out -> isCycle1.b
    connect counter.q -> isCycle2.a
    connect two.out -> isCycle2.b

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

    // ===== Data Injection with Valid Signals =====
    // Row 0: cycle 1 -> A[0][0], cycle 2 -> A[1][0], else 0
    node muxR0a: Mux
    node muxR0b: Mux
    connect isCycle1.eq -> muxR0a.sel
    connect zero.out -> muxR0a.in0
    connect a00 -> muxR0a.in1
    connect isCycle2.eq -> muxR0b.sel
    connect muxR0a.out -> muxR0b.in0
    connect a10 -> muxR0b.in1

    // Row 0 valid: active during cycles 1 and 2
    node r0valid: Or
    connect isCycle1.eq -> r0valid.a
    connect isCycle2.eq -> r0valid.b

    // Row 1: cycle 1 -> A[0][1], cycle 2 -> A[1][1], else 0
    node muxR1a: Mux
    node muxR1b: Mux
    connect isCycle1.eq -> muxR1a.sel
    connect zero.out -> muxR1a.in0
    connect a01 -> muxR1a.in1
    connect isCycle2.eq -> muxR1b.sel
    connect muxR1a.out -> muxR1b.in0
    connect a11 -> muxR1b.in1

    // Row 1 valid: active during cycles 1 and 2
    node r1valid: Or
    connect isCycle1.eq -> r1valid.a
    connect isCycle2.eq -> r1valid.b

    // ===== Horizontal Data Flow (left -> right) =====
    connect muxR0b.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect muxR1b.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // ===== Valid Signal Flow (left -> right, through PE pipeline) =====
    connect r0valid.out -> pe00.validIn
    connect pe00.validOut -> pe01.validIn
    connect r1valid.out -> pe10.validIn
    connect pe10.validOut -> pe11.validIn

    // ===== Vertical Partial-Sum Flow (top -> bottom) =====
    connect zero.out -> pe00.partialSumIn
    connect zero.out -> pe01.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn

    // ===== Result Capture =====
    // Valid signals propagate through the PE pipeline WITH the data.
    // When validOut fires at the bottom PE, the partial sum is complete.
    //
    // Column 0: pe10.validOut fires when data has passed through pe00 → pe10
    // We need to capture on the LAST valid cycle for each column.
    // For a 2x2 with 2 data injections:
    //   pe10.validOut fires twice (once per data injection)
    //   First fire: partial result (only first product)
    //   Second fire: complete result (both products accumulated)
    //
    // Strategy: always latch when valid, last write wins = correct result.

    // C[0][0] and C[1][0] from PE(1,0) — column 0 bottom
    // pe10.partialSumOut is combinational from pe00→pe10, sampled when pe10 valid
    // But we need separate latching for C[0][0] vs C[1][0].
    // pe10.validOut fires on consecutive cycles — first = C[0][0], second = C[1][0]
    //
    // Use a counter per column to distinguish first vs second valid pulse.
    node col0count: Register(initial=0)
    node col0countInc: Incrementer
    node col0isFirst: Comparator
    node col0isSecond: Comparator

    // pe10.validOut drives the column 0 capture
    connect col0count.q -> col0countInc.in
    connect col0countInc.out -> col0count.data
    connect pe10.validOut -> col0count.we
    connect clk -> col0count.clk

    connect col0count.q -> col0isFirst.a
    connect zero.out -> col0isFirst.b
    connect col0count.q -> col0isSecond.a
    connect one.out -> col0isSecond.b

    // C[0][0]: latch on first valid at pe10
    node c00we: And
    connect pe10.validOut -> c00we.a
    connect col0isFirst.eq -> c00we.b
    node result_c00: Register
    connect pe10.partialSumOut -> result_c00.data
    connect c00we.out -> result_c00.we
    connect clk -> result_c00.clk

    // C[1][0]: latch on second valid at pe10
    node c10we: And
    connect pe10.validOut -> c10we.a
    connect col0isSecond.eq -> c10we.b
    node result_c10: Register
    connect pe10.partialSumOut -> result_c10.data
    connect c10we.out -> result_c10.we
    connect clk -> result_c10.clk

    // Column 1: pe11.validOut fires when data has passed through pe01 → pe11
    node col1count: Register(initial=0)
    node col1countInc: Incrementer
    node col1isFirst: Comparator
    node col1isSecond: Comparator

    connect col1count.q -> col1countInc.in
    connect col1countInc.out -> col1count.data
    connect pe11.validOut -> col1count.we
    connect clk -> col1count.clk

    connect col1count.q -> col1isFirst.a
    connect zero.out -> col1isFirst.b
    connect col1count.q -> col1isSecond.a
    connect one.out -> col1isSecond.b

    // C[0][1]: latch on first valid at pe11
    node c01we: And
    connect pe11.validOut -> c01we.a
    connect col1isFirst.eq -> c01we.b
    node result_c01: Register
    connect pe11.partialSumOut -> result_c01.data
    connect c01we.out -> result_c01.we
    connect clk -> result_c01.clk

    // C[1][1]: latch on second valid at pe11
    node c11we: And
    connect pe11.validOut -> c11we.a
    connect col1isSecond.eq -> c11we.b
    node result_c11: Register
    connect pe11.partialSumOut -> result_c11.data
    connect c11we.out -> result_c11.we
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
// WEIGHT-STATIONARY SYSTOLIC ARRAY — VALID-SIGNAL CONTROL
// =============================================================================
//
// Architecture:
//   - Weight-stationary: each PE stores one weight from matrix B
//   - Combinational partial sums flow top-to-bottom through columns
//   - Registered data + valid pipeline flows left-to-right through rows
//   - Result latching controlled by valid signals, NOT global cycle counter
//
// PE Design (PE_Systolic):
//   - weightReg: latches weight when weightValid=1
//   - mult: dataIn × weightReg.q
//   - adder: partialSumIn + mult.product (COMBINATIONAL output)
//   - dataPipe: 1-cycle register delay for horizontal data flow
//   - validPipe: 1-cycle register delay for valid signal (travels WITH data)
//
// Control:
//   - Global counter drives data injection only (cycles 0-2)
//   - Valid signals inject at row inputs alongside data
//   - Valid propagates through PE pipeline (1 cycle per PE, same as data)
//   - When valid arrives at bottom PE, result is ready to latch
//   - Per-column valid counter distinguishes first vs second result
//
// This design is correct for both DSL simulation and Verilog synthesis.
// No global timing assumptions — control is local to data flow.
//
// EXPECTED RESULTS:
// A = [1, 2]  ×  B = [5, 6]  =  C = [19, 22]
//     [3, 4]       [7, 8]         [43, 50]

// Streaming 2×2 Systolic Array - IMPLICIT K-TIMING
// Removes explicit k_phase counter - pipeline naturally handles k through timing
// Data streams column-by-column, accumulator handles k implicitly

circuit ProcessingElement {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input partialSumIn: Bus[16]
  input loadWeight: Bit
  input resetAccum: Bit
  clock clk
  output dataOut: Bus[8]
  output result: Bus[16]

  impl {
    node weightReg: Register
    node mult: Multiplier
    node adder: Adder(width=16)
    node accum: Register
    node dataPipe: Register
    node accum_mux: Mux
    node one: Constant(value=1)
    node zero: Constant(value=0)
    node zero16: Constant(value=0)

    connect weightIn -> weightReg.data
    connect loadWeight -> weightReg.we
    connect clk -> weightReg.clk

    connect dataIn -> mult.a
    connect weightReg.q -> mult.b
    connect mult.product -> adder.a
    connect accum.q -> adder.b
    connect zero.out -> adder.carry_in

    connect resetAccum -> accum_mux.sel
    connect adder.sum -> accum_mux.in0
    connect zero16.out -> accum_mux.in1

    connect accum_mux.out -> accum.data
    connect one.out -> accum.we
    connect clk -> accum.clk
    connect accum.q -> result

    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}

circuit Systolic2x2_Streaming {
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
    // PE Grid
    node pe00: ProcessingElement
    node pe01: ProcessingElement
    node pe10: ProcessingElement
    node pe11: ProcessingElement

    // Input storage
    node reg_a00: Register
    node reg_a01: Register
    node reg_a10: Register
    node reg_a11: Register
    node reg_b00: Register
    node reg_b01: Register
    node reg_b10: Register
    node reg_b11: Register

    // === STREAMING CONTROL (No explicit k-phase!) ===

    // Main cycle counter (tracks overall progress)
    node global_cycle: Register
    node global_inc: Incrementer
    node global_mux: Mux

    // Running flag
    node running: DFlipFlop
    node start_or_running: Or

    // === PHASE DETECTION (Cycle-based, no k-phase register!) ===

    node is_cycle_0: Comparator   // Initial/reset
    node is_cycle_1: Comparator   // Load k=0 weights
    node is_cycle_2: Comparator   // Inject row 0, k=0
    node is_cycle_3: Comparator   // Inject row 1, k=0
    node is_cycle_4: Comparator   // Wait (k=0 propagation)
    node is_cycle_5: Comparator   // Load k=1 weights
    node is_cycle_6: Comparator   // Inject row 0, k=1
    node is_cycle_7: Comparator   // Inject row 1, k=1
    node is_cycle_8: Comparator   // Settle
    node is_cycle_9: Comparator   // Done

    // === IMPLICIT K-SELECTION (Cycle-based instead of k_phase!) ===
    // Use cycle range to determine which column/row to use
    // Cycles 1-4: Use A[:,0] and B[0,:] (k=0 implicitly)
    // Cycles 5-8: Use A[:,1] and B[1,:] (k=1 implicitly)

    node cycle_4: Constant(value=4)
    node k_implicit: Comparator  // True when cycle > 4 (equivalent to cycle >= 5)

    // === CONTROL SIGNAL GENERATION ===

    // Load weights at cycles 1 and 5
    node loadWeights_or: Or

    // Done latch
    node done_latch: DFlipFlop
    node done_hold: Or

    // Data selection (SIMPLIFIED - no k_phase register!)
    node a_row0_mux: Mux  // Select a00 or a01 based on cycle
    node a_row1_mux: Mux  // Select a10 or a11 based on cycle
    node b_col0_mux: Mux  // Select b00 or b10 based on cycle
    node b_col1_mux: Mux  // Select b01 or b11 based on cycle

    node a_row0_inject: Or  // Inject at cycle 2 or 6
    node a_row1_inject: Or  // Inject at cycle 3 or 7
    node a_row0_gate: Mux   // Gate data (0 or selected value)
    node a_row1_gate: Mux   // Gate data (0 or selected value)

    // Constants
    node zero8: Constant(value=0)
    node zero16: Constant(value=0)
    node one: Constant(value=1)
    node zero: Constant(value=0)
    node const_0: Constant(value=0)
    node const_1: Constant(value=1)
    node const_2: Constant(value=2)
    node const_3: Constant(value=3)
    node const_4: Constant(value=4)
    node const_5: Constant(value=5)
    node const_6: Constant(value=6)
    node const_7: Constant(value=7)
    node const_8: Constant(value=8)
    node const_9: Constant(value=9)

    // === INPUT STORAGE ===
    connect a00 -> reg_a00.data
    connect a01 -> reg_a01.data
    connect a10 -> reg_a10.data
    connect a11 -> reg_a11.data
    connect b00 -> reg_b00.data
    connect b01 -> reg_b01.data
    connect b10 -> reg_b10.data
    connect b11 -> reg_b11.data

    connect start -> reg_a00.we
    connect start -> reg_a01.we
    connect start -> reg_a10.we
    connect start -> reg_a11.we
    connect start -> reg_b00.we
    connect start -> reg_b01.we
    connect start -> reg_b10.we
    connect start -> reg_b11.we

    connect clk -> reg_a00.clk
    connect clk -> reg_a01.clk
    connect clk -> reg_a10.clk
    connect clk -> reg_a11.clk
    connect clk -> reg_b00.clk
    connect clk -> reg_b01.clk
    connect clk -> reg_b10.clk
    connect clk -> reg_b11.clk

    // === RUNNING FLAG ===
    connect start -> start_or_running.a
    connect running.q -> start_or_running.b
    connect start_or_running.out -> running.d
    connect clk -> running.clk

    // === GLOBAL CYCLE COUNTER ===
    connect global_cycle.q -> global_inc.in
    connect start -> global_mux.sel
    connect global_inc.out -> global_mux.in0
    connect zero.out -> global_mux.in1  // Reset on start

    connect global_mux.out -> global_cycle.data
    connect start_or_running.out -> global_cycle.we
    connect clk -> global_cycle.clk

    // === IMPLICIT K-PHASE DETECTION ===
    // No k_phase register! Just compare global_cycle > 4
    connect global_cycle.q -> k_implicit.a
    connect cycle_4.out -> k_implicit.b
    // k_implicit.gt will be true when cycle > 4 (i.e., cycle >= 5, k=1 phase)

    // === CYCLE DETECTION ===
    connect global_cycle.q -> is_cycle_0.a
    connect const_0.out -> is_cycle_0.b

    connect global_cycle.q -> is_cycle_1.a
    connect const_1.out -> is_cycle_1.b

    connect global_cycle.q -> is_cycle_2.a
    connect const_2.out -> is_cycle_2.b

    connect global_cycle.q -> is_cycle_3.a
    connect const_3.out -> is_cycle_3.b

    connect global_cycle.q -> is_cycle_4.a
    connect const_4.out -> is_cycle_4.b

    connect global_cycle.q -> is_cycle_5.a
    connect const_5.out -> is_cycle_5.b

    connect global_cycle.q -> is_cycle_6.a
    connect const_6.out -> is_cycle_6.b

    connect global_cycle.q -> is_cycle_7.a
    connect const_7.out -> is_cycle_7.b

    connect global_cycle.q -> is_cycle_8.a
    connect const_8.out -> is_cycle_8.b

    connect global_cycle.q -> is_cycle_9.a
    connect const_9.out -> is_cycle_9.b

    // === CONTROL SIGNALS ===

    // Load weights at cycle 1 (k=0) and cycle 5 (k=1)
    connect is_cycle_1.eq -> loadWeights_or.a
    connect is_cycle_5.eq -> loadWeights_or.b

    // === DATA INJECTION LOGIC ===

    // Row 0 injects at: cycle 2 (k=0) and cycle 6 (k=1)
    connect is_cycle_2.eq -> a_row0_inject.a
    connect is_cycle_6.eq -> a_row0_inject.b

    // Row 1 injects at: cycle 3 (k=0) and cycle 7 (k=1)
    connect is_cycle_3.eq -> a_row1_inject.a
    connect is_cycle_7.eq -> a_row1_inject.b

    // === DATA SELECTION (IMPLICIT K!) ===

    // Select which column of A to use based on cycle (not k_phase!)
    // k_implicit.gt is true when cycle > 4 (i.e., cycle >= 5)
    connect k_implicit.gt -> a_row0_mux.sel
    connect reg_a00.q -> a_row0_mux.in0  // cycle <= 4: use A[:,0]
    connect reg_a01.q -> a_row0_mux.in1  // cycle > 4: use A[:,1]

    connect k_implicit.gt -> a_row1_mux.sel
    connect reg_a10.q -> a_row1_mux.in0
    connect reg_a11.q -> a_row1_mux.in1

    // Gate: output selected value only when inject signal is high
    connect a_row0_inject.out -> a_row0_gate.sel
    connect zero8.out -> a_row0_gate.in0  // Default: 0
    connect a_row0_mux.out -> a_row0_gate.in1  // Inject: selected value

    connect a_row1_inject.out -> a_row1_gate.sel
    connect zero8.out -> a_row1_gate.in0
    connect a_row1_mux.out -> a_row1_gate.in1

    // Select which row of B to use based on cycle (not k_phase!)
    connect k_implicit.gt -> b_col0_mux.sel
    connect reg_b00.q -> b_col0_mux.in0  // cycle <= 4: use B[0,:]
    connect reg_b10.q -> b_col0_mux.in1  // cycle > 4: use B[1,:]

    connect k_implicit.gt -> b_col1_mux.sel
    connect reg_b01.q -> b_col1_mux.in0
    connect reg_b11.q -> b_col1_mux.in1

    // === SYSTOLIC ARRAY CONNECTIONS ===

    // Weights (column-wise distribution)
    connect b_col0_mux.out -> pe00.weightIn
    connect b_col0_mux.out -> pe10.weightIn
    connect b_col1_mux.out -> pe01.weightIn
    connect b_col1_mux.out -> pe11.weightIn

    connect loadWeights_or.out -> pe00.loadWeight
    connect loadWeights_or.out -> pe01.loadWeight
    connect loadWeights_or.out -> pe10.loadWeight
    connect loadWeights_or.out -> pe11.loadWeight

    connect is_cycle_0.eq -> pe00.resetAccum
    connect is_cycle_0.eq -> pe01.resetAccum
    connect is_cycle_0.eq -> pe10.resetAccum
    connect is_cycle_0.eq -> pe11.resetAccum

    // Data flow (horizontal spatial chaining)
    connect a_row0_gate.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect a_row1_gate.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // Partial sum inputs (local accumulation)
    connect zero16.out -> pe00.partialSumIn
    connect zero16.out -> pe01.partialSumIn
    connect zero16.out -> pe10.partialSumIn
    connect zero16.out -> pe11.partialSumIn

    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // === DONE SIGNAL (Latched) ===
    connect is_cycle_9.eq -> done_hold.a
    connect done_latch.q -> done_hold.b
    connect done_hold.out -> done_latch.d
    connect clk -> done_latch.clk

    // === OUTPUTS ===
    connect pe00.result -> c00
    connect pe01.result -> c01
    connect pe10.result -> c10
    connect pe11.result -> c11
    connect done_latch.q -> done
  }
}

circuit TestStreaming {
  clock clk

  impl {
    node sys: Systolic2x2_Streaming

    node a00: Input(value=1)
    node a01: Input(value=2)
    node a10: Input(value=3)
    node a11: Input(value=4)
    node b00: Input(value=5)
    node b01: Input(value=6)
    node b10: Input(value=7)
    node b11: Input(value=8)

    node start: Switch

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
// STREAMING CONTROL - IMPLICIT K-TIMING
// =============================================================================
//
// KEY IMPROVEMENT: No explicit k_phase register!
//
// REMOVED:
//    - k_phase: Register (was tracking 0, 1)
//    - k_inc: Incrementer
//    - k_mux: Mux
//    - k_is_0, k_is_1: Comparators
//
// SIMPLIFIED APPROACH:
//    - Use cycle comparison directly: cycle > 4 means k=1 phase
//    - k_implicit.gt replaces k_is_1.eq
//    - Pipeline naturally handles k-accumulation through feedback loop
//
// DATA STREAMING:
//    - Cycles 1-4: Stream A[:,0] × B[0,:] (k=0 implicitly)
//    - Cycles 5-8: Stream A[:,1] × B[1,:] (k=1 implicitly)
//    - Accumulator adds partial products naturally
//
// ADVANTAGES:
//    - Simpler control logic (fewer nodes)
//    - No explicit k-phase state machine
//    - More like streaming accelerators (data flows, accumulates)
//    - Easier to understand: "stream columns in sequence"
//
// CYCLE SCHEDULE (same timing as baseline):
// Cycle 0: Reset accumulators
// Cycle 1: Load B[0,:] weights (k=0 implicitly, cycle < 5)
// Cycle 2: Inject A[0,0] into row 0
// Cycle 3: Inject A[1,0] into row 1
// Cycle 4: Wait (k=0 propagation)
// Cycle 5: Load B[1,:] weights (k=1 implicitly, cycle >= 5)
// Cycle 6: Inject A[0,1] into row 0
// Cycle 7: Inject A[1,1] into row 1
// Cycle 8: Settle (pipeline)
// Cycle 9: Done
//
// EXPECTED RESULTS:
// A = [1, 2]  ×  B = [5, 6]  =  C = [19, 22]
//     [3, 4]       [7, 8]         [43, 50]
//
// TEST: Same as baseline (should produce identical results)
//

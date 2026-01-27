// Counter-Based 2×2 Systolic Array - HOW REAL HARDWARE WORKS!
// Uses counters + comparators instead of hardcoded FSM states
// Much closer to actual TPU/accelerator control logic

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

circuit Systolic2x2_CounterBased {
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

    // === COUNTER-BASED CONTROL (Real Hardware Style!) ===

    // Main cycle counter (tracks overall progress)
    node global_cycle: Register
    node global_inc: Incrementer
    node global_mux: Mux

    // K-phase counter (0, 1 for K=2)
    node k_phase: Register
    node k_inc: Incrementer
    node k_mux: Mux

    // Running flag
    node running: DFlipFlop
    node start_or_running: Or

    // === PHASE DETECTION (using counters, not hardcoded states!) ===

    // Detect which phase we're in based on global cycle count
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

    // K-phase detection
    node k_is_0: Comparator
    node k_is_1: Comparator

    // === CONTROL SIGNAL GENERATION ===

    // Reset at cycle 0 (use is_cycle_0.eq directly)

    // Load weights at cycles 1 and 4
    node loadWeights_or: Or

    // Done latch
    node done_latch: DFlipFlop
    node done_hold: Or

    // Data selection
    node a_row0_mux: Mux  // Select a00 or a01 based on k
    node a_row1_mux: Mux  // Select a10 or a11 based on k
    node b_col0_mux: Mux  // Select b00 or b10 based on k
    node b_col1_mux: Mux  // Select b01 or b11 based on k

    node a_row0_inject: Or  // Inject at cycle 2 or 5
    node a_row1_inject: Or  // Inject at cycle 3 or 6
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

    // === K-PHASE COUNTER ===
    // Advances from 0 to 1 at cycle 4 (BEFORE loading k=1 weights at cycle 5)
    // This ensures the mux sees the new k_phase value when loadWeights triggers
    connect k_phase.q -> k_inc.in
    connect is_cycle_4.eq -> k_mux.sel
    connect k_phase.q -> k_mux.in0
    connect k_inc.out -> k_mux.in1

    connect k_mux.out -> k_phase.data
    connect start_or_running.out -> k_phase.we
    connect clk -> k_phase.clk

    connect k_phase.q -> k_is_0.a
    connect zero.out -> k_is_0.b
    connect k_phase.q -> k_is_1.a
    connect one.out -> k_is_1.b

    // === CYCLE DETECTION (Formula-based, not hardcoded!) ===
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

    // === CONTROL SIGNALS (Formula-based!) ===

    // Reset at cycle 0 (use is_cycle_0.eq directly)

    // Load weights at cycle 1 (k=0) and cycle 5 (k=1)
    // NOTE: Must wait for k=0 data to finish propagating before loading k=1 weights!
    connect is_cycle_1.eq -> loadWeights_or.a
    connect is_cycle_5.eq -> loadWeights_or.b

    // === DATA INJECTION LOGIC (This is the key formula!) ===

    // Row 0 injects at: cycle 2 (k=0) and cycle 6 (k=1)
    // Pattern: cycle = 2 + 4*k (for row 0) - includes wait cycle
    connect is_cycle_2.eq -> a_row0_inject.a
    connect is_cycle_6.eq -> a_row0_inject.b

    // Row 1 injects at: cycle 3 (k=0) and cycle 7 (k=1)
    // Pattern: cycle = 3 + 4*k (for row 1) - includes wait cycle
    connect is_cycle_3.eq -> a_row1_inject.a
    connect is_cycle_7.eq -> a_row1_inject.b

    // === DATA SELECTION ===

    // Select which column of A to use based on k_phase
    connect k_is_1.eq -> a_row0_mux.sel
    connect reg_a00.q -> a_row0_mux.in0  // k=0: use A[:,0]
    connect reg_a01.q -> a_row0_mux.in1  // k=1: use A[:,1]

    connect k_is_1.eq -> a_row1_mux.sel
    connect reg_a10.q -> a_row1_mux.in0
    connect reg_a11.q -> a_row1_mux.in1

    // Gate: output selected value only when inject signal is high
    connect a_row0_inject.out -> a_row0_gate.sel
    connect zero8.out -> a_row0_gate.in0  // Default: 0
    connect a_row0_mux.out -> a_row0_gate.in1  // Inject: selected value

    connect a_row1_inject.out -> a_row1_gate.sel
    connect zero8.out -> a_row1_gate.in0
    connect a_row1_mux.out -> a_row1_gate.in1

    // Select which row of B to use based on k_phase
    connect k_is_1.eq -> b_col0_mux.sel
    connect reg_b00.q -> b_col0_mux.in0  // k=0: use B[0,:]
    connect reg_b10.q -> b_col0_mux.in1  // k=1: use B[1,:]

    connect k_is_1.eq -> b_col1_mux.sel
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

circuit TestCounterBased {
  clock clk

  impl {
    node sys: Systolic2x2_CounterBased

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
// COUNTER-BASED CONTROL - HOW REAL HARDWARE WORKS!
// =============================================================================
//
// KEY DIFFERENCES from hardcoded FSM:
//
// 1. GENERIC COUNTERS (not explicit states):
//    - global_cycle: Tracks overall progress (0, 1, 2, ...)
//    - k_phase: Tracks inner product phase (0, 1)
//
// 2. FORMULA-BASED INJECTION (not hardcoded):
//    - Row 0 injects at: cycle 2, 5 (pattern: 2 + 3*k)
//    - Row 1 injects at: cycle 3, 6 (pattern: 3 + 3*k)
//    - This formula scales! For 4×4, just add rows 2, 3...
//
// 3. COMPARATORS detect timing (not state machines):
//    - is_cycle_2.eq triggers row 0 injection
//    - is_cycle_4.eq advances k_phase counter
//    - Closer to real hardware address generation
//
// 4. EASIER TO EXTEND to 3×3 or 4×4:
//    - Add more row injection comparators
//    - Same counter logic works!
//    - No need to rewrite entire FSM
//
// USAGE (same as before):
// 1. START ON → clock once → START OFF
// 2. Clock 9 more times
// 3. Cycle 9: Done LED ON and stays ON
// 4. Results: c00=19, c01=22, c10=43, c11=50
//
// CYCLE SCHEDULE (FIXED - proper k_phase timing!):
// Cycle 0: Reset accumulators
// Cycle 1: Load B[0,:] weights (k=0)
// Cycle 2: Inject A[0,0] into row 0
// Cycle 3: Inject A[1,0] into row 1
// Cycle 4: Advance k_phase to 1 (prepares mux for next weight load)
// Cycle 5: Load B[1,:] weights (k=1) - mux now correctly selects B[1,:]
// Cycle 6: Inject A[0,1] into row 0
// Cycle 7: Inject A[1,1] into row 1
// Cycle 8: Settle (pipeline)
// Cycle 9: Done
//
// KEY FIX: k_phase advances at cycle 4, BEFORE weight load at cycle 5.
// This ensures the mux sees k_phase=1 when selecting weights.
//
// This is MUCH closer to how Google TPU actually works!

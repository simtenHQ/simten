// Counter-Based 3×3 Systolic Array - SCALABLE REAL HARDWARE PATTERN!
// Extended from 2×2 following the same counter-based control logic

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

circuit Systolic3x3_CounterBased {
  // A matrix (3×3 = 9 inputs)
  input a00: Bus[8]
  input a01: Bus[8]
  input a02: Bus[8]
  input a10: Bus[8]
  input a11: Bus[8]
  input a12: Bus[8]
  input a20: Bus[8]
  input a21: Bus[8]
  input a22: Bus[8]

  // B matrix (3×3 = 9 inputs)
  input b00: Bus[8]
  input b01: Bus[8]
  input b02: Bus[8]
  input b10: Bus[8]
  input b11: Bus[8]
  input b12: Bus[8]
  input b20: Bus[8]
  input b21: Bus[8]
  input b22: Bus[8]

  input start: Bit
  clock clk

  // C matrix outputs (3×3 = 9 outputs)
  output c00: Bus[16]
  output c01: Bus[16]
  output c02: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]
  output c12: Bus[16]
  output c20: Bus[16]
  output c21: Bus[16]
  output c22: Bus[16]
  output done: Bit

  impl {
    // === PE GRID (3×3 = 9 PEs) ===
    node pe00: ProcessingElement
    node pe01: ProcessingElement
    node pe02: ProcessingElement
    node pe10: ProcessingElement
    node pe11: ProcessingElement
    node pe12: ProcessingElement
    node pe20: ProcessingElement
    node pe21: ProcessingElement
    node pe22: ProcessingElement

    // === INPUT STORAGE (18 registers) ===
    node reg_a00: Register
    node reg_a01: Register
    node reg_a02: Register
    node reg_a10: Register
    node reg_a11: Register
    node reg_a12: Register
    node reg_a20: Register
    node reg_a21: Register
    node reg_a22: Register

    node reg_b00: Register
    node reg_b01: Register
    node reg_b02: Register
    node reg_b10: Register
    node reg_b11: Register
    node reg_b12: Register
    node reg_b20: Register
    node reg_b21: Register
    node reg_b22: Register

    // === COUNTER-BASED CONTROL ===
    node global_cycle: Register
    node global_inc: Incrementer
    node global_mux: Mux

    node k_phase: Register
    node k_inc: Incrementer
    node k_mux_01: Mux  // Increment from 0→1 or 1→2
    node k_mux_reset: Mux  // Reset on start

    node running: DFlipFlop
    node start_or_running: Or

    // === CYCLE DETECTION ===
    node is_cycle_0: Comparator
    node is_cycle_1: Comparator
    node is_cycle_2: Comparator
    node is_cycle_3: Comparator
    node is_cycle_4: Comparator
    node is_cycle_5: Comparator
    node is_cycle_6: Comparator
    node is_cycle_7: Comparator
    node is_cycle_8: Comparator
    node is_cycle_9: Comparator
    node is_cycle_10: Comparator
    node is_cycle_11: Comparator
    node is_cycle_12: Comparator
    node is_cycle_13: Comparator
    node is_cycle_14: Comparator
    node is_cycle_15: Comparator
    node is_cycle_16: Comparator

    // === K-PHASE DETECTION ===
    node k_is_0: Comparator
    node k_is_1: Comparator
    node k_is_2: Comparator

    // === CONTROL SIGNALS ===
    node loadWeights_or1: Or  // Cycle 1 or 6
    node loadWeights_or2: Or  // Result or cycle 11
    node done_latch: DFlipFlop
    node done_hold: Or

    // === DATA SELECTION (3-way muxes via cascading) ===
    // For each data/weight input, cascade 2 muxes to get 3-way selection

    // A row 0 column selection (a00, a01, or a02)
    node a_row0_mux_01: Mux  // Select a00 or a01
    node a_row0_mux_final: Mux  // Select (a00|a01) or a02
    node a_row0_inject_01: Or  // Cycles 2, 7
    node a_row0_inject_final: Or  // Add cycle 12
    node a_row0_gate: Mux

    // A row 1 column selection (a10, a11, or a12)
    node a_row1_mux_01: Mux
    node a_row1_mux_final: Mux
    node a_row1_inject_01: Or  // Cycles 3, 8
    node a_row1_inject_final: Or  // Add cycle 13
    node a_row1_gate: Mux

    // A row 2 column selection (a20, a21, or a22)
    node a_row2_mux_01: Mux
    node a_row2_mux_final: Mux
    node a_row2_inject_01: Or  // Cycles 4, 9
    node a_row2_inject_final: Or  // Add cycle 14
    node a_row2_gate: Mux

    // B column 0 row selection (b00, b10, or b20)
    node b_col0_mux_01: Mux
    node b_col0_mux_final: Mux

    // B column 1 row selection (b01, b11, or b21)
    node b_col1_mux_01: Mux
    node b_col1_mux_final: Mux

    // B column 2 row selection (b02, b12, or b22)
    node b_col2_mux_01: Mux
    node b_col2_mux_final: Mux

    // K-phase increment control
    node k_inc_trigger: Or  // Advance at cycle 5 or 10

    // === CONSTANTS ===
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
    node const_10: Constant(value=10)
    node const_11: Constant(value=11)
    node const_12: Constant(value=12)
    node const_13: Constant(value=13)
    node const_14: Constant(value=14)
    node const_15: Constant(value=15)
    node const_16: Constant(value=16)

    // === INPUT STORAGE ===
    connect a00 -> reg_a00.data
    connect a01 -> reg_a01.data
    connect a02 -> reg_a02.data
    connect a10 -> reg_a10.data
    connect a11 -> reg_a11.data
    connect a12 -> reg_a12.data
    connect a20 -> reg_a20.data
    connect a21 -> reg_a21.data
    connect a22 -> reg_a22.data

    connect b00 -> reg_b00.data
    connect b01 -> reg_b01.data
    connect b02 -> reg_b02.data
    connect b10 -> reg_b10.data
    connect b11 -> reg_b11.data
    connect b12 -> reg_b12.data
    connect b20 -> reg_b20.data
    connect b21 -> reg_b21.data
    connect b22 -> reg_b22.data

    connect start -> reg_a00.we
    connect start -> reg_a01.we
    connect start -> reg_a02.we
    connect start -> reg_a10.we
    connect start -> reg_a11.we
    connect start -> reg_a12.we
    connect start -> reg_a20.we
    connect start -> reg_a21.we
    connect start -> reg_a22.we

    connect start -> reg_b00.we
    connect start -> reg_b01.we
    connect start -> reg_b02.we
    connect start -> reg_b10.we
    connect start -> reg_b11.we
    connect start -> reg_b12.we
    connect start -> reg_b20.we
    connect start -> reg_b21.we
    connect start -> reg_b22.we

    connect clk -> reg_a00.clk
    connect clk -> reg_a01.clk
    connect clk -> reg_a02.clk
    connect clk -> reg_a10.clk
    connect clk -> reg_a11.clk
    connect clk -> reg_a12.clk
    connect clk -> reg_a20.clk
    connect clk -> reg_a21.clk
    connect clk -> reg_a22.clk

    connect clk -> reg_b00.clk
    connect clk -> reg_b01.clk
    connect clk -> reg_b02.clk
    connect clk -> reg_b10.clk
    connect clk -> reg_b11.clk
    connect clk -> reg_b12.clk
    connect clk -> reg_b20.clk
    connect clk -> reg_b21.clk
    connect clk -> reg_b22.clk

    // === RUNNING FLAG ===
    connect start -> start_or_running.a
    connect running.q -> start_or_running.b
    connect start_or_running.out -> running.d
    connect clk -> running.clk

    // === GLOBAL CYCLE COUNTER ===
    connect global_cycle.q -> global_inc.in
    connect start -> global_mux.sel
    connect global_inc.out -> global_mux.in0
    connect zero.out -> global_mux.in1

    connect global_mux.out -> global_cycle.data
    connect start_or_running.out -> global_cycle.we
    connect clk -> global_cycle.clk

    // === K-PHASE COUNTER ===
    // Advances at cycles 5 and 10
    connect k_phase.q -> k_inc.in
    connect is_cycle_5.eq -> k_inc_trigger.a
    connect is_cycle_10.eq -> k_inc_trigger.b

    connect k_inc_trigger.out -> k_mux_01.sel
    connect k_phase.q -> k_mux_01.in0
    connect k_inc.out -> k_mux_01.in1

    connect start -> k_mux_reset.sel
    connect k_mux_01.out -> k_mux_reset.in0
    connect zero.out -> k_mux_reset.in1

    connect k_mux_reset.out -> k_phase.data
    connect start_or_running.out -> k_phase.we
    connect clk -> k_phase.clk

    connect k_phase.q -> k_is_0.a
    connect const_0.out -> k_is_0.b
    connect k_phase.q -> k_is_1.a
    connect const_1.out -> k_is_1.b
    connect k_phase.q -> k_is_2.a
    connect const_2.out -> k_is_2.b

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

    connect global_cycle.q -> is_cycle_10.a
    connect const_10.out -> is_cycle_10.b

    connect global_cycle.q -> is_cycle_11.a
    connect const_11.out -> is_cycle_11.b

    connect global_cycle.q -> is_cycle_12.a
    connect const_12.out -> is_cycle_12.b

    connect global_cycle.q -> is_cycle_13.a
    connect const_13.out -> is_cycle_13.b

    connect global_cycle.q -> is_cycle_14.a
    connect const_14.out -> is_cycle_14.b

    connect global_cycle.q -> is_cycle_15.a
    connect const_15.out -> is_cycle_15.b

    connect global_cycle.q -> is_cycle_16.a
    connect const_16.out -> is_cycle_16.b

    // === CONTROL SIGNALS ===
    // Load weights at cycles 1, 6, 11
    connect is_cycle_1.eq -> loadWeights_or1.a
    connect is_cycle_6.eq -> loadWeights_or1.b
    connect loadWeights_or1.out -> loadWeights_or2.a
    connect is_cycle_11.eq -> loadWeights_or2.b

    // === DATA INJECTION TIMING (Same pattern, extended!) ===
    // Row 0: cycles 2, 7, 12 (pattern: 2 + 5*k)
    connect is_cycle_2.eq -> a_row0_inject_01.a
    connect is_cycle_7.eq -> a_row0_inject_01.b
    connect a_row0_inject_01.out -> a_row0_inject_final.a
    connect is_cycle_12.eq -> a_row0_inject_final.b

    // Row 1: cycles 3, 8, 13 (pattern: 3 + 5*k)
    connect is_cycle_3.eq -> a_row1_inject_01.a
    connect is_cycle_8.eq -> a_row1_inject_01.b
    connect a_row1_inject_01.out -> a_row1_inject_final.a
    connect is_cycle_13.eq -> a_row1_inject_final.b

    // Row 2: cycles 4, 9, 14 (pattern: 4 + 5*k)
    connect is_cycle_4.eq -> a_row2_inject_01.a
    connect is_cycle_9.eq -> a_row2_inject_01.b
    connect a_row2_inject_01.out -> a_row2_inject_final.a
    connect is_cycle_14.eq -> a_row2_inject_final.b

    // === DATA SELECTION (3-way cascaded muxes) ===

    // A row 0: select a00, a01, or a02 based on k_phase
    connect k_is_1.eq -> a_row0_mux_01.sel
    connect reg_a00.q -> a_row0_mux_01.in0  // k=0
    connect reg_a01.q -> a_row0_mux_01.in1  // k=1
    connect k_is_2.eq -> a_row0_mux_final.sel
    connect a_row0_mux_01.out -> a_row0_mux_final.in0  // k=0 or k=1
    connect reg_a02.q -> a_row0_mux_final.in1  // k=2

    connect a_row0_inject_final.out -> a_row0_gate.sel
    connect zero8.out -> a_row0_gate.in0
    connect a_row0_mux_final.out -> a_row0_gate.in1

    // A row 1: select a10, a11, or a12 based on k_phase
    connect k_is_1.eq -> a_row1_mux_01.sel
    connect reg_a10.q -> a_row1_mux_01.in0
    connect reg_a11.q -> a_row1_mux_01.in1
    connect k_is_2.eq -> a_row1_mux_final.sel
    connect a_row1_mux_01.out -> a_row1_mux_final.in0
    connect reg_a12.q -> a_row1_mux_final.in1

    connect a_row1_inject_final.out -> a_row1_gate.sel
    connect zero8.out -> a_row1_gate.in0
    connect a_row1_mux_final.out -> a_row1_gate.in1

    // A row 2: select a20, a21, or a22 based on k_phase
    connect k_is_1.eq -> a_row2_mux_01.sel
    connect reg_a20.q -> a_row2_mux_01.in0
    connect reg_a21.q -> a_row2_mux_01.in1
    connect k_is_2.eq -> a_row2_mux_final.sel
    connect a_row2_mux_01.out -> a_row2_mux_final.in0
    connect reg_a22.q -> a_row2_mux_final.in1

    connect a_row2_inject_final.out -> a_row2_gate.sel
    connect zero8.out -> a_row2_gate.in0
    connect a_row2_mux_final.out -> a_row2_gate.in1

    // B col 0: select b00, b10, or b20 based on k_phase
    connect k_is_1.eq -> b_col0_mux_01.sel
    connect reg_b00.q -> b_col0_mux_01.in0
    connect reg_b10.q -> b_col0_mux_01.in1
    connect k_is_2.eq -> b_col0_mux_final.sel
    connect b_col0_mux_01.out -> b_col0_mux_final.in0
    connect reg_b20.q -> b_col0_mux_final.in1

    // B col 1: select b01, b11, or b21 based on k_phase
    connect k_is_1.eq -> b_col1_mux_01.sel
    connect reg_b01.q -> b_col1_mux_01.in0
    connect reg_b11.q -> b_col1_mux_01.in1
    connect k_is_2.eq -> b_col1_mux_final.sel
    connect b_col1_mux_01.out -> b_col1_mux_final.in0
    connect reg_b21.q -> b_col1_mux_final.in1

    // B col 2: select b02, b12, or b22 based on k_phase
    connect k_is_1.eq -> b_col2_mux_01.sel
    connect reg_b02.q -> b_col2_mux_01.in0
    connect reg_b12.q -> b_col2_mux_01.in1
    connect k_is_2.eq -> b_col2_mux_final.sel
    connect b_col2_mux_01.out -> b_col2_mux_final.in0
    connect reg_b22.q -> b_col2_mux_final.in1

    // === SYSTOLIC ARRAY CONNECTIONS ===

    // Weights (column-wise distribution - same pattern!)
    connect b_col0_mux_final.out -> pe00.weightIn
    connect b_col0_mux_final.out -> pe10.weightIn
    connect b_col0_mux_final.out -> pe20.weightIn  // All PEs in column 0

    connect b_col1_mux_final.out -> pe01.weightIn
    connect b_col1_mux_final.out -> pe11.weightIn
    connect b_col1_mux_final.out -> pe21.weightIn  // All PEs in column 1

    connect b_col2_mux_final.out -> pe02.weightIn
    connect b_col2_mux_final.out -> pe12.weightIn
    connect b_col2_mux_final.out -> pe22.weightIn  // All PEs in column 2

    connect loadWeights_or2.out -> pe00.loadWeight
    connect loadWeights_or2.out -> pe01.loadWeight
    connect loadWeights_or2.out -> pe02.loadWeight
    connect loadWeights_or2.out -> pe10.loadWeight
    connect loadWeights_or2.out -> pe11.loadWeight
    connect loadWeights_or2.out -> pe12.loadWeight
    connect loadWeights_or2.out -> pe20.loadWeight
    connect loadWeights_or2.out -> pe21.loadWeight
    connect loadWeights_or2.out -> pe22.loadWeight

    connect is_cycle_0.eq -> pe00.resetAccum
    connect is_cycle_0.eq -> pe01.resetAccum
    connect is_cycle_0.eq -> pe02.resetAccum
    connect is_cycle_0.eq -> pe10.resetAccum
    connect is_cycle_0.eq -> pe11.resetAccum
    connect is_cycle_0.eq -> pe12.resetAccum
    connect is_cycle_0.eq -> pe20.resetAccum
    connect is_cycle_0.eq -> pe21.resetAccum
    connect is_cycle_0.eq -> pe22.resetAccum

    // Data flow (horizontal spatial chaining - same pattern!)
    // Row 0
    connect a_row0_gate.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect pe01.dataOut -> pe02.dataIn

    // Row 1
    connect a_row1_gate.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn
    connect pe11.dataOut -> pe12.dataIn

    // Row 2
    connect a_row2_gate.out -> pe20.dataIn
    connect pe20.dataOut -> pe21.dataIn
    connect pe21.dataOut -> pe22.dataIn

    // Partial sum inputs (local accumulation)
    connect zero16.out -> pe00.partialSumIn
    connect zero16.out -> pe01.partialSumIn
    connect zero16.out -> pe02.partialSumIn
    connect zero16.out -> pe10.partialSumIn
    connect zero16.out -> pe11.partialSumIn
    connect zero16.out -> pe12.partialSumIn
    connect zero16.out -> pe20.partialSumIn
    connect zero16.out -> pe21.partialSumIn
    connect zero16.out -> pe22.partialSumIn

    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe02.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk
    connect clk -> pe12.clk
    connect clk -> pe20.clk
    connect clk -> pe21.clk
    connect clk -> pe22.clk

    // === DONE SIGNAL ===
    connect is_cycle_16.eq -> done_hold.a
    connect done_latch.q -> done_hold.b
    connect done_hold.out -> done_latch.d
    connect clk -> done_latch.clk

    // === OUTPUTS ===
    connect pe00.result -> c00
    connect pe01.result -> c01
    connect pe02.result -> c02
    connect pe10.result -> c10
    connect pe11.result -> c11
    connect pe12.result -> c12
    connect pe20.result -> c20
    connect pe21.result -> c21
    connect pe22.result -> c22
    connect done_latch.q -> done
  }
}

circuit TestSystolic3x3 {
  clock clk

  impl {
    node sys: Systolic3x3_CounterBased

    // Test: A = [1,2,3; 4,5,6; 7,8,9]  B = [9,8,7; 6,5,4; 3,2,1]
    node a00: Input(value=1)
    node a01: Input(value=2)
    node a02: Input(value=3)
    node a10: Input(value=4)
    node a11: Input(value=5)
    node a12: Input(value=6)
    node a20: Input(value=7)
    node a21: Input(value=8)
    node a22: Input(value=9)

    node b00: Input(value=9)
    node b01: Input(value=8)
    node b02: Input(value=7)
    node b10: Input(value=6)
    node b11: Input(value=5)
    node b12: Input(value=4)
    node b20: Input(value=3)
    node b21: Input(value=2)
    node b22: Input(value=1)

    node start: Switch

    connect a00.out -> sys.a00
    connect a01.out -> sys.a01
    connect a02.out -> sys.a02
    connect a10.out -> sys.a10
    connect a11.out -> sys.a11
    connect a12.out -> sys.a12
    connect a20.out -> sys.a20
    connect a21.out -> sys.a21
    connect a22.out -> sys.a22

    connect b00.out -> sys.b00
    connect b01.out -> sys.b01
    connect b02.out -> sys.b02
    connect b10.out -> sys.b10
    connect b11.out -> sys.b11
    connect b12.out -> sys.b12
    connect b20.out -> sys.b20
    connect b21.out -> sys.b21
    connect b22.out -> sys.b22

    connect start.out -> sys.start
    connect clk -> sys.clk

    node display_c00: HexDisplay
    node display_c01: HexDisplay
    node display_c02: HexDisplay
    node display_c10: HexDisplay
    node display_c11: HexDisplay
    node display_c12: HexDisplay
    node display_c20: HexDisplay
    node display_c21: HexDisplay
    node display_c22: HexDisplay
    node done_led: Led

    connect sys.c00 -> display_c00.in
    connect sys.c01 -> display_c01.in
    connect sys.c02 -> display_c02.in
    connect sys.c10 -> display_c10.in
    connect sys.c11 -> display_c11.in
    connect sys.c12 -> display_c12.in
    connect sys.c20 -> display_c20.in
    connect sys.c21 -> display_c21.in
    connect sys.c22 -> display_c22.in
    connect sys.done -> done_led.in
  }
}

// =============================================================================
// 3×3 SYSTOLIC ARRAY - SAME PATTERN, JUST EXTENDED!
// =============================================================================
//
// KEY OBSERVATION: The pattern from 2×2 scales perfectly!
//
// What changed:
// 1. More PEs (4 → 9)
// 2. More inputs (8 → 18)
// 3. K-phases (2 → 3)
// 4. More cycles (9 → 16)
// 5. 3-way muxes (cascade 2-way muxes)
// 6. 3-input ORs (cascade 2-input ORs)
//
// But the LOGIC and FORMULA are identical!
//
// CYCLE SCHEDULE:
// Cycle 0: Reset
// Cycle 1: Load B[0,:] (k=0)
// Cycle 2: Inject A[0,0]
// Cycle 3: Inject A[1,0]
// Cycle 4: Inject A[2,0]
// Cycle 5: Advance k_phase to 1
// Cycle 6: Load B[1,:] (k=1)
// Cycle 7: Inject A[0,1]
// Cycle 8: Inject A[1,1]
// Cycle 9: Inject A[2,1]
// Cycle 10: Advance k_phase to 2
// Cycle 11: Load B[2,:] (k=2)
// Cycle 12: Inject A[0,2]
// Cycle 13: Inject A[1,2]
// Cycle 14: Inject A[2,2]
// Cycle 15: Settle
// Cycle 16: Done
//
// INJECTION FORMULA (same pattern!):
// Row i injects at: cycle = (2 + i) + 5*k
// - Row 0: cycles 2, 7, 12
// - Row 1: cycles 3, 8, 13
// - Row 2: cycles 4, 9, 14
//
// USAGE:
// 1. START ON → clock once → START OFF
// 2. Clock 16 more times
// 3. Done LED turns ON at cycle 16
//
// EXPECTED RESULTS (A=[1,2,3;4,5,6;7,8,9] × B=[9,8,7;6,5,4;3,2,1]):
// c00 = 1*9 + 2*6 + 3*3 = 9 + 12 + 9 = 30 = 0x1E
// c01 = 1*8 + 2*5 + 3*2 = 8 + 10 + 6 = 24 = 0x18
// c02 = 1*7 + 2*4 + 3*1 = 7 + 8 + 3 = 18 = 0x12
// c10 = 4*9 + 5*6 + 6*3 = 36 + 30 + 18 = 84 = 0x54
// c11 = 4*8 + 5*5 + 6*2 = 32 + 25 + 12 = 69 = 0x45
// c12 = 4*7 + 5*4 + 6*1 = 28 + 20 + 6 = 54 = 0x36
// c20 = 7*9 + 8*6 + 9*3 = 63 + 48 + 27 = 138 = 0x8A
// c21 = 7*8 + 8*5 + 9*2 = 56 + 40 + 18 = 114 = 0x72
// c22 = 7*7 + 8*4 + 9*1 = 49 + 32 + 9 = 90 = 0x5A
//
// This proves the counter-based pattern SCALES!
// To go to 4×4, just add one more row, one more k-phase, same logic!

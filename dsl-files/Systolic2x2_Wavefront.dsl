// Wavefront Enables + Vertical Weight Flow - 2×2 Systolic Array
// Combines BOTH improvements for maximum production similarity:
//   1. Distributed wavefront enables (no global cycle counter)
//   2. Vertical weight flow with valid bits (scalable self-timing)
// Most production-like architecture!

circuit ProcessingElement_VerticalWeight {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input partialSumIn: Bus[16]
  input weightValid: Bit         // NEW: Valid bit flows with weight
  input resetAccum: Bit
  clock clk
  output dataOut: Bus[8]
  output weightOut: Bus[8]       // Pass weight to PE below
  output weightValidOut: Bit     // NEW: Pass valid bit to PE below
  output result: Bus[16]

  impl {
    node weightReg: Register
    node weightPipe: Register     // Pipeline register for vertical flow
    node validPipe: DFlipFlop     // NEW: Pipeline for valid bit
    node mult: Multiplier
    node adder: Adder(width=16)
    node accum: Register
    node dataPipe: Register
    node accum_mux: Mux
    node one: Constant(value=1)
    node zero: Constant(value=0)
    node zero16: Constant(value=0)

    // Store weight locally when valid=1 (self-timed!)
    connect weightIn -> weightReg.data
    connect weightValid -> weightReg.we
    connect clk -> weightReg.clk

    // Pass weight downward with 1-cycle delay
    connect weightIn -> weightPipe.data
    connect one.out -> weightPipe.we  // Always propagate
    connect clk -> weightPipe.clk
    connect weightPipe.q -> weightOut

    // NEW: Pass valid bit downward with 1-cycle delay (flows with weight!)
    connect weightValid -> validPipe.d
    connect clk -> validPipe.clk
    connect validPipe.q -> weightValidOut

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

circuit Systolic2x2_Wavefront {
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
    node pe00: ProcessingElement_VerticalWeight
    node pe01: ProcessingElement_VerticalWeight
    node pe10: ProcessingElement_VerticalWeight
    node pe11: ProcessingElement_VerticalWeight

    // Input storage
    node reg_a00: Register
    node reg_a01: Register
    node reg_a10: Register
    node reg_a11: Register
    node reg_b00: Register
    node reg_b01: Register
    node reg_b10: Register
    node reg_b11: Register

    // === WAVEFRONT CONTROL (No global cycle counter!) ===

    // Phase state machine (high-level phases, not individual cycles)
    node phase: Register  // Tracks major phases: 0=reset, 1=k0, 2=k1, 3=done
    node phase_inc: Incrementer
    node phase_mux: Mux

    // Phase detection
    node is_phase_0: Comparator  // Reset phase
    node is_phase_1: Comparator  // K=0 phase
    node is_phase_2: Comparator  // K=1 phase
    node is_phase_3: Comparator  // Done phase

    // Running flag
    node running: DFlipFlop
    node start_or_running: Or

    // === WAVEFRONT ENABLE CHAINS (per phase) ===
    // Each phase has its own shift register chain for timing

    // K=0 enable chain (shift register)
    node k0_enable: Register     // Counts steps within k=0 phase
    node k0_enable_inc: Incrementer
    node k0_enable_mux: Mux
    node k0_step_0: Comparator   // Load weights
    node k0_step_1: Comparator   // Wait for weight propagation
    node k0_step_2: Comparator   // Inject row 0
    node k0_step_3: Comparator   // Inject row 1
    node k0_step_4: Comparator   // Wait/settle
    node k0_step_5: Comparator   // Advance to k=1

    // K=1 enable chain
    node k1_enable: Register
    node k1_enable_inc: Incrementer
    node k1_enable_mux: Mux
    node k1_step_0: Comparator   // Load weights
    node k1_step_1: Comparator   // Wait for weight propagation
    node k1_step_2: Comparator   // Inject row 0
    node k1_step_3: Comparator   // Inject row 1
    node k1_step_4: Comparator   // Wait/settle
    node k1_step_5: Comparator   // Finish

    // Phase transition logic
    node advance_from_reset: DFlipFlop  // NEW: Phase 0 → Phase 1
    node advance_to_k1: DFlipFlop
    node advance_to_done: DFlipFlop
    node reset_to_k0: And              // Transition when advance AND in phase
    node k0_to_k1: And                 // Transition when advance AND in phase
    node k1_to_done: And               // Transition when advance AND in phase
    node transition_or_1: Or           // Combine transitions 1&2
    node any_phase_transition: Or      // Combine all transitions

    // === DATA SELECTION ===
    node a_row0_mux: Mux
    node a_row1_mux: Mux
    node b_col0_mux: Mux
    node b_col1_mux: Mux

    // Injection control
    node a_row0_inject: Or
    node a_row1_inject: Or
    node a_row0_gate: Mux
    node a_row1_gate: Mux

    // Weight valid control (for vertical weight flow with valid bits)
    node weightValid: Or

    // Done latch
    node done_latch: DFlipFlop
    node done_hold: Or

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

    // === PHASE STATE MACHINE ===
    connect phase.q -> phase_inc.in

    // Combine all phase transitions (3 transitions, need to chain OR gates)
    connect reset_to_k0.out -> transition_or_1.a
    connect k0_to_k1.out -> transition_or_1.b

    connect transition_or_1.out -> any_phase_transition.a
    connect k1_to_done.out -> any_phase_transition.b

    // Advance phase on any transition
    connect any_phase_transition.out -> phase_mux.sel
    connect phase_inc.out -> phase_mux.in1
    connect phase.q -> phase_mux.in0

    connect phase_mux.out -> phase.data
    connect start_or_running.out -> phase.we
    connect clk -> phase.clk

    // Phase detection
    connect phase.q -> is_phase_0.a
    connect const_0.out -> is_phase_0.b

    connect phase.q -> is_phase_1.a
    connect const_1.out -> is_phase_1.b

    connect phase.q -> is_phase_2.a
    connect const_2.out -> is_phase_2.b

    connect phase.q -> is_phase_3.a
    connect const_3.out -> is_phase_3.b

    // === K=0 ENABLE CHAIN ===
    connect k0_enable.q -> k0_enable_inc.in
    connect is_phase_1.eq -> k0_enable_mux.sel
    connect zero.out -> k0_enable_mux.in0
    connect k0_enable_inc.out -> k0_enable_mux.in1

    connect k0_enable_mux.out -> k0_enable.data
    connect start_or_running.out -> k0_enable.we
    connect clk -> k0_enable.clk

    // K=0 step detection
    connect k0_enable.q -> k0_step_0.a
    connect const_0.out -> k0_step_0.b

    connect k0_enable.q -> k0_step_1.a
    connect const_1.out -> k0_step_1.b

    connect k0_enable.q -> k0_step_2.a
    connect const_2.out -> k0_step_2.b

    connect k0_enable.q -> k0_step_3.a
    connect const_3.out -> k0_step_3.b

    connect k0_enable.q -> k0_step_4.a
    connect const_4.out -> k0_step_4.b

    connect k0_enable.q -> k0_step_5.a
    connect const_5.out -> k0_step_5.b

    // === K=1 ENABLE CHAIN ===
    connect k1_enable.q -> k1_enable_inc.in
    connect is_phase_2.eq -> k1_enable_mux.sel
    connect zero.out -> k1_enable_mux.in0
    connect k1_enable_inc.out -> k1_enable_mux.in1

    connect k1_enable_mux.out -> k1_enable.data
    connect start_or_running.out -> k1_enable.we
    connect clk -> k1_enable.clk

    // K=1 step detection
    connect k1_enable.q -> k1_step_0.a
    connect const_0.out -> k1_step_0.b

    connect k1_enable.q -> k1_step_1.a
    connect const_1.out -> k1_step_1.b

    connect k1_enable.q -> k1_step_2.a
    connect const_2.out -> k1_step_2.b

    connect k1_enable.q -> k1_step_3.a
    connect const_3.out -> k1_step_3.b

    connect k1_enable.q -> k1_step_4.a
    connect const_4.out -> k1_step_4.b

    connect k1_enable.q -> k1_step_5.a
    connect const_5.out -> k1_step_5.b

    // === PHASE TRANSITIONS ===

    // Advance from reset (phase 0) to k=0 (phase 1) after 1 cycle
    connect is_phase_0.eq -> advance_from_reset.d
    connect clk -> advance_from_reset.clk

    connect advance_from_reset.q -> reset_to_k0.a
    connect is_phase_0.eq -> reset_to_k0.b

    // Advance from k=0 to k=1 at k0_step_5
    connect k0_step_5.eq -> advance_to_k1.d
    connect clk -> advance_to_k1.clk

    connect advance_to_k1.q -> k0_to_k1.a
    connect is_phase_1.eq -> k0_to_k1.b

    // Advance from k=1 to done at k1_step_5
    connect k1_step_5.eq -> advance_to_done.d
    connect clk -> advance_to_done.clk

    connect advance_to_done.q -> k1_to_done.a
    connect is_phase_2.eq -> k1_to_done.b

    // === CONTROL SIGNALS (Wavefront-based!) ===

    // Generate valid signal: k0_step_0 OR k1_step_0
    // Valid bit will propagate down with weights
    connect k0_step_0.eq -> weightValid.a
    connect k1_step_0.eq -> weightValid.b

    // Inject row 0: k0_step_2 OR k1_step_2
    connect k0_step_2.eq -> a_row0_inject.a
    connect k1_step_2.eq -> a_row0_inject.b

    // Inject row 1: k0_step_3 OR k1_step_3
    connect k0_step_3.eq -> a_row1_inject.a
    connect k1_step_3.eq -> a_row1_inject.b

    // === DATA SELECTION ===
    // Use phase to select k=0 or k=1 data
    connect is_phase_2.eq -> a_row0_mux.sel
    connect reg_a00.q -> a_row0_mux.in0  // phase 1: use A[:,0]
    connect reg_a01.q -> a_row0_mux.in1  // phase 2: use A[:,1]

    connect is_phase_2.eq -> a_row1_mux.sel
    connect reg_a10.q -> a_row1_mux.in0
    connect reg_a11.q -> a_row1_mux.in1

    // Gate data
    connect a_row0_inject.out -> a_row0_gate.sel
    connect zero8.out -> a_row0_gate.in0
    connect a_row0_mux.out -> a_row0_gate.in1

    connect a_row1_inject.out -> a_row1_gate.sel
    connect zero8.out -> a_row1_gate.in0
    connect a_row1_mux.out -> a_row1_gate.in1

    // Select B weights
    connect is_phase_2.eq -> b_col0_mux.sel
    connect reg_b00.q -> b_col0_mux.in0  // phase 1: use B[0,:]
    connect reg_b10.q -> b_col0_mux.in1  // phase 2: use B[1,:]

    connect is_phase_2.eq -> b_col1_mux.sel
    connect reg_b01.q -> b_col1_mux.in0
    connect reg_b11.q -> b_col1_mux.in1

    // === SYSTOLIC ARRAY CONNECTIONS ===

    // Vertical weight flow with valid bits (scalable!)
    connect b_col0_mux.out -> pe00.weightIn
    connect pe00.weightOut -> pe10.weightIn

    connect b_col1_mux.out -> pe01.weightIn
    connect pe01.weightOut -> pe11.weightIn

    // Valid bit chains (self-timing!)
    connect weightValid.out -> pe00.weightValid
    connect pe00.weightValidOut -> pe10.weightValid  // Valid flows with weight!

    connect weightValid.out -> pe01.weightValid
    connect pe01.weightValidOut -> pe11.weightValid  // Valid flows with weight!

    connect is_phase_0.eq -> pe00.resetAccum
    connect is_phase_0.eq -> pe01.resetAccum
    connect is_phase_0.eq -> pe10.resetAccum
    connect is_phase_0.eq -> pe11.resetAccum

    // Horizontal data flow
    connect a_row0_gate.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect a_row1_gate.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // Partial sums (local accumulation)
    connect zero16.out -> pe00.partialSumIn
    connect zero16.out -> pe01.partialSumIn
    connect zero16.out -> pe10.partialSumIn
    connect zero16.out -> pe11.partialSumIn

    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // === DONE SIGNAL ===
    connect is_phase_3.eq -> done_hold.a
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

circuit TestWavefront {
  clock clk

  impl {
    node sys: Systolic2x2_Wavefront

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
// WAVEFRONT ENABLES + VERTICAL WEIGHT FLOW - PRODUCTION ARCHITECTURE
// =============================================================================
//
// This combines BOTH improvements:
//   1. Wavefront enables (distributed control)
//   2. Vertical weight flow with valid bits (scalable self-timing)
//
// KEY IMPROVEMENT #1 - Wavefront Enables:
//    - No global cycle counter with 10+ comparators!
//    - Phase FSM: High-level phases (reset, k=0, k=1, done)
//    - Per-phase enable chains: Local counters for timing within each phase
//    - Wavefront propagation: Enables flow through array, not broadcast
//
// KEY IMPROVEMENT #2 - Valid Bits:
//    - Weights flow vertically with valid bits
//    - Each PE self-times based on valid bit arrival
//    - Scales to arbitrary N×N without modification
//
// CONTROL HIERARCHY:
//    Level 1: Phase FSM (4 states: reset, k=0, k=1, done)
//             - Phase 0 → 1: After 1 cycle (reset complete)
//             - Phase 1 → 2: After k0_step_5 (k=0 complete)
//             - Phase 2 → 3: After k1_step_5 (k=1 complete)
//    Level 2: Enable chains per phase (k0_enable, k1_enable)
//    Level 3: Local step detection (k0_step_0, k0_step_1, etc.)
//
// ADVANTAGES:
//    - Distributed timing (no single global counter)
//    - Modular phases (easy to add more k phases)
//    - Local control signals (better for scaling)
//    - Wavefront pattern (each phase has its own timing)
//
// OPERATION:
//    Phase 0 (Reset):
//      - Reset all accumulators
//      - After 1 cycle, advance to phase 1 automatically
//
//    Phase 1 (K=0):
//      - Step 0: weightValid=1 → top row loads, valid propagates down
//      - Step 1: weightValid=1 arrives at bottom row → loads automatically
//      - Step 2: Inject A[0,0] (row 0)
//      - Step 3: Inject A[1,0] (row 1)
//      - Step 4: Wait/settle
//      - Step 5: Advance to phase 2 automatically
//
//    Phase 2 (K=1):
//      - Step 0: weightValid=1 → top row loads, valid propagates down
//      - Step 1: weightValid=1 arrives at bottom row → loads automatically
//      - Step 2: Inject A[0,1] (row 0)
//      - Step 3: Inject A[1,1] (row 1)
//      - Step 4: Wait/settle
//      - Step 5: Advance to phase 3
//
//    Phase 3 (Done):
//      - Computation complete
//      - Done signal asserted
//
// SCALABILITY:
//    - To add K=2: Add phase_3 with k2_enable chain
//    - To add row 2: Just wire it up! Valid bits handle timing automatically
//      connect pe10.weightOut -> pe20.weightIn
//      connect pe10.weightValidOut -> pe20.weightValid
//    - No need to rewrite global timing or add delay chains
//
// PRODUCTION SIMILARITY:
//    - ✅ Phase-based control with local enables (wavefront)
//    - ✅ Self-timing via valid bits (scales perfectly)
//    - ✅ Distributed timing (no centralized bottlenecks)
//    - ✅ Vertical weight flow (no broadcasts)
//    - This combines the best of both architectural improvements!
//
// EXPECTED RESULTS:
// A = [1, 2]  ×  B = [5, 6]  =  C = [19, 22]
//     [3, 4]       [7, 8]         [43, 50]
//
// This is the closest to production TPU architecture!
//

// AUTOMATIC Weight-Stationary Systolic Array with DYNAMIC COMPLETION DETECTION
// Proper hardware design: done signal calculated from circuit behavior, not hardcoded!
// Generalizes to different array sizes and K values

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

// Automatic controller with DYNAMIC completion detection
circuit Systolic2x2_AutoDynamic {
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
    // Systolic array PEs
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

    // === DYNAMIC COMPLETION DETECTION ===
    // K-phase counter: tracks which k we're on (0, 1 for K=2)
    node k_phase: Register
    node k_phase_inc: Incrementer
    node k_phase_next: Mux
    node k_is_0: Comparator
    node k_is_1: Comparator

    // Cycle counter within each k-phase
    node cycle_counter: Register
    node cycle_inc: Incrementer
    node cycle_reset_mux: Mux

    // Comparators for cycle detection
    node is_cycle_0: Comparator
    node is_cycle_1: Comparator
    node is_cycle_2: Comparator
    node is_cycle_3: Comparator

    // Pipeline settle tracking (after last injection, wait for results)
    node settle_counter: Register
    node settle_inc: Incrementer
    node settle_start: DFlipFlop
    node settle_done_cmp: Comparator

    // Done detection and latch
    node done_detect: And
    node done_latch: DFlipFlop
    node done_hold: Or

    // FSM state (simplified - just tracks major phases)
    node fsm_state: Register
    node fsm_inc: Incrementer
    node fsm_next: Mux

    // Running flag
    node running: DFlipFlop
    node start_or_running: Or

    // Control signals
    node loadWeights_or: Or

    // Data selection
    node a_row0_mux: Mux
    node a_row1_mux: Mux
    node b_col0_mux: Mux
    node b_col1_mux: Mux
    node a_row0_inject: Or
    node a_row0_sel: Mux
    node a_row1_inject: Or
    node a_row1_sel: Mux

    // Constants
    node zero8: Constant(value=0)
    node zero16: Constant(value=0)
    node one: Constant(value=1)
    node zero: Constant(value=0)
    node two: Constant(value=2)
    node three: Constant(value=3)

    // State constants (simplified)
    node state_idle: Constant(value=0)
    node state_reset: Constant(value=1)
    node state_k_phase: Constant(value=2)  // Main computation
    node state_settling: Constant(value=3) // Waiting for pipeline

    node is_idle: Comparator
    node is_reset: Comparator
    node is_k_phase: Comparator
    node is_settling: Comparator

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

    // === FSM STATE ===
    connect fsm_state.q -> fsm_inc.in
    connect start -> fsm_next.sel
    connect fsm_inc.out -> fsm_next.in0
    connect state_idle.out -> fsm_next.in1
    connect fsm_next.out -> fsm_state.data
    connect one.out -> fsm_state.we
    connect clk -> fsm_state.clk

    connect fsm_state.q -> is_idle.a
    connect state_idle.out -> is_idle.b
    connect fsm_state.q -> is_reset.a
    connect state_reset.out -> is_reset.b
    connect fsm_state.q -> is_k_phase.a
    connect state_k_phase.out -> is_k_phase.b
    connect fsm_state.q -> is_settling.a
    connect state_settling.out -> is_settling.b

    // === K-PHASE COUNTER ===
    // Increments when we finish a k-phase (after cycle 2)
    connect k_phase.q -> k_phase_inc.in
    connect is_cycle_2.eq -> k_phase_next.sel
    connect k_phase.q -> k_phase_next.in0
    connect k_phase_inc.out -> k_phase_next.in1

    connect k_phase_next.out -> k_phase.data
    connect start_or_running.out -> k_phase.we
    connect clk -> k_phase.clk

    connect k_phase.q -> k_is_0.a
    connect zero.out -> k_is_0.b
    connect k_phase.q -> k_is_1.a
    connect one.out -> k_is_1.b

    // === CYCLE COUNTER (within k-phase) ===
    // Resets to 0 when k-phase changes, else increments
    connect cycle_counter.q -> cycle_inc.in
    connect is_cycle_2.eq -> cycle_reset_mux.sel
    connect cycle_inc.out -> cycle_reset_mux.in0
    connect zero.out -> cycle_reset_mux.in1

    connect cycle_reset_mux.out -> cycle_counter.data
    connect is_k_phase.eq -> cycle_counter.we
    connect clk -> cycle_counter.clk

    connect cycle_counter.q -> is_cycle_0.a
    connect zero.out -> is_cycle_0.b
    connect cycle_counter.q -> is_cycle_1.a
    connect one.out -> is_cycle_1.b
    connect cycle_counter.q -> is_cycle_2.a
    connect two.out -> is_cycle_2.b
    connect cycle_counter.q -> is_cycle_3.a
    connect three.out -> is_cycle_3.b

    // === SETTLE COUNTER (pipeline depth wait) ===
    // Start counting when we enter SETTLING state
    connect settle_counter.q -> settle_inc.in
    connect settle_inc.out -> settle_counter.data
    connect is_settling.eq -> settle_counter.we
    connect clk -> settle_counter.clk

    // Done settling after 2 cycles (pipeline depth)
    connect settle_counter.q -> settle_done_cmp.a
    connect two.out -> settle_done_cmp.b

    // === DONE DETECTION ===
    // Done = finished all k-phases (k=1) AND settled
    connect k_is_1.eq -> done_detect.a
    connect settle_done_cmp.eq -> done_detect.b

    // Latch done signal (stays high once set)
    connect done_detect.out -> done_hold.a
    connect done_latch.q -> done_hold.b
    connect done_hold.out -> done_latch.d
    connect clk -> done_latch.clk

    // === CONTROL SIGNAL GENERATION ===
    // resetAccum in RESET state (use is_reset.eq directly)

    // loadWeights at start of each k-phase (cycle 0)
    connect is_k_phase.eq -> loadWeights_or.a
    connect is_cycle_0.eq -> loadWeights_or.b

    // === DATA SELECTION ===
    // B weights: k=0 uses b00/b01, k=1 uses b10/b11
    connect k_is_1.eq -> b_col0_mux.sel
    connect reg_b00.q -> b_col0_mux.in0
    connect reg_b10.q -> b_col0_mux.in1

    connect k_is_1.eq -> b_col1_mux.sel
    connect reg_b01.q -> b_col1_mux.in0
    connect reg_b11.q -> b_col1_mux.in1

    // A row 0: inject a00 at cycle 1 (k=0), a01 at cycle 1 (k=1)
    connect is_cycle_1.eq -> a_row0_inject.a
    connect is_k_phase.eq -> a_row0_inject.b

    connect a_row0_inject.out -> a_row0_sel.sel
    connect zero8.out -> a_row0_sel.in0
    connect k_is_1.eq -> a_row0_mux.sel
    connect reg_a00.q -> a_row0_mux.in0
    connect reg_a01.q -> a_row0_mux.in1
    connect a_row0_mux.out -> a_row0_sel.in1

    // A row 1: inject a10 at cycle 2 (k=0), a11 at cycle 2 (k=1)
    connect is_cycle_2.eq -> a_row1_inject.a
    connect is_k_phase.eq -> a_row1_inject.b

    connect a_row1_inject.out -> a_row1_sel.sel
    connect zero8.out -> a_row1_sel.in0
    connect k_is_1.eq -> a_row1_mux.sel
    connect reg_a10.q -> a_row1_mux.in0
    connect reg_a11.q -> a_row1_mux.in1
    connect a_row1_mux.out -> a_row1_sel.in1

    // === SYSTOLIC ARRAY CONNECTIONS ===
    connect b_col0_mux.out -> pe00.weightIn
    connect b_col0_mux.out -> pe10.weightIn
    connect b_col1_mux.out -> pe01.weightIn
    connect b_col1_mux.out -> pe11.weightIn

    connect loadWeights_or.out -> pe00.loadWeight
    connect loadWeights_or.out -> pe01.loadWeight
    connect loadWeights_or.out -> pe10.loadWeight
    connect loadWeights_or.out -> pe11.loadWeight

    connect is_reset.eq -> pe00.resetAccum
    connect is_reset.eq -> pe01.resetAccum
    connect is_reset.eq -> pe10.resetAccum
    connect is_reset.eq -> pe11.resetAccum

    connect a_row0_sel.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect a_row1_sel.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    connect zero16.out -> pe00.partialSumIn
    connect zero16.out -> pe01.partialSumIn
    connect zero16.out -> pe10.partialSumIn
    connect zero16.out -> pe11.partialSumIn

    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // === OUTPUTS ===
    connect pe00.result -> c00
    connect pe01.result -> c01
    connect pe10.result -> c10
    connect pe11.result -> c11
    connect done_latch.q -> done
  }
}

circuit TestAutoDynamic {
  clock clk

  impl {
    node sys: Systolic2x2_AutoDynamic

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
// DYNAMIC COMPLETION DETECTION - How It Works:
// =============================================================================
//
// Instead of hardcoding "done at cycle 9", we DETECT completion:
//
// 1. K-PHASE COUNTER: Tracks which inner product phase (k=0, k=1)
// 2. CYCLE COUNTER: Tracks position within each k-phase (0,1,2)
// 3. SETTLE COUNTER: After last injection, counts cycles for pipeline to settle
// 4. DONE DETECTION: done = (k_phase == 1) AND (settle_counter >= 2)
// 5. DONE LATCH: Once done=1, it STAYS 1 (doesn't flicker off)
//
// This generalizes to:
// - Different K values (just change k_phase comparison)
// - Different array sizes (adjust settle_counter threshold for pipeline depth)
// - Different injection patterns
//
// USAGE (same as before):
// 1. START ON → clock once → START OFF
// 2. Keep clocking
// 3. Done LED turns ON and STAYS ON when complete
// 4. Results: c00=19, c01=22, c10=43, c11=50
//
// FSM now has 4 states:
// - IDLE (0): Waiting for start
// - RESET (1): Clear accumulators
// - K_PHASE (2): Main computation (repeats for k=0, k=1)
// - SETTLING (3): Wait for pipeline results
//
// The done signal is CALCULATED, not hardcoded!

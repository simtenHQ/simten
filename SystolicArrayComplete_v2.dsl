// ============================================================================
// Complete Systolic Array Implementation - Version 2 (Bug Fixes)
// Fixes: Counter reset, counter stop, done latch, proper timing
// ============================================================================

// ============================================================================
// PART 1: Processing Element (PE) - The Core MAC Unit
// ============================================================================
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
    node psum_reg: Register  // FIX: Register the partial sum output (from TinyTPU)
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

    // FIX: Register the partial sum before output
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

// ============================================================================
// PART 2: Hardware-Accurate 2×2 Systolic Array - FIXED
// ============================================================================
circuit SystolicArray2x2_Hardware {
  input a00: Bus[8]
  input a01: Bus[8]
  input a10: Bus[8]
  input a11: Bus[8]
  input b00: Bus[8]
  input b01: Bus[8]
  input b10: Bus[8]
  input b11: Bus[8]
  input loadWeights: Bit
  input start: Bit
  clock clk
  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]
  output done: Bit

  // DEBUG outputs
  output debug_counter: Bus[8]
  output debug_pe10: Bus[16]
  output debug_pe11: Bus[16]

  impl {
    node pe00: ProcessingElement
    node pe01: ProcessingElement
    node pe10: ProcessingElement
    node pe11: ProcessingElement

    node reg_a00: Register
    node reg_a01: Register
    node reg_a10: Register
    node reg_a11: Register

    // === COUNTER with RESET and STOP ===
    node counter: Register
    node counter_inc: Incrementer
    node counter_bits: BitSlice(low=0, high=2)

    // FIX 1: Counter control - start from 0 and stop at 6
    node counter_reset_mux: Mux  // Reset to 0 when start=1
    node is_cycle6: Comparator
    node not_cycle6: Not
    node should_count: And  // Count only if start=1 AND counter<6
    node computing: DFlipFlop  // Track if we're computing
    node start_or_computing: Or
    node count_enable: And

    node is_cycle0: Comparator
    node is_cycle1: Comparator
    node row0_active: Or
    node row0_mux: Mux
    node row0_gate: Mux

    node is_cycle1_row1: Comparator
    node is_cycle2: Comparator
    node row1_active: Or
    node row1_mux: Mux
    node row1_gate: Mux

    node result_c00: Register
    node result_c01: Register
    node result_c10: Register
    node result_c11: Register

    node is_cycle4: Comparator
    node is_cycle5: Comparator
    node is_cycle6_capture: Comparator

    // FIX 2: Done signal with latch
    node is_cycle6_done: Comparator
    node done_reg: DFlipFlop
    node done_latch_or: Or  // Keep done=1 once set

    node zero8: Constant(value=0)
    node zero16: Constant(value=0)
    node one: Constant(value=1)
    node const_0: Constant(value=0)
    node const_1: Constant(value=1)
    node const_2: Constant(value=2)
    node const_4: Constant(value=4)
    node const_5: Constant(value=5)
    node const_6: Constant(value=6)

    // === Input Storage ===
    connect a00 -> reg_a00.data
    connect a01 -> reg_a01.data
    connect a10 -> reg_a10.data
    connect a11 -> reg_a11.data
    connect start -> reg_a00.we
    connect start -> reg_a01.we
    connect start -> reg_a10.we
    connect start -> reg_a11.we
    connect clk -> reg_a00.clk
    connect clk -> reg_a01.clk
    connect clk -> reg_a10.clk
    connect clk -> reg_a11.clk

    // === Counter Control (FIXED) ===
    // Computing flag: set by start, stays on
    connect start -> start_or_computing.a
    connect computing.q -> start_or_computing.b
    connect start_or_computing.out -> computing.d
    connect clk -> computing.clk

    // Counter reset mux: if start=1, reset to 0, else increment
    connect start -> counter_reset_mux.sel
    connect counter_bits.out -> counter_reset_mux.in0
    connect const_0.out -> counter_reset_mux.in1

    // Counter increment logic
    connect counter.q -> counter_inc.in
    connect counter_inc.out -> counter_bits.in

    // Stop counting at cycle 6
    connect counter.q -> is_cycle6.a
    connect const_6.out -> is_cycle6.b
    connect is_cycle6.eq -> not_cycle6.in

    // DEBUG: Let counter run forever to see all values
    // connect start_or_computing.out -> count_enable.a
    // connect not_cycle6.out -> count_enable.b

    connect counter_reset_mux.out -> counter.data
    connect start_or_computing.out -> counter.we  // Just enable when computing
    connect clk -> counter.clk

    // === Row 0 Sequencing ===
    connect counter.q -> is_cycle0.a
    connect const_0.out -> is_cycle0.b
    connect counter.q -> is_cycle1.a
    connect const_1.out -> is_cycle1.b
    connect is_cycle0.eq -> row0_active.a
    connect is_cycle1.eq -> row0_active.b
    connect is_cycle1.eq -> row0_mux.sel
    connect reg_a00.q -> row0_mux.in0
    connect reg_a01.q -> row0_mux.in1
    connect row0_active.out -> row0_gate.sel
    connect zero8.out -> row0_gate.in0
    connect row0_mux.out -> row0_gate.in1

    // === Row 1 Sequencing ===
    connect counter.q -> is_cycle1_row1.a
    connect const_1.out -> is_cycle1_row1.b
    connect counter.q -> is_cycle2.a
    connect const_2.out -> is_cycle2.b
    connect is_cycle1_row1.eq -> row1_active.a
    connect is_cycle2.eq -> row1_active.b
    connect is_cycle2.eq -> row1_mux.sel
    connect reg_a10.q -> row1_mux.in0
    connect reg_a11.q -> row1_mux.in1
    connect row1_active.out -> row1_gate.sel
    connect zero8.out -> row1_gate.in0
    connect row1_mux.out -> row1_gate.in1

    // === PE Grid: Weights ===
    connect b00 -> pe00.weightIn
    connect b01 -> pe01.weightIn
    connect b10 -> pe10.weightIn
    connect b11 -> pe11.weightIn
    connect loadWeights -> pe00.loadWeight
    connect loadWeights -> pe01.loadWeight
    connect loadWeights -> pe10.loadWeight
    connect loadWeights -> pe11.loadWeight

    // === PE Grid: Clocks ===
    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // === PE Grid: Data Flow ===
    connect row0_gate.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect row1_gate.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // === PE Grid: Partial Sums ===
    connect zero16.out -> pe00.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn
    connect zero16.out -> pe01.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn

    // === Output Capture ===
    connect counter.q -> is_cycle4.a
    connect const_4.out -> is_cycle4.b
    connect pe10.partialSumOut -> result_c00.data
    connect pe11.partialSumOut -> result_c01.data
    connect is_cycle4.eq -> result_c00.we
    connect is_cycle4.eq -> result_c01.we
    connect clk -> result_c00.clk
    connect clk -> result_c01.clk

    connect counter.q -> is_cycle5.a
    connect const_5.out -> is_cycle5.b
    connect pe10.partialSumOut -> result_c10.data
    connect pe11.partialSumOut -> result_c11.data
    connect is_cycle5.eq -> result_c10.we
    connect is_cycle5.eq -> result_c11.we
    connect clk -> result_c10.clk
    connect clk -> result_c11.clk

    // === Done Signal (LATCHED) ===
    connect counter.q -> is_cycle6_done.a
    connect const_6.out -> is_cycle6_done.b
    connect is_cycle6_done.eq -> done_latch_or.a
    connect done_reg.q -> done_latch_or.b
    connect done_latch_or.out -> done_reg.d
    connect clk -> done_reg.clk

    // === Outputs ===
    connect result_c00.q -> c00
    connect result_c01.q -> c01
    connect result_c10.q -> c10
    connect result_c11.q -> c11
    connect done_reg.q -> done

    // === DEBUG Outputs ===
    connect counter.q -> debug_counter
    connect pe10.partialSumOut -> debug_pe10
    connect pe11.partialSumOut -> debug_pe11
  }
}

// ============================================================================
// PART 3: Demo Circuit
// ============================================================================
circuit SystolicArrayDemo_Hardware {
  clock clk

  impl {
    node matmul: SystolicArray2x2_Hardware

    node a00: Input(value=1)
    node a01: Input(value=2)
    node a10: Input(value=3)
    node a11: Input(value=4)

    node b00: Input(value=5)
    node b01: Input(value=6)
    node b10: Input(value=7)
    node b11: Input(value=8)

    node loadWeights: Switch
    node start: Switch

    connect a00.out -> matmul.a00
    connect a01.out -> matmul.a01
    connect a10.out -> matmul.a10
    connect a11.out -> matmul.a11

    connect b00.out -> matmul.b00
    connect b01.out -> matmul.b01
    connect b10.out -> matmul.b10
    connect b11.out -> matmul.b11

    connect loadWeights.out -> matmul.loadWeights
    connect start.out -> matmul.start
    connect clk -> matmul.clk

    node display_c00: HexDisplay
    node display_c01: HexDisplay
    node display_c10: HexDisplay
    node display_c11: HexDisplay

    connect matmul.c00 -> display_c00.in
    connect matmul.c01 -> display_c01.in
    connect matmul.c10 -> display_c10.in
    connect matmul.c11 -> display_c11.in

    node done_display: Led
    connect matmul.done -> done_display.in

    // DEBUG displays
    node debug_counter_display: HexDisplay
    node debug_pe10_display: HexDisplay
    node debug_pe11_display: HexDisplay

    connect matmul.debug_counter -> debug_counter_display.in
    connect matmul.debug_pe10 -> debug_pe10_display.in
    connect matmul.debug_pe11 -> debug_pe11_display.in
  }
}

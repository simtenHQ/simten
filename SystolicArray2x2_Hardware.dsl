// Hardware-Accurate Systolic Array 2×2
// Fully automatic operation - models real TPU behavior
//
// Operation:
// 1. Load weights: Set loadWeights=1, pulse clock
// 2. Start computation: Set start=1, pulse clock
// 3. Wait: Keep clocking, array automatically sequences data
// 4. Read results: When done=1, outputs c00-c11 are valid

circuit SystolicArray2x2_Hardware {
  // === Matrix A (data) - Static inputs ===
  input a00: Bus[8]
  input a01: Bus[8]
  input a10: Bus[8]
  input a11: Bus[8]

  // === Matrix B (weights) - Loaded once ===
  input b00: Bus[8]
  input b01: Bus[8]
  input b10: Bus[8]
  input b11: Bus[8]

  // === Control ===
  input loadWeights: Bit  // Pulse high to load weights
  input start: Bit        // Pulse high to start computation
  clock clk

  // === Outputs ===
  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]
  output done: Bit        // High when computation complete

  impl {
    // ========================================================================
    // CORE: 2×2 Processing Element Grid
    // ========================================================================
    node pe00: ProcessingElement
    node pe01: ProcessingElement
    node pe10: ProcessingElement
    node pe11: ProcessingElement

    // ========================================================================
    // INPUT STORAGE: Register matrix A values
    // ========================================================================
    node reg_a00: Register
    node reg_a01: Register
    node reg_a10: Register
    node reg_a11: Register

    // ========================================================================
    // CYCLE COUNTER: Tracks computation progress (0-7)
    // ========================================================================
    node counter: Register
    node counter_inc: Incrementer
    node counter_bits: BitSlice(low=0, high=2)  // Keep bits 0-2 (0-7)

    // ========================================================================
    // ROW 0 INPUT SEQUENCING
    // Cycle 0: feed a00
    // Cycle 1: feed a01
    // Cycle 2+: feed 0
    // ========================================================================
    node is_cycle0: Comparator
    node is_cycle1: Comparator
    node row0_active: Or
    node row0_mux: Mux      // Select a00 or a01
    node row0_gate: Mux     // Gate with 0 when inactive

    // ========================================================================
    // ROW 1 INPUT SEQUENCING (1-cycle delayed)
    // Cycle 1: feed a10
    // Cycle 2: feed a11
    // Cycle 3+: feed 0
    // ========================================================================
    node is_cycle1_row1: Comparator
    node is_cycle2: Comparator
    node row1_active: Or
    node row1_mux: Mux
    node row1_gate: Mux

    // ========================================================================
    // OUTPUT CAPTURE REGISTERS
    // Capture results at the right cycle automatically
    // ========================================================================
    node result_c00: Register
    node result_c01: Register
    node result_c10: Register
    node result_c11: Register

    // === Capture timing control ===
    node is_cycle3: Comparator  // Capture row 0 results at cycle 3
    node is_cycle4: Comparator  // Capture row 1 results at cycle 4

    // ========================================================================
    // DONE SIGNAL GENERATION
    // ========================================================================
    node is_cycle5: Comparator  // Done at cycle 5
    node done_reg: DFlipFlop

    // ========================================================================
    // CONSTANTS
    // ========================================================================
    node zero8: Constant(value=0)
    node zero16: Constant(value=0)
    node one: Constant(value=1)
    node const_0: Constant(value=0)
    node const_1: Constant(value=1)
    node const_2: Constant(value=2)
    node const_3: Constant(value=3)
    node const_4: Constant(value=4)
    node const_5: Constant(value=5)

    // === Enable counter during computation ===
    node counter_enable: Or

    // ========================================================================
    // INPUT STORAGE: Latch matrix A values when start=1
    // ========================================================================
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

    // ========================================================================
    // CYCLE COUNTER: Increments while computing
    // ========================================================================
    connect counter.q -> counter_inc.in
    connect counter_inc.out -> counter_bits.in
    connect counter_bits.out -> counter.data

    // Enable counter when start is pulsed or already counting (TODO: proper FSM)
    connect start -> counter_enable.a
    connect one.out -> counter_enable.b  // For now, always enable (simplification)
    connect counter_enable.out -> counter.we
    connect clk -> counter.clk

    // ========================================================================
    // ROW 0 INPUT SEQUENCING LOGIC
    // ========================================================================
    // Detect cycle 0
    connect counter.q -> is_cycle0.a
    connect const_0.out -> is_cycle0.b

    // Detect cycle 1
    connect counter.q -> is_cycle1.a
    connect const_1.out -> is_cycle1.b

    // Row 0 active on cycle 0 or 1
    connect is_cycle0.eq -> row0_active.a
    connect is_cycle1.eq -> row0_active.b

    // Select data: cycle 0 → a00, cycle 1 → a01
    connect is_cycle1.eq -> row0_mux.sel
    connect reg_a00.q -> row0_mux.in0
    connect reg_a01.q -> row0_mux.in1

    // Gate with zero when inactive
    connect row0_active.out -> row0_gate.sel
    connect zero8.out -> row0_gate.in0
    connect row0_mux.out -> row0_gate.in1

    // ========================================================================
    // ROW 1 INPUT SEQUENCING LOGIC (delayed by 1 cycle)
    // ========================================================================
    // Detect cycle 1
    connect counter.q -> is_cycle1_row1.a
    connect const_1.out -> is_cycle1_row1.b

    // Detect cycle 2
    connect counter.q -> is_cycle2.a
    connect const_2.out -> is_cycle2.b

    // Row 1 active on cycle 1 or 2
    connect is_cycle1_row1.eq -> row1_active.a
    connect is_cycle2.eq -> row1_active.b

    // Select data: cycle 1 → a10, cycle 2 → a11
    connect is_cycle2.eq -> row1_mux.sel
    connect reg_a10.q -> row1_mux.in0
    connect reg_a11.q -> row1_mux.in1

    // Gate with zero when inactive
    connect row1_active.out -> row1_gate.sel
    connect zero8.out -> row1_gate.in0
    connect row1_mux.out -> row1_gate.in1

    // ========================================================================
    // PE GRID: Weight Loading
    // ========================================================================
    connect b00 -> pe00.weightIn
    connect b01 -> pe01.weightIn
    connect b10 -> pe10.weightIn
    connect b11 -> pe11.weightIn
    connect loadWeights -> pe00.loadWeight
    connect loadWeights -> pe01.loadWeight
    connect loadWeights -> pe10.loadWeight
    connect loadWeights -> pe11.loadWeight

    // ========================================================================
    // PE GRID: Clock Distribution
    // ========================================================================
    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // ========================================================================
    // PE GRID: Horizontal Data Flow (sequenced inputs)
    // ========================================================================
    connect row0_gate.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn

    connect row1_gate.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // ========================================================================
    // PE GRID: Vertical Partial Sum Flow
    // ========================================================================
    connect zero16.out -> pe00.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn

    connect zero16.out -> pe01.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn

    // ========================================================================
    // OUTPUT CAPTURE: Automatic timing
    // ========================================================================
    // Capture row 0 results (c00, c01) at cycle 3
    connect counter.q -> is_cycle3.a
    connect const_3.out -> is_cycle3.b

    connect pe10.partialSumOut -> result_c00.data
    connect pe11.partialSumOut -> result_c01.data
    connect is_cycle3.eq -> result_c00.we
    connect is_cycle3.eq -> result_c01.we
    connect clk -> result_c00.clk
    connect clk -> result_c01.clk

    // Capture row 1 results (c10, c11) at cycle 4
    connect counter.q -> is_cycle4.a
    connect const_4.out -> is_cycle4.b

    connect pe10.partialSumOut -> result_c10.data
    connect pe11.partialSumOut -> result_c11.data
    connect is_cycle4.eq -> result_c10.we
    connect is_cycle4.eq -> result_c11.we
    connect clk -> result_c10.clk
    connect clk -> result_c11.clk

    // ========================================================================
    // DONE SIGNAL: Set at cycle 5
    // ========================================================================
    connect counter.q -> is_cycle5.a
    connect const_5.out -> is_cycle5.b
    connect is_cycle5.eq -> done_reg.d
    connect clk -> done_reg.clk

    // ========================================================================
    // OUTPUTS
    // ========================================================================
    connect result_c00.q -> c00
    connect result_c01.q -> c01
    connect result_c10.q -> c10
    connect result_c11.q -> c11
    connect done_reg.q -> done
  }
}

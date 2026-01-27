// Hardware-Accurate Systolic Array with Automatic Input Sequencing
// Models real TPU-style operation: diagonal wavefront data flow

circuit SystolicArray2x2_Auto {
  // Matrix A stored in registers (simulates input FIFO/buffer)
  input a00: Bus[8]
  input a01: Bus[8]
  input a10: Bus[8]
  input a11: Bus[8]

  // Matrix B (weights, loaded once)
  input b00: Bus[8]
  input b01: Bus[8]
  input b10: Bus[8]
  input b11: Bus[8]

  // Control signals
  input loadWeights: Bit  // Pulse high to load weights
  input enable: Bit       // Keep high during computation
  clock clk

  // Outputs
  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]

  impl {
    // === Processing Element Grid ===
    node pe00: ProcessingElement
    node pe01: ProcessingElement
    node pe10: ProcessingElement
    node pe11: ProcessingElement

    // === Input Buffers (store matrix A values) ===
    node buf_a00: Register
    node buf_a01: Register
    node buf_a10: Register
    node buf_a11: Register

    // === Cycle Counter (2-bit, counts 0-3) ===
    node cycle_count: Register
    node cycle_inc: Incrementer
    node cycle_mod: BitSlice(low=0, high=1)  // Keep only bits 0-1 (modulo 4)

    // === Row 0 Input Selection ===
    // Cycle 0: feed a00
    // Cycle 1: feed a01
    // Cycle 2+: feed 0
    node cycle0: Comparator  // Is cycle == 0?
    node cycle1: Comparator  // Is cycle == 1?
    node row0_is_active: Or  // Active on cycle 0 or 1
    node row0_sel: And       // Select a00 vs a01
    node row0_mux: Mux       // Choose data source
    node row0_enable: Mux    // Gate data with 0

    // === Row 1 Input Selection (1-cycle delayed) ===
    // Cycle 1: feed a10
    // Cycle 2: feed a11
    // Cycle 3+: feed 0
    node row1_is_active: Or
    node row1_sel: And
    node row1_mux: Mux
    node row1_enable: Mux

    // === Constants ===
    node zero8: Constant(value=0)
    node zero16: Constant(value=0)
    node one: Constant(value=1)
    node const_0: Constant(value=0)
    node const_1: Constant(value=1)
    node const_2: Constant(value=2)

    // === Input Buffers Setup ===
    connect a00 -> buf_a00.data
    connect a01 -> buf_a01.data
    connect a10 -> buf_a10.data
    connect a11 -> buf_a11.data
    connect one.out -> buf_a00.we
    connect one.out -> buf_a01.we
    connect one.out -> buf_a10.we
    connect one.out -> buf_a11.we
    connect clk -> buf_a00.clk
    connect clk -> buf_a01.clk
    connect clk -> buf_a10.clk
    connect clk -> buf_a11.clk

    // === Cycle Counter ===
    connect cycle_count.q -> cycle_inc.in
    connect cycle_inc.out -> cycle_mod.in
    connect cycle_mod.out -> cycle_count.data
    connect enable -> cycle_count.we
    connect clk -> cycle_count.clk

    // === Row 0 Sequencing Logic ===
    // Check if cycle == 0
    connect cycle_count.q -> cycle0.a
    connect const_0.out -> cycle0.b
    // Check if cycle == 1
    connect cycle_count.q -> cycle1.a
    connect const_1.out -> cycle1.b
    // Row 0 active on cycles 0 or 1
    connect cycle0.eq -> row0_is_active.a
    connect cycle1.eq -> row0_is_active.b
    // Select: cycle0 → a00, cycle1 → a01
    connect cycle1.eq -> row0_mux.sel
    connect buf_a00.q -> row0_mux.in0
    connect buf_a01.q -> row0_mux.in1
    // Enable mux: if active output data, else output 0
    connect row0_is_active.out -> row0_enable.sel
    connect zero8.out -> row0_enable.in0
    connect row0_mux.out -> row0_enable.in1

    // === Row 1 Sequencing Logic (similar, but cycles 1-2) ===
    // TODO: Add similar logic for row 1

    // === PE Grid - Weight Loading ===
    connect b00 -> pe00.weightIn
    connect b01 -> pe01.weightIn
    connect b10 -> pe10.weightIn
    connect b11 -> pe11.weightIn
    connect loadWeights -> pe00.loadWeight
    connect loadWeights -> pe01.loadWeight
    connect loadWeights -> pe10.loadWeight
    connect loadWeights -> pe11.loadWeight

    // === PE Grid - Clocks ===
    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // === PE Grid - Horizontal Data Flow ===
    connect row0_enable.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    // TODO: Connect row1_enable.out -> pe10.dataIn
    connect zero8.out -> pe10.dataIn  // Placeholder
    connect pe10.dataOut -> pe11.dataIn

    // === PE Grid - Vertical Partial Sums ===
    connect zero16.out -> pe00.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn
    connect zero16.out -> pe01.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn

    // === Outputs ===
    connect pe10.partialSumOut -> c00
    connect pe11.partialSumOut -> c01
    connect pe10.partialSumOut -> c10
    connect pe11.partialSumOut -> c11
  }
}

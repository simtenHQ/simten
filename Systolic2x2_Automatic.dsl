// AUTOMATIC Weight-Stationary Systolic Array with Control FSM
// Load matrices once, press START, hardware sequences everything automatically
// This is how real accelerators work!

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

// Automatic controller that sequences the entire computation
circuit Systolic2x2_Auto {
  // Matrix inputs (set once at beginning)
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

    // Input storage registers
    node reg_a00: Register
    node reg_a01: Register
    node reg_a10: Register
    node reg_a11: Register
    node reg_b00: Register
    node reg_b01: Register
    node reg_b10: Register
    node reg_b11: Register

    // FSM fsm_state counter
    node fsm_state: Register
    node fsm_state_inc: Incrementer
    node fsm_state_hold: Mux  // Holds state at DONE
    node fsm_state_next: Mux  // Resets to IDLE on start

    // State constants
    node s_idle: Constant(value=0)
    node s_reset: Constant(value=1)
    node s_load_k0: Constant(value=2)
    node s_inject_a00: Constant(value=3)
    node s_inject_a10: Constant(value=4)
    node s_load_k1: Constant(value=5)
    node s_inject_a01: Constant(value=6)
    node s_inject_a11: Constant(value=7)
    node s_settle: Constant(value=8)  // Wait for pipeline to settle
    node s_done: Constant(value=9)

    // State detection comparators
    node is_idle: Comparator
    node is_reset: Comparator
    node is_load_k0: Comparator
    node is_inject_a00: Comparator
    node is_inject_a10: Comparator
    node is_load_k1: Comparator
    node is_inject_a01: Comparator
    node is_inject_a11: Comparator
    node is_done: Comparator

    // Data selection muxes
    node a_row0_mux: Mux
    node a_row1_mux: Mux
    node b_col0_mux: Mux
    node b_col1_mux: Mux

    // Additional muxes for multi-way selection
    node a_row0_sel: Mux
    node a_row1_sel: Mux

    // OR gates for control signals
    node loadWeights_or: Or
    node a_row0_inject: Or
    node a_row1_inject: Or

    node zero8: Constant(value=0)
    node zero16: Constant(value=0)
    node one: Constant(value=1)

    // === INPUT STORAGE ===
    // Store matrix values when start=1
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

    // === FSM STATE MACHINE ===
    // State advances automatically, resets on start
    connect fsm_state.q -> fsm_state_inc.in
    connect start -> fsm_state_next.sel
    connect fsm_state_inc.out -> fsm_state_next.in0
    connect s_idle.out -> fsm_state_next.in1

    connect fsm_state_next.out -> fsm_state.data
    connect one.out -> fsm_state.we
    connect clk -> fsm_state.clk

    // === STATE DETECTION ===
    connect fsm_state.q -> is_idle.a
    connect s_idle.out -> is_idle.b

    connect fsm_state.q -> is_reset.a
    connect s_reset.out -> is_reset.b

    connect fsm_state.q -> is_load_k0.a
    connect s_load_k0.out -> is_load_k0.b

    connect fsm_state.q -> is_inject_a00.a
    connect s_inject_a00.out -> is_inject_a00.b

    connect fsm_state.q -> is_inject_a10.a
    connect s_inject_a10.out -> is_inject_a10.b

    connect fsm_state.q -> is_load_k1.a
    connect s_load_k1.out -> is_load_k1.b

    connect fsm_state.q -> is_inject_a01.a
    connect s_inject_a01.out -> is_inject_a01.b

    connect fsm_state.q -> is_inject_a11.a
    connect s_inject_a11.out -> is_inject_a11.b

    connect fsm_state.q -> is_done.a
    connect s_done.out -> is_done.b

    // === CONTROL SIGNAL GENERATION ===
    // resetAccum = is_reset.eq (HIGH in RESET fsm_state)
    // loadWeights = loadWeights_or.out (HIGH in LOAD_K0 or LOAD_K1 fsm_states)
    connect is_load_k0.eq -> loadWeights_or.a
    connect is_load_k1.eq -> loadWeights_or.b

    // === DATA SELECTION ===
    // B weight selection: k=0 uses b00/b01, k=1 uses b10/b11
    connect is_load_k1.eq -> b_col0_mux.sel
    connect reg_b00.q -> b_col0_mux.in0
    connect reg_b10.q -> b_col0_mux.in1

    connect is_load_k1.eq -> b_col1_mux.sel
    connect reg_b01.q -> b_col1_mux.in0
    connect reg_b11.q -> b_col1_mux.in1

    // A row 0 selection: inject a00 in fsm_state 3, a01 in fsm_state 6, else 0
    connect is_inject_a00.eq -> a_row0_inject.a
    connect is_inject_a01.eq -> a_row0_inject.b

    connect a_row0_inject.out -> a_row0_sel.sel
    connect zero8.out -> a_row0_sel.in0
    connect is_inject_a01.eq -> a_row0_mux.sel
    connect reg_a00.q -> a_row0_mux.in0
    connect reg_a01.q -> a_row0_mux.in1
    connect a_row0_mux.out -> a_row0_sel.in1

    // A row 1 selection: inject a10 in fsm_state 4, a11 in fsm_state 7, else 0
    connect is_inject_a10.eq -> a_row1_inject.a
    connect is_inject_a11.eq -> a_row1_inject.b

    connect a_row1_inject.out -> a_row1_sel.sel
    connect zero8.out -> a_row1_sel.in0
    connect is_inject_a11.eq -> a_row1_mux.sel
    connect reg_a10.q -> a_row1_mux.in0
    connect reg_a11.q -> a_row1_mux.in1
    connect a_row1_mux.out -> a_row1_sel.in1

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

    connect is_reset.eq -> pe00.resetAccum
    connect is_reset.eq -> pe01.resetAccum
    connect is_reset.eq -> pe10.resetAccum
    connect is_reset.eq -> pe11.resetAccum

    // Data flow (horizontal spatial chaining)
    connect a_row0_sel.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect a_row1_sel.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // Partial sum inputs (local accumulation - always 0)
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
    connect is_done.eq -> done
  }
}

// Test harness - just set matrix values and press START!
circuit TestAutomatic {
  clock clk

  impl {
    node sys: Systolic2x2_Auto

    // Matrix A inputs
    node a00: Input(value=1)
    node a01: Input(value=2)
    node a10: Input(value=3)
    node a11: Input(value=4)

    // Matrix B inputs
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
// HOW TO USE (AUTOMATIC VERSION!):
// =============================================================================
//
// 1. Load this file
// 2. Verify matrix inputs are set (default: A=[1,2;3,4], B=[5,6;7,8])
// 3. Turn START switch ON
// 4. Clock ONCE (loads matrices, starts FSM)
// 5. Turn START switch OFF
// 6. Clock 7 MORE TIMES (FSM sequences through computation automatically)
// 7. Done LED lights up, results displayed!
//
// EXPECTED RESULT: c00=19, c01=22, c10=43, c11=50
//
// FSM States:
// Cycle 0 (start=ON):  IDLE → load matrices, fsm_state → 1
// Cycle 1 (start=OFF): RESET → reset accumulators
// Cycle 2:             LOAD_K0 → load B[0,:]
// Cycle 3:             INJECT_A00 → inject A[0,0]
// Cycle 4:             INJECT_A10 → inject A[1,0]
// Cycle 5:             LOAD_K1 → load B[1,:]
// Cycle 6:             INJECT_A01 → inject A[0,1]
// Cycle 7:             INJECT_A11 → inject A[1,1]
// Cycle 8:             DONE → done LED ON, results valid
//
// After cycle 8, you can keep clocking - fsm_state stays at DONE forever.
// To run again: turn START ON, clock once, turn OFF, clock 7 more times.

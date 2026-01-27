// TRUE Weight-Stationary Systolic Array with Local Accumulation
// PE(i,j) computes C[i,j] via local accumulator (not psum-flow)
// Data flows spatially (horizontal), time advances k naturally
//
// CRITICAL CONSTRAINT: During weight reload (loadWeights=1),
// all data inputs must be 0. This is enforced by discipline, not hardware.
// Production design would gate dataIn or stall during reload.

circuit ProcessingElement {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input loadWeight: Bit
  input resetAccum: Bit
  clock clk
  output dataOut: Bus[8]
  output result: Bus[16]

  impl {
    node weightReg: Register
    node mult: Multiplier
    node adder: Adder(width=16)
    node accum: Register  // Local accumulator
    node dataPipe: Register

    // Reset mux for accumulator
    node accum_mux: Mux

    node one: Constant(value=1)
    node zero: Constant(value=0)
    node zero16: Constant(value=0)

    // Weight storage (stationary during k-phase)
    connect weightIn -> weightReg.data
    connect loadWeight -> weightReg.we
    connect clk -> weightReg.clk

    // MAC: result = (dataIn × weight) + accum
    // KEY FIX: Accumulator feeds back into itself
    connect dataIn -> mult.a
    connect weightReg.q -> mult.b
    connect mult.product -> adder.a
    connect accum.q -> adder.b  // ACCUMULATOR FEEDBACK!
    connect zero.out -> adder.carry_in

    // Accumulator with reset capability
    connect resetAccum -> accum_mux.sel
    connect adder.sum -> accum_mux.in0  // Normal: accumulate
    connect zero16.out -> accum_mux.in1  // Reset: clear to 0

    connect accum_mux.out -> accum.data
    connect one.out -> accum.we
    connect clk -> accum.clk
    connect accum.q -> result

    // Data passthrough (spatial flow)
    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}

// 2×2 Weight-Stationary Systolic Array (Local Accumulation Variant)
// Not psum-flow (no vertical partial sum propagation)
// Each PE accumulates independently via internal feedback
//
// Requires external FSM/user to:
// - Inject A diagonally over time: t(A[i,k] → PE(i,j)) = i + j + k
// - Reload weights per k-phase
// - Ensure dataIn=0 during weight reload cycles
// - Sequence computation phases
circuit Systolic2x2_WS {
  // Data inputs (injected temporally)
  input a_row0: Bus[8]  // Inject A[0,k] at time t=k
  input a_row1: Bus[8]  // Inject A[1,k] at time t=k+1 (staggered)

  // Weight inputs (reload per k-phase)
  input b_col0: Bus[8]  // B[k,0] for current k
  input b_col1: Bus[8]  // B[k,1] for current k

  input loadWeights: Bit
  input resetAccum: Bit
  clock clk

  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]

  impl {
    node pe00: ProcessingElement
    node pe01: ProcessingElement
    node pe10: ProcessingElement
    node pe11: ProcessingElement

    // Weight distribution - COLUMN-WISE
    // All PEs in column j store B[k,j] during k-phase
    connect b_col0 -> pe00.weightIn
    connect b_col0 -> pe10.weightIn  // Same weight!
    connect b_col1 -> pe01.weightIn
    connect b_col1 -> pe11.weightIn  // Same weight!

    connect loadWeights -> pe00.loadWeight
    connect loadWeights -> pe01.loadWeight
    connect loadWeights -> pe10.loadWeight
    connect loadWeights -> pe11.loadWeight

    connect resetAccum -> pe00.resetAccum
    connect resetAccum -> pe01.resetAccum
    connect resetAccum -> pe10.resetAccum
    connect resetAccum -> pe11.resetAccum

    // SPATIAL DATA FLOW (horizontal chaining)
    // Row 0: a_row0 → PE(0,0) → PE(0,1)
    connect a_row0 -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn  // Chained, not broadcast!

    // Row 1: a_row1 → PE(1,0) → PE(1,1)
    connect a_row1 -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn  // Chained, not broadcast!

    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // Each PE outputs its accumulated C[i,j]
    connect pe00.result -> c00
    connect pe01.result -> c01
    connect pe10.result -> c10
    connect pe11.result -> c11
  }
}

// Test harness with manual control
// User must sequence: reset → load weights → inject data → reload weights → inject data
circuit TestSystolic_WS {
  clock clk

  impl {
    node sys: Systolic2x2_WS

    // Data inputs (user controls injection timing)
    node a_row0: Input(value=0)  // Set to A[0,k] at time t=k
    node a_row1: Input(value=0)  // Set to A[1,k] at time t=k+1

    // Weight inputs (user reloads per k-phase)
    node b_col0: Input(value=0)  // Set to B[k,0]
    node b_col1: Input(value=0)  // Set to B[k,1]

    node loadWeights: Switch
    node resetAccum: Switch

    connect a_row0.out -> sys.a_row0
    connect a_row1.out -> sys.a_row1
    connect b_col0.out -> sys.b_col0
    connect b_col1.out -> sys.b_col1
    connect loadWeights.out -> sys.loadWeights
    connect resetAccum.out -> sys.resetAccum
    connect clk -> sys.clk

    node display_c00: HexDisplay
    node display_c01: HexDisplay
    node display_c10: HexDisplay
    node display_c11: HexDisplay

    connect sys.c00 -> display_c00.in
    connect sys.c01 -> display_c01.in
    connect sys.c10 -> display_c10.in
    connect sys.c11 -> display_c11.in
  }
}

// EXECUTION SEQUENCE for A=[1,2;3,4] × B=[5,6;7,8]:
//
// Cycle 0: RESET
//   resetAccum=ON, clock
//   All accumulators → 0
//
// === K=0 PHASE: A[:,0] × B[0,:] ===
// Cycle 1: LOAD WEIGHTS K=0
//   resetAccum=OFF, loadWeights=ON
//   b_col0=5 (B[0,0]), b_col1=6 (B[0,1])
//   a_row0=0, a_row1=0
//   clock
//
// Cycle 2: INJECT A[0,0]
//   loadWeights=OFF
//   a_row0=1 (A[0,0]), a_row1=0
//   clock
//   → PE(0,0): 0 + 1×5 = 5
//   → PE(0,1): 0 + 0×6 = 0 (data not arrived yet)
//
// Cycle 3: INJECT A[1,0], A[0,0] PROPAGATES
//   a_row0=0, a_row1=3 (A[1,0])
//   clock
//   → PE(0,0): 5 + 0×5 = 5 (no new data)
//   → PE(0,1): 0 + 1×6 = 6 (receives A[0,0] from PE(0,0))
//   → PE(1,0): 0 + 3×5 = 15
//
// Cycle 4: A[1,0] PROPAGATES
//   a_row0=0, a_row1=0
//   clock
//   → PE(1,1): 0 + 3×6 = 18 (receives A[1,0] from PE(1,0))
//
// After k=0: c00=5, c01=6, c10=15, c11=18
//
// === K=1 PHASE: A[:,1] × B[1,:] ===
// Cycle 5: RELOAD WEIGHTS K=1
//   loadWeights=ON
//   b_col0=7 (B[1,0]), b_col1=8 (B[1,1])
//   a_row0=0, a_row1=0
//   clock
//
// Cycle 6: INJECT A[0,1]
//   loadWeights=OFF
//   a_row0=2 (A[0,1]), a_row1=0
//   clock
//   → PE(0,0): 5 + 2×7 = 19
//
// Cycle 7: INJECT A[1,1], A[0,1] PROPAGATES
//   a_row0=0, a_row1=4 (A[1,1])
//   clock
//   → PE(0,1): 6 + 2×8 = 22
//   → PE(1,0): 15 + 4×7 = 43
//
// Cycle 8: A[1,1] PROPAGATES
//   a_row0=0, a_row1=0
//   clock
//   → PE(1,1): 18 + 4×8 = 50
//
// FINAL RESULT: c00=19, c01=22, c10=43, c11=50 ✓

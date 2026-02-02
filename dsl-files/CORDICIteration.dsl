// CORDIC (Coordinate Rotation Digital Computer) - Fixed with Signed Arithmetic
//
// CORDIC rotates a vector (x, y) by angle z using only shifts and adds.
//
// This example: Start at 0° (pointing right), rotate by 45° to point diagonal
// Expected result: x ≈ y ≈ 93 (with CORDIC gain: 80 × 0.707 × 1.647)
//
// Using smaller values to avoid 8-bit overflow!
//
// Basic CORDIC rotation formulas:
//   x_next = x - direction * (y >> iteration)
//   y_next = y + direction * (x >> iteration)
//   z_next = z - direction * angle_table[iteration]
//
// Where direction = +1 if z >= 0, -1 if z < 0
//
// This version uses SIGNED arithmetic throughout for correct results.

circuit CORDICIteration {
  clock clk

  impl {
    // Current state (x, y, z coordinates and iteration counter)
    // Starting at 0° (horizontal), rotating by 45° to diagonal
    node x: Register(initial=80)     // Starting vector pointing right (80, 0)
    node y: Register(initial=0)      // No vertical component yet
    node z: Register(initial=32)     // Rotate by 45° (32 units = 45°)
    node iteration: Register(initial=0)  // Current iteration (0-7)

    // Constants
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node eight: Constant(value=8)

    // Check if z is positive (determines rotation direction)
    node zPositive: SignedComparator
    connect z.q -> zPositive.a
    connect zero.out -> zPositive.b
    // zPositive.gte tells us if z >= 0 (rotate counterclockwise)

    // Shift x and y by iteration amount
    node xShifted: RightShifter
    node yShifted: RightShifter
    connect x.q -> xShifted.value
    connect y.q -> yShifted.value
    connect iteration.q -> xShifted.shift
    connect iteration.q -> yShifted.shift

    // ===== Compute x_next using SIGNED arithmetic =====
    // If z >= 0: x_next = x - y_shifted
    // If z < 0:  x_next = x + y_shifted

    // For subtraction: x - y = x + (~y + 1)
    node yShiftedNeg: BusNot
    connect yShifted.result -> yShiftedNeg.in

    node xSubtract: SignedAdder  // x - y_shifted (for z >= 0)
    connect x.q -> xSubtract.a
    connect yShiftedNeg.out -> xSubtract.b
    connect one.out -> xSubtract.carry_in  // +1 completes two's complement

    node xAdd: SignedAdder  // x + y_shifted (for z < 0)
    connect x.q -> xAdd.a
    connect yShifted.result -> xAdd.b
    connect zero.out -> xAdd.carry_in

    // Select based on z sign
    node xUpdate: Mux
    connect zPositive.gte -> xUpdate.sel
    connect xAdd.sum -> xUpdate.in0       // z < 0: add
    connect xSubtract.sum -> xUpdate.in1  // z >= 0: subtract

    // ===== Compute y_next using SIGNED arithmetic =====
    // If z >= 0: y_next = y + x_shifted
    // If z < 0:  y_next = y - x_shifted

    // For subtraction: y - x = y + (~x + 1)
    node xShiftedNeg: BusNot
    connect xShifted.result -> xShiftedNeg.in

    node yAdd: SignedAdder  // y + x_shifted (for z >= 0)
    connect y.q -> yAdd.a
    connect xShifted.result -> yAdd.b
    connect zero.out -> yAdd.carry_in

    node ySubtract: SignedAdder  // y - x_shifted (for z < 0)
    connect y.q -> ySubtract.a
    connect xShiftedNeg.out -> ySubtract.b
    connect one.out -> ySubtract.carry_in  // +1 completes two's complement

    // Select based on z sign
    node yUpdate: Mux
    connect zPositive.gte -> yUpdate.sel
    connect ySubtract.sum -> yUpdate.in0  // z < 0: subtract
    connect yAdd.sum -> yUpdate.in1       // z >= 0: add

    // ===== CORDIC angle table =====
    // atan(2^-i) scaled to 8-bit range
    node angle0: Constant(value=32)  // atan(1) ≈ 45°
    node angle1: Constant(value=19)  // atan(0.5) ≈ 26.6°
    node angle2: Constant(value=10)  // atan(0.25) ≈ 14°
    node angle3: Constant(value=5)   // atan(0.125) ≈ 7.1°
    node angle4: Constant(value=3)   // atan(0.0625) ≈ 3.6°
    node angle5: Constant(value=1)   // atan(0.03125) ≈ 1.8°
    node angle6: Constant(value=1)   // atan(0.015625) ≈ 0.9°
    node angle7: Constant(value=0)   // atan(0.0078125) ≈ 0.4°

    // Select current angle using cascaded muxes
    node bit0: BitSlice(low=0, high=0)
    node bit1: BitSlice(low=1, high=1)
    node bit2: BitSlice(low=2, high=2)
    connect iteration.q -> bit0.in
    connect iteration.q -> bit1.in
    connect iteration.q -> bit2.in

    // Layer 1: pairs
    node mux01: Mux
    node mux23: Mux
    node mux45: Mux
    node mux67: Mux
    connect bit0.out -> mux01.sel
    connect bit0.out -> mux23.sel
    connect bit0.out -> mux45.sel
    connect bit0.out -> mux67.sel
    connect angle0.out -> mux01.in0
    connect angle1.out -> mux01.in1
    connect angle2.out -> mux23.in0
    connect angle3.out -> mux23.in1
    connect angle4.out -> mux45.in0
    connect angle5.out -> mux45.in1
    connect angle6.out -> mux67.in0
    connect angle7.out -> mux67.in1

    // Layer 2: groups of 4
    node mux0123: Mux
    node mux4567: Mux
    connect bit1.out -> mux0123.sel
    connect bit1.out -> mux4567.sel
    connect mux01.out -> mux0123.in0
    connect mux23.out -> mux0123.in1
    connect mux45.out -> mux4567.in0
    connect mux67.out -> mux4567.in1

    // Layer 3: final selection
    node angleSel: Mux
    connect bit2.out -> angleSel.sel
    connect mux0123.out -> angleSel.in0
    connect mux4567.out -> angleSel.in1

    // ===== Update z using SIGNED arithmetic =====
    // If z >= 0: z_next = z - angle
    // If z < 0:  z_next = z + angle

    // For subtraction: z - angle = z + (~angle + 1)
    node angleNeg: BusNot
    connect angleSel.out -> angleNeg.in

    node zSubtract: SignedAdder  // z - angle (for z >= 0)
    connect z.q -> zSubtract.a
    connect angleNeg.out -> zSubtract.b
    connect one.out -> zSubtract.carry_in

    node zAdd: SignedAdder  // z + angle (for z < 0)
    connect z.q -> zAdd.a
    connect angleSel.out -> zAdd.b
    connect zero.out -> zAdd.carry_in

    // Select based on z sign
    node zUpdate: Mux
    connect zPositive.gte -> zUpdate.sel
    connect zAdd.sum -> zUpdate.in0         // z < 0: add angle
    connect zSubtract.sum -> zUpdate.in1    // z >= 0: subtract angle

    // ===== Iteration control =====
    node iterInc: Incrementer
    connect iteration.q -> iterInc.in

    // Check if we should keep iterating (iteration < 8)
    node shouldContinue: Comparator
    connect iteration.q -> shouldContinue.a
    connect eight.out -> shouldContinue.b

    // Write enable for registers
    connect shouldContinue.lt -> x.we
    connect shouldContinue.lt -> y.we
    connect shouldContinue.lt -> z.we
    connect shouldContinue.lt -> iteration.we

    // Connect updates to register inputs
    connect xUpdate.out -> x.data
    connect yUpdate.out -> y.data
    connect zUpdate.out -> z.data
    connect iterInc.out -> iteration.data

    // ===== Display outputs =====
    node xDisplay: HexDisplay
    node yDisplay: HexDisplay
    node zDisplay: HexDisplay
    node iterDisplay: HexDisplay

    connect x.q -> xDisplay.in
    connect y.q -> yDisplay.in
    connect z.q -> zDisplay.in
    connect iteration.q -> iterDisplay.in

    // Status LED (lights when done)
    node doneCheck: Comparator
    node doneLed: Led
    connect iteration.q -> doneCheck.a
    connect eight.out -> doneCheck.b
    connect doneCheck.eq -> doneLed.in

    // ===== Clock connections =====
    connect clk -> x.clk
    connect clk -> y.clk
    connect clk -> z.clk
    connect clk -> iteration.clk
  }
}

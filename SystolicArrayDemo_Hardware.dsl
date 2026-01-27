// Demo: Hardware-Accurate Systolic Array
// Computes: [1 2; 3 4] × [5 6; 7 8] = [19 22; 43 50]
//
// USAGE:
// 1. Set loadWeights Switch ON, clock once (loads weights)
// 2. Set loadWeights Switch OFF
// 3. Set start Switch ON, clock once (starts computation)
// 4. Set start Switch OFF
// 5. Keep clocking - watch cycle counter and done signal
// 6. When done=1, read results from hex displays!

circuit SystolicArrayDemo_Hardware {
  clock clk

  impl {
    // === Hardware-Accurate Systolic Array ===
    node matmul: SystolicArray2x2_Hardware

    // === Matrix A (data) ===
    node a00: Input(value=1)
    node a01: Input(value=2)
    node a10: Input(value=3)
    node a11: Input(value=4)

    // === Matrix B (weights) ===
    node b00: Input(value=5)
    node b01: Input(value=6)
    node b10: Input(value=7)
    node b11: Input(value=8)

    // === Control Switches ===
    node loadWeights: Switch  // Step 1: ON to load, then OFF
    node start: Switch        // Step 2: Pulse ON then OFF to start

    // === Connect Inputs ===
    connect a00.out -> matmul.a00
    connect a01.out -> matmul.a01
    connect a10.out -> matmul.a10
    connect a11.out -> matmul.a11

    connect b00.out -> matmul.b00
    connect b01.out -> matmul.b01
    connect b10.out -> matmul.b10
    connect b11.out -> matmul.b11

    // === Connect Control ===
    connect loadWeights.out -> matmul.loadWeights
    connect start.out -> matmul.start
    connect clk -> matmul.clk

    // === Result Displays ===
    node display_c00: HexDisplay
    node display_c01: HexDisplay
    node display_c10: HexDisplay
    node display_c11: HexDisplay

    connect matmul.c00 -> display_c00.in
    connect matmul.c01 -> display_c01.in
    connect matmul.c10 -> display_c10.in
    connect matmul.c11 -> display_c11.in

    // === Status Display ===
    node done_display: Led  // Lights up when computation complete

    connect matmul.done -> done_display.in
  }
}

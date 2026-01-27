// Systolic Array Matrix Multiplication Demo (Verbose Output)
// Computes: [1 2; 3 4] × [5 6; 7 8] = [19 22; 43 50]

circuit SystolicArrayDemo_Verbose {
  clock clk

  impl {
    // === Systolic Array ===
    node matmul: SystolicArray2x2

    // === Matrix A Inputs (data) ===
    node a00: Input(value=1)
    node a01: Input(value=2)
    node a10: Input(value=3)
    node a11: Input(value=4)

    // === Matrix B Inputs (weights) ===
    node b00: Input(value=5)
    node b01: Input(value=6)
    node b10: Input(value=7)
    node b11: Input(value=8)

    // === Control ===
    node loadWeights: Switch  // Toggle: ON to load weights, OFF to compute

    // === Connect Matrix A ===
    connect a00.out -> matmul.a00
    connect a01.out -> matmul.a01
    connect a10.out -> matmul.a10
    connect a11.out -> matmul.a11

    // === Connect Matrix B ===
    connect b00.out -> matmul.b00
    connect b01.out -> matmul.b01
    connect b10.out -> matmul.b10
    connect b11.out -> matmul.b11

    // === Connect Control ===
    connect loadWeights.out -> matmul.loadWeights
    connect clk -> matmul.clk

    // === Row 0 Results (C[0,0] and C[0,1]) ===
    node hex_c00: HexDisplay
    node hex_c01: HexDisplay

    connect matmul.c00 -> hex_c00.in
    connect matmul.c01 -> hex_c01.in

    // === Row 1 Results (C[1,0] and C[1,1]) ===
    node hex_c10: HexDisplay
    node hex_c11: HexDisplay

    connect matmul.c10 -> hex_c10.in
    connect matmul.c11 -> hex_c11.in

    // === Optional: Add Probes for debugging ===
    node probe_c00: Probe
    node probe_c01: Probe
    node probe_c10: Probe
    node probe_c11: Probe

    connect matmul.c00 -> probe_c00.in
    connect matmul.c01 -> probe_c01.in
    connect matmul.c10 -> probe_c10.in
    connect matmul.c11 -> probe_c11.in
  }
}
